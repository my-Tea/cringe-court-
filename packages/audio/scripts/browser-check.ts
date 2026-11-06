/**
 * Proves the package in a real browser: builds the demo, serves it, opens it in
 * headless Chrome (autoplay allowed), runs the demo's `?selftest` (every cue
 * once), and measures the signal actually reaching the AudioContext
 * destination with an AnalyserNode tap. Also saves screenshots.
 *
 *   tsx scripts/browser-check.ts [--chrome /path/to/chrome] [--shots <dir>]
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-demo');
const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const chrome = opt('--chrome') ?? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
const shots = opt('--shots');
if (!chrome) throw new Error('No Chrome found; pass --chrome');

execFileSync('npx', ['vite', 'build', 'demo', '--outDir', '../dist-demo', '--emptyOutDir', '--base', './', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' });

const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]!).replace(/\/$/, '/index.html'));
  if (!path.startsWith(dist) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port;
const url = `http://127.0.0.1:${port}/index.html`;

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--mute-audio'],
});
let failed = false;
try {
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && !m.location().url?.endsWith('favicon.ico') && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  // Tap: every context's destination also feeds an analyser that tracks the peak.
  // (A string, not a function: tsx would inject helpers that do not exist in the page.)
  await page.evaluateOnNewDocument(`
    window.__peak = 0;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(o) {
        super(o);
        const an = this.createAnalyser();
        an.fftSize = 2048;
        const buf = new Float32Array(an.fftSize);
        const tap = this.createGain();
        tap.connect(super.destination);
        tap.connect(an);
        Object.defineProperty(this, 'destination', { get: () => tap });
        setInterval(() => {
          an.getFloatTimeDomainData(buf);
          for (const x of buf) window.__peak = Math.max(window.__peak, Math.abs(x));
        }, 20);
      }
    };
  `);

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${url}?selftest`);
  await page.waitForSelector('body[data-selftest="done"]', { timeout: 60_000 });
  const result = (await page.evaluate('({ self: window.__selftest, peak: window.__peak })')) as {
    self: { state: string; results: { cue: string; played: boolean }[]; errors: string[] };
    peak: number;
  };
  const notPlayed = result.self.results.filter((r) => !r.played).map((r) => r.cue);
  console.log(`engine state: ${result.self.state}`);
  console.log(`cues played: ${result.self.results.length - notPlayed.length}/${result.self.results.length}${notPlayed.length ? ` (not played: ${notPlayed.join(', ')})` : ''}`);
  console.log(`peak at destination: ${(20 * Math.log10(result.peak || 1e-9)).toFixed(1)} dBFS`);
  console.log(`engine errors: ${result.self.errors.length}; console errors: ${consoleErrors.length}`);
  for (const e of [...result.self.errors, ...consoleErrors]) console.log(`  ! ${e}`);
  if (result.self.state !== 'running' || notPlayed.length || result.self.errors.length || consoleErrors.length || !(result.peak > 0.01) || result.peak > 1) failed = true;

  if (shots) {
    mkdirSync(shots, { recursive: true });
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 1280, height: 900 });
    await p2.goto(url);
    await p2.screenshot({ path: join(shots, 'gate.png') });
    await p2.evaluate("document.querySelector('button')?.click()");
    await new Promise((r) => setTimeout(r, 800));
    await p2.screenshot({ path: join(shots, 'desktop.png'), fullPage: true });
    await p2.setViewport({ width: 375, height: 800 });
    await new Promise((r) => setTimeout(r, 300));
    await p2.screenshot({ path: join(shots, 'mobile.png'), fullPage: true });
    console.log(`screenshots in ${shots}`);
  }
} finally {
  await browser.close();
  server.close();
  rmSync(dist, { recursive: true, force: true });
}
console.log(failed ? 'browser-check FAILED' : 'browser-check OK');
process.exit(failed ? 1 : 0);

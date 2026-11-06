/* global process, console */
// Harness for the cross-device runs: a real court server (apps/server), a
// production build of the web app pointed at it (VITE_BACKEND_URL), and
// separate Playwright browser contexts, one per "device" (separate storage,
// cookies and session tokens). Screenshots land in
// ~/cringe-court-v3/screenshots/backend/<scenario>/. Not part of `npm run check`.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort, sleep } from '../playtest/lib.mjs';

export { clickText, hasText, launch, PROFILES, sleep, typeLabel, waitText, contactSheet } from '../playtest/lib.mjs';

export const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO = join(WEB_DIR, '..', '..');
export const OUT_ROOT = process.env.BACKEND_E2E_OUT ?? join(homedir(), 'cringe-court-v3', 'screenshots', 'backend');

function spawnGroup(cmd, args, opts) {
  const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const kill = (sig) => {
    try {
      process.kill(-child.pid, sig);
    } catch {
      /* gone */
    }
  };
  process.on('exit', () => kill('SIGKILL'));
  return {
    child,
    log: () => log,
    stop: async () => {
      kill('SIGTERM');
      await sleep(400);
      kill('SIGKILL');
    },
  };
}

async function waitUp(url, ms, what, log) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fetch(url).then((r) => r.ok).catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`${what} did not start:\n${log()}`);
}

/** The court server, fresh (memory store), on `port`, allowing `origin`. */
export async function startCourtServer({ port, origin, npcJurors = 'off', env = {} }) {
  const p = spawnGroup('npx', ['tsx', 'apps/server/src/main.ts'], {
    cwd: REPO,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', CC_STORE: 'memory', CC_CORS_ORIGINS: origin, CC_GJ_NPC_JURORS: npcJurors, CC_DEMO_CLOCK: 'on', CC_COUNSEL_LATENCY_MS: '600', ...env },
  });
  await waitUp(`http://127.0.0.1:${port}/api/v1/health`, 30000, 'court server', p.log);
  return { url: `http://127.0.0.1:${port}`, ...p };
}

/** Build the web app pointed at the court server, into a temp dir (skip with BACKEND_E2E_DIST). */
export async function buildWeb(serverUrl) {
  if (process.env.BACKEND_E2E_DIST && existsSync(join(process.env.BACKEND_E2E_DIST, 'index.html'))) return process.env.BACKEND_E2E_DIST;
  const out = join(tmpdir(), `cc-web-backend-${Date.now()}`);
  const b = spawnGroup('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { cwd: WEB_DIR, env: { ...process.env, VITE_BACKEND_URL: serverUrl } });
  const code = await new Promise((r) => b.child.on('exit', r));
  if (code !== 0) throw new Error(`web build failed:\n${b.log().slice(-4000)}`);
  return out;
}

export async function startPreview(dist, port) {
  const p = spawnGroup('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--outDir', dist], { cwd: WEB_DIR, env: process.env });
  const base = `http://127.0.0.1:${port}`;
  await waitUp(base + '/', 30000, 'preview', p.log);
  return { base, ...p };
}

export { freePort };

/** Numbered screenshots and a step log per scenario. */
export class Shots {
  constructor(scenario) {
    this.dir = join(OUT_ROOT, scenario);
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.n = 0;
    this.t0 = Date.now();
    this.log = join(this.dir, 'steps.log');
    this.issues = [];
    writeFileSync(this.log, '');
  }
  step(text) {
    const line = `${((Date.now() - this.t0) / 1000).toFixed(1).padStart(6)}s  ${text}`;
    appendFileSync(this.log, line + '\n');
    console.log(`  ${line}`);
  }
  async shot(page, name, { fullPage = true } = {}) {
    this.n += 1;
    const file = join(this.dir, `${String(this.n).padStart(2, '0')}-${name}.png`);
    if (fullPage) await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.screenshot({ path: file, fullPage });
    this.step(`shot ${file.split('/').pop()}`);
    return file;
  }
  watch(page, who) {
    page.on('pageerror', (e) => this.issues.push(`${who} pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') this.issues.push(`${who} console.error: ${m.text()}`);
    });
  }
  finish(extra = {}) {
    writeFileSync(join(this.dir, 'issues.txt'), this.issues.join('\n') + '\n');
    writeFileSync(join(this.dir, 'result.json'), JSON.stringify({ seconds: (Date.now() - this.t0) / 1000, issues: this.issues.length, ...extra }, null, 2));
  }
}

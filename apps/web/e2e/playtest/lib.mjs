/* global process, console, URL, window, document, location, performance, fetch, setTimeout, setInterval */
// Shared harness for the playtest scenarios: browser launch, a production
// preview server, screenshots, frame sequences, contact sheets, timings and
// console/network capture. Nothing here is part of `npm run check`.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright-core';

export const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_ROOT = process.env.PLAYTEST_OUT ?? join(homedir(), 'cringe-court-v3', 'screenshots', 'playtest');
export const TIMINGS_CSV = join(OUT_ROOT, 'timings.csv');
export const ISSUES_LOG = join(OUT_ROOT, 'console-and-network.log');

const CHROME_CANDIDATES = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
export const chromePath = () => CHROME_CANDIDATES.find((p) => p && existsSync(p));

/** Viewport profiles the brief asks for. */
export const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  mobile: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Timings use the monotonic clock: on the playtest box the wall clock was seen
 * to jump forward by about 56 minutes mid-run. A heartbeat also measures real
 * event-loop freezes (the box is shared) so they can be excluded and flagged,
 * and wall-clock jumps are logged because the app's demo deadlines read Date.now.
 */
const mono = () => performance.now();
let lastWall = Date.now();
const HEARTBEAT_MS = 250;
const STALL_MS = 3000;
let stalledTotal = 0;
let lastBeat = mono();
export const clockJumps = [];
const beat = setInterval(() => {
  const now = mono();
  const wall = Date.now();
  const gap = now - lastBeat - HEARTBEAT_MS;
  if (gap > STALL_MS) {
    stalledTotal += gap;
    console.log(`  [env] host stall of ${Math.round(gap / 1000)} s detected (excluded from timings)`);
  }
  const skew = wall - lastWall - (now - lastBeat);
  if (Math.abs(skew) > STALL_MS) {
    clockJumps.push({ at: new Date(wall).toISOString(), skewMs: Math.round(skew) });
    console.log(`  [env] wall clock jumped ${Math.round(skew / 1000)} s (monotonic timings unaffected)`);
  }
  lastBeat = now;
  lastWall = wall;
}, HEARTBEAT_MS);
beat.unref();
/** Milliseconds the host has been frozen since the process started. */
export const stalled = () => stalledTotal;
/** A wall-clock stopwatch that excludes host stalls. */
export function stopwatch() {
  const t = mono();
  const s = stalledTotal;
  return () => {
    const raw = mono() - t;
    const lost = stalledTotal - s;
    return { ms: raw - lost, lost };
  };
}

export async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Serve the existing production build (apps/web/dist) with `vite preview`. */
export async function startPreview() {
  if (process.env.PLAYTEST_BASE) return { base: process.env.PLAYTEST_BASE, stop: async () => {} };
  if (!existsSync(join(WEB_DIR, 'dist', 'index.html'))) throw new Error('apps/web/dist missing: run `npm run build -w @cringe-court/web` first');
  const port = await freePort();
  const child = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: WEB_DIR, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try {
      const res = await fetch(base + '/');
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  const stop = async () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    await sleep(300);
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  };
  process.on('exit', () => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  });
  if (!(await fetch(base + '/').then((r) => r.ok).catch(() => false))) {
    await stop();
    throw new Error('preview did not start:\n' + log);
  }
  return { base, stop };
}

/** Headless Chrome; `webgl: false` disables WebGL so roam falls back to the classic stage. */
export async function launch({ webgl = true } = {}) {
  const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
  if (webgl) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
  else args.push('--disable-webgl', '--disable-webgl2', '--disable-3d-apis');
  return chromium.launch({ executablePath: chromePath(), headless: true, args });
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * One recorded run of a scenario. Each step gets a numbered screenshot and a
 * timings row (ms since the previous step and the step's own duration).
 */
export class Recorder {
  constructor(scenario, variant) {
    this.scenario = scenario;
    this.variant = variant;
    this.dir = join(OUT_ROOT, scenario, variant);
    // Each run replaces the previous screenshots of this variant (timings.csv keeps every run).
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.n = 0;
    this.t0 = stopwatch();
    this.last = stopwatch();
    this.issues = [];
    if (!existsSync(TIMINGS_CSV)) {
      mkdirSync(OUT_ROOT, { recursive: true });
      writeFileSync(TIMINGS_CSV, 'run_at,scenario,variant,step,metric,ms,note\n');
    }
    this.runAt = new Date().toISOString();
  }

  /** Record a metric row without a screenshot. */
  time(step, metric, ms, note = '') {
    if (typeof ms === 'object') {
      if (ms.lost) note = `${note} [host stall ${Math.round(ms.lost / 1000)}s excluded]`.trim();
      ms = ms.ms;
    }
    appendFileSync(TIMINGS_CSV, [this.runAt, this.scenario, this.variant, step, metric, Math.round(ms), note].map(csvCell).join(',') + '\n');
    console.log(`  [${this.scenario}/${this.variant}] ${step} ${metric}=${Math.round(ms)}ms ${note}`);
  }

  /** Attach console, page-error and failed-request capture to a page. */
  watch(page, who = 'page') {
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') this.issue(`${who} console.${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => this.issue(`${who} pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
      const f = r.failure()?.errorText ?? '';
      // Aborted media/font loads during navigation are noise, not failures.
      if (f.includes('ERR_ABORTED')) return;
      this.issue(`${who} requestfailed: ${r.method()} ${r.url()} ${f}`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400) this.issue(`${who} http ${r.status()}: ${r.url()}`);
    });
  }

  issue(text) {
    this.issues.push(text);
    appendFileSync(ISSUES_LOG, `${this.runAt} [${this.scenario}/${this.variant}] ${text}\n`);
  }

  /** Numbered screenshot NN-name.png; records time since the previous step. */
  async shot(page, name, { fullPage = false, el } = {}) {
    this.n += 1;
    const file = join(this.dir, `${String(this.n).padStart(2, '0')}-${name}.png`);
    this.time(name, 'since_prev_step', this.last());
    this.last = stopwatch();
    if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
    if (el) await el.screenshot({ path: file });
    else await page.screenshot({ path: file, fullPage });
    return file;
  }

  /**
   * Measure how long `fn` takes (e.g. click → next screen interactive) and log it.
   */
  async measure(step, metric, fn, note = '') {
    const sw = stopwatch();
    const r = await fn();
    this.time(step, metric, sw(), note);
    return r;
  }

  /** 8-12 frames at `interval` ms, then a contact sheet of them. */
  async frames(page, name, { count = 10, interval = 250, el, between } = {}) {
    const dir = join(this.dir, `frames-${name}`);
    mkdirSync(dir, { recursive: true });
    const files = [];
    const sw = stopwatch();
    for (let i = 0; i < count; i++) {
      const f = join(dir, `${String(i + 1).padStart(2, '0')}.png`);
      if (el) await el.screenshot({ path: f });
      else await page.screenshot({ path: f });
      files.push(f);
      if (between) await between(i);
      await sleep(interval);
    }
    this.time(name, 'frame_sequence', sw(), `${count} frames @${interval}ms`);
    await contactSheet(page.context().browser(), files, join(this.dir, `sheet-${name}.png`), name);
    return files;
  }

  summary() {
    for (const j of clockJumps.splice(0)) this.issue(`ENV wall-clock jump of ${j.skewMs} ms at ${j.at}`);
    const total = this.t0();
    this.time('TOTAL', 'scenario_wall_clock', total, `${this.issues.length} console/network issues`);
    writeFileSync(join(this.dir, 'issues.txt'), this.issues.join('\n') + '\n');
    return { total: total.ms, issues: this.issues };
  }
}

/** Contact sheet rendered by the browser itself (no ImageMagick dependency). */
export async function contactSheet(browser, files, out, title = '') {
  const imgs = files.map((f, i) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${i + 1}</figcaption></figure>`).join('');
  const html = `<!doctype html><body style="margin:0;background:#222;color:#eee;font:14px sans-serif"><h1 style="font-size:16px;margin:8px">${title}</h1><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px">${imgs}</div><style>img{width:100%;display:block}figure{margin:0}figcaption{padding:2px}</style></body>`;
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 400 } });
  const p = await ctx.newPage();
  await p.setContent(html);
  await p.screenshot({ path: out, fullPage: true });
  await ctx.close();
}

/** Click a button or link by accessible name (regex string), scrolling it into view. */
export async function press(page, name, { timeout = 20000, exact = false } = {}) {
  const re = exact ? name : new RegExp(name, 'i');
  const loc = page.getByRole('button', { name: re }).or(page.getByRole('link', { name: re })).first();
  await loc.waitFor({ state: 'visible', timeout });
  await loc.scrollIntoViewIfNeeded();
  await loc.click();
  return loc;
}

/** Visible buttons/links/headings: for exploration and for failure reports. */
export async function outline(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const pick = (sel) => [...document.querySelectorAll(sel)].filter(vis).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70));
    return { url: location.pathname + location.search, h: pick('h1,h2,h3'), buttons: pick('button,[role=button]'), links: pick('a[href]').slice(0, 40), inputs: [...document.querySelectorAll('input,textarea,select')].filter(vis).map((e) => `${e.tagName.toLowerCase()}[${e.type || ''}] ${e.name || e.id || ''} ${e.getAttribute('aria-label') || e.labels?.[0]?.textContent?.trim() || ''}`) };
  });
}

/** Run a scenario variant with a fresh context; screenshot on failure. */
export async function runVariant(browser, rec, profileName, body, ctxExtra = {}) {
  const ctx = await browser.newContext({ ...PROFILES[profileName], ...ctxExtra });
  ctx.setDefaultTimeout(120000);
  const page = await ctx.newPage();
  rec.watch(page);
  let ok = true;
  try {
    await body(page, ctx);
  } catch (e) {
    ok = false;
    rec.issue(`SCENARIO FAILURE: ${e.message.split('\n')[0]}`);
    console.error(`  FAIL ${rec.scenario}/${rec.variant}:`, e.message.split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: join(rec.dir, 'FAIL.png'), fullPage: true }).catch(() => {});
    writeFileSync(join(rec.dir, 'FAIL-outline.json'), JSON.stringify(await outline(page).catch(() => ({})), null, 2));
  }
  const s = rec.summary();
  await ctx.close();
  return { ok, ...s };
}

export const baseFrom = (url) => new URL(url).origin;

/** Click the last visible, enabled element whose text contains `text` (like a person scanning the page). */
export async function clickText(page, text, sel = 'button, a, label', timeout = 20000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const ok = await page.evaluate(
      ([text, sel]) => {
        const els = [...document.querySelectorAll(sel)].filter((e) => e.textContent.replace(/\s+/g, ' ').trim().includes(text) && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && e.offsetParent !== null);
        const el = els[els.length - 1];
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.click();
          return true;
        }
        return false;
      },
      [text, sel],
    );
    if (ok) return;
    await sleep(250);
  }
  throw new Error(`No clickable "${text}" on ${page.url()}`);
}

/** Type into the field whose <label> starts with `label`. */
export async function typeLabel(page, label, value, timeout = 20000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const id = await page.evaluate((label) => {
      const l = [...document.querySelectorAll('label')].filter((x) => x.offsetParent !== null).find((x) => x.textContent.trim().startsWith(label));
      return l?.getAttribute('for') ?? null;
    }, label);
    if (id) {
      await page.locator(`[id="${id}"]`).fill(value);
      return;
    }
    await sleep(250);
  }
  throw new Error(`No field "${label}" on ${page.url()}`);
}

export async function waitText(page, text, timeout = 20000) {
  await page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), text, { timeout });
}

export async function hasText(page, text) {
  return page.evaluate((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), text);
}

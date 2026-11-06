/* global process, console, document */
// Scenario 4 — first-person roam: walk the lobby and courtroom with the
// keyboard, interact with exhibits and NPCs, trigger every beat, the pause
// menu, the menu-view fallback, the control legend on a narrow window, the
// touch joystick on a phone viewport, and the no-WebGL fallback.
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { PROFILES, Recorder, clickText, launch, sleep, startPreview, stopwatch } from './lib.mjs';

/** Fraction of pixels that changed between two PNG files (cheap "did the view move?" check). */
function changed(a, b) {
  const x = PNG.sync.read(readFileSync(a));
  const y = PNG.sync.read(readFileSync(b));
  if (x.width !== y.width || x.height !== y.height) return 1;
  let n = 0;
  for (let i = 0; i < x.data.length; i += 16) if (Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2]) > 24) n++;
  return n / (x.data.length / 16);
}

const zone = (p) => p.evaluate(() => document.querySelector('.ccr-zone')?.textContent?.trim() ?? '');
const hud = (p) =>
  p.evaluate(() => ({
    zone: document.querySelector('.ccr-zone')?.textContent?.trim() ?? '',
    prompt: document.querySelector('.ccr-prompt')?.textContent?.trim() ?? '',
    dialogue: document.querySelector('.ccr-dialogue')?.textContent?.trim().slice(0, 80) ?? '',
    legend: Boolean(document.querySelector('.ccr-legend')),
    capture: Boolean(document.querySelector('.ccr-capture-title, .ccr-onboard')),
  }));

async function openWalk(p, rec) {
  const t = stopwatch();
  await p.goto(rec.base + '/court/walk', { waitUntil: 'networkidle' });
  const ok = await p.locator('canvas').first().waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
  rec.time('walk', 'time_to_canvas', t(), String(ok));
  await sleep(2500);
  return ok;
}

/** Close dialogue/exhibit cards and leave the pause menu, like a player getting back to walking. */
async function settle(p) {
  for (let i = 0; i < 6 && (await hud(p)).dialogue; i++) {
    await p.keyboard.press('e');
    await sleep(500);
  }
  if (await p.locator('.ccr-exhibit').isVisible().catch(() => false)) {
    await p.keyboard.press('Escape');
    await sleep(400);
  }
  if (await p.locator('#ccr-pause-title').isVisible().catch(() => false)) {
    await p.locator('.ccr-modal button', { hasText: 'Resume' }).first().click();
    await sleep(400);
  }
}

async function stage(p) {
  return p.locator('section[aria-label="Courtroom"]').first();
}

/** Hold a key while capturing frames; returns the frame files. */
async function holdWhileFrames(p, rec, key, name, count = 10) {
  const el = await stage(p);
  await p.keyboard.down(key);
  const files = await rec.frames(p, name, { count, interval: 250, el });
  await p.keyboard.up(key);
  return files;
}

export async function roamDesktop(browser, rec) {
  const ctx = await browser.newContext({ ...PROFILES.desktop });
  const p = await ctx.newPage();
  rec.watch(p);
  await openWalk(p, rec);
  const el = await stage(p);
  rec.time('walk', 'hud_on_load', 0, JSON.stringify(await hud(p)));
  await rec.shot(p, 'walk-loaded');
  await clickText(p, 'Use keyboard only', 'button');
  await sleep(800);
  await rec.shot(p, 'keyboard-mode', { el });

  // Lobby: walk forward.
  await clickText(p, 'Lobby', 'button');
  await sleep(1200);
  const z0 = await zone(p);
  const fwd = await holdWhileFrames(p, rec, 'w', 'walk-lobby-forward');
  const moved = changed(fwd[0], fwd.at(-1));
  rec.time('walk', 'forward_view_change', 0, `${(moved * 100).toFixed(1)}% pixels; zone ${z0} -> ${await zone(p)}`);
  // Keep walking into whatever is ahead: do we stop cleanly or get stuck?
  const into = await holdWhileFrames(p, rec, 'w', 'walk-into-wall', 8);
  rec.time('walk', 'wall_last_frames_change', 0, `${(changed(into.at(-2), into.at(-1)) * 100).toFixed(1)}% between last two frames`);
  const back = await holdWhileFrames(p, rec, 's', 'walk-back-out', 6);
  rec.time('walk', 'back_out_change', 0, `${(changed(back[0], back.at(-1)) * 100).toFixed(1)}% (0 would mean stuck)`);
  const turn = await holdWhileFrames(p, rec, 'ArrowLeft', 'turn-left', 6);
  rec.time('walk', 'turn_change', 0, `${(changed(turn[0], turn.at(-1)) * 100).toFixed(1)}%`);

  // Aisle → well → bench; interact with whatever prompt appears.
  for (const place of ['Aisle', 'Well', 'Bench', 'Jury box']) {
    await clickText(p, place, 'button');
    await sleep(1200);
    await p.keyboard.down('w');
    await sleep(500);
    await p.keyboard.up('w');
    await sleep(400);
    const h = await hud(p);
    rec.time('place', place, 0, JSON.stringify(h));
    await rec.shot(p, `place-${place.replace(/\s+/g, '-').toLowerCase()}`, { el });
    if (h.prompt) {
      await p.keyboard.press('e');
      await sleep(1200);
      await rec.shot(p, `interact-${place.replace(/\s+/g, '-').toLowerCase()}`, { el });
      rec.time('interact', place, 0, JSON.stringify(await hud(p)));
      await settle(p);
    }
  }
  // Seek an exhibit: sweep the well, turning, until a prompt shows up.
  await clickText(p, 'Well', 'button');
  await sleep(1000);
  let found = '';
  for (let i = 0; i < 16 && !found; i++) {
    await p.keyboard.down(i % 4 === 3 ? 'ArrowLeft' : 'w');
    await sleep(350);
    await p.keyboard.up(i % 4 === 3 ? 'ArrowLeft' : 'w');
    found = (await hud(p)).prompt;
  }
  rec.time('interact', 'sweep_prompt', 0, found || 'none found');
  if (found) {
    await rec.shot(p, 'sweep-prompt', { el });
    await p.keyboard.press('e');
    await sleep(1200);
    await rec.shot(p, 'sweep-interact', { el });
    await settle(p);
  }
  await settle(p);

  // Every beat, with a frame sequence for each.
  const beats = await p.$$eval('aside[aria-label="Sandbox controls"] button[aria-pressed]', (bs) => bs.map((b) => b.textContent.trim()));
  for (const b of beats) {
    const short = b.replace(/^\d+\.\s*/, '').replace(/\W+/g, '-').toLowerCase();
    await p.getByRole('button', { name: b, exact: true }).click();
    const t = stopwatch();
    await sleep(300);
    rec.time('beat', short, 0, JSON.stringify(await hud(p)));
    await rec.frames(p, `beat-${short}`, { count: 10, interval: 250, el });
    // How long does the beat run on its own? (cap 40 s)
    while (t().ms < 60000 && (await p.getByRole('button', { name: b, exact: true }).getAttribute('aria-pressed')) === 'true') await sleep(250);
    rec.time('beat', short, t(), 'beat duration incl. frame capture, no input (cap 60 s)');
    await rec.shot(p, `beat-${short}-end`, { el });
    await settle(p);
  }

  // Pause menu.
  await p.keyboard.press('Escape');
  await sleep(700);
  await rec.shot(p, 'pause-menu', { el });
  rec.time('pause', 'pause_menu_open', 0, String(await p.locator('#ccr-pause-title').isVisible().catch(() => false)));
  await p.keyboard.press('Escape');
  await sleep(500);
  // Menu view fallback.
  await clickText(p, 'Skip to menu view', 'button');
  await sleep(1000);
  await rec.shot(p, 'menu-view', { fullPage: true });
  await ctx.close();
}

/** Narrow, non-touch window: does the control legend open over the room? */
export async function roamNarrow(browser, rec) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 800 } });
  const p = await ctx.newPage();
  rec.watch(p);
  await openWalk(p, rec);
  rec.time('narrow', 'hud_on_load', 0, JSON.stringify(await hud(p)));
  await rec.shot(p, 'narrow-760-on-load');
  await ctx.close();
}

/** Phone: the touch joystick via real touch events (CDP). */
export async function roamMobile(browser, rec) {
  const ctx = await browser.newContext({ ...PROFILES.mobile });
  const p = await ctx.newPage();
  rec.watch(p);
  await openWalk(p, rec);
  rec.time('mobile', 'hud_on_load', 0, JSON.stringify(await hud(p)));
  await rec.shot(p, 'mobile-loaded');
  const zoneBox = await p.locator('.ccr-stick-zone').first().boundingBox().catch(() => null);
  rec.time('mobile', 'joystick_zone', 0, JSON.stringify(zoneBox));
  if (zoneBox) {
    const cdp = await ctx.newCDPSession(p);
    const x = zoneBox.x + zoneBox.width * 0.4;
    const y = zoneBox.y + zoneBox.height * 0.6;
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ x, y }]);
    const files = [];
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', [{ x, y: y - Math.min(60, i * 8) }]);
      files.push(await rec.shot(p, `joystick-drag-${i}`));
      await sleep(150);
    }
    await touch('touchEnd', []);
    rec.time('mobile', 'joystick_view_change', 0, `${(changed(files[0], files.at(-1)) * 100).toFixed(1)}%`);
    // Drag on the look zone.
    await touch('touchStart', [{ x: 300, y: 300 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 300 - i * 15, y: 300 }]);
    await touch('touchEnd', []);
    await sleep(500);
    await rec.shot(p, 'look-drag');
  }
  await p.getByRole('button', { name: /^Interact/ }).first().click().catch(() => {});
  await sleep(600);
  await rec.shot(p, 'mobile-interact');
  await ctx.close();
}

export async function roamNoWebgl(browser, rec) {
  const ctx = await browser.newContext({ ...PROFILES.desktop });
  const p = await ctx.newPage();
  rec.watch(p);
  await p.goto(rec.base + '/court/walk', { waitUntil: 'networkidle' });
  await sleep(3000);
  await rec.shot(p, 'walk-without-webgl', { fullPage: true });
  rec.time('nowebgl', 'page_text', 0, (await p.locator('section[aria-label="Courtroom"]').innerText().catch(() => '')).slice(0, 160));
  await ctx.close();
}

export const ROAM_VARIANTS = [
  { variant: 'desktop', run: roamDesktop },
  { variant: 'narrow-760', run: roamNarrow },
  { variant: 'mobile-touch', run: roamMobile },
  { variant: 'no-webgl', run: roamNoWebgl, webgl: false },
];

export async function runRoam(srv, only) {
  const out = [];
  for (const v of ROAM_VARIANTS.filter((x) => !only || only.includes(x.variant))) {
    const browser = await launch({ webgl: v.webgl !== false });
    const rec = new Recorder('roam', v.variant);
    rec.base = srv.base;
    let ok = true;
    try {
      await v.run(browser, rec);
    } catch (e) {
      ok = false;
      rec.issue(`SCENARIO FAILURE: ${e.message.split('\n')[0]}`);
      console.error(`  FAIL roam/${v.variant}:`, e.message.split('\n')[0]);
    }
    const s = rec.summary();
    await browser.close();
    out.push({ variant: v.variant, ok, total: s.total, issues: s.issues.length });
    console.log('roam', JSON.stringify(out.at(-1)));
  }
  return out;
}

if (process.argv[1]?.endsWith('roam.mjs')) {
  const srv = await startPreview();
  try {
    await runRoam(srv, process.argv.slice(2).length ? process.argv.slice(2) : null);
  } finally {
    await srv.stop();
  }
}

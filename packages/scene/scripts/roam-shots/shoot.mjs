// Scripted first-person screenshots of /court/walk. Start the dev server first (BASE, default http://127.0.0.1:5191),
// then: PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs node packages/scene/scripts/roam-shots/shoot.mjs [shot,shot]
/* global window, console, process, requestAnimationFrame */
// Scripted first-person screenshots of /court/walk (headless Chrome, SwiftShader GL).
// Not a dependency: point PLAYWRIGHT_CORE at any playwright-core install, CHROME at a Chrome binary.
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
import fs from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5191';
const OUT = process.env.OUT ?? 'roam-shots';
const only = process.argv[2] ? process.argv[2].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const log = [];
async function page(viewport, query = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...(viewport.width < 500 ? { hasTouch: true, isMobile: true } : {}) });
  const p = await ctx.newPage();
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && log.push(`[${m.type()}] ${m.text()}`));
  p.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
  await p.goto(`${BASE}/court/walk?debug${query}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__roam?.controller, null, { timeout: 90000 });
  await p.waitForTimeout(2500);
  return { p, ctx };
}
const stage = (p) => p.locator('section[aria-label="Courtroom"]');
async function settle(p, ms = 900) { await p.waitForTimeout(ms); }
const shots = {
  async lobby(p) { await p.evaluate(() => { const c = window.__roam.controller; c.teleport({ pos: [0, 0, 138], yaw: 0, pitch: 0.02 }); }); },
  async aisle(p) { await p.evaluate(() => { const c = window.__roam.controller; c.teleport({ pos: [0, 0, 50], yaw: 0, pitch: 0.06 }); }); },
  async defendant(p) { await p.evaluate(() => window.__roam.controller.sit('defendant')); },
  async opening(p) { await p.evaluate(() => { window.__roam.controller.runBeat('opening'); }); await settle(p, 1800); },
  async witness(p) { await p.evaluate(() => window.__roam.controller.sit('witness')); },
  async jury(p) { await p.evaluate(() => window.__roam.controller.teleport('jury-view')); },
  async exhibit(p) { await p.evaluate(() => { const c = window.__roam.controller; c.teleport({ pos: [0, 0, 22], yaw: 0, pitch: -0.5 }); }); },
  async verdict(p) {
    await p.evaluate(() => { window.__roam.controller.runBeat('verdict', { verdict: 'guilty' }); });
    for (let i = 0; i < 60; i++) {
      const has = await p.evaluate(() => { const c = window.__roam.controller; const s = c.snapshot(); if (!s.callout) { c.advanceDialogue(); c.advanceDialogue(); } return !!s.callout; });
      if (has) break;
      await p.waitForTimeout(250);
    }
    await settle(p, 900);
  },
  async 'verdict-jury'(p) {
    await p.evaluate(() => { const c = window.__roam.controller; c.runBeat('verdict', { verdict: 'not-cooked' }); });
    for (let i = 0; i < 80; i++) {
      const done = await p.evaluate(() => { const c = window.__roam.controller; if (c.control !== 'look') { c.advanceDialogue(); c.advanceDialogue(); } return c.control === 'look'; });
      if (done) break;
      await p.waitForTimeout(250);
    }
    await p.evaluate(() => { const c = window.__roam.controller; const v = c.view(); const j = c.world.marks.jury; const yaw = Math.atan2(-(j[0] - v.eye[0]), -(j[2] - v.eye[2])); const pitch = Math.atan2(j[1] - v.eye[1], Math.hypot(j[0] - v.eye[0], j[2] - v.eye[2])); c.look(Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw)), pitch - v.pitch); });
    await settle(p, 1200);
  },
  async walk(p) {
    // In-page autopilot driving the real keyboard path (W held, steering every frame); node samples 12 frames.
    await p.evaluate(() => {
      const c = window.__roam.controller; c.setMood('house'); c.teleport('lobby');
      const wps = [[0, 112], [0, 70], [0, 30], [0, 9], [30, 7], [50, 9]];
      let i = 0; window.__walkDone = false; window.__walkHold = false;
      const tick = () => {
        if (i >= wps.length) { c.keyUp('KeyW'); c.sit('defendant'); window.__walkDone = true; return; }
        if (window.__walkHold) { c.keyUp('KeyW'); requestAnimationFrame(tick); return; }
        const v = c.view(); const [x, z] = wps[i];
        const yaw = Math.atan2(-(x - v.eye[0]), -(z - v.eye[2]));
        c.look(Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw)) * 0.25, (0.03 - v.pitch) * 0.2);
        c.keyDown('KeyW');
        if (Math.hypot(x - v.eye[0], z - v.eye[2]) < 5) i++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const frames = [];
    for (let k = 0; k < 11; k++) {
      await p.evaluate(() => (window.__walkHold = true));
      await p.waitForTimeout(120);
      const f = `${OUT}/walk-${String(k).padStart(2, '0')}.png`;
      await stage(p).screenshot({ path: f }); frames.push(f);
      if (await p.evaluate(() => window.__walkDone)) break;
      await p.evaluate(() => (window.__walkHold = false));
      await p.waitForTimeout(420);
    }
    await p.evaluate(() => (window.__walkHold = false));
    await p.waitForFunction(() => window.__walkDone, null, { timeout: 60000 });
    await settle(p, 900);
    const f = `${OUT}/walk-${String(frames.length).padStart(2, '0')}.png`; await stage(p).screenshot({ path: f }); frames.push(f);
    fs.writeFileSync(`${OUT}/walk-frames.json`, JSON.stringify(frames));
  },
};
const { p, ctx } = await page({ width: 1280, height: 800 }, '&auto=0&quality=high');
// Dismiss the capture card with the keyboard-only path.
await p.getByRole('button', { name: 'Use keyboard only' }).click().catch(() => {});
await p.getByRole('button', { name: 'Hide controls' }).first().click().catch(() => {});
for (const [name, fn] of Object.entries(shots)) {
  if (only && !only.includes(name)) continue;
  await p.evaluate(() => { const c = window.__roam.controller; c.skipBeat(); c.closeExhibit(); c.clearDialogue(); c.setMood('house'); c.teleport('lobby'); });
  await fn(p);
  await settle(p);
  if (name !== 'walk') await stage(p).screenshot({ path: `${OUT}/roam-${name}.png` });
  console.log('shot', name, await p.evaluate(() => { const r = window.__roam.renderer; const c = window.__roam.controller; return JSON.stringify({ q: r?.preset.level, cam: r?.camera.position.toArray().map((v) => +v.toFixed(1)), view: c.view().eye.map((v) => +v.toFixed(1)) }); }));
}
await ctx.close();
if (!only || only.includes('mobile')) {
  const m = await page({ width: 390, height: 844 }, '&touch=1');
  await m.p.evaluate(() => window.__roam.controller.teleport({ pos: [0, 0, 40], yaw: 0, pitch: 0.05 }));
  await stage(m.p).scrollIntoViewIfNeeded();
  await m.p.evaluate(() => window.scrollBy(0, 120));
  await settle(m.p, 1200);
  await m.p.screenshot({ path: `${OUT}/roam-mobile.png`, fullPage: false });
  await stage(m.p).screenshot({ path: `${OUT}/roam-mobile-stage.png` });
  console.log('shot mobile');
  await m.ctx.close();
}
await browser.close();
console.log(log.slice(0, 30).join('\n'));

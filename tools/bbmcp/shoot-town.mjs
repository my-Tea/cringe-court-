// Scripted screenshots of /town: one per location, plus a couple of interaction
// states. Written for headless Chrome + SwiftShader, so it runs on a machine
// with no GPU.
//
//   node tools/bbmcp/shoot-town.mjs                 all locations
//   node tools/bbmcp/shoot-town.mjs square tavern   just those
//
// Env: BASE (default http://localhost:5173), OUT (default .bbshots/town-app),
//      CHROME (default /etc/profiles/per-user/$USER/bin/google-chrome)
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? '.bbshots/town-app';
const CHROME = process.env.CHROME ?? '/etc/profiles/per-user/' + (process.env.USER ?? 'user') + '/bin/google-chrome';

const MAPS = [
  ['square', 'from-square'],
  ['market', 'from-square'],
  ['streets', 'from-square'],
  ['tavern', 'from-square'],
  ['archive', 'from-square'],
  ['courthouse', 'entrance'],
];

const only = process.argv.slice(2);
const wanted = only.length ? MAPS.filter(([id]) => only.includes(id)) : MAPS;

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

const errors = [];
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 760, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(`${BASE}/town?debug`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

// Wait for the controller to exist; the page sets window.__town only once the
// libraries have loaded and the controller is built.
await page.waitForFunction(() => window.__town?.controller, { timeout: 90_000 });
// The renderer is attached by the component's onRenderer callback.
await page.waitForFunction(() => window.__town?.renderer, { timeout: 60_000 });
await new Promise((r) => setTimeout(r, 2000));

for (const [id, spawn] of wanted) {
  await page.evaluate(
    (map, sp) => {
      window.__town.controller.teleport(map, sp);
    },
    id,
    spawn,
  );
  // Let the camera snap and the renderer rebuild for the new map.
  await page.waitForFunction((m) => window.__town?.renderer?.stats?.map === m && window.__town.renderer.stats.boxes > 0, { timeout: 20_000 }, id);
  await new Promise((r) => setTimeout(r, 1100));

  const stats = await page.evaluate(() => {
    const t = window.__town;
    const s = t.controller.snapshot();
    const r = t.renderer;
    return {
      map: s.map,
      mapName: s.mapName,
      pos: s.pos.map((n) => Math.round(n)),
      npcs: r?.stats?.npcs ?? null,
      drawCalls: r?.stats?.drawCalls ?? null,
      boxes: r?.stats?.boxes ?? null,
    };
  });

  const file = path.join(OUT, `${id}.png`);
  await page.screenshot({ path: file });
  console.log(
    `${id.padEnd(11)} ${String(stats.boxes ?? '?').padStart(5)} boxes ${String(stats.drawCalls ?? '?').padStart(3)} batches` +
      ` ${String(stats.npcs ?? '?').padStart(2)} npcs → ${file}`,
  );
}

// One interaction shot: focus prompt on the square.
await page.evaluate(() => window.__town.controller.teleport('square', 'from-square'));
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: path.join(OUT, '_hud.png') });
console.log(`hud → ${path.join(OUT, '_hud.png')}`);

await browser.close();

if (errors.length) {
  console.error('\nPage errors:');
  for (const e of errors) console.error(`  ${e}`);
  process.exitCode = 1;
} else {
  console.log('\nNo console or page errors.');
}

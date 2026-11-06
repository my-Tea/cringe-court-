/* global process, console */
// `npm run e2e:backend` (repo root): start a court server, build the web app
// against it, and play Versus on three devices and Grand Jury on seven.
// Usage: node apps/web/e2e/backend/run.mjs [versus] [grand-jury] [offline]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWeb, freePort, launch, OUT_ROOT, Shots, startCourtServer, startPreview } from './lib.mjs';
import { playVersusAcrossDevices } from './versus.mjs';
import { playGrandJuryAcrossDevices } from './grand-jury.mjs';
import { playServerDown } from './offline.mjs';

const only = process.argv.slice(2);
const want = (s) => only.length === 0 || only.includes(s);

const serverPort = Number(process.env.BACKEND_E2E_SERVER_PORT ?? (await freePort()));
const webPort = Number(process.env.BACKEND_E2E_WEB_PORT ?? (await freePort()));
const origin = `http://127.0.0.1:${webPort}`;
let server = await startCourtServer({ port: serverPort, origin });
console.log(`court server ${server.url}`);
const dist = await buildWeb(server.url);
const web = await startPreview(dist, webPort);
console.log(`web ${web.base} (dist ${dist})`);
const browser = await launch({ webgl: process.env.BACKEND_E2E_WEBGL === '1' });
const results = {};

async function scenario(name, fn) {
  const shots = new Shots(name);
  try {
    const r = await fn(shots);
    results[name] = { ok: true, ...r };
    shots.finish({ ok: true, ...r });
  } catch (e) {
    results[name] = { ok: false, error: e.message.split('\n')[0] };
    console.error(`FAIL ${name}: ${e.stack}`);
    for (const c of browser.contexts()) for (const [i, p] of c.pages().entries()) await p.screenshot({ path: join(shots.dir, `FAIL-${browser.contexts().indexOf(c)}-${i}.png`), fullPage: true }).catch(() => {});
    shots.finish({ ok: false, error: e.message });
  }
  for (const c of browser.contexts()) await c.close().catch(() => {});
}

try {
  if (want('versus')) await scenario('versus', (shots) => playVersusAcrossDevices(browser, web.base, shots));
  if (want('grand-jury')) await scenario('grand-jury', (shots) => playGrandJuryAcrossDevices(browser, web.base, shots));
  if (want('offline'))
    await scenario('offline', (shots) =>
      playServerDown(browser, web.base, shots, {
        stop: () => server.stop(),
        start: async () => {
          server = await startCourtServer({ port: serverPort, origin });
        },
      }),
    );
} finally {
  await browser.close();
  await web.stop();
  await server.stop();
  writeFileSync(join(OUT_ROOT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
process.exit(Object.values(results).every((r) => r.ok) ? 0 : 1);

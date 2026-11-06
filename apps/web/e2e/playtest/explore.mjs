/* global process, console */
// Exploration helper: `node explore.mjs <path> [action ...]` prints the visible
// outline after each action. Actions: click:<name>, fill:<label>=<value>, wait:<ms>, shot:<file>, goto:<path>.
import { launch, outline, press, startPreview, sleep } from './lib.mjs';

const [path, ...actions] = process.argv.slice(2);
const srv = await startPreview();
const browser = await launch({ webgl: process.env.NOGL ? false : true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await page.goto(srv.base + path, { waitUntil: 'networkidle' });
  console.log(JSON.stringify(await outline(page)));
  for (const a of actions) {
    const [k, ...rest] = a.split(':');
    const v = rest.join(':');
    if (k === 'click') await press(page, v);
    else if (k === 'fill') { const [l, val] = v.split('='); await page.getByLabel(new RegExp(l, 'i')).first().fill(val); }
    else if (k === 'wait') await sleep(Number(v));
    else if (k === 'shot') await page.screenshot({ path: v, fullPage: true });
    else if (k === 'goto') await page.goto(srv.base + v, { waitUntil: 'networkidle' });
    else if (k === 'text') console.log((await page.locator('main').innerText()).slice(0, 3000));
    await sleep(600);
    console.log(`-- after ${a}:`, JSON.stringify(await outline(page)));
  }
} finally {
  await browser.close();
  await srv.stop();
}

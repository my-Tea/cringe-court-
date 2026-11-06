// node sweep.mjs <base> <outdir> [routes...]  — every route × 3 viewports: axe, overflow, tab order, screenshot.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch, watch, axe, focused, overflow, sleep } from './lib.mjs';
const [base, out, ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ROUTES = only.length ? only : ['/', '/court', '/how-to-play', '/leaderboard', '/settings', '/solo', '/solo/file', '/solo/docket', '/versus', '/versus/new', '/versus/join', '/versus/cases', '/grand-jury', '/grand-jury/docket', '/grand-jury/case/107', '/grand-jury/duty', '/grand-jury/pricing', '/courtroom', '/court/walk', '/no-such-page'];
const VIEWS = process.env.VIEWS ? JSON.parse(process.env.VIEWS) : [['mobile', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 900]];
const browser = await launch();
const report = [];
for (const [vname, w, h] of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    watch(page, errors);
    await page.goto(base + route, { waitUntil: 'networkidle' }).catch((e) => errors.push('goto ' + e.message));
    await sleep(1500);
    const name = (route.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'root') + '-' + vname;
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, timeout: 60000 }).catch(() => page.screenshot({ path: `${out}/${name}.png`, timeout: 60000 }).catch((e) => errors.push('shot ' + e.message.slice(0, 80))));
    const violations = await axe(page).catch((e) => [{ id: 'axe-error', help: e.message }]);
    const ov = await overflow(page);
    const tabs = [];
    if (vname !== 'tablet') {
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const f = await focused(page);
        if (!f) { tabs.push({ name: '(body)' }); continue; }
        tabs.push(f);
      }
    }
    const noRing = tabs.filter((f) => f.tag && !f.ring && !f.shadow).map((f) => `${f.tag}:${f.name}`);
    const unnamed = tabs.filter((f) => f.tag && !f.name).map((f) => `${f.tag}@${f.x},${f.y}`);
    const hidden = tabs.filter((f) => f.tag && (f.w < 2 || f.h < 2)).map((f) => `${f.tag}:${f.name}`);
    report.push({ route, view: vname, errors, violations, overflow: ov, noRing: [...new Set(noRing)], unnamed: [...new Set(unnamed)], hidden: [...new Set(hidden)], tabOrder: tabs.slice(0, 40).map((f) => f.tag ? `${f.tag}:${f.name.slice(0, 40)}` : f.name) });
    console.log(name, 'axe', violations.length, 'overflow', !!ov, 'errors', errors.length, 'noRing', noRing.length, 'unnamed', unnamed.length);
    await page.close();
  }
  await ctx.close();
}
writeFileSync(`${out}/sweep.json`, JSON.stringify(report, null, 1));
await browser.close();

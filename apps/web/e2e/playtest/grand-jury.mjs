/* global process, console, document, innerHeight, URL */
// Scenario 3 — Mode 3 Grand Jury: docket browse/filter, summon (crowdfund),
// World ID screening (mock) → seat offer → bond, the hearing, Secret Verdict
// Scroll (commit) → reveal, permissionless settle, claims, My court. The other
// six jurors and the crowd are the demo ledger twin's simulated identities;
// a second browser context checks whether two people share one court.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { PROFILES, Recorder, clickText, hasText, launch, sleep, startPreview, stopwatch, waitText } from './lib.mjs';

const FUND_CASE = 'Should code be indented with tabs?';

async function caseLinks(page) {
  return page.$$eval('a[href*="/grand-jury/case/"]', (as) => [...new Map(as.map((a) => [a.getAttribute('href'), a.textContent.trim().replace(/\s+/g, ' ').slice(0, 80)])).entries()]);
}

export async function playGrandJury(browser, rec, profile) {
  const ctx = await browser.newContext({ ...PROFILES[profile] });
  await ctx.clock.install();
  ctx.setDefaultTimeout(90000);
  const p = await ctx.newPage();
  rec.watch(p);
  const base = rec.base;

  // Docket: browse and filter the seeded cases.
  const t0 = stopwatch();
  await p.goto(base + '/grand-jury/docket', { waitUntil: 'networkidle' });
  await waitText(p, 'The docket');
  rec.time('docket', 'time_to_interactive', t0());
  await rec.shot(p, 'docket', { fullPage: true });
  const all = await caseLinks(p);
  rec.time('docket', 'seeded_cases', 0, String(all.length));
  for (const f of ['Open to join', 'In session', 'Decided']) {
    await clickText(p, f, 'button');
    await sleep(500);
    const n = (await caseLinks(p)).length;
    rec.time('docket-filter', f, 0, `${n} links (incl. featured)`);
  }
  await rec.shot(p, 'docket-filter-decided', { fullPage: true });
  await clickText(p, 'All cases', 'button');
  await clickText(p, 'Internet Crimes', 'button');
  await sleep(500);
  await rec.shot(p, 'docket-topic-internet', { fullPage: true });
  await clickText(p, 'Internet Crimes', 'button');
  await p.getByRole('searchbox').fill('pizza');
  await sleep(600);
  rec.time('docket-search', 'pizza', 0, `${(await caseLinks(p)).length} links; url=${new URL(p.url()).search}`);
  await rec.shot(p, 'docket-search-pizza', { fullPage: true });
  await p.getByRole('searchbox').fill('zzzz-nothing');
  await sleep(600);
  await rec.shot(p, 'docket-search-empty');
  await p.getByRole('searchbox').fill('');

  // Summon: chip in to a case that is still raising its crowdfund.
  await clickText(p, 'Open to join', 'button');
  await rec.measure('summon', 'click_to_case', async () => {
    await clickText(p, FUND_CASE, 'a');
    await waitText(p, 'Summon the court');
  });
  await rec.shot(p, 'summon-case', { fullPage: true });
  const fundUrl = p.url();
  await clickText(p, '1.00');
  await clickText(p, 'Summon with');
  await rec.measure('summon', 'chip_in_confirmed', () => waitText(p, 'You have chipped in'));
  await rec.shot(p, 'summon-chipped-in', { fullPage: true });
  const raisedHere = await p.evaluate(() => document.body.innerText.match(/[\d.]+\s*(?:USDC)?\s*(?:of|\/)\s*7\.30/i)?.[0] ?? '');

  // Does a second person (another browser) see this contribution?
  const other = await browser.newContext({ ...PROFILES[profile] });
  const q = await other.newPage();
  await q.goto(fundUrl, { waitUntil: 'networkidle' });
  await sleep(1500);
  const raisedThere = await q.evaluate(() => document.body.innerText.match(/[\d.]+\s*(?:USDC)?\s*(?:of|\/)\s*7\.30/i)?.[0] ?? '');
  const sawMine = await hasText(q, 'You have chipped in');
  await rec.shot(q, 'other-browser-same-case', { fullPage: true });
  rec.time('shared-court', 'second_browser_sees_contribution', 0, `here="${raisedHere}" there="${raisedThere}" youChippedIn=${sawMine}`);
  await other.close();

  // Jury duty: find the case that is seating jurors.
  await p.goto(base + '/grand-jury/docket?show=open', { waitUntil: 'networkidle' });
  let seated = false;
  for (const [href] of await caseLinks(p)) {
    await p.goto(base + href, { waitUntil: 'networkidle' });
    await sleep(800);
    if (await hasText(p, 'Volunteer for the jury')) {
      seated = true;
      break;
    }
  }
  if (!seated) throw new Error('No case is seating jurors');
  await rec.shot(p, 'jury-seating-case', { fullPage: true });
  await clickText(p, 'Volunteer for the jury');
  await waitText(p, 'Juror Screening');
  await rec.shot(p, 'world-id-screening');
  await rec.measure('jury', 'world_id_to_offer', async () => {
    await clickText(p, 'Verify with World ID');
    await waitText(p, 'A seat is offered to you');
  });
  await rec.shot(p, 'seat-offer', { fullPage: true });
  await rec.measure('jury', 'bond_to_ballot', async () => {
    await clickText(p, 'I swear to show up');
    await waitText(p, 'Seal your ballot', 60000);
  });
  // The hearing as a juror: which seat does the first-person view put us in?
  const frame = p.locator('[data-view]').first();
  if (await frame.count()) {
    const view = await frame.getAttribute('data-view');
    await frame.scrollIntoViewIfNeeded();
    await sleep(4000);
    const seatLabel = await frame.evaluate((el) => el.innerText.split('\n').slice(0, 3).join(' | '));
    rec.time('hearing', 'juror_view', 0, `${view}; hud="${seatLabel}"`);
    await rec.shot(p, `hearing-juror-${view}`);
    await rec.frames(p, `hearing-juror-${view}`, { count: 8, interval: 250, el: frame });
  }
  const jurySeats = await p.evaluate(() => document.body.innerText.match(/(\d)\s*of\s*7/)?.[0] ?? '');
  rec.time('jury', 'seats_text', 0, jurySeats);
  await rec.shot(p, 'ballot', { fullPage: true });

  // Seal: pick the first ballot option.
  const opt = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Seal my ballot'));
    const form = btn?.closest('form, section') ?? document;
    const l = form.querySelector('label input[type=radio]')?.closest('label');
    return l?.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) ?? null;
  });
  await clickText(p, opt, 'label');
  await clickText(p, 'Seal my ballot');
  await waitText(p, 'Secret Verdict Scroll');
  await rec.shot(p, 'sealed-scroll', { fullPage: true });
  await rec.frames(p, 'sealed-scroll', { count: 8, interval: 250 });

  await clickText(p, 'Skip to the deadline', 'button');
  await rec.measure('reveal', 'skip_to_open', () => waitText(p, 'Open your scroll', 30000));
  await clickText(p, 'Open my scroll');
  await waitText(p, 'Your vote is counted');
  await rec.shot(p, 'revealed', { fullPage: true });

  await clickText(p, 'Skip to the deadline', 'button');
  await waitText(p, 'Settle the case', 30000);
  await rec.shot(p, 'settle-offered', { fullPage: true });
  // Settlement is permissionless: the simulated bailiff may get there first.
  const settledByMe = await clickText(p, 'Settle and read the verdict', 'button', 8000).then(() => true).catch(() => false);
  rec.time('verdict', 'settled_by_player', 0, String(settledByMe));
  const tv = stopwatch();
  await rec.frames(p, 'verdict-reveal', { count: 12, interval: 250 });
  await waitText(p, 'strangers agreed', 30000).catch(() => rec.issue('verdict copy "strangers agreed" not found'));
  rec.time('verdict', 'settle_to_verdict_text', tv());
  // Is the verdict on screen when it lands, or above the fold where the Settle button was?
  const where = await p.evaluate(() => {
    const re = /strangers agreed|no verdict/i;
    const el = [...document.querySelectorAll('h1,h2,h3,p,span,div')].find((e) => re.test(e.textContent) && ![...e.children].some((c) => re.test(c.textContent)));
    if (!el) return 'not found';
    const r = el.getBoundingClientRect();
    return r.bottom < 0 ? `above viewport by ${Math.round(-r.bottom)}px` : r.top > innerHeight ? `below viewport by ${Math.round(r.top - innerHeight)}px` : 'in viewport';
  });
  rec.time('verdict', 'verdict_position_after_settle', 0, where);
  await rec.shot(p, 'verdict', { fullPage: true });
  await clickText(p, 'Collect ');
  await waitText(p, 'Collected.');
  await rec.shot(p, 'collected', { fullPage: true });
  await clickText(p, 'My court', 'a');
  await waitText(p, 'Jury seats');
  await rec.shot(p, 'my-court', { fullPage: true });
  await p.goto(base + '/grand-jury/pricing', { waitUntil: 'networkidle' });
  await rec.shot(p, 'who-pays', { fullPage: true });
  await ctx.close();
}

export const GJ_VARIANTS = [
  { variant: 'desktop', profile: 'desktop' },
  { variant: 'mobile', profile: 'mobile' },
  { variant: 'reduced-motion', profile: 'reduced' },
];

export async function runGrandJury(srv, only) {
  const out = [];
  for (const v of GJ_VARIANTS.filter((x) => !only || only.includes(x.variant))) {
    const browser = await launch();
    const rec = new Recorder('grand-jury', v.variant);
    rec.base = srv.base;
    let ok = true;
    try {
      await playGrandJury(browser, rec, v.profile);
    } catch (e) {
      ok = false;
      rec.issue(`SCENARIO FAILURE: ${e.message.split('\n')[0]}`);
      console.error(`  FAIL grand-jury/${v.variant}:`, e.message.split('\n')[0]);
      for (const c of browser.contexts()) for (const [i, pg] of c.pages().entries()) await pg.screenshot({ path: join(rec.dir, `FAIL-tab${i}.png`), fullPage: true }).catch(() => {});
      writeFileSync(join(rec.dir, 'FAIL.txt'), e.stack ?? String(e));
    }
    const s = rec.summary();
    await browser.close();
    out.push({ variant: v.variant, ok, total: s.total, issues: s.issues.length });
    console.log('grand-jury', JSON.stringify(out.at(-1)));
  }
  return out;
}

if (process.argv[1]?.endsWith('grand-jury.mjs')) {
  const srv = await startPreview();
  try {
    await runGrandJury(srv, process.argv.slice(2).length ? process.argv.slice(2) : null);
  } finally {
    await srv.stop();
  }
}

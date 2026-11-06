/* global process, console, document, window */
// Scenario 1 — Mode 1 Solo: filing wizard → trial → NPC jury → verdict →
// share card → docket. Variants cover both verdicts and a NO VERDICT refund.
import { Recorder, launch, press, runVariant, sleep, startPreview, stopwatch } from './lib.mjs';

/** Confessions: the NPC jury's votes are a deterministic function of the frozen transcript. */
export const CONFESSIONS = [
  { title: 'I replied-all to the whole company', story: 'I replied all to a company-wide email with "lol same" and then did it again to apologise. 400 people got both.', category: 'NPC Behavior' },
  { title: 'Aped my rent into a dog coin', story: 'I put my rent money into a coin with a dog on it because a guy with a laser-eyes avatar said it was early. It was not early.', category: 'Crypto Crimes' },
  { title: 'Ghosted then double-texted', story: 'I ghosted someone for three weeks, then sent "hey stranger" and "??" four minutes apart at 2 a.m.', category: 'Dating Crimes' },
  { title: 'Quote-tweeted my own ratio', story: 'I got ratioed on a bad pizza take and then quote-tweeted my own post to double down with a poll.', category: 'Internet Crimes' },
  { title: 'Said "you too" to the waiter', story: 'The waiter said enjoy your meal and I said you too. Then I left a review apologising for it.', category: 'NPC Behavior' },
  { title: 'Sold the top, bought it back higher', story: 'I sold at the bottom, bought back at the top, and posted a thread about my discipline as a trader.', category: 'Crypto Crimes' },
];

/** Stop the jury and jump the page clock past a deadline (Playwright fakes Date and performance.now, which the demo clock reads). */
async function stallJury(page, rec, { at, minutes }) {
  // Wait until the jury reaches the requested step, then pause it.
  const t = stopwatch();
  // 'entry': pause as soon as the jury box appears (the NPCs seat themselves in about a second each).
  await press(page, 'Pause the jury');
  const seated = await page.getByText(/Seated · bond posted|Scroll sealed|Deciding/).count();
  rec.time('jury', 'paused_at', t(), `${at}; ${seated} seat(s) already filled`);
  await rec.shot(page, 'jury-paused');
  await page.clock.fastForward(`${String(minutes).padStart(2, '0')}:00`);
  await sleep(1500);
  await rec.shot(page, `jury-after-${minutes}min`);
  await press(page, 'Resume the jury');
  await sleep(4000);
  await rec.shot(page, 'jury-resumed-after-deadline');
  if (await page.getByText('The jury hit a snag').isVisible().catch(() => false)) {
    await page.getByText('Technical details').click().catch(() => {});
    await sleep(500);
    const details = await page.locator('details').filter({ hasText: 'Technical details' }).innerText().catch(() => '');
    rec.time('jury', 'snag_details', 0, details.replace(/\s+/g, ' ').slice(0, 300));
    await rec.shot(page, 'jury-snag-details');
    await press(page, 'Resume the jury');
    await sleep(5000);
    await rec.shot(page, 'jury-snag-after-retry');
    const stuck = await page.getByText('The jury hit a snag').isVisible().catch(() => false);
    rec.time('jury', 'snag_after_retry', 0, stuck ? 'still stuck' : 'recovered');
    if (stuck) throw new Error(`NO VERDICT unreachable: the jury errors after the deadline (${details.replace(/\s+/g, ' ').slice(0, 160)})`);
  }
}

export async function playSolo(page, rec, { confession, profile, watchTrial = true, stall = null, classic = false }) {
  const base = rec.base;
  // The refund path is about money, not the 3D room: use the classic stage (lighter on this box).
  if (classic) await page.addInitScript(() => window.localStorage.setItem('cc:trial-view', 'classic'));
  const t0 = stopwatch();
  // Controlled clock: real speed, immune to host wall-clock jumps; lets NO VERDICT jump deadlines.
  await page.clock.install();
  await page.goto(base + '/court', { waitUntil: 'networkidle' });
  rec.time('lobby', 'time_to_interactive', t0());
  await rec.shot(page, 'lobby', { fullPage: true });

  await rec.measure('solo-landing', 'click_to_ready', async () => {
    await page.getByRole('link', { name: 'Solo Court', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Solo Court', level: 1 }).waitFor();
  });
  await rec.shot(page, 'solo-landing', { fullPage: profile === 'mobile' });

  await rec.measure('file-step1', 'click_to_ready', async () => {
    await press(page, 'File a confession');
    await page.getByLabel('Case title').waitFor();
  });
  await rec.shot(page, 'file-1-confess-empty');
  // Submitting empty first: what does validation say?
  await press(page, 'File the confession');
  await sleep(400);
  await rec.shot(page, 'file-1-validation');
  await page.getByRole('radio', { name: new RegExp(confession.category) }).check({ force: true });
  await page.getByLabel('Case title').fill(confession.title);
  await page.getByLabel('Your confession').fill(confession.story);
  await page.getByLabel(/Names or handles to hide/).fill('Dave from accounts');
  await rec.shot(page, 'file-1-confess-filled', { fullPage: true });

  await rec.measure('file-step2', 'click_to_ready', async () => {
    await press(page, 'File the confession');
    await page.getByRole('button', { name: /Ask Counsel Chaos for angles/ }).waitFor();
  });
  await rec.shot(page, 'file-2-brief', { fullPage: true });
  await rec.measure('file-step2', 'angles_wait', async () => {
    await press(page, 'Ask Counsel Chaos for angles');
    await page.getByRole('radio').first().waitFor({ timeout: 30000 });
  });
  await page.getByRole('radio').first().check({ force: true });
  await rec.shot(page, 'file-2-angles', { fullPage: true });

  await rec.measure('file-step3-4', 'counsel_drafting_wait', async () => {
    await press(page, 'Approve and send to counsel');
    await page.getByRole('button', { name: /Freeze the transcript/ }).waitFor({ timeout: 60000 });
  });
  await rec.shot(page, 'file-4-review', { fullPage: true });

  await rec.measure('file-step5', 'click_to_ready', async () => {
    await press(page, 'Freeze the transcript');
    await page.getByRole('button', { name: /Pay .* and open the case/ }).waitFor();
  });
  await rec.shot(page, 'file-5-pay', { fullPage: true });

  await rec.measure('pay', 'pay_to_trial', async () => {
    await press(page, 'and open the case');
    await page.locator('[data-view]').first().waitFor({ timeout: 60000 });
  });
  const view = await page.locator('[data-view]').first().getAttribute('data-view');
  rec.time('trial', 'view_kind', 0, view);
  const frame = page.locator('[data-view]').first();
  await frame.scrollIntoViewIfNeeded();
  if (view === 'roam') {
    const tReady = stopwatch();
    await page.locator('canvas').first().waitFor({ timeout: 60000 }).catch(() => {});
    rec.time('trial', 'roam_canvas_ready', tReady());
  }
  await sleep(1500);
  await rec.shot(page, `trial-start-${view}`);
  if (!classic) await rec.frames(page, `trial-${view}`, { count: 10, interval: 250 });

  if (watchTrial) {
    // Watch the whole hearing like a first-timer: until the jury takes over (cap 6 min).
    const tw = stopwatch();
    let k = 0;
    while (tw().ms < 360000) {
      // The jury box's own heading (the transcript itself also says "THE JURY IS OUT").
      if (await page.locator('#jury-title').isVisible().catch(() => false)) break;
      await sleep(5000);
      if (++k % 6 === 0) await rec.shot(page, `trial-watch-${k / 6}`);
    }
    rec.time('trial', 'full_hearing_watch', tw(), view);
  } else {
    await rec.measure('trial', 'skip_to_jury', () => press(page, 'Skip to the jury'));
  }

  await page.locator('#jury-title').waitFor({ timeout: 60000 });
  if (stall) await stallJury(page, rec, stall);
  else await rec.shot(page, 'jury-start');
  const tj = stopwatch();
  await rec.frames(page, 'jury', { count: 8, interval: 1000 });
  // Catch the hand-off: start the reveal sequence as the last scroll opens.
  await page
    .waitForFunction(() => /Counting the scrolls|Open 3\/3/.test(document.body.innerText) || Boolean(document.querySelector('[data-outcome]')), null, { timeout: 240000 })
    .catch(() => {});
  await rec.frames(page, 'verdict-reveal', { count: 12, interval: 250 });
  await page.locator('[data-outcome]').first().waitFor({ timeout: 240000 });
  rec.time('jury', 'jury_to_verdict', tj(), stall ? 'after stall' : 'normal pacing');
  const outcome = await page.locator('[data-outcome]').first().getAttribute('data-outcome');
  rec.time('verdict', 'outcome', 0, outcome);
  await rec.shot(page, 'verdict', { fullPage: true });

  const claim = page.getByRole('button', { name: /Claim your .* refund/ });
  if (await claim.isVisible().catch(() => false)) {
    await rec.measure('verdict', 'claim_refund', async () => {
      await claim.click();
      await page.getByText('Refund claimed').waitFor({ timeout: 20000 });
    });
    await rec.shot(page, 'refund-claimed', { fullPage: true });
  }

  const share = page.getByRole('button', { name: /Download/ }).first();
  if (await share.count()) {
    await share.scrollIntoViewIfNeeded();
    await sleep(1500);
    await rec.shot(page, 'share-card');
  }

  await rec.measure('docket', 'click_to_ready', async () => {
    await page.goto(base + '/solo/docket', { waitUntil: 'networkidle' });
  });
  await rec.shot(page, 'docket', { fullPage: true });
  return { outcome, view };
}

export const SOLO_VARIANTS = [
  { variant: 'desktop-A', profile: 'desktop', confession: 0, watchTrial: true },
  { variant: 'desktop-B', profile: 'desktop', confession: 1, watchTrial: false },
  { variant: 'desktop-C', profile: 'desktop', confession: 2, watchTrial: false },
  { variant: 'desktop-noverdict', profile: 'desktop', confession: 3, watchTrial: false, stall: { at: 'entry', minutes: 16 }, classic: true },
  { variant: 'mobile', profile: 'mobile', confession: 4, watchTrial: false },
  { variant: 'reduced-motion', profile: 'reduced', confession: 5, watchTrial: false },
  { variant: 'no-webgl-classic', profile: 'desktop', confession: 0, watchTrial: true, webgl: false },
];

export async function runSolo(srv, only) {
  const results = [];
  for (const v of SOLO_VARIANTS.filter((x) => !only || only.includes(x.variant))) {
    const browser = await launch({ webgl: v.webgl !== false });
    const rec = new Recorder('solo', v.variant);
    rec.base = srv.base;
    let res = {};
    const r = await runVariant(browser, rec, v.profile, async (page) => {
      res = await playSolo(page, rec, { confession: CONFESSIONS[v.confession], profile: v.profile, watchTrial: v.watchTrial, stall: v.stall, classic: v.classic });
    });
    await browser.close();
    results.push({ variant: v.variant, ...r, ...res, issues: r.issues.length });
    console.log('solo', v.variant, JSON.stringify(results.at(-1)));
  }
  return results;
}

if (process.argv[1]?.endsWith('solo.mjs')) {
  const srv = await startPreview();
  try {
    await runSolo(srv, process.argv.slice(2).length ? process.argv.slice(2) : null);
  } finally {
    await srv.stop();
  }
}

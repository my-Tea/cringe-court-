/* global process, console, document */
// Scenario 2 — Mode 2 Versus: Player A files, Player B joins via the invite
// link, private briefings with redaction, shared trial, World ID jury (mock),
// commit–reveal, verdict, claims. Plus: B opening the link in a *separate*
// browser context, B never answering (consent deadline), and a two-no-show mistrial.
import { Recorder, clickText, hasText, launch, PROFILES, sleep, startPreview, stopwatch, typeLabel, waitText } from './lib.mjs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

async function fileAsA(A, rec) {
  const base = rec.base;
  const t0 = stopwatch();
  await A.goto(base + '/versus', { waitUntil: 'networkidle' });
  rec.time('A-versus-landing', 'time_to_interactive', t0());
  await rec.shot(A, 'A-landing');
  await clickText(A, 'Start a Versus case');
  await waitText(A, 'Case title');
  await rec.shot(A, 'A-new-case');
  await typeLabel(A, 'Case title', 'The Last Dumpling');
  await clickText(A, 'NPC Behavior', 'label');
  await clickText(A, 'Brief Agent A');
  await typeLabel(A, 'Your answer', 'We agreed to split the last dumpling. I went to get napkins and came back to an empty plate and a guilty smile. Text me at 555-201-9934 if you disagree.');
  await clickText(A, 'Send');
  await typeLabel(A, 'Your answer', 'A split is a contract. Napkin duty is a public service, not abandonment of the dumpling.');
  await clickText(A, 'Send');
  await typeLabel(A, 'Your answer (private)', 'This is the third dumpling incident this year.');
  await clickText(A, 'Send');
  await rec.measure('A-briefing', 'angles_wait', () => waitText(A, 'Write my own', 30000));
  await rec.shot(A, 'A-briefing-chat', { fullPage: true });
  await clickText(A, 'A deal is a deal', 'label');
  await clickText(A, 'Review my brief');
  await waitText(A, 'What the jury will read');
  await typeLabel(A, 'Nickname on the verdict', 'Napkin Knight');
  await rec.shot(A, 'A-review-redaction', { fullPage: true });
  await clickText(A, 'File & get invite');
  await waitText(A, 'Verify & file');
  await rec.shot(A, 'A-world-id-dialog');
  await rec.measure('A-file', 'verify_to_invite', async () => {
    await clickText(A, 'Verify & file');
    await waitText(A, 'Invite code', 20000);
  });
  await rec.shot(A, 'A-invite', { fullPage: true });
  const link = await A.evaluate(() => [...document.querySelectorAll('p')].find((p) => p.textContent.includes('/versus/join/'))?.textContent.replace('Invite link: ', '').trim());
  rec.time('A-file', 'invite_link', 0, link);
  return link.replace(/^https?:\/\/[^/]+/, base);
}

export async function playVersus(browser, rec, profile, { plan = 'reliable', watchHearing = false } = {}) {
  const ctx = await browser.newContext({ ...PROFILES[profile] });
  // A controlled clock that flows at real speed but is immune to host wall-clock jumps.
  await ctx.clock.install();
  ctx.setDefaultTimeout(90000);
  const A = await ctx.newPage();
  rec.watch(A, 'A');
  const link = await fileAsA(A, rec);

  // Player B in a separate browser context (a different person's browser).
  const other = await browser.newContext({ ...PROFILES[profile] });
  await other.clock.install();
  const Bx = await other.newPage();
  rec.watch(Bx, 'B-other-browser');
  await Bx.goto(link, { waitUntil: 'networkidle' });
  await sleep(1500);
  await rec.shot(Bx, 'B-other-browser-opens-invite', { fullPage: true });
  const crossOk = await hasText(Bx, 'Accept & become Side B');
  rec.time('B-other-browser', 'invite_works_across_browsers', 0, String(crossOk));
  await other.close();

  // Player B in a second tab of the same browser: the supported demo path.
  const B = await ctx.newPage();
  rec.watch(B, 'B');
  const tB = stopwatch();
  await B.goto(link, { waitUntil: 'networkidle' });
  await waitText(B, 'Accept & become Side B');
  rec.time('B-summons', 'time_to_interactive', tB());
  await rec.shot(B, 'B-summons', { fullPage: true });
  await clickText(B, 'Accept & become Side B');
  await clickText(B, 'Verify & accept');
  await waitText(B, 'Private briefing with Agent B');
  await rec.shot(B, 'B-briefing-start');
  await typeLabel(B, 'Your answer', 'The dumpling was going cold. Leaving food unattended is a forfeit, everybody knows that rule. Ask Priya.');
  await clickText(B, 'Send');
  await typeLabel(B, 'Your answer', 'Hot food waits for no one. I saved it from a tragic, lukewarm fate.');
  await clickText(B, 'Send');
  await clickText(B, 'Skip');
  await waitText(B, 'Write my own', 30000);
  await clickText(B, 'A deal is a deal', 'label');
  await clickText(B, 'Review my brief');
  await clickText(B, 'Save my brief');
  await waitText(B, 'Approve my brief');
  await rec.shot(B, 'B-brief-panel', { fullPage: true });
  await clickText(B, 'Approve my brief');

  // Side A's view of the shared case room (never captured before this playtest).
  await A.bringToFront();
  await sleep(1500);
  await rec.shot(A, 'A-case-room-B-joined', { fullPage: true });
  await clickText(A, 'Approve my brief');
  await rec.measure('drafting', 'agents_drafting_wait', () => waitText(A, 'Approve the draft', 60000));
  await sleep(1000);
  await rec.shot(A, 'A-draft-review', { fullPage: true });
  await clickText(A, 'Approve the draft');
  await B.bringToFront();
  await clickText(B, 'Approve the draft');
  await waitText(B, 'Pay your half');
  await clickText(B, 'Get test USDC');
  await sleep(800);
  await clickText(B, 'Pay 0.70');
  await A.bringToFront();
  await waitText(A, 'Pay your half');
  await rec.shot(A, 'A-funding', { fullPage: true });
  await clickText(A, 'Get test USDC');
  await sleep(800);
  await clickText(A, 'Pay 0.70');
  await waitText(A, 'Jury selection', 15000);
  await rec.shot(A, 'A-jury-selection', { fullPage: true });

  // A juror (third tab, World ID mock).
  const J = await ctx.newPage();
  rec.watch(J, 'J');
  await J.goto(A.url(), { waitUntil: 'networkidle' });
  await waitText(J, 'I swear to show up');
  await rec.shot(J, 'J-summons', { fullPage: true });
  await clickText(J, 'Get test USDC for the bond');
  await sleep(800);
  await clickText(J, 'I swear to show up');
  await sleep(500);
  await rec.shot(J, 'J-world-id-dialog');
  await clickText(J, 'Verify & post');
  await sleep(1500);
  await A.bringToFront();
  if (plan !== 'reliable') await clickText(A, plan === 'two-no-shows' ? 'Two no-shows' : 'One no-show', 'label');
  await clickText(A, 'Seat simulated jurors');
  // Park A and B on the case list while the juror watches: three tabs of
  // software-rendered WebGL starve this headless box (screenshots time out).
  const caseUrl = A.url();
  await A.goto(rec.base + '/versus/cases', { waitUntil: 'networkidle' });
  await B.goto(rec.base + '/versus/cases', { waitUntil: 'networkidle' });
  await J.bringToFront();
  await waitText(J, 'Secret Verdict Scroll', 20000);
  const frame = J.locator('[data-view]').first();
  await frame.waitFor({ timeout: 30000 });
  const view = await frame.getAttribute('data-view');
  rec.time('J-trial', 'view_kind', 0, view);
  await frame.scrollIntoViewIfNeeded();
  await sleep(3000);
  await rec.shot(J, `J-trial-${view}`);
  await rec.frames(J, `J-trial-${view}`, { count: 8, interval: 250 });
  if (view === 'classic') await clickText(J, 'Play the trial').catch(() => {});
  if (watchHearing) {
    // B2: sit through the whole hearing (about 174 s in first person) before voting, glancing at the ballot HUD.
    const tw = stopwatch();
    for (const at of [60, 150, 200]) {
      await sleep(Math.max(0, at * 1000 - tw()));
      const hud = await J.getByRole('region', { name: 'Your ballot' }).innerText().catch(() => '(no ballot HUD)');
      rec.time('J-trial', `ballot_hud_at_${at}s`, tw(), hud.replace(/\s+/g, ' ').slice(0, 160));
      await rec.shot(J, `J-watching-${at}s`);
    }
  }
  // How much of the demo commit window is left once the juror has looked at the trial?
  const left = await J.evaluate(() => document.body.innerText.match(/(?:closes|sealed) in\s*(\d+:\d+)/i)?.[1] ?? document.body.innerText.match(/(\d+:\d\d)/)?.[1] ?? '?');
  rec.time('J-trial', 'commit_window_left_after_frames', 0, left);
  await rec.shot(J, 'J-trial-later', { fullPage: true });
  await clickText(J, 'SIDE B', 'label');
  await rec.shot(J, 'J-scroll-choice', { fullPage: true });
  await clickText(J, 'Seal my Secret Verdict Scroll');
  await sleep(3000);
  await rec.shot(J, 'J-sealed', { fullPage: true });
  await A.bringToFront();
  await A.goto(caseUrl, { waitUntil: 'networkidle' });
  await sleep(4000);
  await rec.shot(A, 'A-deliberating', { fullPage: true });
  // Once every juror has sealed, the demo clerk closes the window itself (B2); the skip button is only needed before that.
  await clickText(A, 'Skip to the deadline', 'button', 8000).catch(() => rec.time('A-deliberating', 'skip_not_needed', 0, 'the clerk already closed the window'));
  await J.bringToFront();
  const canOpen = await waitText(J, 'Open my scroll', 20000).then(() => true).catch(() => false);
  rec.time('J-reveal', 'open_scroll_offered', 0, String(canOpen));
  if (canOpen) await clickText(J, 'Open my scroll');
  await sleep(6000);
  await A.bringToFront();
  const tv = stopwatch();
  for (let i = 0; i < 6 && !(await hasText(A, 'The jury has spoken')) && !(await hasText(A, 'NO VERDICT')) && !(await hasText(A, 'mistrial')); i++) {
    await clickText(A, 'Skip to the deadline', 'button', 3000).catch(() => {});
    await sleep(3000);
  }
  rec.time('verdict', 'reveal_to_verdict', tv());
  await rec.frames(A, 'A-verdict-reveal', { count: 12, interval: 250 });
  await rec.shot(A, 'A-verdict', { fullPage: true });
  await B.bringToFront();
  await B.goto(caseUrl, { waitUntil: 'networkidle' });
  await sleep(1500);
  await rec.shot(B, 'B-verdict', { fullPage: true });
  for (const [who, p] of [['A', A], ['B', B], ['J', J]]) {
    await p.bringToFront();
    await p.reload({ waitUntil: 'networkidle' });
    await sleep(800);
    const claimed = await clickText(p, 'Claim', 'button', 4000).then(() => true).catch(() => false);
    rec.time(`${who}-claim`, 'claim_available', 0, String(claimed));
    await sleep(1200);
    await rec.shot(p, `${who}-after-claim`, { fullPage: true });
  }
  await A.goto(rec.base + '/versus/cases', { waitUntil: 'networkidle' });
  await rec.shot(A, 'A-cases', { fullPage: true });
  await ctx.close();
}

/** B never answers: A files, then skips to the consent deadline. */
export async function playVersusExpiry(browser, rec, profile) {
  const ctx = await browser.newContext({ ...PROFILES[profile] });
  await ctx.clock.install();
  const A = await ctx.newPage();
  rec.watch(A, 'A');
  await fileAsA(A, rec);
  const skip = await clickText(A, 'Skip to the deadline', 'button', 5000).then(() => true).catch(() => false);
  rec.time('expiry', 'skip_offered_while_waiting_for_B', 0, String(skip));
  await sleep(2500);
  await rec.shot(A, 'A-after-consent-deadline', { fullPage: true });
  await ctx.close();
}

export const VERSUS_VARIANTS = [
  { variant: 'desktop', profile: 'desktop', kind: 'full' },
  { variant: 'desktop-mistrial', profile: 'desktop', kind: 'full', plan: 'two-no-shows' },
  { variant: 'desktop-juror-watches-hearing', profile: 'desktop', kind: 'full', watchHearing: true },
  { variant: 'desktop-B-never-joins', profile: 'desktop', kind: 'expiry' },
  { variant: 'mobile', profile: 'mobile', kind: 'full' },
  { variant: 'reduced-motion', profile: 'reduced', kind: 'full' },
];

export async function runVersus(srv, only) {
  const out = [];
  for (const v of VERSUS_VARIANTS.filter((x) => !only || only.includes(x.variant))) {
    const browser = await launch();
    const rec = new Recorder('versus', v.variant);
    rec.base = srv.base;
    let ok = true;
    try {
      if (v.kind === 'full') await playVersus(browser, rec, v.profile, { plan: v.plan, watchHearing: v.watchHearing });
      else await playVersusExpiry(browser, rec, v.profile);
    } catch (e) {
      ok = false;
      rec.issue(`SCENARIO FAILURE: ${e.message.split('\n')[0]}`);
      console.error(`  FAIL versus/${v.variant}:`, e.message.split('\n')[0]);
      for (const c of browser.contexts()) for (const [i, p] of c.pages().entries()) await p.screenshot({ path: join(rec.dir, `FAIL-tab${i}.png`), fullPage: true }).catch(() => {});
      writeFileSync(join(rec.dir, 'FAIL.txt'), e.stack ?? String(e));
    }
    const s = rec.summary();
    await browser.close();
    out.push({ variant: v.variant, ok, total: s.total, issues: s.issues.length });
    console.log('versus', JSON.stringify(out.at(-1)));
  }
  return out;
}

if (process.argv[1]?.endsWith('versus.mjs')) {
  const srv = await startPreview();
  try {
    await runVersus(srv, process.argv.slice(2).length ? process.argv.slice(2) : null);
  } finally {
    await srv.stop();
  }
}

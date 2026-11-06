/* global document */
// Grand Jury across devices: seven jurors, each in their own browser context
// (separate storage = separate devices), on one court server with simulated
// jurors switched off (CC_GJ_NPC_JURORS=off), so every seat is a real person.
// One juror tops up the crowdfund; all seven pass screening, take a seat, seal,
// open their scrolls; anyone settles; every device sees the same verdict.
import { clickText, hasText, sleep, waitText } from './lib.mjs';

const CASE_TITLE = 'The Cereal Question';
const BALLOT = ['TEAM CEREAL IS SOUP', 'TEAM NOT SOUP'];
const VOTES = [0, 1, 0, 1, 0, 1, 0];

export async function playGrandJuryAcrossDevices(browser, base, shots) {
  const jurors = [];
  for (let i = 0; i < 7; i++) {
    const mobile = i === 1 || i === 4;
    const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 860 } });
    ctx.setDefaultTimeout(60000);
    const page = await ctx.newPage();
    shots.watch(page, `J${i + 1}`);
    jurors.push(page);
  }
  const [first] = jurors;

  shots.step('J1: find the case on the shared docket');
  await first.goto(base + '/grand-jury/docket', { waitUntil: 'load' });
  await waitText(first, 'Shared court');
  await waitText(first, CASE_TITLE, 30000);
  await shots.shot(first, 'J1-docket');
  const href = await first.evaluate((title) => {
    const a = [...document.querySelectorAll('a[href*="/grand-jury/case/"]')].find((x) => (x.closest('li, article, section') ?? x).textContent.includes(title));
    return a?.getAttribute('href') ?? null;
  }, CASE_TITLE);
  if (!href) throw new Error(`No docket link for ${CASE_TITLE}`);
  await first.goto(base + href, { waitUntil: 'load' });
  await waitText(first, 'Summon');
  const caseUrl = first.url();
  shots.step(`case ${caseUrl}`);

  shots.step('J1: fill the rest of the crowdfund');
  await clickText(first, 'Fill the rest', 'button');
  await clickText(first, 'Summon with', 'button');
  await waitText(first, 'Volunteer for the jury', 30000);
  await shots.shot(first, 'J1-funded-seating');

  for (const [i, p] of jurors.entries()) {
    shots.step(`J${i + 1}: screening, seat offer, bond`);
    if (i > 0) await p.goto(caseUrl, { waitUntil: 'load' });
    await clickText(p, 'Volunteer for the jury', 'button', 30000);
    await clickText(p, 'Verify with World ID', 'button');
    await waitText(p, 'A seat is offered to you', 30000);
    if (i === 2) await shots.shot(p, 'J3-seat-offer');
    await clickText(p, 'I swear to show up', 'button');
    if (i < 6) await sleep(800);
  }
  await waitText(first, 'Seal your ballot', 60000);
  await sleep(1500);
  await shots.shot(first, 'J1-in-session-7-of-7');

  for (const [i, p] of jurors.entries()) {
    shots.step(`J${i + 1}: seal ${BALLOT[VOTES[i]]}`);
    await waitText(p, 'Seal your ballot', 60000);
    await clickText(p, BALLOT[VOTES[i]], 'label');
    await clickText(p, 'Seal my ballot', 'button');
    await waitText(p, 'Secret Verdict Scroll', 30000);
  }
  await shots.shot(jurors[1], 'J2-mobile-sealed');
  // Isolation: J2's page shows its own sealed choice and nobody else's.
  const leaked = await jurors[1].evaluate(() => document.body.innerText.includes('Seat 1') && document.body.innerText.includes('TEAM CEREAL IS SOUP (seat 1)'));
  if (leaked) throw new Error('Another juror’s vote is visible before the reveal');

  shots.step('demo clock: skip to the reveal window (shared clock)');
  await clickText(first, 'Skip to the deadline', 'button');
  for (const [i, p] of jurors.entries()) {
    await waitText(p, 'Open your scroll', 30000);
    await clickText(p, 'Open my scroll', 'button');
    await waitText(p, 'Your vote is counted', 30000);
    shots.step(`J${i + 1}: scroll opened`);
  }
  await shots.shot(jurors[3], 'J4-revealed');
  await clickText(first, 'Skip to the deadline', 'button', 15000).catch(() => {});
  await waitText(jurors[6], 'Settle the case', 30000);
  shots.step('J7 settles (permissionless)');
  await clickText(jurors[6], 'Settle and read the verdict', 'button');
  for (const [i, p] of jurors.entries()) {
    await waitText(p, 'strangers agreed', 30000);
    if (i === 0 || i === 4) {
      await sleep(1500);
      await shots.shot(p, `J${i + 1}-verdict`);
    }
  }
  const agreed = await first.evaluate(() => document.body.innerText.match(/(\d) of 7 strangers agreed/)?.[1] ?? '?');
  shots.step(`verdict: ${agreed} of 7 agreed`);
  for (const [i, p] of jurors.entries()) {
    await clickText(p, 'Collect ', 'button', 20000);
    await waitText(p, 'Collected.', 20000);
    shots.step(`J${i + 1}: collected`);
  }
  await shots.shot(jurors[5], 'J6-collected');
  return { agreed: `${agreed}/7`, devices: 7, sawVerdictOnEveryDevice: (await Promise.all(jurors.map((p) => hasText(p, 'strangers agreed')))).every(Boolean) };
}

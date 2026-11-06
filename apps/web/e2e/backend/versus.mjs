/* global console, document */
// Versus across devices: Side A, Side B and a juror each in their own browser
// context (separate storage = separate devices), all on one court server.
// A files and sends the signed link; B opens it on "another device", accepts
// and briefs; the server's clerk drafts; both pay; a human juror plus two
// labelled demo jurors decide; both sides see the verdict on their own device.
import { clickText, hasText, sleep, typeLabel, waitText } from './lib.mjs';

const PRIVATE_A = 'third dumpling incident this year';
const PRIVATE_B = 'already eaten four';

async function device(browser, shots, who, profile = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...profile });
  ctx.setDefaultTimeout(60000);
  const page = await ctx.newPage();
  shots.watch(page, who);
  return { ctx, page };
}

export async function playVersusAcrossDevices(browser, base, shots) {
  const A = (await device(browser, shots, 'A')).page;
  shots.step('A: file a case');
  await A.goto(base + '/versus/new', { waitUntil: 'load' });
  await waitText(A, 'Shared court');
  await waitText(A, 'Case title');
  await typeLabel(A, 'Case title', 'The Last Dumpling');
  await clickText(A, 'NPC Behavior', 'label');
  await clickText(A, 'Brief Agent A');
  await typeLabel(A, 'Your answer', 'We agreed to split the last dumpling. I went to get napkins and came back to an empty plate and a guilty smile.');
  await clickText(A, 'Send');
  await typeLabel(A, 'Your answer', 'A split is a contract. Napkin duty is a public service, not abandonment of the dumpling.');
  await clickText(A, 'Send');
  await typeLabel(A, 'Your answer (private)', `This is the ${PRIVATE_A}.`);
  await clickText(A, 'Send');
  await waitText(A, 'Write my own', 30000);
  await clickText(A, 'A deal is a deal', 'label');
  await clickText(A, 'Review my brief');
  await waitText(A, 'What the jury will read');
  await typeLabel(A, 'Nickname on the verdict', 'Napkin Knight');
  await clickText(A, 'File & get invite');
  await clickText(A, 'Verify & file');
  await waitText(A, 'Invite code', 20000);
  await sleep(800);
  await shots.shot(A, 'A-device-invite');
  const link = await A.evaluate(() => [...document.querySelectorAll('p')].find((p) => p.textContent.includes('/versus/join/'))?.textContent.replace(/^Invite link:?\s*/i, '').trim());
  if (!link || !link.includes('?t=')) throw new Error(`Expected a signed invite link, got ${link}`);
  shots.step(`invite link carries a signed token: ${link.replace(/t=.*/, 't=…')}`);
  const caseUrl = A.url();

  shots.step('B: open the link on another device');
  const B = (await device(browser, shots, 'B', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).page;
  await B.goto(link.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'load' });
  await waitText(B, 'Accept & become Side B', 30000);
  await shots.shot(B, 'B-device-summons');
  if (await hasText(B, 'No case with that code')) throw new Error('B could not see the case');
  await clickText(B, 'Accept & become Side B');
  await clickText(B, 'Verify & accept');
  await waitText(B, 'Private briefing with Agent B');
  await typeLabel(B, 'Your answer', 'The dumpling was going cold. Leaving food unattended is a forfeit, everybody knows that rule.');
  await clickText(B, 'Send');
  await typeLabel(B, 'Your answer', 'Hot food waits for no one. I saved it from a tragic, lukewarm fate.');
  await clickText(B, 'Send');
  await typeLabel(B, 'Your answer (private)', `Honestly I had ${PRIVATE_B}.`);
  await clickText(B, 'Send');
  await waitText(B, 'Write my own', 30000);
  await clickText(B, 'A deal is a deal', 'label');
  await clickText(B, 'Review my brief');
  await clickText(B, 'Save my brief');
  await waitText(B, 'Approve my brief');
  // The information wall, across the wire: B's device never received A's private notes.
  if (await hasText(B, PRIVATE_A)) throw new Error('A’s private notes reached B’s device');
  const bLog = await B.evaluate(() => JSON.stringify(Object.keys(localStorage)));
  shots.step(`B local storage keys: ${bLog}`);
  await shots.shot(B, 'B-device-brief-panel');

  shots.step('B: reload mid-case (refresh resumes the same session)');
  await B.reload({ waitUntil: 'load' });
  await waitText(B, 'Approve my brief', 30000);
  await clickText(B, 'Approve my brief');

  shots.step('A: sees B joined, live, without reloading');
  await waitText(A, 'Approve my brief', 30000);
  await sleep(1000);
  if (await hasText(A, PRIVATE_B)) throw new Error('B’s private notes reached A’s device');
  await shots.shot(A, 'A-device-B-joined-live');
  await clickText(A, 'Approve my brief');
  shots.step('the court server’s clerk drafts both agents');
  await waitText(A, 'Approve the draft', 60000);
  await shots.shot(A, 'A-device-draft');
  await clickText(A, 'Approve the draft');
  await waitText(B, 'Approve the draft', 30000);
  await clickText(B, 'Approve the draft');
  await waitText(B, 'Pay your half', 30000);
  await clickText(B, 'Get test USDC');
  await sleep(1200);
  await clickText(B, 'Pay 0.70');
  await waitText(A, 'Pay your half', 30000);
  await clickText(A, 'Get test USDC');
  await sleep(1200);
  await clickText(A, 'Pay 0.70');
  await waitText(A, 'Jury selection', 30000);
  await shots.shot(A, 'A-device-jury-selection');

  shots.step('J: a juror on a third device');
  const J = (await device(browser, shots, 'J')).page;
  await J.goto(caseUrl, { waitUntil: 'load' });
  await waitText(J, 'I swear to show up', 30000);
  await clickText(J, 'Get test USDC for the bond');
  await sleep(1200);
  await clickText(J, 'I swear to show up');
  await clickText(J, 'Verify & post');
  await sleep(1500);
  await shots.shot(J, 'J-device-seated');
  await clickText(A, 'Seat simulated jurors');
  await waitText(J, 'Secret Verdict Scroll', 30000);
  await sleep(1500);
  await shots.shot(J, 'J-device-in-session');
  await clickText(J, 'SIDE B', 'label');
  await clickText(J, 'Seal my Secret Verdict Scroll');
  await sleep(2500);
  await shots.shot(J, 'J-device-sealed');

  shots.step('demo clock: skip to the reveal');
  for (let i = 0; i < 5 && !(await hasText(J, 'Open my scroll')); i++) {
    await clickText(A, 'Skip to the deadline', 'button', 5000).catch(() => {});
    await sleep(2500);
  }
  await clickText(J, 'Open my scroll', 'button', 30000);
  await sleep(2000);
  for (let i = 0; i < 8 && !(await hasText(A, 'The jury has spoken')) && !(await hasText(A, 'NO VERDICT')); i++) {
    await clickText(A, 'Skip to the deadline', 'button', 3000).catch(() => {});
    await sleep(3000);
  }
  await waitText(A, 'The jury has spoken', 60000).catch(() => waitText(A, 'NO VERDICT', 5000));
  await sleep(2000);
  await shots.shot(A, 'A-device-verdict');
  await waitText(B, 'The jury has spoken', 30000).catch(() => waitText(B, 'NO VERDICT', 5000));
  await sleep(1500);
  await shots.shot(B, 'B-device-verdict');
  for (const [who, p] of [
    ['A', A],
    ['B', B],
    ['J', J],
  ]) {
    const claimed = await clickText(p, 'Claim', 'button', 5000).then(() => true).catch(() => false);
    shots.step(`${who}: claim offered = ${claimed}`);
  }
  await sleep(1500);
  await shots.shot(J, 'J-device-after-claim');
  return { verdict: (await hasText(A, 'NO VERDICT')) ? 'no-verdict' : 'verdict' };
}

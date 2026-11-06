// Keyboard-only walkthroughs. node kbflow.mjs <base> <out> <solo|versus|gj> <width>
// Never clicks: every control is reached with Tab/Shift+Tab/arrows and activated with Enter/Space.
import { launch, watch, kb, kbType, waitText, waitControl, sleep, focused, axe } from './lib.mjs';
const [base, out, flow, width = '1280'] = process.argv.slice(2);
const W = Number(width);
const browser = await launch();
const errors = [];
const log = [];
const axeHits = [];
const ctx = await browser.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference', acceptDownloads: true, hasTouch: W < 600, isMobile: W < 600 });
const page = await ctx.newPage();
watch(page, errors);
const shot = (p, n) => p.screenshot({ path: `${out}/${flow}-${W}-${n}.png`, fullPage: true });
const step = async (n, f, p = page) => { const t0 = Date.now(); try { await f(); log.push(`ok ${n} (${Date.now() - t0}ms)`); console.log('ok', n); } catch (e) { await shot(p, 'FAIL-' + n.replace(/\W+/g, '_')); log.push(`FAIL ${n}: ${e.message}`); console.log('FAIL', n, e.message); console.log(JSON.stringify({ flow, width: W, log, axe: axeHits, errors: [...new Set(errors)].slice(0, 20) }, null, 1)); await browser.close(); process.exit(1); } };
const check = async (p, label) => { const v = await axe(p); if (v.length) axeHits.push({ label, v: v.map((x) => `${x.id}(${x.count}): ${x.nodes[0]?.target}`) }); };
/** Start each keyboard search from the top of the page, like a fresh Tab sequence. */
const top = async (p = page) => { await p.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); }); await p.locator('body').focus().catch(() => {}); };
const go = async (p, path) => { await p.goto(base + path, { waitUntil: 'networkidle' }); await sleep(600); };

/** Roam: focus the room, walk with W/arrows, interact with E, then switch to the classic stage and back. */
async function roam(p, tag) {
  const room = p.locator('[role="application"]').first();
  await room.waitFor({ timeout: 40000 });
  await sleep(2500);
  await top(p);
  // Keyboard-only path through the capture card if offered.
  const kbOnly = p.getByRole('button', { name: /keyboard only/i });
  if (await kbOnly.count()) await kb(p, /keyboard only/i);
  else await kb(p, /courtroom|room/i, { key: 'none' });
  const z0 = await room.getAttribute('data-roam-zone');
  const px = () => p.evaluate(() => { const c = document.querySelector('[role="application"] canvas'); if (!c) return ''; try { return c.toDataURL('image/png').length + ':' + c.toDataURL('image/png').slice(200, 260); } catch { return 'x'; } });
  const before = await px();
  await p.keyboard.down('KeyW'); await sleep(1800); await p.keyboard.up('KeyW');
  await p.keyboard.down('ArrowLeft'); await sleep(500); await p.keyboard.up('ArrowLeft');
  await sleep(400);
  const after = await px();
  const z1 = await room.getAttribute('data-roam-zone');
  log.push(`${tag} walk: zone ${z0 || '-'} -> ${z1 || '-'}, frame changed ${before !== after}`);
  await p.keyboard.press('KeyE'); await sleep(600);
  await p.screenshot({ path: `${out}/${flow}-${W}-${tag}-roam.png` });
  await p.keyboard.press('Escape'); await sleep(500);
  const paused = await p.getByRole('dialog').count();
  log.push(`${tag} Esc opens pause dialog: ${paused > 0}`);
  if (paused) { await p.keyboard.press('Escape'); await sleep(400); }
  // Fallback toggle, keyboard only.
  await top(p);
  await kb(p, /classic stage/i);
  await sleep(1200);
  const view = await p.locator('[data-view]').first().getAttribute('data-view').catch(() => '?');
  log.push(`${tag} classic toggle -> data-view=${view}`);
  await p.screenshot({ path: `${out}/${flow}-${W}-${tag}-classic.png` });
  await top(p);
  await kb(p, /^First person$/i).catch(() => log.push(`${tag} no way back to roam found by keyboard`));
  await sleep(800);
}

if (flow === 'solo') {
  await step('landing', async () => { await go(page, '/solo'); await top(); await kb(page, /File a confession/); await waitText(page, 'Confess your crime'); await check(page, 'solo/file'); });
  await step('validation', async () => { await top(); await kb(page, /File the confession/); await sleep(400); const f = await focused(page); log.push(`after invalid submit focus -> ${f?.tag}:${f?.name}`); await shot(page, '01-errors'); });
  await step('confess', async () => {
    await top(); await kb(page, /NPC Behavior/);
    await top(); await kb(page, /Use the example/);
    await top(); await kbType(page, /Private notes/, 'My manager replied-all first, I was just following leadership.');
    await top(); await kb(page, /File the confession/);
    await waitText(page, 'Brief your lawyer');
  });
  await step('brief', async () => {
    await top(); await kb(page, /Ask Counsel Chaos/); await waitText(page, 'Write my own line');
    await top(); await kb(page, /muscle memory/);
    await top(); await kbType(page, /^Exhibit title/, 'The fire drill email');
    await top(); await kbType(page, /^What it shows/, 'Reply: "lol same" (sent to 3,000 people).');
    await top(); await kb(page, /Add exhibit/);
    await check(page, 'solo brief');
    await top(); await kb(page, /Watch the free teaser/); await waitControl(page, /Approve and send/); await sleep(3000);
    await top(); await kb(page, /Approve and send/); await waitControl(page, /Freeze the transcript/, 60000);
    await top(); await kb(page, /Freeze the transcript/); await waitControl(page, /Pay 1\.20/);
    await check(page, 'solo pay');
    await top(); await kb(page, /Pay 1\.20/);
    await page.waitForURL(/\/solo\/case\//, { timeout: 20000 });
  });
  await step('trial-roam', async () => { await roam(page, 'solo'); await check(page, 'solo trial'); });
  await step('jury+verdict', async () => {
    await top(); await kb(page, /Skip to the jury/).catch(() => log.push('no skip-to-jury control'));
    await waitText(page, 'Phase 4', 60000).catch(() => {});
    await waitText(page, 'Share', 60000);
    await sleep(1500); await shot(page, '02-verdict'); await check(page, 'solo verdict');
    await top(); await kb(page, /Download PNG/);
  });
  await step('docket', async () => { await go(page, '/solo/docket'); await check(page, 'solo docket'); await shot(page, '03-docket'); });
}

if (flow === 'gj') {
  await step('docket', async () => { await go(page, '/grand-jury/docket'); await check(page, 'gj docket'); await top(); await kb(page, /Open to join/); await sleep(500); await top(); await kb(page, /Should code be indented with tabs/); await waitText(page, 'Summon the court'); });
  await step('fund', async () => { await top(); await kb(page, /^1\.00/); await top(); await kb(page, /Summon with/); await waitText(page, 'You have chipped in'); await check(page, 'gj funded'); });
  await step('seat', async () => {
    await go(page, '/grand-jury/case/107'); await top(); await kb(page, /Volunteer for the jury/); await waitText(page, 'Juror Screening');
    await top(); await kb(page, /Verify with World ID/); await waitText(page, 'A seat is offered to you');
    await check(page, 'gj offer');
    await top(); await kb(page, /I swear to show up/); await waitText(page, 'Seal your ballot', 30000);
  });
  await step('trial-roam', async () => { await roam(page, 'gj'); });
  await step('seal', async () => { await top(); await kb(page, /PINEAPPLE BELONGS/); await top(); await kb(page, /Seal my ballot/); await waitText(page, 'Secret Verdict Scroll'); await check(page, 'gj sealed'); });
  await step('reveal', async () => { await top(); await kb(page, /Skip to the deadline/); await waitText(page, 'Open your scroll', 30000); await top(); await kb(page, /Open my scroll/); await waitText(page, 'Your vote is counted'); });
  await step('settle', async () => { await top(); await kb(page, /Skip to the deadline/); await waitText(page, 'Settle the case', 30000); await top(); await kb(page, /Settle and read the verdict/); await waitText(page, 'strangers agreed', 30000); await sleep(1200); await shot(page, '02-verdict'); await check(page, 'gj verdict'); });
  await step('claim', async () => { await top(); await kb(page, /^Collect /); await waitText(page, 'Collected'); });
  await step('duty', async () => { await top(); await kb(page, /^My court$/); await waitText(page, 'Jury seats'); await check(page, 'gj duty'); await shot(page, '03-duty'); });
}

if (flow === 'versus') {
  const A = page;
  await step('A files', async () => {
    await go(A, '/versus'); await top(A); await kb(A, /Start a Versus case/); await waitText(A, 'Case title');
    await top(A); await kbType(A, /^Case title/, 'The Last Dumpling');
    await top(A); await kb(A, /NPC Behavior/);
    await top(A); await kb(A, /Brief Agent A/);
    for (const [label, text] of [[/^Your answer$/, 'We agreed to split the last dumpling. I went to get napkins and came back to an empty plate.'], [/^Your answer$/, 'A split is a contract. Napkin duty is a public service.'], [/^Your answer \(private\)/, 'This is the third dumpling incident this year.']]) {
      await top(A); await kbType(A, label, text); await top(A); await kb(A, /^Send$/); await sleep(1200);
    }
    await waitText(A, 'Write my own');
    await top(A); await kb(A, /A deal is a deal/);
    await top(A); await kb(A, /Review my brief/); await waitText(A, 'What the jury will read');
    await top(A); await kbType(A, /Nickname on the verdict/, 'Napkin Knight');
    await check(A, 'versus review');
    await top(A); await kb(A, /File & get invite/); await waitText(A, 'Verify & file');
    await top(A); await kb(A, /Verify & file/); await waitText(A, 'Invite code', 20000);
    await shot(A, '01-invite');
  });
  const link = await A.evaluate(() => { const m = document.body.innerText.match(/https?:\/\/\S*\/versus\/join\/[\w-]+/i); return m?.[0]; });
  log.push(`invite link found: ${!!link}`);
  const B = await ctx.newPage(); watch(B, errors, 'B ');
  await step('B joins', async () => {
    await B.goto(link.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' }); await waitText(B, 'Accept & become Side B');
    await top(B); await kb(B, /Accept & become Side B/); await top(B); await kb(B, /Verify & accept/); await waitText(B, 'Private briefing with Agent B');
    for (const text of ['The dumpling was going cold. Leaving food unattended is a forfeit.', 'Hot food waits for no one.']) { await top(B); await kbType(B, /^Your answer$/, text); await top(B); await kb(B, /^Send$/); await sleep(1200); }
    await top(B); await kb(B, /^Skip$/); await waitText(B, 'Write my own');
    await top(B); await kb(B, /A deal is a deal/); await top(B); await kb(B, /Review my brief/); await top(B); await kb(B, /Save my brief/); await waitText(B, 'Approve my brief');
    await top(B); await kb(B, /Approve my brief/);
  }, B);
  await step('approve+fund', async () => {
    await A.bringToFront(); await A.reload({ waitUntil: 'networkidle' }); await top(A); await kb(A, /Approve my brief/);
    await waitText(A, 'Approve the draft', 90000); await top(A); await kb(A, /Approve the draft/);
    await B.bringToFront(); await B.reload({ waitUntil: 'networkidle' }); await top(B); await kb(B, /Approve the draft/); await waitText(B, 'Pay your half');
    await top(B); await kb(B, /Get test USDC/); await sleep(800); await top(B); await kb(B, /Pay 0\.70/);
    await A.bringToFront(); await A.reload({ waitUntil: 'networkidle' }); await waitText(A, 'Pay your half'); await top(A); await kb(A, /Get test USDC/); await sleep(800); await top(A); await kb(A, /Pay 0\.70/);
    await waitText(A, 'Jury selection', 20000); await check(A, 'versus jury selection');
  });
  const J = await ctx.newPage(); watch(J, errors, 'J ');
  await step('juror', async () => {
    await J.goto(A.url(), { waitUntil: 'networkidle' }); await waitText(J, 'I swear to show up');
    await top(J); await kb(J, /Get test USDC for the bond/); await sleep(800);
    await top(J); await kb(J, /I swear to show up/); await top(J); await kb(J, /Verify & post/);
    await A.bringToFront(); await A.reload({ waitUntil: 'networkidle' }); await top(A); await kb(A, /Seat simulated jurors/);
    await J.bringToFront(); await J.reload({ waitUntil: 'networkidle' }); await waitText(J, 'Secret Verdict Scroll', 30000);
  }, J);
  await step('trial-roam', async () => {
    const shown = await J.locator('[role="application"]').count();
    if (!shown) { await top(J); await kb(J, /Play the trial|Watch the trial/).catch((e) => log.push('no play-trial control: ' + e.message.slice(0, 300))); }
    await roam(J, 'versus');
  }, J);
  await step('vote+verdict', async () => {
    await top(J); await kb(J, /SIDE B/); await top(J); await kb(J, /Seal my Secret Verdict Scroll/);
    await A.bringToFront(); await A.reload({ waitUntil: 'networkidle' }); await top(A); await kb(A, /Skip to the deadline/);
    await J.bringToFront(); await J.reload({ waitUntil: 'networkidle' }); await waitText(J, 'Open my scroll', 30000); await top(J); await kb(J, /Open my scroll/);
    await A.bringToFront(); await A.reload({ waitUntil: 'networkidle' });
    if (!(await A.evaluate(() => document.body.innerText.includes('The jury has spoken')))) { await top(A); await kb(A, /Skip to the deadline/); }
    await waitText(A, 'The jury has spoken', 40000); await sleep(1200); await shot(A, '02-verdict'); await check(A, 'versus verdict');
  }, A);
  await step('cases', async () => { await go(A, '/versus/cases'); await check(A, 'versus cases'); await shot(A, '03-cases'); });
}

console.log(JSON.stringify({ flow, width: W, log, axe: axeHits, errors: [...new Set(errors)].slice(0, 20) }, null, 1));
await browser.close();

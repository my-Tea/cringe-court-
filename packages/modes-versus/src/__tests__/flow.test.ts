import { ManualClock, MemorySaltVault, MockIdentity, testAddress } from '@cringe-court/core/testing';
import { formatUsdc, usdc, type Hex } from '@cringe-court/core';
import { describe, expect, it } from 'vitest';
import { prepareBriefing } from '../briefing';
import { VersusCounsel } from '../counsel';
import { VersusDesk, demoJurorAccount } from '../desk';
import { MemoryFactStore, decodeFacts, encodeFacts } from '../store';
import { claimable, nextStep, sideStatus, viewerOf, visibleBrief } from '../view';
import { World } from '../world';
import { shareCardModel } from '../share';

function rig() {
  const clock = new ManualClock(1_767_225_600);
  const store = new MemoryFactStore();
  const counsel = new VersusCounsel();
  let r = 0;
  const random = () => ((r = (r * 9301 + 49297) % 233280), r / 233280);
  const desk = (name: string, human: string) =>
    new VersusDesk({
      store,
      persona: { id: `p-${name}`, name, account: testAddress(name) },
      counsel,
      identity: new MockIdentity({ human }),
      salts: new MemorySaltVault(`salt-${name}`),
      clock: clock.now,
      random,
    });
  return { clock, store, counsel, a: desk('alice', 'human-a'), b: desk('bob', 'human-b'), j: desk('juror', 'human-j') };
}

const briefA = prepareBriefing({
  happened: 'We agreed to split the last dumpling. I went for napkins and came back to an empty plate. Call me at 555-123-4567.',
  why: 'A split is a contract. Napkin duty is a public service, not abandonment.',
  privateNotes: 'SECRET-A: this is the third dumpling incident this year.',
  angle: 'A deal is a deal.',
  nickname: 'Napkin Knight',
});
const briefB = prepareBriefing({
  happened: 'The dumpling was going cold. Leaving food unattended is a forfeit, everyone knows that.',
  why: 'Hot food waits for no one. I saved it from a tragic, lukewarm fate.',
  privateNotes: 'SECRET-B: I had already eaten four.',
  angle: 'Hot food waits for no one.',
  nickname: '',
});

async function toFunding(t: ReturnType<typeof rig>) {
  const { a, b } = t;
  const { trialId, code } = await a.fileCase({ title: 'The Last Dumpling', category: 'dating-crimes', patch: briefA.patch });
  expect((await b.findByCode(code))?.trialId).toBe(trialId);
  await b.acceptInvite(trialId);
  await b.saveBrief(trialId, 'b', briefB.patch);
  await a.addExhibit(trialId, 'a', { title: 'Group chat', body: 'me: splitting it 50/50 ok? them: deal' });
  await b.addExhibit(trialId, 'b', { title: 'Thermometer', body: 'Dumpling at 31°C, well below serving temperature.' });
  await a.approveBrief(trialId, 'a');
  await b.approveBrief(trialId, 'b');
  await a.runCounsel(trialId);
  await a.approveDraft(trialId, 'a');
  await b.approveDraft(trialId, 'b');
  return trialId;
}

describe('Versus end to end', () => {
  it('runs invite → briefs → counsel → funding → jury → verdict → claims, with exact money', async () => {
    const t = rig();
    const { a, b, j, clock, store } = t;
    await a.faucet(usdc('5.00'));
    await b.faucet(usdc('5.00'));
    await j.faucet(usdc('5.00'));
    const trialId = await toFunding(t);

    let w = await a.world();
    let c = w.case(trialId)!;
    expect(c.state.stage).toBe('counsel');
    expect(c.caseNumber).toBe(69);
    expect(nextStep(c, 'a', a.account).label).toMatch(/Pay your half/);

    await a.fund(trialId);
    await b.fund(trialId);
    w = await a.world();
    c = w.case(trialId)!;
    expect(c.state.stage).toBe('jury');
    expect(formatUsdc(await w.chain.usdcBalance(a.account))).toBe('4.30 USDC');

    // A party cannot sit on their own jury, even through World ID.
    await expect(a.takeSeat(trialId)).rejects.toThrow(/party/);

    await j.takeSeat(trialId);
    await a.seatDemoJurors(trialId, 'reliable');
    w = await a.world();
    c = w.case(trialId)!;
    expect(c.state.stage === 'jury' && c.state.step).toBe('commit');
    expect(viewerOf(c, j.account)).toBe('juror');

    await j.commitBallot(trialId, 1);
    clock.advance(30);
    await a.tick();
    w = await a.world();
    c = w.case(trialId)!;
    const seats = c.state.stage === 'jury' ? c.state.seats : [];
    expect(seats.filter((x) => x.committed)).toHaveLength(3);
    // Commit never reveals choices.
    expect(seats.every((x) => x.choice === undefined)).toBe(true);

    await a.skipAhead(trialId);
    await j.revealBallot(trialId);
    clock.advance(30);
    await a.tick();
    await a.skipAhead(trialId);
    await a.tick(); // finalize
    await a.tick(); // sentence
    w = await a.world();
    c = w.case(trialId)!;
    expect(c.state.stage).toBe('verdict');
    if (c.state.stage !== 'verdict') return;
    expect(c.state.verdict.completedDuty).toBe(3);
    expect(c.state.sentence?.speaker).toBe('judge');
    expect(w.desyncs).toEqual([]);

    // Every party and juror can claim; the claims drain escrow exactly.
    for (const d of [a, b, j]) {
      const owed = claimable(c, d.account);
      if (owed > 0n) await d.claim(trialId);
    }
    for (const bot of [2, 3].map((seat) => demoJurorAccount(trialId, seat))) expect(claimable(c, bot)).toBeGreaterThan(0n);
    w = await a.world();
    c = w.case(trialId)!;
    expect(claimable(c, j.account)).toBe(0n);
    const jurorBalance = await w.chain.usdcBalance(j.account);
    const won = c.state.stage === 'verdict' && c.state.verdict.kind !== 'no-verdict';
    expect(formatUsdc(jurorBalance)).toBe(won ? '5.30 USDC' : '5.20 USDC');

    const card = shareCardModel(c)!;
    expect(card.caseLabel).toBe('CASE #0069');
    expect(JSON.stringify(card)).not.toMatch(/SECRET|0x[0-9a-f]{40}/i);

    // The whole log survives JSON (bigints included) and replays to the same world.
    const again = await World.replay(decodeFacts(encodeFacts(store.read())));
    expect(again.case(trialId)!.state.stage).toBe('verdict');
  });

  it('keeps each side’s private notes away from the other bench, the transcript and the other side', async () => {
    const t = rig();
    const trialId = await toFunding(t);
    const req = t.counsel.requests[0]!;
    expect(req.briefs[0].privateNotes).toContain('SECRET-A');
    expect(req.briefs[1].privateNotes).toContain('SECRET-B');
    expect(JSON.stringify(req.briefs[0])).not.toContain('SECRET-B');
    expect(JSON.stringify(req.briefs[1])).not.toContain('SECRET-A');
    const c = (await t.a.world()).case(trialId)!;
    const lines = c.state.stage === 'counsel' ? c.state.transcript!.lines : [];
    expect(lines.length).toBeGreaterThan(8);
    expect(lines.map((l) => l.text).join(' ')).not.toMatch(/SECRET/);
    expect(visibleBrief(c, 'b', 'a')).toEqual({ story: expect.any(String), nickname: 'Napkin Knight' });
    expect(visibleBrief(c, 'a', 'a')?.privateNotes).toContain('SECRET-A');
    expect(visibleBrief(c, 'juror', 'b')?.privateNotes).toBeUndefined();
    // Redaction ran before anything was written.
    expect(c.state.filing.sides.a?.story).toContain('[number removed]');
  });

  it('refunds the side that paid when the other side misses the funding deadline', async () => {
    const t = rig();
    await t.a.faucet(usdc('2.00'));
    const trialId = await toFunding(t);
    await t.a.fund(trialId);
    t.clock.advance(16 * 60);
    let c = (await t.a.world()).case(trialId)!;
    expect(c.state.stage).toBe('closed');
    if (c.state.stage === 'closed') expect(c.state.reason).toBe('funding-missed');
    expect(formatUsdc(claimable(c, t.a.account))).toBe('0.70 USDC');
    expect(claimable(c, t.b.account)).toBe(0n);
    await t.a.claim(trialId);
    const w = await t.a.world();
    c = w.case(trialId)!;
    expect(formatUsdc(await w.chain.usdcBalance(t.a.account))).toBe('2.00 USDC');
    expect(w.desyncs).toEqual([]);
  });

  it('charges nobody when Side B never answers (D6), and enforces the open-invite limit', async () => {
    const t = rig();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await t.a.fileCase({ title: `Case ${i}`, category: 'npc-behavior', patch: briefA.patch })).trialId);
    await expect(t.a.fileCase({ title: 'One too many', category: 'npc-behavior', patch: briefA.patch })).rejects.toThrow(/3 invites/);
    t.clock.advance(16 * 60);
    const w = await t.a.world();
    for (const id of ids) {
      const s = w.case(id)!.state;
      expect(s.stage === 'closed' && s.reason).toBe('consent-missed');
    }
    expect(await w.chain.usdcBalance(t.a.account)).toBe(0n);
    await expect(t.a.fileCase({ title: 'Fresh start', category: 'npc-behavior', patch: briefA.patch })).resolves.toBeTruthy();
  });

  it('refunds both sides and returns bonds when the jury never fills', async () => {
    const t = rig();
    await t.a.faucet(usdc('1.00'));
    await t.b.faucet(usdc('1.00'));
    await t.j.faucet(usdc('1.00'));
    const trialId = await toFunding(t);
    await t.a.fund(trialId);
    await t.b.fund(trialId);
    await t.j.takeSeat(trialId);
    await t.a.skipAhead(trialId);
    const c = (await t.a.world()).case(trialId)!;
    expect(c.state.stage === 'closed' && c.state.reason).toBe('jury-unfilled');
    expect(formatUsdc(claimable(c, t.a.account))).toBe('0.70 USDC');
    expect(formatUsdc(claimable(c, t.b.account))).toBe('0.70 USDC');
    expect(formatUsdc(claimable(c, t.j.account))).toBe('0.40 USDC');
  });

  it('ends in NO VERDICT with full refunds when two demo jurors miss the reveal', async () => {
    const t = rig();
    await t.a.faucet(usdc('1.00'));
    await t.b.faucet(usdc('1.00'));
    await t.j.faucet(usdc('1.00'));
    const trialId = await toFunding(t);
    await t.a.fund(trialId);
    await t.b.fund(trialId);
    await t.j.takeSeat(trialId);
    await t.a.seatDemoJurors(trialId, 'two-no-shows');
    await t.j.commitBallot(trialId, 0);
    t.clock.advance(30);
    await t.a.tick();
    await t.a.skipAhead(trialId);
    await t.j.revealBallot(trialId);
    await t.a.skipAhead(trialId);
    await t.a.tick();
    const c = (await t.a.world()).case(trialId)!;
    expect(c.state.stage).toBe('verdict');
    if (c.state.stage !== 'verdict') return;
    expect(c.state.verdict.kind).toBe('no-verdict');
    expect(formatUsdc(claimable(c, t.a.account))).toBe('0.70 USDC');
    expect(formatUsdc(claimable(c, t.b.account))).toBe('0.70 USDC');
    // Timely juror: bond back + failed-trial bonus from the forfeits.
    expect(formatUsdc(claimable(c, t.j.account))).toBe('0.60 USDC');
    expect(c.state.settlement.protocol.forfeits).toBe(usdc('0.60'));
  });

  it('lets a side withdraw before paying, and tracks who approved what', async () => {
    const t = rig();
    const { trialId } = await t.a.fileCase({ title: 'Pineapple', category: 'internet-crimes', patch: briefA.patch });
    await t.b.acceptInvite(trialId);
    let c = (await t.a.world()).case(trialId)!;
    expect(sideStatus(c, 'a').briefed).toBe(true);
    expect(sideStatus(c, 'b').briefed).toBe(false);
    expect(visibleBrief(c, 'a', 'b')).toBeNull();
    expect(visibleBrief(c, 'b', 'a')?.story).toBeTruthy();
    expect(visibleBrief(c, 'invitee', 'a')).toBeNull();
    await expect(t.a.approveBrief(trialId, 'a')).rejects.toThrow(/Side B has no story/);
    await t.b.saveBrief(trialId, 'b', briefB.patch);
    await t.a.approveBrief(trialId, 'a');
    c = (await t.a.world()).case(trialId)!;
    expect(sideStatus(c, 'a').approvedBrief).toBe(true);
    await t.b.saveBrief(trialId, 'b', { ...briefB.patch, nickname: 'Hot Take' });
    c = (await t.a.world()).case(trialId)!;
    expect(sideStatus(c, 'a').approvedBrief).toBe(false);
    await t.b.withdraw(trialId, 'b');
    c = (await t.a.world()).case(trialId)!;
    expect(c.state.stage === 'closed' && c.state.reason).toBe('withdrawn');
    expect(c.withdrawnBy).toBe('b');
  });

  it('rejects the same human as both sides', async () => {
    const t = rig();
    const twin = new VersusDesk({
      store: t.store,
      persona: { id: 'p-twin', name: 'twin', account: testAddress('alice-2') as Hex },
      counsel: t.counsel,
      identity: new MockIdentity({ human: 'human-a' }),
      salts: new MemorySaltVault(),
      clock: t.clock.now,
    });
    const { trialId } = await t.a.fileCase({ title: 'Self-own', category: 'internet-crimes', patch: briefA.patch });
    await expect(twin.acceptInvite(trialId)).rejects.toThrow(/cannot also be Side B/);
  });
});

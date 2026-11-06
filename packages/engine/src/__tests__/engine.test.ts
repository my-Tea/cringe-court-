import { MockIdentity, createMockPorts, testAddress, type MockPorts } from '@cringe-court/core/testing';
import { BASE_MODES as MODES_DEF, formatUsdc, trialId, usdc, type BallotChoice, type ModeId } from '@cringe-court/core';
import { describe, expect, it } from 'vitest';
import { EngineError, JurorSession, TrialEngine } from '../index';

const A = testAddress('side-a');
const B = testAddress('side-b');
const jurors = [1, 2, 3, 4, 5, 6, 7].map((i) => testAddress(`juror-${i}`));

function setup(mode: ModeId, counsel = {}) {
  const ports = createMockPorts({ counsel });
  for (const who of [A, B, ...jurors]) ports.chain.mint(who, usdc('20'));
  const engine = new TrialEngine({
    id: trialId(`case-${mode}`),
    mode: MODES_DEF[mode],
    ports: { counsel: ports.counsel, chain: ports.chain.as(A) },
    category: 'internet-crimes',
    title: 'Replied-all with a meme',
    filer: mode === 'grand-jury' ? null : A,
    clock: ports.clock.now,
  });
  return { ports, engine };
}

function juror(ports: MockPorts, i: number, caseNumber: number) {
  return new JurorSession({
    caseNumber: caseNumber as never,
    ports: { chain: ports.chain.as(jurors[i]!), identity: new MockIdentity({ human: `human-${i}` }), salts: ports.salts },
    clock: ports.clock.now,
  });
}

async function seatAndVote(ports: MockPorts, engine: TrialEngine, votes: (BallotChoice | null)[]) {
  const n = engine.caseNumber!;
  const sessions = votes.map((_, i) => juror(ports, i, n));
  for (const s of sessions) {
    expect((await s.screen()).ok).toBe(true);
    expect(await s.takeSeat()).toMatchObject({ ok: true });
  }
  await engine.sync();
  expect(engine.state).toMatchObject({ stage: 'jury', step: 'commit' });
  for (const [i, s] of sessions.entries()) if (votes[i] !== null) expect((await s.commit(votes[i]!)).ok).toBe(true);
  const st = engine.state;
  if (st.stage === 'jury') expect(st.seats.every((x) => x.choice === undefined)).toBe(true);
  ports.clock.advance(st.terms.deadlines.commit);
  await engine.tick();
  expect(engine.state).toMatchObject({ stage: 'jury', step: 'reveal' });
  for (const [i, s] of sessions.entries()) if (votes[i] !== null) expect((await s.reveal()).ok).toBe(true);
  ports.clock.advance(st.terms.deadlines.reveal);
  await engine.tick();
  return sessions;
}

describe('TrialEngine × mock ports: Solo end to end', () => {
  it('files, drafts, freezes, funds, seats, votes, settles, sentences and shares', async () => {
    const { ports, engine } = setup('solo');
    engine.editFiling('a', { story: 'I replied-all to 400 people with a frog meme.', privateNotes: 'It was my boss’s retirement thread', angle: 'The frog was a tribute.' });
    engine.submitFiling();
    engine.addExhibit({ id: 'x1', submittedBy: 'a', kind: 'quote', title: 'The frog', body: 'ribbit', redacted: true });
    await engine.approveEvidence('a');
    expect(engine.state).toMatchObject({ stage: 'counsel', step: 'review' });

    // D1 information wall: the NPC prosecutor's brief carries no private notes.
    const req = ports.counsel.requests[0]!;
    expect(JSON.stringify(req.briefs[0])).not.toContain('retirement');
    expect(req.briefs[1].privateNotes).toContain('retirement');

    await engine.approveDraft('a');
    expect(engine.caseLabel).toBe('CASE #0069');
    await engine.fund();
    expect(engine.state).toMatchObject({ stage: 'jury', step: 'recruiting' });

    const sessions = await seatAndVote(ports, engine, [0, 1, 0]);
    expect(engine.state).toMatchObject({ stage: 'verdict', verdict: { label: 'GUILTY', tally: [2, 1], completedDuty: 3 } });
    const line = await engine.readSentence();
    expect(line?.speaker).toBe('judge');
    engine.share('image');
    expect(engine.state.stage).toBe('share');

    const claim = await sessions[0]!.claim();
    expect(claim.ok && claim.value.map((l) => l.kind)).toEqual(['bond-returned', 'reward']);
    expect(formatUsdc(await ports.chain.usdcBalance(jurors[0]!))).toBe('20.30 USDC');
    expect(engine.ignored).toEqual([]);
  });

  it('a no-show and a split vote ends NO VERDICT with a full refund to the filer', async () => {
    const { ports, engine } = setup('solo');
    engine.editFiling('a', { story: 'I tipped 0%.' });
    engine.submitFiling();
    await engine.approveEvidence('a');
    await engine.approveDraft('a');
    await engine.fund();
    await seatAndVote(ports, engine, [0, 1, null]);
    expect(engine.state).toMatchObject({ stage: 'verdict', verdict: { kind: 'no-verdict', label: 'NO VERDICT' } });
    await ports.chain.as(A).claim(engine.caseNumber!);
    expect(await ports.chain.usdcBalance(A)).toBe(usdc('20'));
  });

  it('cancels as "AI could not prepare a fair case" after the automatic redraft also fails balance', async () => {
    const { engine } = setup('solo', { unbalancedDrafts: 2 });
    engine.editFiling('a', { story: 'x' });
    engine.submitFiling();
    await engine.approveEvidence('a');
    expect(engine.state).toMatchObject({ stage: 'closed', reason: 'ai-unfair' });
  });

  it('recovers when the first draft is unbalanced: one automatic redraft of the weaker bench', async () => {
    const { ports, engine } = setup('solo', { unbalancedDrafts: 1 });
    engine.editFiling('a', { story: 'x' });
    engine.submitFiling();
    await engine.approveEvidence('a');
    expect(engine.state).toMatchObject({ stage: 'counsel', step: 'review', attempt: 2 });
    expect(ports.counsel.requests[1]).toMatchObject({ redraft: 1, attempt: 2 });
  });

  it('refunds when the jury does not fill in time', async () => {
    const { ports, engine } = setup('solo');
    engine.editFiling('a', { story: 'x' });
    engine.submitFiling();
    await engine.approveEvidence('a');
    await engine.approveDraft('a');
    await engine.fund();
    ports.clock.advance(engine.state.terms.deadlines.recruitment);
    await engine.tick();
    expect(engine.state).toMatchObject({ stage: 'closed', reason: 'jury-unfilled' });
    const s = engine.state;
    if (s.stage === 'closed') expect(s.settlement?.statements.find((x) => x.party === A.toLowerCase())?.payout).toBe(usdc('1.20'));
  });

  it('rejected intents throw EngineError and leave the state alone', () => {
    const { engine } = setup('solo');
    const before = engine.state;
    expect(() => engine.submitFiling()).toThrow(EngineError);
    expect(engine.state).toBe(before);
  });
});

describe('Versus and Grand Jury', () => {
  it('Versus: both sides consent, approve and pay 0.70 each', async () => {
    const { ports, engine } = setup('versus');
    engine.editFiling('a', { story: 'They ate my leftovers.', privateNotes: 'A-SECRET' });
    engine.submitFiling();
    engine.consent('b', B);
    engine.editFiling('b', { story: 'Fridge food is communal.', privateNotes: 'B-SECRET' });
    await engine.approveEvidence('a');
    await engine.approveEvidence('b');
    const req = ports.counsel.requests[0]!;
    expect(JSON.stringify(req.briefs[0])).not.toContain('B-SECRET');
    expect(JSON.stringify(req.briefs[1])).not.toContain('A-SECRET');
    await engine.approveDraft('a');
    await engine.approveDraft('b');
    await engine.fund();
    expect(engine.state).toMatchObject({ stage: 'counsel', step: 'funding' });
    const sideB = new TrialEngine({ id: trialId('case-versus-b'), mode: MODES_DEF.versus, ports: { counsel: ports.counsel, chain: ports.chain.as(B) }, category: 'internet-crimes', filer: A, clock: ports.clock.now, resume: engine.state });
    await sideB.fund();
    await engine.sync();
    expect(engine.state).toMatchObject({ stage: 'jury', step: 'recruiting' });
    expect(formatUsdc(await ports.chain.usdcBalance(B))).toBe('19.30 USDC');
    // Parties cannot sit on their own jury.
    await expect(ports.chain.as(B).acceptSeat(engine.caseNumber!, `0x${'09'.repeat(32)}`)).rejects.toThrow(/own jury/);
    await seatAndVote(ports, engine, [1, 1, 0]);
    expect(engine.state).toMatchObject({ stage: 'verdict', verdict: { label: 'SIDE B' } });
  });

  it('Grand Jury: crowdfund, 7 jurors, 4 matching to win', async () => {
    const { ports, engine } = setup('grand-jury');
    engine.editCase({ context: 'Reviewed context card: is a hot dog a sandwich?', title: 'Is a hot dog a sandwich?' });
    engine.submitFiling();
    await engine.approveEvidence('court');
    await engine.approveDraft('court');
    await engine.fund(usdc('7.30'));
    expect(engine.state).toMatchObject({ stage: 'jury' });
    await seatAndVote(ports, engine, [0, 0, 0, 1, 1, 1, 0]);
    expect(engine.state).toMatchObject({ stage: 'verdict', verdict: { label: 'FOR', tally: [4, 3] } });
  });
});

describe('JurorSession unhappy paths', () => {
  it('surfaces World ID cancel / not verified / conflict, and a missing salt', async () => {
    const ports = createMockPorts();
    const id = new MockIdentity({ human: 'party', behaviour: 'cancelled' });
    const s = new JurorSession({ caseNumber: 69 as never, ports: { chain: ports.chain.as(jurors[0]!), identity: id, salts: ports.salts } });
    expect(await s.screen()).toMatchObject({ ok: false, step: 'screen', reason: 'cancelled' });
    id.behaviour = 'not-verified';
    expect(await s.screen()).toMatchObject({ ok: false, reason: 'not-verified' });
    id.behaviour = 'verified';
    const conflicted = new JurorSession({
      caseNumber: 69 as never,
      ports: { chain: ports.chain.as(jurors[0]!), identity: id, salts: ports.salts },
      exclude: [MockIdentity.nullifierFor('party', { action: 'accept-jury-seat', signal: 'case:69:seat' })],
    });
    expect(await conflicted.screen()).toMatchObject({ ok: false, reason: 'conflicted' });
    expect(await s.takeSeat()).toMatchObject({ ok: false, reason: 'not-screened' });
    expect(await s.reveal()).toMatchObject({ ok: false, reason: 'salt-missing' });
  });
});


import { describe, expect, it } from 'vitest';
import {
  BASE_MODES,
  TRIAL_MACHINE,
  TRIAL_STAGES,
  acceptedEvents,
  activeDeadline,
  caseNumber,
  chainPhaseOf,
  createTrial,
  hashTranscript,
  settle,
  transition,
  trialId,
  usdc,
  type CounselDraft,

  type ModeId,
  type TrialEvent,
  type TrialState,
} from '../index';
import { FixtureCounsel, testAddress } from '../testing';

const T0 = 1_767_225_600;
const A = testAddress('side-a');
const B = testAddress('side-b');
const jurors = [1, 2, 3, 4, 5, 6, 7].map((i) => testAddress(`juror-${i}`));

function start(mode: ModeId): TrialState {
  const def = BASE_MODES[mode];
  return createTrial({
    id: trialId(`t-${mode}`),
    mode,
    terms: def.terms(),
    rules: def.rules,
    benches: def.benches,
    category: 'internet-crimes',
    title: 'Replied-all to the whole company',
    filer: mode === 'grand-jury' ? null : A,
    now: T0,
  });
}

/** Apply events, failing the test on the first rejection. */
function run(state: TrialState, events: (TrialEvent | [TrialEvent, number])[]): TrialState {
  let s = state;
  let now = s.updatedAt;
  for (const item of events) {
    const [event, at] = Array.isArray(item) ? item : [item, now];
    now = at;
    const r = transition(s, event, { now });
    if (!r.ok) throw new Error(`${r.error.event}: ${r.error.message}`);
    s = r.state;
  }
  return s;
}

function rejects(state: TrialState, event: TrialEvent, now = state.updatedAt) {
  const r = transition(state, event, { now });
  expect(r.ok).toBe(false);
  return r.ok ? null : r.error;
}

async function draftFor(state: TrialState): Promise<CounselDraft> {
  if (state.stage !== 'counsel') throw new Error('not in counsel');
  const counsel = new FixtureCounsel();
  return counsel.draft({
    trialId: state.id,
    mode: state.mode,
    category: state.filing.category,
    title: state.filing.title,
    ballot: state.terms.ballot,
    benches: state.benches,
    briefs: [
      { choice: 0, role: 'prosecution', counsel: state.benches[0].counsel, client: state.benches[0].client, publicText: 'They replied all.' },
      { choice: 1, role: 'defense', counsel: state.benches[1].counsel, client: state.benches[1].client, publicText: 'It was a test.' },
    ],
    exhibits: [],
    scope: 'full',
    payer: ['platform', 'platform'],
    budget: { maxInputTokens: 1200, maxOutputTokens: 400 },
    attempt: state.attempt,
  });
}

const ok = { ok: true, scores: [1, 0.9] as const, reasons: [] };

async function soloToFunding(): Promise<TrialState> {
  let s = run(start('solo'), [
    { type: 'FILING_EDITED', side: 'a', patch: { story: 'I replied-all with a meme.', angle: 'It was a bullish keyboard.' } },
    { type: 'FILING_SUBMITTED' },
    { type: 'EXHIBIT_ADDED', exhibit: { id: 'x1', submittedBy: 'a', kind: 'quote', title: 'The meme', body: 'lol', redacted: true } },
    { type: 'EVIDENCE_APPROVED', by: 'a' },
  ]);
  s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: ok }, { type: 'DRAFT_APPROVED', by: 'a' }]);
  return s;
}

function seatAndVote(s: TrialState, n: number, votes: (0 | 1 | null)[], t: number): TrialState {
  s = run(s, jurors.slice(0, n).map((account) => ({ type: 'SEAT_FILLED', account }) as TrialEvent));
  expect(s).toMatchObject({ stage: 'jury', step: 'briefing' });
  s = run(s, [{ type: 'COURT_OPENED', commitEndsAt: t + 1200, revealEndsAt: t + 1800 }]);
  s = run(s, votes.flatMap((v, i) => (v === null ? [] : [{ type: 'BALLOT_COMMITTED', account: jurors[i]! } as TrialEvent])));
  s = run(s, [[{ type: 'DEADLINE_PASSED', deadline: 'commit' }, t + 1200]]);
  s = run(s, votes.flatMap((v, i) => (v === null ? [] : [{ type: 'BALLOT_REVEALED', account: jurors[i]!, choice: v } as TrialEvent])));
  return run(s, [[{ type: 'DEADLINE_PASSED', deadline: 'reveal' }, t + 1800]]);
}

describe('machine table', () => {
  it('lists every stage, and closed accepts only REFUNDED', () => {
    expect(Object.keys(TRIAL_MACHINE).sort()).toEqual([...TRIAL_STAGES].sort());
    expect(Object.keys(TRIAL_MACHINE.closed)).toEqual(['REFUNDED']);
  });

  it('rejects events a stage does not accept, without touching state', () => {
    const s = start('solo');
    const err = rejects(s, { type: 'BALLOT_COMMITTED', account: A });
    expect(err).toMatchObject({ code: 'not-accepted', stage: 'filing' });
    expect(acceptedEvents(s)).toContain('FILING_SUBMITTED');
  });
});

describe('Solo: filing → evidence → counsel → jury → verdict → share', () => {
  it('walks the happy path and maps every step to the chain phase', async () => {
    let s = start('solo');
    expect(chainPhaseOf(s)).toBe('draft');
    s = await soloToFunding();
    expect(s).toMatchObject({ stage: 'counsel', step: 'funding' });
    if (s.stage !== 'counsel' || !s.transcript) throw new Error();
    expect(s.transcript.hash).toBe(hashTranscript(s.transcript.lines));
    expect(rejects(s, { type: 'CASE_OPENED', caseNumber: caseNumber(69), transcriptHash: '0xdead' })?.message).toMatch(/different transcript/);
    s = run(s, [
      { type: 'CASE_OPENED', caseNumber: caseNumber(69), transcriptHash: s.transcript.hash },
      { type: 'FUNDS_DEPOSITED', deposit: { account: A, kind: 'filer', amount: usdc('1.20') } },
    ]);
    expect(s).toMatchObject({ stage: 'jury', step: 'recruiting' });
    expect(chainPhaseOf(s)).toBe('recruiting');
    expect(rejects(s, { type: 'SEAT_FILLED', account: A })?.message).toMatch(/own jury/);

    s = seatAndVote(s, 3, [0, 0, 1], T0);
    expect(s).toMatchObject({ stage: 'jury', step: 'finalizing' });
    if (s.stage !== 'jury') throw new Error();
    const settlement = settle({
      terms: s.terms,
      funders: s.deposits,
      jurors: s.seats.map((x) => ({ account: x.account, committed: x.committed, revealed: x.revealed, choice: x.choice! })),
      outcome: 'trial',
    });
    s = run(s, [{ type: 'VERDICT_RECORDED', settlement }]);
    expect(s).toMatchObject({ stage: 'verdict', verdict: { label: 'GUILTY', tally: [2, 1] } });
    expect(chainPhaseOf(s)).toBe('settled');
    s = run(s, [
      { type: 'SENTENCE_READ', line: { id: 'S01', speaker: 'judge', segment: 'sentence', text: 'Log off.' } },
      { type: 'SHARED', channel: 'image' },
      { type: 'SHARED', channel: 'link' },
    ]);
    expect(s).toMatchObject({ stage: 'share' });
    if (s.stage === 'share') expect(s.shares).toHaveLength(2);
    expect(s.history.length).toBeGreaterThan(15);
  });

  it('never stores a choice before reveal (sealed ballots)', async () => {
    let s = await soloToFunding();
    if (s.stage !== 'counsel' || !s.transcript) throw new Error();
    s = run(s, [
      { type: 'CASE_OPENED', caseNumber: caseNumber(70), transcriptHash: s.transcript.hash },
      { type: 'FUNDS_DEPOSITED', deposit: { account: A, kind: 'filer', amount: usdc('1.20') } },
      ...jurors.slice(0, 3).map((account) => ({ type: 'SEAT_FILLED', account }) as TrialEvent),
      { type: 'COURT_OPENED', commitEndsAt: T0 + 100, revealEndsAt: T0 + 200 },
      { type: 'BALLOT_COMMITTED', account: jurors[0]! },
    ]);
    if (s.stage !== 'jury') throw new Error();
    expect(s.seats.every((x) => x.choice === undefined)).toBe(true);
    expect(rejects(s, { type: 'BALLOT_REVEALED', account: jurors[0]!, choice: 1 })?.message).toMatch(/reveal window/);
    expect(rejects(s, { type: 'DEADLINE_PASSED', deadline: 'commit' }, T0 + 50)?.message).toMatch(/still open/);
  });

  it('enforces D2: angle ≤ 140 chars, one redraft', async () => {
    const s0 = run(start('solo'), [{ type: 'FILING_EDITED', side: 'a', patch: { story: 'x' } }]);
    expect(rejects(s0, { type: 'FILING_EDITED', side: 'a', patch: { angle: 'a'.repeat(141) } })?.message).toMatch(/D2/);
    let s = run(s0, [{ type: 'FILING_SUBMITTED' }, { type: 'EVIDENCE_APPROVED', by: 'a' }]);
    s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: ok }, { type: 'REDRAFT_REQUESTED', side: 'a' }]);
    expect(s).toMatchObject({ stage: 'counsel', step: 'drafting', attempt: 2, pendingRedraft: 1 });
    s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: ok }]);
    expect(rejects(s, { type: 'REDRAFT_REQUESTED', side: 'a' })?.message).toMatch(/used its redraft/);
  });

  it('enforces D1: one automatic redraft of the weaker bench, then cancels as unfair', async () => {
    let s = run(start('solo'), [{ type: 'FILING_EDITED', side: 'a', patch: { story: 'x' } }, { type: 'FILING_SUBMITTED' }, { type: 'EVIDENCE_APPROVED', by: 'a' }]);
    const bad = { ok: false, scores: [1, 0.3] as const, reasons: ['thin'] };
    expect(rejects(s, { type: 'COUNSEL_DRAFTED', draft: { ...(await draftFor(s)), attempt: 9 }, balance: ok })?.message).toMatch(/Stale/);
    s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: bad }]);
    expect(s).toMatchObject({ stage: 'counsel', step: 'drafting', pendingRedraft: 1, autoRedraftsUsed: 1 });
    s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: bad }]);
    expect(s).toMatchObject({ stage: 'closed', reason: 'ai-unfair', cancelledFrom: 'counsel' });
    expect(chainPhaseOf(s)).toBe('cancelled');
  });

  it('cancels on missed recruitment and accepts the refund record once', async () => {
    let s = await soloToFunding();
    if (s.stage !== 'counsel' || !s.transcript) throw new Error();
    s = run(s, [
      { type: 'CASE_OPENED', caseNumber: caseNumber(71), transcriptHash: s.transcript.hash },
      { type: 'FUNDS_DEPOSITED', deposit: { account: A, kind: 'filer', amount: usdc('1.20') } },
    ]);
    const deadline = activeDeadline(s);
    expect(deadline?.deadline).toBe('recruitment');
    expect(rejects(s, { type: 'DEADLINE_PASSED', deadline: 'recruitment' })).not.toBeNull();
    s = run(s, [[{ type: 'DEADLINE_PASSED', deadline: 'recruitment' }, deadline!.endsAt]]);
    expect(s).toMatchObject({ stage: 'closed', reason: 'jury-unfilled' });
    if (s.stage !== 'closed') throw new Error();
    const refund = settle({ terms: s.terms, funders: [{ account: A, kind: 'filer', amount: usdc('1.20') }], jurors: [], outcome: 'cancelled' });
    s = run(s, [{ type: 'REFUNDED', settlement: refund }]);
    expect(rejects(s, { type: 'REFUNDED', settlement: refund })?.message).toMatch(/already/);
  });
});

describe('Versus', () => {
  it('needs side B consent before evidence, and both approvals', async () => {
    let s = run(start('versus'), [{ type: 'FILING_EDITED', side: 'a', patch: { story: 'They ate my leftovers.' } }, { type: 'FILING_SUBMITTED' }]);
    expect(s).toMatchObject({ stage: 'filing', step: 'awaiting-consent', consentEndsAt: T0 + 24 * 3600 });
    expect(chainPhaseOf(s)).toBe('pre-trial');
    expect(rejects(s, { type: 'CONSENT_GIVEN', side: 'b', account: A })?.message).toMatch(/same account/);
    s = run(s, [{ type: 'CONSENT_GIVEN', side: 'b', account: B }]);
    expect(rejects(s, { type: 'EVIDENCE_APPROVED', by: 'a' })?.message).toMatch(/Side B has no story/);
    s = run(s, [
      { type: 'FILING_EDITED', side: 'b', patch: { story: 'Leftovers in a shared fridge are communal.', nickname: 'Fridge Lawyer' } },
      { type: 'EVIDENCE_APPROVED', by: 'a' },
    ]);
    expect(s).toMatchObject({ stage: 'evidence' });
    s = run(s, [{ type: 'EVIDENCE_APPROVED', by: 'b' }]);
    s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: ok }, { type: 'DRAFT_APPROVED', by: 'a' }, { type: 'DRAFT_APPROVED', by: 'b' }]);
    if (s.stage !== 'counsel' || !s.transcript) throw new Error();
    s = run(s, [
      { type: 'CASE_OPENED', caseNumber: caseNumber(80), transcriptHash: s.transcript.hash },
      { type: 'FUNDS_DEPOSITED', deposit: { account: A, kind: 'side', amount: usdc('0.70') } },
    ]);
    expect(s).toMatchObject({ stage: 'counsel', step: 'funding' });
    s = run(s, [{ type: 'FUNDS_DEPOSITED', deposit: { account: B, kind: 'side', amount: usdc('0.70') } }]);
    expect(s).toMatchObject({ stage: 'jury', step: 'recruiting' });
  });

  it('closes when side B declines or never answers', () => {
    const s = run(start('versus'), [{ type: 'FILING_EDITED', side: 'a', patch: { story: 'x' } }, { type: 'FILING_SUBMITTED' }]);
    expect(run(s, [{ type: 'CONSENT_DECLINED', side: 'b' }])).toMatchObject({ stage: 'closed', reason: 'consent-declined' });
    expect(rejects(s, { type: 'DEADLINE_PASSED', deadline: 'consent' })).not.toBeNull();
    expect(run(s, [[{ type: 'DEADLINE_PASSED', deadline: 'consent' }, T0 + 24 * 3600]])).toMatchObject({ stage: 'closed', reason: 'consent-missed' });
  });
});

describe('Grand Jury and appeals', () => {
  it('runs with the court as approver, 7 jurors and a sponsor', async () => {
    let s = run(start('grand-jury'), [{ type: 'CASE_DETAILS_EDITED', patch: { title: 'Is cereal soup?', context: 'A reviewed context card.' } }, { type: 'FILING_SUBMITTED' }, { type: 'EVIDENCE_APPROVED', by: 'court' }]);
    s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: ok }, { type: 'DRAFT_APPROVED', by: 'court' }]);
    if (s.stage !== 'counsel' || !s.transcript) throw new Error();
    expect(activeDeadline(s)).toEqual({ deadline: 'funding', endsAt: T0 + 48 * 3600 });
    s = run(s, [
      { type: 'CASE_OPENED', caseNumber: caseNumber(90), transcriptHash: s.transcript.hash },
      { type: 'FUNDS_DEPOSITED', deposit: { account: testAddress('c1'), kind: 'contributor', amount: usdc('7.30') } },
    ]);
    expect(s.stage).toBe('jury');
    s = seatAndVote(s, 7, [0, 0, 0, 0, 1, null, 1], T0);
    expect(s).toMatchObject({ step: 'finalizing' });
  });

  it('lets only the losing side appeal, inside the window, when the mode allows it', async () => {
    const def = { ...BASE_MODES.solo, rules: { ...BASE_MODES.solo.rules, appeal: { allowed: true, windowSeconds: 3600 } } };
    let s: TrialState = createTrial({ id: trialId('t-appeal'), mode: 'solo', terms: def.terms(), rules: def.rules, benches: def.benches, category: 'dating-crimes', title: 'Ghosted', filer: A, now: T0 });
    s = run(s, [{ type: 'FILING_EDITED', side: 'a', patch: { story: 'x' } }, { type: 'FILING_SUBMITTED' }, { type: 'EVIDENCE_APPROVED', by: 'a' }]);
    s = run(s, [{ type: 'COUNSEL_DRAFTED', draft: await draftFor(s), balance: ok }, { type: 'DRAFT_APPROVED', by: 'a' }]);
    if (s.stage !== 'counsel' || !s.transcript) throw new Error();
    s = run(s, [{ type: 'CASE_OPENED', caseNumber: caseNumber(100), transcriptHash: s.transcript.hash }, { type: 'FUNDS_DEPOSITED', deposit: { account: A, kind: 'filer', amount: usdc('1.20') } }]);
    s = seatAndVote(s, 3, [0, 0, 0], T0);
    if (s.stage !== 'jury') throw new Error();
    const settlement = settle({ terms: s.terms, funders: s.deposits, jurors: s.seats.map((x) => ({ account: x.account, committed: true, revealed: true, choice: x.choice! })), outcome: 'trial' });
    s = run(s, [[{ type: 'VERDICT_RECORDED', settlement }, T0 + 1900]]);
    expect(s).toMatchObject({ stage: 'verdict', appealEndsAt: T0 + 1900 + 3600 });
    expect(rejects(s, { type: 'APPEAL_REQUESTED', side: 'b' })).not.toBeNull();
    s = run(s, [{ type: 'APPEAL_REQUESTED', side: 'a' }]);
    expect(s).toMatchObject({ stage: 'appeal', appellant: 'a' });
    expect(rejects(s, { type: 'APPEAL_FILED', caseNumber: caseNumber(100) })?.message).toMatch(/new case/);
    s = run(s, [{ type: 'APPEAL_FILED', caseNumber: caseNumber(101) }]);
    expect(s).toMatchObject({ stage: 'share', appealedTo: 101 });
  });

  it('base modes do not allow appeals', () => {
    for (const def of Object.values(BASE_MODES)) expect(def.rules.appeal.allowed).toBe(false);
  });
});


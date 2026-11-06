import { describe, expect, it } from 'vitest';
import { caseNumber, formatUsdc, usdc } from '@cringe-court/core';
import { ANGLE, DRAFT, FILER, runJury, setup, toJury } from './helpers';
import type { SoloSession } from '../index';

describe('SoloSession — the whole case', () => {
  it('runs confession → counsel → payment → NPC jury → verdict → share on the ledger', async () => {
    const { session, ports } = setup();
    await toJury(session);
    let s = session.getSnapshot();
    expect(s.error).toBeNull();
    expect(s.trial).toMatchObject({ stage: 'jury', step: 'recruiting', caseNumber: 69 });
    expect(formatUsdc(await ports.chain.usdcBalance(FILER))).toBe('3.80 USDC');

    await runJury(session);
    s = session.getSnapshot();
    expect(s.error).toBeNull();
    if (s.trial.stage !== 'verdict') throw new Error(`stage ${s.trial.stage}`);
    expect(s.trial.verdict.completedDuty).toBe(3);
    expect(['GUILTY', 'NOT COOKED']).toContain(s.trial.verdict.label);
    expect(s.trial.sentence?.segment).toBe('sentence');
    // The ledger agrees with the local settlement.
    expect((await ports.chain.getCase(caseNumber(69)))?.verdict?.label).toBe(s.trial.verdict.label);
    // A verdict: the court keeps 0.30, the filer gets nothing back.
    expect(formatUsdc(s.trial.settlement.protocol.fees)).toBe('0.30 USDC');
    expect(s.receipt).toEqual([]);
    expect(s.txs.funded?.explorerUrl).toBeTruthy();

    session.shared('image');
    expect(session.getSnapshot().trial.stage).toBe('share');
  });

  it('is deterministic: the same case gets the same jury', async () => {
    const a = setup();
    const b = setup();
    await toJury(a.session);
    await toJury(b.session);
    await runJury(a.session);
    await runJury(b.session);
    const va = a.session.getSnapshot().trial;
    const vb = b.session.getSnapshot().trial;
    if (va.stage !== 'verdict' || vb.stage !== 'verdict') throw new Error('no verdict');
    expect(va.seats.map((x) => x.choice)).toEqual(vb.seats.map((x) => x.choice));
  });

  it('keeps every ballot secret until reveal', async () => {
    const { session } = setup();
    await toJury(session);
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    for (let seat = 1; seat <= 3; seat++) await session.commitBallot(seat);
    const t = session.getSnapshot().trial;
    if (t.stage !== 'jury') throw new Error();
    expect(t.step).toBe('commit');
    expect(t.seats.every((x) => x.committed && x.choice === undefined)).toBe(true);
    expect(session.nextJurorSeat()).toBeNull();
  });

  it('redacts the public filing and keeps private notes for the advocate only (D1)', async () => {
    const { session, ports } = setup();
    await toJury(session);
    const t = session.getSnapshot().trial;
    expect(t.filing.sides.a?.story).toContain('[email redacted]');
    expect(t.filing.sides.a?.story).not.toContain('jordan');
    expect(session.getSnapshot().redactions.map((r) => r.kind)).toEqual(['email']);
    const req = ports.counsel.requests.at(-1)!;
    const [prosecution, defense] = req.briefs;
    expect(JSON.stringify(prosecution)).not.toContain('SECRET');
    expect(prosecution.client).toBeNull();
    expect(defense.privateNotes).toContain('SECRET');
    expect(defense.angle).toBeTruthy();
    // Same model and budget for both benches.
    expect(req.budget).toEqual({ maxInputTokens: 1200, maxOutputTokens: 400 });
    expect(req.payer).toEqual(['platform', 'platform']);
  });

  it('rejects an invalid confession without touching the state machine', () => {
    const { session } = setup();
    expect(session.fileConfession({ ...DRAFT, story: 'too short' })).toBe(false);
    expect(session.getSnapshot().error?.code).toBe('validation');
    expect(session.getSnapshot().trial.stage).toBe('filing');
  });

  it('needs an angle before drafting (D2)', async () => {
    const { session } = setup();
    session.fileConfession(DRAFT);
    await session.approveAndDraft();
    expect(session.getSnapshot().error?.message).toMatch(/angle/);
    expect(session.setAngle('x'.repeat(141))).toBe(false);
    expect(session.getSnapshot().trial.stage).toBe('evidence');
  });

  it('allows exactly one user redraft (D2)', async () => {
    const { session } = setup();
    session.fileConfession(DRAFT);
    session.setAngle(ANGLE);
    await session.approveAndDraft();
    await session.redraft();
    let t = session.getSnapshot().trial;
    expect(t).toMatchObject({ stage: 'counsel', step: 'review', attempt: 2 });
    await session.redraft();
    t = session.getSnapshot().trial;
    expect(session.getSnapshot().error?.message).toMatch(/used its redraft/);
    expect(t).toMatchObject({ stage: 'counsel', step: 'review', attempt: 2 });
  });

  it('auto-redrafts once when unbalanced, then cancels as unfair with nothing charged (D1)', async () => {
    const once = setup({ counsel: { unbalancedDrafts: 1 } });
    once.session.fileConfession(DRAFT);
    once.session.setAngle(ANGLE);
    await once.session.approveAndDraft();
    expect(once.session.getSnapshot().trial).toMatchObject({ stage: 'counsel', step: 'review', autoRedraftsUsed: 1 });

    const twice = setup({ counsel: { unbalancedDrafts: 2 } });
    twice.session.fileConfession(DRAFT);
    twice.session.setAngle(ANGLE);
    await twice.session.approveAndDraft();
    expect(twice.session.getSnapshot().trial).toMatchObject({ stage: 'closed', reason: 'ai-unfair' });
    expect(formatUsdc(await twice.ports.chain.usdcBalance(FILER))).toBe('5.00 USDC');
  });

  it('keeps the case in drafting on a retryable counsel outage', async () => {
    const { session, ports } = setup({ counsel: { fail: true } });
    session.fileConfession(DRAFT);
    session.setAngle(ANGLE);
    await session.approveAndDraft();
    expect(session.getSnapshot().error).toMatchObject({ code: 'counsel', retryable: true });
    expect(session.getSnapshot().trial).toMatchObject({ stage: 'counsel', step: 'drafting' });
    // The adapter recovers; a retry drafts.
    (ports.counsel as unknown as { options: { fail: boolean } }).options.fail = false;
    await session.retryDraft();
    expect(session.getSnapshot().trial).toMatchObject({ stage: 'counsel', step: 'review' });
  });

  it('surfaces an unfunded wallet and lets the filer retry the payment', async () => {
    const { session, ports } = setup({ balance: '0.50' });
    session.fileConfession(DRAFT);
    session.setAngle(ANGLE);
    await session.approveAndDraft();
    session.approveDraft();
    await session.pay();
    expect(session.getSnapshot().error?.code).toBe('chain');
    expect(session.getSnapshot().trial).toMatchObject({ stage: 'counsel', step: 'funding', caseNumber: 69 });
    ports.chain.mint(FILER, usdc('1'));
    await session.pay();
    expect(session.getSnapshot().trial.stage).toBe('jury');
  });

  it('withdraws before paying with nothing charged', async () => {
    const { session } = setup();
    session.fileConfession(DRAFT);
    session.withdraw();
    expect(session.getSnapshot().trial).toMatchObject({ stage: 'closed', reason: 'withdrawn' });
  });

  it('teaser: openings only, ends on THE JURY IS OUT, one a day per device, carried into the paid draft (D3)', async () => {
    const { session, ports } = setup();
    session.fileConfession(DRAFT);
    session.setAngle(ANGLE);
    await session.watchTeaser();
    const teaser = session.getSnapshot().teaser!;
    expect(teaser.map((l) => l.segment)).toEqual(['call-to-order', 'opening', 'opening', 'jury-out']);
    expect(teaser.at(-1)!.text).toBe('THE JURY IS OUT.');
    expect(teaser.some((l) => /guilty|not cooked/i.test(l.text) && l.speaker === 'judge')).toBe(false);
    await session.approveAndDraft();
    expect(ports.counsel.requests.at(-1)!.carryOver?.map((l) => l.segment)).toEqual(['call-to-order', 'opening', 'opening']);

    const second = setup();
    // Same device store is per-setup; spend the quota twice on one quota object.
    expect(second.teasers.consume(null)).toBe(true);
    second.session.fileConfession(DRAFT);
    second.session.setAngle(ANGLE);
    await second.session.watchTeaser();
    expect(second.session.getSnapshot().error?.code).toBe('quota');
    expect(second.session.getSnapshot().teaser).toBeNull();
  });

  it('adds redacted exhibits and caps them', async () => {
    const { session } = setup();
    session.fileConfession(DRAFT);
    expect(session.addExhibit({ kind: 'quote', title: 'The email', body: 'From jordan@corp.example: "lol same"' })).toBe(true);
    const t = session.getSnapshot().trial;
    if (t.stage !== 'evidence') throw new Error();
    expect(t.exhibits[0]!.body).toContain('[email redacted]');
    for (let i = 0; i < 3; i++) session.addExhibit({ kind: 'text', title: `E${i}`, body: 'text' });
    expect(session.addExhibit({ kind: 'text', title: 'one too many', body: 'text' })).toBe(false);
    expect(session.getSnapshot().error?.message).toMatch(/At most 4/);
  });
});

describe('SoloSession — NO VERDICT refunds the filer in full', () => {
  it('forfeits no-show bonds, refunds 1.20 and lets the filer claim it', async () => {
    const { session, ports } = setup();
    await toJury(session);
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    await session.commitBallot(1); // seats 2 and 3 never seal a ballot
    await session.closeCommit();
    await session.revealBallot(1);
    await session.closeReveal();
    await session.finalize();
    const s = session.getSnapshot();
    if (s.trial.stage !== 'verdict') throw new Error(s.trial.stage);
    expect(s.trial.verdict).toMatchObject({ kind: 'no-verdict', label: 'NO VERDICT', completedDuty: 1 });
    expect(formatUsdc(s.trial.settlement.protocol.fees)).toBe('0.00 USDC');
    expect(s.receipt?.map((l) => l.kind)).toEqual(['refund']);
    expect(s.trial.sentence?.text).toMatch(/MISTRIAL/);
    await session.claimRefund();
    expect(session.getSnapshot().claimed).toBe(true);
    expect(formatUsdc(await ports.chain.usdcBalance(FILER))).toBe('5.00 USDC');
  });
});

/**
 * B1 (UX evaluation): the filer pauses the jury (or the laptop sleeps, or the
 * tab sits in the background) and a jury window closes on the ledger. The jury
 * must carry on from where the ledger is, not retry a step the ledger already
 * closed ("Case 69 is in reveal, not commit"), and NO VERDICT must be reachable.
 */
describe('SoloSession — deadlines that pass while nobody is watching (B1)', () => {
  /** What useJuryDirector does: pick the next visible step from the snapshot, stop on any error. */
  async function driveLikeTheDirector(session: SoloSession) {
    for (let i = 0; i < 20; i++) {
      const t = session.getSnapshot().trial;
      if (session.getSnapshot().error || t.stage !== 'jury') return;
      const seat = session.nextJurorSeat();
      if (t.step === 'recruiting') await session.seatNextJuror();
      else if (t.step === 'commit') await (seat ? session.commitBallot(seat) : session.closeCommit());
      else if (t.step === 'reveal') await (seat ? session.revealBallot(seat) : session.closeReveal());
      else if (t.step === 'finalizing') await session.finalize();
    }
  }

  it('commit window closes with one scroll sealed: carries on to NO VERDICT and a claimable 1.20 refund', async () => {
    const { session, ports } = setup();
    await toJury(session);
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    await session.commitBallot(1);
    ports.clock.advance(16 * 60); // past the 15 min demo commit window, inside the reveal window
    await driveLikeTheDirector(session);
    const s = session.getSnapshot();
    expect(s.error).toBeNull();
    if (s.trial.stage !== 'verdict') throw new Error(`stage ${s.trial.stage}`);
    expect(s.trial.verdict).toMatchObject({ kind: 'no-verdict', label: 'NO VERDICT', completedDuty: 1 });
    expect(s.lapsed).toEqual(['commit']);
    expect(s.receipt?.map((l) => [l.kind, formatUsdc(l.amount)])).toEqual([['refund', '1.20 USDC']]);
    await session.claimRefund();
    expect(session.getSnapshot().claimed).toBe(true);
    expect(formatUsdc(await ports.chain.usdcBalance(FILER))).toBe('5.00 USDC');
  });

  it('both windows close while away: NO VERDICT with nobody counted, refund claimable', async () => {
    const { session, ports } = setup();
    await toJury(session);
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    await session.commitBallot(1);
    ports.clock.advance(60 * 60);
    await driveLikeTheDirector(session);
    const s = session.getSnapshot();
    expect(s.error).toBeNull();
    if (s.trial.stage !== 'verdict') throw new Error(`stage ${s.trial.stage}`);
    expect(s.trial.verdict).toMatchObject({ kind: 'no-verdict', completedDuty: 0 });
    expect(s.lapsed).toEqual(['commit', 'reveal']);
    expect(formatUsdc(s.trial.settlement.protocol.fees)).toBe('0.00 USDC');
    await session.claimRefund();
    expect(formatUsdc(await ports.chain.usdcBalance(FILER))).toBe('5.00 USDC');
  });

  it('reveal window closes mid-reveal: the opened scrolls count, the rest forfeit, no error loop', async () => {
    const { session, ports } = setup();
    await toJury(session);
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    for (let seat = 1; seat <= 3; seat++) await session.commitBallot(seat);
    await session.closeCommit();
    await session.revealBallot(1);
    ports.clock.advance(10 * 60);
    await driveLikeTheDirector(session);
    const s = session.getSnapshot();
    expect(s.error).toBeNull();
    if (s.trial.stage !== 'verdict') throw new Error(`stage ${s.trial.stage}`);
    expect(s.trial.verdict.completedDuty).toBe(1);
    expect(s.lapsed).toEqual(['reveal']);
    // Same settlement as the ledger's own maths.
    expect((await ports.chain.getCase(caseNumber(69)))?.verdict?.label).toBe(s.trial.verdict.label);
  });

  it('recruitment window closes before the jury is full: case dismissed, payment and bonds refunded, claimable', async () => {
    const { session, ports, accounts } = setup();
    await toJury(session);
    await session.seatNextJuror();
    ports.clock.advance(6 * 60);
    await driveLikeTheDirector(session);
    const s = session.getSnapshot();
    expect(s.error).toBeNull();
    if (s.trial.stage !== 'closed') throw new Error(`stage ${s.trial.stage}`);
    expect(s.trial.reason).toBe('jury-unfilled');
    expect(s.lapsed).toEqual(['recruitment']);
    // Pricing is the ledger's own: the recorded refunds equal the twin's settlement.
    expect(s.trial.settlement).toEqual(ports.chain.settlementOf(caseNumber(69)));
    expect(s.trial.settlement?.statements.find((x) => x.party.toLowerCase() === FILER.toLowerCase())?.payout).toBe(usdc('1.20'));
    expect(s.receipt?.map((l) => [l.kind, formatUsdc(l.amount)])).toEqual([['refund', '1.20 USDC']]);
    await session.claimRefund();
    expect(session.getSnapshot().claimed).toBe(true);
    expect(formatUsdc(await ports.chain.usdcBalance(FILER))).toBe('5.00 USDC');
    // The seated NPC juror gets their bond back too (claimable, like every payout).
    const juror = s.trial.settlement?.statements.find((x) => x.party.toLowerCase() === accounts[0]!.toLowerCase());
    expect(juror?.lines.map((l) => [l.kind, formatUsdc(l.amount)])).toEqual([['bond-returned', '0.40 USDC']]);
  });

  it('a step racing the deadline does not strand the jury on a ledger error', async () => {
    const { session, ports } = setup();
    await toJury(session);
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    const t = session.getSnapshot().trial;
    if (t.stage !== 'jury' || t.commitEndsAt === null) throw new Error();
    ports.clock.advance(t.commitEndsAt - ports.clock.now());
    await session.commitBallot(1);
    expect(session.getSnapshot().error).toBeNull();
    expect(session.getSnapshot().trial).toMatchObject({ stage: 'jury', step: 'reveal' });
  });
});

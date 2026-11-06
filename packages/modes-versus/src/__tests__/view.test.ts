import { usdc, type TrialState } from '@cringe-court/core';
import { testAddress } from '@cringe-court/core/testing';
import { describe, expect, it } from 'vitest';
import { sideCharges } from '../economics';
import { casesFor, nextStep, receiptFor, roleLabel, stepIndex, VERSUS_STEPS, viewerOf } from '../view';
import type { VersusCase } from '../world';
import { briefA, briefB, rig, toFunding, toVerdict } from './helpers';

const stranger = testAddress('stranger');

describe('stepIndex', () => {
  const idx = (s: object) => stepIndex(s as TrialState);

  it('maps each stage to a step of the six', () => {
    expect(VERSUS_STEPS).toHaveLength(6);
    expect(idx({ stage: 'filing' })).toBe(0);
    expect(idx({ stage: 'evidence' })).toBe(1);
    expect(idx({ stage: 'counsel', step: 'drafting' })).toBe(2);
    expect(idx({ stage: 'counsel', step: 'review' })).toBe(2);
    expect(idx({ stage: 'counsel', step: 'funding' })).toBe(3);
    expect(idx({ stage: 'jury' })).toBe(4);
    for (const stage of ['verdict', 'appeal', 'share']) expect(idx({ stage })).toBe(5);
  });

  it('puts a closed case on the step it was cancelled from', () => {
    expect(idx({ stage: 'closed', cancelledFrom: 'filing' })).toBe(0);
    expect(idx({ stage: 'closed', cancelledFrom: 'evidence' })).toBe(1);
    expect(idx({ stage: 'closed', cancelledFrom: 'counsel', transcript: null })).toBe(2);
    expect(idx({ stage: 'closed', cancelledFrom: 'counsel', transcript: { lines: [] } })).toBe(3);
    expect(idx({ stage: 'closed', cancelledFrom: 'jury' })).toBe(4);
  });
});

describe('viewerOf / roleLabel / nextStep through the lifecycle', () => {
  it('follows invite → briefs → counsel → funding', async () => {
    const t = rig();
    const { a, b } = t;
    const { trialId } = await a.fileCase({ title: 'The Last Dumpling', category: 'dating-crimes', patch: briefA.patch });
    let c = (await a.world()).case(trialId)!;

    // Awaiting consent: invitee is whoever is not a party.
    expect(c.state.stage).toBe('filing');
    expect(stepIndex(c.state)).toBe(0);
    expect(viewerOf(c, a.account)).toBe('a');
    expect(viewerOf(c, b.account)).toBe('invitee');
    expect(viewerOf(c, null)).toBe('invitee');
    expect(roleLabel(c, a.account)).toBe('Side A');
    expect(roleLabel(c, b.account)).toBe('Someone');
    expect(nextStep(c, 'invitee', b.account)).toMatchObject({ label: expect.stringMatching(/invited/), yourMove: true });
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: expect.stringMatching(/Waiting for Side B to accept/), yourMove: false });

    await b.acceptInvite(trialId);
    c = (await a.world()).case(trialId)!;
    expect(c.state.stage).toBe('evidence');
    expect(viewerOf(c, b.account)).toBe('b');
    expect(viewerOf(c, stranger)).toBe('spectator');
    expect(viewerOf(c, null)).toBe('spectator');
    expect(roleLabel(c, b.account)).toBe('Side B');
    expect(stepIndex(c.state)).toBe(1);
    expect(nextStep(c, 'b', b.account)).toMatchObject({ label: 'Brief your agent', yourMove: true });
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: expect.stringMatching(/approve your brief/), yourMove: true });
    expect(nextStep(c, 'spectator', null)).toMatchObject({ label: expect.stringMatching(/briefing/), yourMove: false });

    await b.saveBrief(trialId, 'b', briefB.patch);
    await a.approveBrief(trialId, 'a');
    c = (await a.world()).case(trialId)!;
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: expect.stringMatching(/Waiting for Side B to approve/), yourMove: false });
    expect(nextStep(c, 'b', b.account).yourMove).toBe(true);
  });

  it('follows counsel review and funding', async () => {
    const t = rig();
    const { a, b } = t;
    await a.faucet(usdc('2.00'));
    const { trialId } = await toFunding(t);
    let c = (await a.world()).case(trialId)!;
    expect(c.state.stage === 'counsel' && c.state.step).toBe('funding');
    expect(stepIndex(c.state)).toBe(3);
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: expect.stringMatching(/Pay your half/), yourMove: true });
    expect(nextStep(c, 'spectator', null)).toMatchObject({ label: 'Waiting for both sides to pay', yourMove: false });

    await a.fund(trialId);
    c = (await a.world()).case(trialId)!;
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: expect.stringMatching(/Waiting for Side B to pay/), yourMove: false });
    expect(nextStep(c, 'b', b.account)).toMatchObject({ label: expect.stringMatching(/Pay your half/), yourMove: true });
  });

  it('follows the review step of counsel', async () => {
    const t = rig();
    const { a, b } = t;
    const { trialId } = await a.fileCase({ title: 'Review', category: 'dating-crimes', patch: briefA.patch });
    await b.acceptInvite(trialId);
    await b.saveBrief(trialId, 'b', briefB.patch);
    await a.approveBrief(trialId, 'a');
    await b.approveBrief(trialId, 'b');
    await a.runCounsel(trialId);
    await a.approveDraft(trialId, 'a');
    const c = (await a.world()).case(trialId)!;
    expect(c.state.stage === 'counsel' && c.state.step).toBe('review');
    expect(stepIndex(c.state)).toBe(2);
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: expect.stringMatching(/Waiting for Side B to approve the draft/), yourMove: false });
    expect(nextStep(c, 'b', b.account)).toMatchObject({ label: 'Read the draft, then approve it', yourMove: true });
    expect(nextStep(c, 'spectator', null).label).toBe('The sides are reviewing the draft');
  });

  it('follows jury selection, and a juror is recognised', async () => {
    const t = rig();
    const { a, b, j } = t;
    await a.faucet(usdc('2.00'));
    await b.faucet(usdc('2.00'));
    await j.faucet(usdc('2.00'));
    const { trialId } = await toFunding(t);
    await a.fund(trialId);
    await b.fund(trialId);
    let c = (await a.world()).case(trialId)!;
    expect(c.state.stage).toBe('jury');
    expect(stepIndex(c.state)).toBe(4);
    expect(viewerOf(c, j.account)).toBe('spectator');
    expect(roleLabel(c, j.account)).toBe('Someone');
    expect(nextStep(c, 'spectator', j.account)).toMatchObject({ label: 'Jury selection: 0 of 3 seats taken', yourMove: true });
    expect(nextStep(c, 'a', a.account).yourMove).toBe(false);

    await j.takeSeat(trialId);
    c = (await a.world()).case(trialId)!;
    expect(viewerOf(c, j.account)).toBe('juror');
    expect(roleLabel(c, j.account)).toBe('Juror 1');
    expect(nextStep(c, 'juror', j.account).label).toMatch(/1 of 3 seats/);
  });

  it('follows commit and reveal for a juror, and the verdict claim', async () => {
    const t = rig();
    const { a, j } = t;
    const trialId = await toVerdict(t);
    const c = (await a.world()).case(trialId)!;
    expect(c.state.stage).toBe('verdict');
    expect(stepIndex(c.state)).toBe(5);
    const step = nextStep(c, 'juror', j.account);
    expect(step.label).toMatch(/Verdict is in|Verdict:|NO VERDICT/);
    // Jurors are paid out on a verdict; sides only pay (or are refunded on NO VERDICT).
    expect(step.yourMove).toBe(true);
    expect(nextStep(c, 'spectator', stranger).yourMove).toBe(false);
    expect(nextStep(c, 'spectator', stranger).label).toMatch(/^(Verdict: |NO VERDICT)/);
    await j.claim(trialId);
    const after = (await a.world()).case(trialId)!;
    expect(nextStep(after, 'juror', j.account).yourMove).toBe(false);
  });

  it('follows commit and reveal steps for a juror', async () => {
    const t = rig();
    const { a, b, j, clock } = t;
    for (const d of [a, b, j]) await d.faucet(usdc('2.00'));
    const { trialId } = await toFunding(t);
    await a.fund(trialId);
    await b.fund(trialId);
    await j.takeSeat(trialId);
    await a.seatDemoJurors(trialId, 'reliable');
    let c = (await a.world()).case(trialId)!;
    expect(c.state.stage === 'jury' && c.state.step).toBe('commit');
    expect(nextStep(c, 'juror', j.account)).toMatchObject({ label: 'Watch the trial, then seal your scroll', yourMove: true });
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: 'The jury is sealing their scrolls', yourMove: false });
    await j.commitBallot(trialId, 0);
    c = (await a.world()).case(trialId)!;
    expect(nextStep(c, 'juror', j.account).yourMove).toBe(false);
    clock.advance(30);
    await a.tick();
    await a.skipAhead(trialId);
    c = (await a.world()).case(trialId)!;
    expect(c.state.stage === 'jury' && c.state.step).toBe('reveal');
    expect(nextStep(c, 'juror', j.account)).toMatchObject({ label: 'Open your scroll before the deadline', yourMove: true });
    expect(nextStep(c, 'spectator', null).label).toBe('The jury is opening their scrolls');
  });

  it('labels a withdrawn case as dismissed, with a refund claim only for payers', async () => {
    const t = rig();
    const { a, b } = t;
    const { trialId } = await a.fileCase({ title: 'Quit', category: 'dating-crimes', patch: briefA.patch });
    await b.acceptInvite(trialId);
    await b.withdraw(trialId, 'b');
    const c = (await a.world()).case(trialId)!;
    expect(c.state.stage).toBe('closed');
    expect(stepIndex(c.state)).toBe(1);
    expect(nextStep(c, 'a', a.account)).toMatchObject({ label: 'Case dismissed', yourMove: false });
  });
});

describe('receiptFor', () => {
  it('itemises where each side’s half went on a verdict, and pays the juror from the ledger', async () => {
    const t = rig();
    const trialId = await toVerdict(t);
    const c = (await t.a.world()).case(trialId)!;
    const [chargeA, chargeB] = sideCharges(c.state.terms);
    for (const [desk, charge] of [[t.a, chargeA], [t.b, chargeB]] as const) {
      const lines = receiptFor(c, desk.account);
      expect(lines.every((l) => l.kind === 'fee' && l.label.startsWith('Spent: '))).toBe(true);
      expect(lines.reduce((sum, l) => sum + l.amount, 0n)).toBe(charge.total);
    }
    expect(receiptFor(c, t.j.account).some((l) => l.kind === 'bond-returned')).toBe(true);
    expect(receiptFor(c, stranger)).toEqual([]);
  });
});

describe('casesFor', () => {
  it('returns only the account’s cases, most recently updated first', async () => {
    const t = rig();
    const { a, b, clock } = t;
    const one = (await a.fileCase({ title: 'First', category: 'dating-crimes', patch: briefA.patch })).trialId;
    clock.advance(60);
    const two = (await a.fileCase({ title: 'Second', category: 'dating-crimes', patch: briefA.patch })).trialId;
    clock.advance(60);
    const other = (await b.fileCase({ title: 'Bob’s own', category: 'dating-crimes', patch: briefB.patch })).trialId;
    clock.advance(60);
    await b.acceptInvite(one); // touches case one last

    const w = await a.world();
    const all = [one, two, other].map((id) => w.case(id)!) as VersusCase[];
    expect(casesFor(all, a.account).map((c) => c.trialId)).toEqual([one, two]);
    expect(casesFor(all, b.account).map((c) => c.trialId)).toEqual([one, other]);
    expect(casesFor(all, stranger)).toEqual([]);
    // Invitees are excluded: Bob is invitee on case two until he accepts.
    expect(casesFor([w.case(two)!], b.account)).toEqual([]);
    expect(casesFor([], a.account)).toEqual([]);
  });

  it('does not mutate its input order', async () => {
    const t = rig();
    const one = (await t.a.fileCase({ title: 'First', category: 'dating-crimes', patch: briefA.patch })).trialId;
    t.clock.advance(60);
    const two = (await t.a.fileCase({ title: 'Second', category: 'dating-crimes', patch: briefA.patch })).trialId;
    const w = await t.a.world();
    const input = [w.case(one)!, w.case(two)!];
    casesFor(input, t.a.account);
    expect(input.map((c) => c.trialId)).toEqual([one, two]);
  });
});

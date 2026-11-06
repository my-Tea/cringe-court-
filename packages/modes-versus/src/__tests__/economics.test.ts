import { ZERO_USDC, addUsdc, formatUsdc, usdc } from '@cringe-court/core';
import { describe, expect, it } from 'vitest';
import { versusTerms } from '../definition';
import { ABANDONED_INTAKE_COST, PREVIEW_OUTCOMES, caseTotal, disclose, jurorStake, previewOutcome, sideCharges, type VersusOutcome } from '../economics';

const terms = versusTerms();

describe('sideCharges', () => {
  it('charges each side 0.70 in 0.45 / 0.05 / 0.20 parts', () => {
    const [a, b] = sideCharges(terms);
    for (const c of [a, b]) {
      expect(formatUsdc(c.total)).toBe('0.70 USDC');
      expect(c.parts.map((p) => p.amount)).toEqual([usdc('0.45'), usdc('0.05'), usdc('0.20')]);
      expect(addUsdc(ZERO_USDC, ...c.parts.map((p) => p.amount))).toBe(c.total);
      expect(c.passWaived).toBe(false);
      expect(c.parts[2]!.label).toMatch(/0G Compute/);
    }
    expect([a.side, b.side]).toEqual(['a', 'b']);
    expect(caseTotal(terms)).toBe(usdc('1.40'));
  });

  it('waives the AI part for a side with a 0G Pass', () => {
    const t = versusTerms({ passWaivers: [true, false] });
    const [a, b] = sideCharges(t);
    expect(a.total).toBe(usdc('0.50'));
    expect(a.parts[2]!.amount).toBe(ZERO_USDC);
    expect(a.passWaived).toBe(true);
    expect(a.parts[2]!.label).toMatch(/own 0G Pass/);
    expect(b.total).toBe(usdc('0.70'));
    expect(b.passWaived).toBe(false);
    expect(caseTotal(t)).toBe(usdc('1.20'));
  });
});

describe('previewOutcome', () => {
  it('covers every outcome with PREVIEW_OUTCOMES', () => {
    expect(new Set(PREVIEW_OUTCOMES)).toEqual(new Set<VersusOutcome>(['verdict', 'verdict-with-no-show', 'no-verdict', 'funding-missed', 'jury-unfilled', 'consent-missed', 'withdrawn']));
  });

  it.each(PREVIEW_OUTCOMES)('balances the money for %s', (outcome) => {
    const p = previewOutcome(terms, outcome);
    expect(p.outcome).toBe(outcome);
    if (p.settlement) expect(p.settlement.totalIn).toBe(p.settlement.totalOut);
  });

  it('verdict: each side nets 0.70 and the court keeps at least 0.50', () => {
    const p = previewOutcome(terms, 'verdict');
    expect(p.sideCost).toEqual([usdc('0.70'), usdc('0.70')]);
    expect(p.sideRefund).toEqual([ZERO_USDC, ZERO_USDC]);
    expect(p.courtKeeps >= usdc('0.50')).toBe(true);
    expect(p.jurorRewards > 0n).toBe(true);
    expect(p.platformAbsorbs).toBe(ZERO_USDC);
    expect(p.settlement?.verdict?.completedDuty).toBe(3);
  });

  it('verdict-with-no-show: still a verdict, the no-show forfeits, the court keeps more', () => {
    const full = previewOutcome(terms, 'verdict');
    const p = previewOutcome(terms, 'verdict-with-no-show');
    expect(p.sideCost).toEqual([usdc('0.70'), usdc('0.70')]);
    expect(p.settlement?.verdict?.completedDuty).toBe(2);
    expect(p.settlement?.protocol.forfeits && p.settlement.protocol.forfeits > 0n).toBe(true);
    expect(p.courtKeeps >= full.courtKeeps).toBe(true);
  });

  it('no-verdict: both sides are refunded in full (DECISIONS)', () => {
    const p = previewOutcome(terms, 'no-verdict');
    expect(p.sideRefund).toEqual([usdc('0.70'), usdc('0.70')]);
    expect(p.sideCost).toEqual([ZERO_USDC, ZERO_USDC]);
    expect(p.platformAbsorbs).toBe(ZERO_USDC);
  });

  it('funding-missed: the side that paid gets its 0.70 back', () => {
    const p = previewOutcome(terms, 'funding-missed');
    expect(p.sideRefund).toEqual([usdc('0.70'), ZERO_USDC]);
    expect(p.sideCost).toEqual([ZERO_USDC, ZERO_USDC]);
    expect(p.courtKeeps).toBe(ZERO_USDC);
  });

  it('jury-unfilled: both sides refunded', () => {
    const p = previewOutcome(terms, 'jury-unfilled');
    expect(p.sideRefund).toEqual([usdc('0.70'), usdc('0.70')]);
    expect(p.sideCost).toEqual([ZERO_USDC, ZERO_USDC]);
    expect(p.courtKeeps).toBe(ZERO_USDC);
  });

  it('consent-missed: nobody charged and the platform absorbs the intake (D6)', () => {
    const p = previewOutcome(terms, 'consent-missed');
    expect(ABANDONED_INTAKE_COST).toBe(usdc('0.0072'));
    expect(p.platformAbsorbs).toBe(usdc('0.0072'));
    expect(p.sideCost).toEqual([ZERO_USDC, ZERO_USDC]);
    expect(p.sideRefund).toEqual([ZERO_USDC, ZERO_USDC]);
    expect(p.settlement).toBeNull();
  });

  it('withdrawn: nobody paid yet, nothing moves', () => {
    const p = previewOutcome(terms, 'withdrawn');
    expect(p.sideCost).toEqual([ZERO_USDC, ZERO_USDC]);
    expect(p.courtKeeps).toBe(ZERO_USDC);
    expect(p.platformAbsorbs).toBe(ZERO_USDC);
    expect(p.settlement).toBeNull();
  });

  it('a waived pass lowers side A cost to 0.50 on a verdict', () => {
    const p = previewOutcome(versusTerms({ passWaivers: [true, false] }), 'verdict');
    expect(p.sideCost).toEqual([usdc('0.50'), usdc('0.70')]);
    expect(p.settlement?.totalIn).toBe(p.settlement?.totalOut);
  });
});

describe('disclose', () => {
  it('reports what the court kept and attendance', () => {
    const p = previewOutcome(terms, 'verdict-with-no-show');
    const d = disclose(p.settlement!, 3);
    expect(d.total).toBe(p.courtKeeps);
    expect(d.fees).toBe(p.settlement!.protocol.fees);
    expect(d.forfeits).toBe(p.settlement!.protocol.forfeits);
    expect(d.unearnedBonus).toBe(p.settlement!.protocol.unearnedBonus);
    expect(addUsdc(ZERO_USDC, d.fees, d.forfeits, d.unearnedBonus)).toBe(d.total);
    expect(d.attendance).toEqual({ completed: 2, appointed: 3 });
  });

  it('reports zero completed duty when there is no verdict object', () => {
    const p = previewOutcome(terms, 'funding-missed');
    expect(disclose(p.settlement!, 0).attendance).toEqual({ completed: p.settlement!.verdict?.completedDuty ?? 0, appointed: 0 });
  });
});

describe('jurorStake', () => {
  it('shows a 0.40 bond, a 0.30 reward and 0.70 best case', () => {
    const s = jurorStake(terms);
    expect(s.bond).toBe(usdc('0.40'));
    expect(s.reward).toBe(usdc('0.30'));
    expect(s.bestCase).toBe(usdc('0.70'));
    expect(s.failedTrialBonus).toBe(terms.failedTrialBonusPerTimelyJuror);
  });
});

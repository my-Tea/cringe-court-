import { describe, expect, it } from 'vitest';
import {
  GRAND_JURY_LAUNCH,
  MODES,
  PHASE_ORDER,
  PHASE_TRANSITIONS,
  addUsdc,
  canTransition,
  caseCharge,
  caseNumber,
  formatCaseNumber,
  formatUsdc,
  juryPool,
  jurySize,
  usdc,
  verdictThreshold,
} from './index';

describe('money', () => {
  it('parses decimal strings into exact micro-USDC', () => {
    expect(usdc('1.20')).toBe(1_200_000n);
    expect(usdc('0.000001')).toBe(1n);
    expect(addUsdc(usdc('0.1'), usdc('0.2'))).toBe(usdc('0.3'));
  });

  it('rejects malformed and over-precise amounts', () => {
    expect(() => usdc('1.2345678')).toThrow(SyntaxError);
    expect(() => usdc('-1')).toThrow(SyntaxError);
    expect(() => usdc('abc')).toThrow(SyntaxError);
  });

  it('formats with two decimals by default and never rounds', () => {
    expect(formatUsdc(usdc('1.2'))).toBe('1.20 USDC');
    expect(formatUsdc(usdc('0.0072'))).toBe('0.0072 USDC');
    expect(formatUsdc(usdc('1234.5'), { unit: false })).toBe('1,234.50');
    expect(formatUsdc(usdc('3'), { minFractionDigits: 0 })).toBe('3 USDC');
  });
});

// These pin the "Implementation constants" table in docs/DECISIONS.md.
describe('mode constants match DECISIONS.md', () => {
  it.each([
    ['solo', 3, 2, '0.90', '1.20'],
    ['versus', 3, 2, '0.90', '1.40'],
    ['grand-jury', 7, 4, '6.30', '7.30'],
  ] as const)('%s: %i jurors, %i to win, pool %s, charge %s', (id, size, threshold, pool, charge) => {
    const mode = MODES[id];
    expect(jurySize(mode)).toBe(size);
    expect(verdictThreshold(mode)).toBe(threshold);
    expect(juryPool(mode)).toBe(usdc(pool));
    expect(caseCharge(mode)).toBe(usdc(charge));
  });

  it('bond is 0.40 × N and the success bonus is 75 % of the bond', () => {
    for (const mode of Object.values(MODES)) {
      const { n, bondPerJuror, successBonusPerJuror } = mode.economics;
      expect(bondPerJuror).toBe(usdc('0.40') * BigInt(n));
      expect(successBonusPerJuror * 4n).toBe(bondPerJuror * 3n);
    }
  });

  it('Versus splits 1.40 into 0.70 per side (D4)', () => {
    expect(caseCharge(MODES.versus) / 2n).toBe(usdc('0.70'));
  });

  it('Grand Jury launch pricing is 7.80 with a ≥ 2.00 sponsor (D10)', () => {
    expect(caseCharge(GRAND_JURY_LAUNCH)).toBe(usdc('7.80'));
    expect(GRAND_JURY_LAUNCH.funding).toMatchObject({ kind: 'crowdfund', sponsorDeposit: usdc('2.00') });
  });
});

describe('case lifecycle', () => {
  it('walks the happy path in order', () => {
    for (let i = 1; i < PHASE_ORDER.length; i++) {
      const from = PHASE_ORDER[i - 1]!;
      const to = PHASE_ORDER[i]!;
      // Solo skips pre-trial, so draft → recruiting is also legal.
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('can cancel from every live phase, but never leaves a terminal one', () => {
    for (const phase of PHASE_ORDER.filter((p) => p !== 'settled')) {
      expect(canTransition(phase, 'cancelled')).toBe(true);
    }
    expect(PHASE_TRANSITIONS.settled).toHaveLength(0);
    expect(PHASE_TRANSITIONS.cancelled).toHaveLength(0);
    expect(canTransition('reveal', 'commit')).toBe(false);
  });

  it('formats case numbers like the stamp art', () => {
    expect(formatCaseNumber(caseNumber(69))).toBe('CASE #0069');
    expect(() => caseNumber(0)).toThrow(RangeError);
  });
});

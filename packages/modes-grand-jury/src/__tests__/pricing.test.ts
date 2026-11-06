import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { usdc, formatUsdc, termsFor } from '@cringe-court/core';
import { CURRENT_PRICING, PRICING, canPublish, crowdSize, grandJuryMode, marketingBudgetLeft, targetBreakdown } from '../index';

const H = PRICING.hackathon;
const L = PRICING.launch;

describe('D10 hackathon profile', () => {
  it('splits the 7.30 target into pool 6.30 + protocol 0.50 + AI 0.50', () => {
    expect(H.juryPool).toBe(usdc('6.30'));
    expect(H.protocolFee).toBe(usdc('0.50'));
    expect(H.aiFee).toBe(usdc('0.50'));
    expect(H.target).toBe(usdc('7.30'));
  });
  it('seats 7 jurors, needs 4, bond 1.20, minimum contribution 0.10', () => {
    expect(H.jurors).toBe(7);
    expect(H.threshold).toBe(4);
    expect(H.bond).toBe(usdc('1.20'));
    expect(H.minContribution).toBe(usdc('0.10'));
    expect(H.successBonus).toBe(usdc('0.90'));
  });
  it('caps unsponsored cases at 40 inside a 46.06 marketing budget', () => {
    expect(H.marketingCap).toBe(40);
    expect(H.marketingBudget).toBe(usdc('46.06'));
    expect(H.sponsorRequired).toBe(false);
    expect(H.sponsorFloor).toBe(usdc('2.00'));
  });
  it('is the profile the testnet app ships', () => {
    expect(CURRENT_PRICING).toBe(H);
    expect(grandJuryMode.config).toBe(H.config);
  });
});

describe('D10 launch profile', () => {
  it('has protocol 1.00, AI 0.50 and target 7.80', () => {
    expect(L.protocolFee).toBe(usdc('1.00'));
    expect(L.aiFee).toBe(usdc('0.50'));
    expect(L.target).toBe(usdc('7.80'));
  });
  it('requires a sponsor of at least 2.00 and budgets 1.50 review', () => {
    expect(L.sponsorFloor).toBe(usdc('2.00'));
    expect(L.sponsorRequired).toBe(true);
    expect(L.reviewCost).toBe(usdc('1.50'));
    expect(L.marketingCap).toBeNull();
    expect(L.marketingBudget).toBeNull();
  });
  it('keeps the same jury maths', () => {
    expect(L.jurors).toBe(7);
    expect(L.threshold).toBe(4);
    expect(L.bond).toBe(usdc('1.20'));
    expect(L.minContribution).toBe(usdc('0.10'));
  });
  it('sizes the crowd in whole people, rounded up (7.80 at 0.50 is 16, 7.30 is 15)', () => {
    expect(crowdSize(L.target)).toBe(16);
    expect(crowdSize(H.target)).toBe(15);
    expect(Number.isInteger(crowdSize(usdc('7.01'), usdc('0.50')))).toBe(true);
    expect(crowdSize(usdc('7.00'))).toBe(14);
  });
});

describe('canPublish', () => {
  it('rejects a sponsor below the floor in both phases', () => {
    for (const p of [H, L]) {
      const d = canPublish(p, { sponsorDeposit: usdc('1.99'), marketingUsed: 0 });
      expect(d).toMatchObject({ ok: false, reason: 'sponsor-below-floor' });
    }
  });
  it('accepts a sponsor at the floor', () => {
    expect(canPublish(L, { sponsorDeposit: usdc('2.00'), marketingUsed: 0 })).toEqual({ ok: true, basis: 'sponsored', marketingLeft: null });
    expect(canPublish(H, { sponsorDeposit: usdc('2.00'), marketingUsed: 40 })).toEqual({ ok: true, basis: 'sponsored', marketingLeft: 0 });
  });
  it('lets hackathon publish unsponsored until the cap', () => {
    expect(canPublish(H, { sponsorDeposit: null, marketingUsed: 0 })).toEqual({ ok: true, basis: 'marketing-cap', marketingLeft: 39 });
    expect(canPublish(H, { sponsorDeposit: null, marketingUsed: 39 })).toEqual({ ok: true, basis: 'marketing-cap', marketingLeft: 0 });
    expect(canPublish(H, { sponsorDeposit: null, marketingUsed: 40 })).toMatchObject({ ok: false, reason: 'marketing-cap-reached' });
  });
  it('requires a sponsor at launch', () => {
    expect(canPublish(L, { sponsorDeposit: null, marketingUsed: 0 })).toMatchObject({ ok: false, reason: 'sponsor-required' });
  });
});

describe('marketingBudgetLeft', () => {
  it('is the full budget at 0 used and zero at the cap', () => {
    expect(marketingBudgetLeft(H, 0)).toBe(usdc('46.06'));
    expect(marketingBudgetLeft(H, 40)).toBe(usdc('0'));
    expect(marketingBudgetLeft(H, 99)).toBe(usdc('0'));
  });
  it('shrinks monotonically per case', () => {
    const a = marketingBudgetLeft(H, 1)!;
    const b = marketingBudgetLeft(H, 2)!;
    expect(a < usdc('46.06')).toBe(true);
    expect(b < a).toBe(true);
  });
  it('is null when no budget applies', () => {
    expect(marketingBudgetLeft(L, 3)).toBeNull();
  });
});

describe('targetBreakdown', () => {
  it.each([['hackathon', H], ['launch', L]] as const)('sums to the target (%s)', (_n, p) => {
    const b = targetBreakdown(termsFor(p.config, { ballot: ['A', 'B'], sponsorDeposit: null }));
    expect(b.target).toBe(p.target);
    expect(b.juryPool + b.protocolFee + b.aiFee).toBe(b.target);
    expect(b.jurors).toBe(7);
    expect(b.rewardPerJuror).toBe(usdc('0.90'));
  });
  it('reports hackathon amounts', () => {
    const b = targetBreakdown(grandJuryMode.terms({ ballot: ['A', 'B'], sponsorDeposit: null }));
    expect(formatUsdc(b.target)).toBe('7.30 USDC');
  });
});

describe('cross-source consistency', () => {
  const terms = JSON.parse(readFileSync(new URL('../../../../contracts/config/terms.json', import.meta.url), 'utf8')) as {
    modes: Record<string, Record<string, number>>;
    marketingCap: Record<string, number>;
  };
  const decisions = readFileSync(new URL('../../../../docs/DECISIONS.md', import.meta.url), 'utf8');
  const u = (n: number) => BigInt(n);

  it.each([['grandJuryHackathon', H], ['grandJuryLaunch', L]] as const)('terms.json %s matches PRICING', (key, p) => {
    const m = terms.modes[key]!;
    expect(2 * m.n! + 1).toBe(p.jurors);
    expect(u(m.bond!)).toBe(p.bond);
    expect(u(m.successBonus!)).toBe(p.successBonus);
    expect(u(m.protocolFee!)).toBe(p.protocolFee);
    expect(u(m.aiFeePerAgent!)).toBe(p.aiFee);
    expect(u(m.minContribution!)).toBe(p.minContribution);
    expect(u(m.sponsorFloor!)).toBe(p.sponsorFloor);
  });
  it('terms.json marketing cap for hackathon is 40', () => {
    expect(terms.marketingCap.hackathon).toBe(40);
    expect(H.marketingCap).toBe(terms.marketingCap.hackathon);
  });
  it('DECISIONS.md states the launch target and the cap', () => {
    expect(decisions).toContain('Crowdfund target | **7.80**');
    expect(decisions).toContain('≤ 40 cases');
  });
});

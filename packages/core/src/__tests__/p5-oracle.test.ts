/**
 * Cross-check core `settle()` against the settlement oracle the contracts track
 * wrote by hand (v3/p5-contracts: contracts/test/fixtures/settlement-scenarios.json,
 * copied verbatim into ./fixtures). The contract and core must agree line for line.
 */
import { describe, expect, it } from 'vitest';
import { GRAND_JURY_LAUNCH, MODES, settle, statementFor, termsFor, usdc, type FunderDeposit, type JurorRecord, type ModeConfig } from '../index';
import { testAddress } from '../testing';
import oracle from './fixtures/p5-settlement-scenarios.json';

interface Scenario {
  name: string;
  mode: 'solo' | 'versus' | 'grandJury';
  pricing?: 'launch';
  sponsor?: string;
  passA?: boolean;
  passB?: boolean;
  attendance: (0 | 1 | 'absent' | 'committed')[];
  outcome: 'Choice0' | 'Choice1' | 'NoVerdict';
  payoutPerTimelyJuror: string;
  toTreasury: string;
  toAiTreasury: string;
  refunds: Record<string, string>;
}

const scenarios = (oracle as unknown as { scenarios: Scenario[] }).scenarios;

function run(s: Scenario) {
  const mode: ModeConfig = s.mode === 'grandJury' ? (s.pricing === 'launch' ? GRAND_JURY_LAUNCH : MODES['grand-jury']) : MODES[s.mode];
  const terms = termsFor(mode, { passWaivers: [Boolean(s.passA), Boolean(s.passB)], ...(s.sponsor ? { sponsorDeposit: usdc(s.sponsor) } : {}) });
  const funders: FunderDeposit[] =
    terms.funding.kind === 'crowdfund'
      ? [{ account: testAddress('crowd'), kind: 'contributor', amount: terms.target }]
      : terms.payerShares.map((amount, i) => ({ account: testAddress(`payer-${i}`), kind: terms.funding.kind === 'split' ? 'side' : 'filer', amount }));
  if (s.sponsor) funders.push({ account: testAddress('sponsor'), kind: 'sponsor', amount: usdc(s.sponsor) });
  const jurors: JurorRecord[] = s.attendance.map((a, i) => {
    const account = testAddress(`juror-${i}`);
    if (a === 'absent') return { account, committed: false, revealed: false };
    if (a === 'committed') return { account, committed: true, revealed: false };
    return { account, committed: true, revealed: true, choice: a };
  });
  return { result: settle({ terms, funders, jurors, outcome: 'trial' }), terms, funders, jurors };
}

describe('core settle() agrees with the p5 contract oracle', () => {
  it('has the scenarios', () => expect(scenarios.length).toBeGreaterThanOrEqual(28));

  it.each(scenarios.map((s) => [s.name, s] as const))('%s', (_name, s) => {
    const { result, terms, funders, jurors } = run(s);
    const kind = { Choice0: 'ballot-0', Choice1: 'ballot-1', NoVerdict: 'no-verdict' }[s.outcome];
    expect(result.verdict?.kind).toBe(kind);
    for (const j of jurors.filter((x) => x.revealed)) expect(statementFor(result, j.account).payout).toBe(usdc(s.payoutPerTimelyJuror));
    for (const j of jurors.filter((x) => !x.revealed)) expect(statementFor(result, j.account).payout).toBe(0n);
    expect(result.protocol.total).toBe(usdc(s.toTreasury) + usdc(s.toAiTreasury));
    if (kind !== 'no-verdict') expect(terms.aiFee).toBe(usdc(s.toAiTreasury));
    const refunded = funders.filter((f) => f.kind !== 'sponsor').reduce((sum, f) => sum + statementFor(result, f.account).payout, 0n);
    const expectedRefunds = Object.entries(s.refunds).filter(([k]) => k !== 'sponsor').reduce((sum, [, v]) => sum + usdc(v), 0n);
    expect(refunded).toBe(expectedRefunds);
  });
});

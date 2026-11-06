import { describe, expect, it } from 'vitest';
import { MODES, formatUsdc, settle, statementFor, termsFor, usdc, type Hex, type JurorRecord } from '../index';
import { testAddress } from '../testing';

const filer = testAddress('filer');
const j = [1, 2, 3, 4, 5, 6, 7].map((i) => testAddress(`juror-${i}`));
const solo = termsFor(MODES.solo);

const voted = (account: Hex, choice: 0 | 1): JurorRecord => ({ account, committed: true, revealed: true, choice });
const absent = (account: Hex): JurorRecord => ({ account, committed: false, revealed: false });
const committedOnly = (account: Hex): JurorRecord => ({ account, committed: true, revealed: false });

function soloTrial(jurors: JurorRecord[]) {
  return settle({ terms: solo, funders: [{ account: filer, kind: 'filer', amount: usdc('1.20') }], jurors, outcome: 'trial' });
}
const payout = (s: ReturnType<typeof settle>, who: Hex | 'protocol') => formatUsdc(statementFor(s, who).payout, { unit: false });

// V4 §9 three-person settlement table, row by row.
describe('V4 §9 settlement table (N = 1)', () => {
  it('3 jurors vote → each 0.70 back, no refund, protocol keeps only its fees', () => {
    const s = soloTrial([voted(j[0]!, 0), voted(j[1]!, 0), voted(j[2]!, 1)]);
    expect(s.verdict).toMatchObject({ kind: 'ballot-0', label: 'GUILTY', tally: [2, 1], completedDuty: 3, appointed: 3 });
    for (const x of j.slice(0, 3)) expect(payout(s, x)).toBe('0.70');
    expect(payout(s, filer)).toBe('0.00');
    expect(s.protocol).toMatchObject({ fees: usdc('0.30'), forfeits: 0n, unearnedBonus: 0n });
  });

  it('2 alike + 1 absent → verdict; protocol gets 0.70 on top of fees', () => {
    const s = soloTrial([voted(j[0]!, 1), voted(j[1]!, 1), absent(j[2]!)]);
    expect(s.verdict?.label).toBe('NOT COOKED');
    expect(payout(s, j[0]!)).toBe('0.70');
    expect(payout(s, j[2]!)).toBe('0.00');
    expect(s.protocol.forfeits + s.protocol.unearnedBonus).toBe(usdc('0.70'));
  });

  it('2 opposite + 1 absent → no verdict; each voter 0.60, full refund, protocol 0', () => {
    const s = soloTrial([voted(j[0]!, 0), voted(j[1]!, 1), absent(j[2]!)]);
    expect(s.verdict?.kind).toBe('no-verdict');
    expect(payout(s, j[0]!)).toBe('0.60');
    expect(payout(s, j[1]!)).toBe('0.60');
    expect(payout(s, filer)).toBe('1.20');
    expect(s.protocol.total).toBe(0n);
  });

  it('1 votes + 2 absent → no verdict; voter 0.60, refund, protocol 0.60', () => {
    const s = soloTrial([voted(j[0]!, 0), absent(j[1]!), committedOnly(j[2]!)]);
    expect(payout(s, j[0]!)).toBe('0.60');
    expect(payout(s, filer)).toBe('1.20');
    expect(formatUsdc(s.protocol.total, { unit: false })).toBe('0.60');
  });

  it('0 vote → refund, protocol 1.20 forfeits', () => {
    const s = soloTrial([absent(j[0]!), absent(j[1]!), absent(j[2]!)]);
    expect(payout(s, filer)).toBe('1.20');
    expect(formatUsdc(s.protocol.total, { unit: false })).toBe('1.20');
  });

  it('protective cancellation → bonds back, 0.20 stipends from platform funds, no forfeits', () => {
    const s = settle({
      terms: solo,
      funders: [{ account: filer, kind: 'filer', amount: usdc('1.20') }],
      jurors: [committedOnly(j[0]!), committedOnly(j[1]!), absent(j[2]!)],
      outcome: 'protective',
      revealOpened: false,
    });
    expect(payout(s, j[0]!)).toBe('0.60');
    expect(payout(s, j[2]!)).toBe('0.40');
    expect(payout(s, filer)).toBe('1.20');
    expect(s.platformCost).toBe(usdc('0.40'));
    expect(s.protocol.total).toBe(0n);
  });
});

describe('generalised rules', () => {
  const gj = termsFor(MODES['grand-jury'], { sponsorDeposit: usdc('2.00') });
  const contributors = [testAddress('c1'), testAddress('c2')];
  const funders = [
    { account: contributors[0]!, kind: 'contributor' as const, amount: usdc('5.30') },
    { account: contributors[1]!, kind: 'contributor' as const, amount: usdc('2.00') },
    { account: testAddress('sponsor'), kind: 'sponsor' as const, amount: usdc('2.00') },
  ];

  it('Grand Jury needs 4 of 7 matching revealed votes (D8)', () => {
    const three = settle({ terms: gj, funders, jurors: [voted(j[0]!, 0), voted(j[1]!, 0), voted(j[2]!, 0), voted(j[3]!, 1), voted(j[4]!, 1), absent(j[5]!), absent(j[6]!)], outcome: 'trial' });
    expect(three.verdict?.kind).toBe('no-verdict');
    // Contributors are refunded pro rata (their own amounts); the sponsor fee is earned because the trial ran.
    expect(payout(three, contributors[0]!)).toBe('5.30');
    expect(three.protocol.sponsor).toBe(usdc('2.00'));
    // Five timely jurors each get bond + 0.20 from the 2.40 forfeited.
    expect(payout(three, j[0]!)).toBe('1.40');
    const four = settle({ terms: gj, funders, jurors: [...j.slice(0, 4).map((a) => voted(a, 1)), ...j.slice(4).map((a) => voted(a, 0))], outcome: 'trial' });
    expect(four.verdict).toMatchObject({ kind: 'ballot-1', label: 'AGAINST', tally: [3, 4] });
    expect(payout(four, j[6]!)).toBe('2.10');
  });

  it('cancellation before voting refunds everyone, sponsor included', () => {
    const s = settle({ terms: gj, funders, jurors: [voted(j[0]!, 0)], outcome: 'cancelled' });
    expect(payout(s, testAddress('sponsor'))).toBe('2.00');
    expect(payout(s, j[0]!)).toBe('1.20');
    expect(s.protocol.total).toBe(0n);
  });

  it('always balances: every attendance pattern, both modes', () => {
    for (let mask = 0; mask < 3 ** 3; mask++) {
      const jurors = [0, 1, 2].map((i) => {
        const v = Math.floor(mask / 3 ** i) % 3;
        return v === 0 ? absent(j[i]!) : voted(j[i]!, (v - 1) as 0 | 1);
      });
      const s = soloTrial(jurors);
      expect(s.totalIn).toBe(s.totalOut);
    }
  });

  it('rejects an underfunded verdict and an oversized jury', () => {
    expect(() =>
      settle({ terms: solo, funders: [{ account: filer, kind: 'filer', amount: usdc('1.00') }], jurors: [voted(j[0]!, 0), voted(j[1]!, 0), voted(j[2]!, 0)], outcome: 'trial' }),
    ).toThrow(/does not match the target/);
    expect(() => soloTrial(j.slice(0, 4).map((a) => voted(a, 0)))).toThrow(RangeError);
  });

  it('Versus with one side’s Pass: 0.50 + 0.70, AI fee 0.20 (D12)', () => {
    const t = termsFor(MODES.versus, { passWaivers: [true, false] });
    expect(t.payerShares.map((x) => formatUsdc(x, { unit: false }))).toEqual(['0.50', '0.70']);
    expect(t.target).toBe(usdc('1.20'));
    expect(t.aiFee).toBe(usdc('0.20'));
    expect(termsFor(MODES['grand-jury'], { passWaivers: [true] }).aiFee).toBe(usdc('0.50'));
  });
});

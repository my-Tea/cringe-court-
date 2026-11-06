import { ROLES } from '@cringe-court/chain-client';
import {
  ChainError,
  MODES,
  keccak256,
  termsFor,
  usdc,
  type CaseNumber,
  type ChainEvent,
  type Hex,
} from '@cringe-court/core';
import { testAddress } from '@cringe-court/core/testing';
import { describe, expect, it } from 'vitest';
import { readPlatformConfig } from '../config';
import type { ArcLedger } from './arcLedger';
import { createLedger } from './createLedger';

const T = (label: string) => testAddress(label);
const H = (label: string) => keccak256(label);
const sum = (xs: readonly bigint[]) => xs.reduce((a, b) => a + b, 0n);

function world() {
  const ledger = createLedger(readPlatformConfig({}));
  const demo = ledger.demo!;
  const port = ledger.port;
  const actor = (name: string, funds = '5') => {
    const a = T(name);
    demo.faucet(a, usdc(funds));
    return { account: a, ledger: port.as(a) };
  };
  return { ledger, demo, port, actor };
}

async function expectChainError(p: Promise<unknown>, code: ChainError['code']) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ChainError);
  expect((err as ChainError).code).toBe(code);
}

async function seatJury(port: ArcLedger, actor: ReturnType<typeof world>['actor'], n: CaseNumber, count: number) {
  const jurors = [];
  for (let i = 0; i < count; i++) {
    const j = actor(`juror-${i}`);
    await j.ledger.acceptSeat(n, H(`nullifier-${i}`));
    jurors.push(j);
  }
  expect(port).toBeDefined();
  return jurors;
}

describe('ArcLedger over createMemoryChain: Solo lifecycle', () => {
  it('create → fund → seats → court opens → commit → reveal → finalize → claim', async () => {
    const w = world();
    const filer = w.actor('filer', '2');
    const terms = termsFor(MODES.solo);
    const events: ChainEvent[] = [];
    w.port.subscribe('*', (e) => events.push(e));

    const transcriptHash = H('solo transcript');
    const opened = await filer.ledger.createCase({ terms, transcriptHash, payers: [filer.account], title: 'Reply-all' });
    const n = opened.caseNumber;
    expect(opened.receipt.explorerUrl).toContain('memory://');
    // Solo pays inside createCase; fund returns that same receipt, once.
    expect(await filer.ledger.fund(n, terms.payerShares[0]!)).toEqual(opened.receipt);
    await expectChainError(filer.ledger.fund(n, terms.payerShares[0]!), 'duplicate');
    expect(await w.port.usdcBalance(filer.account)).toBe(usdc('0.80'));

    let c = (await w.port.getCase(n))!;
    expect(c.phase).toBe('recruiting');
    expect(c.title).toBe('Reply-all');
    expect(c.transcriptHash).toBe(transcriptHash);
    expect(c.raised).toBe(usdc('1.20'));
    expect(c.deadlines.recruitment).not.toBeNull();

    const jurors = await seatJury(w.port, w.actor, n, 3);
    c = (await w.port.getCase(n))!;
    // The adapter sent the createCase transcript hash with openCourt when the jury filled.
    expect(c.phase).toBe('commit');
    expect(c.transcriptHash).toBe(transcriptHash);
    expect(c.seats.map((s) => s.seat)).toEqual([1, 2, 3]);
    expect(w.demo.chain.getCase(1n).transcriptHash).toBe(transcriptHash);

    const choices = [0, 0, 1] as const;
    const salts = jurors.map((_, i) => H(`salt-${i}`));
    for (const [i, j] of jurors.entries()) {
      const commitment = j.ledger.commitmentFor(n, j.account, choices[i]!, salts[i]!);
      await j.ledger.commit(n, commitment);
    }
    // A ballot stays secret on the ledger until it is revealed.
    expect((await w.port.getCase(n))!.seats.every((s) => s.committed && s.choice === undefined)).toBe(true);
    for (const [i, j] of jurors.entries()) await j.ledger.reveal(n, choices[i]!, salts[i]!);

    c = (await w.port.getCase(n))!;
    expect(c.phase).toBe('finalizing');
    await w.port.finalize(n);
    c = (await w.port.getCase(n))!;
    expect(c.phase).toBe('settled');
    expect(c.verdict).toMatchObject({ kind: 'ballot-0', label: 'GUILTY', tally: [2, 1], completedDuty: 3 });

    // Receipts add up to what went in: 1.20 funding + 3 × 0.40 bonds.
    const lines = await Promise.all(jurors.map((j) => w.port.receipts(n, j.account)));
    const jurorTotal = sum(lines.flat().map((l) => l.amount));
    expect(jurorTotal).toBe(3n * usdc('0.70'));
    expect(c.claimable.length).toBe(3);

    for (const j of jurors) await j.ledger.claim(n);
    for (const [i, j] of jurors.entries()) {
      expect(await w.port.usdcBalance(j.account)).toBe(usdc('5') - usdc('0.40') + usdc('0.70') + 0n * BigInt(i));
    }
    expect((await w.port.getCase(n))!.claimable).toEqual([]);
    expect(events.filter((e) => e.type === 'claimed').length).toBe(3);

    // Money conservation: the court holds only the reserve and the protocol's fees.
    const treasury = w.demo.chain.claimableOf(w.demo.chain.treasury) + w.demo.chain.claimableOf(w.demo.chain.aiTreasury);
    expect(treasury).toBe(usdc('0.30'));
    expect(w.demo.chain.courtBalance()).toBe(w.demo.chain.reserve().balance + treasury);

    const types = events.map((e) => e.type);
    for (const t of ['case-created', 'funded', 'seat-accepted', 'phase', 'committed', 'revealed', 'finalized', 'claimed'] as const) {
      expect(types).toContain(t);
    }
    expect(events.filter((e) => e.type === 'seat-accepted').map((e) => (e as { seat: number }).seat)).toEqual([1, 2, 3]);
  });

  it('timeout: the clock passes the recruiting deadline, advance cancels, claim refunds', async () => {
    const w = world();
    const filer = w.actor('filer', '2');
    const terms = termsFor(MODES.solo);
    const { caseNumber: n } = await filer.ledger.createCase({ terms, transcriptHash: H('t'), payers: [filer.account], title: 'Late' });
    await filer.ledger.fund(n, terms.payerShares[0]!);
    expect(await w.port.usdcBalance(filer.account)).toBe(usdc('0.80'));

    w.demo.advance(301);
    // Expired but not yet cancelled: the contract needs someone to call cancelExpired.
    expect((await w.port.getCase(n))!.phase).toBe('recruiting');
    await w.port.advance(n);
    expect((await w.port.getCase(n))!.phase).toBe('cancelled');
    expect((await w.port.receipts(n, filer.account)).map((l) => l.kind)).toEqual(['refund']);

    await filer.ledger.claim(n);
    expect(await w.port.usdcBalance(filer.account)).toBe(usdc('2'));
    await expectChainError(filer.ledger.claim(n), 'not-allowed');
  });

  it('claim on an Expired case cancels it first', async () => {
    const w = world();
    const filer = w.actor('filer', '2');
    const terms = termsFor(MODES.solo);
    const { caseNumber: n } = await filer.ledger.createCase({ terms, transcriptHash: H('t'), payers: [filer.account], title: 'Late' });
    w.demo.advance(301);
    await filer.ledger.claim(n);
    expect(await w.port.usdcBalance(filer.account)).toBe(usdc('2'));
  });

  it('a no-show jury forfeits bonds and the filer is refunded on NO VERDICT', async () => {
    const w = world();
    const filer = w.actor('filer', '2');
    const terms = termsFor(MODES.solo);
    const { caseNumber: n } = await filer.ledger.createCase({ terms, transcriptHash: H('t'), payers: [filer.account], title: 'Mistrial' });
    const jurors = await seatJury(w.port, w.actor, n, 3);
    const salt = H('s');
    await jurors[0]!.ledger.commit(n, jurors[0]!.ledger.commitmentFor(n, jurors[0]!.account, 0, salt));
    w.demo.advance(121);
    await jurors[0]!.ledger.reveal(n, 0, salt);
    w.demo.advance(121);
    expect((await w.port.getCase(n))!.phase).toBe('finalizing');
    await w.port.finalize(n);
    const c = (await w.port.getCase(n))!;
    expect(c.verdict?.kind).toBe('no-verdict');
    await filer.ledger.claim(n);
    expect(await w.port.usdcBalance(filer.account)).toBe(usdc('2'));
    expect((await w.port.receipts(n, jurors[1]!.account)).map((l) => l.kind)).toEqual(['forfeit']);
  });
});

describe('ArcLedger: Versus', () => {
  it('both sides fund, then the jury can sit', async () => {
    const w = world();
    const a = w.actor('side-a');
    const b = w.actor('side-b');
    const terms = termsFor(MODES.versus);
    const { caseNumber: n, receipt } = await a.ledger.createCase({ terms, transcriptHash: H('v'), payers: [a.account, b.account], title: 'Versus' });
    let c = (await w.port.getCase(n))!;
    expect(c.phase).toBe('pre-trial');
    expect(c.payers).toEqual([a.account, b.account]);
    expect(c.deposits).toHaveLength(1);
    expect(await a.ledger.fund(n, terms.payerShares[0]!)).toEqual(receipt);
    await expectChainError(w.actor('stranger').ledger.fund(n, terms.payerShares[1]!), 'not-allowed');
    await expectChainError(b.ledger.fund(n, usdc('0.10')), 'bad-amount');
    await b.ledger.fund(n, terms.payerShares[1]!);
    c = (await w.port.getCase(n))!;
    expect(c.phase).toBe('recruiting');
    expect(c.raised).toBe(usdc('1.40'));
    expect(c.deposits.map((d) => d.side)).toEqual(['a', 'b']);
    // A party cannot sit on their own jury.
    await expectChainError(a.ledger.acceptSeat(n, H('na')), 'not-allowed');
    expect(await w.port.usdcBalance(a.account)).toBe(usdc('5') - usdc('0.70'));
  });

  it('a Versus invite nobody answers expires and refunds Side A', async () => {
    const w = world();
    const a = w.actor('side-a');
    const b = T('side-b');
    const terms = termsFor(MODES.versus);
    const { caseNumber: n } = await a.ledger.createCase({ terms, transcriptHash: H('v'), payers: [a.account, b], title: 'Versus' });
    w.demo.advance(901);
    await w.port.advance(n);
    expect((await w.port.getCase(n))!.phase).toBe('cancelled');
    await a.ledger.claim(n);
    expect(await w.port.usdcBalance(a.account)).toBe(usdc('5'));
  });
});

describe('ArcLedger: Grand Jury', () => {
  it('crowdfund + sponsor, then a missed jury refunds contributors and the sponsor', async () => {
    const w = world();
    const sponsor = w.actor('sponsor', '5');
    const fans = [w.actor('fan-1'), w.actor('fan-2'), w.actor('fan-3')];
    const terms = termsFor(MODES['grand-jury']);
    const { caseNumber: n } = await sponsor.ledger.publishGrandJury({ transcriptHash: H('gj'), title: 'Is cereal soup?', sponsorAmount: usdc('2.00') });
    let c = (await w.port.getCase(n))!;
    expect(c.mode).toBe('grand-jury');
    expect(c.phase).toBe('pre-trial');
    expect(c.deposits.map((d) => d.kind)).toEqual(['sponsor']);
    await expectChainError(sponsor.ledger.sponsor(), 'not-allowed');

    await expectChainError(fans[0]!.ledger.fund(n, usdc('0.05')), 'bad-amount');
    await fans[0]!.ledger.fund(n, usdc('3.00'));
    await fans[1]!.ledger.fund(n, usdc('3.00'));
    await expectChainError(fans[2]!.ledger.fund(n, usdc('2.00')), 'bad-amount');
    await fans[2]!.ledger.fund(n, usdc('1.30'));
    c = (await w.port.getCase(n))!;
    expect(c.phase).toBe('recruiting');
    expect(c.raised).toBe(terms.target);
    expect(c.terms.jurySize).toBe(7);
    expect(c.deposits.map((d) => d.kind)).toEqual(['contributor', 'contributor', 'contributor', 'sponsor']);

    // Nobody sits: everything comes back.
    w.demo.advance(301);
    await w.port.advance(n);
    expect((await w.port.getCase(n))!.phase).toBe('cancelled');
    for (const p of [...fans, sponsor]) await p.ledger.claim(n);
    for (const f of fans) expect(await w.port.usdcBalance(f.account)).toBe(usdc('5'));
    expect(await w.port.usdcBalance(sponsor.account)).toBe(usdc('5'));
    expect(w.demo.chain.courtBalance()).toBe(w.demo.chain.reserve().balance);
  });

  it('createCase publishes an unsponsored Grand Jury case through the curator', async () => {
    const w = world();
    const fan = w.actor('fan');
    const terms = termsFor(MODES['grand-jury']);
    const { caseNumber } = await fan.ledger.createCase({ terms, transcriptHash: H('gj2'), payers: [], title: 'Marketing' });
    expect((await w.port.getCase(caseNumber))!.phase).toBe('pre-trial');
    expect((await w.port.listCases({ mode: 'grand-jury' })).map((c) => c.number)).toEqual([caseNumber]);
  });
});

describe('ArcLedger: errors', () => {
  it('maps contract reverts to core ChainError codes', async () => {
    const w = world();
    const filer = w.actor('filer', '2');
    const terms = termsFor(MODES.solo);
    const { caseNumber: n } = await filer.ledger.createCase({ terms, transcriptHash: H('t'), payers: [filer.account], title: 'Errors' });
    const [j0] = await seatJury(w.port, w.actor, n, 2);
    // Court is not open yet.
    await expectChainError(j0!.ledger.commit(n, H('c')), 'wrong-phase');
    await expectChainError(w.port.finalize(n), 'wrong-phase');
    await expectChainError(w.port.getCase(n).then(() => w.port.advance(999 as CaseNumber)), 'not-found');
    // The same juror cannot take two seats; one human cannot take two.
    await expectChainError(j0!.ledger.acceptSeat(n, H('other')), 'duplicate');
    const third = w.actor('third');
    await expectChainError(third.ledger.acceptSeat(n, H('nullifier-0')), 'duplicate');
    await third.ledger.acceptSeat(n, H('nullifier-2'));

    const salt = H('salt');
    await j0!.ledger.commit(n, j0!.ledger.commitmentFor(n, j0!.account, 1, salt));
    await expectChainError(j0!.ledger.reveal(n, 1, salt), 'wrong-phase');
    w.demo.advance(121);
    await expectChainError(j0!.ledger.reveal(n, 1, H('wrong salt')), 'bad-reveal');
    await expectChainError(j0!.ledger.reveal(n, 0, salt), 'bad-reveal');
    await j0!.ledger.reveal(n, 1, salt);
    await expectChainError(j0!.ledger.reveal(n, 1, salt), 'duplicate');
    await expectChainError(j0!.ledger.commit(n, H('late')), 'deadline');
    expect(() => j0!.ledger.commitmentFor(n, j0!.account, 1, '0x1234')).toThrow(ChainError);
  });

  it('refuses a case whose terms differ from the ledger, and a missing wallet', async () => {
    const w = world();
    const filer = w.actor('filer', '2');
    const waived = termsFor(MODES.solo, { passWaivers: [true] });
    await expectChainError(filer.ledger.createCase({ terms: waived, transcriptHash: H('t'), payers: [filer.account], title: 'Pass' }), 'bad-amount');
    const terms = termsFor(MODES.solo);
    await expectChainError(filer.ledger.createCase({ terms, transcriptHash: H('t'), payers: [T('someone-else')], title: 'x' }), 'not-allowed');
    // The default demo account has no USDC.
    await expectChainError(w.port.createCase({ terms, transcriptHash: H('t'), payers: [(await w.port.account())!], title: 'broke' }), 'bad-amount');
  });

  it('reports the memory chain as the arc-testnet network', async () => {
    const w = world();
    expect(w.port.id).toBe('memory');
    expect(w.port.network).toBe('arc-testnet');
    expect(w.port.chainId).toBe(5042002);
    expect(w.ledger.info.simulated).toBe(true);
    expect(w.demo.chain.hasRole(ROLES.ASSIGNER, w.demo.backend.assigner.address)).toBe(true);
    expect(await w.port.getCase(1 as CaseNumber)).toBeNull();
  });
});

export type { Hex };

import { caseNumber as toCaseNumber, type CaseNumber, type CasePhase, type Hex, type ReceiptLine } from '../case';
import { bytesToHex, concatBytes, hexToBytes, keccak256, uint256Word } from '../hash';
import { ZERO_USDC, addUsdc, formatUsdc, subUsdc, type Usdc } from '../money';
import type { ModeId } from '../modes';
import type { ChainCase, ChainDeposit, ChainEvent, ChainPort, ChainSeat, CreateCaseParams, Unsubscribe } from '../ports/chain';
import { ChainError } from '../ports/chain';
import type { TxReceipt } from '../ports/court';
import { settle, statementFor, type BallotChoice, type Settlement, type SettlementOutcome } from '../settlement';
import type { CaseTerms } from '../terms';

/** A clock tests can move. Unix seconds. */
export class ManualClock {
  constructor(public current = 1_767_225_600) {}
  now = (): number => this.current;
  advance(seconds: number): number {
    this.current += seconds;
    return this.current;
  }
}

interface Commitment {
  juror: Hex;
  nullifier: Hex;
  commitment: Hex | null;
  revealed: boolean;
  choice?: BallotChoice;
}

interface CaseRecord {
  number: CaseNumber;
  terms: CaseTerms;
  title: string;
  transcriptHash: Hex;
  payers: Hex[];
  deposits: ChainDeposit[];
  seats: Commitment[];
  phase: CasePhase;
  deadlines: ChainCase['deadlines'];
  settlement: Settlement | null;
  claimed: Set<string>;
  cancelReason: string | null;
}

interface Shared {
  cases: Map<number, CaseRecord>;
  balances: Map<string, Usdc>;
  listeners: Set<{ filter: CaseNumber | '*'; fn: (e: ChainEvent) => void }>;
  nextCase: number;
  tx: number;
  clock: () => number;
  /** Escrow account address, for balance accounting. */
  escrow: Hex;
}

const key = (a: Hex) => a.toLowerCase();
const ESCROW = '0x00000000000000000000000000000000c0c0c0c0' as Hex;

export interface MemoryChainOptions {
  clock?: () => number;
  /** First case number (default 69, like the stamp art). */
  firstCase?: number;
  account?: Hex | null;
}

/**
 * In-memory twin of the Arc court contract. Phases advance by time like the
 * contract's timestamp checks (lazily, on every call), money is exact, and
 * finalization settles with core `settle()`. `as(account)` returns a view that
 * signs as another account and shares the same ledger.
 */
export class MemoryChain implements ChainPort {
  readonly id = 'memory' as const;
  readonly network = 'arc-testnet' as const;
  readonly chainId = 5042002;
  readonly #s: Shared;
  readonly #account: Hex | null;

  constructor(options: MemoryChainOptions = {}, shared?: Shared) {
    this.#s = shared ?? {
      cases: new Map(),
      balances: new Map(),
      listeners: new Set(),
      nextCase: options.firstCase ?? 69,
      tx: 0,
      clock: options.clock ?? (() => Math.floor(Date.now() / 1000)),
      escrow: ESCROW,
    };
    this.#account = options.account ?? null;
  }

  /** A view of the same ledger signing as `account`. */
  as(account: Hex): MemoryChain {
    return new MemoryChain({ account }, this.#s);
  }

  /** Test faucet. */
  mint(account: Hex, amount: Usdc): void {
    this.#credit(account, amount);
  }

  async account(): Promise<Hex | null> {
    return this.#account;
  }

  async usdcBalance(account: Hex): Promise<Usdc> {
    return this.#s.balances.get(key(account)) ?? ZERO_USDC;
  }

  async createCase(params: CreateCaseParams): Promise<{ caseNumber: CaseNumber; receipt: TxReceipt }> {
    const t = params.terms;
    if (t.funding.kind !== 'crowdfund' && params.payers.length !== t.payerShares.length) {
      throw new ChainError('bad-amount', `Expected ${t.payerShares.length} payers, got ${params.payers.length}`);
    }
    const now = params.openedAt ?? this.#now();
    const number = toCaseNumber(this.#s.nextCase++);
    const record: CaseRecord = {
      number,
      terms: t,
      title: params.title,
      transcriptHash: params.transcriptHash,
      payers: params.payers.map((p) => p.toLowerCase() as Hex),
      deposits: [],
      seats: [],
      phase: 'pre-trial',
      deadlines: { funding: t.deadlines.preTrial === null ? null : now + t.deadlines.preTrial, recruitment: null, commit: null, reveal: null },
      settlement: null,
      claimed: new Set(),
      cancelReason: null,
    };
    this.#s.cases.set(number, record);
    this.#emit({ type: 'case-created', caseNumber: number, transcriptHash: params.transcriptHash });
    this.#emit({ type: 'phase', caseNumber: number, phase: 'pre-trial', endsAt: record.deadlines.funding });
    return { caseNumber: number, receipt: this.#receipt() };
  }

  async getCase(caseNumber: CaseNumber): Promise<ChainCase | null> {
    const c = this.#s.cases.get(caseNumber);
    if (!c) return null;
    this.#sync(c);
    return this.#view(c);
  }

  async listCases(filter: { mode?: ModeId; phase?: CasePhase } = {}): Promise<readonly ChainCase[]> {
    const out: ChainCase[] = [];
    for (const c of this.#s.cases.values()) {
      this.#sync(c);
      if (filter.mode && c.terms.mode !== filter.mode) continue;
      if (filter.phase && c.phase !== filter.phase) continue;
      out.push(this.#view(c));
    }
    return out;
  }

  async fund(caseNumber: CaseNumber, amount: Usdc): Promise<TxReceipt> {
    const c = this.#live(caseNumber, 'pre-trial');
    const me = this.#me();
    const t = c.terms;
    let kind: ChainDeposit['kind'];
    if (t.funding.kind === 'crowdfund') {
      if (amount < t.funding.minContribution) throw new ChainError('bad-amount', `Minimum contribution is ${formatUsdc(t.funding.minContribution)}`);
      const remaining = subUsdc(t.target, this.#raised(c));
      if (amount > remaining) throw new ChainError('bad-amount', `Only ${formatUsdc(remaining)} left to raise`);
      kind = 'contributor';
    } else {
      const index = c.payers.indexOf(key(me) as Hex);
      if (index < 0) throw new ChainError('not-allowed', 'Only a named payer can fund this case');
      if (c.deposits.some((d) => key(d.account) === key(me))) throw new ChainError('duplicate', 'Already paid');
      const share = t.payerShares[index]!;
      if (amount !== share) throw new ChainError('bad-amount', `Your share is ${formatUsdc(share)}`);
      kind = t.funding.kind === 'split' ? 'side' : 'filer';
    }
    this.#debit(me, amount);
    const deposit: ChainDeposit = { account: me, kind, amount };
    if (t.funding.kind === 'split') deposit.side = c.payers.indexOf(key(me) as Hex) === 0 ? 'a' : 'b';
    c.deposits.push(deposit);
    this.#emit({ type: 'funded', caseNumber, account: me, kind, amount, raised: this.#raised(c) });
    this.#maybeOpenRecruitment(c);
    return this.#receipt();
  }

  async sponsor(caseNumber: CaseNumber, amount: Usdc): Promise<TxReceipt> {
    const c = this.#live(caseNumber, 'pre-trial');
    const t = c.terms;
    if (t.funding.kind !== 'crowdfund') throw new ChainError('not-allowed', 'Only Grand Jury cases take a sponsor');
    if (c.deposits.some((d) => d.kind === 'sponsor')) throw new ChainError('duplicate', 'The sponsor slot is taken');
    if (t.sponsorDeposit !== null && amount < t.sponsorDeposit) throw new ChainError('bad-amount', `Sponsor deposit is at least ${formatUsdc(t.sponsorDeposit)}`);
    const me = this.#me();
    this.#debit(me, amount);
    c.deposits.push({ account: me, kind: 'sponsor', amount });
    this.#emit({ type: 'funded', caseNumber, account: me, kind: 'sponsor', amount, raised: this.#raised(c) });
    this.#maybeOpenRecruitment(c);
    return this.#receipt();
  }

  async acceptSeat(caseNumber: CaseNumber, nullifier: Hex): Promise<TxReceipt> {
    const c = this.#live(caseNumber, 'recruiting');
    const me = this.#me();
    if (c.payers.includes(key(me) as Hex) || c.deposits.some((d) => key(d.account) === key(me) && d.kind !== 'contributor')) {
      throw new ChainError('not-allowed', 'A party cannot sit on their own jury');
    }
    if (c.seats.some((s) => key(s.juror) === key(me))) throw new ChainError('duplicate', 'You already have a seat');
    if (c.seats.some((s) => key(s.nullifier) === key(nullifier))) throw new ChainError('duplicate', 'This human already has a seat (World ID)');
    if (c.seats.length >= c.terms.jurySize) throw new ChainError('wrong-phase', 'The jury is full');
    this.#debit(me, c.terms.bondPerJuror);
    c.seats.push({ juror: me, nullifier, commitment: null, revealed: false });
    this.#emit({ type: 'seat-accepted', caseNumber, juror: me, seat: c.seats.length });
    if (c.seats.length === c.terms.jurySize) {
      const now = this.#now();
      c.deadlines.commit = now + c.terms.deadlines.commit;
      c.deadlines.reveal = c.deadlines.commit + c.terms.deadlines.reveal;
      this.#setPhase(c, 'preparing', null);
      this.#setPhase(c, 'commit', c.deadlines.commit);
    }
    return this.#receipt();
  }

  commitmentFor(caseNumber: CaseNumber, juror: Hex, choice: BallotChoice, salt: Hex): Hex {
    const saltBytes = hexToBytes(salt);
    if (saltBytes.length !== 32) throw new ChainError('bad-reveal', 'Salt must be 32 bytes');
    const addr = new Uint8Array(32);
    addr.set(hexToBytes(juror), 12);
    return keccak256(concatBytes(uint256Word(caseNumber), addr, uint256Word(choice), saltBytes));
  }

  async commit(caseNumber: CaseNumber, commitment: Hex): Promise<TxReceipt> {
    const c = this.#live(caseNumber, 'commit');
    const seat = this.#seat(c);
    if (seat.commitment) throw new ChainError('duplicate', 'Already committed');
    seat.commitment = commitment;
    this.#emit({ type: 'committed', caseNumber, juror: seat.juror });
    return this.#receipt();
  }

  async reveal(caseNumber: CaseNumber, choice: BallotChoice, salt: Hex): Promise<TxReceipt> {
    const c = this.#live(caseNumber, 'reveal');
    const seat = this.#seat(c);
    if (!seat.commitment) throw new ChainError('not-allowed', 'No commitment to reveal');
    if (seat.revealed) throw new ChainError('duplicate', 'Already revealed');
    if (this.commitmentFor(caseNumber, seat.juror, choice, salt) !== seat.commitment) {
      throw new ChainError('bad-reveal', 'Choice and salt do not match your commitment');
    }
    seat.revealed = true;
    seat.choice = choice;
    this.#emit({ type: 'revealed', caseNumber, juror: seat.juror, choice });
    return this.#receipt();
  }

  async advance(caseNumber: CaseNumber): Promise<TxReceipt> {
    const c = this.#get(caseNumber);
    this.#sync(c);
    return this.#receipt();
  }

  async finalize(caseNumber: CaseNumber): Promise<TxReceipt> {
    const c = this.#live(caseNumber, 'finalizing');
    this.#settle(c, 'trial');
    const v = c.settlement!.verdict!;
    this.#setPhase(c, 'settled', null);
    this.#emit({ type: 'finalized', caseNumber, verdictKind: v.kind });
    return this.#receipt();
  }

  /** Admin twin of the contract's protective cancel (platform fault, V4 §8). */
  async protectiveCancel(caseNumber: CaseNumber): Promise<TxReceipt> {
    const c = this.#get(caseNumber);
    this.#sync(c);
    if (c.phase === 'settled' || c.phase === 'cancelled') throw new ChainError('wrong-phase', 'Case already closed');
    this.#cancel(c, 'protective', 'protective');
    return this.#receipt();
  }

  async claim(caseNumber: CaseNumber): Promise<TxReceipt> {
    const c = this.#get(caseNumber);
    this.#sync(c);
    if (!c.settlement) throw new ChainError('wrong-phase', 'Nothing to claim yet');
    const me = this.#me();
    if (c.claimed.has(key(me))) throw new ChainError('duplicate', 'Already claimed');
    const amount = statementFor(c.settlement, me.toLowerCase() as Hex).payout;
    if (amount === 0n) throw new ChainError('not-allowed', 'Nothing to claim');
    c.claimed.add(key(me));
    this.#move(this.#s.escrow, me, amount);
    this.#emit({ type: 'claimed', caseNumber, account: me, amount });
    return this.#receipt();
  }

  async receipts(caseNumber: CaseNumber, account: Hex): Promise<readonly ReceiptLine[]> {
    const c = this.#get(caseNumber);
    this.#sync(c);
    return c.settlement ? statementFor(c.settlement, account.toLowerCase() as Hex).lines : [];
  }

  /** The settlement once a case finalized or was cancelled (test helper). */
  settlementOf(caseNumber: CaseNumber): Settlement | null {
    return this.#get(caseNumber).settlement;
  }

  subscribe(caseNumber: CaseNumber | '*', listener: (event: ChainEvent) => void): Unsubscribe {
    const entry = { filter: caseNumber, fn: listener };
    this.#s.listeners.add(entry);
    return () => this.#s.listeners.delete(entry);
  }

  /* internals */

  #now(): number {
    return this.#s.clock();
  }

  #me(): Hex {
    if (!this.#account) throw new ChainError('not-allowed', 'Connect a wallet first');
    return this.#account.toLowerCase() as Hex;
  }

  #get(n: CaseNumber): CaseRecord {
    const c = this.#s.cases.get(n);
    if (!c) throw new ChainError('not-found', `No case ${n}`);
    return c;
  }

  #live(n: CaseNumber, phase: CasePhase): CaseRecord {
    const c = this.#get(n);
    this.#sync(c);
    if (c.phase !== phase) throw new ChainError(c.phase === 'cancelled' || c.phase === 'settled' ? 'wrong-phase' : 'deadline', `Case ${n} is in ${c.phase}, not ${phase}`);
    return c;
  }

  #seat(c: CaseRecord): Commitment {
    const me = this.#me();
    const seat = c.seats.find((s) => key(s.juror) === key(me));
    if (!seat) throw new ChainError('not-allowed', 'You are not seated on this case');
    return seat;
  }

  #raised(c: CaseRecord): Usdc {
    return addUsdc(ZERO_USDC, ...c.deposits.filter((d) => d.kind !== 'sponsor').map((d) => d.amount));
  }

  #maybeOpenRecruitment(c: CaseRecord): void {
    const sponsorOk = c.terms.sponsorDeposit === null || c.deposits.some((d) => d.kind === 'sponsor');
    if (this.#raised(c) >= c.terms.target && sponsorOk) {
      c.deadlines.recruitment = this.#now() + c.terms.deadlines.recruitment;
      this.#setPhase(c, 'recruiting', c.deadlines.recruitment);
    }
  }

  /** Time-driven transitions, like the contract's `block.timestamp` checks. */
  #sync(c: CaseRecord): void {
    const now = this.#now();
    if (c.phase === 'pre-trial' && c.deadlines.funding !== null && now >= c.deadlines.funding) this.#cancel(c, 'funding-missed', 'cancelled');
    if (c.phase === 'recruiting' && c.deadlines.recruitment !== null && now >= c.deadlines.recruitment) this.#cancel(c, 'jury-unfilled', 'cancelled');
    if (c.phase === 'commit' && c.deadlines.commit !== null && now >= c.deadlines.commit) this.#setPhase(c, 'reveal', c.deadlines.reveal);
    if (c.phase === 'reveal' && c.deadlines.reveal !== null && now >= c.deadlines.reveal) this.#setPhase(c, 'finalizing', null);
  }

  #cancel(c: CaseRecord, reason: string, outcome: SettlementOutcome): void {
    c.cancelReason = reason;
    this.#settle(c, outcome);
    this.#setPhase(c, 'cancelled', null);
    this.#emit({ type: 'cancelled', caseNumber: c.number, reason });
  }

  #settle(c: CaseRecord, outcome: SettlementOutcome): void {
    const settlement = settle({
      terms: c.terms,
      funders: c.deposits.map((d) => ({ account: d.account, kind: d.kind, amount: d.amount })),
      jurors: c.seats.map((s) => {
        const r = { account: s.juror, committed: s.commitment !== null, revealed: s.revealed } as {
          account: Hex;
          committed: boolean;
          revealed: boolean;
          choice?: BallotChoice;
        };
        if (s.choice !== undefined) r.choice = s.choice;
        return r;
      }),
      outcome,
      revealOpened: c.phase === 'reveal' || c.phase === 'finalizing',
    });
    // Platform-funded stipends enter escrow so claims stay balanced.
    if (settlement.platformCost > 0n) this.#credit(this.#s.escrow, settlement.platformCost);
    c.settlement = settlement;
  }

  #setPhase(c: CaseRecord, phase: CasePhase, endsAt: number | null): void {
    c.phase = phase;
    this.#emit({ type: 'phase', caseNumber: c.number, phase, endsAt });
  }

  #view(c: CaseRecord): ChainCase {
    const seats: ChainSeat[] = c.seats.map((s, i) => {
      const seat: ChainSeat = { seat: i + 1, juror: s.juror, committed: s.commitment !== null, revealed: s.revealed };
      if (s.revealed && s.choice !== undefined) seat.choice = s.choice;
      return seat;
    });
    const endsAt =
      c.phase === 'pre-trial'
        ? c.deadlines.funding
        : c.phase === 'recruiting'
          ? c.deadlines.recruitment
          : c.phase === 'commit'
            ? c.deadlines.commit
            : c.phase === 'reveal'
              ? c.deadlines.reveal
              : null;
    const claimable = c.settlement
      ? c.settlement.statements
          .filter((s) => s.party !== 'protocol' && s.party !== 'platform' && s.payout > 0n && !c.claimed.has(key(s.party as Hex)))
          .map((s) => s.party as Hex)
      : [];
    return {
      number: c.number,
      mode: c.terms.mode,
      category: 'internet-crimes',
      title: c.title,
      phase: c.phase,
      phaseEndsAt: endsAt,
      transcriptHash: c.transcriptHash,
      verdict: c.settlement?.verdict ?? null,
      terms: c.terms,
      payers: c.payers,
      deposits: [...c.deposits],
      raised: this.#raised(c),
      seats,
      deadlines: { ...c.deadlines },
      claimable,
    };
  }

  #credit(account: Hex, amount: Usdc): void {
    const k = key(account);
    this.#s.balances.set(k, addUsdc(this.#s.balances.get(k) ?? ZERO_USDC, amount));
  }

  #debit(account: Hex, amount: Usdc): void {
    const k = key(account);
    const have = this.#s.balances.get(k) ?? ZERO_USDC;
    if (have < amount) throw new ChainError('bad-amount', `Insufficient test USDC: have ${formatUsdc(have)}, need ${formatUsdc(amount)}`);
    this.#s.balances.set(k, subUsdc(have, amount));
    this.#credit(this.#s.escrow, amount);
  }

  #move(from: Hex, to: Hex, amount: Usdc): void {
    const k = key(from);
    this.#s.balances.set(k, subUsdc(this.#s.balances.get(k) ?? ZERO_USDC, amount));
    this.#credit(to, amount);
  }

  #receipt(): TxReceipt {
    const hash = keccak256(`memory-tx-${++this.#s.tx}`);
    return { hash, explorerUrl: `memory://arc-testnet/tx/${hash}` };
  }

  #emit(event: ChainEvent): void {
    for (const l of [...this.#s.listeners]) {
      if (l.filter === '*' || l.filter === event.caseNumber) l.fn(event);
    }
  }
}

/** A deterministic 32-byte value from a label ("salt:juror-1"), for tests. */
export function testBytes32(label: string): Hex {
  return keccak256(label);
}

/** A deterministic test address from a label. */
export function testAddress(label: string): Hex {
  return bytesToHex(hexToBytes(keccak256(`address:${label}`)).slice(12));
}

/**
 * ArcLedger: core's app-level ChainPort over p5's contract-shaped ChainPort
 * (`@cringe-court/chain-client`). Works identically over `createMemoryChain()`
 * and `createViemChainPort()`. Mapping table: docs/ENGINE.md, "Alignment with
 * v3/p5-contracts".
 *
 * Bridged differences, in short:
 * - Solo and Versus side A pay inside `createCase` (fileSolo / openVersus); the
 *   following `fund()` by that payer returns that transaction's receipt.
 * - The contract records the transcript hash at `openCourt`; the adapter sends
 *   the hash given to `createCase` (stored as the contract's content hash) when
 *   the jury fills, through the injected `CourtBackend` (an OPERATOR role).
 * - `acceptSeat` needs an ASSIGNER-signed offer from the injected `SeatOfferSource`.
 */
import type {
  Mode as ChainMode} from '@cringe-court/chain-client';
import {
  CancelReason,
  commitmentOf,
  Phase as ChainPhase,
  Status,
  ZERO_ADDRESS,
  ZERO_HASH,
  type ChainPort as ChainClient,
  type CourtEvent,
  type SeatOffer,
  type Terms as ChainTerms,
} from '@cringe-court/chain-client';
import {
  ChainError,
  micro,
  settle,
  statementFor,
  type BallotChoice,
  type CaseNumber,
  type CasePhase,
  type ChainCase,
  type ChainDeposit,
  type ChainEvent,
  type ChainPort,
  type ChainSeat,
  type CreateCaseParams,
  type Hex,
  type ModeId,
  type ReceiptLine,
  type SettlementOutcome,
  type TxReceipt,
  type Unsubscribe,
  type Usdc,
  type Verdict,
  type JurorRecord,
} from '@cringe-court/core';
import {
  CANCEL_REASONS,
  casePhaseOf,
  caseIdOf,
  caseNumberOf,
  chainModeOf,
  modeIdOf,
  phaseEndsAtOf,
  termsFromChain,
  diffTerms,
  toChainError,
  usdcOf,
  verdictKindOf,
} from './mapping';
import { t } from '@/i18n';

export interface SeatOfferRequest {
  caseNumber: CaseNumber;
  caseId: bigint;
  juror: Hex;
  /** The World ID proof for this case's seat. */
  nullifier: Hex;
  chainId: bigint;
  court: Hex;
}

/** Where a signed EIP-712 seat offer comes from: the demo signs locally, Arc fetches from a relayer. */
export interface SeatOfferSource {
  offerFor(request: SeatOfferRequest): Promise<SeatOffer>;
}

/** The privileged roles the contract reserves for the court's backend (OPERATOR, CURATOR, party attestation). */
export interface CourtBackend {
  openCourt(caseId: bigint, transcriptHash: Hex): Promise<void>;
  publishGrandJury(p: { contentHash: Hex; sponsor?: Hex; sponsorAmount?: bigint }): Promise<{ caseId: bigint; txHash: Hex }>;
  /** Make sure a case party's wallet is attested as a human (demo only; Arc does this through World ID). */
  verifyParty?(wallet: Hex): Promise<void>;
}

/** Arc testnet has no relayer yet: say so instead of faking an offer. */
export class RelayerSeatOffers implements SeatOfferSource {
  async offerFor(): Promise<SeatOffer> {
    throw new ChainError('not-allowed', t('shell.ledger.error.noRelayer'));
  }
}

export interface ArcLedgerOptions {
  port: ChainClient;
  offers: SeatOfferSource;
  backend?: CourtBackend;
  /** A client acting as another account (memory chain only). */
  accountFor?: (account: Hex) => ChainClient;
  explorerTx?: (hash: Hex) => string;
  /** Called before every operation; the demo uses it to move the memory chain's clock to wall time. */
  sync?: () => void;
  /** Newest cases `listCases` reads (default 100). */
  listLimit?: number;
}

interface Shared {
  titles: Map<bigint, string>;
  transcripts: Map<bigint, Hex>;
  /** `${caseId}:${account}` -> receipt of the create transaction that already paid. */
  created: Map<string, TxReceipt>;
  contributors: Map<bigint, Map<string, bigint>>;
  modes: Map<bigint, ModeId>;
  listeners: Set<{ filter: CaseNumber | '*'; fn: (e: ChainEvent) => void }>;
  stop: (() => void) | null;
  queue: Promise<void>;
  backendErrors: ChainError[];
}

const lower = (a: string): Hex => a.toLowerCase() as Hex;
const key = (id: bigint, a: string) => `${id}:${a.toLowerCase()}`;
const num = (v: bigint): number | null => (v > 0n ? Number(v) : null);

export class ArcLedger implements ChainPort {
  readonly network = 'arc-testnet' as const;
  #port: ChainClient;
  readonly #o: ArcLedgerOptions;
  readonly #s: Shared;

  constructor(options: ArcLedgerOptions, shared?: Shared) {
    this.#o = options;
    this.#port = options.port;
    this.#s = shared ?? {
      titles: new Map(),
      transcripts: new Map(),
      created: new Map(),
      contributors: new Map(),
      modes: new Map(),
      listeners: new Set(),
      stop: null,
      queue: Promise.resolve(),
      backendErrors: [],
    };
  }

  get id(): 'arc-testnet' | 'memory' {
    return this.#port.kind === 'memory' ? 'memory' : 'arc-testnet';
  }
  get chainId(): number {
    return Number(this.#port.chainId);
  }
  /** The CringeCourt contract address. */
  get court(): Hex {
    return this.#port.court;
  }
  /** Backend failures that did not fail the user's call (e.g. the court could not be opened). */
  get backendErrors(): readonly ChainError[] {
    return this.#s.backendErrors;
  }

  /** A view over the same ledger signing as `account` (memory chain only). */
  as(account: Hex): ArcLedger {
    if (!this.#o.accountFor) throw new ChainError('not-allowed', t('shell.ledger.error.demoOnly'));
    return new ArcLedger({ ...this.#o, port: this.#o.accountFor(account) }, this.#s);
  }

  /** Swap in a wallet-backed client after the user connects (Arc). */
  attach(port: ChainClient): void {
    this.#port = port;
  }

  async account(): Promise<Hex | null> {
    return this.#port.account ? lower(this.#port.account) : null;
  }

  async usdcBalance(account: Hex): Promise<Usdc> {
    return this.#run(async () => usdcOf(await this.#port.usdcBalance(account)));
  }

  /** Contract terms for a mode (the Settings "Ledger" probe reads these). */
  termsOf(mode: ChainMode): Promise<ChainTerms> {
    return this.#run(() => this.#port.termsOf(mode));
  }

  /* ── cases ── */

  async createCase(params: CreateCaseParams): Promise<{ caseNumber: CaseNumber; receipt: TxReceipt }> {
    return this.#run(async () => {
      const me = this.#me();
      const mode = params.terms.mode;
      const chainTerms = await this.#port.termsOf(chainModeOf(mode));
      const diffs = diffTerms(params.terms, termsFromChain(mode, chainTerms));
      if (diffs.length > 0) throw new ChainError('bad-amount', t('shell.ledger.error.termsDiffer', { diffs: diffs.join('; ') }));
      const contentHash = params.transcriptHash;
      let caseId: bigint;
      let txHash: Hex;
      if (mode === 'solo') {
        if (params.payers.length !== 1 || lower(params.payers[0]!) !== lower(me)) throw new ChainError('not-allowed', t('shell.ledger.error.soloFiler'));
        await this.#o.backend?.verifyParty?.(me);
        await this.#allowance(me, params.terms.target);
        ({ caseId, txHash } = await this.#port.fileSolo({ contentHash }));
      } else if (mode === 'versus') {
        const [a, b] = params.payers;
        if (!a || !b || lower(a) !== lower(me)) throw new ChainError('not-allowed', t('shell.ledger.error.versusSideA'));
        await this.#o.backend?.verifyParty?.(me);
        await this.#allowance(me, params.terms.payerShares[0] ?? params.terms.target);
        ({ caseId, txHash } = await this.#port.openVersus({ sideB: b, contentHash }));
      } else {
        ({ caseId, txHash } = await this.#publish(contentHash));
      }
      this.#remember(caseId, mode, params.title, contentHash);
      const receipt = this.#receipt(txHash);
      if (mode !== 'grand-jury') this.#s.created.set(key(caseId, me), receipt);
      return { caseNumber: caseNumberOf(caseId), receipt };
    });
  }

  /**
   * Grand Jury with a sponsor. The contract takes the sponsor's deposit when the
   * case is published (curator role), so this is `createCase` plus the sponsor.
   * The connected account is the sponsor.
   */
  async publishGrandJury(p: { transcriptHash: Hex; title: string; sponsorAmount?: Usdc }): Promise<{ caseNumber: CaseNumber; receipt: TxReceipt }> {
    return this.#run(async () => {
      const me = this.#me();
      const amount = p.sponsorAmount ?? 0n;
      if (amount > 0n) await this.#allowance(me, amount);
      const r = await this.#publish(p.transcriptHash, amount > 0n ? { sponsor: me, sponsorAmount: amount } : {});
      this.#remember(r.caseId, 'grand-jury', p.title, p.transcriptHash);
      return { caseNumber: caseNumberOf(r.caseId), receipt: this.#receipt(r.txHash) };
    });
  }

  /** What each jury size costs, read from the contract so the screen cannot drift from it. */
  async soloPrice(jurors: number): Promise<{ price: Usdc; bond: Usdc; successBonus: Usdc }> {
    return this.#run(async () => {
      if (!this.#port.soloPrice) throw new ChainError('not-allowed', t('shell.ledger.error.noRelayer'));
      const p = await this.#port.soloPrice(jurors);
      return { price: usdcOf(p.price), bond: usdcOf(p.bond), successBonus: usdcOf(p.successBonus) };
    });
  }

  /** Stakes a Solo case before any script exists: the hash commits to the confession, not to a transcript. */
  async fileSoloJury(p: { title: string; contentHash: Hex; jurors: number; price: Usdc }): Promise<{ caseNumber: CaseNumber; receipt: TxReceipt }> {
    return this.#run(async () => {
      const me = this.#me();
      if (!this.#port.fileSoloJury) throw new ChainError('not-allowed', t('shell.ledger.error.noRelayer'));
      await this.#allowance(me, p.price);
      const { caseId, txHash } = await this.#port.fileSoloJury({ contentHash: p.contentHash, jurors: p.jurors });
      this.#remember(caseId, 'solo', p.title, p.contentHash);
      return { caseNumber: caseNumberOf(caseId), receipt: this.#receipt(txHash) };
    });
  }

  async getCase(caseNumber: CaseNumber): Promise<ChainCase | null> {
    return this.#run(() => this.#load(caseIdOf(caseNumber)));
  }

  async listCases(filter: { mode?: ModeId; phase?: CasePhase } = {}): Promise<readonly ChainCase[]> {
    return this.#run(async () => {
      const count = await this.#port.caseCount();
      const limit = BigInt(this.#o.listLimit ?? 100);
      const first = count > limit ? count - limit + 1n : 1n;
      const ids: bigint[] = [];
      for (let id = first; id <= count; id++) ids.push(id);
      const all = await Promise.all(ids.map((id) => this.#load(id)));
      return all.filter((c): c is ChainCase => c !== null && (!filter.mode || c.mode === filter.mode) && (!filter.phase || c.phase === filter.phase));
    });
  }

  /* ── money ── */

  async fund(caseNumber: CaseNumber, amount: Usdc): Promise<TxReceipt> {
    return this.#run(async () => {
      const me = this.#me();
      const id = caseIdOf(caseNumber);
      const v = await this.#port.getCase(id);
      if (v.status === Status.None) throw new ChainError('not-found', t('shell.ledger.error.noCase', { caseNumber: String(caseNumber) }));
      const mode = modeIdOf(v.mode);
      const terms = await this.#port.caseTerms(id);
      if (mode === 'grand-jury') {
        const remaining = v.target - v.raised;
        if (amount < terms.minContribution && amount < remaining) throw new ChainError('bad-amount', t('shell.ledger.error.minContribution'));
        if (amount > remaining) throw new ChainError('bad-amount', t('shell.ledger.error.leftToRaise', { amount: String(remaining) }));
        await this.#allowance(me, amount);
        const r = await this.#port.contribute(id, amount);
        const book = this.#s.contributors.get(id) ?? new Map<string, bigint>();
        book.set(lower(me), (book.get(lower(me)) ?? 0n) + r.accepted);
        this.#s.contributors.set(id, book);
        return this.#receipt(r.txHash);
      }
      const isCreator = lower(me) === lower(v.creator);
      const share = await this.#port.quote(chainModeOf(mode), isCreator, false);
      if (amount !== share) throw new ChainError('bad-amount', t('shell.ledger.error.yourShare', { amount: String(share) }));
      if (isCreator) {
        const k = key(id, me);
        const done = this.#s.created.get(k);
        if (!done) throw new ChainError('duplicate', t('shell.ledger.error.alreadyPaid'));
        this.#s.created.delete(k);
        return done;
      }
      await this.#o.backend?.verifyParty?.(me);
      await this.#allowance(me, share);
      return this.#receipt((await this.#port.joinVersus(id)).txHash);
    });
  }

  async sponsor(): Promise<TxReceipt> {
    throw new ChainError('not-allowed', t('shell.ledger.error.sponsorDeposit'));
  }

  /* ── the jury ── */

  async acceptSeat(caseNumber: CaseNumber, nullifier: Hex): Promise<TxReceipt> {
    return this.#run(async () => {
      const me = this.#me();
      const id = caseIdOf(caseNumber);
      const offer = await this.#o.offers.offerFor({ caseNumber, caseId: id, juror: me, nullifier, chainId: this.#port.chainId, court: this.#port.court });
      const t = await this.#port.caseTerms(id);
      await this.#allowance(me, t.bond);
      const r = await this.#port.acceptSeat(offer);
      const v = await this.#port.getCase(id);
      if (v.status === Status.Preparing) await this.#openCourt(id);
      return this.#receipt(r.txHash);
    });
  }

  commitmentFor(caseNumber: CaseNumber, juror: Hex, choice: BallotChoice, salt: Hex): Hex {
    if (!/^0x[0-9a-fA-F]{64}$/.test(salt)) throw new ChainError('bad-reveal', t('shell.ledger.error.salt'));
    return commitmentOf({ chainId: this.#port.chainId, court: this.#port.court, caseId: caseIdOf(caseNumber), juror, choice, salt });
  }

  async commit(caseNumber: CaseNumber, commitment: Hex): Promise<TxReceipt> {
    return this.#run(async () => this.#receipt((await this.#port.commitVote(caseIdOf(caseNumber), commitment)).txHash));
  }

  async reveal(caseNumber: CaseNumber, choice: BallotChoice, salt: Hex): Promise<TxReceipt> {
    return this.#run(async () => this.#receipt((await this.#port.revealVote(caseIdOf(caseNumber), choice, salt)).txHash));
  }

  /* ── closing ── */

  /** Sends a transaction only when the contract has a transition due; otherwise returns a zero-hash receipt. */
  async advance(caseNumber: CaseNumber): Promise<TxReceipt> {
    return this.#run(async () => {
      const id = caseIdOf(caseNumber);
      const phase = await this.#port.phaseOf(id);
      if (phase === ChainPhase.None) throw new ChainError('not-found', t('shell.ledger.error.noCase', { caseNumber: String(caseNumber) }));
      if (phase === ChainPhase.Expired) return this.#receipt((await this.#port.cancelExpired(id)).txHash);
      if (phase === ChainPhase.Preparing) await this.#openCourt(id);
      return this.#receipt(ZERO_HASH);
    });
  }

  async finalize(caseNumber: CaseNumber): Promise<TxReceipt> {
    return this.#run(async () => this.#receipt((await this.#port.finalize(caseIdOf(caseNumber))).txHash));
  }

  /** Refund (payers) and/or withdraw (jurors, sponsors). Expired cases are cancelled first. */
  async claim(caseNumber: CaseNumber): Promise<TxReceipt> {
    return this.#run(async () => {
      const me = this.#me();
      const id = caseIdOf(caseNumber);
      let phase = await this.#port.phaseOf(id);
      if (phase === ChainPhase.None) throw new ChainError('not-found', t('shell.ledger.error.noCase', { caseNumber: String(caseNumber) }));
      if (phase === ChainPhase.Expired) {
        await this.#port.cancelExpired(id);
        phase = ChainPhase.Cancelled;
      }
      if (phase !== ChainPhase.Finalized && phase !== ChainPhase.Cancelled) throw new ChainError('wrong-phase', t('shell.ledger.error.nothingYet'));
      let last: TxReceipt | null = null;
      if ((await this.#port.isRefundable(id)) && (await this.#port.paidBy(id, me)) > 0n) {
        const r = await this.#port.claimRefund(id);
        last = this.#receipt(r.txHash);
        this.#emit({ type: 'claimed', caseNumber, account: lower(me), amount: usdcOf(r.amount) });
      }
      if ((await this.#port.claimable(me)) > 0n) {
        const r = await this.#port.withdraw();
        last = this.#receipt(r.txHash);
        this.#emit({ type: 'claimed', caseNumber, account: lower(me), amount: usdcOf(r.amount) });
      }
      if (!last) throw new ChainError('not-allowed', t('shell.ledger.error.nothingToClaim'));
      return last;
    });
  }

  async receipts(caseNumber: CaseNumber, account: Hex): Promise<readonly ReceiptLine[]> {
    return this.#run(async () => {
      const id = caseIdOf(caseNumber);
      const v = await this.#port.getCase(id);
      const c = await this.#load(id);
      if (!c || v.status === Status.None) throw new ChainError('not-found', t('shell.ledger.error.noCase', { caseNumber: String(caseNumber) }));
      if (c.phase !== 'settled' && c.phase !== 'cancelled') return [];
      const outcome: SettlementOutcome = c.phase === 'settled' ? 'trial' : v.cancelReason === CancelReason.ProtectiveCancel ? 'protective' : 'cancelled';
      const jurors: JurorRecord[] = c.seats.map((s) => {
        const r: JurorRecord = { account: s.juror, committed: s.committed, revealed: s.revealed };
        if (s.choice !== undefined) r.choice = s.choice;
        return r;
      });
      const settlement = settle({
        terms: c.terms,
        funders: c.deposits.map((d) => ({ account: d.account, kind: d.kind, amount: d.amount })),
        jurors,
        outcome,
        revealOpened: v.committed === v.jurySize || (v.commitDeadline > 0n && (await this.#port.now()) >= v.commitDeadline),
      });
      return statementFor(settlement, lower(account)).lines;
    });
  }

  subscribe(caseNumber: CaseNumber | '*', listener: (event: ChainEvent) => void): Unsubscribe {
    const entry = { filter: caseNumber, fn: listener };
    this.#s.listeners.add(entry);
    if (!this.#s.stop) this.#s.stop = this.#port.onEvent((e) => this.#enqueue(e));
    return () => {
      this.#s.listeners.delete(entry);
      if (this.#s.listeners.size === 0 && this.#s.stop) {
        this.#s.stop();
        this.#s.stop = null;
      }
    };
  }

  /* ── internals ── */

  async #run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      this.#o.sync?.();
      return await fn();
    } catch (e) {
      throw toChainError(e);
    }
  }

  #me(): Hex {
    const a = this.#port.account;
    if (!a) throw new ChainError('not-allowed', t('shell.ledger.error.connectWallet'));
    return a;
  }

  #receipt(hash: Hex): TxReceipt {
    return { hash, explorerUrl: this.#o.explorerTx ? this.#o.explorerTx(hash) : `memory://arc-testnet/tx/${hash}` };
  }

  async #allowance(owner: Hex, amount: bigint): Promise<void> {
    if ((await this.#port.usdcAllowance(owner)) < amount) await this.#port.approveUsdc(amount);
  }

  #remember(id: bigint, mode: ModeId, title: string, hash: Hex): void {
    this.#s.titles.set(id, title);
    this.#s.transcripts.set(id, hash);
    this.#s.modes.set(id, mode);
  }

  async #publish(contentHash: Hex, sponsor: { sponsor?: Hex; sponsorAmount?: bigint } = {}): Promise<{ caseId: bigint; txHash: Hex }> {
    const backend = this.#o.backend;
    if (!backend) throw new ChainError('not-allowed', t('shell.ledger.error.curator'));
    return backend.publishGrandJury({ contentHash, ...sponsor });
  }

  async #openCourt(id: bigint): Promise<void> {
    const backend = this.#o.backend;
    if (!backend) return;
    try {
      const v = await this.#port.getCase(id);
      const hash = this.#s.transcripts.get(id) ?? (v.contentHash !== ZERO_HASH ? v.contentHash : null);
      if (!hash) return;
      await backend.openCourt(id, hash);
    } catch (e) {
      this.#s.backendErrors.push(toChainError(e));
    }
  }

  async #load(id: bigint): Promise<ChainCase | null> {
    const v = await this.#port.getCase(id);
    if (v.status === Status.None) return null;
    const mode = modeIdOf(v.mode);
    this.#s.modes.set(id, mode);
    const [chainPhase, ct, jurors] = await Promise.all([this.#port.phaseOf(id), this.#port.caseTerms(id), this.#port.jurorsOf(id)]);
    const phase = casePhaseOf(chainPhase, v.status) ?? 'draft';
    const terms = termsFromChain(mode, ct, v.sponsorDeposit > 0n ? v.sponsorDeposit : null);
    const views = await Promise.all(jurors.map(async (j) => ({ j, jv: await this.#port.jurorOf(id, j) })));
    const seats: ChainSeat[] = views
      .map(({ j, jv }) => {
        const s: ChainSeat = { seat: jv.seat + 1, juror: lower(j), committed: jv.commitment !== ZERO_HASH, revealed: jv.revealed };
        if (jv.revealed) s.choice = jv.choice as BallotChoice;
        return s;
      })
      .sort((a, b) => a.seat - b.seat);

    const deposits: ChainDeposit[] = [];
    const payers: Hex[] = [];
    if (mode === 'solo') {
      payers.push(lower(v.creator));
      deposits.push({ account: lower(v.creator), kind: 'filer', amount: terms.payerShares[0] ?? terms.target });
    } else if (mode === 'versus') {
      payers.push(lower(v.creator), lower(v.counterparty));
      const [a, b] = terms.payerShares;
      deposits.push({ account: lower(v.creator), kind: 'side', amount: a ?? terms.target, side: 'a' });
      if (v.raised > (a ?? 0n)) deposits.push({ account: lower(v.counterparty), kind: 'side', amount: b ?? terms.target, side: 'b' });
    } else {
      let known = 0n;
      for (const [account, amount] of this.#s.contributors.get(id) ?? []) {
        deposits.push({ account: account as Hex, kind: 'contributor', amount: usdcOf(amount) });
        known += amount;
      }
      // Contributors this client did not witness cannot be listed from contract state alone.
      if (v.raised > known) deposits.push({ account: ZERO_ADDRESS, kind: 'contributor', amount: usdcOf(v.raised - known) });
    }
    if (v.sponsorDeposit > 0n && v.sponsor !== ZERO_ADDRESS) deposits.push({ account: lower(v.sponsor), kind: 'sponsor', amount: usdcOf(v.sponsorDeposit) });

    let verdict: Verdict | null = null;
    if (v.status === Status.Finalized) {
      const kind = verdictKindOf(v.outcome);
      verdict = {
        kind,
        label: kind === 'no-verdict' ? 'NO VERDICT' : terms.ballot[kind === 'ballot-0' ? 0 : 1],
        tally: [v.votes0, v.votes1],
        completedDuty: v.revealed,
        appointed: v.jurySize,
      };
    }

    let claimable: Hex[] = [];
    if (phase === 'settled' || phase === 'cancelled') {
      const refundable = await this.#port.isRefundable(id);
      const accounts = new Set<Hex>([...seats.map((s) => s.juror), ...deposits.map((d) => d.account), lower(v.sponsor)]);
      accounts.delete(ZERO_ADDRESS);
      const flags = await Promise.all(
        [...accounts].map(async (a) => ((await this.#port.claimable(a)) > 0n || (refundable && (await this.#port.paidBy(id, a)) > 0n) ? a : null)),
      );
      claimable = flags.filter((a): a is Hex => a !== null);
    }

    const transcript = this.#s.transcripts.get(id) ?? (v.transcriptHash !== ZERO_HASH ? v.transcriptHash : v.contentHash !== ZERO_HASH ? v.contentHash : null);
    return {
      number: caseNumberOf(id),
      mode,
      category: 'internet-crimes',
      title: this.#s.titles.get(id) ?? `Case ${id}`,
      phase,
      phaseEndsAt: phaseEndsAtOf(v, phase),
      transcriptHash: transcript,
      verdict,
      terms,
      payers,
      deposits,
      raised: micro(v.raised),
      seats,
      deadlines: { funding: num(v.pendingDeadline), recruitment: num(v.recruitDeadline), commit: num(v.commitDeadline), reveal: num(v.revealDeadline) },
      claimable,
    };
  }

  #emit(event: ChainEvent): void {
    for (const l of [...this.#s.listeners]) if (l.filter === '*' || l.filter === event.caseNumber) l.fn(event);
  }

  #enqueue(e: CourtEvent): void {
    this.#s.queue = this.#s.queue.then(() => this.#translate(e)).catch(() => undefined);
  }

  async #translate(e: CourtEvent): Promise<void> {
    const a = e.args;
    const rawId = a.caseId;
    if (typeof rawId !== 'bigint') return;
    const caseNumber = caseNumberOf(rawId);
    const read = () => this.#port.getCase(rawId);
    switch (e.name) {
      case 'CaseCreated': {
        const v = await read();
        this.#emit({ type: 'case-created', caseNumber, transcriptHash: (a.contentHash as Hex) ?? ZERO_HASH });
        this.#emit({ type: 'phase', caseNumber, phase: 'pre-trial', endsAt: num(v.pendingDeadline) });
        return;
      }
      case 'PaymentReceived': {
        const v = await read();
        const mode = modeIdOf(v.mode);
        const kind = mode === 'solo' ? 'filer' : mode === 'versus' ? 'side' : 'contributor';
        this.#emit({ type: 'funded', caseNumber, account: lower(a.payer as string), kind, amount: usdcOf(a.amount as bigint), raised: usdcOf(v.raised) });
        return;
      }
      case 'SponsorDeposited': {
        const v = await read();
        this.#emit({ type: 'funded', caseNumber, account: lower(a.sponsor as string), kind: 'sponsor', amount: usdcOf(a.amount as bigint), raised: usdcOf(v.raised) });
        return;
      }
      case 'RecruitmentOpened':
        this.#emit({ type: 'phase', caseNumber, phase: 'recruiting', endsAt: Number(a.recruitDeadline) });
        return;
      case 'SeatAccepted':
        this.#emit({ type: 'seat-accepted', caseNumber, juror: lower(a.juror as string), seat: Number(a.seat) + 1 });
        return;
      case 'JuryFilled':
        this.#emit({ type: 'phase', caseNumber, phase: 'preparing', endsAt: Number(a.prepDeadline) });
        return;
      case 'CourtOpened':
        this.#emit({ type: 'phase', caseNumber, phase: 'commit', endsAt: Number(a.commitDeadline) });
        return;
      case 'VoteCommitted':
        this.#emit({ type: 'committed', caseNumber, juror: lower(a.juror as string) });
        return;
      case 'VoteRevealed':
        this.#emit({ type: 'revealed', caseNumber, juror: lower(a.juror as string), choice: Number(a.choice) as BallotChoice });
        return;
      case 'CaseFinalized': {
        const outcome = (a.settlement as { outcome: number }).outcome;
        this.#emit({ type: 'phase', caseNumber, phase: 'settled', endsAt: null });
        this.#emit({ type: 'finalized', caseNumber, verdictKind: verdictKindOf(outcome as never) });
        return;
      }
      case 'CaseCancelled':
        this.#emit({ type: 'phase', caseNumber, phase: 'cancelled', endsAt: null });
        this.#emit({ type: 'cancelled', caseNumber, reason: CANCEL_REASONS[Number(a.reason)] ?? 'cancelled' });
        return;
      case 'RefundClaimed':
        this.#emit({ type: 'claimed', caseNumber, account: lower(a.payer as string), amount: usdcOf(a.amount as bigint) });
        return;
    }
  }
}

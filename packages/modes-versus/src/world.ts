/**
 * The Versus case room, event-sourced.
 *
 * Two people (and three jurors) act on one case from different places. Every
 * action is a *fact*: plain, serialisable data with a sequence number, a time
 * and an author. Facts are deterministic to apply, so anyone holding the log
 * rebuilds exactly the same world:
 *
 *   facts ─▶ World.apply ─▶ trial state machine (core `transition`)
 *                       └─▶ ChainPort (memory twin of the Arc court contract)
 *                              └─ chain events ─▶ mirrored trial events
 *
 * Non-deterministic work (AI drafting, World ID proofs, salt generation) happens
 * *before* a fact is written; the fact carries the result (the draft, the
 * nullifier, the commitment). The chain stays the source of truth for money and
 * phase: funding, seats, ballots, verdicts, cancellations and refunds reach the
 * trial only as mirrored chain events (ARCHITECTURE §4).
 *
 * Time-driven transitions (consent deadline, funding lapse, recruitment lapse,
 * commit → reveal → finalizing) are applied lazily before every fact and at
 * "now", like the contract's block.timestamp checks, so they need no facts.
 */
import {
  CHARACTER_NAMES,
  createTrial,
  formatUsdc,
  transition,
  trialId as toTrialId,
  usdc,
  type BalanceReport,
  type CaseNumber,
  type CaseTerms,
  type Category,
  type ChainCase,
  type ChainEvent,
  type CounselDraft,
  type CourtLine,
  type Exhibit,
  type FilingPatch,
  type Hex,
  type ShareRecord,
  type SideId,
  type TrialEvent,
  type TrialId,
  type TrialState,
  type Usdc,
} from '@cringe-court/core';
import { MemoryChain } from '@cringe-court/core/testing';
import { EXHIBITS_PER_SIDE, OPEN_INVITE_LIMIT, versusMode } from './definition';
import type { InviteCode } from './invite';

/* ── Facts ────────────────────────────────────────────────────────────── */

export type DemoReliability = 'reliable' | 'no-show';

export type FactBody =
  | { type: 'open'; trialId: string; code: InviteCode; account: Hex; nullifier: Hex; category: Category; title: string; terms: CaseTerms }
  | { type: 'brief'; trialId: string; side: SideId; account: Hex; patch: FilingPatch }
  | { type: 'submit'; trialId: string; account: Hex }
  | { type: 'consent'; trialId: string; account: Hex; nullifier: Hex }
  | { type: 'decline'; trialId: string }
  | { type: 'exhibit'; trialId: string; side: SideId; account: Hex; exhibit: Exhibit }
  | { type: 'exhibit-removed'; trialId: string; side: SideId; account: Hex; exhibitId: string }
  | { type: 'approve-brief'; trialId: string; side: SideId; account: Hex }
  | { type: 'drafted'; trialId: string; draft: CounselDraft; balance: BalanceReport }
  | { type: 'counsel-failed'; trialId: string; message: string }
  | { type: 'redraft'; trialId: string; side: SideId; account: Hex }
  | { type: 'approve-draft'; trialId: string; side: SideId; account: Hex }
  | { type: 'fund'; trialId: string; account: Hex }
  | { type: 'withdraw'; trialId: string; side: SideId; account: Hex }
  | { type: 'faucet'; account: Hex; amount: Usdc }
  | { type: 'seat'; trialId: string; account: Hex; nullifier: Hex; demo?: DemoReliability }
  | { type: 'commit'; trialId: string; account: Hex; commitment: Hex }
  | { type: 'reveal'; trialId: string; account: Hex; choice: 0 | 1; salt: Hex }
  | { type: 'finalize'; trialId: string }
  | { type: 'sentence'; trialId: string; line: CourtLine }
  | { type: 'share'; trialId: string; channel: ShareRecord['channel'] }
  | { type: 'claim'; trialId: string; account: Hex }
  /** Demo only (D14, labelled in the UI): move the court clock forward. */
  | { type: 'clock'; seconds: number };

export type FactType = FactBody['type'];

export type Fact = FactBody & {
  seq: number;
  /** World time (unix seconds) when the fact was written. */
  at: number;
  /** Author: a persona id, or 'clerk' for permissionless housekeeping (finalize, demo jurors). */
  by: string;
};

/** Most test USDC the demo faucet hands out per request. */
export const FAUCET_MAX: Usdc = usdc('10.00');

/* ── World ────────────────────────────────────────────────────────────── */

export interface Party {
  account: Hex;
  /** World ID nullifier for this case (action `case-party`). */
  nullifier: Hex;
  persona: string;
}

export interface ActivityItem {
  seq: number;
  at: number;
  text: string;
  side?: SideId;
  kind: 'filing' | 'party' | 'counsel' | 'money' | 'jury' | 'verdict' | 'closed' | 'demo';
}

export interface Claim {
  account: Hex;
  amount: Usdc;
  at: number;
}

export interface VersusCase {
  trialId: TrialId;
  code: InviteCode;
  state: TrialState;
  caseNumber: CaseNumber | null;
  parties: Partial<Record<SideId, Party>>;
  /** Simulated jurors seated with the demo control, and how they behave. */
  demoJurors: ReadonlyMap<string, DemoReliability>;
  /** Seat nullifiers (one human, one seat). */
  seatNullifiers: readonly Hex[];
  claims: readonly Claim[];
  withdrawnBy: SideId | null;
  activity: readonly ActivityItem[];
  /** The ledger's view, filled in by `snapshot()`. */
  chain: ChainCase | null;
}

export class FactRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FactRejected';
  }
}

interface MutableCase extends Omit<VersusCase, 'demoJurors' | 'seatNullifiers' | 'claims' | 'activity'> {
  demoJurors: Map<string, DemoReliability>;
  seatNullifiers: Hex[];
  claims: Claim[];
  activity: ActivityItem[];
}

const lower = (a: Hex) => a.toLowerCase() as Hex;

export interface WorldSnapshot {
  now: number;
  /** Seconds the demo clock has been moved forward in total. */
  skew: number;
  cases: readonly VersusCase[];
  balances: ReadonlyMap<string, Usdc>;
  /** Facts that were written but did not apply (e.g. two tabs finalizing at once), by seq. */
  rejected: ReadonlyMap<number, string>;
  /** Chain events the trial could not mirror. Always empty unless there is a bug; tests assert it. */
  desyncs: readonly string[];
  lastSeq: number;
  lastAt: number;
}

export class World {
  readonly chain: MemoryChain;
  #now = 0;
  #skew = 0;
  #lastSeq = 0;
  #lastAt = 0;
  readonly #cases = new Map<string, MutableCase>();
  readonly #byNumber = new Map<number, MutableCase>();
  readonly #pending: ChainEvent[] = [];
  readonly #accounts = new Set<string>();
  readonly rejected = new Map<number, string>();
  readonly desyncs: string[] = [];
  #opening: MutableCase | null = null;
  #fact: Fact | null = null;

  constructor() {
    this.chain = new MemoryChain({ clock: () => this.#now, firstCase: 69 });
    this.chain.subscribe('*', (e) => this.#pending.push(e));
  }

  get now(): number {
    return this.#now;
  }

  get skew(): number {
    return this.#skew;
  }

  get lastSeq(): number {
    return this.#lastSeq;
  }

  get lastAt(): number {
    return this.#lastAt;
  }

  /** Rebuild a world from a log, then bring time-driven phases up to `now`. */
  static async replay(facts: readonly Fact[], now?: number): Promise<World> {
    const world = new World();
    for (const fact of facts) await world.apply(fact);
    if (now !== undefined) await world.advanceTo(now);
    return world;
  }

  case(id: string): VersusCase | undefined {
    return this.#cases.get(id);
  }

  cases(): readonly VersusCase[] {
    return [...this.#cases.values()];
  }

  /** Apply one fact. Rejections are recorded (deterministically) and returned, never thrown. */
  async apply(fact: Fact): Promise<{ ok: true } | { ok: false; message: string }> {
    if (fact.seq <= this.#lastSeq) return { ok: false, message: `Fact ${fact.seq} is out of order` };
    this.#lastSeq = fact.seq;
    this.#lastAt = Math.max(this.#lastAt, fact.at);
    await this.advanceTo(fact.at);
    this.#fact = fact;
    try {
      await this.#applyBody(fact);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.rejected.set(fact.seq, message);
      // Keep the chain and trial in step even when a chain call failed half-way.
      this.#drain();
      return { ok: false, message };
    } finally {
      this.#fact = null;
    }
  }

  /** Move time forward to `now` and run every deadline that has passed. */
  async advanceTo(now: number): Promise<void> {
    if (now > this.#now) this.#now = now;
    for (const c of this.#cases.values()) {
      const s = c.state;
      if (s.stage === 'filing' && s.step === 'awaiting-consent' && s.consentEndsAt !== null && this.#now >= s.consentEndsAt) {
        this.#dispatch(c, { type: 'DEADLINE_PASSED', deadline: 'consent' }, true);
        this.#log(c, 'closed', 'Side B did not answer in time. Nobody was charged.');
      }
      if (c.caseNumber !== null) {
        await this.chain.advance(c.caseNumber);
        this.#drain();
      }
    }
  }

  async snapshot(extraAccounts: readonly Hex[] = []): Promise<WorldSnapshot> {
    const cases: VersusCase[] = [];
    for (const c of this.#cases.values()) {
      const chain = c.caseNumber === null ? null : await this.chain.getCase(c.caseNumber);
      this.#drain();
      cases.push({ ...c, chain, demoJurors: new Map(c.demoJurors), seatNullifiers: [...c.seatNullifiers], claims: [...c.claims], activity: [...c.activity] });
    }
    const balances = new Map<string, Usdc>();
    for (const a of new Set([...this.#accounts, ...extraAccounts.map(lower)])) balances.set(a, await this.chain.usdcBalance(a as Hex));
    return {
      now: this.#now,
      skew: this.#skew,
      cases,
      balances,
      rejected: new Map(this.rejected),
      desyncs: [...this.desyncs],
      lastSeq: this.#lastSeq,
      lastAt: this.#lastAt,
    };
  }

  /* ── fact handlers ─────────────────────────────────────────────────── */

  async #applyBody(f: Fact): Promise<void> {
    switch (f.type) {
      case 'open':
        return this.#open(f);
      case 'faucet':
        if (f.amount <= 0n || f.amount > FAUCET_MAX) throw new FactRejected(`The faucet gives up to ${formatUsdc(FAUCET_MAX)} at a time`);
        this.#accounts.add(lower(f.account));
        this.chain.mint(f.account, f.amount);
        return;
      case 'clock':
        if (!(f.seconds > 0 && f.seconds <= 24 * 60 * 60)) throw new FactRejected('The demo clock moves forward by up to a day at a time');
        this.#skew += f.seconds;
        await this.advanceTo(this.#now + f.seconds);
        return;
      default:
        break;
    }
    const c = this.#cases.get(f.trialId);
    if (!c) throw new FactRejected('No such case');
    switch (f.type) {
      case 'brief':
        this.#asParty(c, f.side, f.account);
        this.#dispatch(c, { type: 'FILING_EDITED', side: f.side, patch: f.patch });
        if (c.state.stage === 'evidence') this.#log(c, 'party', `Side ${up(f.side)} updated their brief`, f.side);
        return;
      case 'submit':
        this.#asParty(c, 'a', f.account);
        this.#dispatch(c, { type: 'FILING_SUBMITTED' });
        this.#log(c, 'filing', 'Side A filed the case and sent the invite', 'a');
        return;
      case 'consent': {
        const a = c.parties.a;
        if (a && lower(a.nullifier) === lower(f.nullifier)) throw new FactRejected('You filed this case, so you cannot also be Side B (World ID)');
        this.#dispatch(c, { type: 'CONSENT_GIVEN', side: 'b', account: f.account });
        c.parties.b = { account: lower(f.account), nullifier: lower(f.nullifier), persona: f.by };
        this.#accounts.add(lower(f.account));
        this.#log(c, 'party', 'Side B accepted the invite. Both sides now brief their own agent.', 'b');
        return;
      }
      case 'decline':
        this.#dispatch(c, { type: 'CONSENT_DECLINED', side: 'b' });
        this.#log(c, 'closed', 'Side B declined the invite. Nobody was charged.', 'b');
        return;
      case 'exhibit': {
        this.#asParty(c, f.side, f.account);
        if (f.exhibit.submittedBy !== f.side) throw new FactRejected('An exhibit belongs to the side that submits it');
        const s = c.state;
        const mine = 'exhibits' in s ? s.exhibits.filter((x) => x.submittedBy === f.side).length : 0;
        if (mine >= EXHIBITS_PER_SIDE) throw new FactRejected(`Each side can bring ${EXHIBITS_PER_SIDE} exhibits`);
        this.#dispatch(c, { type: 'EXHIBIT_ADDED', exhibit: f.exhibit });
        this.#log(c, 'party', `Side ${up(f.side)} added an exhibit: “${f.exhibit.title}”`, f.side);
        return;
      }
      case 'exhibit-removed': {
        this.#asParty(c, f.side, f.account);
        const s = c.state;
        const ex = 'exhibits' in s ? s.exhibits.find((x) => x.id === f.exhibitId) : undefined;
        if (!ex || ex.submittedBy !== f.side) throw new FactRejected('You can only remove your own exhibits');
        this.#dispatch(c, { type: 'EXHIBIT_REMOVED', exhibitId: f.exhibitId });
        return;
      }
      case 'approve-brief': {
        this.#asParty(c, f.side, f.account);
        this.#dispatch(c, { type: 'EVIDENCE_APPROVED', by: f.side });
        const moved = c.state.stage === 'counsel';
        this.#log(c, 'party', moved ? `Side ${up(f.side)} approved. Both briefs are locked; the agents are drafting.` : `Side ${up(f.side)} approved their brief`, f.side);
        return;
      }
      case 'drafted': {
        const before = c.state.stage === 'counsel' ? c.state.attempt : 0;
        this.#dispatch(c, { type: 'COUNSEL_DRAFTED', draft: f.draft, balance: f.balance });
        const s = c.state;
        if (s.stage === 'counsel' && s.step === 'review') this.#log(c, 'counsel', `Both agents finished the draft (attempt ${before})`);
        else if (s.stage === 'counsel') this.#log(c, 'counsel', 'The balance check failed, so the weaker bench is being redrafted (D1)');
        else this.#log(c, 'closed', 'The AI could not prepare a fair case. Nobody was charged.');
        return;
      }
      case 'counsel-failed':
        this.#dispatch(c, { type: 'COUNSEL_FAILED', message: f.message });
        this.#log(c, 'closed', 'The AI could not prepare the case. Nobody was charged.');
        return;
      case 'redraft':
        this.#asParty(c, f.side, f.account);
        this.#dispatch(c, { type: 'REDRAFT_REQUESTED', side: f.side });
        this.#log(c, 'counsel', `Side ${up(f.side)} asked Agent ${up(f.side)} for a redraft`, f.side);
        return;
      case 'approve-draft': {
        this.#asParty(c, f.side, f.account);
        this.#dispatch(c, { type: 'DRAFT_APPROVED', by: f.side });
        const s = c.state;
        if (s.stage === 'counsel' && s.step === 'funding' && s.transcript && s.caseNumber === null) {
          this.#log(c, 'counsel', `Side ${up(f.side)} approved. The transcript is frozen.`, f.side);
          const a = c.parties.a!;
          const b = c.parties.b!;
          this.#opening = c;
          try {
            await this.chain.as(a.account).createCase({ terms: s.terms, transcriptHash: s.transcript.hash, payers: [a.account, b.account], title: s.filing.title, openedAt: this.#now });
          } finally {
            this.#drain();
            this.#opening = null;
          }
        } else {
          this.#log(c, 'counsel', `Side ${up(f.side)} approved the draft`, f.side);
        }
        return;
      }
      case 'fund': {
        const side = this.#sideOf(c, f.account);
        if (!side) throw new FactRejected('Only the two sides pay for a Versus case');
        if (c.caseNumber === null) throw new FactRejected('The case is not open for funding yet');
        const s = c.state;
        if (s.stage !== 'counsel' || s.step !== 'funding') throw new FactRejected('The case is not open for funding');
        const share = s.terms.payerShares[side === 'a' ? 0 : 1]!;
        await this.chain.as(f.account).fund(c.caseNumber, share);
        this.#drain();
        return;
      }
      case 'withdraw': {
        this.#asParty(c, f.side, f.account);
        const s = c.state;
        if (s.stage !== 'filing' && s.stage !== 'evidence' && s.stage !== 'counsel') throw new FactRejected('Consent can be withdrawn only until funding closes');
        this.#dispatch(c, { type: 'CANCELLED', reason: 'withdrawn' });
        c.withdrawnBy = f.side;
        const paid = s.stage === 'counsel' && s.deposits.length > 0;
        this.#log(
          c,
          'closed',
          paid ? `Side ${up(f.side)} withdrew. Any payment made is refunded when the funding window closes.` : `Side ${up(f.side)} withdrew. Nobody was charged.`,
          f.side,
        );
        return;
      }
      case 'seat': {
        if (c.caseNumber === null) throw new FactRejected('The jury has not been called yet');
        const n = lower(f.nullifier);
        if (Object.values(c.parties).some((p) => p && lower(p.nullifier) === n)) {
          throw new FactRejected('You are a party to this case, so you cannot sit on its jury (World ID)');
        }
        if (c.seatNullifiers.includes(n)) throw new FactRejected('This human already has a seat on this case (World ID)');
        this.#accounts.add(lower(f.account));
        await this.chain.as(f.account).acceptSeat(c.caseNumber, f.nullifier);
        c.seatNullifiers.push(n);
        if (f.demo) c.demoJurors.set(lower(f.account), f.demo);
        this.#drain();
        return;
      }
      case 'commit':
        if (c.caseNumber === null) throw new FactRejected('No jury yet');
        await this.chain.as(f.account).commit(c.caseNumber, f.commitment);
        this.#drain();
        return;
      case 'reveal':
        if (c.caseNumber === null) throw new FactRejected('No jury yet');
        await this.chain.as(f.account).reveal(c.caseNumber, f.choice, f.salt);
        this.#drain();
        return;
      case 'finalize':
        if (c.caseNumber === null) throw new FactRejected('No case on the ledger');
        await this.chain.finalize(c.caseNumber);
        this.#drain();
        return;
      case 'sentence':
        this.#dispatch(c, { type: 'SENTENCE_READ', line: f.line });
        return;
      case 'share':
        this.#dispatch(c, { type: 'SHARED', channel: f.channel });
        return;
      case 'claim':
        if (c.caseNumber === null) throw new FactRejected('Nothing to claim');
        await this.chain.as(f.account).claim(c.caseNumber);
        this.#drain();
        return;
      default:
        assertNever(f);
    }
  }

  #open(f: Extract<Fact, { type: 'open' }>): void {
    if (this.#cases.has(f.trialId)) throw new FactRejected('A case with this id already exists');
    if ([...this.#cases.values()].some((c) => c.code === f.code)) throw new FactRejected('This invite code is already in use');
    if (f.terms.mode !== 'versus') throw new FactRejected('Not a Versus case');
    const filer = lower(f.account);
    const open = [...this.#cases.values()].filter((c) => c.parties.a?.account === filer && c.state.stage === 'filing').length;
    if (open >= OPEN_INVITE_LIMIT) throw new FactRejected(`You already have ${OPEN_INVITE_LIMIT} invites waiting for an answer (D6). Wait for one, or withdraw it.`);
    const id = toTrialId(f.trialId);
    const state = createTrial({ id, mode: 'versus', terms: f.terms, rules: versusMode.rules, benches: versusMode.benches, category: f.category, title: f.title, filer, now: this.#now });
    const c: MutableCase = {
      trialId: id,
      code: f.code,
      state,
      caseNumber: null,
      parties: { a: { account: filer, nullifier: lower(f.nullifier), persona: f.by } },
      demoJurors: new Map(),
      seatNullifiers: [],
      claims: [],
      withdrawnBy: null,
      activity: [],
      chain: null,
    };
    this.#accounts.add(filer);
    this.#cases.set(id, c);
  }

  /* ── helpers ───────────────────────────────────────────────────────── */

  #asParty(c: MutableCase, side: SideId, account: Hex): void {
    const p = c.parties[side];
    if (!p || p.account !== lower(account)) throw new FactRejected(`Only Side ${up(side)} can do that`);
  }

  #sideOf(c: MutableCase, account: Hex): SideId | null {
    const a = lower(account);
    if (c.parties.a?.account === a) return 'a';
    if (c.parties.b?.account === a) return 'b';
    return null;
  }

  #dispatch(c: MutableCase, event: TrialEvent, mirrored = false): void {
    const r = transition(c.state, event, { now: this.#now });
    if (!r.ok) {
      if (mirrored) {
        this.desyncs.push(`${c.trialId}: ${event.type} — ${r.error.message}`);
        return;
      }
      throw new FactRejected(r.error.message);
    }
    c.state = r.state;
  }

  #log(c: MutableCase, kind: ActivityItem['kind'], text: string, side?: SideId): void {
    const item: ActivityItem = { seq: this.#fact?.seq ?? this.#lastSeq, at: this.#now, kind, text };
    if (side) item.side = side;
    c.activity.push(item);
  }

  /** Mirror chain events into the trial (the chain is the source of truth). */
  #drain(): void {
    while (this.#pending.length) {
      const e = this.#pending.shift()!;
      if (e.type === 'case-created') {
        const c = this.#opening;
        if (!c) {
          this.desyncs.push(`case ${e.caseNumber} created outside a Versus approval`);
          continue;
        }
        c.caseNumber = e.caseNumber;
        this.#byNumber.set(e.caseNumber, c);
        this.#dispatch(c, { type: 'CASE_OPENED', caseNumber: e.caseNumber, transcriptHash: e.transcriptHash }, true);
        this.#log(c, 'money', `The ledger opened ${caseLabel(e.caseNumber)}. Each side now pays their half.`);
        continue;
      }
      const c = this.#byNumber.get(e.caseNumber);
      if (!c) continue;
      this.#mirror(c, e);
    }
  }

  #mirror(c: MutableCase, e: ChainEvent): void {
    const s = c.state;
    switch (e.type) {
      case 'funded': {
        const side = this.#sideOf(c, e.account);
        this.#dispatch(c, { type: 'FUNDS_DEPOSITED', deposit: { account: e.account, kind: e.kind, amount: e.amount } }, true);
        this.#log(c, 'money', `Side ${up(side ?? 'a')} paid ${formatUsdc(e.amount)} (test USDC)`, side ?? undefined);
        if (c.state.stage === 'jury') this.#log(c, 'jury', 'Both halves are in. The court is calling a random verified jury.');
        return;
      }
      case 'seat-accepted':
        this.#dispatch(c, { type: 'SEAT_FILLED', account: e.juror }, true);
        this.#log(c, 'jury', `${ordinal(e.seat)} juror took a seat (bond posted)`);
        return;
      case 'phase':
        if (e.phase === 'commit' && s.stage === 'jury' && s.step === 'briefing' && e.endsAt !== null) {
          this.#dispatch(c, { type: 'COURT_OPENED', commitEndsAt: e.endsAt, revealEndsAt: e.endsAt + s.terms.deadlines.reveal }, true);
          this.#log(c, 'jury', 'The jury is seated. Court is in session: watch the trial, then seal a Secret Verdict Scroll.');
        } else if (e.phase === 'reveal' && s.stage === 'jury') {
          this.#dispatch(c, { type: 'DEADLINE_PASSED', deadline: 'commit' }, true);
          this.#log(c, 'jury', 'Scrolls are sealed. Jurors now open their scrolls.');
        } else if (e.phase === 'finalizing' && s.stage === 'jury') {
          this.#dispatch(c, { type: 'DEADLINE_PASSED', deadline: 'reveal' }, true);
          this.#log(c, 'jury', 'Deliberation is closed. The clerk is counting.');
        }
        return;
      case 'committed':
        this.#dispatch(c, { type: 'BALLOT_COMMITTED', account: e.juror }, true);
        this.#log(c, 'jury', 'A juror sealed their scroll');
        return;
      case 'revealed':
        this.#dispatch(c, { type: 'BALLOT_REVEALED', account: e.juror, choice: e.choice }, true);
        this.#log(c, 'jury', 'A juror opened their scroll');
        return;
      case 'finalized': {
        const settlement = this.chain.settlementOf(e.caseNumber);
        if (!settlement) {
          this.desyncs.push(`${c.trialId}: finalized without a settlement`);
          return;
        }
        this.#dispatch(c, { type: 'VERDICT_RECORDED', settlement }, true);
        const v = settlement.verdict;
        this.#log(c, 'verdict', v && v.kind !== 'no-verdict' ? `Verdict: ${v.label} (${v.tally[0]}–${v.tally[1]})` : 'NO VERDICT. Both sides are refunded in full.');
        return;
      }
      case 'cancelled': {
        const settlement = this.chain.settlementOf(e.caseNumber);
        if (s.stage === 'counsel' && e.reason === 'funding-missed') this.#dispatch(c, { type: 'DEADLINE_PASSED', deadline: 'funding' }, true);
        else if (s.stage === 'jury' && e.reason === 'jury-unfilled') this.#dispatch(c, { type: 'DEADLINE_PASSED', deadline: 'recruitment' }, true);
        else if (s.stage !== 'closed') this.#dispatch(c, { type: 'CANCELLED', reason: 'protective' }, true);
        if (settlement && c.state.stage === 'closed' && c.state.settlement === null) this.#dispatch(c, { type: 'REFUNDED', settlement }, true);
        const refunds = settlement?.statements.filter((st) => st.party !== 'protocol' && st.party !== 'platform' && st.payout > 0n).length ?? 0;
        const why = e.reason === 'funding-missed' ? 'The funding window closed before both halves arrived.' : e.reason === 'jury-unfilled' ? 'Not enough jurors took a seat in time.' : 'The court cancelled the case.';
        this.#log(c, 'closed', refunds ? `${why} ${refunds === 1 ? 'One refund is' : `${refunds} refunds are`} ready to claim.` : `${why} Nobody had paid.`);
        return;
      }
      case 'claimed':
        c.claims.push({ account: lower(e.account), amount: e.amount, at: this.#now });
        this.#log(c, 'money', `${this.#who(c, e.account)} claimed ${formatUsdc(e.amount)}`);
        return;
      default:
        return;
    }
  }

  #who(c: MutableCase, account: Hex): string {
    const side = this.#sideOf(c, account);
    return side ? `Side ${up(side)}` : 'A juror';
  }
}

function up(side: SideId): string {
  return side.toUpperCase();
}

function ordinal(n: number): string {
  return ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'][n - 1] ?? `Juror ${n}:`;
}

function caseLabel(n: CaseNumber): string {
  return `CASE #${String(n).padStart(4, '0')}`;
}

function assertNever(x: never): never {
  throw new FactRejected(`Unknown fact ${(x as { type?: string }).type}`);
}

/** Who said a line, for display. */
export function speakerName(speaker: CourtLine['speaker']): string {
  switch (speaker) {
    case 'side-a':
      return 'Agent A';
    case 'side-b':
      return 'Agent B';
    case 'judge':
      return CHARACTER_NAMES.judge;
    default:
      return CHARACTER_NAMES[speaker === 'narrator' ? 'ai-narrator' : speaker];
  }
}

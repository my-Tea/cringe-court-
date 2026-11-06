/**
 * GrandJuryCourt: everything the Grand Jury screens need, behind one object.
 * It reads the ledger (ChainPort), the docket (case files, transcripts, court
 * record) and the gallery store, and turns viewer intents into port calls:
 * summon (contribute), juror screening (World ID) → random seat offer → bond,
 * sealed ballot → reveal, permissionless settlement, claims and the gallery vote.
 *
 * Every action resolves to an ActionResult; nothing throws at the UI.
 */
import {
  ChainError,
  ZERO_USDC,
  addUsdc,
  formatCaseNumber,
  formatUsdc,
  keccak256,
  settle,
  subUsdc,
  type BallotChoice,
  type CaseNumber,
  type CasePhase,
  type CaseTerms,
  type ChainCase,
  type CourtLine,
  type CourtPorts,
  type Hex,
  type ReceiptLine,
  type SeatOffer,
  type Settlement,
  type Unsubscribe,
  type Usdc,
  type Verdict,
} from '@cringe-court/core';
import { JurorSession } from '@cringe-court/engine';
import type { CaseFile } from './catalog';
import { teaserOf } from './counsel';
import type { Docket, LogEntry, PublishedCase } from './docket';
import { GalleryVoteError, type GalleryStore, type GalleryTally } from './gallery';
import type { PricingProfile } from './pricing';
import { decodeScroll, encodeScroll, ScrollError } from './salts';

/* ── View model ─────────────────────────────────────────────────────────── */

export type DocketStatus = 'summoning' | 'seating' | 'in-session' | 'opening-scrolls' | 'settle-ready' | 'verdict' | 'mistrial' | 'cancelled';

export const STATUS_LABELS: Readonly<Record<DocketStatus, string>> = {
  summoning: 'Summoning the court',
  seating: 'Seating the jury',
  'in-session': 'In session',
  'opening-scrolls': 'Opening scrolls',
  'settle-ready': 'Ready to settle',
  verdict: 'Verdict',
  mistrial: 'No verdict',
  cancelled: 'Cancelled, refunded',
};

/** Filter groups on the docket. */
export type DocketFilter = 'all' | 'open' | 'live' | 'closed';

export const FILTER_STATUSES: Readonly<Record<Exclude<DocketFilter, 'all'>, readonly DocketStatus[]>> = {
  open: ['summoning', 'seating'],
  live: ['in-session', 'opening-scrolls', 'settle-ready'],
  closed: ['verdict', 'mistrial', 'cancelled'],
};

export function statusOf(phase: CasePhase, verdict: Verdict | null): DocketStatus {
  switch (phase) {
    case 'draft':
    case 'pre-trial':
      return 'summoning';
    case 'recruiting':
      return 'seating';
    case 'preparing':
    case 'commit':
      return 'in-session';
    case 'reveal':
      return 'opening-scrolls';
    case 'finalizing':
      return 'settle-ready';
    case 'settled':
      return verdict?.kind === 'no-verdict' ? 'mistrial' : 'verdict';
    case 'cancelled':
      return 'cancelled';
  }
}

/** The jury's reveal window has closed: the gallery tally may be shown (D11). */
export function revealClosed(phase: CasePhase): boolean {
  return phase === 'finalizing' || phase === 'settled' || phase === 'cancelled';
}

export interface DocketEntry {
  caseNumber: CaseNumber;
  label: string;
  file: CaseFile;
  ballot: readonly [string, string];
  status: DocketStatus;
  phase: CasePhase;
  /** Unix seconds: when the current window opened and closes (null if no deadline). */
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  terms: CaseTerms;
  raised: Usdc;
  target: Usdc;
  /** 0..1 of the target. */
  progress: number;
  summoners: number;
  sponsor: PublishedCase['sponsor'];
  seats: { filled: number; total: number; sealed: number; opened: number };
  verdict: Verdict | null;
  gallery: { total: number; tally: GalleryTally | null };
  demoTiming: boolean;
}

export interface Summoner {
  label: string;
  amount: Usdc;
  isViewer: boolean;
}

/** D13 per-case disclosure, from the same settle() the contract twin pays with. */
export interface Disclosure {
  outcome: 'verdict' | 'no-verdict' | 'cancelled';
  appointed: number;
  completed: number;
  fees: Usdc;
  forfeits: Usdc;
  unearnedBonus: Usdc;
  sponsorFee: Usdc;
  refundedToFunders: Usdc;
  paidToJurors: Usdc;
  totalIn: Usdc;
}

export interface ViewerCaseState {
  account: Hex | null;
  contributed: Usdc;
  isSponsor: boolean;
  /** 1-based seat, if the viewer sits on this jury. */
  seat: number | null;
  screened: boolean;
  offer: SeatOffer | null;
  committed: boolean;
  revealed: boolean;
  /** The viewer's own sealed choice (from this device), or null. */
  sealedChoice: BallotChoice | null;
  hasSalt: boolean;
  scroll: string | null;
  galleryVote: BallotChoice | null;
  galleryOpen: boolean;
  galleryBlocked: string | null;
  claim: { amount: Usdc; claimed: boolean; lines: readonly ReceiptLine[] } | null;
}

export interface CaseDetail extends DocketEntry {
  /** What the public can see of the show right now. */
  transcript: readonly CourtLine[];
  /** True while only the D3 teaser is public (before the jury is seated). */
  transcriptTeaser: boolean;
  transcriptHash: Hex;
  provider: PublishedCase['provider'];
  model: string;
  log: readonly LogEntry[];
  summonerList: readonly Summoner[];
  disclosure: Disclosure | null;
  sentence: CourtLine | null;
  viewer: ViewerCaseState;
}

export type ActionResult<T = void> =
  | { ok: true; value: T; explorerUrl?: string }
  | { ok: false; code: string; message: string };

const ok = <T>(value: T, explorerUrl?: string): ActionResult<T> => (explorerUrl ? { ok: true, value, explorerUrl } : { ok: true, value });
const fail = (code: string, message: string): ActionResult<never> => ({ ok: false, code, message });

function failure(err: unknown): ActionResult<never> {
  if (err instanceof ChainError || err instanceof GalleryVoteError) return fail(err.code, err.message);
  if (err instanceof ScrollError) return fail('bad-scroll', err.message);
  return fail('error', err instanceof Error ? err.message : String(err));
}

/* ── The court ──────────────────────────────────────────────────────────── */

export interface GrandJuryCourtOptions {
  docket: Docket;
  /** Ports as the viewer: the chain signs as the viewer's account. */
  ports: Pick<CourtPorts, 'chain' | 'identity' | 'salts' | 'jury' | 'counsel'>;
  gallery: GalleryStore;
  clock: () => number;
  /** How long a random seat offer stays open (V4 §10), seconds. */
  offerSeconds?: number;
}

const isPhaseWithWindow = (p: CasePhase): p is 'pre-trial' | 'recruiting' | 'commit' | 'reveal' =>
  p === 'pre-trial' || p === 'recruiting' || p === 'commit' || p === 'reveal';

export class GrandJuryCourt {
  readonly docket: Docket;
  readonly pricing: PricingProfile;
  readonly #ports: GrandJuryCourtOptions['ports'];
  readonly #gallery: GalleryStore;
  readonly #clock: () => number;
  readonly #offerSeconds: number;
  readonly #sessions = new Map<CaseNumber, JurorSession>();
  readonly #offers = new Map<CaseNumber, SeatOffer>();
  readonly #sentences = new Map<CaseNumber, CourtLine>();
  readonly #listeners = new Set<() => void>();
  readonly #unsubscribe: Unsubscribe[];
  #account: Hex | null | undefined;

  constructor(o: GrandJuryCourtOptions) {
    this.docket = o.docket;
    this.pricing = o.docket.pricing;
    this.#ports = o.ports;
    this.#gallery = o.gallery;
    this.#clock = o.clock;
    this.#offerSeconds = o.offerSeconds ?? 120;
    this.#unsubscribe = [o.ports.chain.subscribe('*', () => this.#emit()), o.docket.onChange(() => this.#emit())];
  }

  now(): number {
    return this.#clock();
  }

  dispose(): void {
    for (const u of this.#unsubscribe) u();
    this.#listeners.clear();
  }

  /** Called on every ledger event, docket change and local action. */
  subscribe(fn: () => void): Unsubscribe {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit(): void {
    for (const fn of [...this.#listeners]) fn();
  }

  async account(): Promise<Hex | null> {
    if (this.#account === undefined) this.#account = (await this.#ports.chain.account())?.toLowerCase() as Hex | null;
    return this.#account ?? null;
  }

  async balance(): Promise<Usdc | null> {
    const me = await this.account();
    return me ? this.#ports.chain.usdcBalance(me) : null;
  }

  /* ── Reads ─────────────────────────────────────────────────────────── */

  async list(): Promise<readonly DocketEntry[]> {
    const entries: DocketEntry[] = [];
    for (const p of this.docket.list()) {
      const c = await this.#ports.chain.getCase(p.caseNumber);
      if (c) entries.push(await this.#entry(p, c));
    }
    return entries;
  }

  async detail(n: CaseNumber): Promise<CaseDetail | null> {
    const p = this.docket.get(n);
    if (!p) return null;
    const c = await this.#ports.chain.getCase(n);
    if (!c) return null;
    const entry = await this.#entry(p, c);
    const me = await this.account();
    const seated = c.phase !== 'pre-trial' && c.phase !== 'recruiting';
    const teaser = !seated || c.phase === 'cancelled';
    return {
      ...entry,
      transcript: teaser ? teaserOf(p.transcript) : p.transcript,
      transcriptTeaser: teaser,
      transcriptHash: p.transcriptHash,
      provider: p.provider,
      model: p.model,
      log: this.docket.log(n),
      summonerList: summoners(c, me),
      disclosure: disclosureOf(c),
      sentence: c.phase === 'settled' ? await this.#sentence(p, c) : null,
      viewer: await this.#viewer(c, me),
    };
  }

  async #entry(p: PublishedCase, c: ChainCase): Promise<DocketEntry> {
    const t = c.terms;
    const tally = await this.#gallery.tally(p.caseNumber);
    const window = isPhaseWithWindow(c.phase) ? windowOf(c) : null;
    return {
      caseNumber: p.caseNumber,
      label: formatCaseNumber(p.caseNumber),
      file: p.file,
      ballot: p.ballot,
      status: statusOf(c.phase, c.verdict),
      phase: c.phase,
      phaseStartedAt: window?.[0] ?? null,
      phaseEndsAt: window?.[1] ?? null,
      terms: t,
      raised: c.raised,
      target: t.target,
      progress: t.target > 0n ? Math.min(1, Number(c.raised) / Number(t.target)) : 0,
      summoners: new Set(c.deposits.filter((d) => d.kind === 'contributor').map((d) => d.account.toLowerCase())).size,
      sponsor: p.sponsor,
      seats: { filled: c.seats.length, total: t.jurySize, sealed: c.seats.filter((s) => s.committed).length, opened: c.seats.filter((s) => s.revealed).length },
      verdict: c.verdict,
      gallery: { total: tally.total, tally: revealClosed(c.phase) ? tally : null },
      demoTiming: p.demoTiming,
    };
  }

  async #sentence(p: PublishedCase, c: ChainCase): Promise<CourtLine | null> {
    const cached = this.#sentences.get(p.caseNumber);
    if (cached) return cached;
    if (!c.verdict) return null;
    try {
      const line = await this.#ports.counsel.sentence({
        trialId: p.file.slug,
        verdictLabel: c.verdict.label,
        transcriptHash: p.transcriptHash,
        category: p.file.category,
        title: p.file.title,
      });
      this.#sentences.set(p.caseNumber, line);
      return line;
    } catch {
      return null;
    }
  }

  async #viewer(c: ChainCase, me: Hex | null): Promise<ViewerCaseState> {
    const n = c.number;
    const mine = (a: Hex) => me !== null && a.toLowerCase() === me;
    const seatIdx = c.seats.findIndex((s) => mine(s.juror));
    const seat = seatIdx >= 0 ? c.seats[seatIdx]! : null;
    const ballot = me ? await this.#ports.salts.load(n, me) : null;
    const galleryVote = me ? await this.#gallery.voteOf(n, me) : null;
    const contributed = addUsdc(ZERO_USDC, ...c.deposits.filter((d) => d.kind === 'contributor' && mine(d.account)).map((d) => d.amount));
    const isSponsor = c.deposits.some((d) => d.kind === 'sponsor' && mine(d.account));
    const galleryOpen = !revealClosed(c.phase);
    const galleryBlocked = !me ? 'Connect a wallet to call it.' : seat ? 'You are on this jury, so you vote with your sealed ballot, not in the gallery.' : null;
    let claim: ViewerCaseState['claim'] = null;
    if (me && (c.phase === 'settled' || c.phase === 'cancelled')) {
      const lines = await this.#ports.chain.receipts(n, me);
      const amount = addUsdc(ZERO_USDC, ...lines.filter((l) => l.kind !== 'forfeit').map((l) => l.amount));
      if (lines.length > 0) claim = { amount, claimed: amount > 0n && !c.claimable.some(mine), lines };
    }
    const offer = this.#offers.get(n) ?? null;
    return {
      account: me,
      contributed,
      isSponsor,
      seat: seat ? seat.seat : null,
      screened: this.#sessions.get(n)?.nullifier != null,
      offer: offer && offer.status === 'open' && offer.expiresAt > this.#clock() ? offer : null,
      committed: seat?.committed ?? false,
      revealed: seat?.revealed ?? false,
      sealedChoice: ballot?.choice ?? null,
      hasSalt: ballot !== null,
      scroll: ballot && seat && !seat.revealed ? encodeScroll(ballot) : null,
      galleryVote,
      galleryOpen,
      galleryBlocked,
      claim,
    };
  }

  /* ── Summoners ─────────────────────────────────────────────────────── */

  async contribute(n: CaseNumber, amount: Usdc): Promise<ActionResult> {
    const c = await this.#ports.chain.getCase(n);
    if (!c) return fail('not-found', 'This case is not on the docket.');
    if (c.phase !== 'pre-trial') return fail('wrong-phase', 'This case is no longer raising money.');
    const min = c.terms.funding.kind === 'crowdfund' ? c.terms.funding.minContribution : ZERO_USDC;
    const remaining = subUsdc(c.terms.target, c.raised);
    if (amount <= 0n) return fail('bad-amount', 'Enter an amount.');
    if (amount > remaining) return fail('bad-amount', `Only ${formatUsdc(remaining)} is left to raise.`);
    if (amount < min && amount !== remaining) return fail('bad-amount', `Contributions start at ${formatUsdc(min)}.`);
    return this.#tx(() => this.#ports.chain.fund(n, amount));
  }

  /* ── Juror duty ────────────────────────────────────────────────────── */

  #session(n: CaseNumber): JurorSession {
    let s = this.#sessions.get(n);
    if (!s) {
      s = new JurorSession({ caseNumber: n, ports: this.#ports, clock: this.#clock });
      this.#sessions.set(n, s);
    }
    return s;
  }

  /** Juror Screening: World ID (Orb) for this seat, before any bond (V4 §10). */
  async screen(n: CaseNumber, signal?: AbortSignal): Promise<ActionResult<Hex>> {
    const c = await this.#ports.chain.getCase(n);
    if (!c || c.phase !== 'recruiting') return fail('wrong-phase', 'Jury selection is not open on this case.');
    const me = await this.account();
    if (!me) return fail('no-wallet', 'Connect a wallet first.');
    if (c.deposits.some((d) => d.kind === 'sponsor' && d.account.toLowerCase() === me)) {
      return fail('conflicted', 'The sponsor of a case cannot sit on its jury.');
    }
    const r = await this.#session(n).screen(signal);
    this.#emit();
    return r.ok ? ok(r.value) : fail(r.reason, r.message);
  }

  /**
   * Join the waiting pool and get a random seat offer (V4 §10). Declining or
   * letting it lapse is never slashable; only accepting posts the bond.
   */
  async requestSeat(n: CaseNumber): Promise<ActionResult<SeatOffer>> {
    const session = this.#sessions.get(n);
    if (!session?.nullifier) return fail('not-screened', 'Pass Juror Screening first.');
    const c = await this.#ports.chain.getCase(n);
    const p = this.docket.get(n);
    if (!c || !p || c.phase !== 'recruiting') return fail('wrong-phase', 'Jury selection is not open on this case.');
    if (c.seats.length >= c.terms.jurySize) return fail('full', 'All seven seats are taken.');
    const me = (await this.account())!;
    try {
      await this.#ports.jury.enlist({ juror: me, nullifier: session.nullifier, modes: ['grand-jury'] });
      const expiresAt = Math.min(this.#clock() + this.#offerSeconds, c.deadlines.recruitment ?? Number.MAX_SAFE_INTEGER);
      const offers = await this.#ports.jury.draw({
        caseNumber: n,
        mode: 'grand-jury',
        category: p.file.category,
        title: p.file.title,
        bond: c.terms.bondPerJuror,
        seats: 1,
        exclude: [...c.seats.map((s) => s.juror), ...c.deposits.filter((d) => d.kind === 'sponsor').map((d) => d.account)],
        seed: keccak256(`${p.transcriptHash}:${n}:${c.seats.length}`),
        expiresAt,
      });
      const offer = offers.find((o) => o.juror.toLowerCase() === me);
      if (!offer) return fail('not-drawn', 'The draw picked other jurors this round. You stay in the pool for the next offer.');
      this.#offers.set(n, offer);
      this.#emit();
      return ok(offer);
    } catch (err) {
      return failure(err);
    }
  }

  async declineSeat(n: CaseNumber): Promise<ActionResult> {
    const offer = this.#offers.get(n);
    if (!offer) return ok(undefined);
    try {
      this.#offers.set(n, await this.#ports.jury.respond(offer.id, 'declined'));
    } catch {
      this.#offers.delete(n);
    }
    this.#emit();
    return ok(undefined);
  }

  /** "I swear to show up": accept the offer and post the bond. */
  async acceptSeat(n: CaseNumber): Promise<ActionResult> {
    const offer = this.#offers.get(n);
    if (!offer || offer.status !== 'open') return fail('no-offer', 'There is no open seat offer for you on this case.');
    if (offer.expiresAt <= this.#clock()) return fail('offer-expired', 'This seat offer timed out. Ask for another; declining never costs anything.');
    try {
      this.#offers.set(n, await this.#ports.jury.respond(offer.id, 'accepted'));
    } catch (err) {
      return failure(err);
    }
    const r = await this.#session(n).takeSeat();
    if (!r.ok) this.#offers.delete(n);
    this.#emit();
    return r.ok ? ok(undefined, r.explorerUrl) : fail(r.reason, r.message);
  }

  /** Seal a ballot. Returns the Secret Verdict Scroll to keep. */
  async seal(n: CaseNumber, choice: BallotChoice): Promise<ActionResult<{ scroll: string }>> {
    const r = await this.#session(n).commit(choice);
    if (!r.ok) {
      this.#emit();
      return fail(r.reason, r.message);
    }
    const me = (await this.account())!;
    const ballot = await this.#ports.salts.load(n, me);
    this.#emit();
    return ok({ scroll: ballot ? encodeScroll(ballot) : '' }, r.explorerUrl);
  }

  /** Open the scroll. If this device lost the salt, a pasted scroll restores it. */
  async reveal(n: CaseNumber, scroll?: string): Promise<ActionResult<BallotChoice>> {
    const me = await this.account();
    if (!me) return fail('no-wallet', 'Connect a wallet first.');
    if (scroll) {
      try {
        const b = decodeScroll(scroll);
        if (b.caseNumber !== n) return fail('bad-scroll', `That scroll is for ${formatCaseNumber(b.caseNumber)}.`);
        if (b.juror.toLowerCase() !== me) return fail('bad-scroll', 'That scroll belongs to a different wallet.');
        await this.#ports.salts.save({ ...b, savedAt: this.#clock() });
      } catch (err) {
        return failure(err);
      }
    }
    const r = await this.#session(n).reveal();
    this.#emit();
    return r.ok ? ok(r.value, r.explorerUrl) : fail(r.reason, r.message);
  }

  /** Permissionless settlement after the reveal deadline (D13). */
  async settle(n: CaseNumber): Promise<ActionResult> {
    return this.#tx(() => this.#ports.chain.finalize(n));
  }

  /** Pull a payout or refund: jurors, summoners and sponsors alike. */
  async claim(n: CaseNumber): Promise<ActionResult<readonly ReceiptLine[]>> {
    const me = await this.account();
    if (!me) return fail('no-wallet', 'Connect a wallet first.');
    try {
      const receipt = await this.#ports.chain.claim(n);
      await this.#ports.salts.remove(n, me);
      const lines = await this.#ports.chain.receipts(n, me);
      this.#emit();
      return ok(lines, receipt.explorerUrl);
    } catch (err) {
      return failure(err);
    }
  }

  /* ── Gallery (D11) ─────────────────────────────────────────────────── */

  async galleryVote(n: CaseNumber, choice: BallotChoice): Promise<ActionResult> {
    const me = await this.account();
    if (!me) return fail('no-account', 'Connect a wallet to call it.');
    const c = await this.#ports.chain.getCase(n);
    if (!c) return fail('not-found', 'This case is not on the docket.');
    if (revealClosed(c.phase)) return fail('closed', 'The gallery closed when the jury finished revealing.');
    if (c.seats.some((s) => s.juror.toLowerCase() === me)) return fail('juror', 'Jurors vote with their sealed ballot, not in the gallery.');
    try {
      await this.#gallery.cast(n, me, choice);
    } catch (err) {
      return failure(err);
    }
    this.#emit();
    return ok(undefined);
  }

  async #tx(fn: () => Promise<{ explorerUrl: string }>): Promise<ActionResult> {
    try {
      const r = await fn();
      this.#emit();
      return ok(undefined, r.explorerUrl);
    } catch (err) {
      return failure(err);
    }
  }
}

/* ── Pure helpers ───────────────────────────────────────────────────────── */

/** [opened, closes] of the current window, in unix seconds. */
export function windowOf(c: ChainCase): readonly [number, number] | null {
  const d = c.terms.deadlines;
  switch (c.phase) {
    case 'pre-trial':
      return c.deadlines.funding !== null && d.preTrial !== null ? [c.deadlines.funding - d.preTrial, c.deadlines.funding] : null;
    case 'recruiting':
      return c.deadlines.recruitment !== null ? [c.deadlines.recruitment - d.recruitment, c.deadlines.recruitment] : null;
    case 'commit':
      return c.deadlines.commit !== null ? [c.deadlines.commit - d.commit, c.deadlines.commit] : null;
    case 'reveal':
      return c.deadlines.reveal !== null ? [c.deadlines.reveal - d.reveal, c.deadlines.reveal] : null;
    default:
      return null;
  }
}

/** Summoners in contribution order, anonymised ("Summoner 3"), the viewer as "You". */
export function summoners(c: ChainCase, me: Hex | null): Summoner[] {
  const order: string[] = [];
  const totals = new Map<string, Usdc>();
  for (const d of c.deposits) {
    if (d.kind !== 'contributor') continue;
    const k = d.account.toLowerCase();
    if (!totals.has(k)) order.push(k);
    totals.set(k, addUsdc(totals.get(k) ?? ZERO_USDC, d.amount));
  }
  return order.map((k, i) => ({ label: k === me ? 'You' : `Summoner ${i + 1}`, amount: totals.get(k)!, isViewer: k === me }));
}

/** D13 disclosure for a closed case, or null while it runs. */
export function disclosureOf(c: ChainCase): Disclosure | null {
  if (c.phase !== 'settled' && c.phase !== 'cancelled') return null;
  let s: Settlement;
  try {
    s = settle({
      terms: c.terms,
      funders: c.deposits.map((d) => ({ account: d.account, kind: d.kind, amount: d.amount })),
      jurors: c.seats.map((seat) => {
        const r: { account: Hex; committed: boolean; revealed: boolean; choice?: BallotChoice } = {
          account: seat.juror,
          committed: seat.committed,
          revealed: seat.revealed,
        };
        if (seat.choice !== undefined) r.choice = seat.choice;
        return r;
      }),
      outcome: c.phase === 'cancelled' ? 'cancelled' : 'trial',
    });
  } catch {
    return null;
  }
  const funders = new Set(c.deposits.map((d) => d.account.toLowerCase()));
  const jurors = new Set(c.seats.map((x) => x.juror.toLowerCase()));
  let refunded = ZERO_USDC;
  let paid = ZERO_USDC;
  for (const st of s.statements) {
    if (st.party === 'protocol' || st.party === 'platform') continue;
    const k = st.party.toLowerCase();
    for (const l of st.lines) {
      if (l.kind === 'refund' && funders.has(k)) refunded = addUsdc(refunded, l.amount);
      if ((l.kind === 'reward' || l.kind === 'bond-returned' || l.kind === 'stipend') && jurors.has(k)) paid = addUsdc(paid, l.amount);
    }
  }
  return {
    outcome: c.phase === 'cancelled' ? 'cancelled' : s.verdict?.kind === 'no-verdict' ? 'no-verdict' : 'verdict',
    appointed: c.terms.jurySize,
    completed: c.seats.filter((x) => x.committed && x.revealed).length,
    fees: s.protocol.fees,
    forfeits: s.protocol.forfeits,
    unearnedBonus: s.protocol.unearnedBonus,
    sponsorFee: s.protocol.sponsor,
    refundedToFunders: refunded,
    paidToJurors: paid,
    totalIn: s.totalIn,
  };
}

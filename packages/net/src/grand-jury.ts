/**
 * RemoteGrandJuryCourt: the Grand Jury court as seen from one device, over the
 * court server. It has the same surface as `GrandJuryCourt` (the screens cannot
 * tell them apart) but the docket, the ledger twin, the jury pool and the
 * simulated crowd live on the server, shared by every device.
 *
 * What stays on this device, by design:
 * - World ID: the proof is requested here (mock persona or IDKit) and only the
 *   proof travels; the server verifies it and keeps one seat per human.
 * - The ballot salt (ARCHITECTURE rule 3). Sealing computes the commitment here
 *   and sends only the commitment, so the server cannot know a juror's vote
 *   before the reveal. The Secret Verdict Scroll is the backup, as before.
 */
import { formatCaseNumber, type BallotChoice, type CaseNumber, type Hex, type IdentityPort, type SaltVault, type SeatOffer, type ReceiptLine, type Usdc } from '@cringe-court/core';
import { MemoryChain } from '@cringe-court/core/testing';
import { decodeScroll, encodeScroll, ScrollError, type ActionResult, type CaseDetail, type DocketEntry, type GrandJuryCourt } from '@cringe-court/modes-grand-jury';
import {
  API,
  gjCasePath,
  type GjAction,
  type GjActionResponse,
  type GjCaseResponse,
  type GjDocketResponse,
  type GjMeta,
  type GjStateResponse,
} from './protocol';
import { BackendError, type CourtConnection } from './transport';

/** What the Grand Jury screens use of a court. `GrandJuryCourt` and `RemoteGrandJuryCourt` both satisfy it. */
export type GrandJuryCourtApi = Pick<
  GrandJuryCourt,
  | 'now'
  | 'subscribe'
  | 'account'
  | 'balance'
  | 'list'
  | 'detail'
  | 'contribute'
  | 'screen'
  | 'requestSeat'
  | 'declineSeat'
  | 'acceptSeat'
  | 'seal'
  | 'reveal'
  | 'settle'
  | 'claim'
  | 'galleryVote'
>;

export interface RemoteCourtOptions {
  connection: CourtConnection;
  /** This device's World ID (mock persona or IDKit). Only `requestProof` is used here. */
  identity: IdentityPort;
  /** Ballot salts on this device. */
  salts: SaltVault;
  /** Words for a transport failure (the app translates them). */
  describe?: (err: BackendError) => string;
  /** Device clock, ms (tests skew it). */
  deviceNow?: () => number;
}

const fail = (code: string, message: string): ActionResult<never> => ({ ok: false, code, message });

export class RemoteGrandJuryCourt implements GrandJuryCourtApi {
  readonly #c: CourtConnection;
  readonly #identity: IdentityPort;
  readonly #salts: SaltVault;
  readonly #describe: (err: BackendError) => string;
  readonly #deviceNow: () => number;
  readonly #listeners = new Set<() => void>();
  readonly #off: (() => void)[];
  /** Court time minus device time, ms (demo skips included). */
  #courtOffset: number | null = null;
  #version = -1;
  #state: GjStateResponse | null = null;
  #ledger: MemoryChain | null = null;

  constructor(o: RemoteCourtOptions) {
    this.#c = o.connection;
    this.#identity = o.identity;
    this.#salts = o.salts;
    this.#describe = o.describe ?? ((e) => e.message);
    this.#deviceNow = o.deviceNow ?? (() => Date.now());
    this.#off = [
      o.connection.on('gj', (e) => this.#meta(e)),
      o.connection.onResync(() => {
        void this.state().then(
          () => this.#emit(),
          () => undefined,
        );
      }),
    ];
  }

  /** Court time, unix seconds: the server's clock plus any demo skip, corrected for this device's skew. */
  now(): number {
    const offset = this.#courtOffset ?? this.#c.skewMs;
    return Math.floor((this.#deviceNow() + offset) / 1000);
  }

  get version(): number {
    return this.#version;
  }

  subscribe(fn: () => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  dispose(): void {
    for (const off of this.#off) off();
    this.#listeners.clear();
  }

  #emit(): void {
    for (const fn of [...this.#listeners]) fn();
  }

  /** Every response and event carries court time and the world's version. */
  #meta(m: GjMeta): void {
    this.#courtOffset = m.now * 1000 - this.#deviceNow() + 500;
    if (m.version !== this.#version) {
      const first = this.#version === -1;
      this.#version = m.version;
      if (!first) this.#emit();
    }
  }

  /* ── reads ─────────────────────────────────────────────────────────── */

  async state(): Promise<GjStateResponse> {
    const s = await this.#c.get<GjStateResponse>(`${API}/gj/state`);
    this.#meta(s);
    this.#state = s;
    return s;
  }

  async account(): Promise<Hex | null> {
    return (this.#state ?? (await this.state())).account;
  }

  async balance(): Promise<Usdc | null> {
    return (await this.state()).balance;
  }

  /** Marketing-cap publications so far (the pricing page's D10 counter). */
  marketingUsed(): number {
    return this.#state?.marketingUsed ?? 0;
  }

  async list(): Promise<readonly DocketEntry[]> {
    const r = await this.#c.get<GjDocketResponse>(`${API}/gj/docket`);
    this.#meta(r);
    return r.entries;
  }

  async detail(n: CaseNumber): Promise<CaseDetail | null> {
    const r = await this.#c.get<GjCaseResponse>(gjCasePath(n));
    this.#meta(r);
    const d = r.detail;
    if (!d) return null;
    // The server never holds a salt: this device fills in its own sealed ballot.
    const me = d.viewer.account;
    const ballot = me ? await this.#salts.load(n, me) : null;
    const scroll = ballot && d.viewer.seat !== null && !d.viewer.revealed ? encodeScroll(ballot) : null;
    return { ...d, viewer: { ...d.viewer, sealedChoice: ballot?.choice ?? null, hasSalt: ballot !== null, scroll } };
  }

  /* ── actions ───────────────────────────────────────────────────────── */

  async #act<T>(n: CaseNumber | null, action: GjAction | 'faucet', body: unknown = {}): Promise<ActionResult<T>> {
    try {
      const path = n === null ? `${API}/gj/${action}` : gjCasePath(n, action as GjAction);
      const r = await this.#c.post<GjActionResponse<T>>(path, body);
      this.#meta(r);
      this.#emit();
      return r.result;
    } catch (err) {
      if (err instanceof BackendError) return fail(err.code, this.#describe(err));
      return fail('error', err instanceof Error ? err.message : String(err));
    }
  }

  contribute(n: CaseNumber, amount: Usdc): Promise<ActionResult> {
    return this.#act(n, 'contribute', { amount });
  }

  /** Juror Screening: the World ID proof is made on this device and checked by the server. */
  async screen(n: CaseNumber, signal?: AbortSignal): Promise<ActionResult<Hex>> {
    const request = { action: 'accept-jury-seat' as const, signal: `case:${n}:seat`, minLevel: 'orb' as const };
    const proof = await this.#identity.requestProof(request, signal);
    if (!proof.ok) return fail(proof.reason, proof.message);
    const screened = await this.#identity.verify(proof.proof, request);
    if (!screened.ok) return fail(screened.reason, screened.message);
    return this.#act<Hex>(n, 'screen', { proof: proof.proof });
  }

  requestSeat(n: CaseNumber): Promise<ActionResult<SeatOffer>> {
    return this.#act<SeatOffer>(n, 'seat-request');
  }

  declineSeat(n: CaseNumber): Promise<ActionResult> {
    return this.#act(n, 'seat-decline');
  }

  acceptSeat(n: CaseNumber): Promise<ActionResult> {
    return this.#act(n, 'seat-accept');
  }

  /** Seal a ballot: the salt is saved here first, and only the commitment is sent. */
  async seal(n: CaseNumber, choice: BallotChoice): Promise<ActionResult<{ scroll: string }>> {
    const me = await this.account().catch(() => null);
    if (!me) return fail('no-wallet', 'Connect a wallet first.');
    const salt = this.#salts.newSalt();
    this.#ledger ??= new MemoryChain();
    const commitment = this.#ledger.commitmentFor(n, me, choice, salt);
    const ballot = { caseNumber: n, juror: me, choice, salt, commitment, savedAt: this.now() };
    // Save before sending: a lost salt is a missed reveal (V4 §7).
    await this.#salts.save(ballot);
    const r = await this.#act(n, 'commit', { commitment });
    return r.ok ? { ...r, value: { scroll: encodeScroll(ballot) } } : r;
  }

  /** Open the scroll. If this device lost the salt, a pasted scroll restores it. */
  async reveal(n: CaseNumber, scroll?: string): Promise<ActionResult<BallotChoice>> {
    const me = await this.account().catch(() => null);
    if (!me) return fail('no-wallet', 'Connect a wallet first.');
    if (scroll) {
      try {
        const b = decodeScroll(scroll);
        if (b.caseNumber !== n) return fail('bad-scroll', `That scroll is for ${formatCaseNumber(b.caseNumber)}.`);
        if (b.juror.toLowerCase() !== me.toLowerCase()) return fail('bad-scroll', 'That scroll belongs to a different wallet.');
        await this.#salts.save({ ...b, savedAt: this.now() });
      } catch (err) {
        return fail(err instanceof ScrollError ? 'bad-scroll' : 'error', err instanceof Error ? err.message : String(err));
      }
    }
    const ballot = await this.#salts.load(n, me);
    if (!ballot) return fail('salt-missing', 'This device does not have your sealed ballot. Reveal from the device you voted on.');
    const r = await this.#act(n, 'reveal', { choice: ballot.choice, salt: ballot.salt });
    return r.ok ? { ...r, value: ballot.choice } : r;
  }

  settle(n: CaseNumber): Promise<ActionResult> {
    return this.#act(n, 'settle');
  }

  async claim(n: CaseNumber): Promise<ActionResult<readonly ReceiptLine[]>> {
    const r = await this.#act<readonly ReceiptLine[]>(n, 'claim');
    if (r.ok) {
      const me = await this.account().catch(() => null);
      if (me) await this.#salts.remove(n, me);
    }
    return r;
  }

  galleryVote(n: CaseNumber, choice: BallotChoice): Promise<ActionResult> {
    return this.#act(n, 'gallery', { choice });
  }

  /** Testnet faucet stand-in on the shared ledger twin. */
  faucet(amount: Usdc): Promise<ActionResult> {
    return this.#act(null, 'faucet', { amount });
  }

  /** Demo control: let the simulated jurors act, then move the shared court clock past this case's deadline. */
  skip(n: CaseNumber): Promise<ActionResult> {
    return this.#act(n, 'skip');
  }
}

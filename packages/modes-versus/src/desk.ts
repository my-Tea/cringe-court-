/**
 * The Versus desk: every action a person can take on a case, as async commands.
 *
 * A command does its non-deterministic work first (World ID proof, AI draft,
 * ballot salt), then writes facts. Before writing it rebuilds the world from
 * the latest log and dry-runs the facts, so an invalid action fails with the
 * court's own message and nothing is written; if someone else wrote in the
 * meantime it rebuilds and tries again (optimistic concurrency).
 *
 * `tick()` is the court clerk: permissionless housekeeping any open tab may run
 * (draft counsel, finalize after the reveal window, read the sentence, drive
 * the clearly-labelled demo jurors). Duplicates from two tabs are harmless: the
 * second one is re-evaluated against the new log and writes nothing.
 */
import {
  CounselError,
  briefsFor,
  keccak256,
  monotonicUnixClock,
  seededRandom,
  type AiCounselPort,
  type AngleSuggestion,
  type CaseTerms,
  type Category,
  type CounselRequest,
  type CounselState,
  type Exhibit,
  type FilingPatch,
  type Hex,
  type IdentityPort,
  type JuryState,
  type ProofRequest,
  type SaltVault,
  type ShareRecord,
  type SideId,
  type TermsOptions,
  type Usdc,
} from '@cringe-court/core';
import { versusTerms } from './definition';
import { makeInviteCode, makeTrialId, type InviteCode } from './invite';
import { redact } from './redact';
import type { FactStore } from './store';
import { World, type DemoReliability, type Fact, type FactBody, type VersusCase } from './world';

export interface Persona {
  /** Stable id for this person on this device ("p-…"). */
  id: string;
  /** What the UI calls them in the persona switcher ("Tab 2"). Never shown to the other side. */
  name: string;
  account: Hex;
}

export interface VersusDeskOptions {
  store: FactStore;
  persona: Persona;
  counsel: AiCounselPort;
  identity: IdentityPort;
  salts: SaltVault;
  /** Unix seconds. Default: wall clock at start, then monotonic (B19). */
  clock?: () => number;
  /** [0, 1); used for invite codes and trial ids. Pass a CSPRNG-backed source in the browser. */
  random?: () => number;
  /** Demo deadlines (D14). Default true: there is no production deployment yet. */
  demo?: boolean;
}

export class VersusError extends Error {
  constructor(
    message: string,
    readonly code: 'rejected' | 'identity' | 'conflicted' | 'funds' | 'busy' | 'counsel' | 'salt' = 'rejected',
  ) {
    super(message);
    this.name = 'VersusError';
  }
}

/** One per-case World ID action for everyone in the case, so a party and a juror who are the same human share a nullifier (V4 §10). */
export function courtProof(trialId: string, juror = false): ProofRequest {
  const request: ProofRequest = { action: 'case-party', signal: `case:${trialId}` };
  if (juror) request.minLevel = 'orb';
  return request;
}

/** A6/A16: the same budget for both agents (fairness). */
export const VERSUS_TOKEN_BUDGET = { maxInputTokens: 6000, maxOutputTokens: 1200 } as const;

export function counselRequestFor(c: VersusCase, s: CounselState): CounselRequest {
  const fullShare = s.terms.payerShares.reduce((m, x) => (x > m ? x : m), 0n);
  const payer = (i: 0 | 1) => ((s.terms.payerShares[i] ?? fullShare) < fullShare ? ('user-credits' as const) : ('platform' as const));
  const request: CounselRequest = {
    trialId: c.trialId,
    mode: 'versus',
    category: s.filing.category,
    title: s.filing.title,
    ballot: s.terms.ballot,
    benches: s.benches,
    briefs: briefsFor(s.benches, s.filing),
    exhibits: s.exhibits.map(({ id, submittedBy, kind, title, body }) => ({ id, submittedBy, kind, title, body })),
    scope: 'full',
    payer: [payer(0), payer(1)],
    budget: VERSUS_TOKEN_BUDGET,
    attempt: s.attempt,
  };
  if (s.pendingRedraft !== null) request.redraft = s.pendingRedraft;
  if (s.draft && s.pendingRedraft !== null) request.carryOver = s.draft.lines;
  return request;
}

/** Demo jurors are simulations: their salts are derived, not secret. Real jurors' salts never leave their device. */
export function demoSalt(trialId: string, account: Hex): Hex {
  return keccak256(`demo-salt:${trialId}:${account.toLowerCase()}`);
}

export function demoChoice(trialId: string, account: Hex): 0 | 1 {
  return seededRandom(`demo-vote:${trialId}:${account.toLowerCase()}`)() < 0.5 ? 0 : 1;
}

export function demoJurorAccount(trialId: string, seat: number): Hex {
  const h = keccak256(`demo-juror:${trialId}:${seat}`);
  return `0x${h.slice(26)}` as Hex;
}

/** Seconds between demo jurors acting, so the jury box fills visibly. */
export const DEMO_JUROR_STAGGER = 4;

export type DemoJuryPlan = 'reliable' | 'one-no-show' | 'two-no-shows';

/** Every seated juror has sealed (commit window) or every sealed scroll is open (reveal window). */
function everyoneActed(s: JuryState): boolean {
  if (s.step === 'commit') return s.seats.length > 0 && s.seats.every((x) => x.committed);
  if (s.step === 'reveal') return s.seats.filter((x) => x.committed).every((x) => x.revealed);
  return false;
}

export class VersusDesk {
  readonly store: FactStore;
  persona: Persona;
  readonly counsel: AiCounselPort;
  readonly identity: IdentityPort;
  readonly salts: SaltVault;
  readonly #clock: () => number;
  readonly #random: () => number;
  readonly #demo: boolean;
  readonly #inflight = new Set<string>();

  constructor(options: VersusDeskOptions) {
    this.store = options.store;
    this.persona = options.persona;
    this.counsel = options.counsel;
    this.identity = options.identity;
    this.salts = options.salts;
    const real = monotonicUnixClock();
    this.#clock = options.clock ?? (() => Math.floor(real()));
    this.#random = options.random ?? Math.random;
    this.#demo = options.demo ?? true;
  }

  get account(): Hex {
    return this.persona.account;
  }

  /** The world as of now (wall clock + demo skew). */
  async world(): Promise<World> {
    const w = await World.replay(this.store.read());
    await w.advanceTo(this.#clock() + w.skew);
    return w;
  }

  terms(options: TermsOptions = {}): CaseTerms {
    return versusTerms({ ...options, demo: this.#demo });
  }

  /* ── filing and invites ────────────────────────────────────────────── */

  /** Side A files: World ID proof, then open + brief + submit in one write. Nothing touches the chain yet (D6). */
  async fileCase(input: { title: string; category: Category; patch: FilingPatch; terms?: CaseTerms }): Promise<{ trialId: string; code: InviteCode }> {
    const trialId = makeTrialId(this.#random);
    const nullifier = await this.#prove(trialId, false);
    const code = makeInviteCode(this.#random);
    const terms = input.terms ?? this.terms();
    await this.#write(() => [
      { type: 'open', trialId, code, account: this.account, nullifier, category: input.category, title: redact(input.title.trim()).text, terms },
      { type: 'brief', trialId, side: 'a', account: this.account, patch: input.patch },
      { type: 'submit', trialId, account: this.account },
    ]);
    return { trialId, code };
  }

  async findByCode(code: InviteCode): Promise<VersusCase | undefined> {
    return (await this.world()).cases().find((c) => c.code === code);
  }

  /** Side B consents with a World ID proof. */
  async acceptInvite(trialId: string): Promise<void> {
    const nullifier = await this.#prove(trialId, false);
    await this.#write(() => [{ type: 'consent', trialId, account: this.account, nullifier }]);
  }

  async declineInvite(trialId: string): Promise<void> {
    await this.#write(() => [{ type: 'decline', trialId }]);
  }

  /* ── briefs and evidence ───────────────────────────────────────────── */

  async saveBrief(trialId: string, side: SideId, patch: FilingPatch): Promise<void> {
    await this.#write(() => [{ type: 'brief', trialId, side, account: this.account, patch }]);
  }

  async addExhibit(trialId: string, side: SideId, input: { title: string; body: string; kind?: Exhibit['kind'] }): Promise<Exhibit> {
    let exhibit: Exhibit | null = null;
    await this.#write((w) => {
      const c = w.case(trialId);
      const existing = c && 'exhibits' in c.state ? c.state.exhibits : [];
      let n = existing.filter((x) => x.submittedBy === side).length + 1;
      while (existing.some((x) => x.id === `${side}-${n}`)) n++;
      exhibit = {
        id: `${side}-${n}`,
        submittedBy: side,
        kind: input.kind ?? 'quote',
        title: redact(input.title.trim()).text,
        body: redact(input.body.trim()).text,
        redacted: true,
      };
      return [{ type: 'exhibit', trialId, side, account: this.account, exhibit }];
    });
    return exhibit!;
  }

  async removeExhibit(trialId: string, side: SideId, exhibitId: string): Promise<void> {
    await this.#write(() => [{ type: 'exhibit-removed', trialId, side, account: this.account, exhibitId }]);
  }

  async approveBrief(trialId: string, side: SideId): Promise<void> {
    await this.#write(() => [{ type: 'approve-brief', trialId, side, account: this.account }]);
  }

  async suggestAngles(trialId: string, story: string, privateNotes: string, side: SideId, category: Category): Promise<readonly AngleSuggestion[]> {
    return this.counsel.suggestAngles({ trialId, mode: 'versus', category, story, privateNotes, role: side === 'a' ? 'prosecution' : 'defense' });
  }

  /* ── counsel ───────────────────────────────────────────────────────── */

  /** Draft (or redraft) until the case leaves `counsel/drafting`. Safe to call from several tabs. */
  async runCounsel(trialId: string, signal?: AbortSignal): Promise<void> {
    for (let round = 0; round < 4; round++) {
      const w = await this.world();
      const c = w.case(trialId);
      const s = c?.state;
      if (!c || s?.stage !== 'counsel' || s.step !== 'drafting') return;
      const key = `${trialId}:${s.attempt}`;
      if (this.#inflight.has(key)) return;
      this.#inflight.add(key);
      try {
        const request = counselRequestFor(c, s);
        let body: FactBody;
        try {
          const draft = await this.counsel.draft(request, signal);
          const balance = await this.counsel.assessBalance(draft, request);
          body = { type: 'drafted', trialId, draft, balance };
        } catch (err) {
          if (err instanceof CounselError && err.code === 'aborted') return;
          if (err instanceof CounselError && err.retryable && round === 0) continue;
          body = { type: 'counsel-failed', trialId, message: err instanceof Error ? err.message : 'Counsel failed' };
        }
        await this.#write(
          (latest) => {
            const now = latest.case(trialId)?.state;
            return now?.stage === 'counsel' && now.step === 'drafting' && now.attempt === s.attempt ? [body] : [];
          },
          'clerk',
        );
      } finally {
        this.#inflight.delete(key);
      }
    }
  }

  async requestRedraft(trialId: string, side: SideId): Promise<void> {
    await this.#write(() => [{ type: 'redraft', trialId, side, account: this.account }]);
  }

  async approveDraft(trialId: string, side: SideId): Promise<void> {
    await this.#write(() => [{ type: 'approve-draft', trialId, side, account: this.account }]);
  }

  /* ── money ─────────────────────────────────────────────────────────── */

  async balance(): Promise<Usdc> {
    return (await this.world()).chain.usdcBalance(this.account);
  }

  async faucet(amount: Usdc): Promise<void> {
    await this.#write(() => [{ type: 'faucet', account: this.account, amount }]);
  }

  async fund(trialId: string): Promise<void> {
    await this.#write(async (w) => {
      const c = w.case(trialId);
      const s = c?.state;
      if (!c || s?.stage !== 'counsel' || s.step !== 'funding') throw new VersusError('This case is not taking payments right now');
      const i = c.parties.a?.account === this.account.toLowerCase() ? 0 : 1;
      const share = s.terms.payerShares[i]!;
      const have = await w.chain.usdcBalance(this.account);
      if (have < share) throw new VersusError('Not enough test USDC in this demo wallet. Use the faucet first.', 'funds');
      return [{ type: 'fund', trialId, account: this.account }];
    });
  }

  async withdraw(trialId: string, side: SideId): Promise<void> {
    await this.#write(() => [{ type: 'withdraw', trialId, side, account: this.account }]);
  }

  async claim(trialId: string): Promise<void> {
    await this.#write(() => [{ type: 'claim', trialId, account: this.account }]);
    const w = await this.world();
    const c = w.case(trialId);
    if (c?.caseNumber != null) await this.salts.remove(c.caseNumber, this.account);
  }

  /* ── jury ──────────────────────────────────────────────────────────── */

  /** World ID (Orb) gate, conflict check against the parties, then the bond. */
  async takeSeat(trialId: string): Promise<void> {
    const w0 = await this.world();
    const c0 = w0.case(trialId);
    if (!c0 || c0.caseNumber === null) throw new VersusError('The jury has not been called yet');
    const bond = c0.state.terms.bondPerJuror;
    if ((await w0.chain.usdcBalance(this.account)) < bond) throw new VersusError('Not enough test USDC for the bond. Use the faucet first.', 'funds');
    const request = courtProof(trialId, true);
    const proof = await this.identity.requestProof(request);
    if (!proof.ok) throw new VersusError(proof.message, 'identity');
    const exclude = Object.values(c0.parties).flatMap((p) => (p ? [p.nullifier] : []));
    const screened = await this.identity.verify(proof.proof, request, { caseNumber: c0.caseNumber, exclude });
    if (!screened.ok) throw new VersusError(screened.message, screened.reason === 'conflicted' ? 'conflicted' : 'identity');
    await this.#write(() => [{ type: 'seat', trialId, account: this.account, nullifier: screened.nullifier }]);
  }

  /** Seal a ballot: the salt is saved on this device before the commitment is sent (V4 §7). */
  async commitBallot(trialId: string, choice: 0 | 1): Promise<void> {
    const w = await this.world();
    const c = w.case(trialId);
    if (!c || c.caseNumber === null) throw new VersusError('No jury yet');
    const salt = this.salts.newSalt();
    const commitment = w.chain.commitmentFor(c.caseNumber, this.account, choice, salt);
    await this.salts.save({ caseNumber: c.caseNumber, juror: this.account, choice, salt, commitment, savedAt: this.#clock() });
    await this.#write(() => [{ type: 'commit', trialId, account: this.account, commitment }]);
  }

  async revealBallot(trialId: string): Promise<0 | 1> {
    const w = await this.world();
    const c = w.case(trialId);
    if (!c || c.caseNumber === null) throw new VersusError('No jury yet');
    const sealed = await this.salts.load(c.caseNumber, this.account);
    if (!sealed) throw new VersusError('This device does not have your sealed scroll. It was saved where you committed.', 'salt');
    await this.#write(() => [{ type: 'reveal', trialId, account: this.account, choice: sealed.choice, salt: sealed.salt }]);
    return sealed.choice;
  }

  async sealedChoice(trialId: string): Promise<0 | 1 | null> {
    const c = (await this.world()).case(trialId);
    if (!c || c.caseNumber === null) return null;
    return (await this.salts.load(c.caseNumber, this.account))?.choice ?? null;
  }

  /** Demo control: seat simulated verified jurors in the empty seats. Labelled as a simulation in the UI. */
  async seatDemoJurors(trialId: string, plan: DemoJuryPlan = 'reliable'): Promise<void> {
    await this.#write((w) => {
      const c = w.case(trialId);
      const s = c?.state;
      if (!c || s?.stage !== 'jury' || s.step !== 'recruiting') throw new VersusError('The jury is not being recruited right now');
      const empty = s.terms.jurySize - s.seats.length;
      const noShows = plan === 'reliable' ? 0 : plan === 'one-no-show' ? 1 : 2;
      const bodies: FactBody[] = [];
      for (let i = 0; i < empty; i++) {
        const seat = s.seats.length + i + 1;
        const account = demoJurorAccount(trialId, seat);
        const reliability: DemoReliability = i >= empty - noShows ? 'no-show' : 'reliable';
        bodies.push({ type: 'faucet', account, amount: s.terms.bondPerJuror });
        bodies.push({ type: 'seat', trialId, account, nullifier: keccak256(`demo-human:${trialId}:${seat}`), demo: reliability });
      }
      return bodies;
    }, 'clerk');
  }

  /** Demo control (D14): jump the court clock to just past the running deadline. */
  async skipAhead(trialId: string): Promise<void> {
    await this.#write((w) => {
      const c = w.case(trialId);
      const s = c?.state;
      if (!s) return [];
      let endsAt: number | null = null;
      if (s.stage === 'filing') endsAt = s.consentEndsAt;
      else if (s.stage === 'counsel' && s.step === 'funding') endsAt = s.fundingEndsAt;
      else if (s.stage === 'jury') endsAt = s.step === 'recruiting' ? s.recruitEndsAt : s.step === 'commit' ? s.commitEndsAt : s.step === 'reveal' ? s.revealEndsAt : null;
      if (endsAt === null || endsAt <= w.now) return [];
      return [{ type: 'clock', seconds: endsAt - w.now + 1 }];
    });
  }

  async share(trialId: string, channel: ShareRecord['channel']): Promise<void> {
    await this.#write((w) => {
      const s = w.case(trialId)?.state;
      return s && (s.stage === 'verdict' || s.stage === 'share') ? [{ type: 'share', trialId, channel }] : [];
    });
  }

  /* ── the clerk ─────────────────────────────────────────────────────── */

  /** One round of housekeeping. Returns true if it wrote anything. */
  async tick(options: { counsel?: boolean } = {}): Promise<boolean> {
    const w = await this.world();
    let wrote = false;
    for (const c of w.cases()) {
      const s = c.state;
      if (this.#demo && s.stage === 'jury' && everyoneActed(s)) {
        wrote = (await this.#closeWindowEarly(c.trialId)) || wrote;
        continue;
      }
      const mine = Object.values(c.parties).some((p) => p?.account === this.account.toLowerCase());
      if (s.stage === 'counsel' && s.step === 'drafting' && (options.counsel ?? mine)) {
        // Errors surface on the next tick as state (a failed draft closes the case); never as an unhandled rejection.
        void this.runCounsel(c.trialId).catch(() => undefined);
      }
      if (s.stage === 'jury' && (s.step === 'commit' || s.step === 'reveal') && c.demoJurors.size > 0) {
        wrote = (await this.#driveDemoJury(c.trialId)) || wrote;
      }
      if (s.stage === 'jury' && s.step === 'finalizing') {
        await this.#write((latest) => (latest.case(c.trialId)?.state.stage === 'jury' ? [{ type: 'finalize', trialId: c.trialId }] : []), 'clerk');
        wrote = true;
      }
      if ((s.stage === 'verdict' || s.stage === 'share') && s.sentence === null && !this.#inflight.has(`sentence:${c.trialId}`)) {
        this.#inflight.add(`sentence:${c.trialId}`);
        try {
          const line = await this.counsel.sentence({ trialId: c.trialId, verdictLabel: s.verdict.label, transcriptHash: s.transcript.hash, category: s.filing.category, title: s.filing.title });
          await this.#write((latest) => {
            const now = latest.case(c.trialId)?.state;
            return now && (now.stage === 'verdict' || now.stage === 'share') && now.sentence === null ? [{ type: 'sentence', trialId: c.trialId, line }] : [];
          }, 'clerk');
          wrote = true;
        } catch {
          // A missing sentence never blocks the verdict; the next tick retries.
        } finally {
          this.#inflight.delete(`sentence:${c.trialId}`);
        }
      }
    }
    return wrote;
  }

  /**
   * Demo only (D14): once every seated juror has acted in the running window,
   * jump the court clock to its deadline instead of making everyone wait it
   * out. Same transition the deadline itself makes; the facts say so.
   */
  async #closeWindowEarly(trialId: string): Promise<boolean> {
    let wrote = false;
    await this.#write((w) => {
      const s = w.case(trialId)?.state;
      if (s?.stage !== 'jury' || !everyoneActed(s)) return [];
      const endsAt = s.step === 'commit' ? s.commitEndsAt : s.revealEndsAt;
      if (endsAt === null || endsAt <= w.now) return [];
      wrote = true;
      return [{ type: 'clock', seconds: endsAt - w.now }];
    }, 'clerk');
    return wrote;
  }

  async #driveDemoJury(trialId: string): Promise<boolean> {
    let wrote = false;
    await this.#write((w) => {
      const c = w.case(trialId);
      const s = c?.state;
      if (!c || s?.stage !== 'jury' || s.commitEndsAt === null || c.caseNumber === null) return [];
      const bodies: FactBody[] = [];
      const bots = s.seats.filter((x) => c.demoJurors.has(x.account.toLowerCase()));
      bots.forEach((seat, i) => {
        const account = seat.account;
        const reliability = c.demoJurors.get(account.toLowerCase());
        const choice = demoChoice(trialId, account);
        const salt = demoSalt(trialId, account);
        if (s.step === 'commit' && !seat.committed) {
          const opened = s.commitEndsAt! - s.terms.deadlines.commit;
          if (w.now >= opened + DEMO_JUROR_STAGGER * (i + 1)) {
            bodies.push({ type: 'commit', trialId, account, commitment: w.chain.commitmentFor(c.caseNumber!, account, choice, salt) });
          }
        }
        if (s.step === 'reveal' && seat.committed && !seat.revealed && reliability === 'reliable') {
          if (w.now >= s.commitEndsAt! + DEMO_JUROR_STAGGER * (i + 1)) bodies.push({ type: 'reveal', trialId, account, choice, salt });
        }
      });
      wrote = bodies.length > 0;
      return bodies;
    }, 'clerk');
    return wrote;
  }

  /* ── internals ─────────────────────────────────────────────────────── */

  async #prove(trialId: string, juror: boolean): Promise<Hex> {
    const request = courtProof(trialId, juror);
    const proof = await this.identity.requestProof(request);
    if (!proof.ok) throw new VersusError(proof.message, 'identity');
    const screened = await this.identity.verify(proof.proof, request);
    if (!screened.ok) throw new VersusError(screened.message, 'identity');
    return screened.nullifier;
  }

  async #write(make: (w: World) => FactBody[] | Promise<FactBody[]>, by: string = this.persona.id): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const facts = this.store.read();
      const w = await World.replay(facts);
      const now = Math.max(w.lastAt, this.#clock() + w.skew);
      await w.advanceTo(now);
      const bodies = await make(w);
      if (bodies.length === 0) return;
      let seq = w.lastSeq;
      const next: Fact[] = bodies.map((b) => ({ ...b, seq: ++seq, at: now, by }) as Fact);
      for (const f of next) {
        const r = await w.apply(f);
        if (!r.ok) throw new VersusError(r.message);
      }
      if (await this.store.append(next, facts.length)) return;
    }
    throw new VersusError('Someone else is updating this case. Try again in a moment.', 'busy');
  }
}

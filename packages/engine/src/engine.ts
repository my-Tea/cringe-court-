/**
 * TrialEngine: one case, run through the ports. It owns the TrialState, turns
 * user intents into port calls, port results into TrialEvents, and mirrors the
 * ledger (the source of truth for money and phase) back into the state.
 *
 * Rules it keeps:
 * - Every state change goes through core `transition()`; a rejected intent throws
 *   EngineError with the machine's reason and leaves the state unchanged.
 * - The information wall is core `briefsFor()`; the engine never assembles prompts.
 * - Ledger events that the state already reflects are ignored (idempotent sync).
 * - Settlement shown in the app is recomputed from the ledger's own case view with
 *   core `settle()`, the same maths the contract and memory twin use.
 */
import {
  CounselError,
  briefsFor,
  createTrial,
  formatCaseNumber,
  partiesOf,
  settle,
  transition,
  type CaseNumber,
  type ChainCase,
  type ChainEvent,
  type CounselDraft,
  type CounselRequest,
  type CourtLine,
  type CourtPorts,
  type Exhibit,
  type FilingPatch,
  type Hex,
  type ModeDefinition,
  type Settlement,
  type SideId,
  type Approver,
  type TermsOptions,
  type TrialError,
  type TrialEvent,
  type TrialId,
  type TrialState,
  type Category,
  type InferencePayer,
} from '@cringe-court/core';

export class EngineError extends Error {
  constructor(
    readonly reason: TrialError | { code: 'port'; message: string },
  ) {
    super(reason.message);
    this.name = 'EngineError';
  }
}

export interface TrialEngineOptions {
  id: TrialId;
  mode: ModeDefinition;
  ports: Pick<CourtPorts, 'counsel' | 'chain'>;
  category: Category;
  title?: string;
  /** The filer's account (null for an editor-run Grand Jury case). */
  filer: Hex | null;
  /** Unix seconds. */
  clock?: () => number;
  terms?: TermsOptions;
  scope?: CounselRequest['scope'];
  payer?: readonly [InferencePayer, InferencePayer];
  budget?: CounselRequest['budget'];
  /** Resume from a saved state instead of creating a new trial. */
  resume?: TrialState;
}

export type EngineListener = (state: TrialState, event: TrialEvent | null) => void;

const DEFAULT_BUDGET = { maxInputTokens: 2400, maxOutputTokens: 700 };

export class TrialEngine {
  readonly mode: ModeDefinition;
  readonly #ports: Pick<CourtPorts, 'counsel' | 'chain'>;
  readonly #clock: () => number;
  readonly #listeners = new Set<EngineListener>();
  readonly #scope: CounselRequest['scope'];
  readonly #payer: readonly [InferencePayer, InferencePayer];
  readonly #budget: CounselRequest['budget'];
  #state: TrialState;
  #unsubscribe: (() => void) | null = null;
  #ignored: { event: TrialEvent['type']; message: string }[] = [];

  constructor(options: TrialEngineOptions) {
    this.mode = options.mode;
    this.#ports = options.ports;
    this.#clock = options.clock ?? (() => Math.floor(Date.now() / 1000));
    this.#scope = options.scope ?? 'full';
    this.#payer = options.payer ?? ['platform', 'platform'];
    this.#budget = options.budget ?? DEFAULT_BUDGET;
    this.#state =
      options.resume ??
      createTrial({
        id: options.id,
        mode: options.mode.id,
        terms: options.mode.terms(options.terms),
        rules: options.mode.rules,
        benches: options.mode.benches,
        category: options.category,
        title: options.title ?? '',
        filer: options.filer,
        now: this.#clock(),
      });
    if (this.#state.stage === 'jury' || (this.#state.stage === 'counsel' && this.#state.caseNumber !== null)) this.#watch();
  }

  get state(): TrialState {
    return this.#state;
  }

  /** Ledger events that did not apply (already reflected, or out of order). For diagnostics. */
  get ignored(): readonly { event: TrialEvent['type']; message: string }[] {
    return this.#ignored;
  }

  get caseNumber(): CaseNumber | null {
    return 'caseNumber' in this.#state ? (this.#state.caseNumber ?? null) : null;
  }

  get caseLabel(): string | null {
    const n = this.caseNumber;
    return n === null ? null : formatCaseNumber(n);
  }

  subscribe(listener: EngineListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#listeners.clear();
  }

  /** Apply one event; throws EngineError if the machine rejects it. */
  dispatch(event: TrialEvent): TrialState {
    const result = transition(this.#state, event, { now: this.#clock() });
    if (!result.ok) throw new EngineError(result.error);
    this.#state = result.state;
    for (const fn of [...this.#listeners]) fn(this.#state, event);
    return this.#state;
  }

  /** Like dispatch, but a rejection is recorded instead of thrown (ledger sync). */
  #apply(event: TrialEvent): boolean {
    const result = transition(this.#state, event, { now: this.#clock() });
    if (!result.ok) {
      this.#ignored.push({ event: event.type, message: result.error.message });
      return false;
    }
    this.#state = result.state;
    for (const fn of [...this.#listeners]) fn(this.#state, event);
    return true;
  }

  /* ── Filing and evidence ─────────────────────────────────────────────── */

  editFiling(side: SideId, patch: FilingPatch): TrialState {
    return this.dispatch({ type: 'FILING_EDITED', side, patch });
  }

  editCase(patch: { category?: Category; title?: string; context?: string }): TrialState {
    return this.dispatch({ type: 'CASE_DETAILS_EDITED', patch });
  }

  submitFiling(): TrialState {
    return this.dispatch({ type: 'FILING_SUBMITTED' });
  }

  consent(side: SideId, account: Hex): TrialState {
    return this.dispatch({ type: 'CONSENT_GIVEN', side, account });
  }

  decline(side: SideId): TrialState {
    return this.dispatch({ type: 'CONSENT_DECLINED', side });
  }

  addExhibit(exhibit: Exhibit): TrialState {
    return this.dispatch({ type: 'EXHIBIT_ADDED', exhibit });
  }

  removeExhibit(exhibitId: string): TrialState {
    return this.dispatch({ type: 'EXHIBIT_REMOVED', exhibitId });
  }

  /** Approve evidence; when the last approver signs, drafting starts and this resolves after it settles. */
  async approveEvidence(by: Approver, signal?: AbortSignal): Promise<TrialState> {
    this.dispatch({ type: 'EVIDENCE_APPROVED', by });
    if (this.#state.stage === 'counsel') await this.#draftUntilSettled(signal);
    return this.#state;
  }

  /** D2 angle suggestions for one side (or the court's view in Grand Jury). */
  async suggestAngles(side: SideId, signal?: AbortSignal) {
    const s = this.#state;
    const story = s.filing.sides[side]?.story ?? s.filing.context;
    const bench = s.benches.find((b) => b.client === side);
    const notes = s.filing.sides[side]?.privateNotes;
    return this.#ports.counsel.suggestAngles(
      { trialId: s.id, mode: s.mode, category: s.filing.category, story, role: bench?.role ?? 'defense', ...(notes ? { privateNotes: notes } : {}) },
      signal,
    );
  }

  /* ── Counsel ─────────────────────────────────────────────────────────── */

  /** The exact request the counsel port gets for the current state (also used by tests to prove the info wall). */
  counselRequest(): CounselRequest {
    const s = this.#state;
    if (s.stage !== 'counsel') throw new EngineError({ code: 'port', message: 'Counsel requests exist only during the counsel stage' });
    const request: CounselRequest = {
      trialId: s.id,
      mode: s.mode,
      category: s.filing.category,
      title: s.filing.title,
      ballot: s.terms.ballot,
      benches: s.benches,
      briefs: briefsFor(s.benches, s.filing),
      exhibits: s.exhibits.map(({ redacted: _redacted, ...x }) => x),
      scope: this.#scope,
      payer: this.#payer,
      budget: this.#budget,
      attempt: s.attempt,
    };
    if (s.pendingRedraft !== null && s.draft) {
      request.redraft = s.pendingRedraft;
      request.carryOver = s.draft.lines;
    }
    return request;
  }

  async #draftUntilSettled(signal?: AbortSignal): Promise<void> {
    // At most 1 + autoRedrafts passes; the machine decides when to stop.
    for (let pass = 0; pass < 5; pass++) {
      const s = this.#state;
      if (s.stage !== 'counsel' || s.step !== 'drafting') return;
      const request = this.counselRequest();
      let draft: CounselDraft;
      try {
        draft = await this.#ports.counsel.draft(request, signal);
      } catch (err) {
        if (err instanceof CounselError && err.code === 'aborted') throw new EngineError({ code: 'port', message: 'Drafting was cancelled' });
        this.dispatch({ type: 'COUNSEL_FAILED', message: err instanceof Error ? err.message : String(err) });
        return;
      }
      const balance = await this.#ports.counsel.assessBalance(draft, request);
      this.dispatch({ type: 'COUNSEL_DRAFTED', draft, balance });
    }
  }

  /** D2: one redraft per side, before paying. */
  async requestRedraft(side: SideId, signal?: AbortSignal): Promise<TrialState> {
    this.dispatch({ type: 'REDRAFT_REQUESTED', side });
    await this.#draftUntilSettled(signal);
    return this.#state;
  }

  /** Approve the frozen draft; the last approval freezes it and opens the case on the ledger. */
  async approveDraft(by: Approver, payers: readonly Hex[] = []): Promise<TrialState> {
    this.dispatch({ type: 'DRAFT_APPROVED', by });
    const s = this.#state;
    if (s.stage === 'counsel' && s.step === 'funding' && s.transcript && s.caseNumber === null) {
      const named = payers.length ? payers : partiesOf(s.filing);
      const { caseNumber } = await this.#port(() =>
        this.#ports.chain.createCase({ terms: s.terms, transcriptHash: s.transcript!.hash, payers: s.terms.funding.kind === 'crowdfund' ? [] : named, title: s.filing.title }),
      );
      this.dispatch({ type: 'CASE_OPENED', caseNumber, transcriptHash: s.transcript.hash });
      this.#watch();
      // Deposits that landed before we subscribed (none for a fresh case) are picked up by sync().
      await this.sync();
    }
    return this.#state;
  }

  /** Pay this client's share (Solo/Versus) or contribute (Grand Jury) with the connected account. */
  async fund(amount?: bigint): Promise<TrialState> {
    const n = this.#needCase();
    const s = this.#state;
    const me = await this.#ports.chain.account();
    if (!me) throw new EngineError({ code: 'port', message: 'Connect a wallet first' });
    let value = amount;
    if (value === undefined) {
      const sides = Object.entries(s.filing.sides);
      const index = sides.findIndex(([, v]) => v?.account?.toLowerCase() === me.toLowerCase());
      if (index < 0 || !s.terms.payerShares[index]) throw new EngineError({ code: 'port', message: 'Choose an amount to contribute' });
      value = s.terms.payerShares[index]!;
    }
    await this.#port(() => this.#ports.chain.fund(n, value as never));
    await this.sync();
    return this.#state;
  }

  async sponsor(amount: bigint): Promise<TrialState> {
    await this.#port(() => this.#ports.chain.sponsor(this.#needCase(), amount as never));
    await this.sync();
    return this.#state;
  }

  /* ── Ledger mirror ───────────────────────────────────────────────────── */

  #watch(): void {
    const n = this.caseNumber;
    if (n === null || this.#unsubscribe) return;
    this.#unsubscribe = this.#ports.chain.subscribe(n, (e) => void this.#onChain(e));
  }

  async #onChain(e: ChainEvent): Promise<void> {
    switch (e.type) {
      case 'funded':
        this.#apply({ type: 'FUNDS_DEPOSITED', deposit: { account: e.account, kind: e.kind, amount: e.amount } });
        return;
      case 'seat-accepted':
        this.#apply({ type: 'SEAT_FILLED', account: e.juror });
        return;
      case 'committed':
        this.#apply({ type: 'BALLOT_COMMITTED', account: e.juror });
        return;
      case 'revealed':
        this.#apply({ type: 'BALLOT_REVEALED', account: e.juror, choice: e.choice });
        return;
      case 'phase':
      case 'finalized':
      case 'cancelled':
        await this.sync();
        return;
      default:
        return;
    }
  }

  /**
   * Reconcile with the ledger's view of the case: deposits, seats, ballots,
   * deadlines, verdict, cancellation. Safe to call any time (idempotent).
   */
  async sync(): Promise<TrialState> {
    const n = this.caseNumber;
    if (n === null) return this.#state;
    const c = await this.#ports.chain.getCase(n);
    if (!c) return this.#state;
    this.#reconcile(c);
    return this.#state;
  }

  #reconcile(c: ChainCase): void {
    let s = this.#state;
    if (s.stage === 'counsel') {
      for (const d of c.deposits.slice(s.deposits.length)) this.#apply({ type: 'FUNDS_DEPOSITED', deposit: { account: d.account, kind: d.kind, amount: d.amount } });
    }
    s = this.#state;
    if (s.stage === 'jury') {
      const known = new Set(s.seats.map((x) => x.account.toLowerCase()));
      for (const seat of c.seats) if (!known.has(seat.juror.toLowerCase())) this.#apply({ type: 'SEAT_FILLED', account: seat.juror });
      s = this.#state as typeof s;
      if (s.stage === 'jury' && s.step === 'briefing' && c.deadlines.commit && c.deadlines.reveal) {
        this.#apply({ type: 'COURT_OPENED', commitEndsAt: c.deadlines.commit, revealEndsAt: c.deadlines.reveal });
      }
      for (const seat of c.seats) {
        const cur = this.#state;
        if (cur.stage !== 'jury') break;
        const mine = cur.seats.find((x) => x.account.toLowerCase() === seat.juror.toLowerCase());
        if (seat.committed && mine && !mine.committed && cur.step === 'commit') this.#apply({ type: 'BALLOT_COMMITTED', account: seat.juror });
      }
      if (this.#state.stage === 'jury' && this.#state.step === 'commit' && ['reveal', 'finalizing', 'settled'].includes(c.phase)) {
        this.#apply({ type: 'DEADLINE_PASSED', deadline: 'commit' });
      }
      for (const seat of c.seats) {
        const cur = this.#state;
        if (cur.stage !== 'jury' || cur.step !== 'reveal') break;
        const mine = cur.seats.find((x) => x.account.toLowerCase() === seat.juror.toLowerCase());
        if (seat.revealed && seat.choice !== undefined && mine && !mine.revealed) this.#apply({ type: 'BALLOT_REVEALED', account: seat.juror, choice: seat.choice });
      }
      if (this.#state.stage === 'jury' && this.#state.step === 'reveal' && ['finalizing', 'settled'].includes(c.phase)) {
        this.#apply({ type: 'DEADLINE_PASSED', deadline: 'reveal' });
      }
      if (this.#state.stage === 'jury' && this.#state.step === 'finalizing' && c.phase === 'settled') {
        this.#apply({ type: 'VERDICT_RECORDED', settlement: this.#settlementFrom(c, 'trial') });
      }
    }
    const cur = this.#state;
    if (c.phase === 'cancelled' && cur.stage !== 'closed' && cur.stage !== 'verdict' && cur.stage !== 'share' && cur.stage !== 'appeal') {
      const reason = cur.stage === 'jury' && cur.step === 'recruiting' ? 'jury-unfilled' : cur.stage === 'counsel' ? 'funding-missed' : 'protective';
      const outcome = reason === 'protective' ? 'protective' : 'cancelled';
      if (reason === 'protective') {
        this.#apply({ type: 'CANCELLED', reason, settlement: this.#settlementFrom(c, outcome) });
      } else {
        this.#apply({ type: 'DEADLINE_PASSED', deadline: reason === 'jury-unfilled' ? 'recruitment' : 'funding' });
        this.#apply({ type: 'REFUNDED', settlement: this.#settlementFrom(c, outcome) });
      }
    }
  }

  #settlementFrom(c: ChainCase, outcome: 'trial' | 'cancelled' | 'protective'): Settlement {
    return settle({
      terms: c.terms,
      funders: c.deposits.map((d) => ({ account: d.account, kind: d.kind, amount: d.amount })),
      jurors: c.seats.map((x) => {
        const r: { account: Hex; committed: boolean; revealed: boolean; choice?: 0 | 1 } = { account: x.juror, committed: x.committed, revealed: x.revealed };
        if (x.choice !== undefined) r.choice = x.choice;
        return r;
      }),
      outcome,
      revealOpened: c.deadlines.commit !== null && this.#clock() >= c.deadlines.commit,
    });
  }

  /* ── Clock and closing ───────────────────────────────────────────────── */

  /**
   * Advance time-driven steps: off-chain deadlines (consent) locally, chain
   * deadlines via the permissionless `advance()`/`finalize()`, then reconcile.
   */
  async tick(): Promise<TrialState> {
    const s = this.#state;
    const now = this.#clock();
    if (s.stage === 'filing' && s.consentEndsAt !== null && now >= s.consentEndsAt) this.#apply({ type: 'DEADLINE_PASSED', deadline: 'consent' });
    const n = this.caseNumber;
    if (n !== null) {
      await this.#port(() => this.#ports.chain.advance(n));
      let c = await this.#ports.chain.getCase(n);
      if (c?.phase === 'finalizing') {
        await this.#port(() => this.#ports.chain.finalize(n));
        c = await this.#ports.chain.getCase(n);
      }
      if (c) this.#reconcile(c);
    }
    const cur = this.#state;
    if ((cur.stage === 'verdict' || cur.stage === 'appeal') && cur.appealEndsAt !== null && now >= cur.appealEndsAt) {
      this.#apply({ type: 'DEADLINE_PASSED', deadline: 'appeal' });
    }
    return this.#state;
  }

  /** Judge Gavel.exe's sentence for the recorded human verdict. */
  async readSentence(signal?: AbortSignal): Promise<CourtLine | null> {
    const s = this.#state;
    if ((s.stage !== 'verdict' && s.stage !== 'share') || s.sentence) return s.stage === 'verdict' || s.stage === 'share' ? s.sentence : null;
    const line = await this.#ports.counsel.sentence(
      { trialId: s.id, verdictLabel: s.verdict.label, transcriptHash: s.transcript.hash, category: s.filing.category, title: s.filing.title },
      signal,
    );
    this.dispatch({ type: 'SENTENCE_READ', line });
    return line;
  }

  share(channel: 'link' | 'image' | 'x' | 'native'): TrialState {
    return this.dispatch({ type: 'SHARED', channel });
  }

  withdraw(): TrialState {
    return this.dispatch({ type: 'CANCELLED', reason: 'withdrawn' });
  }

  #needCase(): CaseNumber {
    const n = this.caseNumber;
    if (n === null) throw new EngineError({ code: 'port', message: 'The case is not open on the ledger yet' });
    return n;
  }

  async #port<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw new EngineError({ code: 'port', message: err instanceof Error ? err.message : String(err) });
    }
  }
}

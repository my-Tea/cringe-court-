/**
 * SoloSession: runs one Solo case from the confession to the share card.
 *
 * It owns a core TrialState and only ever changes it through `transition()`, so
 * the state machine's guards are the rules. Port results (0G counsel, Arc
 * ledger, the demo NPC jury) become trial events here. The UI subscribes to
 * snapshots (`useSyncExternalStore`) and paces the jury steps itself, so every
 * seat, sealed scroll and reveal can be animated.
 *
 * This is the Solo slice of the engine. When `@cringe-court/engine` lands, the
 * event plumbing below is what it replaces; the public methods stay.
 */
import {
  CounselError,
  ChainError,
  briefsFor,
  createTrial,
  settle,
  transition,
  trialId as toTrialId,
  type AiCounselPort,
  type AngleSuggestion,
  type BalanceReport,
  type BallotChoice,
  type CaseTerms,
  type ChainPort,
  type CounselRequest,
  type CourtLine,
  type Exhibit,
  type Hex,
  type JurorRecord,
  type PublicExhibit,
  type TrialEvent,
  type TrialState,
  type Usdc,
  type ReceiptLine,
} from '@cringe-court/core';
import { soloMode, soloTerms } from './definition';
import { publicFiling, redact, validateAngle, validateDraft, type Redaction, type SoloDraft } from './intake';
import { npcChoice, type NpcJury } from './npcJury';
import type { TeaserQuota } from './teaser';

export interface SessionClock {
  /** Unix seconds; must be the same clock the ledger uses. */
  now(): number;
  /** Demo builds only: jump to a deadline instead of waiting for it (D14, labelled). */
  advanceTo?(unixSeconds: number): void;
}

export interface SoloSessionDeps {
  counsel: AiCounselPort;
  /** The ledger, signing as the filer. */
  chain: ChainPort;
  clock: SessionClock;
  /** Demo: NPC jurors take the seats. Without it, seats come from the real pool via chain events. */
  jury: NpcJury | null;
  teasers: TeaserQuota | null;
}

/** The jury's timed windows, in the order they run. */
export type JuryWindow = 'recruitment' | 'commit' | 'reveal';

export type Busy = 'angles' | 'teaser' | 'drafting' | 'paying' | 'seating' | 'voting' | 'closing' | 'finalizing' | 'claiming';

export interface SessionError {
  code: 'validation' | 'counsel' | 'chain' | 'quota' | 'internal';
  message: string;
  retryable: boolean;
}

export interface SoloSnapshot {
  trial: TrialState;
  filer: Hex;
  busy: Busy | null;
  error: SessionError | null;
  /** What the automatic redaction pass changed in the filing. */
  redactions: readonly Redaction[];
  angles: readonly AngleSuggestion[] | null;
  /** Last D1 balance report (also nudges the demo NPC jury). */
  balance: BalanceReport | null;
  /** D3 teaser lines (call to order + openings + THE JURY IS OUT), once watched. */
  teaser: readonly CourtLine[] | null;
  /** Filer's receipt lines once the ledger settled. */
  receipt: readonly ReceiptLine[] | null;
  /** True once the filer pulled their refund (NO VERDICT / cancel). */
  claimed: boolean;
  /**
   * Jury windows that closed on the ledger before every juror acted in them
   * (a paused jury, a sleeping laptop, a background tab). The UI says so
   * instead of expiring silently. Absent on cases saved before it existed.
   */
  lapsed?: readonly JuryWindow[];
  /** Ledger tx hashes and explorer links, by step (V4 §14.3). */
  txs: Readonly<Partial<Record<'opened' | 'funded' | 'finalized' | 'claimed', { hash: Hex; explorerUrl: string }>>>;
}

/** Same model and token budget for both benches (D1, A7/A16). */
export const SOLO_BUDGET = { maxInputTokens: 1200, maxOutputTokens: 400 } as const;

const errorOf = (e: unknown): SessionError => {
  if (e instanceof CounselError) return { code: 'counsel', message: e.message, retryable: e.retryable || e.code === 'unavailable' || e.code === 'rate-limited' };
  if (e instanceof ChainError) return { code: 'chain', message: e.message, retryable: e.code === 'network' || e.code === 'bad-amount' };
  return { code: 'internal', message: e instanceof Error ? e.message : String(e), retryable: true };
};

let counter = 0;
export function newTrialId(now: number): string {
  counter = (counter + 1) % 1000;
  return `solo-${now.toString(36)}-${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

export class SoloSession {
  #snap: SoloSnapshot;
  readonly #listeners = new Set<() => void>();

  constructor(
    private readonly deps: SoloSessionDeps,
    init: { filer: Hex; terms?: CaseTerms; demo?: boolean; id?: string; restore?: SoloSnapshot },
  ) {
    if (init.restore) {
      this.#snap = { ...init.restore, busy: null, error: null };
      return;
    }
    const now = deps.clock.now();
    const terms = init.terms ?? soloTerms({ demo: init.demo ?? false });
    const trial = createTrial({
      id: toTrialId(init.id ?? newTrialId(now)),
      mode: 'solo',
      terms,
      rules: soloMode.rules,
      benches: soloMode.benches,
      category: 'npc-behavior',
      filer: init.filer,
      now,
    });
    this.#snap = { trial, filer: init.filer, busy: null, error: null, redactions: [], angles: null, balance: null, teaser: null, receipt: null, claimed: false, txs: {}, lapsed: [] };
  }

  /* ── store ── */

  getSnapshot = (): SoloSnapshot => this.#snap;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  #set(patch: Partial<SoloSnapshot>): void {
    this.#snap = { ...this.#snap, ...patch };
    for (const l of this.#listeners) l();
  }

  #apply(event: TrialEvent): TrialState {
    const r = transition(this.#snap.trial, event, { now: this.deps.clock.now() });
    if (!r.ok) throw Object.assign(new Error(r.error.message), { trialError: r.error });
    this.#set({ trial: r.state });
    return r.state;
  }

  async #run<T>(busy: Busy, work: () => Promise<T>): Promise<T | undefined> {
    if (this.#snap.busy) return undefined;
    this.#set({ busy, error: null });
    try {
      return await work();
    } catch (e) {
      this.#set({ error: (e as { trialError?: unknown }).trialError ? { code: 'validation', message: (e as Error).message, retryable: false } : errorOf(e) });
      return undefined;
    } finally {
      this.#set({ busy: null });
    }
  }

  clearError(): void {
    this.#set({ error: null });
  }

  get trial(): TrialState {
    return this.#snap.trial;
  }

  /* ── filing ── */

  /** Redact and submit the confession. Moves filing → evidence. */
  fileConfession(draft: SoloDraft): boolean {
    const errors = validateDraft(draft);
    const first = Object.values(errors)[0];
    if (first) {
      this.#set({ error: { code: 'validation', message: first, retryable: false } });
      return false;
    }
    try {
      const pub = publicFiling(draft);
      this.#apply({ type: 'CASE_DETAILS_EDITED', patch: { category: draft.category!, title: pub.title } });
      this.#apply({ type: 'FILING_EDITED', side: 'a', patch: { story: pub.story, privateNotes: draft.privateNotes.trim(), account: this.#snap.filer } });
      this.#apply({ type: 'FILING_SUBMITTED' });
      this.#set({ redactions: pub.redactions, error: null });
      return true;
    } catch (e) {
      this.#set({ error: { code: 'validation', message: (e as Error).message, retryable: false } });
      return false;
    }
  }

  addExhibit(input: { kind: PublicExhibit['kind']; title: string; body: string }, hiddenNames: readonly string[] = []): boolean {
    const t = this.#snap.trial;
    if (t.stage !== 'evidence') return false;
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) {
      this.#set({ error: { code: 'validation', message: 'An exhibit needs a title and some text.', retryable: false } });
      return false;
    }
    const exhibit: Exhibit = {
      id: `X${t.exhibits.length + 1}-${(this.deps.clock.now() % 100000).toString(36)}`,
      submittedBy: 'a',
      kind: input.kind,
      title: redact(title.slice(0, 80), hiddenNames).text,
      body: redact(body.slice(0, 400), hiddenNames).text,
      redacted: true,
    };
    try {
      this.#apply({ type: 'EXHIBIT_ADDED', exhibit });
      return true;
    } catch (e) {
      this.#set({ error: { code: 'validation', message: (e as Error).message, retryable: false } });
      return false;
    }
  }

  removeExhibit(id: string): void {
    if (this.#snap.trial.stage === 'evidence') this.#apply({ type: 'EXHIBIT_REMOVED', exhibitId: id });
  }

  /* ── briefing the advocate (D2) ── */

  async suggestAngles(): Promise<void> {
    const t = this.#snap.trial;
    const side = t.filing.sides.a;
    if (t.stage !== 'evidence' || !side) return;
    await this.#run('angles', async () => {
      const angles = await this.deps.counsel.suggestAngles({
        trialId: t.id,
        mode: 'solo',
        category: t.filing.category,
        story: side.story,
        privateNotes: side.privateNotes,
        role: 'defense',
      });
      this.#set({ angles: angles.slice(0, 3) });
    });
  }

  setAngle(angle: string): boolean {
    const problem = validateAngle(angle);
    if (problem) {
      this.#set({ error: { code: 'validation', message: problem, retryable: false } });
      return false;
    }
    this.#apply({ type: 'FILING_EDITED', side: 'a', patch: { angle: angle.trim() } });
    this.#set({ error: null });
    return true;
  }

  #request(scope: CounselRequest['scope'], attempt: number, redraft: BallotChoice | null): CounselRequest {
    const t = this.#snap.trial;
    const exhibits = 'exhibits' in t ? t.exhibits.map(({ redacted: _r, ...x }) => x) : [];
    const req: CounselRequest = {
      trialId: t.id,
      mode: 'solo',
      category: t.filing.category,
      title: t.filing.title,
      ballot: t.terms.ballot,
      benches: t.benches,
      briefs: briefsFor(t.benches, t.filing),
      exhibits,
      scope,
      payer: ['platform', 'platform'],
      budget: SOLO_BUDGET,
      attempt,
    };
    if (redraft !== null) req.redraft = redraft;
    const carry = this.#snap.teaser?.filter((l) => l.segment === 'call-to-order' || l.segment === 'opening');
    if (scope === 'full' && attempt === 1 && carry?.length) req.carryOver = carry;
    return req;
  }

  /** D3: the free teaser (openings only, ends on THE JURY IS OUT). Rate limited per device/account. */
  async watchTeaser(signedInAccount: string | null = null): Promise<void> {
    const t = this.#snap.trial;
    if (t.stage !== 'evidence' || this.#snap.teaser) return;
    if (!t.filing.sides.a?.angle) {
      this.#set({ error: { code: 'validation', message: 'Brief Counsel Chaos first: pick an angle.', retryable: false } });
      return;
    }
    if (this.deps.teasers && !this.deps.teasers.consume(signedInAccount)) {
      this.#set({ error: { code: 'quota', message: 'That was today’s free teaser. You can still take the case to a jury.', retryable: false } });
      return;
    }
    await this.#run('teaser', async () => {
      const draft = await this.deps.counsel.draft(this.#request('teaser', 1, null));
      this.#set({ teaser: draft.lines });
    });
  }

  /* ── counsel ── */

  /** Approve the public filing and have both lawyers draft (with the D1 balance gate). */
  async approveAndDraft(): Promise<void> {
    const t = this.#snap.trial;
    if (t.stage !== 'evidence') return;
    if (!t.filing.sides.a?.angle) {
      this.#set({ error: { code: 'validation', message: 'Brief Counsel Chaos first: pick an angle.', retryable: false } });
      return;
    }
    await this.#run('drafting', async () => {
      this.#apply({ type: 'EVIDENCE_APPROVED', by: 'a' });
      await this.#draftLoop();
    });
  }

  /** D2: one redraft of the user's own advocate before paying. */
  async redraft(): Promise<void> {
    const t = this.#snap.trial;
    if (t.stage !== 'counsel' || t.step !== 'review') return;
    await this.#run('drafting', async () => {
      this.#apply({ type: 'REDRAFT_REQUESTED', side: 'a' });
      await this.#draftLoop();
    });
  }

  /** Retry drafting after a retryable counsel error (the case is still in counsel/drafting). */
  async retryDraft(): Promise<void> {
    const t = this.#snap.trial;
    if (t.stage !== 'counsel' || t.step !== 'drafting') return;
    await this.#run('drafting', () => this.#draftLoop());
  }

  async #draftLoop(): Promise<void> {
    for (let guardCount = 0; guardCount < 4; guardCount++) {
      const t = this.#snap.trial;
      if (t.stage !== 'counsel' || t.step !== 'drafting') return;
      const request = this.#request('full', t.attempt, t.pendingRedraft);
      let draft;
      try {
        draft = await this.deps.counsel.draft(request);
      } catch (e) {
        // A retryable outage keeps the case in drafting; anything else cancels with a full refund (nothing was paid yet).
        if (e instanceof CounselError && (e.retryable || e.code === 'rate-limited')) throw e;
        this.#apply({ type: 'COUNSEL_FAILED', message: e instanceof Error ? e.message : String(e) });
        return;
      }
      const balance = await this.deps.counsel.assessBalance(draft, request);
      this.#set({ balance });
      this.#apply({ type: 'COUNSEL_DRAFTED', draft, balance });
    }
  }

  /** Freeze the transcript (hash it) and open funding. */
  approveDraft(): void {
    const t = this.#snap.trial;
    if (t.stage !== 'counsel' || t.step !== 'review') return;
    this.#apply({ type: 'DRAFT_APPROVED', by: 'a' });
  }

  /** Back out before paying. Nothing was charged. */
  withdraw(): void {
    const t = this.#snap.trial;
    if (t.stage === 'filing' || t.stage === 'evidence' || (t.stage === 'counsel' && t.caseNumber === null)) {
      this.#apply({ type: 'CANCELLED', reason: 'withdrawn' });
    }
  }

  /* ── money ── */

  async pay(): Promise<void> {
    const t0 = this.#snap.trial;
    if (t0.stage !== 'counsel' || t0.step !== 'funding' || !t0.transcript) return;
    await this.#run('paying', async () => {
      const t = this.#snap.trial;
      if (t.stage !== 'counsel' || !t.transcript) return;
      const share: Usdc = t.terms.payerShares[0] ?? t.terms.target;
      let caseNumber = t.caseNumber;
      if (caseNumber === null) {
        const opened = await this.deps.chain.createCase({ terms: t.terms, transcriptHash: t.transcript.hash, payers: [this.#snap.filer], title: t.filing.title });
        caseNumber = opened.caseNumber;
        this.#apply({ type: 'CASE_OPENED', caseNumber, transcriptHash: t.transcript.hash });
        this.#set({ txs: { ...this.#snap.txs, opened: opened.receipt } });
      }
      const receipt = await this.deps.chain.fund(caseNumber, share);
      this.#set({ txs: { ...this.#snap.txs, funded: receipt } });
      this.#apply({ type: 'FUNDS_DEPOSITED', deposit: { account: this.#snap.filer, kind: 'filer', amount: share } });
    });
  }

  /* ── the jury (paced by the UI) ── */

  #jury(): NpcJury {
    if (!this.deps.jury) throw new Error('No jury adapter: seats come from the verified pool');
    return this.deps.jury;
  }

  /** Seat the next NPC juror. Opens the court when the jury is full. */
  async seatNextJuror(): Promise<void> {
    await this.#run('seating', () =>
      this.#juryStep(async () => {
        const t = this.#snap.trial;
        if (t.stage !== 'jury' || t.step !== 'recruiting') return;
        const j = await this.#jury().takeSeat(t.caseNumber, t.seats.length + 1);
        const next = this.#apply({ type: 'SEAT_FILLED', account: j.account });
        if (next.stage === 'jury' && next.step === 'briefing') {
          const c = await this.deps.chain.getCase(next.caseNumber);
          const commit = c?.deadlines.commit;
          const reveal = c?.deadlines.reveal;
          if (!commit || !reveal) throw new Error('The ledger did not open the commit window');
          this.#apply({ type: 'COURT_OPENED', commitEndsAt: commit, revealEndsAt: reveal });
        }
      }),
    );
  }

  /** The NPC juror in `seat` seals their ballot. */
  async commitBallot(seat: number): Promise<void> {
    await this.#run('voting', () =>
      this.#juryStep(async () => {
        const t = this.#snap.trial;
        if (t.stage !== 'jury' || t.step !== 'commit') return;
        const jury = this.#jury();
        const j = jury.juror(seat);
        const choice = npcChoice(j.persona, t.transcript.hash, seat, this.#snap.balance);
        await jury.commit(t.caseNumber, seat, choice);
        this.#apply({ type: 'BALLOT_COMMITTED', account: j.account });
      }),
    );
  }

  /**
   * B1: run one jury step against the ledger as it is *now*. Any window the
   * ledger already closed is closed here first (a paused jury, a sleeping
   * laptop, a background tab), so the jury carries on from the ledger's phase
   * instead of retrying a step the ledger refuses. A step that races the
   * deadline and loses is caught up the same way rather than surfaced.
   */
  async #juryStep(work: () => Promise<void>): Promise<void> {
    if (await this.#catchUp()) return;
    try {
      await work();
    } catch (e) {
      if (e instanceof ChainError && e.code === 'deadline' && (await this.#catchUp())) return;
      throw e;
    }
  }

  /** Apply every jury deadline the clock has passed. True if the case moved. */
  async #catchUp(): Promise<boolean> {
    let moved = false;
    for (;;) {
      const t = this.#snap.trial;
      if (t.stage !== 'jury') return moved;
      const now = this.deps.clock.now();
      if (t.step === 'recruiting' && now >= t.recruitEndsAt) {
        await this.deps.chain.advance(t.caseNumber);
        this.#lapse('recruitment');
        this.#apply({ type: 'DEADLINE_PASSED', deadline: 'recruitment' });
        // The ledger refunds the filer and every posted bond; same maths, recorded on the case.
        const jurors: JurorRecord[] = t.seats.map((s) => ({ account: s.account, committed: false, revealed: false }));
        this.#apply({ type: 'REFUNDED', settlement: settle({ terms: t.terms, funders: t.deposits, jurors, outcome: 'cancelled' }) });
        this.#set({ receipt: await this.deps.chain.receipts(t.caseNumber, this.#snap.filer) });
        return true;
      }
      if (t.step === 'commit' && t.commitEndsAt !== null && now >= t.commitEndsAt) {
        await this.deps.chain.advance(t.caseNumber);
        if (t.seats.some((s) => !s.committed)) this.#lapse('commit');
        this.#apply({ type: 'DEADLINE_PASSED', deadline: 'commit' });
        moved = true;
        continue;
      }
      if (t.step === 'reveal' && t.revealEndsAt !== null && now >= t.revealEndsAt) {
        await this.deps.chain.advance(t.caseNumber);
        if (t.seats.some((s) => s.committed && !s.revealed)) this.#lapse('reveal');
        this.#apply({ type: 'DEADLINE_PASSED', deadline: 'reveal' });
        moved = true;
        continue;
      }
      return moved;
    }
  }

  #lapse(window: JuryWindow): void {
    const lapsed = this.#snap.lapsed ?? [];
    if (!lapsed.includes(window)) this.#set({ lapsed: [...lapsed, window] });
  }

  async #passDeadline(at: number | null, deadline: 'commit' | 'reveal'): Promise<void> {
    const t = this.#snap.trial;
    if (t.stage !== 'jury' || at === null) return;
    if (this.deps.clock.now() < at) {
      if (!this.deps.clock.advanceTo) throw new Error(`The ${deadline} window is still open`);
      this.deps.clock.advanceTo(at);
    }
    await this.deps.chain.advance(t.caseNumber);
    this.#apply({ type: 'DEADLINE_PASSED', deadline });
  }

  /** Close the commit window (demo: jump to its deadline once every scroll is sealed). */
  async closeCommit(): Promise<void> {
    const t = this.#snap.trial;
    if (t.stage !== 'jury' || t.step !== 'commit') return;
    await this.#run('closing', () => this.#passDeadline(t.commitEndsAt, 'commit'));
  }

  async revealBallot(seat: number): Promise<BallotChoice | undefined> {
    return this.#run('voting', async () => {
      let choice: BallotChoice | undefined;
      await this.#juryStep(async () => {
        const t = this.#snap.trial;
        if (t.stage !== 'jury' || t.step !== 'reveal') return;
        const jury = this.#jury();
        choice = await jury.reveal(t.caseNumber, seat);
        this.#apply({ type: 'BALLOT_REVEALED', account: jury.juror(seat).account, choice });
      });
      return choice;
    });
  }

  async closeReveal(): Promise<void> {
    const t = this.#snap.trial;
    if (t.stage !== 'jury' || t.step !== 'reveal') return;
    await this.#run('closing', () => this.#passDeadline(t.revealEndsAt, 'reveal'));
  }

  /** Finalize on the ledger, record the verdict, then Judge Gavel.exe's sentence. */
  async finalize(): Promise<void> {
    await this.#run('finalizing', async () => {
      const t = this.#snap.trial;
      if (t.stage !== 'jury' || t.step !== 'finalizing') return;
      const receipt = await this.deps.chain.finalize(t.caseNumber);
      const jurors: JurorRecord[] = t.seats.map((s) => {
        const r: JurorRecord = { account: s.account, committed: s.committed, revealed: s.revealed };
        if (s.choice !== undefined) r.choice = s.choice;
        return r;
      });
      // Same maths as the contract; cross-checked against the ledger's verdict below.
      const settlement = settle({ terms: t.terms, funders: t.deposits, jurors, outcome: 'trial' });
      const onChain = await this.deps.chain.getCase(t.caseNumber);
      if (onChain?.verdict && settlement.verdict && onChain.verdict.kind !== settlement.verdict.kind) {
        throw new Error(`Ledger verdict ${onChain.verdict.label} disagrees with the local tally ${settlement.verdict.label}`);
      }
      const decided = this.#apply({ type: 'VERDICT_RECORDED', settlement });
      const receiptLines = await this.deps.chain.receipts(t.caseNumber, this.#snap.filer);
      this.#set({ receipt: receiptLines, txs: { ...this.#snap.txs, finalized: receipt } });
      if (decided.stage !== 'verdict') return;
      try {
        const line = await this.deps.counsel.sentence({
          trialId: t.id,
          verdictLabel: decided.verdict.label,
          transcriptHash: t.transcript.hash,
          category: t.filing.category,
          title: t.filing.title,
        });
        this.#apply({ type: 'SENTENCE_READ', line });
      } catch {
        // The sentence is flavour; the human verdict stands without it.
      }
    });
  }

  /** Pull the filer's refund (NO VERDICT, or a jury that never filled). */
  async claimRefund(): Promise<void> {
    const t = this.#snap.trial;
    if (this.#snap.claimed) return;
    const caseNumber = t.stage === 'verdict' || t.stage === 'share' ? t.caseNumber : t.stage === 'closed' && t.settlement ? t.caseNumber : null;
    if (caseNumber === null) return;
    await this.#run('claiming', async () => {
      const receipt = await this.deps.chain.claim(caseNumber);
      this.#set({ claimed: true, txs: { ...this.#snap.txs, claimed: receipt } });
    });
  }

  /** Record a share (verdict → share). */
  shared(channel: 'link' | 'image' | 'x' | 'native'): void {
    const t = this.#snap.trial;
    if (t.stage === 'verdict' || t.stage === 'share') this.#apply({ type: 'SHARED', channel });
  }

  /** The juror the UI should animate next, by stage step. */
  nextJurorSeat(): number | null {
    const t = this.#snap.trial;
    if (t.stage !== 'jury') return null;
    if (t.step === 'recruiting') return t.seats.length + 1;
    if (t.step === 'commit') return t.seats.find((s) => !s.committed)?.seat ?? null;
    if (t.step === 'reveal') return t.seats.find((s) => s.committed && !s.revealed)?.seat ?? null;
    return null;
  }
}


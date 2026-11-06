/**
 * The trial state machine: one case from filing to the share card.
 *
 *   filing ─▶ evidence ─▶ counsel ─▶ jury ─▶ verdict ─▶ share
 *      │          │      (prosecution   │        │  ▲
 *      │          │       & defense)    │        ▼  │
 *      │          │          │          │      appeal
 *      └──────────┴──────────┴──────────┴─▶ closed (cancelled, always refunds)
 *
 * Each stage has steps (counsel: drafting → review → funding; jury: recruiting →
 * briefing → commit → reveal → finalizing). The reducer is pure: no clocks, no
 * I/O. `now` comes in with every event; the engine turns port results into events.
 * TRIAL_MACHINE lists, for every stage, every event it accepts and where it can
 * go, and the reducer is checked against it.
 *
 * The chain stays the source of truth for money and phase (ARCHITECTURE §4):
 * jury-stage events mirror what the ledger reports. `chainPhaseOf()` maps a
 * trial state to the on-chain CasePhase.
 */
import type { CaseNumber, CasePhase, Category, Hex, Verdict } from './case';
import type { Benches, SideId } from './cast';
import { canonicalJson, keccak256 } from './hash';
import type { ModeId } from './modes';
import { ZERO_USDC, addUsdc, type Usdc } from './money';
import type { BalanceReport, CounselDraft, CourtLine, PublicExhibit } from './ports/counsel';
import type { BallotChoice, FunderDeposit, Settlement } from './settlement';
import type { CaseTerms } from './terms';

/* ── Rules a mode gives the machine (snapshotted into each trial) ────────── */

/** Who must sign off a step: a side, or the court editor (Grand Jury, D8). */
export type Approver = SideId | 'court';

export interface TrialRules {
  /** Real parties to the case. Solo ['a'], Versus ['a', 'b'], Grand Jury []. */
  sides: readonly SideId[];
  /** Who approves evidence and the frozen draft. */
  approvers: readonly Approver[];
  /** Versus: side B must consent before evidence opens (D4). */
  requiresConsent: boolean;
  /** D2: user redrafts per side before paying. */
  redraftsPerSide: number;
  /** D1: automatic redrafts when the balance check fails, before cancelling. */
  autoRedrafts: number;
  maxExhibits: number;
  /** D2: the angle cap. */
  angleMaxChars: number;
  /** D5: nickname cap. */
  nicknameMaxChars: number;
  storyMaxChars: number;
  /**
   * Appeal = a fresh trial before a new jury with the same frozen transcript,
   * paid again by the appellant. Off by default; a mode may switch it on.
   */
  appeal: { allowed: boolean; windowSeconds: number };
}

export const DEFAULT_RULES: TrialRules = {
  sides: ['a'],
  approvers: ['a'],
  requiresConsent: false,
  redraftsPerSide: 1,
  autoRedrafts: 1,
  maxExhibits: 6,
  angleMaxChars: 140,
  nicknameMaxChars: 24,
  storyMaxChars: 1200,
  appeal: { allowed: false, windowSeconds: 24 * 60 * 60 },
};

/* ── Data ─────────────────────────────────────────────────────────────── */

export type TrialId = string & { readonly __trialId: true };

export function trialId(value: string): TrialId {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(value)) throw new SyntaxError(`Not a trial id: "${value}"`);
  return value as TrialId;
}

export interface SideFiling {
  account: Hex | null;
  /** Sanitized public story (what the jury and the other bench see). */
  story: string;
  /** Private notes for this side's own advocate only (D1). */
  privateNotes: string;
  /** D2 angle, ≤ 140 chars. */
  angle: string | null;
  /** D5 nickname, ≤ 24 chars. */
  nickname: string | null;
}

export interface Filing {
  category: Category;
  title: string;
  /** Grand Jury: the reviewed context card. Empty otherwise. */
  context: string;
  sides: Partial<Record<SideId, SideFiling>>;
}

export interface Exhibit extends PublicExhibit {
  /** Redaction pass has run on the body (V4 §12). */
  redacted: boolean;
}

export interface FrozenTranscript {
  lines: readonly CourtLine[];
  /** keccak256 of the canonical JSON of `lines` (V4 §6.5). */
  hash: Hex;
  frozenAt: number;
  provider: CounselDraft['provider'];
  model: string;
  requestIds: readonly string[];
}

export interface JurySeat {
  seat: number;
  account: Hex;
  committed: boolean;
  revealed: boolean;
  /** Present only after this juror revealed. Never set during commit (privacy). */
  choice?: BallotChoice;
}

export type CancelReason =
  | 'withdrawn'
  | 'consent-declined'
  | 'consent-missed'
  | 'moderation-rejected'
  | 'ai-unfair'
  | 'ai-failed'
  | 'funding-missed'
  | 'jury-unfilled'
  | 'protective';

export const CANCEL_LABELS: Readonly<Record<CancelReason, string>> = {
  withdrawn: 'Withdrawn by the filer',
  'consent-declined': 'The other side declined',
  'consent-missed': 'The other side did not answer in time',
  'moderation-rejected': 'Did not pass the safety review',
  'ai-unfair': 'The AI could not prepare a fair case',
  'ai-failed': 'The AI could not prepare the case',
  'funding-missed': 'Funding did not arrive in time',
  'jury-unfilled': 'Not enough jurors took a seat',
  protective: 'Protective cancellation (our fault, not yours)',
};

export type Deadline = 'consent' | 'funding' | 'recruitment' | 'commit' | 'reveal' | 'appeal';

export interface ShareRecord {
  channel: 'link' | 'image' | 'x' | 'native';
  at: number;
}

export interface TrialStamp {
  at: number;
  event: TrialEventType;
  from: string;
  to: string;
}

interface Base {
  id: TrialId;
  mode: ModeId;
  terms: CaseTerms;
  rules: TrialRules;
  benches: Benches;
  filing: Filing;
  createdAt: number;
  updatedAt: number;
  history: readonly TrialStamp[];
}

export interface FilingState extends Base {
  stage: 'filing';
  /** Versus: side A submitted and waits for side B (consent deadline = preTrial). */
  step: 'drafting' | 'awaiting-consent';
  consentEndsAt: number | null;
}

interface WithEvidence extends Base {
  exhibits: readonly Exhibit[];
}

export interface EvidenceState extends WithEvidence {
  stage: 'evidence';
  step: 'collecting';
  approvals: readonly Approver[];
}

export interface CounselState extends WithEvidence {
  stage: 'counsel';
  step: 'drafting' | 'review' | 'funding';
  attempt: number;
  autoRedraftsUsed: number;
  redraftsUsed: Partial<Record<SideId, number>>;
  /** Bench to redraft next (engine reads this while `drafting`). */
  pendingRedraft: BallotChoice | null;
  draft: CounselDraft | null;
  balance: BalanceReport | null;
  approvals: readonly Approver[];
  transcript: FrozenTranscript | null;
  caseNumber: CaseNumber | null;
  deposits: readonly FunderDeposit[];
  fundingEndsAt: number | null;
}

interface Opened extends WithEvidence {
  caseNumber: CaseNumber;
  transcript: FrozenTranscript;
  deposits: readonly FunderDeposit[];
}

export interface JuryState extends Opened {
  stage: 'jury';
  step: 'recruiting' | 'briefing' | 'commit' | 'reveal' | 'finalizing';
  seats: readonly JurySeat[];
  recruitEndsAt: number;
  commitEndsAt: number | null;
  revealEndsAt: number | null;
}

interface Decided extends Opened {
  seats: readonly JurySeat[];
  verdict: Verdict;
  settlement: Settlement;
  sentence: CourtLine | null;
  appealEndsAt: number | null;
}

export interface VerdictState extends Decided {
  stage: 'verdict';
  step: 'announced';
}

export interface AppealState extends Decided {
  stage: 'appeal';
  step: 'requested';
  appellant: SideId;
}

export interface ShareState extends Decided {
  stage: 'share';
  step: 'open';
  shares: readonly ShareRecord[];
  appealedTo: CaseNumber | null;
}

export interface ClosedState extends Base {
  stage: 'closed';
  step: 'cancelled';
  reason: CancelReason;
  /** Stage the case was cancelled from. */
  cancelledFrom: Exclude<TrialStage, 'closed' | 'verdict' | 'appeal' | 'share'>;
  caseNumber: CaseNumber | null;
  exhibits: readonly Exhibit[];
  transcript: FrozenTranscript | null;
  settlement: Settlement | null;
}

export type TrialState =
  | FilingState
  | EvidenceState
  | CounselState
  | JuryState
  | VerdictState
  | AppealState
  | ShareState
  | ClosedState;

export type TrialStage = TrialState['stage'];

export const TRIAL_STAGES: readonly TrialStage[] = ['filing', 'evidence', 'counsel', 'jury', 'verdict', 'appeal', 'share', 'closed'];

export const STAGE_LABELS: Readonly<Record<TrialStage, string>> = {
  filing: 'Filing',
  evidence: 'Evidence',
  counsel: 'Prosecution & Defense',
  jury: 'The Jury',
  verdict: 'Verdict',
  appeal: 'Appeal',
  share: 'Case Closed',
  closed: 'Dismissed',
};

/* ── Events ───────────────────────────────────────────────────────────── */

export type FilingPatch = Partial<Pick<SideFiling, 'story' | 'privateNotes' | 'angle' | 'nickname' | 'account'>>;

export type TrialEvent =
  | { type: 'FILING_EDITED'; side: SideId; patch: FilingPatch }
  | { type: 'CASE_DETAILS_EDITED'; patch: Partial<Pick<Filing, 'category' | 'title' | 'context'>> }
  | { type: 'FILING_SUBMITTED' }
  | { type: 'CONSENT_GIVEN'; side: SideId; account: Hex }
  | { type: 'CONSENT_DECLINED'; side: SideId }
  | { type: 'EXHIBIT_ADDED'; exhibit: Exhibit }
  | { type: 'EXHIBIT_REMOVED'; exhibitId: string }
  | { type: 'EVIDENCE_APPROVED'; by: Approver }
  | { type: 'MODERATION_REJECTED'; note: string }
  | { type: 'COUNSEL_DRAFTED'; draft: CounselDraft; balance: BalanceReport }
  | { type: 'COUNSEL_FAILED'; message: string }
  | { type: 'REDRAFT_REQUESTED'; side: SideId }
  | { type: 'DRAFT_APPROVED'; by: Approver }
  | { type: 'CASE_OPENED'; caseNumber: CaseNumber; transcriptHash: Hex }
  | { type: 'FUNDS_DEPOSITED'; deposit: FunderDeposit }
  | { type: 'SEAT_FILLED'; account: Hex }
  | { type: 'COURT_OPENED'; commitEndsAt: number; revealEndsAt: number }
  | { type: 'BALLOT_COMMITTED'; account: Hex }
  | { type: 'BALLOT_REVEALED'; account: Hex; choice: BallotChoice }
  | { type: 'VERDICT_RECORDED'; settlement: Settlement }
  | { type: 'SENTENCE_READ'; line: CourtLine }
  | { type: 'APPEAL_REQUESTED'; side: SideId }
  | { type: 'APPEAL_FILED'; caseNumber: CaseNumber }
  | { type: 'APPEAL_WITHDRAWN' }
  | { type: 'SHARED'; channel: ShareRecord['channel'] }
  | { type: 'DEADLINE_PASSED'; deadline: Deadline }
  | { type: 'CANCELLED'; reason: CancelReason; settlement?: Settlement }
  /** The ledger paid out a cancelled case's refunds. */
  | { type: 'REFUNDED'; settlement: Settlement };

export type TrialEventType = TrialEvent['type'];
export type EventOf<T extends TrialEventType> = Extract<TrialEvent, { type: T }>;

/**
 * Every event each stage accepts, and the stages it can lead to. The reducer
 * never leaves a stage by a route not listed here (tested), and the UI uses it
 * to know what can happen next.
 */
export const TRIAL_MACHINE = {
  filing: {
    FILING_EDITED: ['filing'],
    CASE_DETAILS_EDITED: ['filing'],
    FILING_SUBMITTED: ['filing', 'evidence'],
    CONSENT_GIVEN: ['evidence'],
    CONSENT_DECLINED: ['closed'],
    DEADLINE_PASSED: ['closed'],
    CANCELLED: ['closed'],
  },
  evidence: {
    FILING_EDITED: ['evidence'],
    EXHIBIT_ADDED: ['evidence'],
    EXHIBIT_REMOVED: ['evidence'],
    EVIDENCE_APPROVED: ['evidence', 'counsel'],
    MODERATION_REJECTED: ['closed'],
    CANCELLED: ['closed'],
  },
  counsel: {
    COUNSEL_DRAFTED: ['counsel', 'closed'],
    COUNSEL_FAILED: ['closed'],
    REDRAFT_REQUESTED: ['counsel'],
    DRAFT_APPROVED: ['counsel'],
    CASE_OPENED: ['counsel'],
    FUNDS_DEPOSITED: ['counsel', 'jury'],
    DEADLINE_PASSED: ['closed'],
    CANCELLED: ['closed'],
  },
  jury: {
    SEAT_FILLED: ['jury'],
    COURT_OPENED: ['jury'],
    BALLOT_COMMITTED: ['jury'],
    BALLOT_REVEALED: ['jury'],
    DEADLINE_PASSED: ['jury', 'closed'],
    VERDICT_RECORDED: ['verdict'],
    CANCELLED: ['closed'],
  },
  verdict: {
    SENTENCE_READ: ['verdict'],
    APPEAL_REQUESTED: ['appeal'],
    SHARED: ['share'],
    DEADLINE_PASSED: ['verdict'],
  },
  appeal: {
    APPEAL_FILED: ['share'],
    APPEAL_WITHDRAWN: ['verdict'],
    DEADLINE_PASSED: ['share'],
  },
  share: {
    SHARED: ['share'],
    SENTENCE_READ: ['share'],
  },
  closed: {
    REFUNDED: ['closed'],
  },
} as const satisfies { readonly [S in TrialStage]: { readonly [E in TrialEventType]?: readonly TrialStage[] } };

type MachineEvents = { [S in TrialStage]: keyof (typeof TRIAL_MACHINE)[S] }[TrialStage];
// Compile-time: every event type is accepted by at least one stage.
type _EveryEventHandled = Exclude<TrialEventType, MachineEvents> extends never ? true : never;
export const EVERY_EVENT_HANDLED: _EveryEventHandled = true;

/** The events a state accepts right now (by stage; guards may still reject). */
export function acceptedEvents(state: TrialState): readonly TrialEventType[] {
  return Object.keys(TRIAL_MACHINE[state.stage]) as TrialEventType[];
}

/* ── Results ──────────────────────────────────────────────────────────── */

export type TrialErrorCode = 'not-accepted' | 'guard';

export interface TrialError {
  code: TrialErrorCode;
  stage: TrialStage;
  step: string;
  event: TrialEventType;
  message: string;
}

export type TransitionResult = { ok: true; state: TrialState } | { ok: false; error: TrialError };

export interface TransitionContext {
  /** Unix seconds. */
  now: number;
}

/* ── Creation ─────────────────────────────────────────────────────────── */

export interface CreateTrialInput {
  id: TrialId;
  mode: ModeId;
  terms: CaseTerms;
  rules: TrialRules;
  benches: Benches;
  category: Category;
  title?: string;
  /** The filer's account (Solo/Versus side A), or null for an editor-run Grand Jury case. */
  filer: Hex | null;
  now: number;
}

function emptySide(account: Hex | null): SideFiling {
  return { account, story: '', privateNotes: '', angle: null, nickname: null };
}

export function createTrial(input: CreateTrialInput): FilingState {
  if (input.terms.mode !== input.mode) throw new RangeError(`Terms are for ${input.terms.mode}, not ${input.mode}`);
  const sides: Partial<Record<SideId, SideFiling>> = {};
  if (input.rules.sides.includes('a')) sides.a = emptySide(input.filer);
  return {
    id: input.id,
    mode: input.mode,
    terms: input.terms,
    rules: input.rules,
    benches: input.benches,
    filing: { category: input.category, title: input.title ?? '', context: '', sides },
    createdAt: input.now,
    updatedAt: input.now,
    history: [],
    stage: 'filing',
    step: 'drafting',
    consentEndsAt: null,
  };
}

/** Fingerprint of a frozen transcript (canonical JSON → keccak256). */
export function hashTranscript(lines: readonly CourtLine[]): Hex {
  return keccak256(canonicalJson(lines));
}

/* ── Reducer ──────────────────────────────────────────────────────────── */

class Reject extends Error {
  constructor(
    readonly code: TrialErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function guard(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Reject('guard', message);
}

function assertNever(value: never): never {
  throw new Reject('not-accepted', `Unhandled: ${JSON.stringify(value)}`);
}

const notAccepted = (s: TrialState, e: TrialEvent): never => {
  throw new Reject('not-accepted', `${e.type} is not accepted during ${s.stage}/${s.step}`);
};

function withApproval(list: readonly Approver[], by: Approver): readonly Approver[] {
  return list.includes(by) ? list : [...list, by];
}

function allApproved(rules: TrialRules, approvals: readonly Approver[]): boolean {
  return rules.approvers.every((a) => approvals.includes(a));
}

function partyAccounts(s: Base): Hex[] {
  return Object.values(s.filing.sides)
    .map((side) => side?.account)
    .filter((a): a is Hex => Boolean(a))
    .map((a) => a.toLowerCase() as Hex);
}

export function raised(deposits: readonly FunderDeposit[], includeSponsor = false): Usdc {
  return addUsdc(ZERO_USDC, ...deposits.filter((d) => includeSponsor || d.kind !== 'sponsor').map((d) => d.amount));
}

function fullyFunded(s: CounselState): boolean {
  const t = s.terms;
  if (raised(s.deposits) < t.target) return false;
  if (t.sponsorDeposit !== null) {
    const sponsor = raised(s.deposits.filter((d) => d.kind === 'sponsor'), true);
    if (sponsor < t.sponsorDeposit) return false;
  }
  return true;
}

function close(s: Exclude<TrialState, VerdictState | AppealState | ShareState | ClosedState>, reason: CancelReason, settlement: Settlement | null): ClosedState {
  const extra = s as { caseNumber?: CaseNumber | null; exhibits?: readonly Exhibit[]; transcript?: FrozenTranscript | null };
  return {
    id: s.id,
    mode: s.mode,
    terms: s.terms,
    rules: s.rules,
    benches: s.benches,
    filing: s.filing,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    history: s.history,
    stage: 'closed',
    step: 'cancelled',
    reason,
    cancelledFrom: s.stage,
    caseNumber: extra.caseNumber ?? null,
    exhibits: extra.exhibits ?? [],
    transcript: extra.transcript ?? null,
    settlement,
  };
}

function validateSide(rules: TrialRules, side: SideFiling): void {
  guard(side.story.length <= rules.storyMaxChars, `Story is longer than ${rules.storyMaxChars} characters`);
  guard(side.angle === null || side.angle.length <= rules.angleMaxChars, `Angle is longer than ${rules.angleMaxChars} characters (D2)`);
  guard(side.nickname === null || side.nickname.length <= rules.nicknameMaxChars, `Nickname is longer than ${rules.nicknameMaxChars} characters (D5)`);
}

function editSide(s: FilingState | EvidenceState, side: SideId, patch: FilingPatch): Filing {
  guard(s.rules.sides.includes(side), `This mode has no side ${side.toUpperCase()}`);
  const current = s.filing.sides[side];
  guard(current, `Side ${side.toUpperCase()} has not joined the case`);
  const next: SideFiling = { ...current, ...patch };
  if (patch.angle !== undefined) next.angle = patch.angle === null ? null : patch.angle.trim() || null;
  if (patch.nickname !== undefined) next.nickname = patch.nickname === null ? null : patch.nickname.trim() || null;
  validateSide(s.rules, next);
  return { ...s.filing, sides: { ...s.filing.sides, [side]: next } };
}

function openEvidence(s: FilingState, filing: Filing): EvidenceState {
  return {
    ...baseOf(s),
    filing,
    stage: 'evidence',
    step: 'collecting',
    exhibits: [],
    approvals: [],
  };
}

function baseOf(s: Base): Base {
  return {
    id: s.id,
    mode: s.mode,
    terms: s.terms,
    rules: s.rules,
    benches: s.benches,
    filing: s.filing,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    history: s.history,
  };
}

function reduceFiling(s: FilingState, e: TrialEvent, now: number): TrialState {
  switch (e.type) {
    case 'FILING_EDITED':
      guard(s.step === 'drafting' || e.side !== 'a', 'Side A cannot edit after submitting; wait for consent');
      return { ...s, filing: editSide(s, e.side, e.patch) };
    case 'CASE_DETAILS_EDITED':
      guard(s.step === 'drafting', 'Case details are locked once submitted');
      guard(e.patch.title === undefined || e.patch.title.length <= 80, 'Title is longer than 80 characters');
      return { ...s, filing: { ...s.filing, ...e.patch } };
    case 'FILING_SUBMITTED': {
      guard(s.step === 'drafting', 'Already submitted');
      guard(s.filing.title.trim().length > 0, 'The case needs a title');
      if (s.rules.sides.length === 0) guard(s.filing.context.trim().length > 0, 'A Grand Jury case needs a reviewed context card');
      const a = s.filing.sides.a;
      if (s.rules.sides.includes('a')) guard(a && a.story.trim().length > 0, 'Side A needs a story');
      if (s.rules.requiresConsent) {
        return { ...s, step: 'awaiting-consent', consentEndsAt: s.terms.deadlines.preTrial === null ? null : now + s.terms.deadlines.preTrial };
      }
      return openEvidence(s, s.filing);
    }
    case 'CONSENT_GIVEN': {
      guard(s.step === 'awaiting-consent', 'Nobody has been invited yet');
      guard(e.side !== 'a' && s.rules.sides.includes(e.side), `Side ${e.side.toUpperCase()} cannot consent`);
      guard(!partyAccounts(s).includes(e.account.toLowerCase() as Hex), 'Both sides cannot be the same account');
      return openEvidence(s, { ...s.filing, sides: { ...s.filing.sides, [e.side]: emptySide(e.account) } });
    }
    case 'CONSENT_DECLINED':
      guard(s.step === 'awaiting-consent', 'Nobody has been invited yet');
      return close(s, 'consent-declined', null);
    case 'DEADLINE_PASSED':
      guard(e.deadline === 'consent' && s.step === 'awaiting-consent', `No ${e.deadline} deadline during filing`);
      guard(s.consentEndsAt !== null && now >= s.consentEndsAt, 'The consent deadline has not passed');
      return close(s, 'consent-missed', null);
    case 'CANCELLED':
      guard(e.reason === 'withdrawn', `Cannot cancel a filing for "${e.reason}"`);
      return close(s, 'withdrawn', null);
    default:
      return notAccepted(s, e);
  }
}

function reduceEvidence(s: EvidenceState, e: TrialEvent): TrialState {
  switch (e.type) {
    case 'FILING_EDITED':
      return { ...s, filing: editSide(s, e.side, e.patch), approvals: [] };
    case 'EXHIBIT_ADDED': {
      guard(s.exhibits.length < s.rules.maxExhibits, `At most ${s.rules.maxExhibits} exhibits`);
      guard(!s.exhibits.some((x) => x.id === e.exhibit.id), `Exhibit ${e.exhibit.id} already exists`);
      guard(e.exhibit.submittedBy === 'court' || s.rules.sides.includes(e.exhibit.submittedBy), 'Unknown submitter');
      guard(e.exhibit.redacted, 'Exhibits must pass the redaction pass first');
      return { ...s, exhibits: [...s.exhibits, e.exhibit], approvals: [] };
    }
    case 'EXHIBIT_REMOVED':
      guard(s.exhibits.some((x) => x.id === e.exhibitId), `No exhibit ${e.exhibitId}`);
      return { ...s, exhibits: s.exhibits.filter((x) => x.id !== e.exhibitId), approvals: [] };
    case 'EVIDENCE_APPROVED': {
      guard(s.rules.approvers.includes(e.by), `${e.by} does not approve evidence in this mode`);
      for (const side of s.rules.sides) {
        guard(s.filing.sides[side]?.story.trim(), `Side ${side.toUpperCase()} has no story yet`);
      }
      const approvals = withApproval(s.approvals, e.by);
      if (!allApproved(s.rules, approvals)) return { ...s, approvals };
      return {
        ...baseOf(s),
        exhibits: s.exhibits,
        stage: 'counsel',
        step: 'drafting',
        attempt: 1,
        autoRedraftsUsed: 0,
        redraftsUsed: {},
        pendingRedraft: null,
        draft: null,
        balance: null,
        approvals: [],
        transcript: null,
        caseNumber: null,
        deposits: [],
        fundingEndsAt: null,
      };
    }
    case 'MODERATION_REJECTED':
      return close(s, 'moderation-rejected', null);
    case 'CANCELLED':
      guard(e.reason === 'withdrawn' || e.reason === 'moderation-rejected', `Cannot cancel evidence for "${e.reason}"`);
      return close(s, e.reason, null);
    default:
      return notAccepted(s, e);
  }
}

function reduceCounsel(s: CounselState, e: TrialEvent, now: number): TrialState {
  switch (e.type) {
    case 'COUNSEL_DRAFTED': {
      guard(s.step === 'drafting', 'No draft was requested');
      guard(e.draft.attempt === s.attempt, `Stale draft (attempt ${e.draft.attempt}, expected ${s.attempt})`);
      if (e.balance.ok) {
        return { ...s, step: 'review', draft: e.draft, balance: e.balance, pendingRedraft: null, approvals: [] };
      }
      if (s.autoRedraftsUsed < s.rules.autoRedrafts) {
        // D1: redraft the weaker bench once, then re-check.
        const weaker: BallotChoice = e.balance.scores[0] <= e.balance.scores[1] ? 0 : 1;
        return { ...s, draft: e.draft, balance: e.balance, autoRedraftsUsed: s.autoRedraftsUsed + 1, attempt: s.attempt + 1, pendingRedraft: weaker };
      }
      return close(s, 'ai-unfair', null);
    }
    case 'COUNSEL_FAILED':
      guard(s.step === 'drafting', 'No draft was requested');
      return close(s, 'ai-failed', null);
    case 'REDRAFT_REQUESTED': {
      guard(s.step === 'review', 'Redrafts happen while reviewing the draft');
      guard(s.rules.sides.includes(e.side), `This mode has no side ${e.side.toUpperCase()}`);
      const used = s.redraftsUsed[e.side] ?? 0;
      guard(used < s.rules.redraftsPerSide, `Side ${e.side.toUpperCase()} has used its redraft (D2)`);
      const bench = s.benches.find((b) => b.client === e.side);
      return {
        ...s,
        step: 'drafting',
        attempt: s.attempt + 1,
        redraftsUsed: { ...s.redraftsUsed, [e.side]: used + 1 },
        pendingRedraft: bench ? bench.choice : null,
        approvals: [],
      };
    }
    case 'DRAFT_APPROVED': {
      guard(s.step === 'review' && s.draft, 'There is no draft to approve');
      guard(s.rules.approvers.includes(e.by), `${e.by} does not approve drafts in this mode`);
      const approvals = withApproval(s.approvals, e.by);
      if (!allApproved(s.rules, approvals)) return { ...s, approvals };
      const lines = s.draft.lines;
      const transcript: FrozenTranscript = {
        lines,
        hash: hashTranscript(lines),
        frozenAt: now,
        provider: s.draft.provider,
        model: s.draft.model,
        requestIds: s.draft.usage.flatMap((u) => u.requestIds),
      };
      const window = s.terms.deadlines.preTrial;
      return { ...s, step: 'funding', approvals, transcript, fundingEndsAt: window === null ? null : now + window };
    }
    case 'CASE_OPENED':
      guard(s.step === 'funding' && s.transcript, 'Freeze the transcript before opening the case');
      guard(s.caseNumber === null, 'Case already opened');
      guard(e.transcriptHash === s.transcript.hash, 'The ledger recorded a different transcript hash');
      return { ...s, caseNumber: e.caseNumber };
    case 'FUNDS_DEPOSITED': {
      guard(s.step === 'funding' && s.caseNumber !== null && s.transcript, 'The case is not open for funding');
      guard(e.deposit.amount > 0n, 'Deposits must be positive');
      const next: CounselState = { ...s, deposits: [...s.deposits, e.deposit] };
      if (!fullyFunded(next)) return next;
      return {
        ...baseOf(s),
        exhibits: s.exhibits,
        caseNumber: s.caseNumber,
        transcript: s.transcript,
        deposits: next.deposits,
        stage: 'jury',
        step: 'recruiting',
        seats: [],
        recruitEndsAt: now + s.terms.deadlines.recruitment,
        commitEndsAt: null,
        revealEndsAt: null,
      };
    }
    case 'DEADLINE_PASSED':
      guard(e.deadline === 'funding' && s.step === 'funding', `No ${e.deadline} deadline while counsel ${s.step}`);
      guard(s.fundingEndsAt !== null && now >= s.fundingEndsAt, 'The funding deadline has not passed');
      return close(s, 'funding-missed', null);
    case 'CANCELLED':
      guard(['withdrawn', 'ai-failed', 'ai-unfair', 'moderation-rejected', 'consent-declined'].includes(e.reason), `Cannot cancel counsel for "${e.reason}"`);
      return close(s, e.reason, e.settlement ?? null);
    default:
      return notAccepted(s, e);
  }
}

function seatOf(s: JuryState, account: Hex): JurySeat | undefined {
  const key = account.toLowerCase();
  return s.seats.find((x) => x.account.toLowerCase() === key);
}

function updateSeat(s: JuryState, account: Hex, patch: Partial<JurySeat>): readonly JurySeat[] {
  const key = account.toLowerCase();
  return s.seats.map((x) => (x.account.toLowerCase() === key ? { ...x, ...patch } : x));
}

function reduceJury(s: JuryState, e: TrialEvent, now: number): TrialState {
  switch (e.type) {
    case 'SEAT_FILLED': {
      guard(s.step === 'recruiting', 'The jury is already seated');
      guard(!seatOf(s, e.account), 'This juror already has a seat on this case');
      guard(!partyAccounts(s).includes(e.account.toLowerCase() as Hex), 'A party cannot sit on their own jury (V4 §10)');
      const seats = [...s.seats, { seat: s.seats.length + 1, account: e.account, committed: false, revealed: false }];
      return { ...s, seats, step: seats.length === s.terms.jurySize ? 'briefing' : 'recruiting' };
    }
    case 'COURT_OPENED':
      guard(s.step === 'briefing', 'The court opens once the jury is seated');
      guard(e.commitEndsAt > now && e.revealEndsAt > e.commitEndsAt, 'Deadlines must be in order and in the future');
      return { ...s, step: 'commit', commitEndsAt: e.commitEndsAt, revealEndsAt: e.revealEndsAt };
    case 'BALLOT_COMMITTED': {
      guard(s.step === 'commit', 'Ballots are committed during the commit window');
      const seat = seatOf(s, e.account);
      guard(seat, 'Only seated jurors can commit');
      guard(!seat.committed, 'This juror already committed');
      return { ...s, seats: updateSeat(s, e.account, { committed: true }) };
    }
    case 'BALLOT_REVEALED': {
      guard(s.step === 'reveal', 'Ballots are revealed during the reveal window');
      const seat = seatOf(s, e.account);
      guard(seat?.committed, 'Only a committed juror can reveal');
      guard(!seat.revealed, 'This juror already revealed');
      return { ...s, seats: updateSeat(s, e.account, { revealed: true, choice: e.choice }) };
    }
    case 'DEADLINE_PASSED':
      switch (e.deadline) {
        case 'recruitment':
          guard(s.step === 'recruiting' && now >= s.recruitEndsAt, 'The recruitment deadline has not passed');
          return close(s, 'jury-unfilled', null);
        case 'commit':
          guard(s.step === 'commit' && s.commitEndsAt !== null && now >= s.commitEndsAt, 'The commit window is still open');
          return { ...s, step: 'reveal' };
        case 'reveal':
          guard(s.step === 'reveal' && s.revealEndsAt !== null && now >= s.revealEndsAt, 'The reveal window is still open');
          return { ...s, step: 'finalizing' };
        default:
          throw new Reject('guard', `No ${e.deadline} deadline during the jury stage`);
      }
    case 'VERDICT_RECORDED': {
      guard(s.step === 'finalizing', 'Finalize after the reveal window closes');
      const verdict = e.settlement.verdict;
      guard(verdict, 'A trial settlement must carry a verdict');
      const decisive = verdict.kind !== 'no-verdict';
      return {
        ...baseOf(s),
        exhibits: s.exhibits,
        caseNumber: s.caseNumber,
        transcript: s.transcript,
        deposits: s.deposits,
        seats: s.seats,
        verdict,
        settlement: e.settlement,
        sentence: null,
        appealEndsAt: decisive && s.rules.appeal.allowed ? now + s.rules.appeal.windowSeconds : null,
        stage: 'verdict',
        step: 'announced',
      };
    }
    case 'CANCELLED':
      guard(['protective', 'jury-unfilled', 'withdrawn'].includes(e.reason), `Cannot cancel a seated case for "${e.reason}"`);
      guard(e.reason !== 'withdrawn' || s.step === 'recruiting', 'The filer can only withdraw before the jury is seated');
      return close(s, e.reason, e.settlement ?? null);
    default:
      return notAccepted(s, e);
  }
}

function losingSides(s: Decided): SideId[] {
  if (s.verdict.kind === 'no-verdict') return [];
  const winner: BallotChoice = s.verdict.kind === 'ballot-0' ? 0 : 1;
  return s.benches.filter((b) => b.choice !== winner && b.client !== null).map((b) => b.client!) as SideId[];
}

function decidedOf(s: VerdictState | AppealState | ShareState): Decided {
  return {
    ...baseOf(s),
    exhibits: s.exhibits,
    caseNumber: s.caseNumber,
    transcript: s.transcript,
    deposits: s.deposits,
    seats: s.seats,
    verdict: s.verdict,
    settlement: s.settlement,
    sentence: s.sentence,
    appealEndsAt: s.appealEndsAt,
  };
}

function reduceVerdict(s: VerdictState, e: TrialEvent, now: number): TrialState {
  switch (e.type) {
    case 'SENTENCE_READ':
      guard(s.sentence === null, 'The sentence has been read');
      guard(e.line.speaker === 'judge', 'Only Judge Gavel.exe reads the sentence');
      return { ...s, sentence: e.line };
    case 'APPEAL_REQUESTED':
      guard(s.appealEndsAt !== null && now < s.appealEndsAt, 'This verdict cannot be appealed');
      guard(losingSides(s).includes(e.side), 'Only the losing side can appeal');
      return { ...decidedOf(s), stage: 'appeal', step: 'requested', appellant: e.side };
    case 'SHARED':
      return { ...decidedOf(s), stage: 'share', step: 'open', shares: [{ channel: e.channel, at: now }], appealedTo: null };
    case 'DEADLINE_PASSED':
      guard(e.deadline === 'appeal' && s.appealEndsAt !== null && now >= s.appealEndsAt, 'No appeal deadline has passed');
      return { ...s, appealEndsAt: null };
    default:
      return notAccepted(s, e);
  }
}

function reduceAppeal(s: AppealState, e: TrialEvent, now: number): TrialState {
  switch (e.type) {
    case 'APPEAL_FILED':
      guard(e.caseNumber !== s.caseNumber, 'An appeal is a new case');
      return { ...decidedOf(s), appealEndsAt: null, stage: 'share', step: 'open', shares: [], appealedTo: e.caseNumber };
    case 'APPEAL_WITHDRAWN':
      return { ...decidedOf(s), stage: 'verdict', step: 'announced' };
    case 'DEADLINE_PASSED':
      guard(e.deadline === 'appeal' && s.appealEndsAt !== null && now >= s.appealEndsAt, 'The appeal window is still open');
      return { ...decidedOf(s), appealEndsAt: null, stage: 'share', step: 'open', shares: [], appealedTo: null };
    default:
      return notAccepted(s, e);
  }
}

function reduceShare(s: ShareState, e: TrialEvent, now: number): TrialState {
  switch (e.type) {
    case 'SHARED':
      return { ...s, shares: [...s.shares, { channel: e.channel, at: now }] };
    case 'SENTENCE_READ':
      guard(s.sentence === null, 'The sentence has been read');
      guard(e.line.speaker === 'judge', 'Only Judge Gavel.exe reads the sentence');
      return { ...s, sentence: e.line };
    default:
      return notAccepted(s, e);
  }
}

function step(s: TrialState, e: TrialEvent, now: number): TrialState {
  switch (s.stage) {
    case 'filing':
      return reduceFiling(s, e, now);
    case 'evidence':
      return reduceEvidence(s, e);
    case 'counsel':
      return reduceCounsel(s, e, now);
    case 'jury':
      return reduceJury(s, e, now);
    case 'verdict':
      return reduceVerdict(s, e, now);
    case 'appeal':
      return reduceAppeal(s, e, now);
    case 'share':
      return reduceShare(s, e, now);
    case 'closed':
      if (e.type !== 'REFUNDED') return notAccepted(s, e);
      guard(s.settlement === null, 'Refunds were already recorded');
      guard(e.settlement.verdict === null, 'A cancelled case has no verdict');
      return { ...s, settlement: e.settlement };
    default:
      return assertNever(s);
  }
}

/**
 * Apply one event. Never throws for a rule violation: an impossible or
 * unguarded event returns `{ ok: false }` and leaves the caller's state as is.
 */
export function transition(state: TrialState, event: TrialEvent, ctx: TransitionContext): TransitionResult {
  const accepted = (TRIAL_MACHINE[state.stage] as Partial<Record<TrialEventType, readonly TrialStage[]>>)[event.type];
  if (!accepted) {
    return {
      ok: false,
      error: { code: 'not-accepted', stage: state.stage, step: state.step, event: event.type, message: `${event.type} is not accepted during ${state.stage}` },
    };
  }
  try {
    const next = step(state, event, ctx.now);
    if (!accepted.includes(next.stage)) {
      throw new Error(`Machine violation: ${state.stage} --${event.type}--> ${next.stage} is not in TRIAL_MACHINE`);
    }
    const stamp: TrialStamp = { at: ctx.now, event: event.type, from: `${state.stage}/${state.step}`, to: `${next.stage}/${next.step}` };
    return { ok: true, state: { ...next, updatedAt: ctx.now, history: [...state.history, stamp] } };
  } catch (err) {
    if (err instanceof Reject) {
      return { ok: false, error: { code: err.code, stage: state.stage, step: state.step, event: event.type, message: err.message } };
    }
    throw err;
  }
}

/** Apply events in order; stops at the first rejection. */
export function replay(state: TrialState, events: readonly { event: TrialEvent; now: number }[]): TransitionResult {
  let current: TrialState = state;
  for (const { event, now } of events) {
    const result = transition(current, event, { now });
    if (!result.ok) return result;
    current = result.state;
  }
  return { ok: true, state: current };
}

/* ── Views ────────────────────────────────────────────────────────────── */

/** The on-chain CasePhase this trial state corresponds to. */
export function chainPhaseOf(s: TrialState): CasePhase {
  switch (s.stage) {
    case 'filing':
      return s.step === 'awaiting-consent' ? 'pre-trial' : 'draft';
    case 'evidence':
      return 'draft';
    case 'counsel':
      return s.step === 'funding' && s.terms.deadlines.preTrial !== null ? 'pre-trial' : 'draft';
    case 'jury':
      switch (s.step) {
        case 'recruiting':
          return 'recruiting';
        case 'briefing':
          return 'preparing';
        case 'commit':
          return 'commit';
        case 'reveal':
          return 'reveal';
        case 'finalizing':
          return 'finalizing';
        default:
          return assertNever(s);
      }
    case 'verdict':
    case 'appeal':
    case 'share':
      return 'settled';
    case 'closed':
      return 'cancelled';
    default:
      return assertNever(s);
  }
}

/** Seconds left on whatever deadline is currently running, or null. */
export function activeDeadline(s: TrialState): { deadline: Deadline; endsAt: number } | null {
  switch (s.stage) {
    case 'filing':
      return s.consentEndsAt === null ? null : { deadline: 'consent', endsAt: s.consentEndsAt };
    case 'counsel':
      return s.step === 'funding' && s.fundingEndsAt !== null ? { deadline: 'funding', endsAt: s.fundingEndsAt } : null;
    case 'jury':
      if (s.step === 'recruiting') return { deadline: 'recruitment', endsAt: s.recruitEndsAt };
      if (s.step === 'commit' && s.commitEndsAt !== null) return { deadline: 'commit', endsAt: s.commitEndsAt };
      if (s.step === 'reveal' && s.revealEndsAt !== null) return { deadline: 'reveal', endsAt: s.revealEndsAt };
      return null;
    case 'verdict':
    case 'appeal':
      return s.appealEndsAt === null ? null : { deadline: 'appeal', endsAt: s.appealEndsAt };
    default:
      return null;
  }
}

/** Committed-ballot count only: the commit step never reveals choices (V4 §5). */
export function juryProgress(s: JuryState): { seated: number; committed: number; revealed: number; of: number } {
  return {
    seated: s.seats.length,
    committed: s.seats.filter((x) => x.committed).length,
    revealed: s.seats.filter((x) => x.revealed).length,
    of: s.terms.jurySize,
  };
}

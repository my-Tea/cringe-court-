/**
 * AiCounselPort: the AI prosecution and defense (0G Compute in production, a
 * fixture in tests). The engine only ever talks to this port.
 *
 * Fairness rules the port contract carries (D1, D2, D3, D12):
 * - A bench sees its own client's private notes and angle, and **only** the
 *   other bench's public text. `privateNotes` of the other side never reaches
 *   its prompt. Implementations must prove this in tests.
 * - Both benches get the same model and the same token budget.
 * - A balance check runs before the draft can be frozen.
 * - The AI never decides the verdict. `sentence()` only flavours a verdict the
 *   human jury already recorded.
 */
import type { Category, Hex } from '../case';
import type { Benches, CharacterId, CounselCharacter, CounselRole, SideId } from '../cast';
import type { ModeId } from '../modes';
import type { BallotChoice } from '../settlement';
import type { Speaker, TranscriptLine } from './court';
import type { CameraShot } from './stage';

/** Which part of the show a line belongs to. */
export type Segment = 'call-to-order' | 'opening' | 'exhibit' | 'rebuttal' | 'closing' | 'jury-out' | 'sentence';

/** Courtroom stage directions the director understands (see packages/engine). */
export type Beat =
  | 'desk-slam'
  | 'objection'
  | 'point'
  | 'gasp'
  | 'laugh'
  | 'smug'
  | 'sweat'
  | 'cry'
  | 'gavel'
  | 'present-evidence'
  | 'dramatic-pause';

/** Portrait / expression preset for a line. Renderers without a matching portrait fall back to neutral. */
export type Emotion =
  | 'neutral'
  | 'confident'
  | 'smug'
  | 'angry'
  | 'shocked'
  | 'nervous'
  | 'sad'
  | 'amused'
  | 'exasperated'
  | 'triumphant';

/** Gallery reaction after a line. */
export type CrowdReaction = 'gasp' | 'laugh' | 'murmur';

/** A transcript line with the courtroom metadata the director needs. Extends TranscriptLine. */
export interface CourtLine extends TranscriptLine {
  /** Stable id within the transcript ("L07"). */
  id: string;
  segment: Segment;
  /** Which bench is speaking, if a counsel is. */
  bench?: BallotChoice;
  beat?: Beat;
  /** Exhibit referenced by this line, if any. */
  exhibitId?: string;
  /** Expression preset (court-ai output). Optional: older transcripts omit it. */
  emotion?: Emotion;
  /** Camera preset override. Omitted = the director picks the shot from the speaker. */
  camera?: CameraShot;
  /** Gallery reaction after the line, used when the beat does not already imply one. */
  crowd?: CrowdReaction;
}

export interface PublicExhibit {
  id: string;
  /** Who submitted it: a side, or the court (Grand Jury source pack). */
  submittedBy: SideId | 'court';
  kind: 'text' | 'screenshot' | 'link' | 'quote';
  title: string;
  /** Sanitized, approved text. Screenshots carry their approved caption/OCR text. */
  body: string;
}

/** What one bench is told. `privateNotes` and `angle` exist only for a client's own advocate. */
export interface CounselBrief {
  choice: BallotChoice;
  role: CounselRole;
  counsel: CounselCharacter;
  client: SideId | null;
  /** The approved public story for this bench's position. */
  publicText: string;
  /** Advocate-only. Never shown to the other bench, the jury or the public. */
  privateNotes?: string;
  /** D2: one steering angle, ≤ 140 chars, inserted as quoted data. */
  angle?: string;
  /** D5: optional self-approved nickname (≤ 24 chars). */
  nickname?: string;
}

export interface TokenBudget {
  /** Per bench, identical for both (fairness). */
  maxInputTokens: number;
  maxOutputTokens: number;
}

/** Who pays for inference (D12). `user-credits` = that side's own 0G Compute Pass. */
export type InferencePayer = 'platform' | 'user-credits';

export interface CounselRequest {
  trialId: string;
  mode: ModeId;
  category: Category;
  title: string;
  ballot: readonly [string, string];
  benches: Benches;
  briefs: readonly [CounselBrief, CounselBrief];
  exhibits: readonly PublicExhibit[];
  /** D3 teaser = call to order + openings + "THE JURY IS OUT". Full = the whole trial. */
  scope: 'teaser' | 'full';
  /** Per bench, by ballot choice. */
  payer: readonly [InferencePayer, InferencePayer];
  budget: TokenBudget;
  /** 1 for the first draft; the engine increments on redrafts. */
  attempt: number;
  /** Lines carried over from a teaser into the paid case (D3). */
  carryOver?: readonly CourtLine[];
  /** Bench to redraft (balance auto-redraft or a user redraft); omitted = draft both. */
  redraft?: BallotChoice;
}

export interface BenchUsage {
  inputTokens: number;
  outputTokens: number;
  requestIds: readonly string[];
}

export interface CounselDraft {
  lines: readonly CourtLine[];
  usage: readonly [BenchUsage, BenchUsage];
  provider: 'og-compute' | 'fixture';
  model: string;
  attempt: number;
}

export interface BalanceReport {
  ok: boolean;
  /** 0..1 per bench: argument strength proxy (length, exhibits used, rebuttal coverage). */
  scores: readonly [number, number];
  reasons: readonly string[];
}

export interface AngleRequest {
  trialId: string;
  mode: ModeId;
  category: Category;
  /** Approved public story. */
  story: string;
  privateNotes?: string;
  role: CounselRole;
}

export interface AngleSuggestion {
  id: string;
  /** ≤ 140 chars, ready to drop into CounselBrief.angle. */
  text: string;
}

export interface SentenceRequest {
  trialId: string;
  /** The verdict label the human jury recorded ("GUILTY", "SIDE B", "NO VERDICT"). */
  verdictLabel: string;
  transcriptHash: Hex;
  category: Category;
  title: string;
}

export interface AiCounselPort {
  readonly id: 'og-compute' | 'fixture';
  /** D2: three angle suggestions from the intake call. */
  suggestAngles(request: AngleRequest, signal?: AbortSignal): Promise<readonly AngleSuggestion[]>;
  /** Draft (or redraft one bench of) the trial transcript. */
  draft(request: CounselRequest, signal?: AbortSignal): Promise<CounselDraft>;
  /** D1 balance gate, run before freezing. Deterministic for a given draft. */
  assessBalance(draft: CounselDraft, request: CounselRequest): Promise<BalanceReport>;
  /** Judge Gavel.exe's sentence line for an already recorded human verdict. */
  sentence(request: SentenceRequest, signal?: AbortSignal): Promise<CourtLine>;
}

/** Typed failure an adapter throws so the engine can cancel with the right reason. */
export class CounselError extends Error {
  constructor(
    readonly code: 'unavailable' | 'rate-limited' | 'budget-exceeded' | 'unsafe-content' | 'invalid-output' | 'aborted',
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'CounselError';
  }
}

export const SPEAKER_CHARACTER: Readonly<Record<Speaker, CharacterId>> = {
  judge: 'judge',
  prosecutor: 'prosecutor',
  defense: 'defense',
  'side-a': 'side-a',
  'side-b': 'side-b',
  narrator: 'ai-narrator',
  clerk: 'clerk',
};

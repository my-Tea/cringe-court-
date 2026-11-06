/**
 * CourtAI: the orchestration pipeline.
 *
 *   PreparedCase -> mode plan -> prompt -> InferenceClient (0G / mock)
 *     -> parse (safe defaults) -> validate (hard + soft, rubric estimate)
 *     -> [one bounded repair turn with the findings] -> assemble with
 *        court-written template slots -> content hash -> Transcript
 *
 *   FinalizedCaseResult -> post-verdict prompt -> InferenceClient -> validate
 *     against the external result -> JudgeCommentary (template fallback)
 *
 * The AI never chooses the mode, the verdict, the ballot labels or money.
 * Generation cost is bounded: at most `maxAttempts` trial calls (default 2)
 * and exactly one commentary call.
 */
import { canonicalJson, keccak256 } from '@cringe-court/core';
import { checkCommentary, checkScript } from './checks';
import { InferenceError, silentLogger, type CourtLogger, type InferenceClient, type InferenceResult } from './inference';
import { parseCommentary, parseModelScript } from './parse';
import { PLANS, benchFor, speakerFor, type ModePlan } from './plans';
import { outcomePhrase, postVerdictMessages, repairMessages, trialMessages, type PromptMessage } from './prompts';
import {
  FinalizedCaseResultSchema,
  PreparedCaseSchema,
  TRANSCRIPT_SCHEMA_VERSION,
  type CommentaryLine,
  type CourtEmotion,
  type CourtSpeaker,
  type FinalizedCaseResult,
  type GeneratedTrial,
  type InferenceMeta,
  type JudgeCommentary,
  type ModelLine,
  type ModelScript,
  type PreparedCase,
  type Transcript,
  type TranscriptLine,
  type ValidationIssue,
} from './schema';

/** The provider-facing interface the game server depends on. */
export interface CourtAIProvider {
  generateTrial(input: PreparedCase, signal?: AbortSignal): Promise<GeneratedTrial>;
  generateVerdictCommentary(input: FinalizedCaseResult, transcript?: Transcript, signal?: AbortSignal): Promise<JudgeCommentary>;
}

export interface TrialOptions {
  /** Total trial inference calls, repair included (default 2). */
  maxAttempts?: number;
  temperature?: number;
  maxTokens?: number;
  /** Minimum heuristic rubric average (1-5) to accept without repair (default 3.5). */
  minOverall?: number;
  /** Minimum per-dimension estimate (default 2). */
  minDimension?: number;
  /** Reading speed for the runtime estimate. */
  charsPerSecond?: number;
  now?: () => Date;
  logger?: CourtLogger;
}

export type TrialFailureCode = 'refused' | 'invalid-output';

/** The model output could not be turned into a usable trial within the attempt budget. */
export class TrialGenerationError extends Error {
  constructor(
    readonly code: TrialFailureCode,
    readonly userMessage: string,
    readonly issues: readonly ValidationIssue[],
    readonly inference: InferenceMeta,
  ) {
    super(`${code}: ${userMessage}`);
    this.name = 'TrialGenerationError';
  }
}

interface Attempt {
  script: ModelScript | null;
  issues: ValidationIssue[];
  coercions: string[];
  scores: Record<string, number>;
  overall: number;
  raw: string;
}

const hardCount = (a: Attempt) => a.issues.filter((i) => i.severity === 'hard').length;

export class CourtAI implements CourtAIProvider {
  readonly #client: InferenceClient;
  readonly #o: Required<Omit<TrialOptions, 'logger' | 'now'>> & { logger: CourtLogger; now: () => Date };

  constructor(client: InferenceClient, options: TrialOptions = {}) {
    this.#client = client;
    this.#o = {
      maxAttempts: Math.max(1, Math.min(options.maxAttempts ?? 2, 3)),
      temperature: options.temperature ?? 0.85,
      maxTokens: options.maxTokens ?? 3000,
      minOverall: options.minOverall ?? 3.5,
      minDimension: options.minDimension ?? 2,
      charsPerSecond: options.charsPerSecond ?? 15,
      logger: options.logger ?? silentLogger,
      now: options.now ?? (() => new Date()),
    };
  }

  get provider(): InferenceClient['provider'] {
    return this.#client.provider;
  }

  async generateTrial(input: PreparedCase, signal?: AbortSignal): Promise<GeneratedTrial> {
    const c = PreparedCaseSchema.parse(input);
    const plan = PLANS[c.mode];
    const validFacts = new Set(c.facts.map((f) => f.id));
    const base = trialMessages(c, plan);
    let messages: PromptMessage[] = base;
    const results: InferenceResult[] = [];
    let best: Attempt | null = null;

    for (let n = 1; n <= this.#o.maxAttempts; n++) {
      const res = await this.#client.complete({
        purpose: n === 1 ? 'trial' : 'repair',
        caseId: c.caseId,
        messages,
        maxTokens: this.#o.maxTokens,
        temperature: this.#o.temperature,
        json: true,
        ...(signal ? { signal } : {}),
      });
      results.push(res);
      const parsed = parseModelScript(res.content, validFacts);
      if (parsed.kind === 'refusal') {
        throw new TrialGenerationError(
          'refused',
          parsed.refusal === 'unsuitable' ? 'The court declined this case as unsuitable.' : 'The court needs more detail to hold a trial.',
          [{ code: `refusal:${parsed.refusal}`, severity: 'hard', message: parsed.reason ?? parsed.refusal }],
          this.#meta(results),
        );
      }
      const attempt: Attempt =
        parsed.kind === 'error'
          ? { script: null, issues: [{ code: parsed.code, severity: 'hard', message: parsed.message }], coercions: [], scores: {}, overall: 1, raw: res.content }
          : (() => {
              const check = checkScript(c, plan, parsed.script, { charsPerSecond: this.#o.charsPerSecond });
              return { script: parsed.script, issues: check.issues, coercions: parsed.coercions, scores: check.scores, overall: check.overall, raw: res.content };
            })();
      const hard = hardCount(attempt);
      const minDim = Math.min(...Object.values(attempt.scores), 5);
      this.#o.logger.info('court.trial.attempt', { caseId: c.caseId, attempt: n, hard, soft: attempt.issues.length - hard, overall: attempt.overall, requestId: res.requestId });
      if (!best || hard < hardCount(best) || (hard === hardCount(best) && attempt.overall > best.overall)) best = attempt;
      if (attempt.script && hard === 0 && attempt.overall >= this.#o.minOverall && minDim >= this.#o.minDimension) {
        return this.#assemble(c, plan, attempt, results, n, false);
      }
      if (n < this.#o.maxAttempts) {
        const feedback = attempt.issues.filter((i) => i.severity === 'hard').concat(attempt.issues.filter((i) => i.severity === 'soft'));
        messages = repairMessages(base, attempt.raw, feedback);
      }
    }

    // Budget spent. Accept the best attempt only if it has no hard failures (flagged as below threshold).
    if (best?.script && hardCount(best) === 0) return this.#assemble(c, plan, best, results, results.length, true);
    throw new TrialGenerationError(
      'invalid-output',
      'The court could not prepare a reliable script for this case. Please try again.',
      best?.issues ?? [],
      this.#meta(results),
    );
  }

  #meta(results: readonly InferenceResult[]): InferenceMeta {
    const last = results.at(-1);
    const usage = results.every((r) => r.usage)
      ? results.reduce((u, r) => ({ inputTokens: u.inputTokens + (r.usage?.inputTokens ?? 0), outputTokens: u.outputTokens + (r.usage?.outputTokens ?? 0) }), { inputTokens: 0, outputTokens: 0 })
      : undefined;
    const trustMode = last?.trustMode ?? this.#client.trustMode;
    return {
      provider: this.#client.provider,
      model: last?.model ?? this.#client.model,
      requestIds: results.map((r) => r.requestId).filter((id): id is string => typeof id === 'string' && id.length > 0),
      trustMode,
      verification: trustMode === 'verified' || trustMode === 'private' ? 'not-verified-by-harness' : 'none',
      responseMeta: last?.responseMeta ?? {},
      calls: results.length,
      latencyMs: results.reduce((n, r) => n + r.latencyMs, 0),
      ...(usage ? { usage } : {}),
    };
  }

  #assemble(c: PreparedCase, plan: ModePlan, attempt: Attempt, results: readonly InferenceResult[], attempts: number, belowThreshold: boolean): Transcript {
    const script = attempt.script as ModelScript;
    const bySlot = new Map<string, ModelLine>(script.lines.map((l) => [l.slot, l]));
    const lines: TranscriptLine[] = plan.slots.map((slot) => {
      const speaker = speakerFor(slot, c);
      const bench = benchFor(slot);
      if (slot.template) {
        return {
          id: slot.id,
          segment: slot.segment,
          speaker,
          emotion: 'neutral',
          animation: slot.role === 'judge' ? 'gavel' : 'talk',
          camera: 'auto',
          crowd: 'none',
          text: slot.template(c),
          factRefs: [],
          source: 'template',
        };
      }
      const m = bySlot.get(slot.id) as ModelLine;
      const line: TranscriptLine = {
        id: slot.id,
        segment: slot.segment,
        speaker,
        emotion: m.emotion,
        animation: m.animation,
        camera: m.camera,
        crowd: m.crowd,
        text: m.text,
        factRefs: m.factRefs,
        source: 'model',
      };
      if (bench !== undefined) line.bench = bench;
      if (m.answers) line.answers = m.answers;
      return line;
    });
    const chars = lines.reduce((n, l) => n + l.text.length, 0);
    const content = {
      schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
      scriptVersion: plan.version,
      caseId: c.caseId,
      mode: c.mode,
      category: c.category,
      title: c.title,
      tone: c.tone,
      facts: c.facts,
      ballot: c.ballot,
      parties: c.parties,
      ...(c.advocates ? { advocates: c.advocates } : {}),
      analysis: script.analysis,
      lines,
    } as const;
    const transcript: Transcript = {
      ...content,
      estimatedSeconds: Math.round(chars / this.#o.charsPerSecond + lines.length * 0.6),
      inference: this.#meta(results),
      validation: {
        ok: true,
        scores: attempt.scores,
        overall: attempt.overall,
        belowThreshold,
        issues: attempt.issues,
        coercions: attempt.coercions,
        attempts,
      },
      generatedAt: this.#o.now().toISOString(),
      contentHash: hashTranscript(content),
    };
    this.#o.logger.info('court.trial.ready', { caseId: c.caseId, mode: c.mode, attempts, overall: attempt.overall, belowThreshold, contentHash: transcript.contentHash });
    return transcript;
  }

  /* ── Post-verdict ──────────────────────────────────────────────────────── */

  async generateVerdictCommentary(input: FinalizedCaseResult, transcript?: Transcript, signal?: AbortSignal): Promise<JudgeCommentary> {
    const r = FinalizedCaseResultSchema.parse(input);
    if (transcript && (transcript.caseId !== r.caseId || transcript.mode !== r.mode)) {
      throw new Error(`Result ${r.caseId}/${r.mode} does not match transcript ${transcript.caseId}/${transcript.mode}`);
    }
    const required = outcomePhrase(r);
    let issues: ValidationIssue[] = [];
    let res: InferenceResult | null = null;
    try {
      res = await this.#client.complete({
        purpose: 'commentary',
        caseId: r.caseId,
        messages: postVerdictMessages(r, transcript),
        maxTokens: 600,
        temperature: 0.8,
        json: true,
        ...(signal ? { signal } : {}),
      });
      const parsed = parseCommentary(res.content);
      if (parsed.kind === 'ok') {
        issues = checkCommentary(parsed.value, required, r.marketSettled);
        if (issues.every((i) => i.severity !== 'hard')) {
          return {
            caseId: r.caseId,
            outcome: r.outcome,
            lines: commentaryLines(r, parsed.value, transcript),
            source: 'model',
            inference: this.#meta([res]),
            issues,
          };
        }
      } else {
        issues = [{ code: 'schema', severity: 'hard', message: parsed.message }];
      }
    } catch (e) {
      if (!(e instanceof InferenceError) || e.code === 'aborted') throw e;
      issues = [{ code: `provider:${e.code}`, severity: 'hard', message: e.message }];
    }
    this.#o.logger.warn('court.commentary.fallback', { caseId: r.caseId, issues: issues.map((i) => i.code) });
    return {
      caseId: r.caseId,
      outcome: r.outcome,
      lines: commentaryLines(r, templateCommentary(r, transcript), transcript),
      source: 'template',
      ...(res ? { inference: this.#meta([res]) } : {}),
      issues,
    };
  }
}

/** Canonical content hash: everything that affects what is performed, nothing about how/when it was generated. */
export function hashTranscript(content: Omit<Transcript, 'estimatedSeconds' | 'inference' | 'validation' | 'generatedAt' | 'contentHash'>): string {
  return keccak256(canonicalJson(content));
}

export function verifyTranscriptHash(t: Transcript): boolean {
  const { estimatedSeconds: _e, inference: _i, validation: _v, generatedAt: _g, contentHash, ...content } = t;
  return hashTranscript(content) === contentHash;
}

/* ── Commentary helpers ──────────────────────────────────────────────────── */

/** Which advocate's side won, for reaction emotions. */
function winner(r: FinalizedCaseResult, t?: Transcript): CourtSpeaker | null {
  switch (r.outcome) {
    case 'GUILTY':
      return 'prosecutor';
    case 'NOT_COOKED':
      return 'defense';
    case 'SIDE_A':
      return t?.advocates?.A ?? null;
    case 'SIDE_B':
      return t?.advocates?.B ?? null;
    default:
      return null;
  }
}

function commentaryLines(r: FinalizedCaseResult, text: { announcement: string; quip: string; prosecutorReaction?: string | undefined; defenseReaction?: string | undefined }, t?: Transcript): CommentaryLine[] {
  const w = winner(r, t);
  const decided = w !== null;
  const mood = (who: CourtSpeaker): CourtEmotion => (!decided ? 'exasperated' : who === w ? 'triumphant' : 'sad');
  const lines: CommentaryLine[] = [
    { speaker: 'judge', emotion: decided ? 'confident' : 'exasperated', animation: 'gavel', text: text.announcement },
    { speaker: 'judge', emotion: 'amused', animation: 'talk', text: text.quip },
  ];
  if (text.prosecutorReaction) lines.push({ speaker: 'prosecutor', emotion: mood('prosecutor'), animation: w === 'prosecutor' ? 'smug' : decided ? 'sweat' : 'talk', text: text.prosecutorReaction });
  if (text.defenseReaction) lines.push({ speaker: 'defense', emotion: mood('defense'), animation: w === 'defense' ? 'laugh' : decided ? 'sweat' : 'talk', text: text.defenseReaction });
  return lines;
}

/** Deterministic fallback commentary. Always states the external result exactly. */
export function templateCommentary(r: FinalizedCaseResult, t?: Transcript): { announcement: string; quip: string; prosecutorReaction?: string; defenseReaction?: string } {
  const title = r.title ?? t?.title ?? 'this case';
  const a = r.sideALabel ?? t?.parties.sideA ?? 'Side A';
  const b = r.sideBLabel ?? t?.parties.sideB ?? 'Side B';
  switch (r.outcome) {
    case 'GUILTY':
      return { announcement: 'Order! The jury has spoken: GUILTY.', quip: `The court will remember "${title}" as a cautionary tale.`, prosecutorReaction: 'Justice, served with a side of told-you-so.', defenseReaction: 'My client will be appealing to common sense. Eventually.' };
    case 'NOT_COOKED':
      return { announcement: 'Order! The jury has spoken: NOT COOKED.', quip: `"${title}" walks free. The court has questions, but no further ones.`, prosecutorReaction: 'The prosecution is shocked, and only slightly dramatic about it.', defenseReaction: 'Instinct wins again. Somebody frame this moment.' };
    case 'SIDE_A':
      return { announcement: `Order! The jury has spoken: SIDE A, ${a}.`, quip: `"${title}" is decided as far as this court is concerned. The household is not.` };
    case 'SIDE_B':
      return { announcement: `Order! The jury has spoken: SIDE B, ${b}.`, quip: `"${title}" is decided as far as this court is concerned. The household is not.` };
    case 'NO_VERDICT':
      return { announcement: 'Order. The jury reached NO VERDICT. The matter stays open.', quip: `"${title}" remains one of the great unanswered questions.` };
    case 'CANCELLED':
      return { announcement: 'This case has been CANCELLED. Nothing was decided.', quip: 'The clerk will be filing the paperwork in the drawer marked "later".' };
    case 'INVALID':
      return { announcement: 'This case has been ruled INVALID by its resolution process. Nothing was decided here.', quip: 'The court thanks everyone for their patience, and the clerk for the extra paperwork.' };
  }
}

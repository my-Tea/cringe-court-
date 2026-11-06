/**
 * Court AI schemas: every shape that crosses a trust boundary (developer/app
 * input, model output, stored transcript, post-verdict input and output) is a
 * Zod schema here, and the TypeScript types are inferred from it. Nothing else
 * in the harness invents its own shape.
 *
 * Enumerations are deliberately small and map onto what the existing Director
 * (packages/engine) and art pipeline already understand. See docs/ai/08 and 09.
 */
import { z } from 'zod';

/* ── Enumerations ────────────────────────────────────────────────────────── */

/** Chosen by the application. The AI never decides or changes it. */
export const COURT_MODES = ['solo', 'versus', 'viral'] as const;
export const CourtModeSchema = z.enum(COURT_MODES);
export type CourtMode = z.infer<typeof CourtModeSchema>;

/** Speakers the court AI may write for. Side A / Side B are argued by the two advocates, never voiced directly. */
export const COURT_SPEAKERS = ['judge', 'clerk', 'prosecutor', 'defense'] as const;
export const CourtSpeakerSchema = z.enum(COURT_SPEAKERS);
export type CourtSpeaker = z.infer<typeof CourtSpeakerSchema>;

/** Mirrors core `Emotion`. */
export const EMOTIONS = ['neutral', 'confident', 'smug', 'angry', 'shocked', 'nervous', 'sad', 'amused', 'exasperated', 'triumphant'] as const;
export const EmotionSchema = z.enum(EMOTIONS);
export type CourtEmotion = z.infer<typeof EmotionSchema>;

/** `talk` = no extra gesture; the rest are core `Beat` values the Director already performs. */
export const ANIMATIONS = ['talk', 'point', 'desk-slam', 'objection', 'gasp', 'laugh', 'smug', 'sweat', 'cry', 'gavel', 'present-evidence', 'dramatic-pause'] as const;
export const AnimationSchema = z.enum(ANIMATIONS);
export type CourtAnimation = z.infer<typeof AnimationSchema>;

/** Named camera presets; `auto` lets the game pick from the speaker. Mapped to core `CameraShot` in stage.ts. */
export const CAMERAS = ['auto', 'wide_courtroom', 'judge_closeup', 'prosecution_closeup', 'defense_closeup', 'clerk_desk', 'jury_box', 'gallery'] as const;
export const CameraSchema = z.enum(CAMERAS);
export type CourtCamera = z.infer<typeof CameraSchema>;

/** Gallery sound reaction after a line. */
export const CROWD_REACTIONS = ['none', 'gasp', 'laugh', 'murmur'] as const;
export const CrowdSchema = z.enum(CROWD_REACTIONS);
export type CourtCrowd = z.infer<typeof CrowdSchema>;

export const CASE_CATEGORIES = [
  'finance',
  'crypto',
  'dating',
  'friendship',
  'roommates',
  'family',
  'gaming',
  'food',
  'fitness',
  'productivity',
  'tech',
  'work',
  'internet',
  'shopping',
  'everyday',
  'public-debate',
] as const;
export const CategorySchema = z.enum(CASE_CATEGORIES);
export type CaseCategory = z.infer<typeof CategorySchema>;

/** Ballot labels per mode. The AI only ever *invites* a vote between them. */
export const SOLO_BALLOT = ['GUILTY', 'NOT_COOKED'] as const;
export const SIDE_BALLOT = ['SIDE_A', 'SIDE_B'] as const;
export type BallotLabel = (typeof SOLO_BALLOT)[number] | (typeof SIDE_BALLOT)[number];

/** Final results arrive from the jury / an authorised resolver, never from the AI. */
export const OUTCOMES = ['GUILTY', 'NOT_COOKED', 'SIDE_A', 'SIDE_B', 'NO_VERDICT', 'CANCELLED', 'INVALID'] as const;
export const OutcomeSchema = z.enum(OUTCOMES);
export type CourtOutcome = z.infer<typeof OutcomeSchema>;

/* ── Case input (from the app or the developer runner) ───────────────────── */

const caseIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, 'caseId: 1-64 letters, digits, "_" or "-"');
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const nickname = text(1, 24).regex(/^[\p{L}\p{N} ._'-]+$/u, 'names: letters, digits, spaces and . _ \' - only');

export const SoloCaseInputSchema = z.object({
  mode: z.literal('solo'),
  caseId: caseIdSchema.optional(),
  caseTitle: text(3, 90),
  /** The confession, in the player's own words. */
  confession: text(15, 1200),
  /** Optional extra circumstances. */
  context: text(1, 600).optional(),
  category: CategorySchema.optional(),
  /** Display name the court uses for the defendant (default "the defendant"). */
  defendantName: nickname.optional(),
});

const VersusSideSchema = z.object({
  name: nickname.optional(),
  /** That participant's account of the dispute. */
  account: text(15, 1200),
});

export const VersusCaseInputSchema = z.object({
  mode: z.literal('versus'),
  caseId: caseIdSchema.optional(),
  caseTitle: text(3, 90),
  sideA: VersusSideSchema,
  sideB: VersusSideSchema,
  /** Facts both participants confirmed in the app. Only these are presented as agreed. */
  agreedFacts: z.array(text(3, 240)).max(8).optional(),
  category: CategorySchema.optional(),
});

export const ViralSourceSchema = z.object({
  id: z.string().regex(/^S\d{1,2}$/, 'source ids look like S1, S2'),
  title: text(3, 140),
  publisher: text(1, 80).optional(),
  /** ISO date (YYYY-MM-DD) as approved by the curator. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** The approved claim or quote taken from this source. */
  claim: text(10, 400),
  /** Whether the claim is a verifiable fact or someone's opinion. */
  kind: z.enum(['fact', 'opinion']),
});

export const ViralCaseInputSchema = z.object({
  mode: z.literal('viral'),
  caseId: caseIdSchema.optional(),
  caseTitle: text(3, 90),
  /** The approved resolution question. Shown verbatim; the AI may not rephrase it. */
  question: text(10, 200),
  /** Approved neutral summary. */
  summary: text(20, 800),
  sideA: z.object({ label: text(2, 40), position: text(10, 400) }),
  sideB: z.object({ label: text(2, 40), position: text(10, 400) }),
  sources: z.array(ViralSourceSchema).max(8).default([]),
  /** Known open questions the court must not resolve. */
  uncertainty: z.array(text(5, 240)).max(5).default([]),
  /** Curation gate: only approved cases reach the AI. */
  approved: z.literal(true, { message: 'Viral cases must be approved by curators before a trial is generated' }),
  category: CategorySchema.optional(),
});

export const CaseInputSchema = z.discriminatedUnion('mode', [SoloCaseInputSchema, VersusCaseInputSchema, ViralCaseInputSchema]);
export type CaseInput = z.input<typeof CaseInputSchema>;
export type ParsedCaseInput = z.output<typeof CaseInputSchema>;
export type SoloCaseInput = z.output<typeof SoloCaseInputSchema>;
export type VersusCaseInput = z.output<typeof VersusCaseInputSchema>;
export type ViralCaseInput = z.output<typeof ViralCaseInputSchema>;

/* ── Prepared case (deterministic preparation output) ────────────────────── */

export const FACT_STATUSES = ['stated', 'context', 'agreed', 'claimed-by-a', 'claimed-by-b', 'background', 'sourced-fact', 'sourced-opinion', 'position-a', 'position-b'] as const;

export const FactSchema = z.object({
  /** F1, F2, ... stable within a case. */
  id: z.string().regex(/^F\d{1,2}$/),
  text: z.string().min(1).max(400),
  status: z.enum(FACT_STATUSES),
  /** Viral: the source id the fact came from. */
  sourceId: z.string().optional(),
});
export type CaseFact = z.infer<typeof FactSchema>;

export const ToneSchema = z.enum(['standard', 'gentle']);
export type CourtTone = z.infer<typeof ToneSchema>;

/** Which advocate argues which side (Versus/Viral). Assigned from the case id, never by the model. */
export const AdvocatesSchema = z.object({
  A: z.enum(['prosecutor', 'defense']),
  B: z.enum(['prosecutor', 'defense']),
});
export type Advocates = z.infer<typeof AdvocatesSchema>;

export const PreparedCaseSchema = z.object({
  caseId: caseIdSchema,
  mode: CourtModeSchema,
  title: z.string(),
  category: CategorySchema,
  tone: ToneSchema,
  facts: z.array(FactSchema).min(1).max(24),
  ballot: z.tuple([z.string(), z.string()]),
  /** Solo: defendant display name. Versus/Viral: side names / labels. */
  parties: z.object({
    defendant: z.string().optional(),
    sideA: z.string().optional(),
    sideB: z.string().optional(),
  }),
  advocates: AdvocatesSchema.optional(),
  viral: z
    .object({
      question: z.string(),
      positionA: z.string(),
      positionB: z.string(),
      uncertainty: z.array(z.string()),
      /** Approved sources, so lines can attribute ("according to <title>"). */
      sources: z.array(z.object({ id: z.string(), title: z.string(), publisher: z.string().optional(), date: z.string().optional() })),
    })
    .optional(),
  /** Deterministic notes for the prompt and the report (redactions, injection-like text, tone downgrade). */
  flags: z.array(z.string()),
  /** keccak256 of the canonical, redacted input. */
  inputHash: z.string(),
});
export type PreparedCase = z.infer<typeof PreparedCaseSchema>;

/* ── Model output ────────────────────────────────────────────────────────── */

const factRefs = z.array(z.string()).max(6).default([]);

/** One model-written line. Unknown enum values are coerced before this schema runs (see parse.ts). */
export const ModelLineSchema = z.object({
  slot: z.string().regex(/^L\d{2}$/),
  speaker: CourtSpeakerSchema,
  emotion: EmotionSchema.default('neutral'),
  animation: AnimationSchema.default('talk'),
  camera: CameraSchema.default('auto'),
  crowd: CrowdSchema.default('none'),
  text: z.string().trim().min(1),
  factRefs,
  /** For a reply slot: the few words of the earlier line it answers, quoted. */
  answers: z.string().trim().max(160).optional(),
});
export type ModelLine = z.infer<typeof ModelLineSchema>;

/** The model's case understanding, written before the lines (same call). */
export const CaseAnalysisSchema = z.object({
  /** One sentence: what this case is really about. */
  core: z.string().trim().min(10).max(300),
  /** The comic tension or contradiction. */
  tension: z.string().trim().min(5).max(300),
  /** Strongest point for ballot option 0 (the case against / Side A). */
  benchA: z.string().trim().min(5).max(300),
  /** Strongest point for ballot option 1 (the defense / Side B). */
  benchB: z.string().trim().min(5).max(300),
  factRefs,
});
export type CaseAnalysis = z.infer<typeof CaseAnalysisSchema>;

export const ModelScriptSchema = z.object({
  analysis: CaseAnalysisSchema,
  lines: z.array(ModelLineSchema).min(1).max(20),
});
export type ModelScript = z.infer<typeof ModelScriptSchema>;

/** The model may refuse a case it judges unsuitable; the harness turns this into a rejection. */
export const RefusalSchema = z.object({ refusal: z.enum(['unsuitable', 'insufficient-facts']), reason: z.string().max(200).optional() });

/* ── Final transcript ────────────────────────────────────────────────────── */

export const TranscriptLineSchema = z.object({
  id: z.string(),
  segment: z.enum(['call-to-order', 'opening', 'exhibit', 'rebuttal', 'closing', 'jury-out', 'sentence']),
  speaker: CourtSpeakerSchema,
  /** Ballot index this line argues for (counsel only). */
  bench: z.union([z.literal(0), z.literal(1)]).optional(),
  emotion: EmotionSchema,
  animation: AnimationSchema,
  camera: CameraSchema,
  crowd: CrowdSchema,
  text: z.string(),
  factRefs: z.array(z.string()),
  answers: z.string().optional(),
  /** `template` lines are written by the harness (procedure, vote invitation), never by the model. */
  source: z.enum(['model', 'template']),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const InferenceMetaSchema = z.object({
  provider: z.enum(['0g-router', 'mock']),
  model: z.string(),
  /** Real provider request ids only. Mock runs have none: ids are never fabricated. */
  requestIds: z.array(z.string()),
  trustMode: z.enum(['standard', 'verified', 'private', 'none']),
  /**
   * What we can say about TEE verification. `not-verified-by-harness`: a trust mode was
   * requested but this harness did not check any attestation itself.
   */
  verification: z.enum(['none', 'not-verified-by-harness']),
  /** Selected 0G response headers / fields (x-0g-*), kept verbatim for audit. */
  responseMeta: z.record(z.string(), z.string()),
  calls: z.number().int(),
  latencyMs: z.number(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }).optional(),
});
export type InferenceMeta = z.infer<typeof InferenceMetaSchema>;

export const QUALITY_DIMENSIONS = ['grounding', 'coherence', 'prosecution', 'defense', 'humor', 'originality', 'character', 'performance'] as const;
export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

export const IssueSchema = z.object({
  code: z.string(),
  severity: z.enum(['hard', 'soft']),
  message: z.string(),
  slot: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof IssueSchema>;

export const ValidationSummarySchema = z.object({
  ok: z.boolean(),
  /** Heuristic 1-5 estimate per rubric dimension (docs/ai/11). */
  scores: z.record(z.string(), z.number()),
  overall: z.number(),
  /** true when accepted after the attempt budget ran out with only soft issues. */
  belowThreshold: z.boolean(),
  issues: z.array(IssueSchema),
  /** Values the parser replaced with documented safe defaults. */
  coercions: z.array(z.string()),
  attempts: z.number().int(),
});
export type ValidationSummary = z.infer<typeof ValidationSummarySchema>;

export const TRANSCRIPT_SCHEMA_VERSION = 'court-transcript@1';

export const TranscriptSchema = z.object({
  schemaVersion: z.literal(TRANSCRIPT_SCHEMA_VERSION),
  /** Prompt + plan version used ("solo-trial@1"). */
  scriptVersion: z.string(),
  caseId: z.string(),
  mode: CourtModeSchema,
  category: CategorySchema,
  title: z.string(),
  tone: ToneSchema,
  facts: z.array(FactSchema),
  ballot: z.tuple([z.string(), z.string()]),
  parties: PreparedCaseSchema.shape.parties,
  advocates: AdvocatesSchema.optional(),
  analysis: CaseAnalysisSchema,
  lines: z.array(TranscriptLineSchema),
  estimatedSeconds: z.number(),
  inference: InferenceMetaSchema,
  validation: ValidationSummarySchema,
  generatedAt: z.string(),
  /** keccak256 over the canonical content (see hashTranscript). Stable across replays. */
  contentHash: z.string(),
});
export type Transcript = z.infer<typeof TranscriptSchema>;
/** What `generateTrial` returns. */
export type GeneratedTrial = Transcript;

/* ── Post-verdict ────────────────────────────────────────────────────────── */

export const FinalizedCaseResultSchema = z
  .object({
    caseId: caseIdSchema,
    mode: CourtModeSchema,
    status: z.enum(['FINALIZED', 'CANCELLED', 'INVALID']),
    outcome: OutcomeSchema,
    /** One-line neutral summary supplied by the app (falls back to the transcript title). */
    summary: text(5, 300),
    title: text(3, 90).optional(),
    /** Vote tally, if the app wants it mentioned. Never invented by the AI. */
    tally: z.object({ a: z.number().int().min(0), b: z.number().int().min(0) }).optional(),
    /** Side names / labels for Versus and Viral announcements. */
    sideALabel: text(1, 40).optional(),
    sideBLabel: text(1, 40).optional(),
    /** Set only when the app has independently confirmed market settlement (Viral). */
    marketSettled: z.boolean().optional(),
  })
  .superRefine((r, ctx) => {
    const soloOk = ['GUILTY', 'NOT_COOKED', 'NO_VERDICT', 'CANCELLED', 'INVALID'];
    const sideOk = ['SIDE_A', 'SIDE_B', 'NO_VERDICT', 'CANCELLED', 'INVALID'];
    const allowed = r.mode === 'solo' ? soloOk : sideOk;
    if (!allowed.includes(r.outcome)) ctx.addIssue({ code: 'custom', message: `outcome ${r.outcome} is not valid for mode ${r.mode}` });
    if (r.status === 'CANCELLED' && r.outcome !== 'CANCELLED') ctx.addIssue({ code: 'custom', message: 'status CANCELLED requires outcome CANCELLED' });
    if (r.status === 'INVALID' && r.outcome !== 'INVALID') ctx.addIssue({ code: 'custom', message: 'status INVALID requires outcome INVALID' });
    if (r.status === 'FINALIZED' && (r.outcome === 'CANCELLED' || r.outcome === 'INVALID')) {
      ctx.addIssue({ code: 'custom', message: `status FINALIZED cannot carry outcome ${r.outcome}` });
    }
    if (r.marketSettled !== undefined && r.mode !== 'viral') ctx.addIssue({ code: 'custom', message: 'marketSettled applies to viral cases only' });
  });
export type FinalizedCaseResult = z.infer<typeof FinalizedCaseResultSchema>;

export const CommentaryLineSchema = z.object({
  speaker: CourtSpeakerSchema,
  emotion: EmotionSchema.default('neutral'),
  animation: AnimationSchema.default('talk'),
  text: z.string().trim().min(1).max(240),
});
export type CommentaryLine = z.infer<typeof CommentaryLineSchema>;

/** What the model returns for post-verdict commentary. */
export const ModelCommentarySchema = z.object({
  announcement: z.string().trim().min(5).max(200),
  quip: z.string().trim().min(5).max(240),
  prosecutorReaction: z.string().trim().min(3).max(200).optional(),
  defenseReaction: z.string().trim().min(3).max(200).optional(),
});

export const JudgeCommentarySchema = z.object({
  caseId: z.string(),
  outcome: OutcomeSchema,
  lines: z.array(CommentaryLineSchema).min(1).max(4),
  /** `template` when the model output failed validation or the provider failed. */
  source: z.enum(['model', 'template']),
  inference: InferenceMetaSchema.optional(),
  issues: z.array(IssueSchema),
});
export type JudgeCommentary = z.infer<typeof JudgeCommentarySchema>;

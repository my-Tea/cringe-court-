/**
 * Evaluation helpers for corpus runs (docs/ai/11). Automated signals only:
 * the heuristic rubric estimate from the validator, case-specific grounding
 * (mustMention / forbidden), and cross-trial novelty, which catches the
 * "same joke, nouns swapped" failure. Human review remains the release gate.
 */
import { contentWords } from '../checks';
import type { Transcript } from '../schema';
import type { CorpusCase } from './corpus';

export interface CaseEvaluation {
  id: string;
  mode: Transcript['mode'];
  overall: number;
  scores: Record<string, number>;
  belowThreshold: boolean;
  softIssues: number;
  /** Share of mustMention words that appear in model-written lines. */
  mention: number;
  forbiddenHits: string[];
  estimatedSeconds: number;
  calls: number;
}

const modelText = (t: Transcript) =>
  t.lines
    .filter((l) => l.source === 'model')
    .map((l) => l.text)
    .join(' \n ')
    .toLowerCase();

export function evaluateTranscript(t: Transcript, c: CorpusCase): CaseEvaluation {
  const text = modelText(t);
  const must = c.mustMention ?? [];
  const mentioned = must.filter((w) => text.includes(w.toLowerCase())).length;
  return {
    id: c.id,
    mode: t.mode,
    overall: t.validation.overall,
    scores: t.validation.scores,
    belowThreshold: t.validation.belowThreshold,
    softIssues: t.validation.issues.filter((i) => i.severity === 'soft').length,
    mention: must.length ? mentioned / must.length : 1,
    forbiddenHits: (c.forbidden ?? []).filter((w) => new RegExp(`(^|[^a-z])${w.toLowerCase()}([^a-z]|$)`).test(text)),
    estimatedSeconds: t.estimatedSeconds,
    calls: t.inference.calls,
  };
}

function grams(text: string): Set<string> {
  const w = contentWords(text);
  const out = new Set<string>();
  for (let i = 0; i + 4 <= w.length; i++) out.add(w.slice(i, i + 4).join(' '));
  return out;
}

/**
 * Mean pairwise Jaccard similarity of counsel-line 4-grams across trials of the
 * same mode, after masking each case's own nouns (fact words). High values mean
 * the writer reuses one script with the nouns swapped. Target (docs/ai/11): < 0.08.
 */
export function crossTrialSimilarity(transcripts: readonly Transcript[]): number {
  const sets = transcripts.map((t) => {
    const caseWords = new Set(contentWords(t.facts.map((f) => f.text).join(' ') + ' ' + t.title));
    const counsel = t.lines
      .filter((l) => l.source === 'model' && (l.speaker === 'prosecutor' || l.speaker === 'defense'))
      .map((l) => l.text)
      .join(' ');
    const masked = contentWords(counsel)
      .map((w) => (caseWords.has(w) ? '_' : w))
      .join(' ');
    return grams(masked);
  });
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i] as Set<string>;
      const b = sets[j] as Set<string>;
      const inter = [...a].filter((g) => b.has(g)).length;
      const union = new Set([...a, ...b]).size;
      total += union ? inter / union : 0;
      pairs++;
    }
  }
  return pairs ? total / pairs : 0;
}

export interface CorpusReport {
  provider: string;
  model: string;
  cases: number;
  trials: number;
  failures: { id: string; reason: string }[];
  hardPassRate: number;
  firstAttemptRate: number;
  meanOverall: number;
  meanMention: number;
  forbiddenHits: number;
  similarity: Record<string, number>;
  evaluations: CaseEvaluation[];
}

export function summarize(provider: string, model: string, cases: number, results: { c: CorpusCase; t?: Transcript; error?: string }[]): CorpusReport {
  const ok = results.filter((r): r is { c: CorpusCase; t: Transcript } => Boolean(r.t));
  const evaluations = ok.map((r) => evaluateTranscript(r.t, r.c));
  const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);
  const similarity: Record<string, number> = {};
  for (const mode of ['solo', 'versus', 'viral'] as const) {
    const ts = ok.filter((r) => r.t.mode === mode).map((r) => r.t);
    if (ts.length > 1) similarity[mode] = Math.round(crossTrialSimilarity(ts) * 1000) / 1000;
  }
  return {
    provider,
    model,
    cases,
    trials: ok.length,
    failures: results.filter((r) => r.error).map((r) => ({ id: r.c.id, reason: r.error as string })),
    hardPassRate: cases ? ok.length / cases : 0,
    firstAttemptRate: ok.length ? ok.filter((r) => r.t.inference.calls === 1).length / ok.length : 0,
    meanOverall: mean(evaluations.map((e) => e.overall)),
    meanMention: mean(evaluations.map((e) => e.mention)),
    forbiddenHits: evaluations.reduce((n, e) => n + e.forbiddenHits.length, 0),
    similarity,
    evaluations,
  };
}

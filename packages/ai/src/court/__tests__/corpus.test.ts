/**
 * The 60-case corpus and the adversarial set through the full pipeline with the
 * mock writer. This proves preparation, prompting, parsing, validation and
 * assembly hold for varied inputs. It cannot prove comedy quality: the mock's
 * jokes are templates (its cross-trial similarity is high on purpose). Quality is
 * measured on live 0G output with `npm run court:eval` (docs/ai/11).
 */
import { describe, expect, it } from 'vitest';
import { CourtAI, TrialGenerationError } from '../engine';
import { ADVERSARIAL_CORPUS, FULL_CORPUS, SOLO_CORPUS, VERSUS_CORPUS, VIRAL_CORPUS, type CorpusCase } from '../eval/corpus';
import { EXAMPLE_INPUTS, exampleScript } from '../eval/examples';
import { crossTrialSimilarity, evaluateTranscript, summarize } from '../eval/evaluate';
import { MockInferenceClient } from '../mock';
import { prepareCase } from '../prepare';

const court = () => new CourtAI(new MockInferenceClient(), { now: () => new Date('2026-11-06T00:00:00Z') });
const run = (c: CorpusCase) => court().generateTrial(prepareCase(c.input));

describe('corpus coverage', () => {
  it('has at least 20 cases per mode with unique ids', () => {
    expect(SOLO_CORPUS).toHaveLength(20);
    expect(VERSUS_CORPUS).toHaveLength(20);
    expect(VIRAL_CORPUS).toHaveLength(20);
    const ids = [...FULL_CORPUS, ...ADVERSARIAL_CORPUS].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mock pipeline over the corpus', () => {
  it.each(FULL_CORPUS)('$id produces a valid trial with no hard issues', async (c) => {
    const t = await run(c);
    expect(t.validation.issues.filter((i) => i.severity === 'hard')).toEqual([]);
    expect(t.inference.requestIds).toEqual([]);
    const e = evaluateTranscript(t, c);
    expect(e.forbiddenHits).toEqual([]);
  });

  it.each(ADVERSARIAL_CORPUS.filter((c) => c.expect === 'trial'))('$id (adversarial) yields a clean trial or a clear refusal, never an unsafe one', async (c) => {
    const outcome = await run(c).catch((e: unknown) => e);
    if (outcome instanceof TrialGenerationError) {
      expect(outcome.code).toBe('invalid-output');
      return;
    }
    const t = outcome as Awaited<ReturnType<typeof run>>;
    const text = t.lines.map((l) => l.text).join(' ');
    expect(text).not.toMatch(/the verdict is|example\.com|555-123|<\/?case_data|[{}]/i);
    expect(t.lines.filter((l) => l.speaker === 'judge' && l.source === 'model').map((l) => l.text).join(' ')).not.toMatch(/\bguilty\b|not cooked/i);
    expect(t.validation.issues.filter((i) => i.severity === 'hard')).toEqual([]);
  });

  it('refuses to ship a writer that parrots injected JSON, tags or insults', async () => {
    // The naive mock quotes case text verbatim, so these must be refused after the repair turn.
    for (const id of ['A02', 'A04', 'A05']) {
      const c = ADVERSARIAL_CORPUS.find((x) => x.id === id) as CorpusCase;
      const err = await run(c).catch((e: unknown) => e);
      expect(err, id).toBeInstanceOf(TrialGenerationError);
      expect((err as TrialGenerationError).issues.some((i) => i.code === 'code-like' || i.code === 'insult'), id).toBe(true);
    }
  });

  it('summarises a corpus run', async () => {
    const results = await Promise.all(SOLO_CORPUS.slice(0, 5).map(async (c) => ({ c, t: await run(c) })));
    const report = summarize('mock', 'mock-court-writer@1', 5, results);
    expect(report).toMatchObject({ trials: 5, hardPassRate: 1, firstAttemptRate: 1, forbiddenHits: 0 });
    expect(report.similarity.solo).toBeGreaterThan(0);
  });
});

describe('novelty metric', () => {
  it('scores hand-written trials as distinct and templated mock trials as similar', async () => {
    const handWritten = await Promise.all(
      (['solo', 'versus', 'viral'] as const).map((m) => new CourtAI(new MockInferenceClient({ responses: [exampleScript(m)] })).generateTrial(prepareCase(EXAMPLE_INPUTS[m]))),
    );
    const mock = await Promise.all(SOLO_CORPUS.slice(0, 6).map(run));
    expect(crossTrialSimilarity(handWritten)).toBeLessThan(0.05);
    expect(crossTrialSimilarity(mock)).toBeGreaterThan(0.2);
  });
});

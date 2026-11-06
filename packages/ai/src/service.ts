/**
 * CounselService: the real AiCounselPort.
 *
 * Fairness (D1): each bench gets its own model call with the identical token
 * budget and temperature; the judge's call-to-order and "THE JURY IS OUT" lines
 * are templates, so the AI never speaks a verdict. Teaser scope (D3) is the
 * openings plus "THE JURY IS OUT." and nothing else.
 */
import { CounselError } from '@cringe-court/core';
import type {
  AiCounselPort,
  AngleRequest,
  AngleSuggestion,
  BalanceReport,
  BallotChoice,
  BenchUsage,
  CounselDraft,
  CounselRequest,
  CourtLine,
  SentenceRequest,
} from '@cringe-court/core';
import type { ChatClient, ChatRequest, ChatResponse } from './chat';
import { MAX_ANGLE_CHARS, MAX_LINE_CHARS, clampText, parseAngles, parseLines } from './parse';
import type { ParsedLine } from './parse';
import {
  ANGLES_BUDGET,
  BENCH_TEMPERATURE,
  JUDGE_TEMPERATURE,
  SENTENCE_BUDGET,
  buildAnglesPrompt,
  buildBenchPrompt,
  buildSentencePrompt,
  callToOrderLine,
  juryOutLine,
  segmentsFor,
  sentenceFallbackText,
} from './prompts';
import type { BenchSegment } from './prompts';

export interface CounselServiceOptions {
  client: ChatClient;
  /** Retries on retryable errors (default 1). */
  retries?: number;
  /** Model label for CounselDraft.model; defaults to what the provider reports. */
  model?: string;
}

type BenchLines = Record<BenchSegment, ParsedLine[]>;

const ORDER: readonly BenchSegment[] = ['opening', 'exhibit', 'rebuttal', 'closing'];
const MAX_PER_SEGMENT: Readonly<Record<BenchSegment, number>> = { opening: 2, exhibit: 3, rebuttal: 2, closing: 2 };

const FALLBACK_ANGLES: readonly string[] = [
  'Lean on the vibes: nobody involved was thinking clearly, least of all the group chat.',
  'Argue the other side is technically right, and that is exactly why it is so cringe.',
  'Treat the whole thing as a misunderstanding that got a little too much budget.',
];

const emptyLines = (): BenchLines => ({ opening: [], exhibit: [], rebuttal: [], closing: [] });

function toCounselError(e: unknown): CounselError {
  if (e instanceof CounselError) return e;
  if (e instanceof Error && e.name === 'AbortError') return new CounselError('aborted', 'Aborted');
  return new CounselError('unavailable', e instanceof Error ? e.message : 'Model call failed', true);
}

function groupCarried(lines: readonly CourtLine[], choice: BallotChoice): BenchLines {
  const out = emptyLines();
  for (const l of lines) {
    if (l.bench !== choice || !ORDER.includes(l.segment as BenchSegment)) continue;
    const parsed: ParsedLine = { segment: l.segment, text: l.text };
    if (l.beat) parsed.beat = l.beat;
    if (l.exhibitId) parsed.exhibitId = l.exhibitId;
    out[l.segment as BenchSegment].push(parsed);
  }
  return out;
}

function isComplete(b: BenchLines, scope: 'teaser' | 'full'): boolean {
  return b.opening.length > 0 && (scope === 'teaser' || (b.rebuttal.length > 0 && b.closing.length > 0));
}

function wordCount(lines: readonly CourtLine[], choice: BallotChoice): number {
  return lines.filter((l) => l.bench === choice).reduce((s, l) => s + l.text.split(/\s+/).filter(Boolean).length, 0);
}

export class CounselService implements AiCounselPort {
  readonly id: 'og-compute' | 'fixture';
  readonly client: ChatClient;
  readonly #retries: number;
  readonly #model: string | undefined;

  constructor(options: CounselServiceOptions) {
    this.client = options.client;
    this.id = options.client.provider;
    this.#retries = options.retries ?? 1;
    this.#model = options.model;
  }

  async #retry<T>(signal: AbortSignal | undefined, fn: () => Promise<T>): Promise<T> {
    let last: CounselError | undefined;
    for (let i = 0; i <= this.#retries; i++) {
      if (signal?.aborted) throw new CounselError('aborted', 'Aborted');
      try {
        return await fn();
      } catch (e) {
        const err = toCounselError(e);
        if (!err.retryable) throw err;
        last = err;
      }
    }
    throw last ?? new CounselError('unavailable', 'Model call failed', true);
  }

  async #complete(request: ChatRequest): Promise<ChatResponse> {
    try {
      return await this.client.complete(request);
    } catch (e) {
      throw toCounselError(e);
    }
  }

  async #runBench(
    request: CounselRequest,
    choice: BallotChoice,
    carriedOpening: readonly ParsedLine[],
    signal: AbortSignal | undefined,
  ): Promise<{ lines: BenchLines; usage: BenchUsage; model: string | undefined }> {
    const delivered = carriedOpening.map((l) => l.text);
    const messages = buildBenchPrompt(request, choice, delivered.length ? { deliveredOpening: delivered } : {});
    const segments = segmentsFor(request.scope, request.exhibits.length > 0, delivered.length > 0);
    const known = request.exhibits.map((x) => x.id);
    const usage = { inputTokens: 0, outputTokens: 0, requestIds: [] as string[] };
    let model: string | undefined;

    const lines = await this.#retry(signal, async () => {
      const res = await this.#complete({
        messages,
        maxTokens: request.budget.maxOutputTokens,
        temperature: BENCH_TEMPERATURE,
        responseFormat: 'json',
        ...(signal ? { signal } : {}),
        payer: request.payer[choice],
        tag: `bench:${choice}`,
      });
      usage.inputTokens += res.usage.inputTokens;
      usage.outputTokens += res.usage.outputTokens;
      usage.requestIds.push(res.requestId);
      model = res.model;
      const parsed = parseLines(res.content, { allowedSegments: segments, knownExhibitIds: known });
      const grouped = emptyLines();
      for (const l of parsed) grouped[l.segment as BenchSegment].push(l);
      for (const seg of segments) {
        if ((seg === 'opening' || seg === 'rebuttal' || seg === 'closing') && grouped[seg].length === 0) {
          throw new CounselError('invalid-output', `Bench ${choice} wrote no ${seg}`, true);
        }
      }
      for (const seg of ORDER) grouped[seg] = grouped[seg].slice(0, MAX_PER_SEGMENT[seg]);
      return grouped;
    });
    if (delivered.length) lines.opening = [...carriedOpening];
    return { lines, usage, model };
  }

  async draft(request: CounselRequest, signal?: AbortSignal): Promise<CounselDraft> {
    const carried: [BenchLines, BenchLines] = request.carryOver
      ? [groupCarried(request.carryOver, 0), groupCarried(request.carryOver, 1)]
      : [emptyLines(), emptyLines()];
    const results: { lines: BenchLines; usage: BenchUsage }[] = [];
    let model = this.#model;

    for (const choice of [0, 1] as const) {
      const mine = carried[choice];
      const keepWhole = request.redraft !== undefined && request.redraft !== choice && isComplete(mine, request.scope);
      if (keepWhole) {
        results.push({ lines: mine, usage: { inputTokens: 0, outputTokens: 0, requestIds: [] } });
        continue;
      }
      // D3: with no explicit redraft, a teaser's openings carry into the full trial.
      const carryOpening = request.redraft === undefined && request.scope === 'full' ? mine.opening : [];
      const run = await this.#runBench(request, choice, carryOpening, signal);
      model ??= run.model;
      results.push({ lines: run.lines, usage: run.usage });
    }

    const [r0, r1] = results as [(typeof results)[number], (typeof results)[number]];
    return {
      lines: this.#assemble(request, [r0.lines, r1.lines]),
      usage: [r0.usage, r1.usage],
      provider: this.client.provider,
      model: model ?? 'unknown',
      attempt: request.attempt,
    };
  }

  #assemble(request: CounselRequest, benches: readonly [BenchLines, BenchLines]): CourtLine[] {
    const out: CourtLine[] = [];
    const push = (line: Omit<CourtLine, 'id'>): void => {
      out.push({ id: `L${String(out.length + 1).padStart(2, '0')}`, ...line });
    };
    push({ speaker: 'judge', ...callToOrderLine(request) });
    const segments = request.scope === 'teaser' ? (['opening'] as const) : ORDER;
    for (const seg of segments) {
      for (const choice of [0, 1] as const) {
        for (const l of benches[choice][seg]) {
          const line: Omit<CourtLine, 'id'> = {
            speaker: request.briefs[choice].counsel,
            bench: choice,
            segment: l.segment,
            text: clampText(l.text, MAX_LINE_CHARS),
          };
          const beat = l.beat ?? (seg === 'exhibit' ? 'present-evidence' : undefined);
          if (beat) line.beat = beat;
          if (l.exhibitId) line.exhibitId = l.exhibitId;
          push(line);
        }
      }
    }
    push({ speaker: 'judge', ...juryOutLine(request.scope) });
    return out;
  }

  async assessBalance(draft: CounselDraft, request: CounselRequest): Promise<BalanceReport> {
    const reasons: string[] = [];
    for (const choice of [0, 1] as const) {
      const has = (segment: string) => draft.lines.some((l) => l.bench === choice && l.segment === segment);
      if (!has('opening')) reasons.push(`Bench ${choice} has no opening`);
      if (request.scope === 'full' && !has('closing')) reasons.push(`Bench ${choice} has no closing`);
    }
    const words: [number, number] = [wordCount(draft.lines, 0), wordCount(draft.lines, 1)];
    const max = Math.max(words[0], words[1], 1);
    const scores: [number, number] = [words[0] / max, words[1] / max];
    if (Math.min(...scores) < 0.6) {
      const weak = scores[0] < scores[1] ? 0 : 1;
      reasons.push(`Bench ${weak} argues at ${Math.round(scores[weak] * 100)}% of the other bench's length`);
    }
    return { ok: reasons.length === 0, scores, reasons };
  }

  async suggestAngles(request: AngleRequest, signal?: AbortSignal): Promise<readonly AngleSuggestion[]> {
    const messages = buildAnglesPrompt(request);
    let texts: string[] = [];
    try {
      texts = await this.#retry(signal, async () => {
        const res = await this.#complete({
          messages,
          maxTokens: ANGLES_BUDGET.maxOutputTokens,
          temperature: JUDGE_TEMPERATURE,
          responseFormat: 'json',
          ...(signal ? { signal } : {}),
          payer: 'platform',
          tag: 'angles',
        });
        return parseAngles(res.content);
      });
    } catch (e) {
      if (!(e instanceof CounselError) || e.code !== 'invalid-output') throw e;
    }
    const all = [...texts, ...FALLBACK_ANGLES.filter((f) => !texts.includes(f))].slice(0, 3);
    return all.map((text, i) => ({ id: `angle-${i + 1}`, text: text.slice(0, MAX_ANGLE_CHARS) }));
  }

  async sentence(request: SentenceRequest, signal?: AbortSignal): Promise<CourtLine> {
    const label = request.verdictLabel.replace(/\s+/g, ' ').trim();
    const make = (text: string): CourtLine => ({ id: 'S01', speaker: 'judge', segment: 'sentence', beat: 'gavel', text: clampText(text, MAX_LINE_CHARS) });
    const messages = buildSentencePrompt(request);
    try {
      const text = await this.#retry(signal, async () => {
        const res = await this.#complete({
          messages,
          maxTokens: SENTENCE_BUDGET.maxOutputTokens,
          temperature: JUDGE_TEMPERATURE,
          responseFormat: 'json',
          ...(signal ? { signal } : {}),
          payer: 'platform',
          tag: 'sentence',
        });
        const line = parseLines(res.content, { allowedSegments: ['sentence'] })[0];
        if (!line) throw new CounselError('invalid-output', 'No sentence line', true);
        return line.text;
      });
      return make(text.toLowerCase().includes(label.toLowerCase()) ? text : `The jury says ${label}. ${text}`);
    } catch (e) {
      if (e instanceof CounselError && e.code === 'aborted') throw e;
      return make(sentenceFallbackText(request.verdictLabel));
    }
  }
}

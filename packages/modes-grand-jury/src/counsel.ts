/**
 * Fixture counsel for the demo docket: serves each reviewed case's scripted
 * show through the real AiCounselPort contract (no network). In production the
 * same requests go to 0G Compute (@cringe-court/ai CounselService).
 */
import {
  CounselError,
  canonicalJson,
  keccak256,
  type AiCounselPort,
  type AngleSuggestion,
  type BalanceReport,
  type CounselDraft,
  type CounselRequest,
  type CourtLine,
  type Hex,
  type SentenceRequest,
} from '@cringe-court/core';
import type { CaseCatalog } from './catalog';

/** D3 teaser: call to order + openings + "THE JURY IS OUT". */
export function teaserOf(lines: readonly CourtLine[]): CourtLine[] {
  return lines.filter((l) => l.segment === 'call-to-order' || l.segment === 'opening' || l.segment === 'jury-out');
}

/** Fingerprint of a frozen transcript (V4 §6.5), recorded on chain before voting. */
export function transcriptHash(lines: readonly CourtLine[]): Hex {
  return keccak256(canonicalJson(lines));
}

const words = (lines: readonly CourtLine[], bench: 0 | 1) =>
  lines.filter((l) => l.bench === bench).reduce((n, l) => n + l.text.split(/\s+/).length, 0);

/** D1 balance gate, same rule as @cringe-court/ai: the shorter bench reaches 60 % of the longer. */
export function assessScriptBalance(lines: readonly CourtLine[]): BalanceReport {
  const w: [number, number] = [words(lines, 0), words(lines, 1)];
  const max = Math.max(...w, 1);
  const scores = [w[0] / max, w[1] / max] as const;
  const reasons: string[] = [];
  for (const b of [0, 1] as const) if (!lines.some((l) => l.bench === b && l.segment === 'opening')) reasons.push(`Bench ${b} has no opening`);
  if (Math.min(...scores) < 0.6) reasons.push('One side got much less room to argue');
  return { ok: reasons.length === 0, scores, reasons };
}

export class ScriptedCounsel implements AiCounselPort {
  readonly id = 'fixture' as const;
  readonly requests: CounselRequest[] = [];

  constructor(private readonly catalog: CaseCatalog) {}

  async suggestAngles(): Promise<readonly AngleSuggestion[]> {
    // Grand Jury has no client and so no angle (D1/D2 apply to Solo only).
    return [];
  }

  async draft(request: CounselRequest, signal?: AbortSignal): Promise<CounselDraft> {
    if (signal?.aborted) throw new CounselError('aborted', 'Aborted');
    this.requests.push(request);
    const file = this.catalog.get(request.trialId);
    if (!file) throw new CounselError('unavailable', `No reviewed case file for ${request.trialId}`);
    const lines = request.scope === 'teaser' ? teaserOf(file.script) : [...file.script];
    const usage = (b: 0 | 1) => ({ inputTokens: 0, outputTokens: words(lines, b), requestIds: [`fixture:${file.slug}:${b}`] });
    return { lines, usage: [usage(0), usage(1)], provider: 'fixture', model: 'scripted-docket', attempt: request.attempt };
  }

  async assessBalance(draft: CounselDraft): Promise<BalanceReport> {
    return assessScriptBalance(draft.lines);
  }

  async sentence(request: SentenceRequest): Promise<CourtLine> {
    const text =
      request.verdictLabel === 'NO VERDICT'
        ? 'MISTRIAL. The jury could not agree, so everyone gets their money back and the internet keeps arguing.'
        : `The jury has spoken: ${request.verdictLabel}. This court is adjourned. Screenshot responsibly.`;
    return { id: 'SENTENCE', speaker: 'judge', segment: 'sentence', text, beat: 'gavel' };
  }
}

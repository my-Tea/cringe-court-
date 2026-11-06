/**
 * What the share card says. Pure: the web app draws it (canvas → PNG) and uses
 * the text for links and native share sheets.
 */
import { CATEGORIES, formatCaseNumber, type CourtLine, type ShareState, type VerdictState } from '@cringe-court/core';

export type VerdictTone = 'guilty' | 'not-cooked' | 'no-verdict';

export interface ShareSummary {
  caseLabel: string;
  title: string;
  category: string;
  verdictLabel: string;
  tone: VerdictTone;
  /** "Bro is cooked." / "Let bro cook." / "Mistrial." */
  headline: string;
  tally: readonly [number, number];
  ballot: readonly [string, string];
  /** The line the card quotes, with who said it. */
  quote: { text: string; by: 'Counsel Chaos' | 'Miss Ratio' | 'Judge Gavel.exe' } | null;
  sentence: string | null;
  /** Short fingerprint of the frozen transcript ("0x3f9a…c21e"). */
  fingerprint: string;
  /** Ready-to-post text (no names, no wallets: everything here is already redacted). */
  shareText: string;
}

export function verdictTone(state: VerdictState | ShareState): VerdictTone {
  return state.verdict.kind === 'ballot-0' ? 'guilty' : state.verdict.kind === 'ballot-1' ? 'not-cooked' : 'no-verdict';
}

const HEADLINES: Readonly<Record<VerdictTone, string>> = {
  guilty: 'Your Honor, bro is cooked.',
  'not-cooked': 'Not cooked. Let bro cook.',
  'no-verdict': 'Mistrial. Everyone gets a refund.',
};

/** The winning side's best line: its closing if it has one, else its longest line. */
export function pickQuote(lines: readonly CourtLine[], tone: VerdictTone): ShareSummary['quote'] {
  const bench = tone === 'guilty' ? 0 : 1;
  const own = lines.filter((l) => l.bench === bench && l.segment !== 'jury-out');
  const closing = own.find((l) => l.segment === 'closing');
  const best = tone === 'no-verdict' ? undefined : (closing ?? [...own].sort((a, b) => b.text.length - a.text.length)[0]);
  if (best) return { text: clip(best.text, 140), by: bench === 0 ? 'Miss Ratio' : 'Counsel Chaos' };
  const judge = lines.find((l) => l.speaker === 'judge' && l.segment === 'call-to-order');
  return judge ? { text: clip(judge.text, 140), by: 'Judge Gavel.exe' } : null;
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function shareSummary(state: VerdictState | ShareState): ShareSummary {
  const tone = verdictTone(state);
  const caseLabel = formatCaseNumber(state.caseNumber);
  const [g, n] = state.verdict.tally;
  const tallyText = tone === 'no-verdict' ? 'no verdict' : `${Math.max(g, n)}–${Math.min(g, n)}`;
  const hash = state.transcript.hash;
  return {
    caseLabel,
    title: state.filing.title,
    category: CATEGORIES[state.filing.category],
    verdictLabel: state.verdict.label,
    tone,
    headline: HEADLINES[tone],
    tally: state.verdict.tally,
    ballot: state.terms.ballot,
    quote: pickQuote(state.transcript.lines, tone),
    sentence: state.sentence?.text ?? null,
    fingerprint: `${hash.slice(0, 6)}…${hash.slice(-4)}`,
    shareText:
      tone === 'no-verdict'
        ? `${caseLabel} “${state.filing.title}”: not enough jurors voted in time. Mistrial, full refund. #CringeCourt`
        : `${caseLabel} “${state.filing.title}”: the jury says ${state.verdict.label} (${tallyText}). ${HEADLINES[tone]} #CringeCourt`,
  };
}

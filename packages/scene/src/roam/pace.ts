/**
 * Hearing pace: how fast a first-person hearing plays. All timing constants
 * for dialogue and beats live here so hosts (and the Versus commit window) can
 * size things off them; `estimateHearingSeconds` predicts a hearing's length
 * without running it.
 *
 * - `standard` (default): the whole transcript, brisk: about 60–75 s for a
 *   typical 13-line hearing, close to the classic stage's 55 s.
 * - `highlights`: the strongest lines of each beat only (about half as long).
 * - `full`: the original slow read (typewriter 48 cps, long holds).
 *
 * Fast-forward multiplies beat and dialogue time by `FAST_FORWARD` without
 * dropping anything. Nothing here can skip the verdict beat.
 */
import type { BeatStep, DialogueLine } from './types';

export type HearingPace = 'standard' | 'highlights' | 'full';

export const HEARING_PACES: readonly HearingPace[] = ['standard', 'highlights', 'full'];

export interface PaceSpec {
  /** Typewriter speed, characters per second. */
  typeSpeed: number;
  /** A line stays up `holdBase + chars × holdPerChar` seconds after it is fully shown, capped at `holdMax`. */
  holdBase: number;
  holdPerChar: number;
  holdMax: number;
  /** Multiplier for camera looks, waits and the gavel. */
  stepScale: number;
  /** Highlights keep `max(linesPerBeat, ⌈lines / 3⌉)` transcript lines per beat (null keeps all). */
  linesPerBeat: number | null;
}

export const HEARING_PACE: Readonly<Record<HearingPace, PaceSpec>> = {
  standard: { typeSpeed: 60, holdBase: 1.0, holdPerChar: 0.014, holdMax: 2.8, stepScale: 0.7, linesPerBeat: null },
  highlights: { typeSpeed: 60, holdBase: 1.0, holdPerChar: 0.014, holdMax: 2.8, stepScale: 0.6, linesPerBeat: 2 },
  full: { typeSpeed: 48, holdBase: 1.4, holdPerChar: 0.025, holdMax: Infinity, stepScale: 1, linesPerBeat: null },
};

/** Fast-forward speeds the hearing up this many times (dialogue still types out, just quicker). */
export const FAST_FORWARD = 3;

export const DEFAULT_PACE: HearingPace = 'standard';

/** Seconds a fully typed line holds on screen. */
export function holdSeconds(text: string, pace: PaceSpec): number {
  return Math.min(pace.holdMax, pace.holdBase + text.length * pace.holdPerChar);
}

/** Seconds a line is on screen in total (typewriter plus hold). */
export function lineSeconds(text: string, pace: PaceSpec): number {
  return text.length / pace.typeSpeed + holdSeconds(text, pace);
}

/** Seconds a timed step takes at this pace (0 for instant steps). */
export function stepSeconds(step: BeatStep, pace: PaceSpec): number {
  switch (step.kind) {
    case 'say':
      return lineSeconds(step.text, pace);
    case 'wait':
      return step.seconds * pace.stepScale;
    case 'look':
      return (step.seconds ?? 0.8) * pace.stepScale;
    case 'gavel':
      return 0.45 * pace.stepScale;
    default:
      return 0;
  }
}

/** Predicted length of a list of beat scripts, in seconds of hearing time. */
export function estimateSeconds(scripts: readonly (readonly BeatStep[])[], pace: PaceSpec): number {
  let total = 0;
  for (const steps of scripts) for (const s of steps) total += stepSeconds(s, pace);
  return total;
}

/** How many of a beat's `count` transcript lines this pace keeps. */
export function linesKept(count: number, pace: PaceSpec): number {
  return pace.linesPerBeat === null ? count : Math.min(count, Math.max(pace.linesPerBeat, Math.ceil(count / 3)));
}

/**
 * The lines a highlights hearing keeps from one beat: the first line (it sets
 * the scene), then the punchiest remaining ones (objections, exclamations,
 * shouted words, short zingers), in their original order.
 */
export function highlightLines(lines: readonly DialogueLine[], max: number): DialogueLine[] {
  if (lines.length <= max) return [...lines];
  const score = (l: DialogueLine) => {
    let s = 0;
    if (/OBJECTION|ORDER|GUILTY|COOKED|JURY IS OUT/.test(l.text)) s += 3;
    s += Math.min(3, (l.text.match(/!/g) ?? []).length);
    if (/\b[A-Z]{4,}\b/.test(l.text)) s += 1;
    s += Math.max(0, 2 - l.text.length / 80);
    return s;
  };
  const rest = lines
    .slice(1)
    .map((l, i) => ({ l, i: i + 1, s: score(l) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, Math.max(0, max - 1))
    .sort((a, b) => a.i - b.i)
    .map((x) => x.l);
  return [lines[0]!, ...rest];
}

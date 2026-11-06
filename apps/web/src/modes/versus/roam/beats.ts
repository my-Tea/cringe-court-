/**
 * Versus → roaming courtroom. The first-person courtroom (`@cringe-court/scene/roam`)
 * plays a trial as a handful of scripted beats; this file turns a frozen Versus
 * transcript into those beats, so swapping the 2D `TrialView` for the roam view
 * is wiring, not a rewrite.
 *
 * Speakers: the judge is the judge; Agent A argues from the prosecution bench
 * (`prosecutor`) and Agent B from the defence bench (`defense`), whatever the
 * sides call themselves. Jurors never speak in a Versus transcript.
 */
import type { CourtLine, Segment } from '@cringe-court/core';
import type { BeatId, BeatOptions, DialogueLine, VerdictKind } from '@cringe-court/scene/roam';

export interface PlannedBeat {
  id: BeatId;
  options: BeatOptions;
}

/** What the trial view needs from the roam controller (a subset of `RoamController`). */
export interface RoamBeatPort {
  runBeat(id: BeatId, options?: BeatOptions): Promise<void>;
  skipBeat(): void;
}

const BEAT_FOR: Readonly<Record<Segment, BeatId>> = {
  'call-to-order': 'all-rise',
  opening: 'opening',
  exhibit: 'counsel-arguing',
  rebuttal: 'counsel-arguing',
  closing: 'counsel-arguing',
  'jury-out': 'jury-deliberating',
  sentence: 'verdict',
};

export function roamSpeaker(line: Pick<CourtLine, 'speaker' | 'bench'>): string {
  if (line.bench === 0 || line.speaker === 'side-a') return 'prosecutor';
  if (line.bench === 1 || line.speaker === 'side-b') return 'defense';
  return line.speaker;
}

/**
 * The beats for a transcript, in order. Consecutive lines of the same kind of
 * beat are one beat (the opening of both agents plays as one `opening`). The
 * sentence is read by the `verdict` beat itself, so `sentence` lines only feed
 * it when there is a verdict to read.
 */
export function versusBeats(lines: readonly CourtLine[], verdict?: 'a' | 'b' | 'none'): PlannedBeat[] {
  const out: PlannedBeat[] = [];
  for (const line of lines) {
    const id = BEAT_FOR[line.segment];
    if (id === 'verdict') continue;
    const said: DialogueLine = { speaker: roamSpeaker(line), text: line.text };
    const last = out[out.length - 1];
    if (last?.id === id) last.options = { lines: [...(last.options.lines ?? []), said] };
    else out.push({ id, options: { lines: [said] } });
  }
  if (verdict !== undefined) {
    const kind: VerdictKind = verdict === 'a' ? 'side-a' : verdict === 'b' ? 'side-b' : 'mistrial';
    out.push({ id: 'verdict', options: { verdict: kind, verdictText: verdict === 'none' ? 'NO VERDICT' : `SIDE ${verdict.toUpperCase()} WINS` } });
  }
  return out;
}

/**
 * Plays the beats one after another. Resolves `true` when every beat ran,
 * `false` when `signal` aborted (the current beat is skipped so the world lands
 * in its final pose).
 */
export async function playVersusTrial(roam: RoamBeatPort, beats: readonly PlannedBeat[], signal?: AbortSignal): Promise<boolean> {
  const onAbort = () => roam.skipBeat();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    for (const b of beats) {
      if (signal?.aborted) return false;
      await roam.runBeat(b.id, b.options);
    }
    return !signal?.aborted;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

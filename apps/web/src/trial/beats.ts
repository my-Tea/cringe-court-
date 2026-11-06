/**
 * A frozen transcript → roaming-courtroom beats, for any mode. Consecutive
 * lines of the same beat play as one beat; the sentence is read by the
 * `verdict` beat itself. Versus keeps its own copy (`modes/versus/roam/beats`)
 * with side-aware verdict text; this is the shared version.
 */
import type { CourtLine, Segment } from '@cringe-court/core';
import type { BeatId, BeatOptions, DialogueLine, VerdictKind } from '@cringe-court/scene/roam';

export interface PlannedBeat {
  id: BeatId;
  options: BeatOptions;
}

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

const ROAM_SPEAKERS = new Set(['judge', 'prosecutor', 'defense', 'bailiff', 'clerk', 'juror-1', 'juror-2', 'juror-3', 'player', 'narrator']);

/** Bench 0 argues from the prosecution table, bench 1 from the defence; unknown speakers narrate. */
export function roamSpeakerOf(line: Pick<CourtLine, 'speaker' | 'bench'>): string {
  if (line.bench === 0 || line.speaker === 'side-a') return 'prosecutor';
  if (line.bench === 1 || line.speaker === 'side-b') return 'defense';
  return ROAM_SPEAKERS.has(line.speaker) ? line.speaker : 'narrator';
}

export interface PlannedVerdict {
  kind: VerdictKind;
  text: string;
}

export function beatsFromLines(lines: readonly CourtLine[], verdict?: PlannedVerdict): PlannedBeat[] {
  const out: PlannedBeat[] = [];
  for (const line of lines) {
    const id = BEAT_FOR[line.segment] ?? 'counsel-arguing';
    if (id === 'verdict') continue;
    const said: DialogueLine = { speaker: roamSpeakerOf(line), text: line.text };
    const last = out[out.length - 1];
    if (last?.id === id) last.options = { lines: [...(last.options.lines ?? []), said] };
    else out.push({ id, options: { lines: [said] } });
  }
  if (verdict) out.push({ id: 'verdict', options: { verdict: verdict.kind, verdictText: verdict.text } });
  return out;
}

/** Plays beats in order; resolves true when all ran, false when aborted (the current beat is skipped). */
export async function playBeats(roam: RoamBeatPort, beats: readonly PlannedBeat[], signal?: AbortSignal, onBeat?: (index: number) => void): Promise<boolean> {
  const onAbort = () => roam.skipBeat();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    for (let i = 0; i < beats.length; i++) {
      if (signal?.aborted) return false;
      const b = beats[i]!;
      onBeat?.(i);
      await roam.runBeat(b.id, b.options);
    }
    return !signal?.aborted;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

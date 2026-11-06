/**
 * Performance mapping: validated transcript -> core `CourtLine[]`, which the
 * existing engine Director compiles into its typed `Cue` stream (camera,
 * animate, sound, say, fx, card...) for the ScenePort renderer. This module
 * adds no event bus of its own: the AI supplies validated presets, the game
 * decides positions, timings and assets. See docs/ai/09.
 */
import { BASE_MODES, type CameraShot, type CastMember, type CourtLine } from '@cringe-court/core';
import type { CourtCamera, CourtMode, JudgeCommentary, Transcript, TranscriptLine } from './schema';

/**
 * Cast for a court-ai trial. Every mode uses the shared advocates at the two
 * desks plus the judge, clerk, bailiff and jury. (The legacy Versus staging
 * seats `side-a`/`side-b` voices instead; court-ai Versus does not use it.)
 */
export function courtCast(mode: CourtMode): readonly CastMember[] {
  const def = mode === 'solo' ? BASE_MODES.solo : BASE_MODES['grand-jury'];
  return def.staging(def.terms());
}

/**
 * Director timing for court-ai lines (pass as `directTrial(id, lines, cast, courtDirectorOptions())`).
 * The engine default caps every line at 7 s, which suits the short legacy lines
 * but would flash a 250-character court-ai line at ~36 characters/second. This
 * uses the same reading pace the court budgets with (`TrialOptions.charsPerSecond`),
 * so the performed show lasts about `Transcript.estimatedSeconds`.
 */
export function courtDirectorOptions(charsPerSecond = 15): { msPerChar: number; minLineSeconds: number; maxLineSeconds: number } {
  return { msPerChar: Math.round(1000 / charsPerSecond), minLineSeconds: 1.8, maxLineSeconds: 25 };
}

/** Named AI camera presets -> courtroom layout shots. `auto` = speaker-based (counsel by desk). */
export const CAMERA_SHOT: Readonly<Record<Exclude<CourtCamera, 'auto'>, CameraShot>> = {
  wide_courtroom: 'pov_well',
  judge_closeup: 'close_judge',
  prosecution_closeup: 'close_prosecution',
  defense_closeup: 'close_defense',
  clerk_desk: 'close_witness',
  jury_box: 'close_jury',
  gallery: 'pov_gallery',
};

/**
 * Resolve a line's camera. Counsel on `auto` get their own desk's close-up:
 * in Versus/Viral, Miss Ratio may argue ballot option 1, and the Director's
 * bench-based default would otherwise point the camera at the wrong desk.
 */
function shot(line: Pick<TranscriptLine, 'camera' | 'speaker'>): CameraShot | undefined {
  if (line.camera !== 'auto') return CAMERA_SHOT[line.camera];
  if (line.speaker === 'prosecutor') return 'close_prosecution';
  if (line.speaker === 'defense') return 'close_defense';
  return undefined;
}

export function toCourtLine(line: TranscriptLine): CourtLine {
  const out: CourtLine = { id: line.id, speaker: line.speaker, segment: line.segment, text: line.text, emotion: line.emotion };
  if (line.bench !== undefined) out.bench = line.bench;
  if (line.animation !== 'talk') out.beat = line.animation;
  const camera = shot(line);
  if (camera) out.camera = camera;
  if (line.crowd !== 'none') out.crowd = line.crowd;
  return out;
}

/** The trial as the Director consumes it: `directTrial(transcript.caseId, toCourtLines(transcript), cast)`. */
export function toCourtLines(transcript: Transcript): CourtLine[] {
  return transcript.lines.map(toCourtLine);
}

/** Post-verdict lines (segment "sentence") for the Director's verdict ceremony. */
export function commentaryToCourtLines(c: JudgeCommentary): CourtLine[] {
  return c.lines.map((l, i) => {
    const out: CourtLine = { id: `V${String(i + 1).padStart(2, '0')}`, speaker: l.speaker, segment: 'sentence', text: l.text, emotion: l.emotion };
    if (l.animation !== 'talk') out.beat = l.animation;
    const camera = shot({ camera: 'auto', speaker: l.speaker });
    if (camera) out.camera = camera;
    return out;
  });
}

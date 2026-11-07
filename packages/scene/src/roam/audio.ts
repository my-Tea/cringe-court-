/**
 * The roam sound hook. Anything with `play(cue)` works: the core AudioPort
 * (cue ids like "sfx.gavel") plugs in directly; the @cringe-court/audio engine
 * (ids like "gavel_strike") goes through `audioFromEngine`. Feature-detected,
 * never a hard dependency: no audio, no sound, no errors.
 */
import type { AudioCueId } from '@cringe-court/core';

export interface RoamAudio {
  play(cue: AudioCueId, options?: { volume?: number; pan?: number }): unknown;
}

/** Core cue → @cringe-court/audio cue, for the cues roam emits. */
export const ENGINE_CUES: Partial<Record<AudioCueId, string>> = {
  'sfx.gavel': 'gavel_strike',
  'sfx.desk-slam': 'gavel_triple',
  'stinger.objection': 'objection',
  'sfx.crowd-gasp': 'crowd_gasp',
  'sfx.crowd-laugh': 'crowd_laugh',
  'sfx.crowd-murmur': 'crowd_murmur',
  'music.verdict': 'crowd_applause',
  'sfx.door-creak': 'door_creak',
  'sfx.paper': 'paper',
  'sfx.unlock': 'ballot_unlock',
  'stinger.jury-out': 'verdict_decided',
  'stinger.verdict-guilty': 'verdict_guilty',
  'stinger.verdict-not-cooked': 'verdict_not_cooked',
  'stinger.verdict-side': 'verdict_decided',
  'stinger.mistrial': 'verdict_none',
  'ui.click': 'ui_click',
  'ui.notify': 'ui_toast',
  'voice.judge': 'voice_judge',
  'voice.prosecutor': 'voice_prosecutor',
  'voice.defense': 'voice_defense',
  'voice.side-a': 'voice_side_a',
  'voice.side-b': 'voice_side_b',
  'voice.narrator': 'voice_narrator',
  'voice.clerk': 'voice_clerk',
};

interface EngineLike {
  play(cue: string, options?: { intensity?: number; pan?: number }): unknown;
}

export function audioFromEngine(engine: EngineLike, map: Partial<Record<AudioCueId, string>> = ENGINE_CUES): RoamAudio {
  return {
    play(cue, options) {
      const id = map[cue];
      if (!id) return null;
      return engine.play(id, { ...(options?.volume !== undefined ? { intensity: options.volume } : {}), ...(options?.pan !== undefined ? { pan: options.pan } : {}) });
    },
  };
}

/** Accept whatever the host passes; anything without a callable `play` is ignored. */
export function detectAudio(candidate: unknown): RoamAudio | null {
  if (!candidate || typeof (candidate as { play?: unknown }).play !== 'function') return null;
  const c = candidate as RoamAudio & { id?: unknown };
  // The engine package exposes snake_case cues; the core port has an `id` and dotted cues.
  if (typeof c.id === 'string') return c;
  return audioFromEngine(candidate as EngineLike);
}

/**
 * Solo sound: the procedural Web Audio engine from @cringe-court/audio, behind
 * core's AudioPort (for transcript cues) plus its case-event API (jury and
 * verdict moments). Nothing is created or played before a user gesture, and
 * the engine honours its own mute / reduce-sound settings (`cc:audio`).
 */
import type { AudioCueId, AudioPort } from '@cringe-court/core';
import { createAudioEngine, isCueId, type AudioEngine, type CaseAudioEvent, type CueId } from '@cringe-court/audio';
import { AUDIO_CUE_MAP } from '@/stage/audioCues';

/** Core cue vocabulary → the audio engine's recipes: the shared map from the stage layer (v3/p4-core). Nulls stay silent. */
export const CUE_MAP: Readonly<Partial<Record<AudioCueId, CueId>>> = Object.fromEntries(
  Object.entries(AUDIO_CUE_MAP).filter((e): e is [AudioCueId, CueId] => e[1] !== null && isCueId(e[1])),
);

let engine: AudioEngine | null = null;

export function soundEngine(): AudioEngine {
  engine ??= createAudioEngine();
  return engine;
}

/** True once the user turned sound on in this tab (the engine is unlocked and not muted). */
export function soundOn(): boolean {
  const s = engine?.getSnapshot();
  return Boolean(s && s.state === 'running' && !s.settings.muted);
}

export async function setSound(on: boolean): Promise<boolean> {
  const e = soundEngine();
  if (on) {
    e.setMuted(false);
    return e.unlock();
  }
  e.setMuted(true);
  return false;
}

/** Fire a case moment (seat, seal, reveal, verdict). No-op until sound is on. */
export function caseSound(event: CaseAudioEvent): void {
  if (soundOn()) soundEngine().handle(event);
}

const noop = { stop: () => {} };

/** core AudioPort over the engine, for transcript cues. */
export const soloAudioPort: AudioPort = {
  id: 'web-audio',
  unlock: async () => {
    await soundEngine().unlock();
  },
  play(cue, options) {
    const id = CUE_MAP[cue];
    if (!id || !soundOn()) return noop;
    const h = soundEngine().play(id, options?.pan !== undefined ? { pan: options.pan } : {});
    return { stop: (fade?: number) => h?.stop(fade) };
  },
  loop: () => noop,
  setVolume: () => {},
  setMuted: (muted) => soundEngine().setMuted(muted),
  stopAll: () => soundEngine().stopAll(),
};

/**
 * Solo sound: the procedural Web Audio engine from @cringe-court/audio, behind
 * core's AudioPort (for transcript cues) plus its case-event API (jury and
 * verdict moments). Nothing is created or played before a user gesture, and
 * the engine honours its own mute / reduce-sound settings (`cc:audio`).
 */
import type { AudioCueId, AudioPort } from '@cringe-court/core';
import { createAudioEngine, type AudioEngine, type CaseAudioEvent, type CueId } from '@cringe-court/audio';

/** Core cue vocabulary → the audio engine's procedural recipes. Unmapped cues (voices, music) stay silent. */
export const CUE_MAP: Readonly<Partial<Record<AudioCueId, CueId>>> = {
  'sfx.gavel': 'gavel_strike',
  'sfx.stamp': 'stamp',
  'sfx.coin': 'coin',
  'sfx.paper': 'paper',
  'sfx.unlock': 'ballot_unlock',
  'sfx.door-creak': 'door_creak',
  'sfx.desk-slam': 'gavel_triple',
  'sfx.impact': 'stamp',
  'sfx.crowd-gasp': 'crowd_gasp',
  'sfx.crowd-laugh': 'crowd_laugh',
  'sfx.crowd-murmur': 'crowd_murmur',
  'sfx.ballot-drop': 'ballot_seal',
  'sfx.box-shut': 'ballot_seal',
  'sfx.seal-break': 'ballot_unlock',
  'stinger.objection': 'objection',
  'stinger.case-open': 'gavel_triple',
  'stinger.jury-out': 'crowd_murmur',
  'stinger.verdict-guilty': 'verdict_guilty',
  'stinger.verdict-not-cooked': 'verdict_not_cooked',
  'stinger.mistrial': 'verdict_none',
  'ui.click': 'ui_click',
  'ui.toggle': 'ui_toggle',
  'ui.success': 'ui_confirm',
  'ui.error': 'ui_error',
  'ui.notify': 'ui_toast',
};

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

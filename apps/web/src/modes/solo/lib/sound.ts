/**
 * Solo sound: the procedural Web Audio engine from @cringe-court/audio, behind
 * core's AudioPort (for transcript cues) plus its case-event API (jury and
 * verdict moments). Nothing is created or played before a user gesture, and
 * the engine honours its own mute / reduce-sound settings (`cc:audio`).
 */
import type { AudioPort } from '@cringe-court/core';
import type { AudioEngine, CaseAudioEvent, CourtPhase } from '@cringe-court/audio';
import type { TrialState } from '@cringe-court/core';
import { appAudio, appAudioPort, caseCue } from '@/platform/audio';

export { CUE_MAP } from '@/platform/audio';

/** The app-wide shared engine (see platform/audio.ts); solo no longer owns one. */
export function soundEngine(): AudioEngine {
  return appAudio();
}

/** True once the user turned sound on in this tab (the engine is unlocked and not muted). */
export function soundOn(): boolean {
  const s = appAudio().getSnapshot();
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

/** Fire a case moment (seat, seal, reveal, verdict) through the shared engine. Silent until sound is on. */
export function caseSound(event: CaseAudioEvent): void {
  caseCue(event);
}

/** core AudioPort over the shared engine, for transcript cues. */
export const soloAudioPort: AudioPort = appAudioPort;

/** Solo trial state → the audio package's court phase (drives the ambience bed). Null before the case is paid. */
export function soloPhase(t: Pick<TrialState, 'stage'> & { step?: string }): CourtPhase | null {
  switch (t.stage) {
    case 'jury':
      return t.step === 'recruiting' ? 'recruiting' : t.step === 'briefing' ? 'preparing' : t.step === 'commit' ? 'commit' : t.step === 'reveal' ? 'reveal' : 'finalizing';
    case 'verdict':
    case 'appeal':
    case 'share':
      return 'settled';
    case 'closed':
      return 'cancelled';
    default:
      return null;
  }
}

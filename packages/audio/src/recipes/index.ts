import type { CueId } from '../cues.ts';
import type { Synth } from '../dsp.ts';
import { crowdApplause, crowdGasp, crowdLaugh, crowdMurmur } from './crowd.ts';
import {
  ballotSeal,
  ballotUnlock,
  coin,
  doorCreak,
  paper,
  stamp,
  timerExpired,
  timerTick,
  timerWarning,
  voteTick,
} from './foley.ts';
import { gavelHit } from './instruments.ts';
import { objection, verdictDecided, verdictGuilty, verdictNone, verdictNotCooked } from './stings.ts';
import { uiClick, uiConfirm, uiError, uiHover, uiToast, uiToggle } from './ui.ts';
import { voiceClerk, voiceDefense, voiceJudge, voiceNarrator, voiceProsecutor, voiceSideA, voiceSideB } from './voice.ts';

/**
 * A recipe draws one cue into `s.out`, starting at context time `t`.
 * `intensity` is 0..1 (1 = full performance); `step` is a cue-specific index
 * (vote number, toggle direction) and is 0 when not given.
 */
export type Recipe = (s: Synth, t: number, intensity: number, step: number) => void;

export const RECIPES: Readonly<Record<CueId, Recipe>> = {
  gavel_strike: (s, t, i) => gavelHit(s, t, 0.45 + 0.55 * i, s.rng.jitter(0.035)),
  gavel_triple: (s, t, i) => {
    const lv = 0.45 + 0.55 * i;
    gavelHit(s, t, lv * 0.72, s.rng.jitter(0.03));
    gavelHit(s, t + 0.33 * s.rng.jitter(0.04), lv * 0.8, s.rng.jitter(0.03));
    gavelHit(s, t + 0.68 * s.rng.jitter(0.03), lv, 0.97);
  },
  objection,
  crowd_murmur: crowdMurmur,
  crowd_laugh: crowdLaugh,
  crowd_gasp: crowdGasp,
  crowd_applause: crowdApplause,
  verdict_guilty: verdictGuilty,
  verdict_not_cooked: verdictNotCooked,
  verdict_decided: verdictDecided,
  verdict_none: verdictNone,
  vote_tick: voteTick,
  ballot_seal: ballotSeal,
  ballot_unlock: ballotUnlock,
  timer_warning: timerWarning,
  timer_tick: timerTick,
  timer_expired: timerExpired,
  stamp,
  paper,
  coin,
  door_creak: doorCreak,
  ui_click: uiClick,
  ui_hover: uiHover,
  ui_toggle: uiToggle,
  ui_toast: uiToast,
  ui_confirm: uiConfirm,
  ui_error: uiError,
  voice_judge: voiceJudge,
  voice_prosecutor: voiceProsecutor,
  voice_defense: voiceDefense,
  voice_side_a: voiceSideA,
  voice_side_b: voiceSideB,
  voice_narrator: voiceNarrator,
  voice_clerk: voiceClerk,
};

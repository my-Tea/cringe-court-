/**
 * Wordless character babble under dialogue lines. Distinct pitch / rate / pan
 * per speaker so Miss Ratio, Counsel Chaos and the Judge read apart.
 *
 * Dense, loud syllables — meant to ride under the typewriter so speech feels
 * present, not sparse or chopped.
 */
import type { Synth } from '../dsp.ts';
import { speak, voiceRig } from './crowd.ts';

interface VoiceProfile {
  f0: number;
  rate: number;
  pan: number;
  breath: number;
  /** Base length of one babble chunk (seconds). */
  seconds: number;
  level: number;
}

const PROFILES: Readonly<Record<string, VoiceProfile>> = {
  voice_judge: { f0: 98, rate: 3.8, pan: 0, breath: 0.28, seconds: 1.35, level: 1.45 },
  voice_prosecutor: { f0: 215, rate: 5.6, pan: -0.55, breath: 0.22, seconds: 1.2, level: 1.4 },
  voice_defense: { f0: 148, rate: 4.8, pan: 0.55, breath: 0.32, seconds: 1.25, level: 1.4 },
  voice_side_a: { f0: 200, rate: 5.0, pan: -0.5, breath: 0.24, seconds: 1.15, level: 1.35 },
  voice_side_b: { f0: 155, rate: 4.6, pan: 0.5, breath: 0.3, seconds: 1.15, level: 1.35 },
  voice_narrator: { f0: 175, rate: 4.2, pan: -0.15, breath: 0.35, seconds: 1.1, level: 1.25 },
  voice_clerk: { f0: 185, rate: 4.4, pan: 0.2, breath: 0.26, seconds: 1.05, level: 1.3 },
};

function babble(id: keyof typeof PROFILES) {
  return (s: Synth, t: number, intensity: number): void => {
    const p = PROFILES[id]!;
    const level = p.level * (0.85 + 0.4 * intensity);
    // Keep wall-clock length inside CueSpec.duration (recipes test ±0.01).
    const dur = p.seconds;
    const end = t + dur;
    // Mild high cut so phones still hear the formants.
    const dest = s.filter('lowpass', 6200, 0.55, s.out);
    const f0 = p.f0 * s.rng.jitter(0.02);
    const rig = voiceRig(s, t, end, f0, p.pan, dest, p.breath);
    // Strong opening syllable — immediate presence under the first typed words.
    const first = Math.min(0.18, dur * 0.22);
    const shift = f0 > 160 ? 1.12 : 1;
    rig.formants[0].frequency.setValueAtTime(720 * shift, t);
    rig.formants[1].frequency.setValueAtTime(1450 * shift, t);
    rig.formants[2].frequency.setValueAtTime(2550 * shift, t);
    rig.osc.frequency.setValueAtTime(f0, t);
    rig.amp.gain.setValueAtTime(0, t);
    rig.amp.gain.linearRampToValueAtTime(level, t + 0.012);
    rig.amp.gain.linearRampToValueAtTime(level * 0.75, t + first * 0.7);
    rig.amp.gain.linearRampToValueAtTime(0, t + first);
    const rest = t + first + 0.02;
    if (rest < end - 0.1) {
      // Dense syllables (high rate, almost no phrase gaps) so it reads as talking.
      speak(s, rig, rest, end, f0, level * 0.95, p.rate * s.rng.jitter(0.04), 0.04);
    }
    s.end = Math.max(s.end, end);
  };
}

export const voiceJudge = babble('voice_judge');
export const voiceProsecutor = babble('voice_prosecutor');
export const voiceDefense = babble('voice_defense');
export const voiceSideA = babble('voice_side_a');
export const voiceSideB = babble('voice_side_b');
export const voiceNarrator = babble('voice_narrator');
export const voiceClerk = babble('voice_clerk');

/**
 * Reusable instruments built from the Synth primitives. Recipes compose these;
 * keeping the gavel, brass and mallets in one place is what makes the stings,
 * the UI and the ambience sound like the same room.
 */
import { EPS, mtof, type Synth } from '../dsp.ts';

/** Hardwood gavel on a sound block. `level` 0..1, `pitch` ≈ 1. */
export function gavelHit(s: Synth, t: number, level: number, pitch = 1, dest: AudioNode = s.out): void {
  // Contact crack, then the block's ring, then the desk's low knock.
  s.burst(t, 0.75 * level, 0.012, 'highpass', 2600, 0.7, 'white', dest);
  s.burst(t, 0.5 * level, 0.045, 'bandpass', 1250 * pitch, 2.2, 'white', dest);
  s.modal(
    t,
    410 * pitch,
    [
      { ratio: 1, amp: 0.55, decay: 0.17 },
      { ratio: 2.27, amp: 0.34, decay: 0.1 },
      { ratio: 3.86, amp: 0.2, decay: 0.06 },
      { ratio: 5.53, amp: 0.1, decay: 0.035 },
    ],
    level,
    dest,
  );
  s.thump(t, 185 * pitch, 82 * pitch, 0.85 * level, 0.24, dest);
}

/**
 * A brass section note: detuned saws through a lowpass whose cutoff follows the
 * amplitude (brighter when louder, like real brass), with a small pitch scoop.
 */
export function brass(
  s: Synth,
  t: number,
  midi: number,
  dur: number,
  level: number,
  dest: AudioNode = s.out,
  opts: { attack?: number; bright?: number; release?: number } = {},
): void {
  const attack = opts.attack ?? 0.035;
  const bright = opts.bright ?? 1;
  const release = opts.release ?? 0.16;
  const f = mtof(midi);
  const end = t + dur + release;
  const amp = s.gain(0, dest);
  s.line(amp.gain, [
    [t, 0],
    [t + attack, level],
    [t + attack + 0.08, level * 0.72],
    [t + dur, level * 0.62],
    [end, 0],
  ]);
  const lp = s.filter('lowpass', f * 1.5, 1.6, amp);
  s.curve(lp.frequency, [
    [t, f * 1.3],
    [t + attack, Math.min(16000, f * 9 * bright)],
    [t + attack + 0.12, Math.min(14000, f * 4.5 * bright)],
    [t + dur, Math.min(12000, f * 3 * bright)],
    [end, f * 1.2],
  ]);
  const drive = s.drive(1.8, lp);
  const mix = s.gain(0.32, drive);
  for (const cents of [-7, 0, 6]) {
    const o = s.osc('sawtooth', f, t, end + 0.02, mix);
    o.detune.setValueAtTime(cents - 35, t);
    o.detune.linearRampToValueAtTime(cents, t + attack * 1.4);
  }
  const sub = s.osc('square', f / 2, t, end + 0.02, s.gain(0.08, lp));
  sub.detune.value = 3;
}

/** Timpani: a pitched membrane hit with its slightly inharmonic overtones. */
export function timpani(s: Synth, t: number, midi: number, level: number, dest: AudioNode = s.out, decay = 1.1): void {
  const f = mtof(midi);
  s.thump(t, f * 1.6, f, level, decay * 0.7, dest);
  s.modal(
    t,
    f,
    [
      { ratio: 1, amp: 0.5, decay },
      { ratio: 1.5, amp: 0.3, decay: decay * 0.7 },
      { ratio: 1.98, amp: 0.18, decay: decay * 0.5 },
      { ratio: 2.44, amp: 0.1, decay: decay * 0.35 },
    ],
    level,
    dest,
  );
  s.burst(t, 0.4 * level, 0.09, 'lowpass', 900, 0.7, 'pink', dest);
}

/** Rolled timpani: fast, decaying repeated strokes. */
export function timpaniRoll(s: Synth, t: number, midi: number, dur: number, level: number, dest: AudioNode = s.out): void {
  const strokes = Math.floor(dur / 0.055);
  for (let i = 0; i < strokes; i++) {
    const k = i / strokes;
    const v = level * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, k * 1.3))) * s.rng.jitter(0.15);
    timpani(s, t + i * 0.055 + s.rng.range(0, 0.008), midi, v * 0.45, dest, 0.5);
  }
}

/** Rosewood marimba bar: fundamental plus the tuned 4th and 10th partials. */
export function marimba(s: Synth, t: number, midi: number, level: number, dest: AudioNode = s.out): void {
  const f = mtof(midi);
  s.modal(
    t,
    f,
    [
      { ratio: 1, amp: 0.7, decay: 0.42 },
      { ratio: 3.93, amp: 0.22, decay: 0.09 },
      { ratio: 9.24, amp: 0.06, decay: 0.03 },
    ],
    level,
    dest,
  );
  s.burst(t, 0.12 * level, 0.008, 'bandpass', Math.min(9000, f * 6), 1.2, 'white', dest);
}

/** A small metallic tick: latches, keys, clock escapements. */
export function metalTick(s: Synth, t: number, freq: number, level: number, dest: AudioNode = s.out): void {
  s.modal(
    t,
    freq,
    [
      { ratio: 1, amp: 0.5, decay: 0.045 },
      { ratio: 1.47, amp: 0.35, decay: 0.03 },
      { ratio: 2.09, amp: 0.25, decay: 0.02 },
    ],
    level,
    dest,
  );
  s.burst(t, 0.5 * level, 0.004, 'highpass', 5000, 0.7, 'white', dest);
}

/** Warm sustained chord: detuned saws through a gentle lowpass. */
export function pad(
  s: Synth,
  t: number,
  notes: readonly number[],
  dur: number,
  level: number,
  dest: AudioNode = s.out,
  cutoff = 1400,
  attack = 0.3,
): void {
  const end = t + dur;
  const amp = s.gain(0, dest);
  s.line(amp.gain, [
    [t, 0],
    [t + attack, level],
    [end - Math.min(0.8, dur * 0.45), level * 0.8],
    [end, 0],
  ]);
  const lp = s.filter('lowpass', cutoff, 0.8, amp);
  const each = s.gain(1 / Math.max(1, notes.length * 2), lp);
  for (const n of notes) {
    for (const cents of [-9, 8]) {
      const o = s.osc('sawtooth', mtof(n), t, end + 0.01, each);
      o.detune.value = cents;
    }
  }
}

/** Gentle exponential fade-in-and-out of a param over [t0, t1]. */
export function swell(s: Synth, param: AudioParam, t0: number, peakAt: number, t1: number, peak: number): void {
  param.setValueAtTime(EPS, t0);
  param.exponentialRampToValueAtTime(Math.max(EPS, peak), peakAt);
  param.exponentialRampToValueAtTime(EPS, t1);
  param.setValueAtTime(0, t1 + 0.001);
  s.end = Math.max(s.end, t1 + 0.002);
}

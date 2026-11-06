/**
 * Dramatic moments: OBJECTION! and the four verdict stings. Each verdict starts
 * with the gavel on beat zero so it lines up with the `gavel_strike` step of
 * the matching animation in `cc-art/dist/animation/animations.json`.
 */
import { mtof, type Synth } from '../dsp.ts';
import { brass, gavelHit, marimba, pad, swell, timpani, timpaniRoll } from './instruments.ts';

export function objection(s: Synth, t: number, intensity: number): void {
  const lv = 0.55 + 0.45 * intensity;
  const hit = t + 0.13;
  // Whoosh: noise through a rising bandpass, cut off by the hit.
  const wg = s.gain(0);
  s.line(wg.gain, [
    [t, 0],
    [hit - 0.01, 0.55 * lv],
    [hit + 0.02, 0],
  ]);
  const bp = s.filter('bandpass', 400, 1.4, wg);
  s.curve(bp.frequency, [
    [t, 350],
    [hit, 4200],
  ]);
  s.noiseSource('pink', t, hit + 0.03, bp);
  // Body hit and slap.
  s.thump(hit, 150, 44, 1.0 * lv, 0.36);
  s.burst(hit, 0.6 * lv, 0.03, 'highpass', 2800, 0.7);
  s.burst(hit, 0.45 * lv, 0.16, 'bandpass', 1700, 0.9, 'pink');
  // Brass stab: A minor with a flat ninth on top — alarmed, not tragic.
  const stab = s.gain(0.34 * lv);
  for (const n of [45, 57, 60, 64, 70]) brass(s, hit, n, 0.3, 0.42, stab, { attack: 0.012, bright: 1.25, release: 0.32 });
}

export function verdictGuilty(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  gavelHit(s, t, lv);
  const section = s.gain(0.3 * lv);
  // "dun — dun — DUNNN": two short stabs on a bare fifth, then a long chord
  // with a minor second and a tritone in it (cartoon dread).
  const d1 = t + 0.3;
  const d2 = t + 0.56;
  const d3 = t + 0.84;
  timpani(s, d1, 38, 0.75 * lv);
  for (const n of [50, 57]) brass(s, d1, n, 0.14, 0.5, section, { attack: 0.015, release: 0.12 });
  timpani(s, d2, 38, 0.75 * lv);
  for (const n of [50, 57]) brass(s, d2, n, 0.14, 0.5, section, { attack: 0.015, release: 0.12 });
  timpani(s, d3, 37, 1 * lv, s.out, 1.6);
  for (const n of [37, 49, 51, 56]) brass(s, d3, n, 1.35, 0.55, section, { attack: 0.05, bright: 0.85, release: 0.55 });
  timpaniRoll(s, d3 + 0.25, 37, 1.1, 0.6 * lv);
  // Low strings underneath, swelling into the long chord.
  pad(s, d1, [37, 44, 49], 2.3, 0.2 * lv, s.out, 520, 0.5);
}

export function verdictNotCooked(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  gavelHit(s, t, lv * 0.9);
  const go = t + 0.26;
  // Cymbal swell into the chord.
  const cym = s.gain(0);
  swell(s, cym.gain, t + 0.02, go + 0.05, go + 2.2, 0.16 * lv);
  s.noiseSource('white', t + 0.02, go + 2.2, s.filter('highpass', 6500, 0.7, cym));
  // Rising bell arpeggio (C major, add 9) and a warm chord.
  const bells = s.gain(0.5 * lv);
  [72, 76, 79, 84, 86, 88].forEach((n, i) => s.bell(go + i * 0.075, mtof(n), 0.32, 1.3 - i * 0.08, bells, 2, 1.4));
  for (const n of [60, 64, 67]) brass(s, go, n, 0.5, 0.32, s.gain(0.3 * lv), { attack: 0.02, bright: 1.1, release: 0.4 });
  pad(s, go, [48, 55, 60, 64, 67], 2.5, 0.28 * lv, s.out, 1800, 0.25);
  timpani(s, go, 36, 0.7 * lv, s.out, 1.4);
  // Sparkles drifting down out of the chord.
  const sparkle = s.gain(0.22 * lv);
  for (let i = 0; i < 6; i++) {
    const n = 84 + [0, 2, 4, 7, 9, 12][s.rng.int(0, 5)]!;
    s.bell(go + 0.55 + i * s.rng.range(0.14, 0.24), mtof(n), 0.35, 0.7, sparkle, 3.01, 0.9);
  }
}

export function verdictDecided(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  gavelHit(s, t, lv);
  // Plagal cadence (IV → I): ceremonial, without taking a side.
  const section = s.gain(0.28 * lv);
  const c1 = t + 0.3;
  const c2 = t + 0.95;
  timpani(s, c1, 41, 0.6 * lv);
  for (const n of [53, 57, 60, 65]) brass(s, c1, n, 0.48, 0.48, section, { attack: 0.03, release: 0.2 });
  timpani(s, c2, 36, 0.8 * lv, s.out, 1.5);
  for (const n of [48, 55, 60, 64, 67]) brass(s, c2, n, 1.2, 0.5, section, { attack: 0.04, bright: 0.95, release: 0.6 });
  marimba(s, c2, 84, 0.25 * lv);
  marimba(s, c2 + 0.09, 88, 0.2 * lv);
  marimba(s, c2 + 0.18, 91, 0.18 * lv);
}

/** The deflating "wah — wah — wah — waaah" of a hung jury. */
export function verdictNone(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  gavelHit(s, t, 0.5 * lv, 0.93);
  const notes = [55, 54, 53, 52];
  const starts = [0.3, 0.62, 0.94, 1.26];
  const out = s.gain(0.42 * lv);
  notes.forEach((n, i) => {
    const t0 = t + (starts[i] ?? 0);
    const last = i === notes.length - 1;
    const dur = last ? 0.95 : 0.26;
    const f = mtof(n);
    const amp = s.gain(0, out);
    s.line(amp.gain, [
      [t0, 0],
      [t0 + 0.04, 0.9],
      [t0 + dur * 0.8, 0.7],
      [t0 + dur, 0],
    ]);
    // Plunger mute: a lowpass that opens and closes on each note ("wah").
    const wah = s.filter('lowpass', 400, 4, amp);
    s.curve(wah.frequency, [
      [t0, 350],
      [t0 + Math.min(0.12, dur * 0.4), 1500],
      [t0 + dur, 420],
    ]);
    const src = s.gain(0.4, s.drive(1.4, wah));
    for (const cents of [-6, 5]) {
      const o = s.osc('sawtooth', f, t0, t0 + dur + 0.02, src);
      o.detune.value = cents;
      if (last) {
        // Sagging vibrato on the final note.
        const depth = s.gain(0, o.detune);
        s.osc('sine', 5.2, t0 + 0.25, t0 + dur, depth);
        s.line(depth.gain, [
          [t0 + 0.25, 0],
          [t0 + dur, 38],
        ]);
        o.frequency.setValueAtTime(f, t0 + 0.3);
        o.frequency.linearRampToValueAtTime(f * 0.94, t0 + dur);
      }
    }
  });
}

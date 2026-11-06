/** Objects in the room: stamps, paper, coins, the door, the ballot box, the clock. */
import { mtof, pentatonic, type Synth } from '../dsp.ts';
import { marimba, metalTick, swell } from './instruments.ts';

export function stamp(s: Synth, t: number, intensity: number): void {
  const lv = 0.55 + 0.45 * intensity;
  s.thump(t, 125 * s.rng.jitter(0.05), 52, 0.95 * lv, 0.17);
  s.burst(t, 0.55 * lv, 0.06, 'lowpass', 1200, 0.8, 'pink'); // rubber body
  s.burst(t + 0.002, 0.42 * lv, 0.022, 'bandpass', 2600, 1.1); // paper slap
  s.burst(t + 0.14, 0.08 * lv, 0.012, 'highpass', 3500); // lift off the page
}

/** Rustle: a cloud of tiny crinkles over a soft body of filtered noise. */
export function paper(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  const dur = 0.45 * s.rng.jitter(0.1);
  const body = s.gain(0);
  s.line(body.gain, [
    [t, 0],
    [t + dur * 0.3, 0.16 * lv],
    [t + dur, 0],
  ]);
  s.noiseSource('white', t, t + dur + 0.01, s.filter('bandpass', 3200, 0.6, body));
  const grains = s.rng.int(16, 24);
  for (let i = 0; i < grains; i++) {
    const at = t + Math.pow(s.rng.next(), 1.3) * dur;
    const hump = Math.sin(Math.PI * ((at - t) / dur));
    s.burst(at, s.rng.range(0.15, 0.5) * lv * (0.3 + 0.7 * hump), s.rng.range(0.006, 0.03), 'bandpass', s.rng.range(1600, 5500), s.rng.range(0.8, 1.8));
  }
}

const COIN = [
  { ratio: 1, amp: 0.5, decay: 0.85 },
  { ratio: 2.16, amp: 0.36, decay: 0.6 },
  { ratio: 3.42, amp: 0.22, decay: 0.38 },
  { ratio: 5.05, amp: 0.12, decay: 0.2 },
];

export function coin(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  const f = 2350 * s.rng.jitter(0.03);
  // First contact, then two bounces.
  [
    [0, 0.8],
    [0.085, 0.42],
    [0.135, 0.18],
  ].forEach(([dt = 0, v = 0]) => {
    s.modal(t + dt, f * s.rng.jitter(0.006), COIN, v * lv);
    s.burst(t + dt, 0.3 * v * lv, 0.003, 'highpass', 6000);
  });
}

/** Stick-slip friction in the hinge: an irregular pulse train through wood resonances. */
export function doorCreak(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  const dur = 1.25;
  const out = s.gain(0);
  s.line(out.gain, [
    [t, 0],
    [t + 0.12, 0.85 * lv],
    [t + dur * 0.6, 0.7 * lv],
    [t + dur, 0],
  ]);
  const res = s.gain(1, null);
  [
    [470, 14, 1],
    [1080, 16, 0.6],
    [2350, 18, 0.35],
  ].forEach(([f = 0, q = 1, g = 1]) => res.connect(s.filter('bandpass', f, q, s.gain(g * 4, out))));
  const pulse = s.osc('sawtooth', 30, t, t + dur + 0.02, res);
  let at = t;
  let rate = 30;
  pulse.frequency.setValueAtTime(rate, t);
  while (at < t + dur) {
    at += s.rng.range(0.06, 0.16);
    rate = Math.max(18, Math.min(95, rate + s.rng.range(-18, 24)));
    pulse.frequency.linearRampToValueAtTime(rate, at);
  }
  // The weight of the door moving air.
  const air = s.gain(0);
  swell(s, air.gain, t, t + 0.5, t + dur + 0.2, 0.12 * lv);
  s.noiseSource('brown', t, t + dur + 0.2, s.filter('lowpass', 380, 0.7, air));
  // It comes to rest against the stop.
  const settle = t + dur + 0.08;
  s.thump(settle, 95, 52, 0.55 * lv, 0.2);
  s.modal(settle, 190, [
    { ratio: 1, amp: 0.4, decay: 0.18 },
    { ratio: 2.4, amp: 0.2, decay: 0.08 },
  ], 0.5 * lv);
}

/** Commit: the folded scroll slides in, the lid drops, the latch catches. */
export function ballotSeal(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  const slide = s.gain(0);
  s.line(slide.gain, [
    [t, 0],
    [t + 0.12, 0.32 * lv],
    [t + 0.26, 0],
  ]);
  const bp = s.filter('bandpass', 1800, 0.9, slide);
  s.curve(bp.frequency, [
    [t, 1700],
    [t + 0.26, 3600],
  ]);
  s.noiseSource('white', t, t + 0.27, bp);
  const lid = t + 0.3;
  s.thump(lid, 165, 72, 0.8 * lv, 0.18);
  s.modal(lid, 255, [
    { ratio: 1, amp: 0.45, decay: 0.12 },
    { ratio: 2.62, amp: 0.25, decay: 0.07 },
    { ratio: 4.1, amp: 0.12, decay: 0.04 },
  ], 0.7 * lv);
  metalTick(s, t + 0.47, 3100, 0.38 * lv);
  metalTick(s, t + 0.515, 2500, 0.3 * lv);
}

/** Reveal: a key turns twice, the hasp opens, a small chime as the scroll unrolls. */
export function ballotUnlock(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  metalTick(s, t, 2700, 0.35 * lv);
  metalTick(s, t + 0.09, 3300, 0.32 * lv);
  s.thump(t + 0.22, 230, 120, 0.4 * lv, 0.1);
  metalTick(s, t + 0.22, 1750, 0.42 * lv);
  const chime = s.gain(0.5 * lv);
  s.bell(t + 0.34, mtof(84), 0.28, 0.8, chime, 2, 1.1);
  s.bell(t + 0.42, mtof(91), 0.22, 0.7, chime, 2, 1.1);
  const shimmer = s.gain(0);
  swell(s, shimmer.gain, t + 0.3, t + 0.45, t + 1.0, 0.05 * lv);
  s.noiseSource('white', t + 0.3, t + 1.0, s.filter('highpass', 7500, 0.7, shimmer));
}

/** Counting votes climbs a pentatonic scale from C5. */
export function voteTick(s: Synth, t: number, intensity: number, step: number): void {
  const n = Math.min(96, 72 + pentatonic(step));
  marimba(s, t, n, (0.6 + 0.4 * intensity) * s.rng.jitter(0.05));
}

export function timerWarning(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  [
    [0, 81],
    [0.2, 84],
  ].forEach(([dt = 0, n = 0]) => {
    const at = t + dt;
    const g = s.gain(0);
    const end = s.perc(g.gain, at, 0.4 * lv, 0.008, 0.26);
    s.osc('triangle', mtof(n), at, end, g);
    s.osc('sine', mtof(n - 12), at, end, s.gain(0.5, g));
  });
}

/** An escapement tick: brighter and higher as `intensity` rises toward zero hour. */
export function timerTick(s: Synth, t: number, intensity: number): void {
  const f = 1500 * (1 + 0.35 * intensity);
  s.modal(t, f, [
    { ratio: 1, amp: 0.5, decay: 0.05 },
    { ratio: 2.71, amp: 0.25, decay: 0.025 },
  ], 0.7);
  s.burst(t, 0.35 + 0.3 * intensity, 0.005, 'highpass', 4000);
  if (intensity > 0.5) s.thump(t, 140, 90, 0.3 * intensity, 0.06);
}

export function timerExpired(s: Synth, t: number, intensity: number): void {
  const lv = 0.6 + 0.4 * intensity;
  const buzz = s.gain(0);
  s.line(buzz.gain, [
    [t, 0],
    [t + 0.015, 0.22 * lv],
    [t + 0.5, 0.18 * lv],
    [t + 0.6, 0],
  ]);
  const lp = s.filter('lowpass', 900, 1.2, buzz);
  s.osc('square', 110, t, t + 0.62, lp);
  s.osc('square', 116.5, t, t + 0.62, lp);
  s.bell(t, mtof(81), 0.3 * lv, 1.15, s.out, 3.5, 2.5);
}

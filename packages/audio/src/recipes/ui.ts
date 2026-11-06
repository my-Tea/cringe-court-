/** Interface sounds: short, soft, and tuned to the same C-major world as the stings. */
import { mtof, type Synth } from '../dsp.ts';
import { marimba } from './instruments.ts';

function blip(s: Synth, t: number, from: number, to: number, level: number, decay: number): void {
  const g = s.gain(0);
  const end = s.perc(g.gain, t, level, 0.0015, decay);
  const o = s.osc('sine', from, t, end, g);
  s.curve(o.frequency, [
    [t, from],
    [t + Math.min(0.02, decay), to],
  ]);
}

export function uiClick(s: Synth, t: number, intensity: number): void {
  const p = s.rng.jitter(0.03);
  blip(s, t, 1500 * p, 760 * p, 0.6 + 0.3 * intensity, 0.035);
  s.burst(t, 0.18, 0.005, 'highpass', 4200);
}

export function uiHover(s: Synth, t: number): void {
  blip(s, t, 3300 * s.rng.jitter(0.02), 3000, 0.5, 0.022);
}

/** `step` 1 = switched on (rising pair), 0 = off (falling pair). */
export function uiToggle(s: Synth, t: number, _intensity: number, step: number): void {
  const [a, b] = step > 0 ? [880, 1320] : [1320, 880];
  blip(s, t, a * 1.2, a, 0.55, 0.03);
  blip(s, t + 0.05, b * 1.2, b, 0.55, 0.035);
}

export function uiToast(s: Synth, t: number): void {
  s.bell(t, mtof(79), 0.4, 0.55, s.out, 2, 1.1);
  s.bell(t + 0.09, mtof(86), 0.32, 0.6, s.out, 2, 1.1);
}

export function uiConfirm(s: Synth, t: number, intensity: number): void {
  const lv = 0.55 + 0.35 * intensity;
  [72, 76, 79].forEach((n, i) => marimba(s, t + i * 0.07, n, lv * (0.8 + 0.1 * i)));
}

export function uiError(s: Synth, t: number): void {
  const lp = s.filter('lowpass', 1300, 0.8);
  [
    [0, 64],
    [0.13, 60],
  ].forEach(([dt = 0, n = 0], i) => {
    const at = t + dt;
    const g = s.gain(0, lp);
    const end = s.perc(g.gain, at, 0.5, 0.006, 0.17);
    const o = s.osc('triangle', mtof(n), at, end, g);
    if (i === 1) o.frequency.linearRampToValueAtTime(mtof(n) * 0.97, end);
  });
}

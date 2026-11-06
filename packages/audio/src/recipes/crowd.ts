/**
 * The gallery. Crowd sounds are built from individual synthetic voices: a
 * glottal source (sawtooth plus breath noise) through three formant filters
 * that glide between vowel targets at syllable rate. A dozen of these, spread
 * across the stereo field and sent into the hall reverb, read as people.
 */
import type { Synth } from '../dsp.ts';

/** F1, F2, F3 in Hz for a handful of vowels. */
const VOWELS: readonly (readonly [number, number, number])[] = [
  [800, 1200, 2500], // a
  [400, 2000, 2600], // e
  [300, 2300, 3000], // i
  [450, 800, 2500], // o
  [325, 700, 2500], // u
  [500, 1500, 2500], // schwa
  [650, 1700, 2600], // æ
];
const LAUGH_VOWELS: readonly (readonly [number, number, number])[] = [
  [780, 1250, 2550], // ha
  [560, 1800, 2600], // heh
  [700, 1100, 2450], // hah (darker)
];

export interface VoiceRig {
  osc: OscillatorNode;
  breath: GainNode;
  amp: GainNode;
  formants: [BiquadFilterNode, BiquadFilterNode, BiquadFilterNode];
}

/** One synthetic talker. Automation is scheduled by the caller. */
export function voiceRig(s: Synth, t0: number, t1: number, f0: number, pan: number, dest: AudioNode, breathiness: number): VoiceRig {
  const p = s.pan(pan, dest);
  const amp = s.gain(0, p);
  const f1 = s.filter('bandpass', 500, 6, s.gain(1, amp));
  const f2 = s.filter('bandpass', 1500, 9, s.gain(0.45, amp));
  const f3 = s.filter('bandpass', 2500, 12, s.gain(0.2, amp));
  const src = s.gain(1, null);
  src.connect(f1);
  src.connect(f2);
  src.connect(f3);
  const osc = s.osc('sawtooth', f0, t0, t1, s.gain(1 - breathiness * 0.6, src));
  const breath = s.gain(breathiness, src);
  s.noiseSource('pink', t0, t1, breath);
  return { osc, breath, amp, formants: [f1, f2, f3] };
}

function setVowel(rig: VoiceRig, v: readonly [number, number, number], t: number, glide: number, shift: number): void {
  rig.formants.forEach((f, i) => f.frequency.setTargetAtTime((v[i] ?? 1000) * shift, t, glide));
}

/**
 * Schedules conversational syllables on a rig between t0 and t1. Used by the
 * murmur one-shot and, in chunks, by the ambience bed.
 */
export function speak(s: Synth, rig: VoiceRig, t0: number, t1: number, f0: number, level: number, rate: number): void {
  const shift = f0 > 160 ? 1.12 : 1; // shorter vocal tracts, higher formants
  let t = t0;
  rig.amp.gain.setValueAtTime(0, t0);
  while (t < t1 - 0.12) {
    const len = (1 / rate) * s.rng.range(0.6, 1.5);
    if (s.rng.chance(0.18)) {
      // A pause between phrases.
      t += len * s.rng.range(1, 2.5);
      continue;
    }
    const v = s.rng.pick(VOWELS);
    setVowel(rig, v, t, 0.025, shift);
    rig.osc.frequency.setTargetAtTime(f0 * s.rng.jitter(0.14), t, 0.04);
    const peak = level * s.rng.range(0.45, 1);
    const end = Math.min(t1, t + len);
    rig.amp.gain.setValueAtTime(0, t);
    rig.amp.gain.linearRampToValueAtTime(peak, t + Math.min(0.04, len * 0.3));
    rig.amp.gain.linearRampToValueAtTime(peak * 0.6, t + len * 0.7);
    rig.amp.gain.linearRampToValueAtTime(0, end);
    t = end + s.rng.range(0, 0.03);
  }
  rig.amp.gain.setValueAtTime(0, t1);
}

const talkerPitch = (s: Synth): number => (s.rng.chance(0.5) ? s.rng.range(92, 140) : s.rng.range(170, 245));

/** A crowd of `count` talkers through a distance lowpass, with a level shape. */
function walla(
  s: Synth,
  t: number,
  dur: number,
  count: number,
  level: number,
  shape: readonly (readonly [number, number])[],
  cutoff: number,
): void {
  const master = s.gain(0);
  s.line(
    master.gain,
    shape.map(([at, v]) => [t + at * dur, v * level] as const),
  );
  const lp = s.filter('lowpass', cutoff, 0.7, master);
  s.end = Math.max(s.end, t + dur);
  const each = 1 / Math.sqrt(count);
  for (let i = 0; i < count; i++) {
    const f0 = talkerPitch(s);
    const start = t + s.rng.range(0, dur * 0.2);
    const stop = t + dur * s.rng.range(0.8, 1);
    const rig = voiceRig(s, start, stop + 0.05, f0, s.rng.range(-0.8, 0.8), lp, 0.45);
    speak(s, rig, start, stop, f0, each, s.rng.range(3.5, 6));
  }
}

export function crowdMurmur(s: Synth, t: number, intensity: number): void {
  walla(
    s,
    t,
    2.7,
    11,
    0.55 + 0.45 * intensity,
    [
      [0, 0],
      [0.22, 1],
      [0.5, 0.85],
      [0.75, 0.55],
      [1, 0],
    ],
    1900 + 900 * intensity,
  );
}

/** One person laughing: aspirated "ha" pulses that slow down and fall in pitch. */
function laugher(s: Synth, t: number, f0: number, pulses: number, interval: number, level: number, pan: number, dest: AudioNode): void {
  // Pulse onsets first, so the voice lives exactly as long as the laugh.
  const onsets: number[] = [];
  let at = t;
  for (let i = 0; i < pulses; i++) {
    onsets.push(at);
    at += interval * (1 + 0.06 * i) * s.rng.jitter(0.08);
  }
  const span = (onsets[onsets.length - 1] ?? t) + interval * 0.72 + 0.02 - t;
  const rig = voiceRig(s, t, t + span, f0, pan, dest, 0.5);
  setVowel(rig, s.rng.pick(LAUGH_VOWELS), t, 0.01, f0 > 180 ? 1.1 : 1);
  const g = rig.amp.gain;
  g.setValueAtTime(0, t);
  onsets.forEach((on, i) => {
    const k = i / pulses;
    const peak = level * (1 - 0.65 * k) * s.rng.jitter(0.15);
    const pitch = f0 * (1 - 0.035 * i) * s.rng.jitter(0.04);
    rig.osc.frequency.setValueAtTime(pitch, on);
    rig.osc.frequency.linearRampToValueAtTime(pitch * 0.9, on + interval * 0.6);
    // Breath ("h") leads the voiced part by a few milliseconds.
    rig.breath.gain.setValueAtTime(0.8, on);
    rig.breath.gain.linearRampToValueAtTime(0.35, on + 0.03);
    g.setValueAtTime(0, on);
    g.linearRampToValueAtTime(peak, on + 0.018);
    g.linearRampToValueAtTime(peak * 0.7, on + interval * 0.45);
    g.linearRampToValueAtTime(0, on + interval * 0.72);
  });
}

export function crowdLaugh(s: Synth, t: number, intensity: number): void {
  const out = s.filter('lowpass', 3200 + 1200 * intensity, 0.7);
  const bus = s.gain(0.55 + 0.45 * intensity, out);
  const count = 12;
  for (let i = 0; i < count; i++) {
    const f0 = s.rng.chance(0.45) ? s.rng.range(105, 150) : s.rng.range(190, 320);
    const onset = t + Math.pow(s.rng.next(), 1.8) * 0.5; // most people laugh at once
    const pulses = s.rng.int(4, 9);
    const big = i < 2;
    laugher(s, onset, f0, pulses, s.rng.range(0.16, 0.23), (big ? 0.55 : 0.32) * s.rng.jitter(0.2), s.rng.range(-0.85, 0.85), bus);
  }
  // Under the laughs: a little chatter that rises as they fade.
  walla(s, t + 0.9, 1.7, 5, 0.25 * intensity, [[0, 0], [0.35, 1], [1, 0]], 1800);
}

export function crowdGasp(s: Synth, t: number, intensity: number): void {
  const out = s.filter('lowpass', 5000, 0.7);
  const bus = s.gain(0.6 + 0.4 * intensity, out);
  for (let i = 0; i < 13; i++) {
    const onset = t + Math.pow(s.rng.next(), 2) * 0.1;
    const peakAt = onset + s.rng.range(0.12, 0.22);
    const end = peakAt + s.rng.range(0.06, 0.12);
    const p = s.pan(s.rng.range(-0.85, 0.85), bus);
    // The inhale: noise through a rising resonance.
    const amp = s.gain(0, p);
    s.line(amp.gain, [
      [onset, 0],
      [peakAt, 0.32 * s.rng.jitter(0.25)],
      [end, 0],
    ]);
    const bp = s.filter('bandpass', 900, 3, amp);
    s.curve(bp.frequency, [
      [onset, s.rng.range(700, 1000)],
      [peakAt, s.rng.range(1700, 2600)],
    ]);
    s.noiseSource('pink', onset, end + 0.01, bp);
    // A little voice catching in the throat.
    const f0 = s.rng.chance(0.5) ? s.rng.range(180, 260) : s.rng.range(300, 420);
    const rig = voiceRig(s, onset, end + 0.02, f0, 0, p, 0.7);
    setVowel(rig, [750, 1300, 2600], onset, 0.01, 1);
    s.line(rig.amp.gain, [
      [onset, 0],
      [peakAt, 0.12],
      [end, 0],
    ]);
  }
  // The stunned whisper afterwards.
  walla(s, t + 0.35, 1.3, 6, 0.4 * intensity, [[0, 0], [0.3, 1], [0.7, 0.6], [1, 0]], 1500);
}

/**
 * Applause, synthesised sample by sample: each clap is a few milliseconds of
 * noise through a resonant bandpass (hand cavities ring between ~800 Hz and
 * ~2.5 kHz). Hundreds of claps as nodes would be wasteful, so the claps are
 * written straight into a stereo buffer.
 */
export function applauseBuffer(s: Synth, seconds: number, intensity: number): AudioBuffer {
  const rate = s.ctx.sampleRate;
  const len = Math.floor(seconds * rate);
  const buf = s.ctx.createBuffer(2, len, rate);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const clappers = 16;
  for (let c = 0; c < clappers; c++) {
    const pan = s.rng.range(-0.9, 0.9);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    const centre = s.rng.range(800, 2500);
    const q = s.rng.range(1.5, 3.5);
    const period = 1 / s.rng.range(3.6, 5.2);
    const stopAt = seconds * s.rng.range(0.45, 0.92);
    let at = s.rng.range(0, 0.18);
    let n = 0;
    while (at < stopAt) {
      const fade = 1 - Math.pow(at / stopAt, 3);
      const level = (0.22 + 0.2 * intensity) * fade * s.rng.jitter(0.3);
      // RBJ bandpass coefficients for this clapper's cavity.
      const f = centre * s.rng.jitter(0.08);
      const w = (2 * Math.PI * f) / rate;
      const alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      const b0 = alpha / a0;
      const b2 = -alpha / a0;
      const a1 = (-2 * Math.cos(w)) / a0;
      const a2 = (1 - alpha) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      const start = Math.floor(at * rate);
      const clapLen = Math.floor(rate * s.rng.range(0.025, 0.045));
      for (let i = 0; i < clapLen && start + i < len; i++) {
        const env = Math.exp(-i / (rate * 0.006));
        const x = (s.rng.next() * 2 - 1) * env;
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        L[start + i] = (L[start + i] ?? 0) + y * level * gl * 1.5;
        R[start + i] = (R[start + i] ?? 0) + y * level * gr * 1.5;
      }
      n++;
      at += period * s.rng.jitter(0.12) * (1 + n * 0.012);
    }
  }
  return buf;
}

export function crowdApplause(s: Synth, t: number, intensity: number): void {
  s.buffer(applauseBuffer(s, 3, intensity), t);
  walla(s, t + 0.1, 2.6, 5, 0.3 * intensity, [[0, 0], [0.2, 1], [1, 0]], 2200);
}

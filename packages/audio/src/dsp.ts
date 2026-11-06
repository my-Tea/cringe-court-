/**
 * Synthesis primitives shared by every recipe. Everything is plain Web Audio
 * (OscillatorNode, AudioBufferSourceNode, BiquadFilterNode, GainNode), so the
 * same code runs in browsers, in `node-web-audio-api` for offline renders, and
 * against the mock context in tests.
 */

/** Floor for exponential ramps; `exponentialRampToValueAtTime(0)` is a RangeError. */
export const EPS = 1e-4;

// ---------------------------------------------------------------------------
// Seeded randomness: every cue varies a little each time it plays, but a render
// with the same seed is identical.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  /** A ± spread around 1, for pitch and gain humanising. */
  jitter(spread: number): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (items) => {
      if (items.length === 0) throw new RangeError('pick() from an empty list');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    chance: (p) => next() < p,
    jitter: (spread) => 1 + (next() * 2 - 1) * spread,
  };
  return rng;
}

/** FNV-1a, for turning cue ids into seeds. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Pitch helpers

/** MIDI note number to Hz (A4 = 69 = 440 Hz). */
export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Major pentatonic degrees in semitones, extended over octaves. */
export function pentatonic(step: number): number {
  const scale = [0, 2, 4, 7, 9];
  const s = Math.max(0, Math.floor(step));
  return 12 * Math.floor(s / scale.length) + (scale[s % scale.length] ?? 0);
}

// ---------------------------------------------------------------------------
// Noise buffers, built once per context from a fixed seed.

export type NoiseColor = 'white' | 'pink' | 'brown';

const NOISE_SECONDS = 3;
const noiseCache = new WeakMap<BaseAudioContext, Record<NoiseColor, AudioBuffer>>();

export function noiseBuffers(ctx: BaseAudioContext): Record<NoiseColor, AudioBuffer> {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const rng = createRng(0xc0ffee);
  const white = ctx.createBuffer(1, len, ctx.sampleRate);
  const pink = ctx.createBuffer(1, len, ctx.sampleRate);
  const brown = ctx.createBuffer(1, len, ctx.sampleRate);
  const w = white.getChannelData(0);
  const p = pink.getChannelData(0);
  const b = brown.getChannelData(0);
  // Paul Kellet's economy pink filter; leaky integrator for brown.
  let b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < len; i++) {
    const x = rng.next() * 2 - 1;
    w[i] = x;
    b0 = 0.99765 * b0 + x * 0.099046;
    b1 = 0.963 * b1 + x * 0.2965164;
    b2 = 0.57 * b2 + x * 1.0526913;
    p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2;
    br = (br + 0.02 * x) / 1.02;
    b[i] = br * 3.5;
  }
  // Crossfade the loop seam so looping noise never clicks.
  const fade = Math.floor(ctx.sampleRate * 0.05);
  for (const d of [w, p, b]) {
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      const tail = len - fade + i;
      d[tail] = (d[tail] ?? 0) * (1 - k) + (d[i] ?? 0) * k;
    }
  }
  const bank = { white, pink, brown };
  noiseCache.set(ctx, bank);
  return bank;
}

/**
 * A synthetic impulse response for a mid-sized courtroom: wood panelling,
 * stone floor, high ceiling. Early reflections, then a decorrelated stereo tail
 * that darkens as it decays (high frequencies die first, as in a real hall).
 */
export function courtroomImpulse(ctx: BaseAudioContext, seconds = 1.9, seed = 0x1a11): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const ir = ctx.createBuffer(2, len, rate);
  const reflections = [0.011, 0.017, 0.023, 0.031, 0.037, 0.046, 0.059, 0.071];
  for (let ch = 0; ch < 2; ch++) {
    const rng = createRng(seed + ch * 7919);
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      const env = Math.exp((-6.9 * t) / seconds); // −60 dB at `seconds`
      const onset = Math.min(1, t / 0.012);
      // One-pole lowpass whose cutoff falls over time.
      const k = 0.85 - 0.75 * Math.min(1, t / seconds);
      lp += k * (rng.next() * 2 - 1 - lp);
      d[i] = lp * env * onset * 0.6;
    }
    for (const [j, r] of reflections.entries()) {
      const at = Math.floor((r + (ch ? 0.0023 * (j % 3) : 0.0017 * (j % 2))) * rate);
      if (at < len) d[at] = (d[at] ?? 0) + (rng.next() > 0.5 ? 1 : -1) * 0.45 * Math.pow(0.82, j);
    }
  }
  return ir;
}

// ---------------------------------------------------------------------------
// The voice builder. A recipe receives one and draws its sound into `out`.

export type Point = readonly [time: number, value: number];

/** AudioParams have no `connect`; AudioNodes always do. */
const AudioParamLike = {
  [Symbol.hasInstance]: (v: unknown) => typeof v === 'object' && v !== null && !('connect' in v) && 'setValueAtTime' in v,
};

export class Synth {
  /** Latest time any source in this voice stops; the engine cleans up after it. */
  end = 0;
  readonly sources: AudioScheduledSourceNode[] = [];
  readonly nodes: AudioNode[] = [];
  private readonly noise: Record<NoiseColor, AudioBuffer>;

  constructor(
    readonly ctx: BaseAudioContext,
    readonly out: AudioNode,
    readonly rng: Rng,
  ) {
    this.noise = noiseBuffers(ctx);
  }

  private keep<T extends AudioNode>(node: T, dest: AudioNode | AudioParam | null): T {
    this.nodes.push(node);
    if (dest instanceof AudioParamLike) node.connect(dest as AudioParam);
    else if (dest) node.connect(dest as AudioNode);
    return node;
  }

  private track(src: AudioScheduledSourceNode, t0: number, t1: number) {
    const start = Math.max(0, t0);
    const stop = Math.max(start + 0.005, t1);
    src.start(start);
    src.stop(stop);
    this.sources.push(src);
    this.end = Math.max(this.end, stop);
  }

  /** A gain stage; `dest` may be an AudioParam to build modulation. */
  gain(value = 1, dest: AudioNode | AudioParam | null = this.out): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return this.keep(g, dest);
  }

  filter(type: BiquadFilterType, frequency: number, Q = 0.707, dest: AudioNode | null = this.out): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = Q;
    return this.keep(f, dest);
  }

  pan(position: number, dest: AudioNode | null = this.out): StereoPannerNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, position));
    return this.keep(p, dest);
  }

  /** Soft saturation, for brass bite and body hits. */
  drive(amount: number, dest: AudioNode | null = this.out): WaveShaperNode {
    const ws = this.ctx.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    const k = Math.max(0.001, amount);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    ws.curve = curve;
    ws.oversample = '2x';
    return this.keep(ws, dest);
  }

  osc(type: OscillatorType, frequency: number, t0: number, t1: number, dest: AudioNode = this.out): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = frequency;
    this.keep(o, dest);
    this.track(o, t0, t1);
    return o;
  }

  noiseSource(color: NoiseColor, t0: number, t1: number, dest: AudioNode = this.out, rate = 1): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise[color];
    src.loop = true;
    src.playbackRate.value = rate;
    this.keep(src, dest);
    const offset = this.rng.range(0, NOISE_SECONDS - 0.1);
    const start = Math.max(0, t0);
    src.start(start, offset);
    const stop = Math.max(start + 0.005, t1);
    src.stop(stop);
    this.sources.push(src);
    this.end = Math.max(this.end, stop);
    return src;
  }

  // -- Envelopes ------------------------------------------------------------

  /** Linear attack to `peak`, exponential decay to silence by `t + attack + decay`. */
  perc(param: AudioParam, t: number, peak: number, attack: number, decay: number): number {
    const a = Math.max(0.0005, attack);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.exponentialRampToValueAtTime(EPS, t + a + decay);
    param.setValueAtTime(0, t + a + decay + 0.001);
    return t + a + decay + 0.002;
  }

  /** Piecewise-linear automation through absolute-time points. */
  line(param: AudioParam, points: readonly Point[]): number {
    const [first, ...rest] = points;
    if (!first) return 0;
    param.setValueAtTime(first[1], first[0]);
    for (const [t, v] of rest) param.linearRampToValueAtTime(v, t);
    return points[points.length - 1]?.[0] ?? first[0];
  }

  /** Exponential automation through points (values clamped to EPS). */
  curve(param: AudioParam, points: readonly Point[]): number {
    const [first, ...rest] = points;
    if (!first) return 0;
    param.setValueAtTime(Math.max(EPS, first[1]), first[0]);
    for (const [t, v] of rest) param.exponentialRampToValueAtTime(Math.max(EPS, v), t);
    return points[points.length - 1]?.[0] ?? first[0];
  }

  // -- Compound instruments --------------------------------------------------

  /**
   * A struck resonant body: a bank of decaying sine partials. Wood uses near-
   * harmonic ratios with short decays; metal uses inharmonic ratios with long ones.
   */
  modal(
    t: number,
    f0: number,
    partials: readonly { ratio: number; amp: number; decay: number }[],
    level: number,
    dest: AudioNode = this.out,
  ): void {
    for (const p of partials) {
      const g = this.gain(0, dest);
      const end = this.perc(g.gain, t, p.amp * level, 0.001, p.decay);
      this.osc('sine', f0 * p.ratio, t, end, g);
    }
  }

  /** Two-operator FM bell. `index` controls brightness, `ratio` the timbre. */
  bell(t: number, freq: number, level: number, decay: number, dest: AudioNode = this.out, ratio = 3.5, index = 2.2): void {
    const amp = this.gain(0, dest);
    const end = this.perc(amp.gain, t, level, 0.002, decay);
    const carrier = this.osc('sine', freq, t, end, amp);
    const modGain = this.gain(0, null);
    modGain.connect(carrier.frequency);
    this.curve(modGain.gain, [
      [t, freq * index],
      [t + decay * 0.6, freq * 0.05],
    ]);
    this.osc('sine', freq * ratio, t, end, modGain);
  }

  /** Plays a prepared buffer (for sounds synthesised sample by sample). */
  buffer(buf: AudioBuffer, t: number, dest: AudioNode = this.out): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    this.keep(src, dest);
    this.track(src, t, t + buf.duration);
    return src;
  }

  /** A short filtered noise burst: clicks, slaps, thumps' attack. */
  burst(
    t: number,
    level: number,
    decay: number,
    type: BiquadFilterType,
    freq: number,
    Q = 0.7,
    color: NoiseColor = 'white',
    dest: AudioNode = this.out,
  ): void {
    const f = this.filter(type, freq, Q, dest);
    const g = this.gain(0, f);
    const end = this.perc(g.gain, t, level, 0.0008, decay);
    this.noiseSource(color, t, end, g);
  }

  /** A pitched body hit that drops in pitch: kick, thud, timpani core. */
  thump(t: number, from: number, to: number, level: number, decay: number, dest: AudioNode = this.out): void {
    const g = this.gain(0, dest);
    const end = this.perc(g.gain, t, level, 0.002, decay);
    const o = this.osc('sine', from, t, end, g);
    this.curve(o.frequency, [
      [t, from],
      [t + Math.min(decay, 0.12), to],
    ]);
  }
}

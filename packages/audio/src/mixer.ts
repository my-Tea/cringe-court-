/**
 * The mixing graph, shared by the live engine and the offline renderer:
 *
 *   cue voice ─┬─────────────► sfx.input ──┐
 *              └─ send(wet) ─► sfx.send ─► reverb ─┴► sfx.volume ─┐
 *   ambience ──┬─────────────► music.input ─┐                      ├► master ─► limiter ─► destination
 *              └─ send ──────► music.send ─► reverb ─┴► music.volume ─► music.duck ─┘
 *
 * Each bus owns its reverb so the bus volume scales wet and dry together. The
 * limiter is a safety net for stacked cues, not a loudness tool: it sits just
 * below full scale and is rarely touched by a single cue.
 */
import { CUES, type CueId } from './cues.ts';
import { courtroomImpulse, Synth, type Rng } from './dsp.ts';
import { dbToGain } from './settings.ts';
import { RECIPES } from './recipes/index.ts';

export interface Bus {
  readonly input: GainNode;
  readonly send: GainNode;
  readonly volume: GainNode;
}

function makeBus(ctx: BaseAudioContext, ir: AudioBuffer, dest: AudioNode): Bus {
  const input = ctx.createGain();
  const send = ctx.createGain();
  const volume = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.normalize = true;
  reverb.buffer = ir;
  input.connect(volume);
  send.connect(reverb);
  reverb.connect(volume);
  volume.connect(dest);
  return { input, send, volume };
}

/** Moves a param smoothly from wherever it is now; safe to call repeatedly. */
export function glide(param: AudioParam, value: number, now: number, timeConstant = 0.03): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.setTargetAtTime(value, now, timeConstant);
}

export class Mixer {
  readonly master: GainNode;
  readonly limiter: DynamicsCompressorNode;
  readonly rumble: BiquadFilterNode;
  readonly sfx: Bus;
  readonly music: Bus;
  readonly duck: GainNode;

  constructor(readonly ctx: BaseAudioContext) {
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 1;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.18;
    this.limiter.connect(ctx.destination);
    // Nothing useful lives below 35 Hz on laptop and phone speakers; it only eats headroom.
    this.rumble = ctx.createBiquadFilter();
    this.rumble.type = 'highpass';
    this.rumble.frequency.value = 35;
    this.rumble.Q.value = 0.6;
    this.rumble.connect(this.limiter);
    this.master = ctx.createGain();
    this.master.connect(this.rumble);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    const ir = courtroomImpulse(ctx);
    this.sfx = makeBus(ctx, ir, this.master);
    this.music = makeBus(ctx, ir, this.duck);
  }

  /** Lowers the music bus by `depthDb` and lets it recover after `seconds`. */
  duckMusic(depthDb: number, seconds: number, at: number): void {
    const p = this.duck.gain;
    p.cancelScheduledValues(at);
    p.setValueAtTime(p.value, at);
    p.setTargetAtTime(dbToGain(depthDb), at, 0.06);
    p.setTargetAtTime(1, at + seconds, 0.5);
  }

  dispose(): void {
    for (const n of [this.master, this.rumble, this.limiter, this.duck, this.sfx.input, this.sfx.send, this.sfx.volume, this.music.input, this.music.send, this.music.volume]) {
      n.disconnect();
    }
  }
}

export interface VoiceOptions {
  /** Context time to start at. */
  at: number;
  intensity: number;
  step: number;
  pan: number;
  /** Extra trim in dB (Reduce sound uses −6). */
  trimDb: number;
}

export interface Voice {
  readonly cue: CueId;
  readonly startsAt: number;
  /** Context time after which the voice is silent (sources stopped). */
  readonly endsAt: number;
  stop(at: number, fade: number): void;
  dispose(): void;
}

/** Synthesises one cue into the sfx bus. Throws only if Web Audio itself throws. */
export function playVoice(mixer: Mixer, cue: CueId, rng: Rng, o: VoiceOptions): Voice {
  const { ctx } = mixer;
  const spec = CUES[cue];
  const level = ctx.createGain();
  level.gain.value = dbToGain(spec.gainDb + o.trimDb);
  let head: AudioNode = level;
  const extra: AudioNode[] = [level];
  if (o.pan !== 0) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    level.connect(p);
    head = p;
    extra.push(p);
  }
  head.connect(mixer.sfx.input);
  if (spec.wet > 0) {
    const send = ctx.createGain();
    send.gain.value = spec.wet;
    head.connect(send);
    send.connect(mixer.sfx.send);
    extra.push(send);
  }
  const synth = new Synth(ctx, level, rng);
  RECIPES[cue](synth, o.at, o.intensity, o.step);
  let endsAt = synth.end;
  let disposed = false;
  return {
    cue,
    startsAt: o.at,
    get endsAt() {
      return endsAt;
    },
    stop(at, fade) {
      const until = at + Math.max(0.005, fade);
      glide(level.gain, 0, at, Math.max(0.002, fade / 4));
      for (const src of synth.sources) {
        try {
          src.stop(until);
        } catch {
          // Already stopped earlier than `until`; nothing to do.
        }
      }
      endsAt = Math.min(endsAt, until);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const n of [...synth.nodes, ...extra]) n.disconnect();
    },
  };
}

/**
 * Offline rendering through the exact live graph (Mixer + recipes). Used by the
 * render script, the real-render tests and anyone who wants a WAV of a cue.
 * Pass an OfflineAudioContext constructor: the browser's, or the one from
 * `node-web-audio-api` in Node.
 */
import { AmbienceBed, type AmbiencePreset } from './ambience.ts';
import { CUES, type CueId } from './cues.ts';
import { createRng, hashString } from './dsp.ts';
import { Mixer, playVoice } from './mixer.ts';

export type OfflineContextCtor = new (numberOfChannels: number, length: number, sampleRate: number) => OfflineAudioContext;

export interface RenderOptions {
  sampleRate?: number;
  /** Default: a hash of the cue id, so every render of a cue is identical. */
  seed?: number;
  intensity?: number;
  step?: number;
  /** Extra seconds after the nominal duration for the reverb tail. Default 1.4. */
  tail?: number;
}

export const RENDER_START = 0.02;

export async function renderCue(Ctor: OfflineContextCtor, cue: CueId, o: RenderOptions = {}): Promise<AudioBuffer> {
  const sampleRate = o.sampleRate ?? 44100;
  const seconds = CUES[cue].duration + (o.tail ?? 1.4);
  const ctx = new Ctor(2, Math.ceil(seconds * sampleRate), sampleRate);
  const mixer = new Mixer(ctx);
  playVoice(mixer, cue, createRng(o.seed ?? hashString(cue)), {
    at: RENDER_START,
    intensity: o.intensity ?? 1,
    step: o.step ?? 0,
    pan: 0,
    trimDb: 0,
  });
  return ctx.startRendering();
}

export async function renderAmbience(
  Ctor: OfflineContextCtor,
  preset: Exclude<AmbiencePreset, 'off'>,
  seconds: number,
  o: Pick<RenderOptions, 'sampleRate' | 'seed'> = {},
): Promise<AudioBuffer> {
  const sampleRate = o.sampleRate ?? 44100;
  const ctx = new Ctor(2, Math.ceil(seconds * sampleRate), sampleRate);
  const mixer = new Mixer(ctx);
  const bed = new AmbienceBed(ctx, mixer.music, createRng(o.seed ?? hashString(`ambience:${preset}`)), 0);
  bed.setPreset(preset, 0, 0.6);
  bed.schedule(seconds);
  return ctx.startRendering();
}

/** Peak, RMS and where the sound actually is, for checks and the manifest. */
export interface BufferStats {
  seconds: number;
  peak: number;
  peakDb: number;
  rmsDb: number;
  /** Seconds until the first sample above −60 dBFS. */
  onset: number;
  /** Seconds after which everything stays below −60 dBFS. */
  lastAudible: number;
  finite: boolean;
}

export function analyse(buf: AudioBuffer): BufferStats {
  const thr = 0.001;
  let peak = 0;
  let sum = 0;
  let n = 0;
  let first = -1;
  let last = 0;
  let finite = true;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const x = d[i] ?? 0;
      if (!Number.isFinite(x)) {
        finite = false;
        continue;
      }
      const a = Math.abs(x);
      if (a > peak) peak = a;
      sum += x * x;
      n++;
      if (a > thr) {
        if (first < 0 || i < first) first = i;
        if (i > last) last = i;
      }
    }
  }
  const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
  return {
    seconds: buf.duration,
    peak,
    peakDb: db(peak),
    rmsDb: db(Math.sqrt(sum / Math.max(1, n))),
    onset: first < 0 ? -1 : first / buf.sampleRate,
    lastAudible: last / buf.sampleRate,
    finite,
  };
}

/** 16-bit PCM WAV bytes. */
export function encodeWav(buf: AudioBuffer): Uint8Array {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const bytes = new Uint8Array(44 + len * ch * 2);
  const v = new DataView(bytes.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + len * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const x = Math.max(-1, Math.min(1, data[c]?.[i] ?? 0));
      v.setInt16(o, Math.round(x < 0 ? x * 0x8000 : x * 0x7fff), true);
      o += 2;
    }
  }
  return bytes;
}

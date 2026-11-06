/**
 * Real audio, not a mock: every cue is rendered through the live mixer graph by
 * node-web-audio-api (a Rust implementation of the Web Audio spec) and the
 * samples are checked.
 */
import { OfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { AMBIENCE_PRESETS } from '../src/ambience.ts';
import { CUE_IDS, CUES } from '../src/cues.ts';
import { analyse, renderAmbience, renderCue, RENDER_START, type OfflineContextCtor } from '../src/render.ts';

const Ctor = OfflineAudioContext as unknown as OfflineContextCtor;
const RATE = 22050; // half rate keeps the suite quick; the render script uses 44.1 kHz

describe('real renders (node-web-audio-api)', () => {
  for (const cue of CUE_IDS) {
    it(`${cue}: finite, audible, below full scale, starts on time and ends`, async () => {
      const stats = analyse(await renderCue(Ctor, cue, { sampleRate: RATE }));
      expect(stats.finite).toBe(true);
      expect(stats.peakDb).toBeLessThan(-0.5);
      expect(stats.peakDb).toBeGreaterThan(cue === 'ui_hover' ? -40 : -24);
      expect(stats.onset).toBeGreaterThanOrEqual(RENDER_START - 0.002);
      expect(stats.onset).toBeLessThan(RENDER_START + 0.1);
      // Reverb tail included, the cue is silent (−60 dBFS) within a second of its dry length.
      expect(stats.lastAudible).toBeLessThan(RENDER_START + CUES[cue].duration + 1.1);
    }, 30_000);
  }

  it('is deterministic for a given seed and varies across seeds', async () => {
    // Copy the samples at once: node-web-audio-api may reuse the memory behind
    // getChannelData() after its AudioBuffer is garbage-collected.
    const samples = async (seed: number) =>
      Float32Array.from((await renderCue(Ctor, 'crowd_laugh', { sampleRate: RATE, seed })).getChannelData(0));
    const a = await samples(5);
    const b = await samples(5);
    const c = await samples(6);
    let maxDiff = 0;
    let firstDiff = -1;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i]! - b[i]!);
      if (d > 0 && firstDiff < 0) firstDiff = i;
      maxDiff = Math.max(maxDiff, d);
    }
    expect({ maxDiff, firstDiff }).toEqual({ maxDiff: 0, firstDiff: -1 });
    expect(Buffer.from(a.buffer).equals(Buffer.from(c.buffer))).toBe(false);
  }, 30_000);

  it('plays softer at low intensity', async () => {
    const loud = analyse(await renderCue(Ctor, 'gavel_strike', { sampleRate: RATE, intensity: 1, seed: 1 }));
    const soft = analyse(await renderCue(Ctor, 'gavel_strike', { sampleRate: RATE, intensity: 0, seed: 1 }));
    expect(loud.rmsDb - soft.rmsDb).toBeGreaterThan(3);
  }, 30_000);

  it('climbs in pitch as votes are counted', async () => {
    const zeroCrossings = async (step: number) => {
      const d = Float32Array.from((await renderCue(Ctor, 'vote_tick', { sampleRate: RATE, step, seed: 1, tail: 0 })).getChannelData(0));
      let n = 0;
      for (let i = Math.floor(0.03 * RATE); i < Math.floor(0.2 * RATE); i++) if ((d[i - 1] ?? 0) < 0 && (d[i] ?? 0) >= 0) n++;
      return n;
    };
    const counts = [await zeroCrossings(0), await zeroCrossings(2), await zeroCrossings(4)];
    expect(counts[1]!).toBeGreaterThan(counts[0]!);
    expect(counts[2]!).toBeGreaterThan(counts[1]!);
  }, 30_000);

  it('renders each ambience preset as a quiet, continuous bed, hushed for the verdict', async () => {
    const rms: Record<string, number> = {};
    for (const p of AMBIENCE_PRESETS) {
      if (p === 'off') continue;
      const s = analyse(await renderAmbience(Ctor, p, 6, { sampleRate: RATE }));
      expect(s.finite).toBe(true);
      expect(s.peakDb).toBeLessThan(-6);
      expect(s.rmsDb).toBeGreaterThan(-45);
      expect(s.lastAudible).toBeGreaterThan(5.9);
      rms[p] = s.rmsDb;
    }
    expect(rms.lobby!).toBeGreaterThan(rms.verdict!);
  }, 60_000);
});

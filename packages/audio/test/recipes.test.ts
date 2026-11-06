import { describe, expect, it } from 'vitest';
import { CUE_IDS, CUES } from '../src/cues.ts';
import { createRng } from '../src/dsp.ts';
import { Mixer, playVoice } from '../src/mixer.ts';
import { RECIPES } from '../src/recipes/index.ts';
import { MockAudioContext, MockParam, MockSource } from './mock-audio-context.ts';

const build = () => {
  const mock = new MockAudioContext();
  const mixer = new Mixer(mock as unknown as BaseAudioContext);
  return { mock, mixer };
};

describe('cue catalogue', () => {
  it('has a spec and a recipe for every cue id, and nothing else', () => {
    expect(Object.keys(CUES).sort()).toEqual([...CUE_IDS].sort());
    expect(Object.keys(RECIPES).sort()).toEqual([...CUE_IDS].sort());
    expect(new Set(CUE_IDS).size).toBe(CUE_IDS.length);
  });

  it('keeps every spec within sane mixing bounds', () => {
    for (const id of CUE_IDS) {
      const s = CUES[id];
      expect(s.id).toBe(id);
      expect(s.gainDb).toBeGreaterThanOrEqual(-30);
      expect(s.gainDb).toBeLessThanOrEqual(8);
      expect(s.wet).toBeGreaterThanOrEqual(0);
      expect(s.wet).toBeLessThanOrEqual(1);
      expect(s.duration).toBeGreaterThan(0);
      expect(s.maxVoices).toBeGreaterThanOrEqual(1);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(20);
    }
  });
});

describe('recipes on a strict mock context', () => {
  for (const cue of CUE_IDS) {
    it(`${cue}: valid automation, every source started, stopped and audible`, () => {
      for (const intensity of [0, 0.5, 1]) {
        for (const step of [0, 1, 7]) {
          const { mock, mixer } = build();
          const at = 0.25;
          const before = mock.created.length;
          const voice = playVoice(mixer, cue, createRng(42 + step), { at, intensity, step, pan: 0.3, trimDb: 0 });
          const nodes = mock.created.slice(before);
          const sources = nodes.filter((n): n is MockSource => n instanceof MockSource);
          expect(sources.length).toBeGreaterThan(0);
          for (const src of sources) {
            expect(src.startedAt).not.toBeNull();
            expect(src.stoppedAt).not.toBeNull();
            expect(src.startedAt!).toBeGreaterThanOrEqual(at - 1e-9);
            expect(src.stoppedAt!).toBeGreaterThan(src.startedAt!);
            expect(mock.reaches(src)).toBe(true);
          }
          // Every scheduled event is at or after the start and inside the voice's life.
          for (const n of nodes) {
            for (const v of Object.values(n)) {
              if (!(v instanceof MockParam)) continue;
              for (const e of v.events) {
                expect(e.time).toBeGreaterThanOrEqual(at - 1e-9);
                expect(e.time).toBeLessThanOrEqual(voice.endsAt + 1e-6);
              }
            }
          }
          // The voice ends close to the advertised duration (reverb tail not included).
          const length = voice.endsAt - at;
          expect(length).toBeGreaterThan(CUES[cue].duration * 0.6);
          expect(length).toBeLessThanOrEqual(CUES[cue].duration + 0.01);
          voice.dispose();
          for (const n of nodes) expect(n.outputs.length).toBe(0);
        }
      }
    });
  }

  it('stop() fades the voice and pulls every source stop time in', () => {
    const { mock, mixer } = build();
    const voice = playVoice(mixer, 'verdict_guilty', createRng(1), { at: 0, intensity: 1, step: 0, pan: 0, trimDb: 0 });
    voice.stop(0.5, 0.1);
    for (const src of mock.sources()) expect(src.stoppedAt!).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(voice.endsAt).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  it('varies between plays but is reproducible from a seed', () => {
    const freqs = (seed: number) => {
      const { mock, mixer } = build();
      playVoice(mixer, 'gavel_strike', createRng(seed), { at: 0, intensity: 1, step: 0, pan: 0, trimDb: 0 });
      return mock.created.flatMap((n) => ('frequency' in n && n.frequency instanceof MockParam ? [n.frequency.value] : []));
    };
    expect(freqs(7)).toEqual(freqs(7));
    expect(freqs(7)).not.toEqual(freqs(8));
  });
});

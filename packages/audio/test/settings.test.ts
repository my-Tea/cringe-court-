import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, localStorageStore, normalizeSettings, sliderToGain } from '../src/settings.ts';

class FakeStorage {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe('sliderToGain', () => {
  it('is silent at 0, unity at 1 and −24 dB in the middle', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(20 * Math.log10(sliderToGain(0.5))).toBeCloseTo(-24, 9);
    expect(sliderToGain(-1)).toBe(0);
    expect(sliderToGain(7)).toBe(1);
    expect(sliderToGain(Number.NaN)).toBe(0);
  });

  it('is strictly increasing', () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) {
      const g = sliderToGain(i / 100);
      expect(g).toBeGreaterThan(last);
      last = g;
    }
  });
});

describe('normalizeSettings', () => {
  it('returns defaults for junk and clamps or ignores bad fields', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('loud')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ master: 3, sfx: -1, music: 'x', muted: 'yes', reduceSound: 'maybe' })).toEqual({
      ...DEFAULT_SETTINGS,
      master: 1,
      sfx: 0,
    });
  });
});

describe('localStorageStore', () => {
  it('round-trips versioned JSON', () => {
    const storage = new FakeStorage();
    const store = localStorageStore('cc:audio', storage);
    expect(store.load()).toBeNull();
    store.save({ ...DEFAULT_SETTINGS, music: 0.25, reduceSound: 'reduced' });
    expect(JSON.parse(storage.getItem('cc:audio')!)).toMatchObject({ v: 1, music: 0.25 });
    expect(normalizeSettings(store.load())).toEqual({ ...DEFAULT_SETTINGS, music: 0.25, reduceSound: 'reduced' });
  });

  it('ignores other versions and non-objects; lets malformed JSON throw for the engine to catch', () => {
    const storage = new FakeStorage();
    const store = localStorageStore('k', storage);
    storage.setItem('k', JSON.stringify({ v: 99, master: 0.1 }));
    expect(store.load()).toBeNull();
    storage.setItem('k', '42');
    expect(store.load()).toBeNull();
    storage.setItem('k', '{oops');
    expect(() => store.load()).toThrow();
  });

  it('is a no-op without any storage', () => {
    const store = localStorageStore('k');
    expect(store.load()).toBeNull();
    expect(() => store.save(DEFAULT_SETTINGS)).not.toThrow();
  });
});

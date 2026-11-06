/**
 * Player-facing audio settings, their validation and persistence.
 *
 * `reduceSound` mirrors the app shell's motion preference (`cc:motion`):
 * `system` follows `prefers-reduced-motion`, the other two are explicit choices.
 */

export type ReduceSoundPreference = 'system' | 'reduced' | 'full';

export type VolumeChannel = 'master' | 'sfx' | 'music';

export interface AudioSettings {
  /** Slider positions, 0..1. Converted to gain with {@link sliderToGain}. */
  readonly master: number;
  readonly sfx: number;
  readonly music: number;
  readonly muted: boolean;
  readonly reduceSound: ReduceSoundPreference;
}

export const DEFAULT_SETTINGS: AudioSettings = Object.freeze({
  master: 0.8,
  sfx: 0.9,
  music: 0.7,
  muted: false,
  reduceSound: 'system',
});

export const SETTINGS_STORAGE_KEY = 'cc:audio';
const SETTINGS_VERSION = 1;

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Accepts anything (stored JSON, query params) and returns valid settings. */
export function normalizeSettings(input: unknown, base: AudioSettings = DEFAULT_SETTINGS): AudioSettings {
  if (typeof input !== 'object' || input === null) return base;
  const o = input as Record<string, unknown>;
  const pref = o.reduceSound;
  return {
    master: clamp01(o.master, base.master),
    sfx: clamp01(o.sfx, base.sfx),
    music: clamp01(o.music, base.music),
    muted: typeof o.muted === 'boolean' ? o.muted : base.muted,
    reduceSound: pref === 'system' || pref === 'reduced' || pref === 'full' ? pref : base.reduceSound,
  };
}

export function settingsEqual(a: AudioSettings, b: AudioSettings): boolean {
  return (
    a.master === b.master &&
    a.sfx === b.sfx &&
    a.music === b.music &&
    a.muted === b.muted &&
    a.reduceSound === b.reduceSound
  );
}

/** Slider span in dB. 1 → 0 dB, 0.5 → −24 dB, 0.01 → −47.5 dB, 0 → silence. */
export const SLIDER_RANGE_DB = 48;

/**
 * Perceptual volume curve: a linear slider maps to decibels, so the middle of
 * the slider sounds like the middle of the range instead of nearly full volume.
 */
export function sliderToGain(position: number): number {
  const p = clamp01(position, 0);
  if (p === 0) return 0;
  return dbToGain((p - 1) * SLIDER_RANGE_DB);
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * The persistence hook. The engine calls `load` once at construction and `save`
 * after every change. Implementations must not throw for missing data; return
 * `null` instead. Errors from either method are caught and ignored, because a
 * blocked storage (private mode, quota) must never break sound.
 */
export interface SettingsStore {
  load(): unknown;
  save(settings: AudioSettings): void;
}

/** Keeps settings for the lifetime of the object. Default for tests and SSR. */
export function memoryStore(initial?: Partial<AudioSettings>): SettingsStore & { saved: AudioSettings | null } {
  const store = {
    saved: initial ? normalizeSettings(initial) : null,
    load: () => store.saved,
    save: (s: AudioSettings) => {
      store.saved = s;
    },
  };
  return store;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Persists to `localStorage` (or any Storage-like object) as versioned JSON.
 * Unknown versions and malformed JSON fall back to defaults.
 */
export function localStorageStore(key: string = SETTINGS_STORAGE_KEY, storage?: StorageLike): SettingsStore {
  const resolve = (): StorageLike | null => {
    if (storage) return storage;
    try {
      return typeof globalThis.localStorage === 'object' ? globalThis.localStorage : null;
    } catch {
      return null;
    }
  };
  return {
    load() {
      const raw = resolve()?.getItem(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const { v, ...rest } = parsed as { v?: unknown };
      return v === SETTINGS_VERSION ? rest : null;
    },
    save(settings) {
      resolve()?.setItem(key, JSON.stringify({ v: SETTINGS_VERSION, ...settings }));
    },
  };
}

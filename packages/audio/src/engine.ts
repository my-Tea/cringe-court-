/**
 * AudioEngine: the one object the app talks to.
 *
 * - Nothing is created until the first user gesture (`unlock`, or the listeners
 *   from `attachUnlock`). Browsers block audio before a gesture anyway, and an
 *   early AudioContext only produces console warnings.
 * - Without Web Audio (SSR, tests, old browsers) every method is a safe no-op
 *   and `state` is `'unavailable'`.
 * - Sound can never break the app: Web Audio errors are caught and reported to
 *   `onError`, and the call returns `null`.
 * - `subscribe` / `getSnapshot` follow the `useSyncExternalStore` contract, so
 *   a React settings panel needs no extra glue.
 */
import { AmbienceBed, type AmbiencePreset } from './ambience.ts';
import { CUES, type CueId } from './cues.ts';
import { createRng, type Rng } from './dsp.ts';
import { cuesForEvent, type CaseAudioEvent } from './events.ts';
import { glide, Mixer, playVoice, type Voice } from './mixer.ts';
import {
  DEFAULT_SETTINGS,
  localStorageStore,
  memoryStore,
  normalizeSettings,
  settingsEqual,
  sliderToGain,
  type AudioSettings,
  type ReduceSoundPreference,
  type SettingsStore,
  type VolumeChannel,
} from './settings.ts';

export type EngineState =
  /** No Web Audio here (SSR, tests, very old browser). Everything is a no-op. */
  | 'unavailable'
  /** Waiting for the first user gesture. */
  | 'locked'
  | 'running'
  /** Paused because the page is hidden, or the browser interrupted audio. */
  | 'suspended'
  | 'disposed';

export interface AudioSnapshot {
  readonly state: EngineState;
  readonly settings: AudioSettings;
  /** Effective Reduce sound: the preference resolved against the OS setting. */
  readonly reduced: boolean;
  /** The ambience the app asked for (it may be silent while locked, muted or reduced). */
  readonly ambience: AmbiencePreset;
}

export interface PlayOptions {
  /** Seconds from now. */
  delay?: number;
  /** 0..1, default 1. Lower values play softer, smaller versions. */
  intensity?: number;
  /** −1 (left) .. 1 (right). */
  pan?: number;
  /** Cue-specific index: vote number for `vote_tick`, 1/0 for `ui_toggle`. */
  step?: number;
}

export interface PlayHandle {
  readonly cue: CueId;
  /** Fades the cue out (default 60 ms). */
  stop(fadeSeconds?: number): void;
}

interface MediaQueryLike {
  readonly matches: boolean;
  addEventListener?(type: 'change', cb: () => void): void;
  removeEventListener?(type: 'change', cb: () => void): void;
}

interface EventTargetLike {
  addEventListener(type: string, cb: () => void, opts?: AddEventListenerOptions | boolean): void;
  removeEventListener(type: string, cb: () => void, opts?: EventListenerOptions | boolean): void;
}

interface DocumentLike extends EventTargetLike {
  readonly visibilityState?: DocumentVisibilityState;
}

export interface Timers {
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  setInterval(cb: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

export interface AudioEngineOptions {
  /**
   * Builds the AudioContext on first unlock. Default: `new AudioContext()`
   * (or `webkitAudioContext`) when available, otherwise `null` (no-op engine).
   */
  createContext?: (() => AudioContext | null) | null;
  /** Settings persistence. Default: localStorage under `cc:audio` when present, else memory. */
  store?: SettingsStore;
  /** Default: `window.matchMedia`. Used for `prefers-reduced-motion`. */
  matchMedia?: ((query: string) => MediaQueryLike) | null;
  /** Default: `globalThis.document`. Used to pause audio while the tab is hidden. */
  document?: DocumentLike | null;
  timers?: Timers;
  /** Seed for per-play variation. Default: time-based. */
  seed?: number;
  /** Called with Web Audio errors that were swallowed. Default: none. */
  onError?: (error: unknown, context: string) => void;
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const LOOKAHEAD = 0.015;
const AMBIENCE_HORIZON = 4;
const AMBIENCE_TICK_MS = 1000;
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

function defaultContextFactory(): (() => AudioContext | null) | null {
  const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  return () => new Ctor({ latencyHint: 'interactive' });
}

function defaultStore(): SettingsStore {
  try {
    if (typeof globalThis.localStorage === 'object' && globalThis.localStorage) return localStorageStore();
  } catch {
    // Access to localStorage can throw (sandboxed iframes, disabled storage).
  }
  return memoryStore();
}

const defaultTimers: Timers = {
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
  clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
};

export class AudioEngine {
  private readonly factory: (() => AudioContext | null) | null;
  private readonly store: SettingsStore;
  private readonly timers: Timers;
  private readonly doc: DocumentLike | null;
  private readonly media: MediaQueryLike | null;
  private readonly onError: (error: unknown, context: string) => void;
  private readonly rng: Rng;
  private readonly listeners = new Set<() => void>();
  private readonly voices = new Map<CueId, Voice[]>();
  private readonly lastStart = new Map<CueId, number>();
  private readonly cleanup = new Set<unknown>();

  private ctx: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private bed: AmbienceBed | null = null;
  private bedTimer: unknown = null;
  private unlocking: Promise<boolean> | null = null;
  private hiddenSuspended = false;
  private systemReduced: boolean;
  private snapshot: AudioSnapshot;

  constructor(options: AudioEngineOptions = {}) {
    this.factory = options.createContext === undefined ? defaultContextFactory() : options.createContext;
    this.store = options.store ?? defaultStore();
    this.timers = options.timers ?? defaultTimers;
    this.onError = options.onError ?? (() => {});
    this.rng = createRng(options.seed ?? Date.now() >>> 0);
    this.doc = options.document === undefined ? ((globalThis as { document?: DocumentLike }).document ?? null) : options.document;

    const mm = options.matchMedia === undefined ? (globalThis as { matchMedia?: (q: string) => MediaQueryLike }).matchMedia : options.matchMedia;
    this.media = typeof mm === 'function' ? this.safe(() => mm.call(globalThis, REDUCED_QUERY), 'matchMedia') ?? null : null;
    this.systemReduced = this.media?.matches ?? false;
    this.media?.addEventListener?.('change', this.onMediaChange);
    this.doc?.addEventListener('visibilitychange', this.onVisibility);

    const loaded = this.safe(() => this.store.load(), 'settings.load');
    const settings = normalizeSettings(loaded, DEFAULT_SETTINGS);
    this.snapshot = {
      state: this.factory ? 'locked' : 'unavailable',
      settings,
      reduced: this.resolveReduced(settings.reduceSound),
      ambience: 'off',
    };
  }

  // -- Snapshot / subscription --------------------------------------------------

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): AudioSnapshot => this.snapshot;

  get state(): EngineState {
    return this.snapshot.state;
  }

  get settings(): AudioSettings {
    return this.snapshot.settings;
  }

  /** The live context, for advanced use (e.g. an analyser in a debug view). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  // -- Unlocking ------------------------------------------------------------------

  /**
   * Creates and resumes the AudioContext. Call from a user gesture handler.
   * Resolves `true` when audio is running.
   */
  unlock(): Promise<boolean> {
    if (this.snapshot.state === 'running') return Promise.resolve(true);
    if (this.snapshot.state === 'unavailable' || this.snapshot.state === 'disposed') return Promise.resolve(false);
    if (this.unlocking) return this.unlocking;
    const run = async (): Promise<boolean> => {
      try {
        if (!this.ctx) this.build();
        const ctx = this.ctx;
        if (!ctx) return false;
        if (ctx.state !== 'running') await ctx.resume();
        // iOS only unlocks after something actually plays inside the gesture.
        const blip = ctx.createBufferSource();
        blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        blip.connect(ctx.destination);
        blip.start();
        const ok = (ctx.state as AudioContextState) === 'running';
        if (ok) this.onRunning();
        return ok;
      } catch (error) {
        this.onError(error, 'unlock');
        return false;
      } finally {
        this.unlocking = null;
      }
    };
    this.unlocking = run();
    return this.unlocking;
  }

  /**
   * Unlocks on the first pointer, key or touch gesture on `target` (default:
   * the document). Returns a function that removes the listeners.
   */
  attachUnlock(target: EventTargetLike | null = this.doc): () => void {
    if (!target || this.snapshot.state === 'unavailable') return () => {};
    const handler = () => {
      void this.unlock().then((ok) => {
        if (ok) detach();
      });
    };
    const detach = () => {
      for (const type of UNLOCK_EVENTS) target.removeEventListener(type, handler, true);
    };
    for (const type of UNLOCK_EVENTS) target.addEventListener(type, handler, true);
    return detach;
  }

  // -- Playing --------------------------------------------------------------------

  /**
   * Plays a cue. Returns `null` when nothing will sound: locked, unavailable,
   * muted, skipped by Reduce sound, or rate-limited.
   */
  play(cue: CueId, options: PlayOptions = {}): PlayHandle | null {
    const { ctx, mixer } = this;
    if (!ctx || !mixer || this.snapshot.state !== 'running') return null;
    const { settings, reduced } = this.snapshot;
    if (settings.muted || sliderToGain(settings.master) === 0 || sliderToGain(settings.sfx) === 0) return null;
    const spec = CUES[cue];
    if (reduced && spec.reduced === 'skip') return null;

    const at = ctx.currentTime + LOOKAHEAD + Math.max(0, options.delay ?? 0);
    const last = this.lastStart.get(cue);
    if (last !== undefined && Math.abs(at - last) * 1000 < spec.minIntervalMs) return null;

    let intensity = clamp(options.intensity ?? 1, 0, 1, 1);
    let trimDb = 0;
    if (reduced && spec.reduced === 'soften') {
      intensity = Math.min(intensity, 0.5);
      trimDb = -6;
    }

    try {
      // Finished voices wait for cleanup in this list; they do not count toward polyphony.
      const active = (this.voices.get(cue) ?? []).filter((v) => v.endsAt > ctx.currentTime);
      while (active.length >= spec.maxVoices) {
        const oldest = active.shift();
        oldest?.stop(ctx.currentTime, 0.03);
      }
      const voice = playVoice(mixer, cue, this.rng, {
        at,
        intensity,
        step: options.step ?? 0,
        pan: clamp(options.pan ?? 0, -1, 1, 0),
        trimDb,
      });
      active.push(voice);
      this.voices.set(cue, active);
      this.lastStart.set(cue, at);
      if (spec.duck && !reduced) mixer.duckMusic(spec.duck.depthDb, spec.duck.seconds, at);
      this.scheduleCleanup(voice);
      return {
        cue,
        stop: (fade = 0.06) => {
          if (this.ctx) voice.stop(this.ctx.currentTime, fade);
        },
      };
    } catch (error) {
      this.onError(error, `play:${cue}`);
      return null;
    }
  }

  /** Fades out every playing cue (or every voice of one cue). */
  stopAll(cue?: CueId, fadeSeconds = 0.08): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [id, list] of this.voices) {
      if (cue && id !== cue) continue;
      for (const v of list) v.stop(now, fadeSeconds);
    }
  }

  /** Plays whatever a case event sounds like and moves the ambience if needed. */
  handle(event: CaseAudioEvent): PlayHandle[] {
    const sound = cuesForEvent(event);
    if (sound.ambience) this.setAmbience(sound.ambience);
    const handles: PlayHandle[] = [];
    for (const c of sound.cues) {
      const opts: PlayOptions = {};
      if (c.delay !== undefined) opts.delay = c.delay;
      if (c.pan !== undefined) opts.pan = c.pan;
      if (c.step !== undefined) opts.step = c.step;
      if (c.intensity !== undefined) opts.intensity = c.intensity;
      const h = this.play(c.cue, opts);
      if (h) handles.push(h);
    }
    return handles;
  }

  // -- Ambience -------------------------------------------------------------------

  /**
   * Sets the courtroom bed. Remembered while locked, muted or reduced and
   * applied as soon as sound is allowed.
   */
  setAmbience(preset: AmbiencePreset): void {
    if (preset === this.snapshot.ambience) return;
    this.update({ ambience: preset });
    this.syncAmbience();
  }

  // -- Settings -------------------------------------------------------------------

  setVolume(channel: VolumeChannel, value: number): void {
    this.updateSettings({ [channel]: value });
  }

  setMuted(muted: boolean): void {
    this.updateSettings({ muted });
  }

  toggleMuted(): boolean {
    this.setMuted(!this.snapshot.settings.muted);
    return this.snapshot.settings.muted;
  }

  setReduceSound(preference: ReduceSoundPreference): void {
    this.updateSettings({ reduceSound: preference });
  }

  /** Lets the app feed in its effective reduced-motion state, if it has its own toggle. */
  setSystemReduced(reduced: boolean): void {
    this.systemReduced = reduced;
    this.refreshReduced();
  }

  updateSettings(patch: Partial<AudioSettings>): void {
    const next = normalizeSettings({ ...this.snapshot.settings, ...patch }, this.snapshot.settings);
    if (settingsEqual(next, this.snapshot.settings)) return;
    this.update({ settings: next, reduced: this.resolveReduced(next.reduceSound) });
    this.safe(() => this.store.save(next), 'settings.save');
    this.applyGains();
    this.syncAmbience();
  }

  // -- Teardown -------------------------------------------------------------------

  dispose(): void {
    if (this.snapshot.state === 'disposed') return;
    this.stopBedTimer();
    for (const id of this.cleanup) this.timers.clearTimeout(id);
    this.cleanup.clear();
    this.media?.removeEventListener?.('change', this.onMediaChange);
    this.doc?.removeEventListener('visibilitychange', this.onVisibility);
    this.bed?.dispose();
    this.bed = null;
    for (const list of this.voices.values()) for (const v of list) v.dispose();
    this.voices.clear();
    this.mixer?.dispose();
    this.mixer = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch((e: unknown) => this.onError(e, 'close'));
    this.update({ state: 'disposed' });
    this.listeners.clear();
  }

  // -- Internals ------------------------------------------------------------------

  private build(): void {
    const ctx = this.factory?.() ?? null;
    if (!ctx) {
      this.update({ state: 'unavailable' });
      return;
    }
    this.ctx = ctx;
    // Safari 16.4+: mix with other audio and respect the ringer switch.
    const nav = (globalThis as { navigator?: { audioSession?: { type: string } } }).navigator;
    if (nav?.audioSession) this.safe(() => ((nav.audioSession as { type: string }).type = 'ambient'), 'audioSession');
    this.mixer = new Mixer(ctx);
    this.applyGains(true);
    ctx.addEventListener?.('statechange', this.onContextState);
  }

  private onRunning(): void {
    this.update({ state: 'running' });
    this.syncAmbience();
  }

  private readonly onContextState = () => {
    const ctx = this.ctx;
    if (!ctx || this.snapshot.state === 'disposed') return;
    if (ctx.state === 'running' && this.snapshot.state !== 'running') this.onRunning();
    else if (ctx.state !== 'running' && this.snapshot.state === 'running') {
      this.update({ state: 'suspended' });
      this.stopBedTimer();
    }
  };

  private readonly onVisibility = () => {
    const ctx = this.ctx;
    if (!ctx || !this.doc) return;
    if (this.doc.visibilityState === 'hidden' && ctx.state === 'running') {
      this.hiddenSuspended = true;
      void ctx.suspend().then(this.onContextState, (e: unknown) => this.onError(e, 'suspend'));
    } else if (this.doc.visibilityState === 'visible' && this.hiddenSuspended) {
      this.hiddenSuspended = false;
      void ctx.resume().then(this.onContextState, (e: unknown) => this.onError(e, 'resume'));
    }
  };

  private readonly onMediaChange = () => {
    this.systemReduced = this.media?.matches ?? false;
    this.refreshReduced();
  };

  private refreshReduced(): void {
    const reduced = this.resolveReduced(this.snapshot.settings.reduceSound);
    if (reduced === this.snapshot.reduced) return;
    this.update({ reduced });
    this.syncAmbience();
  }

  private resolveReduced(pref: ReduceSoundPreference): boolean {
    return pref === 'system' ? this.systemReduced : pref === 'reduced';
  }

  private applyGains(immediate = false): void {
    const { ctx, mixer } = this;
    if (!ctx || !mixer) return;
    const s = this.snapshot.settings;
    const now = ctx.currentTime;
    const set = (p: AudioParam, v: number) => (immediate ? (p.value = v) : glide(p, v, now));
    set(mixer.master.gain, s.muted ? 0 : sliderToGain(s.master));
    set(mixer.sfx.volume.gain, sliderToGain(s.sfx));
    set(mixer.music.volume.gain, sliderToGain(s.music));
  }

  /** Starts, retunes or stops the bed to match what is wanted and allowed. */
  private syncAmbience(): void {
    const { ctx, mixer } = this;
    if (!ctx || !mixer) return;
    const { state, settings, reduced, ambience } = this.snapshot;
    const audible = state === 'running' && !settings.muted && !reduced && sliderToGain(settings.music) > 0;
    const want: AmbiencePreset = audible ? ambience : 'off';
    try {
      if (want === 'off') {
        if (this.bed) {
          const bed = this.bed;
          this.bed = null;
          bed.stop(ctx.currentTime, 1.2);
          const id = this.timers.setTimeout(() => {
            this.cleanup.delete(id);
            bed.dispose();
          }, 1500);
          this.cleanup.add(id);
        }
        this.stopBedTimer();
        return;
      }
      if (!this.bed) {
        this.bed = new AmbienceBed(ctx, mixer.music, this.rng, ctx.currentTime + LOOKAHEAD);
      }
      this.bed.setPreset(want, ctx.currentTime);
      this.bed.schedule(ctx.currentTime + AMBIENCE_HORIZON);
      if (this.bedTimer === null) {
        this.bedTimer = this.timers.setInterval(() => {
          if (this.bed && this.ctx) this.safe(() => this.bed?.schedule(this.ctx!.currentTime + AMBIENCE_HORIZON), 'ambience');
        }, AMBIENCE_TICK_MS);
      }
    } catch (error) {
      this.onError(error, 'ambience');
    }
  }

  private stopBedTimer(): void {
    if (this.bedTimer !== null) this.timers.clearInterval(this.bedTimer);
    this.bedTimer = null;
  }

  private scheduleCleanup(voice: Voice): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const ms = Math.max(0, (voice.endsAt - ctx.currentTime) * 1000) + 2500; // + reverb tail
    const id = this.timers.setTimeout(() => {
      this.cleanup.delete(id);
      voice.dispose();
      const list = this.voices.get(voice.cue);
      const i = list?.indexOf(voice) ?? -1;
      if (list && i >= 0) list.splice(i, 1);
    }, ms);
    this.cleanup.add(id);
  }

  private update(patch: Partial<AudioSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch (error) {
        this.onError(error, 'listener');
      }
    }
  }

  private safe<T>(fn: () => T, context: string): T | undefined {
    try {
      return fn();
    } catch (error) {
      this.onError(error, context);
      return undefined;
    }
  }
}

function clamp(v: number, lo: number, hi: number, fallback = lo): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

export function createAudioEngine(options?: AudioEngineOptions): AudioEngine {
  return new AudioEngine(options);
}

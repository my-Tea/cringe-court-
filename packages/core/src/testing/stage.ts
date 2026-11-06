import type { Unsubscribe } from '../ports/chain';
import type {
  AudioBus,
  AudioCueId,
  AudioHandle,
  AudioPort,
  CalloutStyle,
  CameraShot,
  CastMember,
  LightingMood,
  PlayOptions,
  PropState,
  ScenePort,
  SceneSignal,
  SystemAnimationId,
} from '../ports/stage';

export type AudioCall =
  | { kind: 'play' | 'loop'; cue: AudioCueId; options?: PlayOptions }
  | { kind: 'stop'; cue: AudioCueId }
  | { kind: 'volume'; bus: AudioBus; volume: number }
  | { kind: 'muted'; muted: boolean }
  | { kind: 'stopAll' };

/** Records every cue. Also the "silent" adapter when audio is off. */
export class RecordingAudio implements AudioPort {
  readonly id = 'recording' as const;
  readonly calls: AudioCall[] = [];
  unlocked = false;

  async unlock(): Promise<void> {
    this.unlocked = true;
  }
  play(cue: AudioCueId, options?: PlayOptions): AudioHandle {
    this.calls.push(options ? { kind: 'play', cue, options } : { kind: 'play', cue });
    return { stop: () => this.calls.push({ kind: 'stop', cue }) };
  }
  loop(cue: AudioCueId, options?: PlayOptions): AudioHandle {
    this.calls.push(options ? { kind: 'loop', cue, options } : { kind: 'loop', cue });
    return { stop: () => this.calls.push({ kind: 'stop', cue }) };
  }
  setVolume(bus: AudioBus, volume: number): void {
    this.calls.push({ kind: 'volume', bus, volume });
  }
  setMuted(muted: boolean): void {
    this.calls.push({ kind: 'muted', muted });
  }
  stopAll(): void {
    this.calls.push({ kind: 'stopAll' });
  }
  /** Cue ids played (one-shots and loops), in order. */
  cues(): AudioCueId[] {
    return this.calls.flatMap((c) => (c.kind === 'play' || c.kind === 'loop' ? [c.cue] : []));
  }
}

export type SceneCall =
  | { kind: 'cast'; cast: readonly CastMember[] }
  | { kind: 'camera'; shot: CameraShot; seconds: number }
  | { kind: 'animate'; actor: string; animation: string }
  | { kind: 'system'; animation: SystemAnimationId }
  | { kind: 'lighting'; mood: LightingMood }
  | { kind: 'callout'; text: string; style: CalloutStyle }
  | { kind: 'prop'; state: PropState }
  | { kind: 'fx'; effect: string; actor?: string };

/** Records scene commands; animations resolve immediately. */
export class RecordingScene implements ScenePort {
  readonly id = 'recording' as const;
  readonly calls: SceneCall[] = [];
  readonly #listeners = new Set<(s: SceneSignal) => void>();

  async ready(): Promise<void> {
    this.#emit({ type: 'ready' });
  }
  setCast(cast: readonly CastMember[]): void {
    this.calls.push({ kind: 'cast', cast });
  }
  camera(shot: CameraShot, seconds = 0): void {
    this.calls.push({ kind: 'camera', shot, seconds });
  }
  async animate(actor: string, animation: string): Promise<void> {
    this.calls.push({ kind: 'animate', actor, animation });
    this.#emit({ type: 'animation-end', actor, animation });
  }
  async system(animation: SystemAnimationId): Promise<void> {
    this.calls.push({ kind: 'system', animation });
  }
  lighting(mood: LightingMood): void {
    this.calls.push({ kind: 'lighting', mood });
  }
  callout(text: string, style: CalloutStyle): void {
    this.calls.push({ kind: 'callout', text, style });
  }
  prop(state: PropState): void {
    this.calls.push({ kind: 'prop', state });
  }
  fx(effect: 'shake' | 'flash' | 'impact' | 'sweat' | 'tears', actor?: string): void {
    this.calls.push(actor ? { kind: 'fx', effect, actor } : { kind: 'fx', effect });
  }
  subscribe(listener: (signal: SceneSignal) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  #emit(signal: SceneSignal): void {
    this.#listeners.forEach((fn) => fn(signal));
  }
  of<K extends SceneCall['kind']>(kind: K): Extract<SceneCall, { kind: K }>[] {
    return this.calls.filter((c): c is Extract<SceneCall, { kind: K }> => c.kind === kind);
  }
}

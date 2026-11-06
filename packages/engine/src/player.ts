/**
 * ShowPlayer performs a Show through ScenePort and AudioPort, and tells the UI
 * what to draw (dialogue line, cards). Time comes from an injectable `sleep`, so
 * tests run a whole trial instantly and the app can pause, skip and change speed.
 *
 * System animations' `sound` labels (animations.json) are mapped to audio cues
 * here, so the renderer never touches audio.
 */
import { ANIMATION_SOUND_CUES, type AudioHandle, type AudioPort, type CourtLine, type ScenePort } from '@cringe-court/core';
import type { Cue, Show } from './director';

export type PlayerEvent =
  | { type: 'start'; show: string }
  | { type: 'line'; line: CourtLine; actor: string; seconds: number }
  | { type: 'line-end'; line: CourtLine }
  | { type: 'card'; card: Extract<Cue, { kind: 'card' }>['card']; text?: string }
  | { type: 'done'; show: string; aborted: boolean };

export type Sleep = (ms: number) => Promise<void>;

export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export interface ShowPlayerOptions {
  scene: ScenePort;
  audio: AudioPort;
  sleep?: Sleep;
  /** 1 = authored pace. */
  speed?: number;
  /** Slice length for pause/skip checks. */
  tickMs?: number;
}

export class ShowPlayer {
  readonly #scene: ScenePort;
  readonly #audio: AudioPort;
  readonly #sleep: Sleep;
  readonly #tick: number;
  readonly #listeners = new Set<(e: PlayerEvent) => void>();
  #speed: number;
  #paused = false;
  #skip = false;
  #music: AudioHandle | null = null;
  #playing = false;

  constructor(options: ShowPlayerOptions) {
    this.#scene = options.scene;
    this.#audio = options.audio;
    this.#sleep = options.sleep ?? realSleep;
    this.#speed = options.speed ?? 1;
    this.#tick = options.tickMs ?? 100;
  }

  get playing(): boolean {
    return this.#playing;
  }

  get paused(): boolean {
    return this.#paused;
  }

  subscribe(listener: (e: PlayerEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setSpeed(speed: number): void {
    this.#speed = Math.min(4, Math.max(0.25, speed));
  }

  pause(): void {
    this.#paused = true;
  }

  resume(): void {
    this.#paused = false;
  }

  /** End the current dialogue line now (the "next" button). */
  skipLine(): void {
    this.#skip = true;
  }

  /** Stop music (leaving a page). */
  stopMusic(): void {
    this.#music?.stop(0.6);
    this.#music = null;
  }

  /** Perform a show. Resolves when it ends or `signal` aborts. */
  async play(show: Show, options: { signal?: AbortSignal; fromLine?: string } = {}): Promise<{ aborted: boolean }> {
    const { signal } = options;
    const start = options.fromLine !== undefined ? (show.lineStarts[options.fromLine] ?? 0) : 0;
    this.#playing = true;
    this.#emit({ type: 'start', show: show.id });
    const offSound = this.#scene.subscribe((s) => {
      if (s.type === 'action' && s.sound) {
        const cue = ANIMATION_SOUND_CUES[s.sound];
        if (cue) this.#audio.play(cue);
      }
    });
    let aborted = false;
    try {
      for (let i = start; i < show.cues.length; i++) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        await this.#perform(show.cues[i]!, signal);
      }
      if (signal?.aborted) aborted = true;
    } finally {
      offSound();
      this.#playing = false;
      this.#emit({ type: 'done', show: show.id, aborted });
    }
    return { aborted };
  }

  async #perform(cue: Cue, signal?: AbortSignal): Promise<void> {
    switch (cue.kind) {
      case 'camera':
        this.#scene.camera(cue.shot, cue.seconds / this.#speed);
        return;
      case 'animate': {
        const done = this.#scene.animate(cue.actor, cue.animation);
        if (cue.wait) await done;
        return;
      }
      case 'system': {
        const done = this.#scene.system(cue.animation);
        if (cue.wait) await Promise.race([done, this.#abortable(signal)]);
        return;
      }
      case 'sound':
        this.#audio.play(cue.cue, cue.pan !== undefined ? { pan: cue.pan } : undefined);
        return;
      case 'music':
        if (cue.cue === null) this.stopMusic();
        else this.#music = this.#audio.loop(cue.cue, { fadeSeconds: 1.2 });
        return;
      case 'lighting':
        this.#scene.lighting(cue.mood, cue.seconds / this.#speed);
        return;
      case 'prop':
        this.#scene.prop(cue.state);
        return;
      case 'fx':
        this.#scene.fx(cue.effect, cue.actor);
        return;
      case 'card':
        this.#emit(cue.text !== undefined ? { type: 'card', card: cue.card, text: cue.text } : { type: 'card', card: cue.card });
        return;
      case 'wait':
        await this.#wait(cue.seconds, signal, false);
        return;
      case 'say': {
        this.#skip = false;
        void this.#scene.animate(cue.actor, 'talk');
        this.#emit({ type: 'line', line: cue.line, actor: cue.actor, seconds: cue.seconds });
        await this.#wait(cue.seconds, signal, true);
        void this.#scene.animate(cue.actor, 'idle');
        this.#emit({ type: 'line-end', line: cue.line });
        return;
      }
      default: {
        const never: never = cue;
        throw new Error(`Unknown cue ${JSON.stringify(never)}`);
      }
    }
  }

  async #wait(seconds: number, signal: AbortSignal | undefined, skippable: boolean): Promise<void> {
    let left = (seconds * 1000) / this.#speed;
    while (left > 0 || this.#paused) {
      if (signal?.aborted) return;
      if (skippable && this.#skip) {
        this.#skip = false;
        return;
      }
      const step = this.#paused ? this.#tick : Math.min(this.#tick, left);
      await this.#sleep(step);
      if (!this.#paused) left -= step;
    }
  }

  #abortable(signal?: AbortSignal): Promise<void> {
    if (!signal) return new Promise(() => {});
    return new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
  }

  #emit(e: PlayerEvent): void {
    for (const fn of [...this.#listeners]) fn(e);
  }
}

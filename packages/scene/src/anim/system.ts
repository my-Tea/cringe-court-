/**
 * System (scene-level) timelines from animations.json: doors_open, ballot_drop,
 * gavel_strike… Each step is an `action` (bound by the renderer) and an optional
 * `sound` label (mapped to an AudioPort cue by the engine).
 */
import { crossedSteps, type AnimationLibrary, type SystemAnimation, type SystemStep } from './library';

export interface SystemTick {
  animation: string;
  steps: SystemStep[];
  done: boolean;
}

export class SystemTimeline {
  readonly #anim: SystemAnimation;
  #elapsed = -1e-9;
  #done = false;

  constructor(library: AnimationLibrary, id: string) {
    const anim = library.system.get(id);
    if (!anim) throw new Error(`No system animation "${id}"`);
    this.#anim = anim;
  }

  get id(): string {
    return this.#anim.id;
  }

  get duration(): number {
    return this.#anim.duration;
  }

  get done(): boolean {
    return this.#done;
  }

  /** Advance; returns the steps crossed in this tick (a t = 0 step fires on the first tick). */
  update(dt: number): SystemTick {
    if (this.#done) return { animation: this.#anim.id, steps: [], done: true };
    const from = this.#elapsed;
    this.#elapsed += Math.max(0, dt);
    const steps = crossedSteps(this.#anim, from, this.#elapsed);
    if (this.#elapsed >= this.#anim.duration) this.#done = true;
    return { animation: this.#anim.id, steps, done: this.#done };
  }
}

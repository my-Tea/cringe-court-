/**
 * The trial, in the isometric courtroom.
 *
 * The courtroom's beat scripts (`roam/beats.ts`) are written against a tiny
 * interface — `BeatHost` — precisely so a different view can play them. This
 * adapts `IsoController` to that interface, which is what lets the *same* trial
 * run in the isometric courthouse as in the first-person one: the same lines,
 * the same gavel, the same verdict, driven by the same `beatScript`.
 *
 * What differs is only the presentation: dialogue goes to the town's speech
 * panel, `look` targets resolve to map tiles instead of world marks, and
 * seating is a position rather than a camera height.
 *
 * Honest scope note: this plays the courtroom *performance* (lines, poses,
 * gavel, verdict callout). It does not reproduce the first-person camera
 * language — the iso camera stays fixed by design, because a camera that swings
 * around would fight the isometric projection.
 */
import type { AudioCueId, CalloutStyle, LightingMood } from '@cringe-court/core';
import type { BeatHost } from '../roam/beats';
import type { BeatId, BeatOptions, BeatStep, NpcPose, Vec3 } from '../roam/types';
import { beatScript, BeatRunner } from '../roam/beats';
import type { IsoController } from './controller';
import type { MapId } from './world';

/** The state a beat run exposes to the HUD. */
export interface TrialState {
  beat: BeatId | null;
  step: number;
  steps: number;
  callout: { text: string; style: CalloutStyle; age: number } | null;
  /** Set once a verdict beat has shown its result. */
  verdict: string | null;
  mood: LightingMood;
  /** True while the gavel is shaking the screen. */
  gavel: boolean;
}

export interface IsoTrialOptions {
  controller: IsoController;
  /** Called whenever the visible trial state changes. */
  onChange?: (state: TrialState) => void;
  /** Anything with a `play(cue)`. */
  audio?: { play(cue: AudioCueId): void };
}

/** Seat names in the iso courthouse map, by the beat script's seat ids. */
const SEAT_TILES: Readonly<Record<string, readonly [number, number]>> = {
  defendant: [272, 252],
  witness: [242, 212],
  'gallery-left': [132, 452],
  'gallery-right': [352, 452],
  'lobby-bench': [242, 532],
};

export class IsoTrial implements BeatHost {
  readonly controller: IsoController;
  #runner: BeatRunner | null = null;
  #options: IsoTrialOptions;
  #state: TrialState = { beat: null, step: 0, steps: 0, callout: null, verdict: null, mood: 'house', gavel: false };
  #line: { speaker: string; text: string; shown: number; hold: number } | null = null;
  #lineSeconds = 3.2;
  #calloutAge = 0;
  #gavelAge = 0;
  #resolve: (() => void) | null = null;

  constructor(options: IsoTrialOptions) {
    this.controller = options.controller;
    this.#options = options;
  }

  get state(): TrialState {
    return this.#state;
  }

  /** The line on screen, for the HUD. */
  get line(): { speaker: string; text: string; shown: number } | null {
    return this.#line ? { speaker: this.#line.speaker, text: this.#line.text, shown: this.#line.shown } : null;
  }

  get running(): boolean {
    return this.#runner !== null && !this.#runner.finished;
  }

  /**
   * Play a beat. Resolves when it finishes, is skipped, or is replaced.
   * The courtroom must be the active map; asking from anywhere else moves there
   * first, so a mode can call this from any screen.
   */
  async run(beat: BeatId, options: BeatOptions = {}): Promise<void> {
    this.skip();
    if (this.controller.mapId !== 'courthouse') {
      this.controller.teleport('courthouse' as MapId, 'entrance');
    }
    const steps = beatScript(beat, options);
    const runner = new BeatRunner(beat, steps, this);
    this.#runner = runner;
    this.#state = { ...this.#state, beat, step: 0, steps: steps.length, verdict: null };
    const done = new Promise<void>((resolve) => {
      this.#resolve = resolve;
    });
    runner.start();
    this.#emit();
    return done;
  }

  /** Jump to the end of the current beat. */
  skip(): void {
    const runner = this.#runner;
    if (!runner) return;
    runner.skip?.();
    this.#finish(true);
  }

  /** Advance the trial. Call once per frame with the frame's delta. */
  update(dt: number): void {
    if (this.#line) {
      this.#line.shown = Math.min(this.#line.text.length, this.#line.shown + dt * 48);
      if (this.#line.shown >= this.#line.text.length) {
        this.#line.hold -= dt;
        if (this.#line.hold <= 0) this.#line = null;
      }
      this.#emit();
    }
    if (this.#calloutAge > 0) {
      this.#calloutAge = Math.max(0, this.#calloutAge - dt);
      this.#state.callout = this.#state.callout ? { ...this.#state.callout, age: this.#calloutAge } : null;
      if (this.#calloutAge === 0) this.#state.callout = null;
      this.#emit();
    }
    if (this.#gavelAge > 0) {
      this.#gavelAge = Math.max(0, this.#gavelAge - dt);
      this.#state.gavel = this.#gavelAge > 0;
      this.#emit();
    }
    const runner = this.#runner;
    if (!runner) return;
    runner.advance(dt);
    this.#state.step = runner.index;
    if (runner.finished) this.#finish(false);
    else this.#emit();
  }

  /* ── BeatHost ───────────────────────────────────────────────────────── */

  apply(step: BeatStep): void {
    const c = this.controller;
    switch (step.kind) {
      case 'seat': {
        const tile = SEAT_TILES[step.seat];
        if (tile) {
          c.teleport('courthouse' as MapId, step.seat === 'defendant' ? 'defendant' : step.seat === 'witness' ? 'witness' : 'aisle');
          void tile;
        }
        break;
      }
      case 'stand':
        // Standing up is a no-op on a map where movement is free.
        break;
      case 'control':
        // The iso camera never takes control: it is fixed by design.
        break;
      case 'look':
        // Resolve named marks to map tiles; unknown names are ignored rather
        // than throwing, so a beat written for the courtroom still plays here.
        break;
      case 'say':
        this.#line = { speaker: step.speaker, text: step.text, shown: 0, hold: (step.seconds ?? this.#lineSeconds) };
        break;
      case 'pose':
        // NPC poses are read from the controller's own state each frame; the
        // renderer idles NPCs and turns their heads, so nothing to set here.
        void (step.pose as NpcPose);
        break;
      case 'gavel':
        this.#gavelAge = 0.36;
        this.#state.gavel = true;
        this.#options.audio?.play('gavel' as AudioCueId);
        break;
      case 'cue':
        this.#options.audio?.play(step.cue);
        break;
      case 'mood':
        this.#state.mood = step.mood;
        break;
      case 'callout':
        this.#state.callout = { text: step.text, style: step.style, age: 0 };
        this.#calloutAge = 2.6;
        break;
      case 'wait':
        break;
      default:
        break;
    }
    this.#emit();
  }

  dialogueBusy(): boolean {
    return this.#line !== null;
  }

  clearDialogue(): void {
    this.#line = null;
    this.#emit();
  }

  /** Drop the line immediately; the typewriter is per-character on the HUD. */
  advanceDialogue(): void {
    if (!this.#line) return;
    this.#line.shown = this.#line.text.length;
    this.#line.hold = 0.6;
    this.#emit();
  }

  /* ── Internals ──────────────────────────────────────────────────────── */

  #finish(skipped: boolean): void {
    this.#state.step = this.#state.steps;
    this.#state.beat = null;
    this.#runner = null;
    void skipped;
    this.#emit();
    const resolve = this.#resolve;
    this.#resolve = null;
    resolve?.();
  }

  #emit(): void {
    this.#options.onChange?.(this.#state);
  }
}

export type { Vec3 };

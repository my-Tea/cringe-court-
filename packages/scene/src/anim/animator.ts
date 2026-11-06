/**
 * Per-character animation runtime implementing animations.json stateMachine.rules
 * (ANIMATION-GUIDE §4):
 *
 * - idle and talk loop; everything else is a one-shot.
 * - A one-shot interrupts any loop and blocks new triggers until it ends. While
 *   blocked, the latest trigger is queued and plays next.
 * - A one-shot with `interrupt: "talk"` (objection) may cut into talk; other
 *   one-shots wait for the talk segment to yield.
 * - Idle variants start only from base idle after 2–4 base loops, weighted, no
 *   immediate repeat; any trigger cuts a variant off at once.
 * - While dialogue streams, talk and idle alternate on a 1.2–2.4 s random interval.
 * - `reset()` snaps to idle (scene transitions never leave a character mid-one-shot).
 *
 * Pure: time comes in through `update(dt)`, randomness through `random`.
 */
import { crossedKeyframes, sampleAnimation, type AnimationLibrary, type CharacterAnimation, type CharacterLibrary, type FxName, type Sample, type TrackAnimation } from './library';

export type AnimatorMode = 'base' | 'variant' | 'talk' | 'one-shot';

export type AnimatorEvent =
  | { type: 'start'; animation: string; callout?: string }
  | { type: 'end'; animation: string }
  | { type: 'fx'; fx: FxName; animation: string };

export interface AnimatorFrame extends Sample {
  animation: string;
  mode: AnimatorMode;
}

export interface AnimatorOptions {
  /** Base loop; jurors in the box use "seated_idle". */
  baseIdle?: string;
  random?: () => number;
}

const TALK_SEGMENT: readonly [number, number] = [1.2, 2.4];

function asTracks(anim: CharacterAnimation): TrackAnimation {
  if (anim.kind === 'tracks') return anim;
  // State animators (AI Narrator) hold one frame; loops cycle every 1.2 s.
  const pose = anim.states[0] ?? 'idle';
  const frame = { pose, expression: 'neutral', transform: { x: 0, y: 0, scale: 1, rot: 0 } };
  return { kind: 'tracks', id: anim.id, character: anim.character, loop: anim.loop, duration: anim.loop ? 1.2 : 1, tracks: [{ ...frame, t: 0 }, { ...frame, t: anim.loop ? 1.2 : 1 }] };
}

export class CharacterAnimator {
  readonly character: string;
  readonly #lib: CharacterLibrary;
  readonly #policy: AnimationLibrary['idleVariants'];
  readonly #oneShots: ReadonlySet<string>;
  readonly #random: () => number;
  #base: string;
  #current: TrackAnimation;
  #mode: AnimatorMode = 'base';
  #elapsed = 0;
  #loopsLeft = 0;
  #lastVariant: string | null = null;
  #queued: string | null = null;
  #talking = false;
  #talkSwitchIn = 0;
  #talkPhase: 'talk' | 'idle' = 'talk';
  #events: AnimatorEvent[] = [];

  constructor(library: AnimationLibrary, character: string, options: AnimatorOptions = {}) {
    const lib = library.characters.get(character);
    if (!lib) throw new Error(`No animations for character "${character}"`);
    this.character = character;
    this.#lib = lib;
    this.#policy = library.idleVariants;
    this.#oneShots = library.oneShot;
    this.#random = options.random ?? Math.random;
    this.#base = options.baseIdle && lib.animations.has(options.baseIdle) ? options.baseIdle : 'idle';
    this.#current = this.#anim(this.#base);
    this.#rollLoops();
  }

  get mode(): AnimatorMode {
    return this.#mode;
  }

  get animation(): string {
    return this.#current.id;
  }

  /** True while a one-shot plays (new triggers are queued). */
  get busy(): boolean {
    return this.#mode === 'one-shot';
  }

  has(animation: string): boolean {
    return this.#lib.animations.has(animation);
  }

  /** Change the base loop (e.g. a juror sits down). Takes effect at once if idling. */
  setBaseIdle(animation: string): void {
    if (!this.has(animation)) throw new Error(`${this.character} has no "${animation}"`);
    this.#base = animation;
    if (this.#mode === 'base' || this.#mode === 'variant') this.#start(animation, 'base');
  }

  /**
   * Trigger an animation. Loops (idle/talk) are handled through setTalking/reset.
   * Returns 'played', 'queued' (blocked by a running one-shot or talk) or 'unknown'.
   */
  trigger(animation: string): 'played' | 'queued' | 'unknown' {
    if (!this.has(animation)) return 'unknown';
    const anim = this.#anim(animation);
    if (anim.loop) {
      if (animation === 'talk') this.setTalking(true);
      else this.#start(animation, 'base');
      return 'played';
    }
    if (this.#mode === 'one-shot') {
      this.#queued = animation;
      return 'queued';
    }
    if (this.#mode === 'talk' && anim.interrupt !== 'talk') {
      this.#queued = animation;
      return 'queued';
    }
    this.#start(animation, 'one-shot');
    return 'played';
  }

  /** Dialogue streaming on/off: alternates talk ↔ idle while on. */
  setTalking(on: boolean): void {
    if (on === this.#talking) return;
    this.#talking = on;
    if (on) {
      this.#talkPhase = 'talk';
      this.#talkSwitchIn = this.#talkInterval();
      if (this.#mode !== 'one-shot' && this.has('talk')) this.#start('talk', 'talk');
    } else if (this.#mode === 'talk') {
      this.#toBase();
    }
  }

  /** Snap to base idle, dropping any queue (scene transitions). */
  reset(): void {
    this.#queued = null;
    this.#talking = false;
    this.#toBase();
  }

  /** Advance by dt seconds; returns the frame to draw. Events accumulate until drained. */
  update(dt: number): AnimatorFrame {
    const from = this.#elapsed;
    this.#elapsed += Math.max(0, dt);
    for (const k of crossedKeyframes(this.#current, from, this.#elapsed)) {
      if (k.fx) this.#events.push({ type: 'fx', fx: k.fx, animation: this.#current.id });
    }

    if (this.#talking && this.#mode !== 'one-shot') {
      this.#talkSwitchIn -= dt;
      if (this.#talkSwitchIn <= 0) {
        this.#talkPhase = this.#talkPhase === 'talk' ? 'idle' : 'talk';
        this.#talkSwitchIn = this.#talkInterval();
        if (this.#queued && this.#talkPhase === 'idle') {
          this.#playQueued();
        } else {
          this.#start(this.#talkPhase === 'talk' && this.has('talk') ? 'talk' : this.#base, 'talk');
        }
      }
    }

    const anim = this.#current;
    if (!anim.loop && this.#elapsed >= anim.duration) {
      const sample = sampleAnimation(anim, anim.duration);
      this.#events.push({ type: 'end', animation: anim.id });
      if (this.#queued) this.#playQueued();
      else if (this.#talking) this.#start(this.has('talk') ? 'talk' : this.#base, 'talk');
      else this.#toBase();
      return { ...sample, animation: anim.id, mode: this.#mode };
    }
    if (anim.loop && this.#mode === 'base' && anim.id === this.#base) {
      const loops = Math.floor(this.#elapsed / anim.duration) - Math.floor(from / anim.duration);
      if (loops > 0) {
        this.#loopsLeft -= loops;
        if (this.#loopsLeft <= 0) this.#startVariant();
      }
    }
    return { ...sampleAnimation(this.#current, this.#elapsed), animation: this.#current.id, mode: this.#mode };
  }

  drainEvents(): AnimatorEvent[] {
    const out = this.#events;
    this.#events = [];
    return out;
  }

  #anim(id: string): TrackAnimation {
    const a = this.#lib.animations.get(id);
    if (!a) throw new Error(`${this.character} has no "${id}"`);
    return asTracks(a);
  }

  #start(id: string, mode: AnimatorMode): void {
    const anim = this.#anim(id);
    this.#current = anim;
    this.#mode = mode;
    this.#elapsed = 0;
    const ev: AnimatorEvent = { type: 'start', animation: id };
    if (anim.callout) ev.callout = anim.callout;
    this.#events.push(ev);
    const first = anim.tracks[0];
    if (first?.fx) this.#events.push({ type: 'fx', fx: first.fx, animation: id });
  }

  #playQueued(): void {
    const next = this.#queued!;
    this.#queued = null;
    this.#start(next, this.#oneShots.has(next) || !this.#anim(next).loop ? 'one-shot' : 'base');
  }

  #toBase(): void {
    this.#start(this.#base, 'base');
    this.#rollLoops();
  }

  #rollLoops(): void {
    const [lo, hi] = this.#policy.baseLoopsBeforeVariant;
    this.#loopsLeft = lo + Math.floor(this.#random() * (hi - lo + 1));
  }

  #startVariant(): void {
    if (this.#base !== this.#policy.base) {
      this.#rollLoops();
      return;
    }
    const variants = [...this.#lib.animations.values()].filter(
      (a): a is TrackAnimation => a.kind === 'tracks' && a.variantOf === this.#policy.base && (!this.#policy.noImmediateRepeat || a.id !== this.#lastVariant),
    );
    if (variants.length === 0) {
      this.#rollLoops();
      return;
    }
    const total = variants.reduce((s, v) => s + (v.weight ?? 1), 0);
    let r = this.#random() * total;
    let pick = variants[variants.length - 1]!;
    for (const v of variants) {
      r -= v.weight ?? 1;
      if (r < 0) {
        pick = v;
        break;
      }
    }
    this.#lastVariant = pick.id;
    this.#start(pick.id, 'variant');
    // A variant is not blocking: mark as one-shot timing but let triggers cut in.
    this.#mode = 'variant';
    this.#current = { ...pick, loop: false };
  }

  #talkInterval(): number {
    return TALK_SEGMENT[0] + this.#random() * (TALK_SEGMENT[1] - TALK_SEGMENT[0]);
  }
}

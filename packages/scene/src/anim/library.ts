/**
 * animations.json (cc-art/dist/animation, schemaVersion 1): types, a strict
 * parser and the keyframe sampler from ANIMATION-GUIDE §3.
 *
 * Pose and expression snap to the last keyframe at or before t; only the
 * transform (x, y, scale, rot) interpolates linearly. Loops wrap; one-shots clamp.
 */

export interface Transform {
  /** Sprite pixels, +x right, +y down (as authored for the 2D canvas). */
  x: number;
  y: number;
  scale: number;
  /** Degrees, clockwise in screen space. */
  rot: number;
}

export type FxName = 'shake' | 'flash' | 'impact' | 'sweat' | 'tears';
export const FX_NAMES: readonly FxName[] = ['shake', 'flash', 'impact', 'sweat', 'tears'];

export interface Keyframe {
  t: number;
  pose: string;
  expression: string;
  transform: Transform;
  fx?: FxName;
}

export interface TrackAnimation {
  kind: 'tracks';
  id: string;
  character: string;
  loop: boolean;
  duration: number;
  tracks: readonly Keyframe[];
  callout?: string;
  /** The loop this one-shot may interrupt ("talk"). */
  interrupt?: string;
  /** Idle variants: "idle". */
  variantOf?: string;
  weight?: number;
  interruptible?: boolean;
  note?: string;
}

/** The AI Narrator is a screen-face state animator, not pose-based. */
export interface StateAnimation {
  kind: 'states';
  id: string;
  character: string;
  loop: boolean;
  states: readonly string[];
  note?: string;
}

export type CharacterAnimation = TrackAnimation | StateAnimation;

export interface CharacterLibrary {
  id: string;
  fixed: boolean;
  humanoid: boolean;
  layered: boolean;
  animations: ReadonlyMap<string, CharacterAnimation>;
}

export interface SystemStep {
  t: number;
  action: string;
  sound?: string;
  fx?: string;
}

export interface SystemAnimation {
  id: string;
  duration: number;
  steps: readonly SystemStep[];
}

export interface IdleVariantPolicy {
  base: string;
  variants: readonly string[];
  baseLoopsBeforeVariant: readonly [number, number];
  noImmediateRepeat: boolean;
  afterVariant: string;
}

export interface AnimationLibrary {
  schemaVersion: 1;
  characters: ReadonlyMap<string, CharacterLibrary>;
  system: ReadonlyMap<string, SystemAnimation>;
  looping: ReadonlySet<string>;
  oneShot: ReadonlySet<string>;
  idleVariants: IdleVariantPolicy;
  rules: readonly string[];
}

export class AnimationLibraryError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`animations.json ${path}: ${message}`);
    this.name = 'AnimationLibraryError';
  }
}

type Json = Record<string, unknown>;

function obj(v: unknown, path: string): Json {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new AnimationLibraryError(path, 'expected an object');
  return v as Json;
}
function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new AnimationLibraryError(path, 'expected an array');
  return v;
}
function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new AnimationLibraryError(path, 'expected a finite number');
  return v;
}
function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new AnimationLibraryError(path, 'expected a non-empty string');
  return v;
}
function bool(v: unknown, path: string, fallback?: boolean): boolean {
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'boolean') throw new AnimationLibraryError(path, 'expected a boolean');
  return v;
}

function parseTransform(v: unknown, path: string): Transform {
  const o = obj(v, path);
  return { x: num(o.x, `${path}.x`), y: num(o.y, `${path}.y`), scale: num(o.scale, `${path}.scale`), rot: num(o.rot, `${path}.rot`) };
}

function parseAnimation(v: unknown, character: string, path: string): CharacterAnimation {
  const o = obj(v, path);
  const id = str(o.id, `${path}.id`);
  const loop = bool(o.loop, `${path}.loop`);
  if (Array.isArray(o.states)) {
    const out: StateAnimation = { kind: 'states', id, character, loop, states: o.states.map((s, i) => str(s, `${path}.states[${i}]`)) };
    if (typeof o.note === 'string') out.note = o.note;
    return out;
  }
  const duration = num(o.duration, `${path}.duration`);
  if (duration <= 0) throw new AnimationLibraryError(`${path}.duration`, 'must be positive');
  const tracks = arr(o.tracks, `${path}.tracks`).map((k, i): Keyframe => {
    const kp = `${path}.tracks[${i}]`;
    const ko = obj(k, kp);
    const frame: Keyframe = {
      t: num(ko.t, `${kp}.t`),
      pose: str(ko.pose, `${kp}.pose`),
      expression: str(ko.expression, `${kp}.expression`),
      transform: parseTransform(ko.transform, `${kp}.transform`),
    };
    if (ko.fx !== undefined) {
      if (!FX_NAMES.includes(ko.fx as FxName)) throw new AnimationLibraryError(`${kp}.fx`, `unknown fx "${String(ko.fx)}"`);
      frame.fx = ko.fx as FxName;
    }
    return frame;
  });
  if (tracks.length === 0) throw new AnimationLibraryError(`${path}.tracks`, 'needs at least one keyframe');
  if (tracks[0]!.t !== 0) throw new AnimationLibraryError(`${path}.tracks[0].t`, 'first keyframe must be at 0');
  for (let i = 1; i < tracks.length; i++) {
    if (tracks[i]!.t < tracks[i - 1]!.t) throw new AnimationLibraryError(`${path}.tracks[${i}].t`, 'keyframes must be ascending');
  }
  if (Math.abs(tracks[tracks.length - 1]!.t - duration) > 1e-9) {
    throw new AnimationLibraryError(`${path}.tracks`, `last keyframe must be at duration ${duration}`);
  }
  const out: TrackAnimation = { kind: 'tracks', id, character, loop, duration, tracks };
  if (typeof o.callout === 'string') out.callout = o.callout;
  if (typeof o.interrupt === 'string') out.interrupt = o.interrupt;
  if (typeof o.variantOf === 'string') out.variantOf = o.variantOf;
  if (typeof o.weight === 'number') out.weight = o.weight;
  if (typeof o.interruptible === 'boolean') out.interruptible = o.interruptible;
  if (typeof o.note === 'string') out.note = o.note;
  return out;
}

/** Parse and validate animations.json. Throws AnimationLibraryError with a JSON path on any problem. */
export function parseAnimationLibrary(input: unknown): AnimationLibrary {
  const root = obj(input, '$');
  if (root.schemaVersion !== 1) throw new AnimationLibraryError('$.schemaVersion', `unsupported version ${String(root.schemaVersion)}`);

  const characters = new Map<string, CharacterLibrary>();
  for (const [cid, raw] of Object.entries(obj(root.characters, '$.characters'))) {
    const path = `$.characters.${cid}`;
    const c = obj(raw, path);
    const animations = new Map<string, CharacterAnimation>();
    arr(c.animations, `${path}.animations`).forEach((a, i) => {
      const anim = parseAnimation(a, cid, `${path}.animations[${i}]`);
      if (animations.has(anim.id)) throw new AnimationLibraryError(`${path}.animations[${i}].id`, `duplicate id "${anim.id}"`);
      animations.set(anim.id, anim);
    });
    const variants = [...animations.values()].filter((a): a is TrackAnimation => a.kind === 'tracks' && a.variantOf !== undefined);
    if (variants.length > 0) {
      const sum = variants.reduce((s, v) => s + (v.weight ?? 0), 0);
      if (Math.abs(sum - 1) > 1e-6) throw new AnimationLibraryError(`${path}.animations`, `idle variant weights sum to ${sum}, not 1`);
    }
    characters.set(cid, {
      id: str(c.id, `${path}.id`),
      fixed: bool(c.fixed, `${path}.fixed`, true),
      humanoid: bool(c.humanoid, `${path}.humanoid`, true),
      layered: bool(c.layered, `${path}.layered`, false),
      animations,
    });
  }

  const system = new Map<string, SystemAnimation>();
  for (const [sid, raw] of Object.entries(obj(root.system, '$.system'))) {
    const path = `$.system.${sid}`;
    const s = obj(raw, path);
    const duration = num(s.duration, `${path}.duration`);
    const steps = arr(s.steps, `${path}.steps`).map((st, i): SystemStep => {
      const o = obj(st, `${path}.steps[${i}]`);
      const step: SystemStep = { t: num(o.t, `${path}.steps[${i}].t`), action: str(o.action, `${path}.steps[${i}].action`) };
      if (typeof o.sound === 'string') step.sound = o.sound;
      if (typeof o.fx === 'string') step.fx = o.fx;
      if (step.t < 0 || step.t > duration + 1e-9) throw new AnimationLibraryError(`${path}.steps[${i}].t`, 'outside the animation');
      return step;
    });
    for (let i = 1; i < steps.length; i++) {
      if (steps[i]!.t < steps[i - 1]!.t) throw new AnimationLibraryError(`${path}.steps[${i}].t`, 'steps must be ascending');
    }
    system.set(sid, { id: str(s.id, `${path}.id`), duration, steps });
  }

  const sm = obj(root.stateMachine, '$.stateMachine');
  const iv = obj(sm.idleVariants, '$.stateMachine.idleVariants');
  const range = arr(iv.baseLoopsBeforeVariant, '$.stateMachine.idleVariants.baseLoopsBeforeVariant').map((n, i) =>
    num(n, `$.stateMachine.idleVariants.baseLoopsBeforeVariant[${i}]`),
  );
  return {
    schemaVersion: 1,
    characters,
    system,
    looping: new Set(arr(sm.looping, '$.stateMachine.looping').map((s, i) => str(s, `$.stateMachine.looping[${i}]`))),
    oneShot: new Set(arr(sm.oneShot, '$.stateMachine.oneShot').map((s, i) => str(s, `$.stateMachine.oneShot[${i}]`))),
    idleVariants: {
      base: str(iv.base, '$.stateMachine.idleVariants.base'),
      variants: arr(iv.variants, '$.stateMachine.idleVariants.variants').map((s, i) => str(s, `$.stateMachine.idleVariants.variants[${i}]`)),
      baseLoopsBeforeVariant: [range[0] ?? 2, range[1] ?? 4],
      noImmediateRepeat: bool(iv.noImmediateRepeat, '$.stateMachine.idleVariants.noImmediateRepeat', true),
      afterVariant: str(iv.afterVariant ?? iv.base, '$.stateMachine.idleVariants.afterVariant'),
    },
    rules: arr(sm.rules, '$.stateMachine.rules').map((r) => String(r)),
  };
}

/** Check every keyframe pose against the sprite frames available for each character. */
export function missingPoses(library: AnimationLibrary, framesFor: (character: string) => ReadonlySet<string> | null): string[] {
  const missing: string[] = [];
  for (const c of library.characters.values()) {
    const frames = framesFor(c.id);
    if (!frames) continue;
    for (const a of c.animations.values()) {
      if (a.kind !== 'tracks') continue;
      for (const k of a.tracks) if (!frames.has(k.pose)) missing.push(`${c.id}/${a.id}: pose "${k.pose}"`);
    }
  }
  return [...new Set(missing)];
}

export interface Sample {
  pose: string;
  expression: string;
  transform: Transform;
  /** fx of the keyframe whose time was crossed exactly at this sample, else the snapped keyframe's. */
  fx: FxName | null;
  /** Index of the snapped keyframe. */
  keyframe: number;
}

/** ANIMATION-GUIDE §3 playback. `t` is seconds since the animation started. */
export function sampleAnimation(anim: TrackAnimation, elapsed: number): Sample {
  const tracks = anim.tracks;
  const t = anim.loop ? ((elapsed % anim.duration) + anim.duration) % anim.duration : Math.min(Math.max(elapsed, 0), anim.duration);
  let i = 0;
  while (i < tracks.length - 1 && tracks[i + 1]!.t <= t) i++;
  const a = tracks[i]!;
  const b = tracks[Math.min(i + 1, tracks.length - 1)]!;
  const span = b.t - a.t;
  const k = span <= 0 ? 0 : Math.min(1, Math.max(0, (t - a.t) / span));
  const lerp = (p: number, q: number) => p + (q - p) * k;
  return {
    pose: a.pose,
    expression: a.expression,
    transform: {
      x: lerp(a.transform.x, b.transform.x),
      y: lerp(a.transform.y, b.transform.y),
      scale: lerp(a.transform.scale, b.transform.scale),
      rot: lerp(a.transform.rot, b.transform.rot),
    },
    fx: a.fx ?? null,
    keyframe: i,
  };
}

/** Keyframes whose time falls in (from, to], for firing fx exactly once. Handles loop wrap. */
export function crossedKeyframes(anim: TrackAnimation, from: number, to: number): Keyframe[] {
  if (to <= from) return [];
  if (!anim.loop) return anim.tracks.filter((k) => k.t > from && k.t <= Math.min(to, anim.duration));
  const out: Keyframe[] = [];
  const startCycle = Math.floor(from / anim.duration);
  const endCycle = Math.floor(to / anim.duration);
  for (let c = startCycle; c <= endCycle && c - startCycle < 100; c++) {
    for (const k of anim.tracks) {
      const abs = c * anim.duration + k.t;
      if (abs > from && abs <= to && !(k.t === anim.duration && anim.tracks[0]!.t === 0)) out.push(k);
    }
  }
  return out;
}

/** System steps whose time falls in (from, to]; a step at t = 0 fires when from < 0. */
export function crossedSteps(anim: SystemAnimation, from: number, to: number): SystemStep[] {
  return anim.steps.filter((s) => s.t > from && s.t <= to);
}

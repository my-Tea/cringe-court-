/**
 * Player movement: a Minecraft-style axis-aligned body (square footprint, not a
 * capsule) moved one axis at a time against static AABBs, with step-up, gravity
 * and a small hop. Pure and deterministic: the controller runs it at a fixed
 * 60 Hz step, so the same inputs give the same path at any frame rate.
 */
import type { Aabb, Vec3 } from './types';

export const BODY = {
  /** Half-width of the square footprint. */
  radius: 4.5,
  height: 50,
  eye: 44,
  /** Highest ledge walked up without jumping (the dais is 7.6 above the carpet). */
  step: 9,
  walk: 116,
  sprint: 192,
  accel: 1040,
  friction: 1280,
  airControl: 0.35,
  gravity: 420,
  /** Hop height ≈ v²/2g ≈ 9.6 units: a hop, never flight. */
  jumpVelocity: 90,
} as const;

export const FIXED_DT = 1 / 60;

export interface BodyState {
  pos: [number, number, number];
  vel: [number, number, number];
  onGround: boolean;
}

export interface MoveIntent {
  /** −1..1, + is forward (toward where the camera looks). */
  forward: number;
  /** −1..1, + is right. */
  strafe: number;
  sprint: boolean;
  jump: boolean;
}

export const NO_MOVE: MoveIntent = { forward: 0, strafe: 0, sprint: false, jump: false };

/** Uniform XZ grid over the solids, so a step tests a handful of boxes, not 2,000. */
export class SolidIndex {
  readonly #cell: number;
  readonly #grid = new Map<string, number[]>();
  readonly solids: readonly Aabb[];

  constructor(solids: readonly Aabb[], cell = 16) {
    this.solids = solids;
    this.#cell = cell;
    solids.forEach((s, i) => {
      for (let cx = Math.floor(s.min[0] / cell); cx <= Math.floor(s.max[0] / cell); cx++) {
        for (let cz = Math.floor(s.min[2] / cell); cz <= Math.floor(s.max[2] / cell); cz++) {
          const k = `${cx},${cz}`;
          let list = this.#grid.get(k);
          if (!list) this.#grid.set(k, (list = []));
          list.push(i);
        }
      }
    });
  }

  /** Solids whose XZ footprint may overlap [x0,x1]×[z0,z1]. */
  query(x0: number, z0: number, x1: number, z1: number): Aabb[] {
    const c = this.#cell;
    const seen = new Set<number>();
    const out: Aabb[] = [];
    for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) {
      for (let cz = Math.floor(z0 / c); cz <= Math.floor(z1 / c); cz++) {
        for (const i of this.#grid.get(`${cx},${cz}`) ?? []) {
          if (seen.has(i)) continue;
          seen.add(i);
          const s = this.solids[i]!;
          if (s.max[0] > x0 && s.min[0] < x1 && s.max[2] > z0 && s.min[2] < z1) out.push(s);
        }
      }
    }
    return out;
  }
}

const EPS = 1e-4;

/** Does this solid block a body whose feet are at `feet`? (Low ledges are stepped onto, overhead ones ignored.) */
function blocks(s: Aabb, feet: number): boolean {
  return s.max[1] > feet + BODY.step && s.min[1] < feet + BODY.height;
}

/** Highest standable surface under the footprint, at or below `feet + step`. */
export function groundUnder(index: SolidIndex, x: number, z: number, feet: number, r: number = BODY.radius): number {
  let ground = -Infinity;
  for (const s of index.query(x - r, z - r, x + r, z + r)) {
    const top = s.max[1];
    if (top <= feet + BODY.step + EPS && top > ground && s.min[1] < feet + BODY.height) ground = top;
  }
  return ground;
}

/** True if the body's footprint at (x, z) intersects any blocking solid. */
export function overlaps(index: SolidIndex, x: number, z: number, feet: number, r: number = BODY.radius): boolean {
  for (const s of index.query(x - r, z - r, x + r, z + r)) {
    if (blocks(s, feet) && s.max[0] > x - r + EPS && s.min[0] < x + r - EPS && s.max[2] > z - r + EPS && s.min[2] < z + r - EPS) return true;
  }
  return false;
}

/** Move along one horizontal axis, stopping flush against the first blocking face (swept, no tunnelling). */
function sweepAxis(index: SolidIndex, pos: [number, number, number], axis: 0 | 2, delta: number): boolean {
  if (delta === 0) return false;
  const r = BODY.radius;
  const other = axis === 0 ? 2 : 0;
  const from = pos[axis];
  const to = from + delta;
  const lo = Math.min(from, to) - r;
  const hi = Math.max(from, to) + r;
  const o0 = pos[other] - r + EPS;
  const o1 = pos[other] + r - EPS;
  const candidates = axis === 0 ? index.query(lo, o0, hi, o1) : index.query(o0, lo, o1, hi);
  let limit = to;
  let hit = false;
  for (const s of candidates) {
    if (!blocks(s, pos[1])) continue;
    if (!(s.max[other] > o0 && s.min[other] < o1)) continue;
    if (delta > 0) {
      // Only faces at or ahead of the leading edge.
      if (s.min[axis] >= from + r - EPS && s.min[axis] - r < limit) {
        limit = s.min[axis] - r;
        hit = true;
      }
    } else if (s.max[axis] <= from - r + EPS && s.max[axis] + r > limit) {
      limit = s.max[axis] + r;
      hit = true;
    }
  }
  pos[axis] = limit;
  return hit;
}

export interface StepResult {
  /** A blocking face stopped horizontal motion this step. */
  bumped: boolean;
  /** Feet rose onto a ledge this step. */
  stepped: number;
}

/**
 * Advance one fixed step. `bounds` are the rooms: the body is never allowed to
 * end a step outside their union (a last line of defence behind the walls).
 */
export function stepBody(body: BodyState, intent: MoveIntent, yaw: number, index: SolidIndex, bounds: readonly Aabb[], dt = FIXED_DT): StepResult {
  // Wish direction in world space. yaw 0 looks down −Z; +strafe is +X at yaw 0.
  let f = clamp(intent.forward, -1, 1);
  let s = clamp(intent.strafe, -1, 1);
  const len = Math.hypot(f, s);
  if (len > 1) {
    f /= len;
    s /= len;
  }
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const speed = intent.sprint && f > 0 ? BODY.sprint : BODY.walk;
  const wishX = (-sin * f + cos * s) * speed;
  const wishZ = (-cos * f - sin * s) * speed;

  const control = body.onGround ? 1 : BODY.airControl;
  const accel = (len > 0.01 ? BODY.accel : BODY.friction) * control * dt;
  body.vel[0] = approach(body.vel[0], wishX, accel);
  body.vel[2] = approach(body.vel[2], wishZ, accel);

  if (intent.jump && body.onGround) {
    body.vel[1] = BODY.jumpVelocity;
    body.onGround = false;
  }

  const before: [number, number, number] = [body.pos[0], body.pos[1], body.pos[2]];
  const bx = sweepAxis(index, body.pos, 0, body.vel[0] * dt);
  if (bx) body.vel[0] = 0;
  const bz = sweepAxis(index, body.pos, 2, body.vel[2] * dt);
  if (bz) body.vel[2] = 0;

  // Vertical: snap onto ledges and small drops while grounded, otherwise fall and land.
  let stepped = 0;
  const feet = body.pos[1];
  if (body.onGround) {
    const ground = groundUnder(index, body.pos[0], body.pos[2], feet);
    if (ground !== -Infinity && ground >= feet - 0.6) {
      if (ground > feet + EPS) stepped = ground - feet;
      body.pos[1] = ground;
      body.vel[1] = 0;
    } else {
      body.onGround = false;
    }
  }
  if (!body.onGround) {
    body.vel[1] -= BODY.gravity * dt;
    const next = feet + body.vel[1] * dt;
    const ground = groundUnder(index, body.pos[0], body.pos[2], Math.max(feet, next));
    if (body.vel[1] <= 0 && ground !== -Infinity && next <= ground + EPS) {
      body.pos[1] = ground;
      body.vel[1] = 0;
      body.onGround = true;
    } else if (ground === -Infinity && next < -50) {
      // Nothing below at all: never fall out of the world.
      body.pos = before;
      body.vel = [0, 0, 0];
      body.onGround = true;
    } else {
      body.pos[1] = next;
    }
  }

  if (!insideAny(body.pos, bounds) || overlaps(index, body.pos[0], body.pos[2], body.pos[1])) {
    body.pos = before;
    body.vel[0] = 0;
    body.vel[2] = 0;
  }
  return { bumped: bx || bz, stepped };
}

export function insideAny(p: Vec3, bounds: readonly Aabb[]): boolean {
  const r = BODY.radius;
  return bounds.some((b) => p[0] - r >= b.min[0] - EPS && p[0] + r <= b.max[0] + EPS && p[2] - r >= b.min[2] - EPS && p[2] + r <= b.max[2] + EPS && p[1] >= b.min[1] - 60 && p[1] <= b.max[1]);
}

function approach(v: number, target: number, maxDelta: number): number {
  if (v < target) return Math.min(v + maxDelta, target);
  return Math.max(v - maxDelta, target);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Fixed-timestep accumulator: run `step` as many times as `dt` allows (capped), return the leftover alpha. */
export class FixedStepper {
  #acc = 0;
  constructor(readonly step = FIXED_DT, readonly maxSteps = 8) {}
  advance(dt: number, fn: (h: number) => void): number {
    this.#acc += Math.min(Math.max(dt, 0), this.step * this.maxSteps);
    let n = 0;
    while (this.#acc >= this.step - 1e-9 && n < this.maxSteps) {
      fn(this.step);
      this.#acc -= this.step;
      n++;
    }
    return this.#acc / this.step;
  }
}

/**
 * Isometric movement and collision.
 *
 * Minecraft feel on a fixed step: a square footprint, a hard push against the
 * solids, and no tunnelling. The difference from the first-person roam physics
 * is the input basis — movement is relative to the *screen*, not to a yaw the
 * player steers. On an isometric camera, "up" means up-left on screen, so W must
 * walk toward −X−Z, not toward wherever the camera happens to point.
 *
 * Pure and deterministic: same inputs, same path at any frame rate.
 */
import type { Aabb, Vec3 } from '../roam/types';
import { CELL, isWalkable, type TownWorld } from './world';

export const BODY = {
  /** Half-width of the square footprint. Smaller than a cell so the town is walkable. */
  radius: 4.2,
  height: 50,
  /** Highest ledge stepped up without jumping (a kerb, not a wall). */
  step: 6,
  walk: 52,
  run: 88,
  /** Units per second² toward the wish direction. */
  accel: 420,
  friction: 560,
} as const;

export const FIXED_DT = 1 / 60;

export interface MoveIntent {
  /** −1..1, screen-up. */
  forward: number;
  /** −1..1, screen-right. */
  strafe: number;
  run: boolean;
}

export const NO_MOVE: MoveIntent = { forward: 0, strafe: 0, run: false };

export interface BodyState {
  pos: [number, number, number];
  vel: [number, number, number];
}

/**
 * Convert screen-relative intent into a world XZ direction for a 2:1 iso camera.
 *
 * The camera looks along (1, −1, 1) normalised, so its screen-right is
 * (1, 0, −1)/√2 and its screen-up (projected on the ground) is (−1, 0, −1)/√2.
 * Both are normalised here so diagonal input is not faster than cardinal input.
 */
export function isoDirection(intent: MoveIntent): [number, number] {
  const f = clamp(intent.forward, -1, 1);
  const s = clamp(intent.strafe, -1, 1);
  let x = (-f + s) * Math.SQRT1_2;
  let z = (-f - s) * Math.SQRT1_2;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return [x, z];
}

/**
 * Inverse of `isoDirection`: a world XZ offset as a screen-relative intent.
 *
 * Used by click-to-walk. The result is unit-length when the offset is, so a
 * click due east does not make the avatar run.
 */
export function intentToward(dx: number, dz: number): MoveIntent {
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-4) return NO_MOVE;
  const ux = dx / dist;
  const uz = dz / dist;
  return {
    forward: clamp((-(ux + uz)) / Math.SQRT2, -1, 1),
    strafe: clamp((ux - uz) / Math.SQRT2, -1, 1),
    run: false,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Uniform XZ grid over the solids, so a step tests a handful of boxes. */
export class SolidIndex {
  readonly #cells = new Map<string, Aabb[]>();
  constructor(
    solids: readonly Aabb[],
    readonly cell = CELL,
  ) {
    for (const s of solids) {
      const c0 = Math.floor(s.min[0] / cell);
      const c1 = Math.floor(s.max[0] / cell);
      const r0 = Math.floor(s.min[2] / cell);
      const r1 = Math.floor(s.max[2] / cell);
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const k = `${c},${r}`;
          const list = this.#cells.get(k);
          if (list) list.push(s);
          else this.#cells.set(k, [s]);
        }
      }
    }
  }

  query(x0: number, z0: number, x1: number, z1: number): Aabb[] {
    const cell = this.cell;
    const c0 = Math.floor(x0 / cell);
    const c1 = Math.floor(x1 / cell);
    const r0 = Math.floor(z0 / cell);
    const r1 = Math.floor(z1 / cell);
    const out: Aabb[] = [];
    const seen = new Set<Aabb>();
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const list = this.#cells.get(`${c},${r}`);
        if (!list) continue;
        for (const s of list) {
          if (seen.has(s)) continue;
          seen.add(s);
          out.push(s);
        }
      }
    }
    return out;
  }
}

export interface StepResult {
  /** True when the step was blocked on at least one axis. */
  blocked: boolean;
}

/**
 * Advance the body one fixed step.
 *
 * Movement is resolved one axis at a time, so a wall stops the component into
 * it and the player slides along it. On top of that, the *whole* step is rolled
 * back if it would leave the footprint anywhere unwalkable: that makes
 * "the player is always standing on walkable ground" an invariant of the
 * function rather than something the map author has to guarantee. Without it a
 * body pushed into a void corner could never recover, because every later step
 * would start from an already-invalid position.
 */
export function stepBody(
  body: BodyState,
  intent: MoveIntent,
  index: SolidIndex,
  world: TownWorld,
  dt = FIXED_DT,
): StepResult {
  const [dx, dz] = isoDirection(intent);
  const target = intent.run ? BODY.run : BODY.walk;

  // Accelerate toward the wish velocity, decelerate when there is no input.
  const wantX = dx * target;
  const wantZ = dz * target;
  const rate = (Math.hypot(dx, dz) > 1e-6 ? BODY.accel : BODY.friction) * dt;
  body.vel[0] = approach(body.vel[0], wantX, rate);
  body.vel[2] = approach(body.vel[2], wantZ, rate);

  const r = BODY.radius;
  const fromX = body.pos[0];
  const fromZ = body.pos[2];
  let blocked = false;

  // X axis.
  const nextX = body.pos[0] + body.vel[0] * dt;
  if (body.vel[0] !== 0 && !freeAt(index, nextX, body.pos[2], r)) {
    body.vel[0] = 0;
    blocked = true;
  } else {
    body.pos[0] = nextX;
  }

  // Z axis.
  const nextZ = body.pos[2] + body.vel[2] * dt;
  if (body.vel[2] !== 0 && !freeAt(index, body.pos[0], nextZ, r)) {
    body.vel[2] = 0;
    blocked = true;
  } else {
    body.pos[2] = nextZ;
  }

  // Tile test: a solid-free hole in the grid (void, water) still blocks. Keep the
  // axis that stays walkable so the player slides along a shoreline, and roll the
  // whole step back if neither axis works.
  if (!walkableFootprint(world, body.pos[0], body.pos[2], r)) {
    blocked = true;
    if (walkableFootprint(world, nextX, fromZ, r)) {
      body.pos[0] = nextX;
      body.pos[2] = fromZ;
      body.vel[2] = 0;
    } else if (walkableFootprint(world, fromX, nextZ, r)) {
      body.pos[0] = fromX;
      body.pos[2] = nextZ;
      body.vel[0] = 0;
    } else {
      // Neither axis is reachable: undo the step completely.
      body.pos[0] = fromX;
      body.pos[2] = fromZ;
      body.vel[0] = 0;
      body.vel[2] = 0;
    }
  }

  return { blocked };
}

function approach(current: number, target: number, rate: number): number {
  if (current < target) return Math.min(current + rate, target);
  if (current > target) return Math.max(current - rate, target);
  return target;
}

/** Would a footprint centred at (x, z) overlap any solid? */
export function freeAt(index: SolidIndex, x: number, z: number, r = BODY.radius): boolean {
  const hits = index.query(x - r, z - r, x + r, z + r);
  for (const s of hits) {
    // A solid the body can stand on top of is not an obstacle.
    if (s.max[1] <= BODY.step) continue;
    if (x + r <= s.min[0] || x - r >= s.max[0]) continue;
    if (z + r <= s.min[2] || z - r >= s.max[2]) continue;
    return false;
  }
  return true;
}

/** Every corner of the footprint must be on walkable ground. */
export function walkableFootprint(world: TownWorld, x: number, z: number, r = BODY.radius, cell = CELL): boolean {
  const pts: Array<[number, number]> = [
    [x - r, z - r],
    [x + r, z - r],
    [x - r, z + r],
    [x + r, z + r],
    [x, z],
  ];
  for (const [px, pz] of pts) if (!isWalkable(world, px, pz, cell)) return false;
  return true;
}

/** Where the body's feet are, clamped into the map so a bad spawn cannot escape. */
export function clampToMap(world: TownWorld, pos: Vec3, cell = CELL): Vec3 {
  const pad = BODY.radius + 0.5;
  return [
    clamp(pos[0], pad, world.cols * cell - pad),
    pos[1],
    clamp(pos[2], pad, world.rows * cell - pad),
  ];
}

/**
 * Fixed-step accumulator with a catch-up cap, so a slow frame after a tab switch
 * cannot teleport the player through a wall. Identical contract to the roam
 * stepper.
 */
export class FixedStepper {
  #acc = 0;
  constructor(
    readonly dt = FIXED_DT,
    readonly maxSteps = 8,
  ) {}

  /** Run `fn` once per fixed step for this frame's elapsed time. Returns steps run. */
  advance(elapsed: number, fn: (dt: number) => void): number {
    this.#acc += Math.min(elapsed, this.dt * this.maxSteps);
    let steps = 0;
    while (this.#acc >= this.dt && steps < this.maxSteps) {
      this.#acc -= this.dt;
      fn(this.dt);
      steps++;
    }
    // Never let the accumulator grow without bound (e.g. a backgrounded tab).
    if (this.#acc > this.dt * this.maxSteps) this.#acc = 0;
    return steps;
  }

  reset(): void {
    this.#acc = 0;
  }
}

/** Floor height under a point: the top of any low solid the footprint overlaps. */
export function floorHeightAt(index: SolidIndex, x: number, z: number, r = BODY.radius): number {
  let top = 0;
  for (const s of index.query(x - r, z - r, x + r, z + r)) {
    if (x + r <= s.min[0] || x - r >= s.max[0]) continue;
    if (z + r <= s.min[2] || z - r >= s.max[2]) continue;
    // Only surfaces you can step onto count; a wall is not a floor.
    if (s.max[1] <= BODY.step) top = Math.max(top, s.max[1]);
  }
  return top;
}

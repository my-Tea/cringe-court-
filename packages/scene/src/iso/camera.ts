/**
 * The isometric camera: fixed 2:1 dimetric angle, damped follow, map clamping.
 *
 * Deliberately not a free orbit. A fixed angle is what makes the art read as one
 * consistent world (every building's top and side faces at the same rake) and it
 * is what the depth sort assumes. The camera only translates: it follows the
 * player, eases so movement never feels glued, and stops at the map edge so the
 * void beyond the art is never on screen.
 *
 * Pure and renderer-free: it produces the numbers a three.js camera needs, so it
 * can be tested in node without a WebGL context.
 */
import type { TownWorld } from './world';
import { CELL } from './world';

/** The classic iso rake. Easing the pitch slightly keeps tall roofs readable. */
export const ISO = {
  /** Camera yaw about Y; 45° gives the 2:1 diamond. */
  yaw: Math.PI / 4,
  /** Downward tilt from horizontal. 30° is the true 2:1 dimetric angle. */
  pitch: Math.PI / 6,
  /** How far the camera sits from its target, in world units. */
  distance: 520,
  /** Vertical look-at offset so the player sits slightly below centre. */
  targetY: 22,
  /** Camera height above the target, from pitch and distance. */
  get height(): number {
    return Math.sin(this.pitch) * this.distance;
  },
} as const;

export interface CameraTarget {
  /** World point the camera looks at. */
  x: number;
  y: number;
  z: number;
}

/** Screen doesn't jump when the follow is interrupted by a teleport. */
export interface IsoCameraOptions {
  /** Follow stiffness in 1/s. Higher is tighter. */
  stiffness?: number;
  /** Extra room kept around the map when clamping, in cells. */
  margin?: number;
}

export class IsoCamera {
  /** Where the camera actually is (smoothed). */
  readonly target: CameraTarget = { x: 0, y: ISO.targetY, z: 0 };
  #desired: CameraTarget = { x: 0, y: ISO.targetY, z: 0 };
  readonly stiffness: number;
  readonly margin: number;
  #world: TownWorld | null = null;

  constructor(options: IsoCameraOptions = {}) {
    this.stiffness = options.stiffness ?? 7.5;
    this.margin = options.margin ?? 0;
  }

  /** Point the camera at a map (used for clamping) and snap to a start position. */
  bind(world: TownWorld, at: readonly [number, number, number] = [0, 0, 0], snap = true): void {
    this.#world = world;
    this.#desired = this.#clamp({ x: at[0], y: ISO.targetY, z: at[2] });
    if (snap) Object.assign(this.target, this.#desired);
  }

  /** Ask the camera to follow this world point. */
  follow(x: number, z: number): void {
    this.#desired = this.#clamp({ x, y: ISO.targetY, z });
  }

  /** Jump without easing (spawns, map transitions). */
  snapTo(x: number, z: number): void {
    this.follow(x, z);
    Object.assign(this.target, this.#desired);
  }

  /**
   * Advance the smoothing. Frame-rate independent: the exponential form gives
   * the same approach curve at 30, 60 or 144 fps.
   */
  update(dt: number): void {
    const k = 1 - Math.exp(-this.stiffness * Math.max(0, dt));
    this.target.x += (this.#desired.x - this.target.x) * k;
    this.target.y += (this.#desired.y - this.target.y) * k;
    this.target.z += (this.#desired.z - this.target.z) * k;
  }

  /** Camera position: up the iso rake and back from the target. */
  position(out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    const d = ISO.distance;
    out[0] = this.target.x + Math.sin(ISO.yaw) * Math.cos(ISO.pitch) * d;
    out[1] = this.target.y + Math.sin(ISO.pitch) * d;
    out[2] = this.target.z + Math.cos(ISO.yaw) * Math.cos(ISO.pitch) * d;
    return out;
  }

  /** Half-extents visible on the ground plane, for culling and the minimap. */
  viewExtents(width: number, height: number, frustumHeight: number): { halfW: number; halfH: number } {
    const aspect = width / Math.max(1, height);
    // On an iso camera the ground plane is foreshortened by sin(pitch).
    const halfH = (frustumHeight / 2) / Math.max(0.2, Math.sin(ISO.pitch));
    return { halfW: halfH * aspect, halfH };
  }

  /**
   * Keep the view inside the map. With a map wider than the viewport the target
   * simply clamps; on a map narrower than the viewport the target pins to the
   * middle so the world does not drift across the screen.
   */
  #clamp(t: CameraTarget): CameraTarget {
    const world = this.#world;
    if (!world) return t;
    const pad = this.margin * CELL;
    const minX = Math.min(pad, world.cols * CELL / 2);
    const maxX = Math.max(world.cols * CELL - pad, world.cols * CELL / 2);
    const minZ = Math.min(pad, world.rows * CELL / 2);
    const maxZ = Math.max(world.rows * CELL - pad, world.rows * CELL / 2);
    return { x: clamp(t.x, minX, maxX), y: t.y, z: clamp(t.z, minZ, maxZ) };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

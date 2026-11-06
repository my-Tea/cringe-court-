/**
 * bbmodel → game boxes.
 *
 * Blockbench is where the town is modelled; the game renderer consumes flat box
 * lists (`{f, t, m}`, the same shape as `courtroom.boxes.json`) which it merges
 * into a handful of draw calls. This module is the seam between the two, and it
 * is pure: a parsed `.bbmodel` object in, boxes out, no three.js and no DOM.
 *
 * Blockbench and game spaces differ:
 * - Blockbench models sit on a pixel grid (`resolution`, usually 16) where a
 *   block is 16 units and +Y is up. The town works in world units where a cast
 *   member is ~63 tall, so a model scales by `cell / resolution`.
 * - Cube faces carry UV tiles, but the town renderer colours whole boxes from
 *   the palette, so each element resolves to exactly one hex: an explicit
 *   override for the element (or its group), else the element's own `color`,
 *   else the fallback material.
 *
 * Rotations are baked into axis-aligned bounds. That loses tilted geometry,
 * which is a deliberate trade: the game's collision and depth sort assume AABBs,
 * and blocky Minecraft-style architecture is authored on the grid anyway. A
 * rotation that is not a multiple of 90° is reported, never silently
 * approximated into a wrong box.
 */
import type { TownBox } from './world';

export type { TownBox };

export interface ConvertOptions {
  /** World units per town cell. Default 16 (one Blockbench block). */
  cell?: number;
  /** Model resolution: Blockbench `resolution.width`, usually 16. */
  resolution?: number;
  /** Extra multiplier on top of `cell / resolution`. */
  scale?: number;
  /** Offset applied after scaling, in world units. */
  origin?: readonly [number, number, number];
  /** Colour for every element without an explicit `materials` entry. */
  material?: string;
  /** Per-element / per-group colour, keyed by name or `group/name`. */
  materials?: Readonly<Record<string, string>>;
  /** Drop elements by exact name, or a group name, or a `prefix*` pattern. */
  skip?: readonly string[];
}

export interface ConvertResult {
  boxes: TownBox[];
  /** Cubes that produced geometry. */
  elements: number;
  /** Elements that were dropped, with the reason. Never silently swallowed. */
  skipped: Array<{ name: string; reason: string }>;
  /** Bounds of the converted geometry, before `origin` is applied twice. */
  bounds: { min: readonly [number, number, number]; max: readonly [number, number, number] } | null;
}

export class BbModelError extends Error {
  constructor(message: string) {
    super(`bbmodel: ${message}`);
    this.name = 'BbModelError';
  }
}

interface RawCube {
  name?: unknown;
  from?: unknown;
  to?: unknown;
  origin?: unknown;
  rotation?: unknown;
  inflate?: unknown;
  color?: unknown;
  type?: unknown;
}

interface RawGroupNode {
  name?: unknown;
  children?: unknown;
}

export interface RawModel {
  meta?: { format_version?: string; model_format?: string };
  name?: string;
  resolution?: { width?: number; height?: number };
  elements?: unknown;
  outliner?: unknown;
  textures?: unknown;
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const HEX8 = /^#[0-9A-Fa-f]{8}$/;

/** Blockbench's default palette, used when a cube stores a numeric index. */
const BB_PALETTE = [
  '#FFFFFF', '#E6E6E6', '#B3B3B3', '#808080', '#4D4D4D', '#1A1A1A', '#EC1C24', '#F7941D',
  '#FFF100', '#39B54A', '#00AEEF', '#2E3192', '#92278F', '#FF7BAC', '#00A99D', '#8C6239',
] as const;

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function round(n: number): number {
  // Three decimals is finer than the renderer's pixel grid and keeps JSON small.
  return Math.round(n * 1000) / 1000;
}

/** Parse `#rrggbb`, `#rrggbbaa` and the numbered Blockbench palette. */
export function colourOf(v: unknown): string | null {
  if (typeof v === 'string' && HEX6.test(v)) return v.toUpperCase();
  if (typeof v === 'string' && HEX8.test(v)) return v.slice(0, 7).toUpperCase();
  let n = NaN;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d+$/.test(v)) n = Number(v);
  if (Number.isFinite(n) && BB_PALETTE[n]) return BB_PALETTE[n]!;
  return null;
}

function matchesSkip(name: string, skip: readonly string[]): boolean {
  for (const pattern of skip) {
    if (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name) return true;
  }
  return false;
}

/**
 * Bake a cube's rotation into AABB bounds.
 *
 * Only multiples of 90° can be baked exactly; anything else returns null so the
 * caller reports it instead of inventing geometry.
 */
export function rotatedBounds(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  pivot: readonly [number, number, number],
  rotation: readonly [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } | null {
  const [rx, ry, rz] = rotation;
  if (rx === 0 && ry === 0 && rz === 0) {
    return { min: [from[0], from[1], from[2]], max: [to[0], to[1], to[2]] };
  }
  const quarters = (deg: number) => Math.round(deg / 90);
  const exact = (deg: number) => Math.abs(deg - quarters(deg) * 90) < 1e-6;
  if (!exact(rx) || !exact(ry) || !exact(rz)) return null;

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    let x = (i & 1 ? to[0] : from[0]) - pivot[0];
    let y = (i & 2 ? to[1] : from[1]) - pivot[1];
    let z = (i & 4 ? to[2] : from[2]) - pivot[2];
    for (let k = 0; k < Math.abs(quarters(rx)) % 4; k++) {
      // +90° about X: (y, z) → (−z, y). Negative steps rotate the other way.
      const next: [number, number] = rx > 0 ? [-z, y] : [z, -y];
      y = next[0];
      z = next[1];
    }
    for (let k = 0; k < Math.abs(quarters(ry)) % 4; k++) {
      // +90° about Y: (x, z) → (z, −x).
      const next: [number, number] = ry > 0 ? [z, -x] : [-z, x];
      x = next[0];
      z = next[1];
    }
    for (let k = 0; k < Math.abs(quarters(rz)) % 4; k++) {
      // +90° about Z: (x, y) → (−y, x).
      const next: [number, number] = rz > 0 ? [-y, x] : [y, -x];
      x = next[0];
      y = next[1];
    }
    x += pivot[0];
    y += pivot[1];
    z += pivot[2];
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  }
  return { min, max };
}

/** name → enclosing group name, from Blockbench's outliner tree. */
export function groupMap(outliner: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (nodes: unknown, parent: string | null): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (typeof node === 'string') {
        if (parent) map.set(node, parent);
        continue;
      }
      if (!node || typeof node !== 'object') continue;
      const g = node as RawGroupNode;
      // A group whose children are raw element objects (older exports).
      if (Array.isArray(g.children)) walk(g.children, typeof g.name === 'string' ? g.name : parent);
    }
  };
  walk(outliner, null);
  return map;
}

/**
 * Convert a parsed `.bbmodel` object into game boxes.
 *
 * Throws only for structurally unusable input. Per-element problems land in
 * `skipped`, so one bad cube never loses a whole building.
 */
export function bbmodelToBoxes(raw: RawModel, options: ConvertOptions = {}): ConvertResult {
  if (!raw || typeof raw !== 'object') throw new BbModelError('expected an object');
  const elements = raw.elements;
  if (!Array.isArray(elements)) throw new BbModelError('no elements array');

  const resolution = options.resolution ?? num(raw.resolution?.width, 16);
  if (!(resolution > 0)) throw new BbModelError(`resolution must be positive (got ${resolution})`);
  const cell = options.cell ?? 16;
  if (!(cell > 0)) throw new BbModelError(`cell must be positive (got ${cell})`);
  const scale = (cell / resolution) * (options.scale ?? 1);
  const origin = options.origin ?? ([0, 0, 0] as const);
  const skip = options.skip ?? [];
  const groups = groupMap(raw.outliner);

  // Elements may be referenced by name from the outliner; map name → group.
  const namedGroups = new Map<string, string>();
  for (const [id, group] of groups) namedGroups.set(id, group);

  const boxes: TownBox[] = [];
  const skipped: ConvertResult['skipped'] = [];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < elements.length; i++) {
    const cube = elements[i] as RawCube;
    const name = typeof cube.name === 'string' && cube.name ? cube.name : `element_${i}`;

    if (cube.type !== undefined && cube.type !== 'cube') {
      skipped.push({ name, reason: `not a cube (type ${String(cube.type)})` });
      continue;
    }
    if (!isVec3(cube.from) || !isVec3(cube.to)) {
      skipped.push({ name, reason: 'missing numeric from/to' });
      continue;
    }

    // Groups are matched against their own name and the `group` field a cube
    // may carry; both routes must be able to drop a decorative sub-assembly.
    const group = namedGroups.get(name) ?? (typeof (cube as { group?: unknown }).group === 'string' ? (cube as { group: string }).group : undefined);
    if (matchesSkip(name, skip) || (group && matchesSkip(group, skip))) {
      skipped.push({ name, reason: 'matched a skip pattern' });
      continue;
    }

    const inflate = num(cube.inflate, 0);
    const lo: [number, number, number] = [
      Math.min(cube.from[0], cube.to[0]) - inflate,
      Math.min(cube.from[1], cube.to[1]) - inflate,
      Math.min(cube.from[2], cube.to[2]) - inflate,
    ];
    const hi: [number, number, number] = [
      Math.max(cube.from[0], cube.to[0]) + inflate,
      Math.max(cube.from[1], cube.to[1]) + inflate,
      Math.max(cube.from[2], cube.to[2]) + inflate,
    ];
    if (lo[0] === hi[0] && lo[1] === hi[1] && lo[2] === hi[2]) {
      skipped.push({ name, reason: 'zero volume' });
      continue;
    }

    const rotation = isVec3(cube.rotation) ? cube.rotation : ([0, 0, 0] as const);
    const pivot = isVec3(cube.origin) ? cube.origin : ([0, 0, 0] as const);
    const baked = rotatedBounds(lo, hi, pivot, rotation);
    if (!baked) {
      skipped.push({ name, reason: `rotation not bakeable to an AABB (${rotation.join(', ')})` });
      continue;
    }

    const colour =
      options.materials?.[name] ??
      (group ? options.materials?.[`${group}/${name}`] ?? options.materials?.[group] : undefined) ??
      options.material ??
      colourOf(cube.color) ??
      '#A9917D';
    if (!HEX6.test(colour)) throw new BbModelError(`element "${name}" resolved to a non-hex colour "${colour}"`);

    const box: TownBox = {
      f: [round(baked.min[0] * scale + origin[0]), round(baked.min[1] * scale + origin[1]), round(baked.min[2] * scale + origin[2])],
      t: [round(baked.max[0] * scale + origin[0]), round(baked.max[1] * scale + origin[1]), round(baked.max[2] * scale + origin[2])],
      m: colour.toUpperCase(),
    };
    boxes.push(box);
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a]!, box.f[a]!);
      max[a] = Math.max(max[a]!, box.t[a]!);
    }
  }

  return { boxes, elements: boxes.length, skipped, bounds: boxes.length ? { min, max } : null };
}

/**
 * Translate, rotate (90° steps about Y) and mirror a box list.
 *
 * Town maps place the same building many times; these transforms keep every
 * placement exact on the grid instead of re-exporting per instance. Rotation is
 * about the model's own base centre (x/z = 0), matching how props are authored.
 */
export function placeBoxes(
  boxes: readonly TownBox[],
  at: readonly [number, number, number],
  ops: { rotY?: 0 | 90 | 180 | 270; mirrorX?: boolean } = {},
): TownBox[] {
  const steps = (ops.rotY ?? 0) / 90;
  return boxes.map((b) => {
    let [x0, z0] = [b.f[0], b.f[2]];
    let [x1, z1] = [b.t[0], b.t[2]];
    const y0 = b.f[1];
    const y1 = b.t[1];
    if (ops.mirrorX) {
      [x0, x1] = [-x1, -x0];
    }
    for (let k = 0; k < steps; k++) {
      // +90° about Y: (x, z) → (z, −x), applied to both corners.
      [x0, x1, z0, z1] = [z0, z1, -x0, -x1];
    }
    // A reflection or odd number of quarter turns can swap which corner is min.
    const fx = Math.min(x0, x1);
    const fz = Math.min(z0, z1);
    const tx = Math.max(x0, x1);
    const tz = Math.max(z0, z1);
    return {
      f: [round(fx + at[0]), round(y0 + at[1]), round(fz + at[2])],
      t: [round(tx + at[0]), round(y1 + at[1]), round(tz + at[2])],
      m: b.m,
    };
  });
}

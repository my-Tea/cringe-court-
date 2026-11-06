/**
 * Outdoor prop kit for the courthouse grounds and the arrival islands, after
 * the style guide's isometric sheet (STYLE-GUIDE §1, courtroom_issue ref 11):
 * warm ivory stone, royal-red banners and roofs, gold trim, round voxel trees,
 * iron lamps with glowing lanterns, floating islands with stepped rock below.
 *
 * Authored in unscaled coordinates like the rest of the world: X and Z grow by
 * ROOM_SCALE (2.5) when the world is built, Y does not. A prop that should look
 * square is therefore about 2.5× taller than it is wide here.
 */
import { C } from '../palette';
import type { RoamBox } from './index';

export type Out = RoamBox[];
export type V3 = [number, number, number];

export const STONE = C.neutral100;
export const STONE_SH = C.neutral300;
export const ROCK = C.neutral500;
export const IRON = C.neutral900;
export const WOOD = C.gold900;
export const WOOD_LT = C.gold700;
export const OAK = C.gold500;
export const GOLD = C.gold300;
export const CREAM = C.gold100;
export const RED = C.royal700;
export const MAROON = C.royal900;
export const ROOF = C.royal500;
export const LEAF = C.green700;
export const LEAF_LT = C.green500;
export const LEAF_DK = C.green900;
export const WATER = C.blue300;
export const SKYGLASS = C.blue500;
export const LANTERN = C.royal100;

export function b(out: Out, f: V3, t: V3, m: string, glow?: number): void {
  const lo: V3 = [Math.min(f[0], t[0]), Math.min(f[1], t[1]), Math.min(f[2], t[2])];
  const hi: V3 = [Math.max(f[0], t[0]), Math.max(f[1], t[1]), Math.max(f[2], t[2])];
  out.push(glow ? { f: lo, t: hi, m, glow } : { f: lo, t: hi, m });
}

/** A box centred on (x, z) with half-sizes (hx, hz), from y0 to y1. */
export function c(out: Out, x: number, z: number, hx: number, hz: number, y0: number, y1: number, m: string, glow?: number): void {
  b(out, [x - hx, y0, z - hz], [x + hx, y1, z + hz], m, glow);
}

/** Deterministic 0..1 noise for placement jitter. */
export function rnd(i: number, j = 0): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * A floating island's slab: grass or paving on top, then stepped rock tapering
 * to a point, the way the sky islands in the reference art hang in the air.
 */
export function island(out: Out, x0: number, z0: number, x1: number, z1: number, top: number, depth = 70, seed = 1): void {
  b(out, [x0, top - 4, z0], [x1, top, z1], ROCK);
  let ix0 = x0;
  let ix1 = x1;
  let iz0 = z0;
  let iz1 = z1;
  let y = top - 4;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const shrink = 0.11 + rnd(seed, i) * 0.05;
    const w = ix1 - ix0;
    const d = iz1 - iz0;
    ix0 += w * shrink * (0.6 + rnd(seed, i + 9) * 0.8) * 0.5;
    ix1 -= w * shrink * (0.6 + rnd(seed, i + 19) * 0.8) * 0.5;
    iz0 += d * shrink * (0.6 + rnd(seed, i + 29) * 0.8) * 0.5;
    iz1 -= d * shrink * (0.6 + rnd(seed, i + 39) * 0.8) * 0.5;
    const h = depth / steps;
    b(out, [ix0, y - h, iz0], [ix1, y, iz1], i % 2 === 0 ? ROCK : STONE_SH);
    y -= h;
  }
  // A few hanging roots and rocks under the rim.
  for (let i = 0; i < 6; i++) {
    const t = rnd(seed, 70 + i);
    const onX = i % 2 === 0;
    const x = onX ? x0 + 6 + t * (x1 - x0 - 12) : i % 4 === 1 ? x0 + 4 : x1 - 4;
    const z = onX ? (i % 4 === 0 ? z0 + 4 : z1 - 4) : z0 + 6 + t * (z1 - z0 - 12);
    c(out, x, z, 1.4, 1.4, top - 14 - t * 12, top - 4, i % 3 === 0 ? LEAF_DK : ROCK);
  }
}

/** A lawn bed: grass top a hair above the paving, with flower dots. */
export function lawn(out: Out, x0: number, z0: number, x1: number, z1: number, top: number, seed = 3, flowers = true): void {
  b(out, [x0, top - 1, z0], [x1, top + 0.6, z1], LEAF_LT);
  if (!flowers) return;
  // Flowers grow in small clumps: a leaf tuft with one or two blooms on top.
  const n = Math.floor(((x1 - x0) * (z1 - z0)) / 420);
  for (let i = 0; i < n; i++) {
    const x = x0 + 2 + rnd(seed, i) * (x1 - x0 - 4);
    const z = z0 + 2 + rnd(seed, i + 500) * (z1 - z0 - 4);
    const m = [ROOF, GOLD, LANTERN, RED][i % 4]!;
    c(out, x, z, 0.7, 0.7, top + 0.6, top + 2.2, LEAF);
    c(out, x, z, 0.35, 0.35, top + 2.2, top + 3.4, m);
    if (i % 3 === 0) c(out, x + 1, z + 0.6, 0.3, 0.3, top + 1.6, top + 2.8, m);
  }
}

/** A round voxel tree: trunk, then three stacked canopy layers, light on top. */
export function tree(out: Out, x: number, z: number, y: number, size = 1): void {
  const s = size;
  c(out, x, z, 1.3 * s, 1.3 * s, y, y + 26 * s, WOOD);
  c(out, x, z, 7 * s, 7 * s, y + 20 * s, y + 34 * s, LEAF_DK);
  c(out, x, z, 9 * s, 5 * s, y + 24 * s, y + 32 * s, LEAF);
  c(out, x, z, 5 * s, 9 * s, y + 24 * s, y + 32 * s, LEAF);
  c(out, x, z, 6 * s, 6 * s, y + 34 * s, y + 44 * s, LEAF);
  c(out, x, z, 3.5 * s, 3.5 * s, y + 44 * s, y + 50 * s, LEAF_LT);
}

/** A cone pine, for the island corners. */
export function pine(out: Out, x: number, z: number, y: number, size = 1): void {
  const s = size;
  c(out, x, z, 1, 1, y, y + 14 * s, WOOD);
  for (let i = 0; i < 4; i++) {
    const r = (6 - i * 1.4) * s;
    c(out, x, z, r, r, y + (10 + i * 9) * s, y + (19 + i * 9) * s, i % 2 === 0 ? LEAF_DK : LEAF);
  }
  c(out, x, z, 0.8, 0.8, y + 46 * s, y + 52 * s, LEAF);
}

/** A planter box with a small bush. */
export function planter(out: Out, x: number, z: number, y: number): void {
  c(out, x, z, 4, 4, y, y + 9, STONE);
  c(out, x, z, 4.4, 4.4, y + 9, y + 11, GOLD);
  c(out, x, z, 3.4, 3.4, y + 11, y + 20, LEAF);
  c(out, x, z, 2.2, 2.2, y + 20, y + 25, LEAF_LT);
}

/** An iron lamp post with a glowing lantern and gold cap. */
export function lamp(out: Out, x: number, z: number, y: number, h = 44): void {
  c(out, x, z, 2.2, 2.2, y, y + 4, STONE);
  c(out, x, z, 0.9, 0.9, y + 4, y + h - 10, IRON);
  c(out, x, z, 1.6, 1.6, y + h - 12, y + h - 10, GOLD);
  c(out, x, z, 2, 2, y + h - 10, y + h - 2, LANTERN, 0.6);
  c(out, x, z, 2.4, 2.4, y + h - 2, y + h, IRON);
  c(out, x, z, 1, 1, y + h, y + h + 3, GOLD);
}

/** A hanging banner: royal red with a gold border and the scales of justice. `face` is the side it faces (+1 → +Z). */
export function banner(out: Out, x: number, z: number, top: number, len: number, face: 1 | -1, w = 7): void {
  const zf = z + face * 0.6;
  b(out, [x - w - 1, top - 3, z - 0.8], [x + w + 1, top, z + 0.8], GOLD);
  b(out, [x - w, top - len, z - 0.4], [x + w, top - 3, z + 0.4], RED);
  b(out, [x - w, top - len - 4, z - 0.4], [x - w / 3, top - len, z + 0.4], RED);
  b(out, [x + w / 3, top - len - 4, z - 0.4], [x + w, top - len, z + 0.4], RED);
  b(out, [x - w, top - len, z - 0.5], [x + w, top - len + 1.2, z + 0.5], GOLD);
  scales(out, x, zf, top - len * 0.45, Math.min(1, w / 7));
}

/** The scales of justice in gold, drawn on a vertical plane facing ±Z at depth `z`. */
export function scales(out: Out, x: number, z: number, y: number, s = 1): void {
  const d = 0.35;
  b(out, [x - 0.5 * s, y - 7 * s, z - d], [x + 0.5 * s, y + 6 * s, z + d], CREAM);
  b(out, [x - 5 * s, y + 3.5 * s, z - d], [x + 5 * s, y + 4.5 * s, z + d], CREAM);
  b(out, [x - 5.5 * s, y - 1 * s, z - d], [x - 2.5 * s, y + 0.5 * s, z + d], CREAM);
  b(out, [x + 2.5 * s, y - 1 * s, z - d], [x + 5.5 * s, y + 0.5 * s, z + d], CREAM);
  b(out, [x - 2.5 * s, y - 7 * s, z - d], [x + 2.5 * s, y - 6 * s, z + d], CREAM);
}

/** A banner on its own pole (plaza corners, island gates). */
export function bannerPole(out: Out, x: number, z: number, y: number, face: 1 | -1): void {
  c(out, x, z, 1.6, 1.6, y, y + 4, STONE);
  c(out, x, z, 0.6, 0.6, y + 4, y + 64, IRON);
  c(out, x, z, 1.1, 1.1, y + 64, y + 67, GOLD);
  banner(out, x, z + face * 1, y + 60, 34, face, 5);
}

/** A run of stone balustrade along X (axis 0) or Z (axis 2), with posts and gold-capped urns. */
export function balustrade(out: Out, axis: 0 | 2, at: number, from: number, to: number, y: number, h = 11): void {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const seg = (a: number, a2: number, y0: number, y1: number, half: number, m: string) =>
    axis === 0 ? b(out, [a, y0, at - half], [a2, y1, at + half], m) : b(out, [at - half, y0, a], [at + half, y1, a2], m);
  seg(lo, hi, y, y + 2, 1.6, STONE_SH);
  seg(lo, hi, y + h - 2, y + h, 1.8, STONE);
  const n = Math.max(1, Math.round((hi - lo) / 3));
  for (let i = 0; i < n; i++) {
    const a = lo + ((i + 0.5) * (hi - lo)) / n;
    seg(a - 0.5, a + 0.5, y + 2, y + h - 2, 0.6, STONE);
  }
  const posts = Math.max(1, Math.round((hi - lo) / 22));
  for (let i = 0; i <= posts; i++) {
    const a = lo + (i * (hi - lo)) / posts;
    const [px, pz] = axis === 0 ? [a, at] : [at, a];
    c(out, px, pz, 2, 2, y, y + h + 3, STONE);
    c(out, px, pz, 2.4, 2.4, y + h + 3, y + h + 4.5, STONE_SH);
    c(out, px, pz, 1.2, 1.2, y + h + 4.5, y + h + 7, GOLD);
  }
}

/** A park bench along X, its seat facing `face` (+1 → +Z). */
export function bench(out: Out, x: number, z: number, y: number, face: 1 | -1): void {
  c(out, x, z, 9, 2, y + 7, y + 8.4, OAK);
  c(out, x, z + face * -1.8, 9, 0.5, y + 8.4, y + 16, OAK);
  for (const s of [-1, 1]) c(out, x + s * 8, z, 0.7, 2, y, y + 7, IRON);
}

/** A notice board on legs, facing +Z: wood frame, parchment notices. */
export function noticeBoard(out: Out, x: number, z: number, y: number): void {
  for (const s of [-1, 1]) c(out, x + s * 9, z, 0.9, 0.9, y, y + 34, WOOD);
  b(out, [x - 10, y + 12, z - 0.8], [x + 10, y + 32, z + 0.8], WOOD);
  b(out, [x - 8.6, y + 13.4, z + 0.8], [x + 8.6, y + 30.6, z + 1.1], WOOD_LT);
  b(out, [x - 7.5, y + 16, z + 1.1], [x - 1, y + 29, z + 1.4], CREAM);
  b(out, [x + 1, y + 18, z + 1.1], [x + 7.5, y + 28, z + 1.4], CREAM);
  b(out, [x - 11, y + 32, z - 1.6], [x + 11, y + 35, z + 1.6], ROOF);
}

/** Lady Justice on a pedestal, facing +Z: blindfold, raised gold scales, sword at her side. */
export function justice(out: Out, x: number, z: number, y: number): void {
  c(out, x, z, 6, 6, y, y + 4, STONE_SH);
  c(out, x, z, 5, 5, y + 4, y + 20, STONE);
  c(out, x, z, 6, 6, y + 20, y + 23, GOLD);
  // Robe, torso, head.
  c(out, x, z, 3.4, 2.6, y + 23, y + 42, STONE);
  c(out, x, z, 2.6, 2, y + 42, y + 52, STONE);
  c(out, x, z, 1.6, 1.6, y + 52, y + 60, STONE);
  b(out, [x - 1.7, y + 56, z + 1.4], [x + 1.7, y + 57.6, z + 1.8], STONE_SH);
  // Raised right arm with the scales.
  c(out, x + 3.6, z, 0.9, 0.9, y + 48, y + 62, STONE);
  b(out, [x + 3.2, y + 62, z - 0.4], [x + 4, y + 66, z + 0.4], GOLD);
  b(out, [x - 0.4, y + 65, z - 0.4], [x + 7.6, y + 66, z + 0.4], GOLD);
  for (const sx of [0, 7.2]) {
    b(out, [x + sx - 0.2, y + 59, z - 0.3], [x + sx + 0.4, y + 65, z + 0.3], GOLD);
    c(out, x + sx + 0.1, z, 1.6, 1.2, y + 58, y + 59, GOLD);
  }
  // Left arm down with the sword.
  c(out, x - 3.6, z, 0.9, 0.9, y + 38, y + 50, STONE);
  b(out, [x - 4, y + 22, z + 0.8], [x - 3.2, y + 40, z + 1.4], CREAM);
  b(out, [x - 5.4, y + 38, z + 0.6], [x - 1.8, y + 39, z + 1.6], GOLD);
}

/** A tiered fountain with glowing water, centred on (x, z). */
export function fountain(out: Out, x: number, z: number, y: number, r = 16): void {
  // Octagonal rim from two crossed slabs, water inside.
  c(out, x, z, r, r * 0.62, y, y + 6, STONE);
  c(out, x, z, r * 0.62, r, y, y + 6, STONE);
  c(out, x, z, r + 0.8, r * 0.62 + 0.8, y + 6, y + 7.5, STONE_SH);
  c(out, x, z, r * 0.62 + 0.8, r + 0.8, y + 6, y + 7.5, STONE_SH);
  c(out, x, z, r - 2, r * 0.62 - 1.2, y + 1, y + 5.2, WATER, 0.45);
  c(out, x, z, r * 0.62 - 1.2, r - 2, y + 1, y + 5.2, WATER, 0.45);
  // Middle bowl, upper bowl, spout.
  c(out, x, z, 2.6, 2.6, y + 5, y + 18, STONE);
  c(out, x, z, 7.5, 7.5, y + 18, y + 21, STONE);
  c(out, x, z, 6.4, 6.4, y + 20.4, y + 21.4, WATER, 0.55);
  c(out, x, z, 1.8, 1.8, y + 21, y + 30, STONE);
  c(out, x, z, 4, 4, y + 30, y + 32, STONE);
  c(out, x, z, 3, 3, y + 31.4, y + 32.4, WATER, 0.55);
  c(out, x, z, 0.8, 0.8, y + 32, y + 38, WATER, 0.7);
  c(out, x, z, 1, 1, y + 38, y + 40, CREAM, 0.6);
  // Falling sheets from the upper bowl.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    c(out, x + dx * 7.2, z + dz * 7.2, dx ? 0.4 : 3, dz ? 0.4 : 3, y + 6, y + 19.5, WATER, 0.5);
  }
}

/** A plank bridge along Z with rope rails, between two islands at height y. */
export function bridge(out: Out, x: number, z0: number, z1: number, y: number, half = 12): void {
  b(out, [x - half, y - 2, z0], [x + half, y, z1], WOOD_LT);
  for (let z = z0 + 2; z < z1; z += 4) b(out, [x - half - 0.5, y - 0.2, z], [x + half + 0.5, y + 0.3, z + 0.5], WOOD);
  for (const s of [-1, 1]) {
    const rx = x + s * (half - 0.8);
    for (let z = z0 + 3; z <= z1 - 3; z += Math.max(6, (z1 - z0 - 6) / 4)) c(out, rx, z, 0.8, 0.8, y, y + 14, WOOD);
    b(out, [rx - 0.4, y + 12, z0 + 2], [rx + 0.4, y + 13, z1 - 2], CREAM);
    b(out, [rx - 0.4, y + 6, z0 + 2], [rx + 0.4, y + 6.8, z1 - 2], CREAM);
  }
  // Underside beams so the bridge reads from below.
  for (const s of [-1, 1]) c(out, x + s * (half - 2), (z0 + z1) / 2, 1.2, (z1 - z0) / 2, y - 6, y - 2, WOOD);
}

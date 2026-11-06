/**
 * The courthouse grounds beyond the street doors, after the style guide's
 * isometric sheet: a terrace level with the doors, a grand staircase with a
 * red runner down to a sunken plaza, Lady Justice on both newels, a tiered
 * fountain, lawns with round trees and flower beds, iron lamps, benches, and a
 * balustrade around a floating island. A bridge leaves the south edge for the
 * arrival islands (approach.ts).
 *
 * Walkable tops stay at or below 2.7 (floors); anything taller is a barrier.
 * Authored in unscaled coordinates; the world builder grows X and Z.
 */
import { courthouseBoxes, FRONT } from './courthouse';
import {
  b,
  balustrade,
  bannerPole,
  bench,
  bridge,
  c,
  fountain,
  GOLD,
  island,
  justice,
  lamp,
  lawn,
  LEAF_DK,
  noticeBoard,
  pine,
  planter,
  RED,
  STONE,
  STONE_SH,
  tree,
  type Out,
} from './kit';

/** The plaza island: the terrace starts at the street wall, the island ends at the bridge. */
export const GROUNDS = { x: 132, z0: FRONT, z1: 400 } as const;
/** Feet height on the sunken plaza. The terrace at the doors is y = 0. */
export const PLAZA_Y = -30;
/** The grand staircase: ten steps of 3 down from the terrace edge. */
export const STAIRS = { x: 30, z0: 180, steps: 10, run: 3, rise: 3 } as const;
const TERRACE = { z1: STAIRS.z0 } as const;

export function groundsBoxes(): Out {
  const out: Out = [];
  const y = PLAZA_Y;
  const g = GROUNDS;

  // ── Island and terrace ────────────────────────────────────────────
  island(out, -g.x, g.z0, g.x, g.z1, y, 90, 11);
  // Terrace block up to the door sill, marble on top, red carpet to the stairs.
  b(out, [-g.x + 4, y, g.z0], [g.x - 4, -1, TERRACE.z1], STONE_SH);
  out[out.length - 1]!.walk = true;
  b(out, [-g.x + 4, -1, g.z0], [g.x - 4, 0, TERRACE.z1], STONE);
  b(out, [-9, 0, g.z0], [9, 0.5, TERRACE.z1], RED);
  for (const s of [-1, 1]) b(out, [s * 9, 0, g.z0], [s * 10.4, 0.6, TERRACE.z1], GOLD);
  // Terrace balustrade, broken for the stairs.
  balustrade(out, 0, TERRACE.z1 - 1.5, -g.x + 6, -STAIRS.x - 6, 0);
  balustrade(out, 0, TERRACE.z1 - 1.5, STAIRS.x + 6, g.x - 6, 0);
  for (const s of [-1, 1]) balustrade(out, 2, s * (g.x - 6), g.z0 + 12, TERRACE.z1 - 1.5, 0);
  for (const x of [-96, -84, 84, 96]) planter(out, x, TERRACE.z1 - 9, 0);
  for (const s of [-1, 1]) lamp(out, s * (STAIRS.x + 3), TERRACE.z1 - 4, 0, 46);

  // ── Grand staircase ───────────────────────────────────────────────
  const stairsFrom = out.length;
  for (let k = 0; k < STAIRS.steps; k++) {
    const z0 = STAIRS.z0 + k * STAIRS.run;
    const top = -(k + 1) * STAIRS.rise;
    b(out, [-STAIRS.x, y, z0], [STAIRS.x, top, z0 + STAIRS.run], STONE);
    b(out, [-STAIRS.x, top - 0.6, z0 + STAIRS.run - 0.6], [STAIRS.x, top, z0 + STAIRS.run], STONE_SH);
    b(out, [-9, top, z0], [9, top + 0.4, z0 + STAIRS.run], RED);
    for (const s of [-1, 1]) b(out, [s * 9, top, z0], [s * 10.2, top + 0.5, z0 + STAIRS.run], GOLD);
    for (let i = stairsFrom; i < out.length; i++) out[i]!.walk = true;
    // Stepped cheek walls.
    for (const s of [-1, 1]) b(out, [s * STAIRS.x, y, z0], [s * (STAIRS.x + 6), top + 8, z0 + STAIRS.run], STONE_SH);
  }
  const foot = STAIRS.z0 + STAIRS.steps * STAIRS.run;
  // Newel pedestals carrying Lady Justice, the plaza's two lamps at the foot.
  for (const s of [-1, 1]) {
    justice(out, s * (STAIRS.x + 18), foot + 6, y);
    lamp(out, s * (STAIRS.x + 3), foot + 2, y, 46);
  }

  // ── Plaza floor: marble walk on the cobbles, lawns either side ────
  b(out, [-14, y, foot], [14, y + 0.4, g.z1], STONE);
  for (const s of [-1, 1]) b(out, [s * 14, y, foot], [s * 15.2, y + 0.5, g.z1], GOLD);
  // Ring around the fountain.
  const fz = 300;
  b(out, [-34, y, fz - 22], [34, y + 0.4, fz + 22], STONE);
  b(out, [-22, y, fz - 34], [22, y + 0.4, fz + 34], STONE);
  fountain(out, 0, fz, y + 0.4, 18);
  // Lawns: two either side, split by a cross path at the fountain.
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? 44 : -g.x + 6;
    const x1 = s > 0 ? g.x - 6 : -44;
    lawn(out, x0, foot + 10, x1, fz - 12, y, 21 + s);
    lawn(out, x0, fz + 12, x1, g.z1 - 8, y, 31 + s);
    // Box hedges along the lawns' inner edges.
    for (const [z0, z1] of [[foot + 10, fz - 12], [fz + 12, g.z1 - 8]] as const) {
      const hx = s > 0 ? x0 : x1;
      b(out, [hx - 2, y, z0], [hx + 2, y + 9, z1], LEAF_DK);
    }
    tree(out, s * 100, 236, y + 0.6, 1.15);
    tree(out, s * 74, 266, y + 0.6, 0.9);
    tree(out, s * 102, 344, y + 0.6, 1.2);
    tree(out, s * 72, 376, y + 0.6, 0.95);
    pine(out, s * 122, 222, y + 0.6, 1.1);
    pine(out, s * 122, 388, y + 0.6, 1.2);
    bannerPole(out, s * 54, 228, y, 1);
    bannerPole(out, s * 54, 372, y, 1);
    // Lamps line the walk outside the fountain ring; benches sit back from it, so the ring stays a full loop.
    for (const z of [232, 256, 344, 368]) lamp(out, s * 20, z, y, 44);
    bench(out, s * 32, fz - 50, y, -1);
    bench(out, s * 32, fz + 50, y, 1);
  }
  noticeBoard(out, -30, g.z1 - 18, y);

  // ── Edge balustrade, the south gap for the bridge ─────────────────
  for (const s of [-1, 1]) balustrade(out, 2, s * (g.x - 1.5), TERRACE.z1, g.z1 - 1.5, y);
  balustrade(out, 0, g.z1 - 1.5, -g.x + 1.5, -16, y);
  balustrade(out, 0, g.z1 - 1.5, 16, g.x - 1.5, y);
  for (const s of [-1, 1]) {
    c(out, s * 16, g.z1 - 1.5, 3, 3, y, y + 22, STONE);
    c(out, s * 16, g.z1 - 1.5, 3.4, 3.4, y + 22, y + 24, GOLD);
  }
  bridge(out, 0, g.z1, g.z1 + 40, y, 13);

  out.push(...courthouseBoxes());
  return out;
}

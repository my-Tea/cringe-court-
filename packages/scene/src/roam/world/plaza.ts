/**
 * The courthouse plaza beyond the street doors. The cubes live in the
 * Blockbench project `courthouse-plaza` and are mirrored in plaza-cubes.ts.
 * Walkable tops stay at or below carpet height (2.7) so they are floors.
 * Anything taller (fountain rim, statues, trunks, railing) is a barrier.
 * Authored in unscaled coordinates; the world builder grows X and Z.
 */
import type { Box } from '../../courtroom/geometry';
import { box } from './boxes';
import { PLAZA_CUBES } from './plaza-cubes';

export const GROUNDS = { x: 120, z0: 152, z1: 372 } as const;
/** Feet height on the lower court. The porch at the doors sits at y ≈ 0. */
export const PLAZA_Y = -6;

export function groundsBoxes(): Box[] {
  return PLAZA_CUBES.map((c) => box(c.f, c.t, c.m));
}

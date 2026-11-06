/**
 * The jury box, rebuilt for seven. The cutaway's box held three velvet seats in
 * one row (Grand Jury appoints seven), with a wall pilaster standing in the
 * middle seat and a sideboard overlapping the third. It is replaced by a
 * two-tier box along the right wall, lengthened toward the well:
 *
 * - front row: three seats at floor level (slots 0–2, filled first, so Solo and
 *   Versus juries of three sit here);
 * - back row: four seats on a riser (slots 3–6), staggered so every back-row
 *   face shows between two front-row heads from the well and the counsel tables.
 *
 * The box faces −X (the well). It stays staff-only: an invisible barrier
 * closes it, and a player juror is seated in slot 2 by the hearing.
 */
import type { Box } from '../../courtroom/geometry';
import { C } from '../palette';
import type { Vec3 } from '../types';
import { box, within } from './boxes';

export const JURY_BOX = {
  /** Outer footprint; x1 is the side wall's inner face. */
  x0: 72.4,
  x1: 91,
  z0: -70,
  z1: 10,
  /** The front panel's inner face. */
  rail: 74.8,
  railTop: 19.5,
  /** Floor platform top and the back-row riser. */
  floor: 2.6,
  riserX: 84.2,
  riserTop: 20,
} as const;

/** The slot a player juror takes: front row, nearest the gallery, with clear sightlines to the bench and both counsel. */
export const PLAYER_JURY_SLOT = 2;

/** How far a seated juror's body origin sits above the seat platform (matches the original box). */
const SIT_LIFT = 1.9;

/** Seat slots, in fill order. `pos` is the seated juror's origin; jurors face −X. */
export const JURY_SLOTS: ReadonlyArray<{ pos: Vec3; row: 'front' | 'back' }> = [
  { pos: [80.4, JURY_BOX.floor + SIT_LIFT, -50], row: 'front' },
  { pos: [80.4, JURY_BOX.floor + SIT_LIFT, -30], row: 'front' },
  { pos: [80.4, JURY_BOX.floor + SIT_LIFT, -10], row: 'front' },
  { pos: [88.6, JURY_BOX.riserTop + SIT_LIFT, -60], row: 'back' },
  { pos: [88.6, JURY_BOX.riserTop + SIT_LIFT, -40], row: 'back' },
  { pos: [88.6, JURY_BOX.riserTop + SIT_LIFT, -20], row: 'back' },
  { pos: [88.6, JURY_BOX.riserTop + SIT_LIFT, 0], row: 'back' },
];

/** The cutaway's jury box, its pilasters and the sideboard it overlapped (the side wall's skin stays). */
export function isOldJuryBox(b: Box): boolean {
  return within(b, { x: [72.5, 97.3], y: [-0.5, 42], z: [-70.2, 9] }) && b.f[0] < 89.5;
}

/** A velvet juror's chair: seat cushion, back and gold piping. */
function chair(out: Box[], x: number, y: number, z: number): void {
  out.push(box([x - 4.8, y, z - 7.4], [x + 3.6, y + 6.5, z + 7.4], C.royal900));
  out.push(box([x - 4.4, y + 6, z - 6.6], [x + 3, y + 7, z + 6.6], C.royal700));
  out.push(box([x + 2.6, y + 6.5, z - 7.4], [x + 4, y + 14.5, z + 7.4], C.royal700));
  out.push(box([x + 2.4, y + 14.5, z - 7.6], [x + 4.2, y + 15.6, z + 7.6], C.gold300));
  out.push(box([x - 5.2, y, z - 8.1], [x + 4, y + 6.5, z - 7.4], C.gold500));
  out.push(box([x - 5.2, y, z + 7.4], [x + 4, y + 6.5, z + 8.1], C.gold500));
}

export function juryBoxBoxes(): Box[] {
  const { x0, x1, z0, z1, rail, railTop, floor, riserX, riserTop } = JURY_BOX;
  const out: Box[] = [];
  // Platform and a carpet runner.
  out.push(box([x0 - 0.8, 0, z0 - 0.8], [x1, 1.3, z1 + 0.8], C.neutral300));
  out.push(box([x0, 1.3, z0], [x1, floor, z1], C.neutral100));
  out.push(box([rail + 0.4, floor, z0 + 2], [riserX, floor + 0.1, z1 - 2], C.royal900));
  // Riser for the back row, with a gold nosing.
  out.push(box([riserX, floor, z0], [x1, riserTop, z1], C.gold900));
  out.push(box([riserX - 0.6, riserTop - 1.2, z0], [riserX + 0.6, riserTop, z1], C.gold500));
  // Front panel: dark wood with gold balusters and a cap rail.
  out.push(box([x0, floor, z0], [rail, railTop - 1.3, z1], C.neutral300));
  out.push(box([x0, railTop - 1.3, z0], [rail, railTop, z1], C.gold500));
  out.push(box([x0 - 0.3, floor, z0], [x0 + 0.9, railTop - 1.3, z1], C.neutral500));
  for (let z = z0 + 2.7; z < z1 - 1; z += 7.8) out.push(box([x0 - 0.26, floor, z], [x0 + 0.78, railTop - 1.3, z + 1.43], C.gold500));
  // End panels: the far end (by the bench) closes to the wall; the near end is lower so the gallery sees in.
  out.push(box([x0, floor, z0], [x1, railTop + 6, z0 + 2.6], C.neutral300));
  out.push(box([x0, railTop + 6, z0], [x1, railTop + 7.3, z0 + 2.6], C.gold500));
  out.push(box([x0, floor, z1 - 2.6], [x1, railTop, z1], C.neutral300));
  out.push(box([x0, railTop, z1 - 2.6], [x1, railTop + 1.3, z1], C.gold500));
  // A back wainscot so the back row sits against wood, not plaster.
  out.push(box([x1 - 1.2, riserTop, z0], [x1, riserTop + 16, z1], C.gold900));
  out.push(box([x1 - 1.4, riserTop + 16, z0], [x1, riserTop + 17.3, z1], C.gold500));
  for (const s of JURY_SLOTS) chair(out, s.pos[0], s.row === 'front' ? floor : riserTop, s.pos[2]);
  // Brass plaque on the front panel.
  out.push(box([x0 - 0.5, 9, -24], [x0, 13, -16], C.gold300));
  return out;
}

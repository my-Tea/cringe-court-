/**
 * Turn the cutaway courtroom (cc-art/dist/scene/courtroom.boxes.json, built to
 * be rendered from outside) into a closed room you can stand in:
 *
 * - side walls, taller end walls and a coffered ceiling (the renders had none);
 * - the main doors stand open onto the lobby, the gaps beside the frame are walled;
 * - the centre gallery pews come out so the red carpet is a real aisle, and the
 *   centre of the bar railing becomes an open swing gate;
 * - the witness stand moves out from under the bench onto the dais step and
 *   loses its aisle-side panel so it can be entered;
 * - the third pew row (which sat outside the back wall) stays as lobby seating,
 *   minus its centre pew, which blocked the doorway.
 *
 * Every change is a region filter or an added box, so it re-applies cleanly if
 * the generator output changes. Colours are remapped to the palette later.
 */
import type { Box } from '../../courtroom/geometry';
import { box, centre, mirrorZ, translate, within } from './boxes';
import { C } from '../palette';

export const COURT = {
  x: 91,
  zFront: -71,
  zBack: 71,
  ceiling: 136,
  wallOuter: 96,
  door: { x: 22.2, frame: 24.82, gap: 38, z0: 64.9, z1: 76 },
} as const;

const WALL = C.neutral100;
const TRIM = C.gold500;
const WOOD = C.gold900;
const WOOD_DARK = C.neutral900;
const GOLD_LIGHT = C.gold300;

function isRemoved(b: Box): boolean {
  const c = centre(b);
  // Door leaves, panels, knobs, glass and the dark doorway fill (frame jambs are re-added).
  if (within(b, { x: [-23.9, 23.9], y: [0, 57.9], z: [64.8, 73.5] }) && b.t[1] > 2.1) return true;
  // Centre gallery pews (z 40 and 64 rows) and the centre third-row pew (lobby).
  if (within(b, { x: [-27, 27], z: [29, 99] }) && b.t[1] <= 20 && b.t[1] > 2.5) return true;
  if (within(b, { x: [-27, 27], z: [77, 99] }) && b.t[1] <= 2.5) return true;
  // Centre of the bar railing (posts at ±21 stay).
  if (within(b, { z: [13.8, 18.2], y: [0, 21] }) && Math.abs(c[0]) < 19.5) return true;
  // Witness stand: the aisle-side panel.
  if (within(b, { x: [-20.1, -17.4], y: [2.4, 17.6], z: [-43.1, -32.9] })) return true;
  // The doors' centre crest hung at head height in the open doorway.
  if (within(b, { x: [-1.5, 1.5], y: [45, 60.1], z: [67, 71] })) return true;
  // The back-wall wainscot ran straight across the doorway (re-added either side).
  if (within(b, { x: [-95.1, 95.1], y: [0, 12.1], z: [70.9, 72.6] }) && b.t[0] - b.f[0] > 150) return true;
  return false;
}

/** Added structure: walls, ceiling, door jambs and open leaves, the railing gate, the stand step. */
function additions(): Box[] {
  const { x, ceiling, wallOuter } = COURT;
  const out: Box[] = [];
  // Side walls with a wainscot and a gold dado rail.
  for (const s of [-1, 1]) {
    out.push(box([s * x, 0, -76], [s * wallOuter, ceiling, 151], WALL));
    out.push(box([s * (x - 0.6), 0, -71], [s * x, 12, 146], WOOD));
    out.push(box([s * (x - 0.9), 12, -71], [s * x, 13.4, 146], TRIM));
  }
  // End walls raised to the ceiling.
  out.push(box([-wallOuter, 104, -76], [wallOuter, ceiling, -71], WALL));
  out.push(box([-wallOuter, 104, 71], [wallOuter, ceiling, 76], WALL));
  // Ceiling slab and coffer beams every bay (38), plus a perimeter cornice.
  out.push(box([-wallOuter, ceiling, -76], [wallOuter, ceiling + 4, 76], WALL));
  for (let bz = -57; bz <= 57; bz += 38) out.push(box([-x, ceiling - 4, bz - 2], [x, ceiling, bz + 2], TRIM));
  for (let bx = -76; bx <= 76; bx += 38) out.push(box([bx - 2, ceiling - 4, -71], [bx + 2, ceiling, 71], TRIM));
  out.push(box([-x, ceiling - 7, -71], [x, ceiling - 4, -68], GOLD_LIGHT));
  out.push(box([-x, ceiling - 7, 68], [x, ceiling - 4, 71], GOLD_LIGHT));
  // Wall the gaps beside the door frame (the renders left them open).
  const d = COURT.door;
  for (const s of [-1, 1]) {
    out.push(box([s * d.frame, 0, 71], [s * d.gap, 78, 76], WALL));
    // Frame jambs.
    out.push(box([s * 22.1, 0, 65.9], [s * d.frame, 61.2, 74.1], WOOD_DARK));
    // Open leaves, swung out into the lobby against the jambs.
    const x0 = s * 22.1;
    const x1 = s * 20.4;
    out.push(box([x0, 1.7, 74.1], [x1, 56.1, 94.5], WOOD));
    out.push(box([s * 20.3, 6.8, 78], [s * 19.9, 40.8, 90.5], C.gold700));
    out.push(box([s * 20.3, 44.2, 76], [s * 19.9, 49.3, 92.5], TRIM));
    out.push(box([s * 20.3, 25.5, 91], [s * 19.6, 32.3, 93], GOLD_LIGHT));
  }
  // Railing gate: two gold half-gates swung open into the aisle (the well stays clear).
  for (const s of [-1, 1]) {
    out.push(box([s * 19.8, 2.4, 18.2], [s * 18.6, 15.6, 34.7], TRIM));
    out.push(box([s * 19.9, 14.4, 18.2], [s * 18.5, 16.8, 34.7], GOLD_LIGHT));
    out.push(box([s * 19.9, 0, 18.2], [s * 18.5, 2.4, 34.7], TRIM));
  }
  // The back-wall wainscot, either side of the doorway.
  for (const s of [-1, 1]) out.push(box([s * 95, 0, 71], [s * d.frame, 12, 72.5], C.neutral500));
  return out;
}

/** Gallery pew rows inside the room. The generator built them facing the doors; they turn to face the bench. */
const PEW_ROWS = [40, 64] as const;

function isPew(b: Box, row: number): boolean {
  return within(b, { y: [0, 16.1], z: [row - 11, row + 11] }) && Math.min(Math.abs(b.f[0]), Math.abs(b.t[0])) >= 35 && Math.max(Math.abs(b.f[0]), Math.abs(b.t[0])) <= 89;
}

/**
 * The generator tucked the witness stand under the judge's bench (there is no
 * room to stand in it). It moves forward and up onto the first dais step.
 */
export const WITNESS_SHIFT = [3, 8.4, 10] as const;
/** The stand after the move: outer footprint, interior, floor height. */
export const WITNESS_STAND = { x0: -39.5, x1: -14.5, z0: -38, z1: -18, inner: { x0: -37, x1: -17, z0: -33, z1: -23 }, floor: 10.9 } as const;

function isWitnessStand(b: Box): boolean {
  if (!within(b, { x: [-43.3, -16.7], y: [0, 34], z: [-48.8, -27.2] })) return false;
  // The dais front posts share the region but stay put.
  return !(b.f[2] >= -33.4 && b.t[2] <= -31.9 && b.t[1] <= 5.2);
}

export function adaptCourtroom(boxes: readonly Box[]): Box[] {
  const kept = boxes.filter((b) => !isRemoved(b));
  const out = kept.map((b) => {
    if (isWitnessStand(b)) return translate([b], WITNESS_SHIFT)[0]!;
    const row = PEW_ROWS.find((r) => isPew(b, r));
    return row === undefined ? b : mirrorZ([b], row)[0]!;
  });
  return [...out, ...additions()];
}

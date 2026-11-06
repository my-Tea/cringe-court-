/**
 * The courthouse seen from outside, after the style guide's isometric sheet
 * (courtroom_issue ref 11): a six-column ivory portico on a terrace, a stepped
 * pediment carrying the scales in a gold roundel, two wings with arched
 * windows and royal-red banners, corner towers, and red tile roofs over the
 * lobby and the courtroom behind it. The street doors (lobby.ts) sit in the
 * deep doorway at the back of the portico.
 *
 * Unscaled coordinates (X and Z grow by ROOM_SCALE). The terrace floor is
 * y = 0, level with the lobby; the facade's face is at z = FRONT.
 */
import { COURT } from './courtroom';
import { b, banner, c, GOLD, CREAM, IRON, LANTERN, MAROON, RED, ROOF, SKYGLASS, STONE, STONE_SH, scales, WOOD, WOOD_LT, type Out } from './kit';
import { LOBBY } from './lobby';

/** Outer face of the street wall. */
export const FRONT = LOBBY.z1 + 5;
/** Portico depth in front of the wall (the columns' centre line). */
const COLS_Z = FRONT + 15;
const PORTICO = { x: 72, z1: FRONT + 21, top: 96 } as const;
const WING = { x0: 72, x1: 112, front: FRONT + 4, top: 92 } as const;
const DOOR = { x: 26, top: 64 } as const;

function column(out: Out, x: number, z: number, h: number): void {
  c(out, x, z, 4.8, 4.8, 0, 4, STONE_SH);
  c(out, x, z, 4.2, 4.2, 4, 6, GOLD);
  c(out, x, z, 3.5, 3.5, 6, h - 8, STONE);
  // Flutes: shaded strips down the shaft's four faces.
  for (const s of [-1, 1]) {
    b(out, [x - 1, 8, z + s * 3.5], [x + 1, h - 10, z + s * 3.8], STONE_SH);
    b(out, [x + s * 3.5, 8, z - 1], [x + s * 3.8, h - 10, z + 1], STONE_SH);
  }
  c(out, x, z, 4.4, 4.4, h - 8, h - 4, GOLD);
  c(out, x, z, 5, 5, h - 4, h, STONE);
}

/** Arched window on a wall facing +Z at depth z: gold frame, glowing panes, keystone. */
function archWindow(out: Out, x: number, z: number, y: number, w: number, h: number): void {
  b(out, [x - w - 1.2, y - 1.2, z], [x + w + 1.2, y + h, z + 0.9], GOLD);
  b(out, [x - w, y, z + 0.2], [x + w, y + h - 4, z + 1.1], SKYGLASS, 0.35);
  // Stepped arch head.
  b(out, [x - w + 1.2, y + h - 4, z + 0.2], [x + w - 1.2, y + h - 1.6, z + 1.1], SKYGLASS, 0.35);
  b(out, [x - w - 2.2, y + h, z], [x + w + 2.2, y + h + 1.6, z + 1.4], STONE_SH);
  c(out, x, z + 1, 1.2, 0.6, y + h - 1, y + h + 3, GOLD);
  // Mullion and transom.
  b(out, [x - 0.4, y, z + 1.1], [x + 0.4, y + h - 1.6, z + 1.5], GOLD);
  b(out, [x - w, y + h * 0.55, z + 1.1], [x + w, y + h * 0.55 + 0.8, z + 1.5], GOLD);
  // Sill.
  b(out, [x - w - 2, y - 2.6, z], [x + w + 2, y - 1.2, z + 2.2], STONE_SH);
}

/**
 * A stepped hip roof: each course shrinks on every side, red tiles with a gold
 * ridge. Rendered with the roof tile texture.
 */
function hipRoof(out: Out, x0: number, z0: number, x1: number, z1: number, y: number, courses: number, rise = 4, stepX = 3, stepZ = 3): number {
  // Eave: a cream fascia under the first course.
  b(out, [x0 - 1.5, y - 1.5, z0 - 1.5], [x1 + 1.5, y, z1 + 1.5], CREAM);
  for (let i = 0; i < courses; i++) {
    const ax0 = x0 + i * stepX;
    const ax1 = x1 - i * stepX;
    const az0 = z0 + i * stepZ;
    const az1 = z1 - i * stepZ;
    if (ax0 >= ax1 || az0 >= az1) break;
    b(out, [ax0 - 1, y + i * rise, az0 - 1], [ax1 + 1, y + (i + 1) * rise, az1 + 1], ROOF);
  }
  const top = y + courses * rise;
  const rx0 = x0 + (courses - 1) * stepX;
  const rx1 = x1 - (courses - 1) * stepX;
  const rz0 = z0 + (courses - 1) * stepZ;
  const rz1 = z1 - (courses - 1) * stepZ;
  if (rx1 > rx0 && rz1 > rz0) b(out, [rx0, top, (rz0 + rz1) / 2 - 1], [rx1, top + 1.6, (rz0 + rz1) / 2 + 1], GOLD);
  return top;
}

/**
 * The street doors seen from the porch: two tall oak leaves with raised
 * panels, iron studs and gold ring knockers, in a gold frame on a stone sill.
 * They sit on the outer face of the lobby's own door at depth `z`, so from
 * outside the doorway is a door, not a dark hole.
 */
function streetDoors(out: Out, z: number): void {
  const x = DOOR.x;
  const top = DOOR.top;
  const d = z + 1.2;
  // Sill and frame.
  b(out, [-x - 1, 0, z], [x + 1, 0.8, d + 2.4], STONE_SH);
  b(out, [-x, top - 1.6, z], [x, top, d + 0.4], GOLD);
  for (const s of [-1, 1]) b(out, [s * (x - 1.2), 0.8, z], [s * x, top, d + 0.4], GOLD);
  for (const s of [-1, 1]) {
    // One leaf, hinged at the frame, meeting the other at the centre seam.
    const x0 = s * 0.6;
    const x1 = s * (x - 1.2);
    b(out, [x0, 0.8, z], [x1, top - 1.6, d], WOOD);
    // Raised panels: a tall lower pair and a short upper one, planks between.
    const inner = s * 3;
    const outer = s * (x - 4.2);
    for (const [y0, y1] of [[5, 30], [34, 56]] as const) {
      b(out, [inner, y0, d], [outer, y1, d + 0.5], WOOD_LT);
      b(out, [inner + s * 1.4, y0 + 1.4, d + 0.5], [outer - s * 1.4, y1 - 1.4, d + 0.8], WOOD);
    }
    // Iron straps across the leaf, studded.
    for (const y of [12, 46]) {
      b(out, [x0 + s * 0.4, y, d], [x1 - s * 0.4, y + 1.6, d + 0.9], IRON);
      for (let i = 0; i < 4; i++) {
        const sx = s * (4 + i * ((x - 8) / 3));
        b(out, [sx - 0.5, y + 0.3, d + 0.9], [sx + 0.5, y + 1.3, d + 1.3], GOLD);
      }
    }
    // Gold ring knocker on a boss, near the seam.
    c(out, s * 5, d + 1, 1.4, 0.5, 31, 34, GOLD);
    b(out, [s * 3.8, 26, d + 1], [s * 6.2, 27, d + 1.6], GOLD);
    b(out, [s * 3.6, 27, d + 1], [s * 4.2, 31, d + 1.6], GOLD);
    b(out, [s * 5.8, 27, d + 1], [s * 6.4, 31, d + 1.6], GOLD);
  }
  // The dark seam where the leaves meet.
  b(out, [-0.6, 0.8, z], [0.6, top - 1.6, d - 0.2], IRON);
}

function tower(out: Out, x: number, z: number): void {
  const h = 128;
  c(out, x, z, 9, 9, 0, h, STONE);
  c(out, x, z, 9.6, 9.6, 0, 6, STONE_SH);
  for (const y of [44, 92]) c(out, x, z, 9.8, 9.8, y, y + 3, GOLD);
  // Quoins: alternating corner blocks.
  for (let y = 8; y < h - 8; y += 12) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c(out, x + sx * 8.6, z + sz * 8.6, 1.2, 1.2, y, y + 6, STONE_SH);
  }
  archWindow(out, x, z + 9, 54, 3.2, 26);
  c(out, x, z, 10.4, 10.4, h, h + 4, STONE_SH);
  c(out, x, z, 10.8, 10.8, h + 4, h + 6, GOLD);
  // Pyramid roof and finial.
  for (let i = 0; i < 9; i++) {
    const r = 10.4 - i * 1.15;
    c(out, x, z, r, r, h + 6 + i * 4, h + 10 + i * 4, ROOF);
  }
  c(out, x, z, 0.9, 0.9, h + 42, h + 54, GOLD);
  c(out, x, z, 1.8, 1.8, h + 48, h + 50, GOLD);
}

export function courthouseBoxes(): Out {
  const out: Out = [];
  const zf = FRONT;

  // ── Street wall skin around the deep doorway ──────────────────────
  b(out, [-PORTICO.x, 0, zf - 1], [-DOOR.x - 4, PORTICO.top, zf + 2], STONE);
  b(out, [DOOR.x + 4, 0, zf - 1], [PORTICO.x, PORTICO.top, zf + 2], STONE);
  b(out, [-DOOR.x - 4, DOOR.top + 14, zf - 1], [DOOR.x + 4, PORTICO.top, zf + 2], STONE);
  // Door surround: stepped gold architrave and a glowing fanlight over the doors.
  for (const s of [-1, 1]) {
    b(out, [s * DOOR.x, 0, zf - 5], [s * (DOOR.x + 4), DOOR.top + 14, zf + 2.4], STONE_SH);
    b(out, [s * (DOOR.x + 0.2), 0, zf + 2.4], [s * (DOOR.x + 1.6), DOOR.top + 12, zf + 3.2], GOLD);
  }
  b(out, [-DOOR.x, DOOR.top, zf - 5], [DOOR.x, DOOR.top + 2, zf + 2.4], GOLD);
  streetDoors(out, LOBBY.z1 + 1);
  // The fanlight sits on the lobby wall's outer face, at the back of the recess.
  b(out, [-DOOR.x + 2, DOOR.top + 2, zf - 0.6], [DOOR.x - 2, DOOR.top + 12, zf + 0.2], LANTERN, 0.6);
  for (let x = -DOOR.x + 8; x < DOOR.x - 4; x += 8) b(out, [x - 0.5, DOOR.top + 2, zf + 0.2], [x + 0.5, DOOR.top + 12, zf + 0.8], GOLD);
  b(out, [-DOOR.x - 4, DOOR.top + 12, zf - 1], [DOOR.x + 4, DOOR.top + 14, zf + 3.4], GOLD);
  c(out, 0, zf + 2.6, 2.4, 0.8, DOOR.top + 10, DOOR.top + 17, GOLD);
  // Pilasters on the wall between the columns.
  for (const x of [-62, -38, 38, 62]) {
    b(out, [x - 3, 0, zf + 2], [x + 3, PORTICO.top - 6, zf + 3], STONE_SH);
    b(out, [x - 3.6, PORTICO.top - 10, zf + 2], [x + 3.6, PORTICO.top - 6, zf + 3.6], GOLD);
  }
  // Two banners on the wall behind the outer columns, two lanterns by the doors.
  banner(out, -50, zf + 2.6, 86, 44, 1, 6);
  banner(out, 50, zf + 2.6, 86, 44, 1, 6);
  for (const s of [-1, 1]) {
    c(out, s * (DOOR.x + 7), zf + 3.6, 1.2, 1, 40, 46, IRON);
    c(out, s * (DOOR.x + 7), zf + 4.6, 1.6, 1.6, 34, 41, LANTERN, 0.95);
    c(out, s * (DOOR.x + 7), zf + 4.6, 2, 2, 41, 42.5, IRON);
  }

  // ── Portico: six columns, entablature, pediment ───────────────────
  for (const x of [-62, -38, -14, 14, 38, 62]) column(out, x, COLS_Z, PORTICO.top);
  // Ceiling of the portico (overhead, so it never blocks the walk).
  b(out, [-PORTICO.x, PORTICO.top, zf - 1], [PORTICO.x, PORTICO.top + 10, PORTICO.z1], STONE);
  b(out, [-PORTICO.x - 1, PORTICO.top + 3, PORTICO.z1], [PORTICO.x + 1, PORTICO.top + 6, PORTICO.z1 + 1.2], GOLD);
  for (let x = -PORTICO.x + 4; x <= PORTICO.x - 4; x += 8) c(out, x, PORTICO.z1 + 0.4, 1.4, 0.8, PORTICO.top + 7, PORTICO.top + 10, STONE_SH);
  b(out, [-PORTICO.x - 2, PORTICO.top + 10, zf - 2], [PORTICO.x + 2, PORTICO.top + 12, PORTICO.z1 + 2], STONE_SH);
  // Stepped pediment: courses narrow toward the apex.
  const pedTop = PORTICO.top + 12;
  const courses = 9;
  for (let i = 0; i < courses; i++) {
    const hx = PORTICO.x - i * 7.6;
    if (hx < 6) break;
    b(out, [-hx, pedTop + i * 5, zf + 2], [hx, pedTop + (i + 1) * 5, PORTICO.z1 - 2], STONE);
    // Gold raking cornice along each course's front corners.
    for (const s of [-1, 1]) b(out, [s * hx - (s > 0 ? 4 : 0), pedTop + (i + 1) * 5 - 1.4, PORTICO.z1 - 2], [s * hx + (s > 0 ? 0 : 4), pedTop + (i + 1) * 5, PORTICO.z1 - 0.8], GOLD);
  }
  // Tympanum: maroon field, gold roundel, the scales.
  b(out, [-34, pedTop + 2, PORTICO.z1 - 2.4], [34, pedTop + 16, PORTICO.z1 - 1.8], MAROON);
  b(out, [-14, pedTop + 2, PORTICO.z1 - 2.4], [14, pedTop + 30, PORTICO.z1 - 1.8], MAROON);
  c(out, 0, PORTICO.z1 - 1.6, 11, 0.4, pedTop + 4, pedTop + 30, GOLD);
  c(out, 0, PORTICO.z1 - 1.6, 9, 0.6, pedTop + 2, pedTop + 32, GOLD);
  c(out, 0, PORTICO.z1 - 1.2, 8.4, 0.5, pedTop + 6, pedTop + 28, MAROON);
  scales(out, 0, PORTICO.z1 - 0.6, pedTop + 17, 1.1);
  // Apex: gold acroteria and a flag.
  c(out, 0, PORTICO.z1 - 4, 3, 3, pedTop + courses * 5 - 4, pedTop + courses * 5 + 2, GOLD);
  c(out, 0, PORTICO.z1 - 4, 0.7, 0.7, pedTop + courses * 5 + 2, pedTop + courses * 5 + 26, IRON);
  b(out, [0.7, pedTop + courses * 5 + 16, PORTICO.z1 - 4.4], [14, pedTop + courses * 5 + 25, PORTICO.z1 - 3.6], RED);
  for (const s of [-1, 1]) c(out, s * (PORTICO.x - 2), PORTICO.z1 - 2, 3, 3, pedTop, pedTop + 7, GOLD);

  // ── Wings ─────────────────────────────────────────────────────────
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? WING.x0 : -WING.x1;
    const x1 = s > 0 ? WING.x1 : -WING.x0;
    // Closed block outside the lobby's side wall (|x| = 96), and the wing's front skin across the street wall.
    const outer0 = s > 0 ? 96 : -WING.x1;
    const outer1 = s > 0 ? WING.x1 : -96;
    b(out, [outer0, 0, LOBBY.z0], [outer1, WING.top, WING.front], STONE);
    b(out, [x0, 0, FRONT - 1], [x1, WING.top, WING.front], STONE);
    b(out, [x0 - 0.4, 0, WING.front], [x1 + 0.4, 6, WING.front + 1.2], STONE_SH);
    b(out, [x0, 48, WING.front], [x1, 51, WING.front + 1.4], GOLD);
    b(out, [x0 - 1, WING.top - 4, WING.front], [x1 + 1, WING.top, WING.front + 2], STONE_SH);
    b(out, [x0 - 1, WING.top - 6, WING.front], [x1 + 1, WING.top - 4, WING.front + 1.6], GOLD);
    const mid = (x0 + x1) / 2;
    archWindow(out, mid - 10, WING.front, 12, 4.2, 30);
    archWindow(out, mid + 10, WING.front, 12, 4.2, 30);
    archWindow(out, mid - 10, WING.front, 56, 3.4, 24);
    archWindow(out, mid + 10, WING.front, 56, 3.4, 24);
    banner(out, mid, WING.front + 1.4, WING.top - 8, 34, 1, 4.5);
    hipRoof(out, x0 - 2, LOBBY.z0 - 2, x1 + 2, WING.front + 2, WING.top, 7, 4, 2.4, 2.4);
    // Side windows down the outer face of the wing.
    for (const z of [96, 124]) {
      const xs = s > 0 ? x1 : x0;
      b(out, [xs - 0.8, 14, z - 4], [xs + 0.8, 40, z + 4], GOLD);
      b(out, [xs - 1.2, 16, z - 3], [xs + 1.2, 38, z + 3], SKYGLASS, 0.3);
    }
    tower(out, s * 112, WING.front - 6);
  }

  // ── Roofs over the lobby and the courtroom ────────────────────────
  hipRoof(out, -WING.x0 + 2, LOBBY.z0 - 4, WING.x0 - 2, zf - 1, LOBBY.ceiling + 4, 8, 4.5, 3, 3);
  hipRoof(out, -COURT.wallOuter - 2, COURT.zFront - 7, COURT.wallOuter + 2, LOBBY.z0 + 2, COURT.ceiling + 2, 10, 4.5, 4, 3.4);
  // Courtroom flanks: windows down both long outer walls, gold string course.
  for (const s of [-1, 1]) {
    const x = s * (COURT.wallOuter + 0.6);
    b(out, [x - 0.8, 88, COURT.zFront - 5], [x + 0.8, 91, LOBBY.z0], GOLD);
    for (let z = COURT.zFront + 14; z < COURT.zBack; z += 28) {
      b(out, [x - 0.9, 30, z - 5], [x + 0.9, 80, z + 5], GOLD);
      b(out, [x - 1.3, 32, z - 4], [x + 1.3, 78, z + 4], SKYGLASS, 0.3);
    }
  }
  return out;
}

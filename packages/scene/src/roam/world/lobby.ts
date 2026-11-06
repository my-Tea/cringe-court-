/**
 * The lobby: a bounded hall outside the courtroom doors, so the player can roam
 * before and after the trial. Authored as boxes in the courtroom's voxel
 * language (cream stone, wood wainscot, gold trim, maroon banners) with the
 * reference's set dressing: a sunglasses bust, a globe, a potted plant, the
 * docket board, and locked street doors ("court is in session").
 */
import type { Box } from '../../courtroom/geometry';
import { box } from './boxes';

export const LOBBY = { x: 91, z0: 76, z1: 146, ceiling: 104 } as const;

const STONE = '#FFF9ED';
const STONE_SH = '#DCC8B0';
const STONE_DK = '#A9917D';
const WOOD = '#8B5E2A';
const WOOD_LT = '#B77D3A';
const WOOD_DK = '#4A3A32';
const GOLD = '#D9A046';
const GOLD_LT = '#F6C75B';
const PARCH = '#FFF2C7';
const MAROON = '#7A1C2E';
const RED = '#A32D3F';
const LEAF = '#3E7F50';
const LEAF_LT = '#6EBF73';
const SEA = '#3F8FA8';
const SKY = '#BFD7F5';

function column(out: Box[], x: number, z: number, h: number): void {
  out.push(box([x - 6, 0, z - 6], [x + 6, 4, z + 6], STONE_SH));
  out.push(box([x - 4.5, 4, z - 4.5], [x + 4.5, h - 6, z + 4.5], STONE));
  for (let k = -3; k <= 3; k += 3) out.push(box([x + k - 0.6, 6, z - 4.7], [x + k + 0.6, h - 8, z - 4.4], STONE_SH));
  out.push(box([x - 6, h - 6, z - 6], [x + 6, h - 3, z + 6], GOLD));
  out.push(box([x - 7, h - 3, z - 7], [x + 7, h, z + 7], STONE_SH));
}

/** A hanging banner with a pixel scales-of-justice emblem, on the wall plane x = wx (facing ±x). */
function banner(out: Box[], wx: number, face: 1 | -1, z: number, top: number): void {
  const x0 = wx;
  const x1 = wx + face * 1.2;
  const xf = wx + face * 1.6;
  out.push(box([x0, top - 2, z - 11], [x1 + face * 0.6, top, z + 11], GOLD));
  out.push(box([x0, top - 40, z - 9], [x1, top - 2, z + 9], MAROON));
  // Pointed tail.
  out.push(box([x0, top - 44, z - 6], [x1, top - 40, z + 6], MAROON));
  out.push(box([x0, top - 47, z - 3], [x1, top - 44, z + 3], MAROON));
  // Gold border.
  out.push(box([x1, top - 40, z - 9], [xf, top - 38.8, z + 9], GOLD));
  out.push(box([x1, top - 40, z - 9], [xf, top - 2, z - 7.8], GOLD));
  out.push(box([x1, top - 40, z + 7.8], [xf, top - 2, z + 9], GOLD));
  // Scales: post, beam, two pans.
  out.push(box([x1, top - 32, z - 0.8], [xf, top - 10, z + 0.8], GOLD_LT));
  out.push(box([x1, top - 13, z - 6], [xf, top - 11.6, z + 6], GOLD_LT));
  for (const s of [-1, 1]) {
    out.push(box([x1, top - 20, z + s * 5 - 0.4], [xf, top - 13, z + s * 5 + 0.4], GOLD_LT));
    out.push(box([x1, top - 22, z + s * 5 - 2.6], [xf, top - 20, z + s * 5 + 2.6], GOLD_LT));
  }
  out.push(box([x1, top - 34, z - 4], [xf, top - 32, z + 4], GOLD_LT));
}

function window(out: Box[], wx: number, face: 1 | -1, z: number): void {
  const x0 = wx;
  const x1 = wx + face * 1.5;
  out.push(box([x0, 28, z - 12], [x1, 31, z + 12], GOLD));
  out.push(box([x0, 31, z - 11], [wx + face * 0.6, 74, z + 11], SKY));
  out.push(box([x0, 74, z - 12], [x1, 77, z + 12], GOLD));
  out.push(box([x0, 77, z - 8], [x1, 81, z + 8], GOLD));
  out.push(box([x0, 81, z - 4], [x1, 84, z + 4], GOLD));
  for (const k of [-12, -0.75, 10.5]) out.push(box([x0, 31, z + k], [x1, 74, z + k + 1.5], WOOD_DK));
  out.push(box([x0, 52, z - 11], [x1, 53.5, z + 11], WOOD_DK));
}

function sconce(out: Box[], wx: number, face: 1 | -1, z: number): void {
  out.push(box([wx, 40, z - 2.5], [wx + face * 2, 46, z + 2.5], GOLD));
  out.push(box([wx + face * 1, 46, z - 2], [wx + face * 4.5, 48, z + 2], GOLD));
  out.push(box([wx + face * 1.8, 48, z - 1.2], [wx + face * 3.6, 53, z + 1.2], '#FFD79A'));
}

export function lobbyBoxes(): Box[] {
  const { x, z0, z1, ceiling } = LOBBY;
  const out: Box[] = [];

  // Floor: chequered marble, 19-unit tiles (half a courtroom bay).
  const t = 19;
  for (let ix = -5; ix < 5; ix++) {
    for (let iz = 0; iz < 4; iz++) {
      const fx = ix * t;
      const fz = z0 + iz * t;
      out.push(box([Math.max(fx, -x), -3, fz], [Math.min(fx + t, x), 0, Math.min(fz + t, z1)], (ix + iz) % 2 === 0 ? STONE : STONE_SH));
    }
  }
  // Runner carpet from the courtroom doors to the street doors.
  out.push(box([-14, 0, z0], [14, 0.8, z1 - 4], RED));
  out.push(box([-15.5, 0, z0], [-14, 0.9, z1 - 4], GOLD));
  out.push(box([14, 0, z0], [15.5, 0.9, z1 - 4], GOLD));

  // Street wall with the locked double doors.
  out.push(box([-96, 0, z1], [-26, ceiling, z1 + 5], STONE));
  out.push(box([26, 0, z1], [96, ceiling, z1 + 5], STONE));
  out.push(box([-26, 64, z1], [26, ceiling, z1 + 5], STONE));
  out.push(box([-26, 0, z1 - 1], [26, 64, z1 + 1], WOOD_DK));
  for (const s of [-1, 1]) {
    out.push(box([s * 1.2, 1.5, z1 - 2], [s * 23.5, 60, z1 - 1], WOOD));
    out.push(box([s * 4, 8, z1 - 2.6], [s * 20, 30, z1 - 2], WOOD_LT));
    out.push(box([s * 4, 34, z1 - 2.6], [s * 20, 56, z1 - 2], WOOD_LT));
    out.push(box([s * 2.2, 28, z1 - 3.4], [s * 4.4, 36, z1 - 2], GOLD_LT));
  }
  // Brass bar across both leaves: very much locked.
  out.push(box([-22, 31, z1 - 4.2], [22, 33.5, z1 - 2], GOLD));
  out.push(box([-26.5, 60, z1 - 2.5], [26.5, 64, z1], GOLD));
  // Ceiling, coffers, cornice, wainscot on the street and court walls.
  out.push(box([-96, ceiling, z0 - 5], [96, ceiling + 4, z1 + 5], STONE));
  for (let bx = -76; bx <= 76; bx += 38) out.push(box([bx - 2, ceiling - 4, z0], [bx + 2, ceiling, z1], GOLD));
  for (let bz = z0 + 17.5; bz < z1; bz += 35) out.push(box([-x, ceiling - 4, bz - 2], [x, ceiling, bz + 2], GOLD));
  for (const [za, zb] of [
    [z0, z0 + 0.6],
    [z1 - 0.6, z1],
  ] as const) {
    out.push(box([-x, 0, za], [-26.5, 12, zb], WOOD));
    out.push(box([26.5, 0, za], [x, 12, zb], WOOD));
  }

  // Columns along both long walls.
  for (const s of [-1, 1]) for (const z of [z0 + 12, z1 - 12]) column(out, s * 78, z, ceiling);
  // Windows, banners and sconces on the side walls.
  for (const s of [-1, 1] as const) {
    const wx = s * x;
    const face = (s === -1 ? 1 : -1) as 1 | -1;
    window(out, wx, face, 111);
    banner(out, wx, face, 89, 96);
    banner(out, wx, face, 133, 96);
    sconce(out, wx, face, 100);
    sconce(out, wx, face, 122);
  }

  // Docket board (left wall): framed parchment notices.
  const bx = -x;
  out.push(box([bx, 22, 96], [bx + 1.6, 58, 126], WOOD_DK));
  out.push(box([bx + 1.6, 24, 98], [bx + 2.2, 56, 124], WOOD_LT));
  const notices: Array<[number, number, number, number]> = [
    [100, 44, 110, 54],
    [112, 46, 122, 54],
    [100, 27, 108, 41],
    [110, 28, 122, 43],
  ];
  for (const [za, ya, zb, yb] of notices) {
    out.push(box([bx + 2.2, ya, za], [bx + 2.6, yb, zb], PARCH));
    for (let ly = yb - 3; ly > ya + 1; ly -= 2.5) out.push(box([bx + 2.6, ly, za + 1.2], [bx + 2.8, ly + 0.7, zb - 1.6], WOOD_DK));
    out.push(box([bx + 2.6, yb - 1.8, (za + zb) / 2 - 0.8], [bx + 3, yb - 0.4, (za + zb) / 2 + 0.8], RED));
  }

  // Bust of the first judge to wear sunglasses indoors (right wall, on a plinth).
  const px = 70;
  const pz = 136;
  out.push(box([px - 7, 0, pz - 7], [px + 7, 4, pz + 7], STONE_SH));
  out.push(box([px - 5, 4, pz - 5], [px + 5, 30, pz + 5], STONE));
  out.push(box([px - 6, 30, pz - 6], [px + 6, 33, pz + 6], GOLD));
  out.push(box([px - 7, 33, pz - 4], [px + 7, 40, pz + 4], STONE_SH)); // shoulders
  out.push(box([px - 2.5, 40, pz - 2.5], [px + 2.5, 43, pz + 2.5], STONE_SH)); // neck
  out.push(box([px - 5, 43, pz - 5], [px + 5, 55, pz + 5], STONE)); // head
  out.push(box([px - 5.5, 52, pz - 5.5], [px + 5.5, 57, pz + 5.5], STONE_SH)); // hair
  out.push(box([px - 4, 39, pz - 6], [px + 4, 46, pz - 4.6], STONE_SH)); // beard
  out.push(box([px - 5.4, 49, pz - 5.6], [px + 5.4, 51.6, pz - 5], WOOD_DK)); // the shades
  out.push(box([px - 4.6, 48, pz - 5.6], [px - 0.6, 49, pz - 5], WOOD_DK));
  out.push(box([px + 0.6, 48, pz - 5.6], [px + 4.6, 49, pz - 5], WOOD_DK));
  out.push(box([px - 3.8, 50.4, pz - 5.8], [px - 2.6, 51.2, pz - 5.6], STONE)); // glint

  // Globe on a gold stand (voxel sphere, r = 6).
  const gx = 70;
  const gz = 100;
  const gy = 34;
  out.push(box([gx - 5, 0, gz - 5], [gx + 5, 2, gz + 5], GOLD));
  out.push(box([gx - 1, 2, gz - 1], [gx + 1, 26, gz + 1], GOLD));
  out.push(box([gx - 0.6, 26, gz - 7.6], [gx + 0.6, 42, gz - 6.8], GOLD_LT));
  const r = 6;
  for (let i = -r; i < r; i += 2) {
    for (let j = -r; j < r; j += 2) {
      for (let k = -r; k < r; k += 2) {
        const d = Math.hypot(i + 1, j + 1, k + 1);
        if (d > r || d < r - 2.4) continue;
        const land = Math.sin((i + 1) * 0.9) + Math.cos((k + 1) * 0.7 + (j + 1) * 0.5) > 0.6;
        out.push(box([gx + i, gy + j, gz + k], [gx + i + 2, gy + j + 2, gz + k + 2], land ? LEAF_LT : SEA));
      }
    }
  }

  // Potted plant (left of the street doors).
  const lx = -60;
  const lz = 136;
  out.push(box([lx - 6, 0, lz - 6], [lx + 6, 12, lz + 6], WOOD_LT));
  out.push(box([lx - 6.5, 12, lz - 6.5], [lx + 6.5, 14, lz + 6.5], GOLD));
  out.push(box([lx - 1, 14, lz - 1], [lx + 1, 30, lz + 1], WOOD));
  const leaves: Array<[number, number, number, number]> = [
    [-8, 22, -2, 3],
    [3, 26, 2, 3],
    [-4, 32, 3, 3.5],
    [2, 36, -4, 3],
    [-6, 38, -3, 2.5],
    [0, 42, 0, 3],
    [5, 31, -3, 2.5],
  ];
  for (const [dx, y, dz, s] of leaves) out.push(box([lx + dx - s, y - s * 0.6, lz + dz - s], [lx + dx + s, y + s * 0.6, lz + dz + s], (dx + dz) % 2 === 0 ? LEAF : LEAF_LT));

  // Information desk (right of the court doors), unattended: the clerk is inside.
  out.push(box([40, 0, 112], [64, 18, 124], WOOD));
  out.push(box([39, 18, 111], [65, 20, 125], WOOD_LT));
  out.push(box([41, 2, 111.4], [63, 16, 111.9], STONE_DK));
  out.push(box([44, 20, 115], [50, 21, 121], PARCH));
  out.push(box([56, 20, 116], [58, 26, 118], GOLD_LT)); // desk bell
  return out;
}

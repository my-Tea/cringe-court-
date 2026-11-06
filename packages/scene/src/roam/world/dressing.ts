/**
 * Set dressing the cutaway render never needed but a walkable room does, after
 * the reference board (refs/theme-papercraft-login.jpg): the evidence table with
 * EXHIBIT A/B/C folders, folder stacks on both counsel desks, the defendant's
 * chair, a potted plant and a globe, and stained glass in the four windows
 * behind the bench. All colours are palette swatches.
 */
import type { Box } from '../../courtroom/geometry';
import { box } from './boxes';

/** A box that glows (unlit, emissive) in the roam renderer. */
export interface GlowBox extends Box {
  glow: number;
}

const WOOD = '#8B5E2A';
const WOOD_LT = '#B77D3A';
const WOOD_DK = '#4A3A32';
const GOLD = '#D9A046';
const GOLD_LT = '#F6C75B';
const PARCH = '#FFF2C7';
const CREAM = '#FFF9ED';
const MAROON = '#7A1C2E';
const RED = '#A32D3F';
const BLUE = '#4D7CC5';
const TEAL = '#3F8FA8';
const SKY = '#BFD7F5';
const LEAF = '#3E7F50';
const LEAF_LT = '#6EBF73';
const SEA = '#3F8FA8';

/** 3×5 pixel glyphs, rows top to bottom. */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
};

export interface ExhibitPlacement {
  id: 'exhibit-a' | 'exhibit-b' | 'exhibit-c';
  letter: 'A' | 'B' | 'C';
  /** Folder centre on the table top. */
  at: readonly [number, number, number];
  color: string;
}

export const EVIDENCE_TABLE = { x0: -15, x1: 15, z0: -12, z1: -3, top: 14 } as const;

export const EXHIBITS: readonly ExhibitPlacement[] = [
  { id: 'exhibit-a', letter: 'A', at: [-9, EVIDENCE_TABLE.top, -7.5], color: RED },
  { id: 'exhibit-b', letter: 'B', at: [0, EVIDENCE_TABLE.top, -7.5], color: GOLD },
  { id: 'exhibit-c', letter: 'C', at: [9, EVIDENCE_TABLE.top, -7.5], color: BLUE },
];

/** Where the defendant's chair stands (in front of the defence desk, facing the bench). */
export const DEFENDANT_CHAIR = { x: 56, z: -4, seat: 10 } as const;

/** A closed folder lying flat, label facing up (+Y), with its letter in pixel type. */
function folder(out: Box[], cx: number, y: number, cz: number, color: string, letter: string | null, tilt = 0): void {
  const w = 3.6;
  const d = 2.7;
  const ox = tilt;
  out.push(box([cx - w + ox, y, cz - d], [cx + w + ox, y + 0.8, cz + d], color));
  out.push(box([cx - w + ox - 0.1, y + 0.2, cz - d + 0.3], [cx + w + ox - 0.3, y + 0.6, cz + d - 0.3], PARCH)); // page edges
  out.push(box([cx - 2.6 + ox, y + 0.8, cz - 1.9], [cx + 2.6 + ox, y + 0.95, cz + 1.9], PARCH)); // label
  if (!letter) return;
  const rows = GLYPHS[letter]!;
  const px = 0.5;
  rows.forEach((row, r) => {
    [...row].forEach((on, c) => {
      if (on !== '1') return;
      const x0 = cx + ox - 0.75 + c * px;
      const z0 = cz - 1.25 + r * px;
      out.push(box([x0, y + 0.95, z0], [x0 + px, y + 1.05, z0 + px], WOOD_DK));
    });
  });
}

function evidenceTable(out: Box[]): void {
  const { x0, x1, z0, z1, top } = EVIDENCE_TABLE;
  for (const [x, z] of [
    [x0 + 1, z0 + 1],
    [x1 - 2.5, z0 + 1],
    [x0 + 1, z1 - 2.5],
    [x1 - 2.5, z1 - 2.5],
  ] as const) {
    out.push(box([x, 0, z], [x + 1.5, top - 1.5, z + 1.5], WOOD));
  }
  out.push(box([x0, top - 1.5, z0], [x1, top, z1], WOOD_LT));
  out.push(box([x0 - 0.4, top - 2.2, z0 - 0.4], [x1 + 0.4, top - 1.5, z1 + 0.4], GOLD));
  // Maroon runner hanging over the front edge, with a gold scales badge.
  out.push(box([-6, top - 0.05, z0 - 0.3], [6, top + 0.15, z1 + 0.3], MAROON));
  out.push(box([-6, top - 7, z1 + 0.15], [6, top, z1 + 0.35], MAROON));
  out.push(box([-6, top - 7.6, z1 + 0.15], [6, top - 7, z1 + 0.35], GOLD));
  out.push(box([-0.4, top - 6, z1 + 0.35], [0.4, top - 1.5, z1 + 0.5], GOLD_LT));
  out.push(box([-2.6, top - 2.2, z1 + 0.35], [2.6, top - 1.6, z1 + 0.5], GOLD_LT));
  for (const s of [-1, 1]) out.push(box([s * 2.2 - 0.9, top - 4.2, z1 + 0.35], [s * 2.2 + 0.9, top - 3.4, z1 + 0.5], GOLD_LT));
  for (const e of EXHIBITS) folder(out, e.at[0], e.at[1] + 0.15, e.at[2], e.color, e.letter, e.letter === 'B' ? 0.3 : 0);
  // A cold coffee nobody admits to.
  out.push(box([11.5, top, -11], [13.5, top + 2.6, -9], CREAM));
  out.push(box([13.5, top + 0.8, -10.4], [14.2, top + 1.9, -9.6], CREAM));
}

/** Folder stacks and a pen pot on a counsel desk (top at y = 28.6). */
function deskProps(out: Box[], cx: number, cz: number, mirror: 1 | -1): void {
  const y = 31.2;
  folder(out, cx - 6 * mirror, y, cz, RED, null);
  folder(out, cx - 6 * mirror, y + 0.8, cz + 0.2, GOLD, null, 0.4);
  folder(out, cx + 7 * mirror, y, cz - 1, BLUE, null);
  out.push(box([cx + 1 * mirror - 1, y, cz - 4], [cx + 1 * mirror + 1, y + 2.6, cz - 2], GOLD));
  out.push(box([cx + 1 * mirror - 0.3, y + 2.6, cz - 3.4], [cx + 1 * mirror + 0.3, y + 5, cz - 2.8], WOOD_DK));
}

/** The defendant's chair: low, wooden, very much the hot seat. */
function defendantChair(out: Box[]): void {
  const { x, z, seat } = DEFENDANT_CHAIR;
  for (const [dx, dz] of [
    [-4, -3.5],
    [3, -3.5],
    [-4, 2.5],
    [3, 2.5],
  ] as const) {
    out.push(box([x + dx, 0, z + dz], [x + dx + 1, seat - 1, z + dz + 1], WOOD));
  }
  out.push(box([x - 4.5, seat - 1, z - 4], [x + 4.5, seat, z + 4], WOOD_LT));
  out.push(box([x - 4, seat, z - 3.5], [x + 4, seat + 0.6, z + 3.5], RED));
  out.push(box([x - 4.5, seat, z + 3], [x + 4.5, seat + 16, z + 4], WOOD));
  out.push(box([x - 4.5, seat + 16, z + 2.7], [x + 4.5, seat + 17.2, z + 4.3], GOLD));
}

function plant(out: Box[], lx: number, lz: number): void {
  out.push(box([lx - 4.5, 0, lz - 4.5], [lx + 4.5, 9, lz + 4.5], CREAM));
  out.push(box([lx - 5, 9, lz - 5], [lx + 5, 10.5, lz + 5], GOLD));
  out.push(box([lx - 0.8, 10.5, lz - 0.8], [lx + 0.8, 22, lz + 0.8], WOOD));
  const leaves: Array<[number, number, number, number]> = [
    [-5, 16, -1, 2.6],
    [3, 19, 2, 2.6],
    [-3, 24, 2.5, 3],
    [2, 27, -3, 2.6],
    [-4, 29, -2, 2.2],
    [0, 32, 0, 2.6],
    [4, 23, -2.5, 2.2],
  ];
  for (const [dx, y, dz, s] of leaves) out.push(box([lx + dx - s, y - s * 0.6, lz + dz - s], [lx + dx + s, y + s * 0.6, lz + dz + s], (dx + dz) % 2 === 0 ? LEAF : LEAF_LT));
}

function globe(out: Box[], gx: number, gz: number): void {
  const gy = 27;
  out.push(box([gx - 4, 0, gz - 4], [gx + 4, 1.6, gz + 4], GOLD));
  out.push(box([gx - 0.8, 1.6, gz - 0.8], [gx + 0.8, 20, gz + 0.8], GOLD));
  out.push(box([gx - 0.5, 20, gz - 6.2], [gx + 0.5, 33, gz - 5.6], GOLD_LT));
  const r = 5;
  for (let i = -r; i < r; i += 2) {
    for (let j = -r; j < r; j += 2) {
      for (let k = -r; k < r; k += 2) {
        const d = Math.hypot(i + 1, j + 1, k + 1);
        if (d > r + 0.4 || d < r - 2.4) continue;
        const land = Math.sin((i + 1) * 1.1) + Math.cos((k + 1) * 0.8 + (j + 1) * 0.6) > 0.5;
        out.push(box([gx + i, gy + j, gz + k], [gx + i + 2, gy + j + 2, gz + k + 2], land ? LEAF_LT : SEA));
      }
    }
  }
}

/** The glass panes of the four arch windows behind the bench (z ≈ −70). */
export const BENCH_WINDOWS: ReadonlyArray<{ x0: number; x1: number }> = [
  { x0: -74.1, x1: -57.9 },
  { x0: -36.1, x1: -19.9 },
  { x0: 19.9, x1: 36.1 },
  { x0: 57.9, x1: 74.1 },
];
export const BENCH_GLASS = { y0: 31.35, y1: 57, z: -67.3 } as const;

/**
 * Stained glass: 2-unit cells over each pane, a lattice of leaded diamonds in
 * royal, blue and teal around a gold scales roundel. The glass glows; the lead
 * does not.
 */
export function stainedGlass(): GlowBox[] {
  const out: GlowBox[] = [];
  const cell = 2;
  const { y0, y1, z } = BENCH_GLASS;
  BENCH_WINDOWS.forEach((w, wi) => {
    const cx = (w.x0 + w.x1) / 2;
    const cy = y0 + (y1 - y0) * 0.58;
    const nx = Math.floor((w.x1 - w.x0) / cell);
    const ny = Math.floor((y1 - y0) / cell);
    const padX = (w.x1 - w.x0 - nx * cell) / 2;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const x = w.x0 + padX + i * cell;
        const y = y0 + j * cell;
        const u = x + cell / 2 - cx;
        const v = y + cell / 2 - cy;
        const r = Math.hypot(u, v * 0.9);
        const diag = Math.abs(((u + v) % 8) + 8) % 8;
        const diag2 = Math.abs(((u - v) % 8) + 8) % 8;
        let m: string;
        let glow = 0.75;
        if (r < 1.6) m = GOLD_LT;
        else if (r < 3.2) m = GOLD;
        else if (r < 4.6) {
          m = WOOD_DK;
          glow = 0;
        } else if (r < 6.6) m = (Math.round(Math.atan2(v, u) * 4) & 1) === 0 ? RED : GOLD_LT;
        else if (diag < 1.01 || diag2 < 1.01) {
          m = WOOD_DK;
          glow = 0;
        } else {
          const k = (Math.floor((u + v + 40) / 8) + Math.floor((u - v + 40) / 8) + wi) % 3;
          m = k === 0 ? BLUE : k === 1 ? TEAL : RED;
          if (j >= ny - 2) m = SKY;
        }
        out.push({ ...box([x, y, z - 1.2], [x + cell, y + cell, z], m), glow });
      }
    }
  });
  return out;
}

export function dressingBoxes(): Box[] {
  const out: Box[] = [];
  evidenceTable(out);
  deskProps(out, -56, -22, -1);
  deskProps(out, 56, -22, 1);
  defendantChair(out);
  plant(out, -85, -1);
  plant(out, -34, -9);
  globe(out, 74, 9);
  return out;
}

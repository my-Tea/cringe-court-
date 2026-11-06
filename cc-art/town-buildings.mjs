// Town architecture: the buildings, townscape and street furniture the town
// needs and the repo does not have. The village/building set was cut on
// 2026-11-02 (cc-art/dist/VILLAGE-DECISION.md), so everything here is new.
//
// Authored on Blockbench's 16-unit grid, one block = 16 units, +Y up, origin at
// the base centre. `node cc-art/town-buildings.mjs` writes
// cc-art/dist/town/buildings.json AND a .bbmodel so the same geometry can be
// opened and hand-edited in Blockbench.
//
// Reuses the palette keys from palette.mjs so nothing drifts from STYLE-GUIDE.
import fs from 'node:fs';
import path from 'node:path';
import { MAT as M } from './palette.mjs';

/** Blockbench block is 16 units. */
const B = 16;
/**
 * Scale applied to every authored box.
 *
 * The models are drawn on Blockbench's 16-unit block grid, but the town cell is
 * 28 world units, so an unscaled townhouse comes out 1.4 cells wide — barely
 * wider than the player — and a road 2.4 cells wide dwarfs it. 2.2 puts a house at
 * ~3 cells and the courthouse at ~9, which is what makes the lane read as a
 * street and the plaza as a square.
 */
const TOWN_BUILDING_SCALE = 2.2;

const b = (f, t, m) => ({ f, t, m });

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** A solid rectangular wall run with a gold course every `trim` blocks. */
function wall(x0, y0, z0, x1, y1, z1, mat, trim, trimMat) {
  const out = [b([x0, y0, z0], [x1, y1, z1], mat)];
  if (trim) {
    for (let y = y0 + trim; y < y1 - 1; y += trim) {
      out.push(b([x0 - 0.5, y, z0 - 0.5], [x1 + 0.5, y + 1, z1 + 0.5], trimMat));
    }
  }
  return out;
}

/** A pitched roof: stepped slabs, ridge along X. Reads as blocks, not a plane. */
function pitchedRoof(cx, cz, w, d, yBase, rise, mat, edgeMat) {
  const out = [];
  const steps = rise;
  for (let i = 0; i < steps; i++) {
    const inset = (i / steps) * (d / 2);
    const y = yBase + i * 3;
    out.push(b([cx - w / 2, y, cz - d / 2 + inset], [cx + w / 2, y + 3, cz + d / 2 - inset], mat));
  }
  // Ridge cap and eaves trim.
  out.push(b([cx - w / 2 - 1, yBase - 1, cz - d / 2 - 1], [cx + w / 2 + 1, yBase + 1, cz + d / 2 + 1], edgeMat));
  out.push(b([cx - w / 2, yBase + steps * 3, cz - 2], [cx + w / 2, yBase + steps * 3 + 2, cz + 2], edgeMat));
  return out;
}

/** A doorway: an arched opening framed in gold, with a dark recess behind. */
function doorway(x, z, y0, h, w, facing, frameMat, leafMat) {
  const out = [];
  const hw = w / 2;
  const d = 2;
  if (facing === 'z') {
    out.push(b([x - hw - 2, y0, z - d], [x - hw, y0 + h, z + d], frameMat));
    out.push(b([x + hw, y0, z - d], [x + hw + 2, y0 + h, z + d], frameMat));
    out.push(b([x - hw - 2, y0 + h, z - d], [x + hw + 2, y0 + h + 3, z + d], frameMat));
    out.push(b([x - hw, y0, z - 1], [x + hw, y0 + h, z + 1], leafMat));
  } else {
    out.push(b([x - d, y0, z - hw - 2], [x + d, y0 + h, z - hw], frameMat));
    out.push(b([x - d, y0, z + hw], [x + d, y0 + h, z + hw + 2], frameMat));
    out.push(b([x - d, y0 + h, z - hw - 2], [x + d, y0 + h + 3, z + hw + 2], frameMat));
    out.push(b([x - 1, y0, z - hw], [x + 1, y0 + h, z + hw], leafMat));
  }
  return out;
}

/** A window: recessed dark glass with a gold surround and a lit sill. */
function window_(x, y, z, w, h, facing, glassMat, frameMat) {
  const out = [];
  if (facing === 'z') {
    out.push(b([x - w / 2, y, z - 1], [x + w / 2, y + h, z + 1], glassMat));
    out.push(b([x - w / 2 - 2, y - 2, z - 2], [x - w / 2, y + h + 2, z + 2], frameMat));
    out.push(b([x + w / 2, y - 2, z - 2], [x + w / 2 + 2, y + h + 2, z + 2], frameMat));
    out.push(b([x - w / 2 - 2, y + h, z - 2], [x + w / 2 + 2, y + h + 2, z + 2], frameMat));
    out.push(b([x - w / 2 - 2, y - 2, z - 2], [x + w / 2 + 2, y, z + 2], frameMat));
  } else {
    out.push(b([x - 1, y, z - w / 2], [x + 1, y + h, z + w / 2], glassMat));
    out.push(b([x - 2, y - 2, z - w / 2 - 2], [x + 2, y + h + 2, z - w / 2], frameMat));
    out.push(b([x - 2, y - 2, z + w / 2], [x + 2, y + h + 2, z + w / 2 + 2], frameMat));
    out.push(b([x - 2, y + h, z - w / 2 - 2], [x + 2, y + h + 2, z + w / 2 + 2], frameMat));
  }
  return out;
}

/** Chimney with a lit stack. */
function chimney(x, z, y, h, mat, capMat) {
  return [
    b([x - 4, y, z - 4], [x + 4, y + h, z + 4], mat),
    b([x - 6, y + h, z - 6], [x + 6, y + h + 3, z + 6], capMat),
    b([x - 3, y + h + 3, z - 3], [x + 3, y + h + 5, z + 3], M.stoneDeep),
  ];
}

/* ── Buildings ───────────────────────────────────────────────────────────── */

export const BUILDINGS = {
  /**
   * The courthouse: a marble hall with a columned portico, a pediment and a
   * stepped approach. This is the facade the player walks out of, so it carries
   * the most detail.
   */
  courthouse: {
    label: 'Courthouse facade and portico',
    parts: [
      // Stepped approach.
      b([-56, 0, -20], [56, 3, 24], M.marbleMid),
      b([-48, 3, -16], [48, 6, 20], M.marble),
      b([-40, 6, -12], [40, 9, 16], M.marblePale),
      // Portico deck.
      b([-40, 9, -12], [40, 12, 12], M.marble),
      // Front wall with the door bay.
      ...wall(-40, 12, -12, -8, 52, -4, M.marble, 12, M.gold),
      ...wall(8, 12, -12, 40, 52, -4, M.marble, 12, M.gold),
      ...wall(-8, 44, -12, 8, 52, -4, M.marble, 0, M.gold),
      // Rear and side walls.
      ...wall(-40, 12, -40, 40, 52, -34, M.marble, 12, M.gold),
      ...wall(-40, 12, -34, -34, 52, -4, M.marble, 12, M.gold),
      ...wall(34, 12, -34, 40, 52, -4, M.marble, 12, M.gold),
      // Interior floor slab (so the inside is not a hole).
      b([-34, 11, -34], [34, 12, -4], M.marblePale),
      // Columns, four across the portico.
      ...[-36, -20, 20, 36].flatMap((x) => [
        b([x - 5, 12, 4], [x + 5, 18, 14], M.marbleMid),
        b([x - 4, 18, 5], [x + 4, 48, 13], M.marble),
        b([x - 6, 46, 3], [x + 6, 52, 15], M.gold),
        b([x - 7, 50, 2], [x + 7, 54, 16], M.goldLight),
      ]),
      // Entablature over the columns.
      b([-42, 52, 0], [42, 58, 16], M.marble),
      b([-43, 58, -1], [43, 61, 17], M.gold),
      // Pediment: stepped triangle toward the ridge.
      b([-42, 61, 0], [42, 64, 16], M.marble),
      b([-34, 64, 2], [34, 67, 14], M.marble),
      b([-24, 67, 4], [24, 70, 12], M.marble),
      b([-14, 70, 6], [14, 73, 10], M.marble),
      b([-4, 73, 7], [4, 76, 9], M.goldLight),
      // The court seal in the pediment.
      b([-10, 62, -1], [10, 72, 1], M.velvet),
      b([-7, 64, -1.5], [7, 70, 0], M.gold),
      // Door.
      ...doorway(0, -8, 12, 32, 16, 'z', M.gold, M.wood),
      // Windows flanking the door.
      ...window_(-24, 26, -11, 10, 14, 'z', M.blueLight, M.gold),
      ...window_(24, 26, -11, 10, 14, 'z', M.blueLight, M.gold),
      // Roof.
      ...pitchedRoof(0, -23, 76, 36, 52, 4, M.roof, M.roofDark),
      // Banner poles either side of the steps.
      ...[-30, 30].flatMap((x) => [
        b([x - 1, 9, 18], [x + 1, 46, 20], M.gold),
        b([x - 6, 34, 17], [x + 6, 44, 21], M.velvet),
      ]),
      // Corner lamps.
      ...[-38, 38].flatMap((x) => [b([x - 3, 12, 14], [x + 3, 30, 20], M.goldLight), b([x - 4, 30, 13], [x + 4, 34, 21], M.gold)]),
    ],
  },

  /** The tavern: timber frame, overhanging upper storey, hanging sign, hearth. */
  tavern: {
    label: 'Tavern with overhanging upper floor',
    parts: [
      // Ground floor: stone.
      ...wall(-24, 0, -16, 24, 28, 16, M.stone, 10, M.stoneDark),
      b([-24, 0, -16], [24, 2, 16], M.stoneDark),
      // Upper floor, wider — the classic jetty.
      ...wall(-28, 28, -20, 28, 50, 20, M.marblePale, 8, M.wood),
      // Timber frame on the upper floor.
      ...[-28, -14, 0, 14, 28].flatMap((x) => [b([x - 1.5, 28, 19], [x + 1.5, 50, 21], M.woodDark)]),
      b([-28, 38, 19], [28, 40, 21], M.woodDark),
      // Roof.
      ...pitchedRoof(0, 0, 60, 44, 50, 4, M.roof, M.roofDark),
      ...chimney(16, 4, 50, 20, M.stoneDark, M.stoneDeep),
      // Ground-floor door and windows (front is +Z).
      ...doorway(0, 16, 0, 24, 10, 'z', M.woodDark, M.wood),
      ...window_(-14, 10, 15, 8, 9, 'z', M.goldLight, M.woodDark),
      ...window_(14, 10, 15, 8, 9, 'z', M.goldLight, M.woodDark),
      // Upper windows.
      ...window_(-14, 33, 19, 8, 9, 'z', M.goldLight, M.woodDark),
      ...window_(14, 33, 19, 8, 9, 'z', M.goldLight, M.woodDark),
      // Hanging sign on a bracket.
      b([18, 44, 18], [30, 46, 20], M.woodDark),
      b([18, 46, 18], [20, 48, 20], M.woodDark),
      b([22, 40, 18], [30, 46, 21], M.gold),
      b([23, 42, 17.5], [29, 45, 18], M.velvet),
      // Barrel and crate out front.
      b([-22, 0, 16], [-14, 14, 24], M.wood),
      b([-21, 2, 17], [-15, 4, 23], M.woodDark),
      b([-21, 10, 17], [-15, 12, 23], M.woodDark),
    ],
  },

  /** The evidence archive: tall, narrow, many small windows, a strongroom door. */
  archive: {
    label: 'Evidence archive with strongroom',
    parts: [
      ...wall(-20, 0, -14, 20, 62, 14, M.stone, 9, M.stoneDark),
      b([-20, 0, -14], [20, 2, 14], M.stoneDeep),
      // Buttresses.
      ...[-20, 20].flatMap((x) => [b([x - 2, 0, -16], [x + 2, 54, 16], M.stoneDark)]),
      // Narrow windows, three storeys.
      ...[16, 34, 50].flatMap((y) => [
        ...window_(-10, y, 13, 5, 9, 'z', M.blueLight, M.stoneDark),
        ...window_(10, y, 13, 5, 9, 'z', M.blueLight, M.stoneDark),
      ]),
      // Strongroom door: gold, studded, deliberately heavy.
      ...doorway(0, 14, 0, 26, 12, 'z', M.stoneDeep, M.woodDark),
      b([-6, 4, 15], [6, 12, 16], M.gold),
      b([-2, 7, 16], [2, 9, 16.5], M.goldLight),
      // Roof and cupola.
      ...pitchedRoof(0, 0, 48, 34, 62, 3, M.roofDark, M.stoneDeep),
      b([-6, 71, -6], [6, 80, 6], M.marble),
      b([-8, 80, -8], [8, 83, 8], M.gold),
      b([-2, 83, -2], [2, 90, 2], M.goldLight),
    ],
  },

  /** The market hall: a stone arcade with an open, awninged front. */
  marketHall: {
    label: 'Market hall arcade',
    parts: [
      b([-44, 0, -18], [44, 3, 18], M.marbleMid),
      b([-40, 3, -14], [40, 6, 14], M.marble),
      // Back wall.
      ...wall(-40, 6, -14, 40, 34, -8, M.marble, 10, M.gold),
      // Side walls.
      ...wall(-40, 6, -14, -34, 34, 14, M.marble, 10, M.gold),
      ...wall(34, 6, -14, 40, 34, 14, M.marble, 10, M.gold),
      // Arcade columns along the front, tall enough to clear the head.
      ...[-34, -18, -2, 14, 30, 34].flatMap((x) => [
        b([x - 4, 6, 8], [x + 4, 10, 16], M.marbleMid),
        b([x - 3, 10, 9], [x + 3, 30, 15], M.marble),
        b([x - 5, 30, 7], [x + 5, 34, 17], M.gold),
      ]),
      // Entablature.
      b([-40, 34, 4], [40, 39, 18], M.marble),
      b([-41, 39, 3], [41, 42, 19], M.gold),
      ...pitchedRoof(0, -2, 84, 40, 38, 3, M.roof, M.roofDark),
      // Awnings hang *outside* the arcade line (z > 18) and above head height,
      // so they shade the pavement without closing the arcade off.
      ...[-26, 6].flatMap((x) => [
        b([x - 9, 30, 18], [x + 9, 32, 30], x < 0 ? M.velvet : M.blue),
        b([x - 9, 28, 28], [x + 9, 30, 31], M.gold),
      ]),
    ],
  },

  /** A plain townhouse. Three variants come from tinting and height only. */
  townhouse: {
    label: 'Two-storey townhouse',
    parts: [
      ...wall(-14, 0, -12, 14, 30, 12, M.marblePale, 10, M.woodDark),
      b([-14, 0, -12], [14, 2, 12], M.stoneDark),
      ...wall(-16, 30, -14, 16, 46, 14, M.marble, 8, M.woodDark),
      ...pitchedRoof(0, 0, 36, 32, 46, 3, M.roof, M.roofDark),
      ...chimney(8, -4, 46, 14, M.stoneDark, M.stoneDeep),
      ...doorway(0, 12, 0, 20, 9, 'z', M.woodDark, M.wood),
      ...window_(-8, 8, 11, 6, 8, 'z', M.goldLight, M.woodDark),
      ...window_(8, 8, 11, 6, 8, 'z', M.goldLight, M.woodDark),
      ...window_(-8, 33, 13, 6, 8, 'z', M.goldLight, M.woodDark),
      ...window_(8, 33, 13, 6, 8, 'z', M.goldLight, M.woodDark),
      // Window boxes.
      b([-11, 6, 11], [-5, 8, 13], M.green),
      b([5, 6, 11], [11, 8, 13], M.green),
    ],
  },

  /** The well: the town square's centrepiece. */
  well: {
    label: 'Covered well',
    parts: [
      b([-10, 0, -10], [10, 3, 10], M.stoneDark),
      b([-9, 3, -9], [9, 12, 9], M.stone),
      b([-10, 12, -10], [10, 14, 10], M.marbleMid),
      b([-7, 12, -7], [7, 13, 7], M.water),
      // Posts and roof.
      ...[-8, 8].flatMap((x) => [b([x - 1, 14, -1], [x + 1, 30, 1], M.woodDark)]),
      b([-9, 30, -6], [9, 32, 6], M.roof),
      b([-10, 32, -7], [10, 34, 7], M.roofDark),
      // Bucket and rope.
      b([-0.5, 18, -0.5], [0.5, 30, 0.5], M.stoneDeep),
      b([-3, 15, -3], [3, 19, 3], M.wood),
      b([-3.5, 14.5, -3.5], [3.5, 15.5, 3.5], M.gold),
    ],
  },

  /** A post-and-rail fence segment, one cell long, along X. */
  fence: {
    label: 'Post-and-rail fence',
    parts: [
      b([-1.5, 0, -1.5], [1.5, 12, 1.5], M.woodDark),
      b([-16, 4, -1], [16, 6, 1], M.wood),
      b([-16, 8, -1], [16, 10, 1], M.wood),
    ],
  },

  /** A lamp standard with a lit lantern. */
  lampStandard: {
    label: 'Lamp standard',
    parts: [
      b([-2, 0, -2], [2, 3, 2], M.stoneDeep),
      b([-1, 3, -1], [1, 30, 1], M.stoneDark),
      b([-4, 30, -4], [4, 34, 4], M.gold),
      b([-3, 34, -3], [3, 40, 3], M.goldLight),
      b([-4, 40, -4], [4, 43, 4], M.gold),
    ],
  },

  /** A market stall: counter, four posts, striped awning. */
  stall: {
    label: 'Market stall with awning',
    parts: [
      b([-14, 0, -9], [14, 9, 9], M.marblePale),
      b([-14, 9, 6], [14, 11, 9], M.wood),
      b([-15, 11, 5], [15, 12, 10], M.gold),
      // Posts.
      ...[[-13, -8], [13, -8], [-13, 8], [13, 8]].flatMap(([x, z]) => [b([x - 1, 0, z - 1], [x + 1, 28, z + 1], M.woodDark)]),
      // Striped awning: alternating panels.
      ...Array.from({ length: 8 }, (_, i) => {
        const x0 = -16 + i * 4;
        return b([x0, 28, -12], [x0 + 4, 30, 12], i % 2 ? M.velvet : M.marblePale);
      }),
      b([-16, 30, -12], [16, 31, 12], M.gold),
    ],
  },

  /** Hanging bunting: a catenary-ish string of pennants. */
  buntingRow: {
    label: 'Bunting across the street',
    parts: [
      b([-24, 30, -0.5], [24, 31, 0.5], M.stoneDeep),
      ...Array.from({ length: 9 }, (_, i) => {
        const x = -20 + i * 5;
        const sag = Math.abs(i - 4) * 1.2;
        return b([x - 1.6, 24 - sag, -0.5], [x + 1.6, 30 - sag, 0.5], i % 2 ? M.velvet : M.gold);
      }),
    ],
  },

  /** A cart, parked. */
  handcart: {
    label: 'Hand cart',
    parts: [
      b([-11, 5, -7], [11, 12, 7], M.wood),
      b([-11, 12, -7], [11, 13, 7], M.woodDark),
      b([-11, 5, -7], [-9, 13, 7], M.woodDark),
      b([9, 5, -7], [11, 13, 7], M.woodDark),
      ...[[-7, -8], [7, -8], [-7, 8], [7, 8]].flatMap(([x, z]) => [b([x - 4, 0, z - 1.5], [x + 4, 8, z + 1.5], M.stoneDeep)]),
      b([-2, 12, -8], [2, 14, 8], M.gold),
    ],
  },

  /** A market awning alone, for dressing gaps between stalls. */
  awning: {
    label: 'Free-standing awning',
    parts: [
      ...[[-12, -8], [12, -8], [-12, 8], [12, 8]].flatMap(([x, z]) => [b([x - 1, 0, z - 1], [x + 1, 26, z + 1], M.woodDark)]),
      ...Array.from({ length: 7 }, (_, i) => {
        const x0 = -15 + i * 4.3;
        return b([x0, 26, -11], [x0 + 4.3, 28, 11], i % 2 ? M.blue : M.marblePale);
      }),
      b([-15, 28, -11], [15, 29, 11], M.gold),
    ],
  },
};

export const BUILDING_NAMES = Object.keys(BUILDINGS);

/* ── Export ──────────────────────────────────────────────────────────────── */

const round = (n) => Math.round(n * 1000) / 1000;

const props = {};
const meta = {};
for (const [name, def] of Object.entries(BUILDINGS)) {
  const boxes = def.parts.map((p) => ({
    f: [round(p.f[0] * TOWN_BUILDING_SCALE), round(p.f[1] * TOWN_BUILDING_SCALE), round(p.f[2] * TOWN_BUILDING_SCALE)],
    t: [round(p.t[0] * TOWN_BUILDING_SCALE), round(p.t[1] * TOWN_BUILDING_SCALE), round(p.t[2] * TOWN_BUILDING_SCALE)],
    m: String(p.m).toUpperCase(),
    ...(p.glow ? { glow: p.glow } : {}),
  }));
  props[name] = boxes;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], box.f[i]);
      max[i] = Math.max(max[i], box.t[i]);
    }
  }
  meta[name] = {
    label: def.label,
    boxes: boxes.length,
    size: [round(max[0] - min[0]), round(max[1] - min[1]), round(max[2] - min[2])],
    floating: min[1] > 0.5,
  };
}

const OUT_DIR = path.join(import.meta.dirname, 'dist', 'town');
const json = `${JSON.stringify({ schemaVersion: 1, source: 'cc-art/town-buildings.mjs', cell: B, props, meta }, null, 0)}\n`;

/** The same geometry as a Blockbench project, for hand-editing in the GUI. */
function toBbmodel() {
  const elements = [];
  const groups = [];
  for (const [name, def] of Object.entries(BUILDINGS)) {
    const gid = `group_${name}`;
    const children = [];
    def.parts.forEach((p, i) => {
      const id = `${name}_${i}`;
      elements.push({
        name: id,
        box_uv: false,
        render_order: 'default',
        locked: false,
        export: true,
        scope: 0,
        allow_mirror_modeling: true,
        from: [p.f[0], p.f[1], p.f[2]],
        to: [p.t[0], p.t[1], p.t[2]],
        autouv: 0,
        color: 0,
        origin: [0, 0, 0],
        faces: {
          north: { uv: [0, 0, 16, 16] },
          east: { uv: [0, 0, 16, 16] },
          south: { uv: [0, 0, 16, 16] },
          west: { uv: [0, 0, 16, 16] },
          up: { uv: [0, 0, 16, 16] },
          down: { uv: [0, 0, 16, 16] },
        },
        type: 'cube',
        uuid: `${name}-${i}`,
      });
      children.push(id);
    });
    groups.push({ name, origin: [0, 0, 0], color: 0, children, uuid: gid });
  }
  return {
    meta: { format_version: '5.0', model_format: 'free', box_uv: false },
    name: 'CringeCourt_Town',
    model_identifier: '',
    visible_box: [1, 1, 0],
    variable_placeholders: '',
    multi_file_ruleset: '',
    variable_placeholder_buttons: [],
    timeline_setups: [],
    unhandled_root_fields: {},
    resolution: { width: 16, height: 16 },
    elements,
    outliner: groups.map((g) => g.uuid),
    textures: [],
    groups,
  };
}
const bbmodel = `${JSON.stringify(toBbmodel())}\n`;

if (process.argv.includes('--check')) {
  const stale = [
    ['town/buildings.json', json],
    ['town/buildings.bbmodel', bbmodel],
  ].filter(([rel, want]) => {
    const p = path.join(import.meta.dirname, 'dist', rel);
    return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== want;
  });
  if (stale.length) {
    console.error(`cc-art/town-buildings.mjs: stale → ${stale.map(([r]) => r).join(', ')}; run "node cc-art/town-buildings.mjs"`);
    process.exit(1);
  }
  console.log(`town buildings: up to date (${Object.keys(props).length} models)`);
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'buildings.json'), json);
  fs.writeFileSync(path.join(OUT_DIR, 'buildings.bbmodel'), bbmodel);
  const total = Object.values(props).reduce((n, l) => n + l.length, 0);
  console.log(`town buildings: ${Object.keys(props).length} models, ${total} boxes → cc-art/dist/town/`);
}

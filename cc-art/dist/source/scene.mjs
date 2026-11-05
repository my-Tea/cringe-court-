// Courtroom assembly — places every prop into a coherent room.
//
// Design rules that matter:
//  · Room is sized to the character (63 tall), not to the prop table.
//  · Wall bays are a fixed pitch; pilasters and engaged columns sit exactly on
//    bay boundaries so nothing drifts.
//  · Nothing floats: banners and sconces mount to rails that are part of the wall.
import { PROPS } from './props.mjs';
import { MAT as M } from './palette.mjs';

// Architectural props were authored at "dressing" size; these bring them to room
// scale for a 63-unit-tall character.
export const ARCH_SCALE = {
  column: 1.45,
  arch_window: 1.35,
  courtroom_door: 1.75,
  railing: 1.15,
  dais_step: 1.45,
  gallery_bench: 1.5,
  judge_bench: 1.3,
  witness_stand: 1.15,
  jury_box: 1.2,
  prosecutor_desk: 1.25,
  defense_desk: 1.25,
  court_seal: 1.6,
  banner_scales: 1.9,
  ceiling_ring: 1.8,
  spotlight_rig: 1.5,
  sconce: 1.4,
  evidence_screen: 1.6,
  sealed_ballot_box: 1.5,
  ballot_box_open: 1.5,
  judge_desk: 1.2,
  throne_chair: 1.45,
  bookshelf: 1.4,
  trunk: 1.35,
  bench: 1.4,
};
/** Explicit scale wins; otherwise fall back to the architectural default.
 *  (Multiplying both double-scaled the banners to 3.6× and shot them through
 *  the ceiling.) */
const SC = (n) => ARCH_SCALE[n] || 1;
const scaleFor = (item) => (item.scale != null ? item.scale : SC(item.p));
const r1 = (v) => Math.round(v * 100) / 100;

/** Rotate a box around Y by an exact multiple of 90°, scale, then translate. */
function placeBox(box, { pos, rot = 0, scale = 1 }) {
  const s = scale;
  const x0 = box.f[0] * s, y0 = box.f[1] * s, z0 = box.f[2] * s;
  const x1 = box.t[0] * s, y1 = box.t[1] * s, z1 = box.t[2] * s;
  const rotP = (x, z) => {
    switch (((rot % 360) + 360) % 360) {
      case 90: return [z, -x];
      case 180: return [-x, -z];
      case 270: return [-z, x];
      default: return [x, z];
    }
  };
  const [ax, az] = rotP(x0, z0);
  const [bx, bz] = rotP(x1, z1);
  return {
    f: [r1(Math.min(ax, bx) + pos[0]), r1(y0 + pos[1]), r1(Math.min(az, bz) + pos[2])],
    t: [r1(Math.max(ax, bx) + pos[0]), r1(y1 + pos[1]), r1(Math.max(az, bz) + pos[2])],
    m: box.m,
  };
}

const b = (f, t, m) => ({ f, t, m });

/* ------------------------------------------------------------------ room */
// 190 × 152 floor, 104 ceiling. Character is 63 tall → reads as a grand hall
// without dwarfing the actors.
export const ROOM = { w: 190, d: 152, h: 104, wall: 5, bay: 38 };

function roomShell() {
  const out = [];
  const { w, d, h, wall, bay } = ROOM;
  const hw = w / 2, hd = d / 2;

  /* ---- floor: chequered marble with gold inlay ---- */
  const TS = 38;
  for (let x = -hw; x < hw; x += TS) {
    for (let z = -hd; z < hd; z += TS) {
      const alt = (Math.round(x / TS) + Math.round(z / TS)) % 2 === 0;
      out.push(b([x, -3, z], [x + TS, 0, z + TS], alt ? M.marble : M.marbleMid));
      // inlay cross on the joins
      out.push(b([x, -0.4, z], [x + TS, 0.5, z + 2], M.gold));
      out.push(b([x, -0.4, z], [x + 2, 0.5, z + TS], M.gold));
    }
  }
  // runner door → dais
  out.push(b([-26, 0, -60], [26, 0.8, hd - wall], M.carpet));
  out.push(b([-30, 0, -60], [-26, 1.0, hd - wall], M.goldLight));
  out.push(b([26, 0, -60], [30, 1.0, hd - wall], M.goldLight));
  // cross-bar in front of the bench
  out.push(b([-74, 0, -58], [74, 0.7, -40], M.carpet));
  out.push(b([-74, 0, -40], [74, 0.75, -37], M.gold));

  /* ---- side walls, built on a fixed bay pitch ---- */
  for (const sx of [-1, 1]) {
    const xO = sx * hw;              // outer face
    const xI = sx * (hw - wall);     // inner face
    const lo = Math.min(xO, xI), hi = Math.max(xO, xI);
    for (let z = -hd; z < hd; z += bay) {
      const z1 = Math.min(z + bay, hd);
      // A box's from/to must be low→high on every axis, so the near-wall X
      // coordinates are normalised with min/max rather than trusting sign.
      const band = (xa, xb, y0, y1, za, zb, m) => b(
        [Math.min(xa, xb), y0, za], [Math.max(xa, xb), y1, zb], m,
      );
      // marble dado
      out.push(band(xO, xI, 0, 16, z, z1, M.marbleMid));
      out.push(band(xO, xI, 15, 17, z, z1, M.gold));
      // velvet field between the rails (inset from the inner face)
      out.push(band(sx * (hw - wall + 1.2), sx * (hw - wall - 0.2), 17, 84, z + 4, z1 - 4, M.velvet));
      out.push(band(sx * (hw - wall + 1.6), sx * (hw - wall - 0.1), 24, 76, z + 9, z1 - 9, M.royal1));
      // marble upper wall to the cornice
      out.push(band(xO, xI, 84, h - 10, z, z1, M.marble));
      out.push(band(sx * (hw - wall + 1.2), sx * (hw - wall - 0.6), 83, 86, z, z1, M.gold));
    }
    // continuous cornice
    const cx0 = Math.min(sx * (hw - wall - 1.5), sx * hw);
    const cx1 = Math.max(sx * (hw - wall - 1.5), sx * hw);
    out.push(b([cx0, h - 10, -hd], [cx1, h - 6, hd], M.marble));
    const gx0 = Math.min(sx * (hw - wall - 0.8), sx * (hw - wall + 0.5));
    const gx1 = Math.max(sx * (hw - wall - 0.8), sx * (hw - wall + 0.5));
    out.push(b([gx0, h - 6, -hd], [gx1, h - 3, hd], M.gold));
  }

  /* ---- back wall: marble reredos behind the bench ---- */
  out.push(b([-hw, 0, -hd], [hw, h, -hd + wall], M.marble));
  out.push(b([-hw, 0, -hd + wall], [hw, 14, -hd + wall + 1.5], M.marbleDark));
  out.push(b([-64, 14, -hd + wall], [64, 86, -hd + wall + 1.5], M.velvet));
  out.push(b([-67, 11, -hd + wall], [67, 16, -hd + wall + 2], M.gold));
  out.push(b([-67, 84, -hd + wall], [67, 89, -hd + wall + 2], M.gold));
  // banner rail (so the banners hang from something)
  out.push(b([-hw, 92, -hd + wall], [hw, 95, -hd + wall + 3], M.gold));
  out.push(b([-hw, 89, -hd + wall], [hw, 92, -hd + wall + 1.5], M.marble));

  /* ---- entry wall with a real doorway ---- */
  out.push(b([-hw, 0, hd - wall], [-38, h, hd], M.marble));
  out.push(b([38, 0, hd - wall], [hw, h, hd], M.marble));
  out.push(b([-38, 78, hd - wall], [38, h, hd], M.marble));
  out.push(b([-42, 75, hd - wall - 2], [42, 80, hd], M.gold));
  out.push(b([-hw, 0, hd - wall], [hw, 12, hd - wall + 1.5], M.marbleDark));
  out.push(b([-hw, h - 10, hd - wall], [hw, h - 6, hd], M.marble));
  out.push(b([-hw, h - 6, hd - wall], [hw, h - 3, hd], M.gold));

  /* ---- engaged columns on bay boundaries, half sunk into the wall ---- */
  const colProp = PROPS.column;
  const cs = 1.08;                 // ~33 tall, sits under the 84-high velvet band
  for (const sx of [-1, 1]) {
    // its own footprint is ~15 wide, so 62.8 back from the room edge puts the
    // column's inner face just off the wall plane, with the back buried.
    const px = sx * (hw - 6);
    for (let z = -hd + bay; z < hd - bay + 1; z += bay) {
      for (const bx of colProp.parts) {
        out.push(placeBox(bx, { pos: [px, 0, z], rot: 0, scale: cs }));
      }
    }
  }
  // two freestanding columns flanking the dais
  for (const sx of [-1, 1]) {
    for (const bx of colProp.parts) {
      out.push(placeBox(bx, { pos: [sx * 58, 0, -66], rot: 0, scale: cs * 1.12 }));
    }
  }
  return out;
}

/* --------------------------------------------------------------- layout */
// props already emitted by the shell (columns are placed there, not here)
const LAYOUT = [
  // ── dais + bench ────────────────────────────────────────────────
  { p: 'dais_step', pos: [0, 0, -42], rot: 0, scale: 2.1 },
  { p: 'dais_step', pos: [0, 3, -54], rot: 0, scale: 1.75 },
  { p: 'dais_step', pos: [0, 6, -66], rot: 0, scale: 1.4 },
  { p: 'judge_bench', pos: [0, 9, -62], rot: 0, scale: 1.9 },
  { p: 'gavel_block', pos: [24, 22, -48], rot: 0, scale: 1.8 },
  { p: 'throne_chair', pos: [0, 9, -68], rot: 0, scale: 1.5 },
  { p: 'court_seal', pos: [0, 56, -70], rot: 0, scale: 1.3 },
  { p: 'banner_scales', pos: [-52, 88, -70], rot: 0, scale: 1.7 },
  { p: 'banner_scales', pos: [52, 88, -70], rot: 0, scale: 1.7 },
  { p: 'neon_sign', pos: [0, 80, 70], rot: 180, scale: 1.4 },

  // ── the well ───────────────────────────────────────────────────
  { p: 'prosecutor_desk', pos: [-56, 0, -22], rot: 160, scale: 1.3 },
  { p: 'defense_desk', pos: [56, 0, -22], rot: 200, scale: 1.3 },
  { p: 'witness_stand', pos: [-30, 0, -38], rot: 180, scale: 1.25 },
  { p: 'jury_box', pos: [84, 0, -40], rot: 270, scale: 1.3 },
  { p: 'evidence_screen', pos: [-88, 34, -46], rot: 90, scale: 1.6 },
  { p: 'judge_desk', pos: [34, 0, -52], rot: 0, scale: 1.15 },
  { p: 'sealed_ballot_box', pos: [-62, 0, -8], rot: 20, scale: 1.5 },
  { p: 'bookshelf', pos: [-87, 0, -20], rot: 90, scale: 1.4 },
  { p: 'bookshelf', pos: [-87, 0, 20], rot: 90, scale: 1.4 },
  { p: 'trunk', pos: [86, 0, -8], rot: 270, scale: 1.4 },
  { p: 'bench', pos: [-82, 0, 44], rot: 90, scale: 1.5 },
  { p: 'bench', pos: [82, 0, 44], rot: 270, scale: 1.5 },

  // ── bar railing + gallery ──────────────────────────────────────
  { p: 'railing', pos: [-62, 0, 16], rot: 0, scale: 1.2 },
  { p: 'railing', pos: [0, 0, 16], rot: 0, scale: 1.2 },
  { p: 'railing', pos: [62, 0, 16], rot: 0, scale: 1.2 },
  ...[0, 1, 2].flatMap((row) =>
    [-62, 0, 62].map((x) => ({ p: 'gallery_bench', pos: [x, 0, 40 + row * 24], rot: 0, scale: 1.6 }))
  ),

  // ── architecture ───────────────────────────────────────────────
  { p: 'courtroom_door', pos: [0, 0, 70], rot: 180, scale: 1.7 },
  ...[-66, -28, 28, 66].map((x) => ({ p: 'arch_window', pos: [x, 30, -70], rot: 0, scale: 1.35 })),
  ...[-58, 0, 58].map((x) => ({ p: 'sconce', pos: [x, 46, -69], rot: 0, scale: 1.4 })),
  ...[-58, 0, 58].map((x) => ({ p: 'sconce', pos: [x, 46, 69], rot: 180, scale: 1.4 })),
  ...[-44, 0, 44].map((z) => ({ p: 'arch_window', pos: [-89, 30, z], rot: 90, scale: 1.3 })),
  ...[-44, 0, 44].map((z) => ({ p: 'arch_window', pos: [89, 30, z], rot: 270, scale: 1.3 })),
  { p: 'ceiling_ring', pos: [0, 96, -50], rot: 0, scale: 1.6 },
  { p: 'spotlight_rig', pos: [-44, 82, -34], rot: 0, scale: 1.5 },
  { p: 'spotlight_rig', pos: [44, 82, -34], rot: 0, scale: 1.5 },
  { p: 'spotlight_rig', pos: [0, 82, 22], rot: 0, scale: 1.5 },
];

export function buildCourtroom() {
  const boxes = roomShell();
  const placed = [];
  for (const item of LAYOUT) {
    const prop = PROPS[item.p];
    if (!prop) continue;
    const scale = scaleFor(item);
    for (const bx of prop.parts) {
      boxes.push(placeBox(bx, { pos: item.pos, rot: item.rot || 0, scale }));
    }
    placed.push({ prop: item.p, pos: item.pos, rot: item.rot || 0, scale: r1(scale), boxes: prop.parts.length });
  }
  return { boxes, placed };
}

/* --------------------------------------------------------------- shots */
// Eye height ~52 for a 63-tall character. Camera sits in open floor, never
// inside furniture — the room's clear lane is |x| < 50 and z between -20 and 62.
export const SHOTS = {
  // Wide establishing angles: these read as a room, not a corner.
  pov_entrance: { pos: [0, 58, 66], target: [0, 38, -64], fov: 72 },
  pov_well:     { pos: [0, 55, 26], target: [0, 36, -66], fov: 68 },
  pov_corner:   { pos: [-46, 56, 40], target: [10, 34, -60], fov: 70 },
  pov_corner_r: { pos: [46, 56, 40], target: [-10, 34, -60], fov: 70 },
  pov_bench:    { pos: [0, 60, -26], target: [0, 42, -70], fov: 62 },
  pov_gallery:  { pos: [0, 62, 66], target: [0, 30, -30], fov: 74 },
  iso:          { pos: [300, 265, 285], target: [0, 26, -14], fov: 30 },
  cutaway:      { pos: [-235, 185, 245], target: [0, 24, -18], fov: 34 },
};

// Held character props — ONE source of truth for the box geometry that is baked
// into the characters in vox-chars.mjs (judge gavel, defense EXHIBIT A paper,
// juror popcorn bucket, clerk papers) AND exported as standalone prop sprites
// (see the "character props" block at the end of props.mjs).
//
// Each *Boxes(...) function takes the anchor the character already used, in
// character space (x right, y up, -z = the character's front), and emits boxes
// in EXACTLY the order and with EXACTLY the arithmetic the character code had,
// so character renders stay pixel-identical. `standalone()` then re-bases the
// boxes for use as a prop (centred on x/z, ground at y=0, front toward +z).
import { H, C, b } from './vox-base.mjs';

/* ─────────────────────────────── geometry ─────────────────────────────── */

/** Judge's oversized gavel, upright. (gx, gy, gz) = base of the handle.
 *  Also used by fp-hands.mjs for the first-person gavel. */
export function gavelBoxes(gx, gy, gz = 0) {
  return [
    b([gx - 1.4, gy, gz - 1.4], [gx + 1.4, gy + 26, gz + 1.4], C.hairBr),
    b([gx - 6, gy + 24, gz - 3], [gx + 6, gy + 32, gz + 3], C.hairBrLt),
    b([gx - 6.6, gy + 26, gz - 3.4], [gx + 6.6, gy + 29, gz + 3.4], C.gold),
    // an end cap on each face of the head, mirrored about gx (pair() would
    // mirror about x=0 and put the second cap beside the Judge's far arm)
    b([gx - 7, gy + 24, gz - 3], [gx - 5.6, gy + 32, gz + 3], C.goldLt),
    b([gx + 5.6, gy + 24, gz - 3], [gx + 7, gy + 32, gz + 3], C.goldLt),
  ];
}

/** Defense counsel's EXHIBIT A paper. (x0, y0) = hand-side anchor of the sheet. */
export function exhibitABoxes(x0, y0) {
  return [
    b([x0 - 3, y0 + 4, -6], [x0 + 8, y0 + 16, -4.6], C.cream),
    b([x0 - 1, y0 + 13, -6.2], [x0 + 6, y0 + 14, -5], '#A32D3F'),
  ];
}

/** Juror's popcorn bucket. (x0, y0) = outer-left base anchor. */
export function popcornBoxes(x0, y0) {
  const out = [];
  out.push(b([x0 - 12, y0 + 2, -5], [x0 - 2, y0 + 13, -1], C.cream));
  out.push(b([x0 - 12, y0 + 10, -5.4], [x0 - 2, y0 + 13, -0.6], C.burg));
  for (let i = 0; i < 4; i++) out.push(b([x0 - 11 + i * 2.6, y0 + 13, -4], [x0 - 9.4 + i * 2.6, y0 + 16, -1.6], i % 2 ? C.goldLt : C.cream));
  return out;
}

/** Clerk's armful of papers. (x0, y0) = hand-side anchor of the stack. */
export function papersBoxes(x0, y0) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push(b([x0 - 9 + i * 0.6, y0 + 2 + i * 1.6, -6], [x0 + 4 + i * 0.6, y0 + 4 + i * 1.6, -3], i % 2 ? C.cream : C.creamSh));
  }
  return out;
}

/* ───────────── character-space anchors (what vox-chars.mjs passes) ───────────── */

export const ANCHORS = {
  gavel:   () => [H.torsoW + H.armW * 2 + 4, H.armBot + 4],
  exhibit: () => [-H.torsoW - H.armW * 2, H.armBot],
  popcorn: () => [-H.torsoW, H.armBot],
  papers:  () => [-H.torsoW, H.armBot],
};

/* ─────────────────────────── standalone re-basing ─────────────────────────── */

/** Bounds of a box list. */
export function bounds(boxes) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const x of boxes) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], x.f[i]); mx[i] = Math.max(mx[i], x.t[i]); }
  return { mn, mx };
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Re-base character-space boxes into a prop: front flipped to +z (props face the
 * camera, characters face -z), centred on x/z, ground at y=0.
 * `grip` is in the frame the boxes were built in; `origin` is where that frame's
 * (0,0,0) sits in character space (e.g. the gavel is built at 0,0 but worn at
 * ANCHORS.gavel()). `grip` is carried through the same transform and returned as
 * the prop's holdAnchor. `hand` is the character-space hand joint (centre of the
 * hand's bottom face) so game code can attach the prop: place the prop so that
 * holdAnchor lands on the hand joint, then add `handOffset` for the baked pose.
 */
export function standalone(boxes, { grip, hand, origin = [0, 0, 0] }) {
  const flipped = boxes.map((x) => b([x.f[0], x.f[1], -x.t[2]], [x.t[0], x.t[1], -x.f[2]], x.m));
  const { mn, mx } = bounds(flipped);
  const s = [-(mn[0] + mx[0]) / 2, -mn[1], -(mn[2] + mx[2]) / 2];
  const mv = (p) => [r3(p[0] + s[0]), r3(p[1] + s[1]), r3(p[2] + s[2])];
  const parts = flipped.map((x) => ({ f: mv(x.f), t: mv(x.t), m: x.m }));
  const g = mv([grip[0], grip[1], -grip[2]]);
  return {
    parts,
    holdAnchor: g,
    // where the character's hand sits relative to the grip, in prop space (z flipped)
    handOffset: [r3(hand[0] - origin[0] - grip[0]), r3(hand[1] - origin[1] - grip[1]), r3(-(hand[2] - origin[2] - grip[2]))],
  };
}

/** Hand joint (centre of the hand box) in character space. */
export const handJoint = (side, lift = 0) => [(side === 'right' ? 1 : -1) * (H.torsoW + H.armW * 1.5), H.armBot + lift * 1.4 - 2.5, 0];

/* ───────────────────────── posed gavel (voxel-snapped) ───────────────────────── */

/**
 * Rotate an upright box list about +z by `deg` (counter-clockwise, seen from +z)
 * and re-voxelise each source box on a `cell`-sized grid so the result is still
 * axis-aligned boxes. Output stays LAYERED in source order, and each layer is
 * ordered (y, x) ascending, so it must be drawn with keepOrder (see render.mjs).
 */
export function rotateVoxels(boxes, deg, cell = 1.4) {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const result = [];
  for (const x of boxes) {
    const grid = new Map();
    const nx = Math.max(1, Math.ceil((x.t[0] - x.f[0]) / cell * 2));
    const ny = Math.max(1, Math.ceil((x.t[1] - x.f[1]) / cell * 2));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const px = x.f[0] + ((i + 0.5) / nx) * (x.t[0] - x.f[0]);
      const py = x.f[1] + ((j + 0.5) / ny) * (x.t[1] - x.f[1]);
      const gx = Math.round((px * ca - py * sa) / cell), gy = Math.round((px * sa + py * ca) / cell);
      grid.set(`${gx},${gy}`, { gx, gy });
    }
    const cells = [...grid.values()].sort((p, q) => p.gy - q.gy || p.gx - q.gx);
    let run = null;
    const flush = () => { if (run) result.push(b([(run.gx0 - 0.5) * cell, (run.gy - 0.5) * cell, x.f[2]], [(run.gx1 + 0.5) * cell, (run.gy + 0.5) * cell, x.t[2]], x.m)); run = null; };
    for (const c of cells) {
      if (run && run.gy === c.gy && run.gx1 === c.gx - 1) run.gx1 = c.gx;
      else { flush(); run = { gx0: c.gx, gx1: c.gx, gy: c.gy }; }
    }
    flush();
  }
  return result;
}

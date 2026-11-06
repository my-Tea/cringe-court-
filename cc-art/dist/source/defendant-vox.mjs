// The Defendant — an ANONYMOUS, per-case stand-in (art bible part 2 #4).
// A hooded / masked voxel bust with no face and no skin: the creator's look
// (pink hoodie, pink hair) is deliberately never used. Everything that makes a
// case's defendant different is a parameter, and `variantForCase` derives those
// parameters deterministically from a caseId so the same case always gets the
// same stand-in on every client.
import { H, C, b, pair, torso, arms, legs, shadeHex } from './vox-base.mjs';
import { mulberry32 } from './core.mjs';

export const MASKS = ['bag', 'censor', 'hood'];
/** Hoodie accents, brand family only. Pink is excluded on purpose: that is the Creator. */
export const ACCENTS = {
  burgundy: '#6E1B2A',
  magenta: '#74184F',
  nearblack: '#2E2438',
  mustard: '#A97C2A',
  plum: '#4B2A6B',
};
export const GLINTS = { gold: '#F6C75B', cyan: '#A8F0F8', white: '#FFFFFF' };
export const EXPRESSIONS = ['neutral', 'smug', 'shocked', 'defeated', 'slump', 'celebrate'];

/** FNV-1a 32-bit. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** caseId (string | number) → variant parameters. Pure and deterministic.
 *  Draw order from mulberry32(fnv1a(caseId)): mask, accent, glint, tag bits. */
export function variantForCase(caseId) {
  const seed = fnv1a(caseId);
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const mask = pick(MASKS);
  const accent = pick(Object.keys(ACCENTS));
  const glint = pick(Object.keys(GLINTS));
  const tagBits = Array.from({ length: 6 }, () => (rnd() < 0.5 ? 0 : 1));
  if (!tagBits.includes(1)) tagBits[0] = 1;   // never a blank tag
  return { caseId: String(caseId), seed, mask, accent, glint, tagBits };
}

const TAN = '#C9A06A', TAN_SH = '#A87F4C', TAN_DK = '#8A6338';
const VOID = '#0E0A12';

/** Voxel boxes for one pose. `v` = variant, `expr` = one of EXPRESSIONS. */
export function defendantParts(v, expr = 'neutral') {
  const acc = ACCENTS[v.accent], accSh = shadeHex(acc, 0.72), accLt = shadeHex(acc, 1.25);
  const glint = GLINTS[v.glint];
  const w = H.headW, fz = -w;
  const out = [];
  // zero-size anchors: pin the renderer's auto-fit bounds so every pose (confetti, raised arms,
  // bag crumple) is drawn at the same scale. Degenerate boxes rasterise to nothing.
  for (const p of [[-28, 0, 0], [28, 0, 0], [0, 112, 0]]) out.push({ f: p, t: p, m: '#000000' });

  // celebrate raises the arms (arms(): positive lift raises)
  const lift = expr === 'celebrate' ? 14 : expr === 'slump' ? -8 : expr === 'defeated' ? -3 : 0;
  // heads hang lower when beaten
  const dy = expr === 'slump' ? 7 : expr === 'defeated' ? 3 : 0;

  // ── body: oversized hoodie, gloved hands (no skin anywhere) ─────────
  out.push(...torso({ col: acc, colSh: accSh, style: 'hoodie' }));
  out.push(...arms({ col: acc, colSh: accSh, cuff: accSh, hand: C.ink, lift }));
  out.push(...legs({ col: C.ink, shoe: C.ink }));
  // hood drape sitting on the shoulders, behind and around the neck
  out.push(b([-w - 3, H.torsoTop - 3, -4], [w + 3, H.headBot + 6, w + 4], accSh));
  out.push(b([-w - 4, H.torsoTop - 4, -8], [w + 4, H.torsoTop + 1, 7], acc));

  // ── case tag: booking-style placard on the chest, barcode = case bits ──
  const tz = -Math.round(H.torsoW * 0.62) - 1.8;
  out.push(b([1.5, 51, tz], [11.5, 64, tz + 1], C.cream));
  out.push(b([1.5, 61.5, tz - 0.3], [11.5, 64, tz + 1.2], '#B01E3C'));
  v.tagBits.forEach((bit, i) => { if (bit) out.push(b([2.6 + i * 1.5, 52.5, tz - 0.4], [3.6 + i * 1.5, 60, tz + 1.2], C.ink)); });

  const head = [];   // everything that moves with the head
  const eyes = (cy, ew, eh, gap = H.eyeX, z = fz - 1.1) => {
    for (const sx of [-1, 1]) head.push(b([sx * gap - ew, cy - eh, z], [sx * gap + ew, cy + eh, z + 0.8], glint));
  };

  if (v.mask === 'bag') {
    // paper bag over the whole head, crumpled top, sharpie eyes
    const holes = {
      neutral: [3.4, 2.4], smug: [3.8, 1.2], shocked: [3.4, 3.6], defeated: [3.0, 1.6], slump: [3.0, 1.2], celebrate: [3.4, 2.6],
    }[expr];
    // body sits back; the front plate is cut around the eye holes (a big coplanar face would
    // out-sort a hole box in the painter's algorithm), with the void showing through.
    const [hw, hh] = holes, eL = -5.5 - hw, eR = 5.5 + hw, yl = H.eyeY - hh, yh = H.eyeY + hh, pz0 = -w - 1, pz1 = -w + 1.5;
    head.push(b([-w - 1, H.headBot - 2, pz1], [w + 1, H.headTop + 3, w + 1], TAN));
    head.push(b([w - 2, H.headBot - 2, -w + 1], [w + 1, H.headTop + 3, w + 1], TAN_SH));
    head.push(b([-w - 1, H.headBot - 2, pz0], [w + 1, yl, pz1], TAN));
    head.push(b([-w - 1, yh, pz0], [w + 1, H.headTop + 3, pz1], TAN));
    head.push(b([-w - 1, yl, pz0], [eL, yh, pz1], TAN));
    head.push(b([-5.5 + hw, yl, pz0], [5.5 - hw, yh, pz1], TAN));
    head.push(b([eR, yl, pz0], [w + 1, yh, pz1], TAN_SH));
    for (const sx of [-1, 1]) head.push(b([sx * 5.5 - hw, yl, pz1 - 1.4], [sx * 5.5 + hw, yh, pz1 - 1.1], VOID));
    head.push(b([-w + 1, H.headTop + 3, -w + 1], [w - 1, H.headTop + 5.5, w - 1], TAN));
    head.push(b([-w + 4, H.headTop + 5, -w + 4], [w - 4, H.headTop + 7, w - 4], TAN_SH));
    head.push(b([-3, H.headTop + 6, -3], [4, H.headTop + 8.5, 3], TAN_DK));
    for (const x of [-10.5, -0.5, 9.5]) {                                                                                  // creases, broken around the eye holes
      head.push(b([x, H.eyeY + 4, -w - 1.6], [x + 0.9, H.headTop + 3, -w - 0.9], TAN_SH));
      if (x !== -0.5) head.push(b([x, H.headBot, -w - 1.6], [x + 0.9, H.eyeY - 4, -w - 0.9], TAN_SH));
    }
    head.push(b([-w - 1, H.headBot - 2, -w - 1.8], [w + 1, H.headBot + 1, -w - 1], TAN_DK));                               // crumpled hem
    eyes(H.eyeY - 0.1, Math.min(1.8, hw - 1.2), Math.max(0.7, hh - 1.1), 5.5, pz1 - 1.9);
    mouth(head, expr, fz - 1.4, C.ink);
  } else {
    // hood: rim stands proud of the face plane so the opening is a dark tunnel
    head.push(b([-w - 3, H.headBot - 2, -w + 3], [w + 3, H.headTop + 4, w + 4], acc));                       // shell
    head.push(...pair([w - 2.5, H.headBot, -w - 3], [w + 3, H.headTop + 3, w + 3], acc));                    // side rims
    head.push(b([-w - 3, H.headTop - 4, -w - 3.4], [w + 3, H.headTop + 4.5, w + 1], accLt));                 // brow lip
    head.push(b([-w + 2, H.headBot - 2, -w - 2.6], [w - 2, H.headBot + 1.6, -w + 2], accSh));                // chin lip
    head.push(b([w - 3, H.headBot, -w - 3], [w + 3, H.headTop + 3, w + 3], accSh));
    head.push(b([-w + 2, H.headBot + 1, -w + 1.5], [w - 2, H.headTop - 3, -w + 2.5], VOID));                 // the void
    if (v.mask === 'hood') {
      const e = {
        neutral: [1.6, 1.6, H.eyeY], smug: [2.6, 0.7, H.eyeY - 0.5], shocked: [2.0, 3.0, H.eyeY + 0.5],
        defeated: [1.4, 1.0, H.eyeY - 1.5], slump: [1.4, 0.7, H.eyeY - 1.5], celebrate: [2.2, 2.2, H.eyeY + 0.5],
      }[expr];
      eyes(e[2], e[0], e[1]);
      if (expr === 'smug') head.push(b([-7.5, H.eyeY + 3.2, fz + 1.2], [-3.5, H.eyeY + 4.2, fz + 1.8], glint));   // one raised brow glint
    } else {
      // censor: a pixelated mosaic bar across the eye line
      const cols = ['#FFF6E4', '#9B90A8', '#C9BFD6', '#6C6178'];
      const cell = 3.4, x0 = -8.5, y0 = H.eyeY - cell, tilt = expr === 'smug' ? 0.5 : 0;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
        head.push(b([x0 + c * cell, y0 + r * cell + (c - 2) * tilt * -1, fz - 1.5], [x0 + (c + 1) * cell, y0 + (r + 1) * cell + (c - 2) * tilt * -1, fz - 0.4], cols[(r * 2 + c * 3) % 4]));
      }
      mouth(head, expr, fz + 0.4, glint);
    }
  }
  for (const bx of head) out.push({ f: [bx.f[0], bx.f[1] - dy, bx.f[2]], t: [bx.t[0], bx.t[1] - dy, bx.t[2]], m: bx.m });

  // ── expression marks (the stand-in has no face, so marks carry the acting) ──
  const mark = (x0, y0, x1, y1, col, z = -w - 1) => out.push(b([x0, y0 - dy * 0.3, z], [x1, y1 - dy * 0.3, z + 1.2], col));
  if (expr === 'shocked') {                      // "!"
    mark(15, H.headTop - 8, 17.4, H.headTop + 2, C.goldLt); mark(15, H.headTop - 12, 17.4, H.headTop - 9.4, C.goldLt);
  } else if (expr === 'smug') {                  // sparkle
    mark(15.5, H.headTop - 8, 17, H.headTop - 3, C.goldLt); mark(13.2, H.headTop - 6.2, 19.2, H.headTop - 4.8, C.goldLt);
  } else if (expr === 'defeated' || expr === 'slump') {   // sweat drops
    mark(-17, H.headTop - 14, -14.6, H.headTop - 8, C.cyanLt); mark(-16.4, H.headTop - 15.6, -15.2, H.headTop - 14, C.cyan);
    if (expr === 'slump') mark(15, H.headTop - 18, 17, H.headTop - 13, C.cyanLt);
  } else if (expr === 'celebrate') {             // confetti
    [[-20, 96, C.goldLt], [19, 99, '#E04A8A'], [-14, 106, '#E04A8A'], [14, 107, C.goldLt], [-23, 86, C.cyanLt], [23, 90, C.goldLt]]
      .forEach(([x, y, c]) => mark(x, y, x + 2.4, y + 2.4, c));
  }
  return out;
}

/** Marker-drawn (bag) or glint (censor) mouth. */
function mouth(head, expr, z, col) {
  const y = H.mouthY;
  const seg = (x0, y0, x1, y1) => head.push(b([x0, y0, z], [x1, y1, z + 0.9], col));
  if (expr === 'smug') { seg(-3.5, y, 3.5, y + 1.1); seg(3.5, y + 1.1, 5.5, y + 2.6); }
  else if (expr === 'shocked') { seg(-2, y - 2.6, 2, y + 2.2); }
  else if (expr === 'defeated' || expr === 'slump') { seg(-3, y, 3, y + 1.1); seg(-4.6, y - 1.6, -3, y); seg(3, y - 1.6, 4.6, y); }
  else if (expr === 'celebrate') { seg(-4.2, y + 1, 4.2, y + 2.2); seg(-4.2, y + 2.2, -3, y + 3.4); seg(3, y + 2.2, 4.2, y + 3.4); }
  else seg(-3, y, 3, y + 1.1);
}

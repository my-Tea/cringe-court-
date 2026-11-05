// Voxel character system v5 — realistic proportions, matching the Judge reference.
//
// Reference proportions: head ≈ 23% of total height (≈4.3 heads tall).
// That is deliberately NOT chibi. Chibi was 42% (2.4 heads); it read as a doll.
//
// Everything is axis-aligned boxes. Each character targets 150–220 boxes so the
// silhouette carries detail (trim, folds, cuffs) at a realistic body scale.
import { MAT } from './palette.mjs';

/** Anatomy, in boxes. 1 unit = 1 voxel. */
export const H = {
  total: 96,
  headTop: 96, headBot: 74, headW: 11,      // 22 wide, 22 tall
  neck: 71,
  torsoTop: 70, torsoBot: 40, torsoW: 13,   // 26 wide
  hipBot: 38,
  legBot: 0, legW: 5,
  armTop: 68, armBot: 38, armW: 4,
  eyeY: 86, eyeX: 5,
  mouthY: 79,
  footY: 0,
};

/** Palette — same family as the courtroom, darker/more saturated for characters. */
export const C = {
  outline: '#241A22',
  skin:   '#E8C4A8', skinSh: '#D2A98C', skinDk: '#B48A6C',
  hairS:  '#E4E1DA', hairSSh: '#C2BFB7', hairSDk: '#9A968E',   // judge silver
  hairBr: '#6B4226', hairBrSh: '#4E2F1A', hairBrLt: '#8B5A34',
  hairPk: '#E87DB4', hairPkSh: '#C05C90', hairPkLt: '#FFA8D0',
  hairNv: '#232A44', hairNvSh: '#151A2C', hairNvLt: '#3A4468',
  burg:   '#6E1B2A', burgSh: '#4A1020', burgLt: '#8E2A3C',
  navy:   '#232A44', navySh: '#151A2C', navyLt: '#3A4468',
  cream:  '#FFF6E4', creamSh: '#E8D6BC',
  gold:   '#D9A046', goldLt: '#F6C75B', goldDk: '#A97C2A',
  blue:   '#3F6FB5', blueSh: '#264A85', blueLt: '#6FA3E0',
  pink:   '#F08CBE', pinkSh: '#C05C90',
  purple: '#6B4CA8', purpleSh: '#452F75',
  cyan:   '#5FD3E0', cyanLt: '#A8F0F8',
  ink:    '#1A1620', white: '#FFFFFF', mouth: '#8E3B42',
};

const b = (f, t, m) => ({
  f: [Math.min(f[0], t[0]), Math.min(f[1], t[1]), Math.min(f[2], t[2])],
  t: [Math.max(f[0], t[0]), Math.max(f[1], t[1]), Math.max(f[2], t[2])],
  m,
});
const pair = (f, t, m) => [b(f, t, m), b([-t[0], f[1], f[2]], [-f[0], t[1], t[2]], m)];

/* ───────────────────────────── shared anatomy ───────────────────────────── */

/** Head cube with chamfered jaw and face features. */
function head({ skin = C.skin, hair = null, eyeStyle = 'round', mouth = 'neutral', faceHair = null, o = C.outline }) {
  const out = [];
  const w = H.headW, lo = H.headBot, hi = H.headTop;
  const d = w;                                  // depth = width (cube head)
  // skull: chamfered corners by stacking 3 slabs
  out.push(b([-w, lo + 2, -d + 1], [w, hi - 3, d - 1], skin));
  out.push(b([-w + 1, hi - 3, -d + 2], [w - 1, hi, d - 2], skin));
  out.push(b([-w + 1, lo, -d + 2], [w - 1, lo + 2, d - 2], skin));   // jaw
  // side shading (right side darker = volume)
  out.push(b([w - 3, lo + 2, -d + 1], [w, hi - 3, d - 1], skin === C.skin ? C.skinSh : skin));
  // ears
  out.push(...pair([w - 0.5, H.eyeY - 6, -2], [w + 1.5, H.eyeY + 2, 2], C.skinSh));

  // face plate (front of the head, slightly proud)
  const fz = -d - 0.6;
  if (eyeStyle === 'shades') {
    // black pixel shades
    out.push(b([-w + 1.5, H.eyeY - 3.5, fz], [w - 1.5, H.eyeY + 3, fz + 1.4], C.ink));
    out.push(b([-w + 2.5, H.eyeY - 2.5, fz - 0.6], [-2.5, H.eyeY + 2, fz + 0.4], C.ink));
    out.push(b([2.5, H.eyeY - 2.5, fz - 0.6], [w - 2.5, H.eyeY + 2, fz + 0.4], C.ink));
    out.push(b([-3.5, H.eyeY - 2, fz - 0.4], [-1.5, H.eyeY + 0.4, fz + 0.4], C.white));  // glint
    out.push(b([4.5, H.eyeY - 2, fz - 0.4], [6.5, H.eyeY + 0.4, fz + 0.4], C.white));
  } else {
    for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      // sclera
      out.push(b([ex - 2.2, H.eyeY - 1.2, fz], [ex + 2.2, H.eyeY + 2.2, fz + 0.9], C.white));
      // iris + pupil
      out.push(b([ex - 1.6, H.eyeY - 0.6, fz - 0.3], [ex + 1.6, H.eyeY + 1.8, fz + 0.6], '#5A4234'));
      out.push(b([ex - 0.9, H.eyeY - 0.2, fz - 0.5], [ex + 0.9, H.eyeY + 1.4, fz + 0.4], '#241A22'));
      // highlight
      out.push(b([ex - 1.5, H.eyeY - 0.3, fz - 0.6], [ex - 0.4, H.eyeY + 0.7, fz + 0.2], C.white));
      // upper lid line (this is what gives the eye its shape)
      out.push(b([ex - 2.4, H.eyeY + 2.2, fz - 0.4], [ex + 2.4, H.eyeY + 3.0, fz + 0.6], '#241A22'));
    }
    // brows
    const bc = hair || C.hairBr;
    out.push(...pair([-H.eyeX - 2.6, H.eyeY + 3.6, fz], [-0.8, H.eyeY + 4.6, fz + 0.7], bc));
  }
  // nose
  out.push(b([-0.8, H.mouthY + 3, fz - 0.8], [0.8, H.mouthY + 6, fz + 0.4], C.skinDk));
  // mouth
  if (mouth === 'shout') {
    out.push(b([-2.6, H.mouthY - 2, fz], [2.6, H.mouthY + 2.4, fz + 1], C.mouth));
    out.push(b([-1.6, H.mouthY + 0.4, fz - 0.2], [1.6, H.mouthY + 1.8, fz + 0.7], '#D2686E'));
  } else if (mouth === 'grin') {
    out.push(b([-3.2, H.mouthY - 1, fz], [3.2, H.mouthY + 2, fz + 1], C.mouth));
    out.push(b([-2.4, H.mouthY - 0.6, fz - 0.2], [2.4, H.mouthY + 0.8, fz + 0.7], C.white));
  } else if (mouth === 'frown') {
    out.push(b([-2, H.mouthY + 1, fz], [2, H.mouthY + 2, fz + 1], C.mouth));
  } else {
    out.push(b([-1.8, H.mouthY, fz], [1.8, H.mouthY + 1.2, fz + 1], C.mouth));
  }
  if (faceHair) out.push(...faceHair);
  return tag('head', out);
}

/** Torso with garment. `trim` adds gold/contrast detail. */
function torso({ col, colSh, style = 'robe', w = H.torsoW, lo = H.torsoBot, hi = H.torsoTop, o = C.outline }) {
  const out = [];
  const d = Math.round(w * 0.62);
  out.push(b([-w, lo, -d], [w, hi, d], col));                    // main mass
  out.push(b([-w + 1, hi - 1, -d - 0.6], [w - 1, hi + 1, d + 0.6], colSh)); // shoulder cap
  // right-side shading
  out.push(b([w - 4, lo, -d], [w, hi, d], colSh));
  // side depth shading
  out.push(...pair([w, lo, -d], [w + 0.6, hi, d], o));

  if (style === 'robe') {
    // vertical gold placket + hem
    out.push(b([-1.6, lo, -d - 1], [1.6, hi, -d - 0.2], C.gold));
    out.push(b([-1.6, lo, -d - 1.2], [1.6, lo + 2, -d - 0.1], C.goldLt));
    // cross bands
    for (let i = 0; i < 3; i++) {
      const y = lo + 1800 / 100 + i * 9;
      out.push(b([-7, lo + 6 + i * 9, -d - 1], [7, lo + 7.4 + i * 9, -d - 0.2], C.gold));
    }
    out.push(b([-w + 1, lo + 2, -d - 0.8], [w - 1, lo + 3.4, -d + 0.2], C.goldDk)); // hem line
  } else if (style === 'suit') {
    // lapels + shirt V + tie
    out.push(b([-4.5, hi - 12, -d - 1], [4.5, hi, -d - 0.2], C.cream));
    out.push(b([-1.4, hi - 11, -d - 1.2], [1.4, hi - 2, -d - 0.3], '#8E2438'));
    out.push(...pair([-w + 1, hi - 3, -d - 1], [-w + 4.5, hi, -d - 0.2], col));
    out.push(...pair([w - 4.5, hi - 3, -d - 1], [w - 1, hi, -d - 0.2], col));
  } else if (style === 'uniform') {
    out.push(b([-w + 1, hi - 4, -d - 1], [w - 1, hi - 2.6, -d - 0.2], C.gold)); // collar braid
    for (let i = 0; i < 4; i++) out.push(b([-1, lo + 6 + i * 7, -d - 1], [1, lo + 7.4 + i * 7, -d - 0.2], C.goldLt));
    out.push(b([-w, lo + 1, -d - 1], [w, lo + 3, -d - 0.2], C.ink));            // belt
    out.push(b([-2.4, lo + 0.6, -d - 1.2], [2.4, lo + 3.4, -d - 0.1], C.gold)); // buckle
  } else if (style === 'hoodie') {
    out.push(b([-w + 1, hi - 1, -d - 1], [w - 1, hi + 2, -d + 1], colSh));     // hood
    out.push(b([-4, lo + 4, -d - 1], [4, lo + 9, -d - 0.2], colSh));            // pocket
    out.push(b([-2.4, hi - 8, -d - 1.1], [-1.6, hi - 2, -d - 0.3], C.cream));   // strings
    out.push(b([1.6, hi - 8, -d - 1.1], [2.4, hi - 2, -d - 0.3], C.cream));
  } else if (style === 'blouse') {
    out.push(b([-w + 2, lo, -d - 1], [w - 2, hi - 6, -d - 0.2], colSh));       // waistcoat
    for (let i = 0; i < 4; i++) out.push(b([-0.8, hi - 14 + i * 6, -d - 1.2], [0.8, hi - 13 + i * 6, -d - 0.1], C.gold));
  }
  return out;
}

/** Arms. `lift` in units; positive = raised. */
function arms({ col, colSh, cuff = null, hand = C.skin, lift = 0, o = C.outline }) {
  const out = [];
  const aw = H.armW;
  for (const sx of [-1, 1]) {
    const x0 = sx * (H.torsoW + aw), x1 = sx * (H.torsoW + aw * 2);
    const drop = lift * 1.4;
    const yTop = H.armTop + drop, yBot = H.armBot + drop;
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    out.push(b([lo, yBot, -aw], [hi, yTop, aw], col));
    out.push(b([sx > 0 ? hi - 1 : lo, yBot, -aw], [sx > 0 ? hi : lo + 1, yTop, aw], colSh));
    out.push(b([sx > 0 ? hi : lo - 0.6, yBot, -aw], [sx > 0 ? hi + 0.6 : lo, yTop, aw], o));
    if (cuff) out.push(b([lo, yBot, -aw - 0.4], [hi, yBot + 3, aw + 0.4], cuff));
    // hand
    out.push(b([lo + 0.5, yBot - 5, -aw + 0.5], [hi - 0.5, yBot, aw - 0.5], hand));
    tag(sx > 0 ? 'armR' : 'armL', out.filter((bx) => !bx.g));
  }
  return out;
}

function legs({ col, shoe = C.ink, w = H.legW, o = C.outline }) {
  const out = [];
  for (const sx of [-1, 1]) {
    const x = sx * 6.5;
    out.push(b([x - w, 2, -4], [x + w, H.hipBot, 4], col));
    out.push(b([sx > 0 ? x + w - 1.5 : x - w, 2, -4], [sx > 0 ? x + w : x - w + 1.5, H.hipBot, 4], shadeHex(col, 0.82)));
    out.push(b([sx > 0 ? x + w : x - w - 0.5, 2, -4], [sx > 0 ? x + w + 0.5 : x - w, H.hipBot, 4], o));
    out.push(b([x - w - 1, 0, -5.5], [x + w + 1, 2, 5], shoe));
  }
  return out;
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const bl = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/* ───────────────────────────────── posing ───────────────────────────────── */

/** Mark boxes as belonging to a rig group: 'head' | 'armL' | 'armR'.
 *  Untagged boxes are 'body'. Held props are tagged with the arm holding them. */
function tag(g, boxes) {
  for (const bx of boxes) bx.g = g;
  return boxes;
}

/** Pose table, degrees. Arms: `out` swings away from the body, `fwd` swings
 *  toward the camera. Head: `nod` (+ = chin down), `tilt` (sideways).
 *  Body (whole character, pivot at the feet): `lean` (+ = toward camera),
 *  `sway` (sideways), `dy` (units up). armR is the +x arm (the gavel hand). */
export const POSES = {
  idle:      {},
  talking:   { armR: { fwd: 50, out: 15 }, head: { tilt: 5 }, lean: 2, sway: -3 },
  happy:     { armR: { out: 150 }, armL: { out: 150 }, head: { nod: -8 }, dy: 3 },
  angry:     { armR: { out: 22, fwd: 12 }, armL: { out: 22, fwd: 12 }, head: { nod: 8 }, lean: 8 },
  shocked:   { armR: { out: 65 }, armL: { out: 65 }, head: { nod: -10 }, lean: -6, dy: 2 },
  laughing:  { armR: { fwd: 28, out: -10 }, armL: { fwd: 28, out: -10 }, head: { nod: -16 }, lean: -10 },
  crying:    { armR: { fwd: 140, out: -25 }, head: { nod: 14 }, lean: 4, sway: 3 },
  confused:  { armR: { out: 140, fwd: 20 }, head: { tilt: -12 }, sway: 8 },
  objection: { armR: { fwd: 60, out: 55 }, armL: { out: 10, fwd: -10 }, head: { nod: -4 }, lean: 6, sway: -5 },
  defeated:  { armR: { out: 3, fwd: -4 }, armL: { out: 3, fwd: -4 }, head: { nod: 18 }, lean: 10, dy: -2 },
};
export const POSE_IDS = Object.keys(POSES);

/** Idle variants: small, readable deltas from the base idle, one table per
 *  character (see IDLE in vox-chars.mjs). They live outside POSES on purpose:
 *  POSE_IDS stays the 10 core poses, and IDLE_IDS lists the extras. */
export const IDLE_IDS = ['idle_a', 'idle_b', 'idle_c'];

const D2R = Math.PI / 180;
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const rotX = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; };
const rotY = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; };
const rotZ = (a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
const move = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];

/** A∘B for 3x4 affine matrices (apply B first). */
function mul(A, B) {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c];
    o[r * 4 + 3] = A[r * 4] * B[3] + A[r * 4 + 1] * B[7] + A[r * 4 + 2] * B[11] + A[r * 4 + 3];
  }
  return o;
}
const about = (p, R) => mul(move(p[0], p[1], p[2]), mul(R, move(-p[0], -p[1], -p[2])));
const isIdent = (M) => M.every((v, i) => Math.abs(v - IDENT[i]) < 1e-9);

/** Apply a pose to tagged boxes. Zero-angle groups are left untouched, so
 *  `idle` renders exactly like the unposed model. `over` patches the table
 *  per character (e.g. the Judge raises the gavel instead of pointing). */
export function posed(boxes, pose = 'idle', over = {}) {
  const P = { ...(POSES[pose] || POSES.idle), ...(over[pose] || {}) };  // idle_a/b/c come in via `over`
  // pitch is negated: +X rotation tips the top of a part away from the camera
  const body = mul(move(0, P.dy || 0, 0), mul(rotZ(-(P.sway || 0)), rotX(-(P.lean || 0))));
  const neck = [0, H.neck, 0];
  const hd = P.head || {};
  const group = {
    body,
    head: mul(body, about(neck, mul(rotZ(-(hd.tilt || 0)), rotX(-(hd.nod || 0))))),
  };
  for (const [g, sx] of [['armR', 1], ['armL', -1]]) {
    const a = P[g] || {};
    const shoulder = [sx * (H.torsoW + H.armW * 1.5), H.armTop - 2, 0];
    group[g] = mul(body, about(shoulder, mul(rotZ(sx * (a.out || 0)), mul(rotY(sx * (a.across || 0)), rotX(a.fwd || 0)))));
  }
  return boxes.map((bx) => {
    const M = group[bx.g || 'body'];
    return isIdent(M) ? bx : { ...bx, M };
  });
}

export { b, pair, head, torso, arms, legs, shadeHex, tag };

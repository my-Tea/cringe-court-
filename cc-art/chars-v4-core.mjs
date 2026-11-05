// Characters v4 — parameterised by pose and expression.
//
// v3 hardcoded one face and one body. v4 threads `opts` through every builder so
// eyes/mouth/brows AND arm/shoulder/lean all change. That is what makes 70 pose
// files real drawings instead of 70 copies of the same image.
import { Pen, mix, shade } from './pen3.mjs';
import { R, T, A, head, eye, brow, nose, mouth, blush } from './artkit.mjs';

const O = '#241A22';
const W = 256, H = 320;

/* ───────────────────────── expression + pose tables ───────────────────────── */
export const EXPRESSIONS = {
  neutral:  { eyes: 'round',   mouth: 'neutral', browTilt: 0,  blush: 0.45, tears: false, sweat: false },
  happy:    { eyes: 'round',   mouth: 'smile',   browTilt: -2, blush: 0.85, tears: false, sweat: false },
  angry:    { eyes: 'sharp',   mouth: 'grit',    browTilt: 4,  blush: 0.35, tears: false, sweat: false, ie: 'veins' },
  shocked:  { eyes: 'sparkle', mouth: 'shout',   browTilt: -5, blush: 0.20, tears: false, sweat: true, ie: 'lines' },
  laughing: { eyes: 'sleepy',  mouth: 'grin',    browTilt: -3, blush: 0.80, tears: false, sweat: false, ie: 'arcs' },
  crying:   { eyes: 'sleepy',  mouth: 'frown',   browTilt: -3, blush: 0.55, tears: true,  sweat: false },
  confused: { eyes: 'round',   mouth: 'frown',   browTilt: 1,  blush: 0.40, tears: false, sweat: true, ie: 'q' },
  smug:     { eyes: 'sharp',   mouth: 'smirk',   browTilt: -1, blush: 0.50, tears: false, sweat: false },
};

export const POSES = {
  idle:      { dy: 0,   lean: 0,   armL: 0,   armR: 0,   headTilt: 0,   scale: 1 },
  talking:   { dy: -2,  lean: 0,   armL: -6,  armR: -6,  headTilt: -1,  scale: 1 },
  happy:     { dy: -7,  lean: 0,   armL: -16, armR: -16, headTilt: -2,  scale: 1.02 },
  angry:     { dy: -2,  lean: -2,  armL: 8,   armR: 8,   headTilt: -3,  scale: 1.02 },
  shocked:   { dy: -9,  lean: 0,   armL: -20, armR: -20, headTilt: -4,  scale: 1.04 },
  laughing:  { dy: -5,  lean: 3,   armL: -10, armR: -10, headTilt: 3,   scale: 1.02 },
  crying:    { dy: 4,   lean: 0,   armL: 10,  armR: 10,  headTilt: 5,   scale: 0.99 },
  confused:  { dy: 0,   lean: 5,   armL: -4,  armR: 2,   headTilt: 6,   scale: 1 },
  objection: { dy: -8,  lean: -3,  armL: -10, armR: -28, headTilt: -4,  scale: 1.05 },
  defeated:  { dy: 14,  lean: 0,   armL: 14,  armR: 14,  headTilt: 8,   scale: 0.93 },
};

export const EXPR_KEYS = Object.keys(EXPRESSIONS);
export const POSE_KEYS = Object.keys(POSES);

/* ───────────────────────────── shared builders ───────────────────────────── */

/** Torso + arms + legs, with pose-driven arm angles. */
function body(p, {
  tone, sleeve = null, cuff = null, legs = null, shoes = null,
  wide = 0, hem = 286, pose = POSES.idle,
}) {
  const sh = A.shDx + wide;
  const S = sleeve || tone, L = legs || tone;
  // legs
  for (const sx of [-1, 1]) {
    const x = A.cx + sx * 18;
    p.roundRect(x - 12, A.hipY - 6 + pose.dy * 0.25, 24, 58, 9, [L[1], L[2], L[2], L[3], L[3]]);
    p.roundRect(x - 15, A.hipY + 44 + pose.dy * 0.25, 30, 16, 7, shoes || R.ink);
  }
  // arms — angle driven by the pose; lifted arms swing up and out
  for (const sx of [-1, 1]) {
    const lift = sx < 0 ? pose.armL : pose.armR;
    const ax = A.cx + sx * (sh + 13) + lift * 0.5 * sx;
    const ay = A.shY + 28 + lift * 0.85;
    p.ellipse(ax, ay, 13, 32, [S[1], S[2], S[3], S[3], S[4]], { rot: sx * 0.07 + lift * 0.012 });
    if (cuff) p.ellipse(ax + lift * 0.25 * sx, ay + 28 + lift * 0.2, 11, 8, [cuff[1], cuff[2], cuff[3], cuff[3], cuff[4]]);
    p.ellipse(ax + lift * 0.3 * sx, ay + 36 + lift * 0.3, 10, 10,
      [R.skin[1], R.skin[2], R.skin[3], R.skin[4], R.skin[4]]);
  }
  // torso
  p.poly([
    [A.cx - sh + pose.lean, A.shY - 8 + pose.dy], [A.cx + sh + pose.lean, A.shY - 8 + pose.dy],
    [A.cx + sh + 8, hem + pose.dy], [A.cx - sh - 8, hem + pose.dy],
  ], [tone[1], tone[2], tone[3], tone[3], tone[4]], { y0: A.shY - 8 + pose.dy, y1: hem + pose.dy });
  // neck
  p.roundRect(A.cx - 9 + pose.lean, A.neckY - 12 + pose.dy, 18, 24, 6,
    [R.skin[1], R.skin[2], R.skin[2], R.skin[3], R.skin[3]]);
  return p;
}

/** Full face for an expression. Call AFTER the body, BEFORE front hair. */
function face(p, expr = 'neutral', { tone = R.hairBrown, pose = POSES.idle, skinTone = null } = {}) {
  const e = EXPRESSIONS[expr] || EXPRESSIONS.neutral;
  const dy = pose.dy, dx = pose.lean;
  const tilt = pose.headTilt || 0;
  const ox = dx + tilt * 0.6;

  // head
  p.ellipse(A.cx + ox, A.headCy + dy, A.headRx, A.headRy,
    [R.skin[2], R.skin[3], R.skin[3], R.skin[4], R.skin[4]], { light: [-0.5, -0.85], bands: [0.02, 0.46] });
  p.ellipse(A.cx + ox - 27, A.headCy + dy + 2, 14, 10, [R.skin[4], R.skin[4], R.skin[4], R.skin[4], R.skin[4]]);

  // eyes
  const eyeStyle = e.eyes;
  for (const sx of [-1, 1]) eye(p, sx, eyeStyle, tone, { dx: ox, dy });
  for (const sx of [-1, 1]) brow(p, sx, { tilt: e.browTilt, tone, dx: ox, dy });
  nose(p, { dx: ox, dy });
  mouth(p, e.mouth, { dx: ox, dy });
  blush(p, e.blush, { dx: ox, dy });

  // expression extras
  if (e.tears) {
    for (let i = 0; i < 4; i++) {
      p.ellipse(A.cx + ox - 22, A.eyeY + dy + 18 + i * 9, 4, 5, ['#8ED8F0', '#8ED8F0', '#A8E4F4', '#A8E4F4', '#C8F0FA']);
      p.ellipse(A.cx + ox + 22, A.eyeY + dy + 18 + i * 9, 4, 5, ['#8ED8F0', '#8ED8F0', '#A8E4F4', '#A8E4F4', '#C8F0FA']);
    }
  }
  if (e.sweat) p.ellipse(A.cx + ox + 44, A.headCy + dy - 14, 7, 10, ['#8ED8F0', '#8ED8F0', '#A8E4F4', '#A8E4F4', '#C8F0FA']);
  if (e.ie === 'veins') {
    p.stroke(A.cx + ox + 34, A.headCy + dy - 26, A.cx + ox + 42, A.headCy + dy - 34, '#C0392B', 3);
    p.stroke(A.cx + ox + 42, A.headCy + dy - 26, A.cx + ox + 34, A.headCy + dy - 34, '#C0392B', 3);
  }
  if (e.ie === 'lines') {
    for (let i = 0; i < 3; i++) p.stroke(A.cx + ox - 52, A.headCy + dy - 30 + i * 7, A.cx + ox - 42, A.headCy + dy - 34 + i * 7, T.ink, 2);
  }
  if (e.ie === 'arcs') {
    p.curve(A.cx + ox - 34, A.eyeY + dy + 2, A.cx + ox - 22, A.eyeY + dy - 8, A.cx + ox - 10, A.eyeY + dy + 2, T.ink, 3);
    p.curve(A.cx + ox + 10, A.eyeY + dy + 2, A.cx + ox + 22, A.eyeY + dy - 8, A.cx + ox + 34, A.eyeY + dy + 2, T.ink, 3);
  }
  return p;
}

/** Hair helper: back mass + crown + locks, all pose-aware. */
function hair(p, { tone, locks = [], crown = true, crownY = 74, crownRx = 58, crownRy = 34, pose = POSES.idle, back = null }) {
  const dy = pose.dy, ox = pose.lean + (pose.headTilt || 0) * 0.6;
  if (back) p.ellipse(A.cx + ox, A.headCy + dy - 4, back.rx, back.ry, [tone[0], tone[1], tone[2], tone[3], tone[3]]);
  if (crown) p.ellipse(A.cx + ox, crownY + dy, crownRx, crownRy,
    [tone[1], tone[2], tone[3], tone[4], tone[4]], { light: [-0.5, -0.87] });
  for (const L of locks) {
    const [x0, y0, cx, cy, x1, y1, w] = L;
    p.lock(x0 + ox, y0 + dy, cx + ox, cy + dy, x1 + ox, y1 + dy, w, tone[2], { hi: tone[4] });
  }
  return p;
}

export { body, face, hair };

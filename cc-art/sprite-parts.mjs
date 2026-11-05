// Character sprites — 2D hand-drawn look, built from vector shapes.
// Canvas 256×320. Sits on a shared anchor grid so every character lines up.
import { Sprite } from './sprite2d.mjs';

const O = '#241A22';            // outline
const INK = '#2A2028';
const W = 256, H = 320;

/* ── palette ─────────────────────────────────────────────────────────── */
export const P = {
  skin: '#F5D2B4', skinSh: '#E0B190', skinDp: '#C08D6E', blush: '#F49AA2',
  white: '#FFFDF8', iris: '#4A342C', irisL: '#8A6650', pupil: '#241A22',
  mouth: '#8E3B42', tongue: '#D2686E', teeth: '#FFFDF8',
  gold: '#D9A046', goldL: '#F6C75B', goldP: '#FFF2C7', goldD: '#A97C2A',
  silver: '#DCD9D3', silverSh: '#B4B0A8', silverDk: '#8E8A83',
  cream: '#FFF6E4', creamSh: '#E8D6BC',
  burg: '#6E1B2A', burgL: '#A32D3F', burgD: '#48101C',
  navy: '#232A44', navyL: '#3A4468', navyD: '#151A2C',
  pink: '#F08CBE', pinkL: '#FFB8DC', pinkD: '#C05C90',
  brown: '#6B4226', brownL: '#8E5A34', brownD: '#412716',
  blue: '#3F6FB5', blueL: '#6FA3E0', blueD: '#264A85',
  purple: '#6B4CA8', purpleL: '#9B7BD6', purpleD: '#452F75',
  cyan: '#5FD3E0', cyanL: '#A8F0F8',
  black: '#1A1620',
};

/* ── shared parts ────────────────────────────────────────────────────── */
const A = {
  headCx: 128, headCy: 118, headRx: 52, headRy: 54,
  eyeY: 124, eyeDx: 24,
  mouthY: 158,
  neckY: 172,
  shY: 196, shDx: 46,
  hipY: 250,
};

/** Body torso + limbs. `style` picks the garment silhouette. */
function body(s, { col, colSh, style = 'suit', sleeve = null, cuff = null, legs = null, shoes = null }) {
  const sh = A.shDx, sy = A.shY;
  const lc = legs || colSh, sc = shoes || INK;
  // legs
  for (const sx of [-1, 1]) {
    const x = 128 + sx * 18;
    s.roundRect(x - 12, A.hipY - 4, 24, 58, 10, lc);
    // shoe
    s.roundRect(x - 15, A.hipY + 44, 30, 18, 8, sc);
  }
  // torso
  s.roundRect(128 - sh, sy - 8, sh * 2, A.hipY - sy + 24, 24, col);
  // arms
  for (const sx of [-1, 1]) {
    const ax = 128 + sx * (sh + 6);
    s.ellipse(ax, sy + 26, 15, 32, sleeve || col, { rot: sx * 0.10 });
    if (cuff) s.ellipse(ax + sx * 2, sy + 52, 12, 9, cuff);
    s.ellipse(ax + sx * 3, sy + 62, 11, 11, P.skin);
  }
  // neck
  s.roundRect(118, A.neckY - 14, 20, 22, 8, P.skinSh);
  return s;
}

/** Detailed anime eye. Facing +x for the right eye, mirrored by `sx`. */
function eye(s, sx, { style = 'round', iris = P.iris, irisL2 = P.irisL, lash = INK, col = null } = {}) {
  const cx = 128 + sx * A.eyeDx, cy = A.eyeY;
  const is = col || iris;
  if (style === 'sharp') {
    s.ellipse(cx, cy + 1, 13, 13, P.white);
    s.ellipse(cx + sx * 1, cy + 2, 8, 10, is);
    s.ellipse(cx + sx * 1, cy + 3, 4.5, 6, P.pupil);
    s.ellipse(cx - sx * 2, cy - 2, 3, 3.4, P.white);
    s.line(cx - 15 * sx, cy - 9, cx + 13 * sx, cy - 12, lash, 3.4);
  } else if (style === 'sleepy') {
    s.ellipse(cx, cy + 3, 13, 8, P.white);
    s.ellipse(cx, cy + 3, 8, 6, is);
    s.ellipse(cx, cy + 4, 4, 4, P.pupil);
    s.line(cx - 14 * sx, cy - 2, cx + 14 * sx, cy - 2, lash, 4);
  } else if (style === 'sparkle') {
    s.ellipse(cx, cy, 14, 14, P.white);
    s.ellipse(cx, cy + 1, 10, 11, is);
    s.ellipse(cx, cy + 2, 5, 6, P.pupil);
    s.ellipse(cx - sx * 3, cy - 4, 4, 4, P.white);
    s.ellipse(cx + sx * 4, cy + 5, 2.4, 2.4, P.white);
    s.line(cx - 15 * sx, cy - 10, cx + 14 * sx, cy - 13, lash, 4);
  } else {
    // round — the default anime eye
    s.ellipse(cx, cy, 14, 15, P.white);
    s.ellipse(cx + sx * 1, cy + 1, 10, 12, is);
    s.ellipse(cx + sx * 1, cy + 2, 5, 7, P.pupil);
    s.ellipse(cx - sx * 3, cy - 4, 4, 4.4, P.white);
    s.ellipse(cx + sx * 4, cy + 5, 2.2, 2.2, P.white);
    // upper lash — MUST be level. It sits at the top of the eye and a slope here
    // reads as a furrowed angry brow. Verified by rendering the eye layer alone:
    // a 1px rise across 31px is enough to look angry.
    s.line(cx - 16 * sx, cy - 11, cx + 15 * sx, cy - 11, lash, 3.6);
    // lower lid accent
    s.line(cx - 10 * sx, cy + 13, cx + 8 * sx, cy + 14, lash, 1.6);
  }
  return s;
}

function brow(s, sx, tilt = 0, col = P.brownD) {
  // NEUTRAL = both ends level, arch in the middle.
  // Angry is when the INNER end sits LOWER than the outer. I had that backwards
  // three times: for sx=-1 the inner end is cx-12*sx (=116, near the nose), and
  // it must sit at the SAME height as the outer end, not below it.
  const cx = 128 + sx * A.eyeDx, cy = A.eyeY - 26;
  const innerX = cx - 12 * sx, outerX = cx + 12 * sx;
  s.curve(innerX, cy + tilt, cx, cy - 3, outerX, cy - tilt, col, 2.8);
  return s;
}

function mouth(s, kind = 'neutral') {
  const cy = A.mouthY;
  if (kind === 'smile') {
    s.curve(116, cy, 128, cy + 8, 140, cy, P.mouth, 3.4);
  } else if (kind === 'grin') {
    s.poly([[114, cy - 2], [142, cy - 2], [138, cy + 12], [118, cy + 12]], P.mouth);
    s.poly([[118, cy + 1], [138, cy + 1], [135, cy + 5], [121, cy + 5]], P.teeth);
  } else if (kind === 'shout') {
    s.ellipse(128, cy + 5, 14, 13, P.mouth);
    s.ellipse(128, cy + 12, 9, 5, P.tongue);
  } else if (kind === 'frown') {
    s.curve(116, cy + 4, 128, cy - 5, 140, cy + 4, P.mouth, 3.4);
  } else if (kind === 'smirk') {
    s.curve(117, cy + 2, 129, cy + 6, 141, cy - 2, P.mouth, 3.4);
  } else {
    s.line(121, cy, 135, cy, P.mouth, 3.2);
  }
  return s;
}

function nose(s) {
  s.line(130, A.mouthY - 14, 133, A.mouthY - 9, P.skinDp, 2.4);
  return s;
}

function face(s, { skin = P.skin, blush = true } = {}) {
  s.ellipse(A.headCx, A.headCy, A.headRx, A.headRy, skin);
  // jaw shadow
  s.ellipse(A.headCx, A.headCy + 34, A.headRx - 6, 20, skin === P.skin ? P.skinSh : skin, {});
  if (blush) {
    s.ellipse(A.headCx - 38, A.headCy + 18, 10, 6, P.blush);
    s.ellipse(A.headCx + 38, A.headCy + 18, 10, 6, P.blush);
  }
  return s;
}

export { body, eye, brow, mouth, nose, face, O, INK, W, H, A };

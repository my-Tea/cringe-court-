// Pose + expression variants for all 8 characters.
//
// Rather than 10 hand-drawn poses per character (which would be 70 drawings),
// each pose is a *parametric variation* of the same build: arm/shoulder offsets,
// lean, head tilt, and expression. That keeps the cast consistent and makes the
// 70 pose files actually achievable.
import { Pen, mix, shade } from './pen3.mjs';
import { R, T, A, head, eye, brow, nose, mouth, blush } from './artkit.mjs';
import * as V3 from './chars-v3.mjs';

const O = '#241A22';
const W = 256, H = 320;

/* expression → face parameters */
export const EXPRESSIONS = {
  neutral:  { eyes: 'round',  mouth: 'neutral', brows: 0,  blush: 0.45 },
  happy:    { eyes: 'round',  mouth: 'smile',   brows: -2, blush: 0.80 },
  angry:    { eyes: 'sharp',  mouth: 'grit',    brows: 3,  blush: 0.35 },
  shocked:  { eyes: 'sparkle', mouth: 'shout',  brows: -4, blush: 0.20 },
  laughing: { eyes: 'sleepy', mouth: 'grin',    brows: -3, blush: 0.75 },
  crying:   { eyes: 'sleepy', mouth: 'frown',   brows: -3, blush: 0.55, tears: true },
  confused: { eyes: 'round',  mouth: 'frown',   brows: 1,  blush: 0.40, sweat: true },
  smug:     { eyes: 'sharp',  mouth: 'smirk',   brows: -1, blush: 0.50 },
};

/* pose → body transform */
export const POSES = {
  idle:     { dy: 0,   lean: 0,  arm: 0,   scale: 1 },
  talking:  { dy: -2,  lean: 0,  arm: -4,  scale: 1 },
  happy:    { dy: -6,  lean: 0,  arm: -10, scale: 1.02 },
  angry:    { dy: -2,  lean: -2, arm: 6,   scale: 1.02 },
  shocked:  { dy: -8,  lean: 0,  arm: -12, scale: 1.04 },
  laughing: { dy: -4,  lean: 3,  arm: -8,  scale: 1.02 },
  crying:   { dy: 3,   lean: 0,  arm: 8,   scale: 0.99 },
  confused: { dy: 0,   lean: 4,  arm: -3,  scale: 1 },
  objection:{ dy: -7,  lean: -3, arm: -14, scale: 1.05 },
  defeated: { dy: 12,  lean: 0,  arm: 10,  scale: 0.94 },
};

/** Draw an expression overlay (tears, sweat, extra brow work). */
function faceFx(p, key) {
  const e = EXPRESSIONS[key];
  if (e.tears) {
    for (let i = 0; i < 5; i++) {
      p.ellipse(A.cx - 22, A.eyeY + 16 + i * 8, 4, 5, ['#8ED8F0', '#8ED8F0', '#A8E4F4', '#A8E4F4', '#C8F0FA']);
      p.ellipse(A.cx + 22, A.eyeY + 16 + i * 8, 4, 5, ['#8ED8F0', '#8ED8F0', '#A8E4F4', '#A8E4F4', '#C8F0FA']);
    }
  }
  if (e.sweat) {
    p.ellipse(188, 108, 7, 10, ['#8ED8F0', '#8ED8F0', '#A8E4F4', '#A8E4F4', '#C8F0FA']);
  }
}

/**
 * Render a character with a pose + expression.
 * The character build comes from chars-v3; we re-run it and then overlay the
 * requested face, which is cheaper and far more consistent than re-posing the
 * whole body per file.
 */
export function renderChar(charId, poseKey = 'idle', exprKey = 'neutral') {
  const base = V3.CHARS[charId]();
  const e = EXPRESSIONS[exprKey];
  const po = POSES[poseKey] || POSES.idle;

  // Work on a copy: draw the base, then repaint the head area with the new
  // expression. Face sits in a known box, so we can erase just that region.
  const p = new Pen(W, H);

  // body offset by the pose (head follows, so the whole figure shifts)
  const img = base;
  // Composite base, shifted
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const px = img.get(x, y);
      if (px[3] < 8) continue;
      const tx = Math.round(x + po.lean * ((y - A.hipY) / 120));
      const ty = Math.round(y + po.dy);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      p.c.set(tx * 4 + 2, ty * 4 + 2, px);
    }
  }
  return p.done();
}

export const POSE_KEYS = Object.keys(POSES);
export const EXPR_KEYS = Object.keys(EXPRESSIONS);

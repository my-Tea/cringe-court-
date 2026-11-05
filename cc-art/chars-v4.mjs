// Characters v4 — every builder takes { pose, expr } so all 10 poses x 8
// expressions are genuine variations, not copies.
import { Pen } from './pen3.mjs';
import { R, T, A, eye, brow, nose, mouth, blush } from './artkit.mjs';
import { body, face, hair, POSES, EXPRESSIONS } from './chars-v4-core.mjs';

const O = '#241A22';
const W = 256, H = 320;

const ctx = (o) => ({
  pose: POSES[o.pose] || POSES.idle,
  expr: o.expr || 'neutral',
  e: EXPRESSIONS[o.expr] || EXPRESSIONS.neutral,
  tone: o.tone || R.hairBrown,
});

/* ══════════════════════════════════ JUDGE ══════════════════════════════════ */
export function judge(o = {}) {
  const { pose, expr, e } = ctx(o);
  const p = new Pen(W, H);
  const S = R.hairS;
  const ox = pose.lean, dy = pose.dy;

  // mane
  p.shape(A.cx + ox, 118 + dy, (a) => {
    const side = Math.pow(Math.abs(Math.cos(a)), 0.65);
    const bot = Math.pow(Math.max(0, Math.sin(a)), 1.7);
    const top = Math.pow(Math.max(0, -Math.sin(a)), 0.9);
    return 74 * (0.76 + 0.32 * side) * (1 - 0.30 * bot) * (1 + 0.10 * top);
  }, (x) => (x > A.cx + ox + 14 ? S[1] : S[3]));
  for (let i = 0; i < 9; i++) {
    const x = 62 + i * 17 + ox;
    p.curve(x, 70 + dy, x + (i % 2 ? 8 : -8), 120 + dy, x + (i % 2 ? 4 : -4), 172 + dy, S[1], 2.4, 1.2);
  }

  body(p, { tone: R.burg, cuff: R.cream, legs: R.burgD, shoes: R.ink, hem: 288, pose });
  p.roundRect(A.cx - 3, A.shY + dy, 6, 92, 2, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.roundRect(A.cx - 26, 280 + dy, 52, 8, 3, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);

  face(p, expr, { tone: S, pose });

  // shades (always, on every expression — it's his face)
  const sx0 = A.cx + ox;
  p.roundRect(sx0 - 58, 104 + dy, 54, 34, 6, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(sx0 + 4, 104 + dy, 54, 34, 6, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(sx0 - 8, 112 + dy, 14, 10, 3, R.ink[1]);
  p.stroke(sx0 - 58, 114 + dy, sx0 - 72, 106 + dy, R.ink[1], 5);
  p.stroke(sx0 + 58, 114 + dy, sx0 + 72, 106 + dy, R.ink[1], 5);
  p.roundRect(sx0 - 48, 110 + dy, 12, 8, 2, R.white[0]);
  p.roundRect(sx0 + 18, 110 + dy, 12, 8, 2, R.white[0]);

  // moustache + beard. The beard is deliberately compact: a full beard that
  // covers the mouth makes all 8 expressions identical (which defeats the
  // point of an expression sheet).
  p.lock(sx0 - 24, 156 + dy, sx0 - 11, 147 + dy, sx0 + 2, 154 + dy, 22, R.beard[3], { hi: R.beard[4] });
  p.lock(sx0 + 24, 156 + dy, sx0 + 11, 147 + dy, sx0 - 2, 154 + dy, 22, R.beard[3], { hi: R.beard[4] });
  p.ellipse(sx0, 152 + dy, 11, 6, [R.beard[2], R.beard[3], R.beard[4], R.beard[4], R.beard[4]]);

  const beardDrop = e.mouth === 'shout' ? 8 : 0;
  p.poly([
    [sx0 - 34, 158 + dy], [sx0 + 34, 158 + dy], [sx0 + 30, 200 + dy + beardDrop],
    [sx0 + 18, 224 + dy + beardDrop], [sx0, 238 + dy + beardDrop],
    [sx0 - 18, 224 + dy + beardDrop], [sx0 - 30, 200 + dy + beardDrop],
  ], [R.beard[2], R.beard[3], R.beard[3], R.beard[4], R.beard[4]], { y0: 158 + dy, y1: 238 + dy + beardDrop });
  for (let i = 0; i < 5; i++) {
    const x = sx0 - 18 + i * 9;
    p.stroke(x, 176 + dy, x + (i % 2 ? 3 : -3), 212 + dy, R.beard[1], 2, 1.2);
  }

  // front hair
  hair(p, {
    tone: S, crownY: 72, crownRx: 58, crownRy: 34, pose,
    locks: [
      [74, 68, 64, 42, 56, 74, 17], [86, 60, 82, 36, 74, 58, 16],
      [152, 68, 170, 42, 180, 74, 17], [160, 60, 178, 36, 186, 58, 16],
      [108, 54, 116, 30, 130, 50, 15], [140, 52, 148, 28, 158, 50, 14],
    ],
  });
  for (const s of [-1, 1]) p.lock(sx0 + s * 54, 90 + dy, sx0 + s * 66, 128 + dy, sx0 + s * 52, 158 + dy, 22, S[2], { hi: S[4] });

  // fur mantle
  for (const s of [-1, 1]) p.ellipse(sx0 + s * 44, 200 + dy, 30, 21, [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]]);
  p.ellipse(sx0, 208 + dy, 34, 15, [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]]);

  // chain
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * (0.05 + (i / 12) * 0.9);
    p.dot(sx0 + Math.cos(a) * 38, 198 + dy + Math.sin(a) * 24, 3.4, i % 2 ? R.gold[3] : R.gold[2]);
  }
  p.ellipse(sx0, 228 + dy, 14, 14, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.ellipse(sx0, 228 + dy, 9, 9, [R.gold[2], R.gold[3], R.gold[4], R.gold[4], R.gold[4]]);

  // gavel — swings up with the pose
  const gx = sx0 + 68 + pose.armR * 0.35, gy = 268 + dy + pose.armR * 1.5;
  p.stroke(gx, gy, gx + 16, gy - 88, R.brown[2], 11, 9);
  p.roundRect(gx - 22, gy - 128, 64, 36, 9, [R.brown[1], R.brown[2], R.brown[3], R.brown[3], R.brown[4]]);
  p.roundRect(gx - 28, gy - 122, 12, 24, 4, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.roundRect(gx + 36, gy - 122, 12, 24, 4, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.roundRect(gx - 12, gy - 120, 46, 9, 3, R.brown[4]);

  p.outline(O, 2.4);
  return p.done();
}

/* ═══════════════════════════════ PROSECUTOR ════════════════════════════════ */
export function prosecutor(o = {}) {
  const { pose, expr, e } = ctx({ ...o, tone: R.hairPink });
  const p = new Pen(W, H);
  const P = R.hairPink;
  const ox = pose.lean, dy = pose.dy;

  // twin tails
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      p.ellipse(A.cx + ox + s * (58 + i * 6), 108 + dy + i * 38, 20 - i * 3, 26 - i * 3,
        [P[0], P[1], P[2], P[3], P[3]]);
    }
  }
  p.ellipse(A.cx + ox, 110 + dy, 66, 62, [P[0], P[1], P[2], P[3], P[3]]);

  body(p, { tone: R.burgD, cuff: R.cream, legs: R.navy, shoes: R.ink, wide: 2, pose });
  const bx = A.cx + ox, by = A.shY + dy;
  p.poly([[bx - 30, by - 4], [bx - 6, by - 4], [bx, by + 40], [bx - 40, by + 20]], R.burg);
  p.poly([[bx + 30, by - 4], [bx + 6, by - 4], [bx, by + 40], [bx + 40, by + 20]], R.burg);
  p.roundRect(bx - 8, by - 6, 16, 40, 4, R.cream);
  p.roundRect(bx - 4, by - 4, 8, 32, 3, R.burgD);

  face(p, expr, { tone: P, pose });
  // pink iris
  for (const s of [-1, 1]) {
    p.ellipse(A.cx + ox + s * A.eyeDx, A.eyeY + dy + 2, 7, 9, [P[1], P[2], P[3], P[3], P[4]]);
    p.ellipse(A.cx + ox + s * A.eyeDx, A.eyeY + dy + 3, 3, 4, [T.pupil, T.pupil, T.pupil, T.pupil, T.iris]);
    p.dot(A.cx + ox + s * A.eyeDx - s * 3, A.eyeY + dy - 1, 2.6, R.white[0]);
  }

  // sunglasses on head
  p.roundRect(bx - 50, 72 + dy, 100, 18, 6, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(bx - 44, 76 + dy, 7, 5, 2, R.white[0]);
  p.roundRect(bx + 26, 76 + dy, 7, 5, 2, R.white[0]);

  hair(p, {
    tone: P, crownY: 70, crownRx: 58, crownRy: 34, pose,
    locks: [
      [72, 66, 60, 40, 52, 72, 18], [84, 58, 78, 34, 70, 56, 17],
      [150, 66, 168, 40, 178, 72, 18], [160, 58, 176, 34, 186, 56, 17],
      [100, 52, 110, 28, 124, 48, 16], [130, 50, 140, 26, 152, 48, 15],
    ],
  });

  // earrings
  for (const s of [-1, 1]) {
    p.ellipse(bx + s * 54, 138 + dy, 3, 5, R.gold);
    p.ellipse(bx + s * 54, 148 + dy, 5, 5, R.gold);
  }
  // pointing hand — leaps with the objection pose
  const hx = bx + 74 + pose.armR * 0.55, hy = by + 20 + pose.armR * 1.1;
  p.ellipse(hx, hy, 11, 11, [R.skin[1], R.skin[2], R.skin[3], R.skin[4], R.skin[4]]);
  p.stroke(hx + 6, hy - 6, hx + 22, hy - 16, R.skin[2], 7, 4);

  p.outline(O, 2.3);
  return p.done();
}

/* ═══════════════════════════════ DEFENSE ═══════════════════════════════════ */
export function defense(o = {}) {
  const { pose, expr } = ctx({ ...o, tone: R.hairBrown });
  const p = new Pen(W, H);
  const Br = R.hairBrown;
  const ox = pose.lean, dy = pose.dy;

  p.ellipse(A.cx + ox, 110 + dy, 66, 62, [Br[0], Br[1], Br[2], Br[3], Br[3]]);

  body(p, { tone: R.navy, cuff: R.cream, legs: R.navy, shoes: R.ink, pose });
  const bx = A.cx + ox, by = A.shY + dy;
  p.poly([[bx - 30, by - 4], [bx - 6, by - 4], [bx, by + 40], [bx - 40, by + 20]], R.navy);
  p.poly([[bx + 30, by - 4], [bx + 6, by - 4], [bx, by + 40], [bx + 40, by + 20]], R.navy);
  p.roundRect(bx - 8, by - 6, 16, 40, 4, R.cream);
  p.roundRect(bx - 4, by - 4, 8, 32, 3, R.burg);

  face(p, expr, { tone: Br, pose });

  // bandage
  p.roundRect(bx - 32, 132 + dy, 22, 9, 3, [R.cream[2], R.cream[3], R.cream[4], R.cream[4], R.cream[4]]);

  hair(p, {
    tone: Br, crownY: 72, crownRx: 58, crownRy: 34, pose,
    locks: [
      [70, 66, 58, 36, 62, 20, 18], [86, 56, 80, 26, 88, 14, 16],
      [104, 50, 102, 20, 114, 10, 17], [126, 48, 130, 16, 144, 12, 16],
      [150, 54, 158, 24, 172, 22, 16], [168, 62, 182, 38, 192, 30, 15],
    ],
  });
  p.lock(bx - 4, 48 + dy, bx - 10, 22 + dy, bx - 20, 8 + dy, 9, Br[2], { hi: Br[4] });

  // EXHIBIT A paper — tilts with the pose
  const px0 = bx - 84 - pose.armL * 0.4, py0 = by + 26 + pose.armL * 0.8;
  p.poly([[px0, py0], [px0 + 32, py0 - 6], [px0 + 36, py0 + 32], [px0 + 4, py0 + 38]],
    [R.cream[3], R.cream[4], R.cream[4], R.cream[4], R.cream[4]], { vertical: false });
  p.roundRect(px0 + 6, py0 + 4, 24, 5, 2, R.burg[2]);
  p.roundRect(px0 + 6, py0 + 14, 20, 4, 2, R.skin[1]);
  p.roundRect(px0 + 6, py0 + 23, 22, 4, 2, R.skin[1]);
  p.ellipse(bx + 34, by + 14, 4, 4, R.gold);

  p.outline(O, 2.3);
  return p.done();
}

/* ═══════════════════════════════ BAILIFF ═══════════════════════════════════ */
export function bailiff(o = {}) {
  const { pose, expr } = ctx({ ...o, tone: R.hairBrown });
  const p = new Pen(W, H);
  const Br = R.hairBrown;
  const ox = pose.lean, dy = pose.dy;

  p.ellipse(A.cx + ox, A.headCy + dy - 2, 60, 52, [Br[0], Br[1], Br[2], Br[3], Br[3]]);
  body(p, { tone: R.navy, legs: R.navy, shoes: R.ink, wide: 6, cuff: R.ink, pose });
  const bx = A.cx + ox, by = A.shY + dy;

  for (const s of [-1, 1]) {
    p.roundRect(bx + s * 50 - 14, by - 6, 28, 9, 4, R.gold);
    p.roundRect(bx + s * 50 - 10, by - 5, 20, 4, 2, R.gold[4]);
  }
  p.roundRect(bx - 26, by - 6, 52, 6, 3, R.gold[2]);
  for (let i = 0; i < 3; i++) p.ellipse(bx, by + 16 + i * 16, 3.4, 3.4, R.gold[3]);
  p.roundRect(bx - 50, by + 56, 100, 10, 3, R.ink);
  p.roundRect(bx - 9, by + 55, 18, 12, 3, R.gold);

  face(p, expr, { tone: Br, pose });

  for (let i = 0; i < 5; i++) {
    const x = bx - 44 + i * 22;
    p.lock(x, 96 + dy, x + 6, 88 + dy, x + 12, 76 + dy, 22, Br[2], { hi: Br[4] });
  }

  // cap
  p.roundRect(bx - 62, 52 + dy, 124, 30, 11, [R.navy[0], R.navy[1], R.navy[2], R.navy[3], R.navy[3]]);
  p.roundRect(bx - 64, 78 + dy, 128, 10, 4, R.ink);
  p.roundRect(bx - 42, 86 + dy, 84, 8, 4, R.ink);
  p.roundRect(bx - 62, 74 + dy, 124, 6, 3, R.gold[2]);
  p.ellipse(bx, 62 + dy, 14, 10, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.ellipse(bx, 62 + dy, 8, 6, R.gold[4]);

  p.outline(O, 2.3);
  return p.done();
}

/* ════════════════════════════════ CLERK ════════════════════════════════════ */
export function clerk(o = {}) {
  const { pose, expr } = ctx({ ...o, tone: R.hairBrown });
  const p = new Pen(W, H);
  const Br = R.hairBrown;
  const ox = pose.lean, dy = pose.dy;

  p.ellipse(A.cx + ox, 110 + dy, 64, 60, [Br[0], Br[1], Br[2], Br[3], Br[3]]);
  body(p, { tone: R.cream, cuff: R.burg, legs: R.burgD, shoes: R.ink, pose });
  const bx = A.cx + ox, by = A.shY + dy;

  p.poly([[bx - 30, by], [bx + 30, by], [bx + 34, A.hipY + dy + 6], [bx - 34, A.hipY + dy + 6]], R.burg);
  for (let i = 0; i < 4; i++) p.ellipse(bx, by + 18 + i * 16, 3, 3, R.gold[3]);
  p.roundRect(bx - 8, by - 6, 16, 24, 5, R.cream);

  face(p, expr, { tone: Br, pose });

  // glasses
  for (const s of [-1, 1]) {
    const ex = bx + s * A.eyeDx;
    p.ellipse(ex, A.eyeY + dy, 17, 16, ['#EAF4FF', '#EAF4FF', '#EAF4FF', '#EAF4FF', '#EAF4FF']);
  }
  for (const s of [-1, 1]) {
    const ex = bx + s * A.eyeDx;
    for (let a = 0; a < 360; a += 10) {
      const r = (a * Math.PI) / 180;
      p.dot(ex + Math.cos(r) * 17, A.eyeY + dy + Math.sin(r) * 16, 1.6, R.navy[1]);
    }
  }
  p.roundRect(bx - 6, A.eyeY + dy - 2, 12, 3, 1, R.navy[1]);

  hair(p, {
    tone: Br, crownY: 70, crownRx: 56, crownRy: 32, pose,
    locks: [
      [74, 66, 64, 44, 58, 74, 16], [88, 58, 84, 36, 78, 60, 15],
      [152, 66, 168, 44, 176, 74, 16], [160, 58, 174, 36, 182, 60, 15],
      [108, 52, 116, 30, 130, 50, 14],
    ],
  });
  p.ellipse(bx, 48 + dy, 26, 22, [Br[1], Br[2], Br[3], Br[4], Br[4]]);
  p.lock(bx + 50, 84 + dy, bx + 66, 110 + dy, bx + 58, 132 + dy, 8, Br[2], { hi: Br[4] });

  // papers, tilted by pose
  for (let i = 0; i < 5; i++) {
    const x = bx - 82 + i * 2 - pose.armL * 0.5, y = by + 30 + i * 7 + pose.armL * 0.9;
    p.poly([[x, y], [x + 32, y - 6], [x + 36, y + 4], [x + 4, y + 10]],
      [R.cream[2], R.cream[3], R.cream[4], R.cream[4], R.cream[4]], { vertical: false });
  }

  p.outline(O, 2.3);
  return p.done();
}

/* ═════════════════════════════ AI NARRATOR (0G) ════════════════════════════ */
export function narrator(o = {}) {
  const { expr, pose } = ctx(o);
  const p = new Pen(W, H);
  const dy = pose.dy * 0.7;
  const bx = A.cx;

  p.roundRect(bx - 52, 130 + dy, 104, 92, 16, [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]]);
  p.roundRect(bx - 56, 124 + dy, 112, 18, 8, R.purple);
  p.roundRect(bx - 40, 112 + dy, 80, 16, 7, R.purple);
  p.stroke(bx, 112 + dy, bx, 96 + dy, R.gold[2], 5);
  p.ellipse(bx, 90 + dy, 9, 9, R.cyan);
  p.ellipse(bx, 90 + dy, 5, 5, R.cyan[4]);

  // screen — expression changes the glyph
  p.roundRect(bx - 42, 144 + dy, 84, 56, 8, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[1]]);
  const scr = ['#A8F0F8', '#A8F0F8', '#C8F7FC', '#C8F7FC', '#C8F7FC'];
  p.roundRect(bx - 38, 148 + dy, 76, 48, 6, scr);
  const eyeY2 = 162 + dy;
  if (expr === 'happy' || expr === 'laughing') {
    p.stroke(bx - 24, eyeY2 + 6, bx - 12, eyeY2 - 2, R.ink[1], 4);
    p.stroke(bx - 12, eyeY2 - 2, bx, eyeY2 + 6, R.ink[1], 4);
    p.stroke(bx + 1, eyeY2 + 6, bx + 13, eyeY2 - 2, R.ink[1], 4);
    p.stroke(bx + 13, eyeY2 - 2, bx + 25, eyeY2 + 6, R.ink[1], 4);
  } else if (expr === 'angry') {
    p.roundRect(bx - 24, eyeY2 - 4, 16, 5, 2, R.ink[1]);
    p.roundRect(bx + 8, eyeY2 - 4, 16, 5, 2, R.ink[1]);
  } else if (expr === 'shocked') {
    p.roundRect(bx - 22, eyeY2 - 8, 14, 16, 3, R.ink[1]);
    p.roundRect(bx + 8, eyeY2 - 8, 14, 16, 3, R.ink[1]);
  } else if (expr === 'crying') {
    p.roundRect(bx - 24, eyeY2, 16, 5, 2, R.ink[1]);
    p.roundRect(bx + 8, eyeY2, 16, 5, 2, R.ink[1]);
    p.roundRect(bx - 22, eyeY2 + 8, 4, 12, 2, '#8ED8F0');
    p.roundRect(bx + 18, eyeY2 + 8, 4, 12, 2, '#8ED8F0');
  } else {
    p.roundRect(bx - 22, eyeY2 - 6, 15, 15, 3, R.ink[1]);
    p.roundRect(bx + 7, eyeY2 - 6, 15, 15, 3, R.ink[1]);
  }
  // mouth glyph
  if (expr === 'shocked' || expr === 'angry') p.roundRect(bx - 8, eyeY2 + 16, 16, 12, 4, R.ink[1]);
  else if (expr === 'happy' || expr === 'laughing') p.stroke(bx - 12, eyeY2 + 18, bx + 12, eyeY2 + 18, R.ink[1], 4);
  else p.roundRect(bx - 14, eyeY2 + 18, 28, 5, 2, R.ink[1]);

  for (const s of [-1, 1]) {
    p.roundRect(bx + s * 54 - 10, 146 + dy, 20, 46, 7, R.purple);
    p.roundRect(bx + s * 54 - 5, 156 + dy, 10, 26, 4, R.cyan);
  }
  p.roundRect(bx - 32, 222 + dy, 64, 16, 6, R.purple);
  p.roundRect(bx - 20, 236 + dy, 40, 14, 6, R.cyan);
  p.roundRect(bx - 10, 248 + dy, 20, 10, 4, R.cyan[4]);

  for (const [x, y, w] of [[196, 160, 22], [40, 190, 20], [188, 214, 18]]) {
    p.roundRect(x, y + dy, w, w * 1.25, 3, [R.cream[2], R.cream[3], R.cream[4], R.cream[4], R.cream[4]]);
    p.roundRect(x + 3, y + dy + 4, w - 6, 2, 1, R.skin[1]);
  }
  p.roundRect(bx - 52, 128 + dy, 104, 5, 2, R.gold[3]);

  p.outline(O, 2.4);
  return p.done();
}

/* ════════════════════════════════ JUROR ════════════════════════════════════ */
export function juror(o = {}) {
  const { pose, expr } = ctx({ ...o, tone: R.hairBrown });
  const p = new Pen(W, H);
  const Br = R.hairBrown;
  const ox = pose.lean, dy = pose.dy;

  p.ellipse(A.cx + ox, 110 + dy, 62, 58, [Br[0], Br[1], Br[2], Br[3], Br[3]]);
  body(p, { tone: R.blue, legs: R.navy, shoes: R.ink, cuff: R.blue, pose });
  const bx = A.cx + ox, by = A.shY + dy;

  p.ellipse(bx, by - 2, 36, 18, [R.blue[1], R.blue[2], R.blue[3], R.blue[3], R.blue[4]]);
  p.roundRect(bx - 20, by + 34, 40, 34, 8, R.blue[1]);

  face(p, expr, { tone: Br, pose });

  for (const s of [-1, 1]) p.ellipse(bx + s * A.eyeDx, A.eyeY + dy, 19, 18,
    ['#E8F6FF', '#E8F6FF', '#E8F6FF', '#E8F6FF', '#E8F6FF']);
  for (const s of [-1, 1]) {
    const ex = bx + s * A.eyeDx;
    for (let a = 0; a < 360; a += 9) {
      const r = (a * Math.PI) / 180;
      p.dot(ex + Math.cos(r) * 19, A.eyeY + dy + Math.sin(r) * 18, 1.8, R.brown[1]);
    }
  }
  p.roundRect(bx - 6, A.eyeY + dy - 2, 12, 3, 1, R.brown[1]);

  hair(p, {
    tone: Br, crownY: 74, crownRx: 56, crownRy: 30, pose,
    locks: [
      [78, 72, 70, 54, 66, 84, 14], [96, 62, 90, 44, 84, 74, 14],
      [150, 72, 168, 54, 174, 84, 14], [158, 62, 172, 44, 180, 74, 14],
    ],
  });

  p.roundRect(bx - 64, 58 + dy, 128, 30, 11, [R.blue[0], R.blue[1], R.blue[2], R.blue[3], R.blue[3]]);
  p.roundRect(bx - 66, 82 + dy, 132, 10, 4, R.blue[1]);
  p.roundRect(bx - 32, 90 + dy, 96, 10, 5, R.blue[0]);
  p.roundRect(bx - 12, 62 + dy, 24, 16, 5, R.cyan);
  p.roundRect(bx - 8, 66 + dy, 4, 4, 1, R.ink[1]);
  p.roundRect(bx + 4, 66 + dy, 4, 4, 1, R.ink[1]);

  for (const s of [-1, 1]) {
    p.roundRect(bx + s * 62 - 12, 118 + dy, 24, 42, 9, R.ink);
    p.roundRect(bx + s * 62 - 7, 126 + dy, 14, 26, 6, R.cyan);
  }
  p.stroke(bx - 62, 112 + dy, bx + 62, 112 + dy, R.ink[1], 8, 8);

  // popcorn
  const px0 = bx - 88 - pose.armL * 0.4, py0 = by + 20 + pose.armL * 0.8;
  p.poly([[px0, py0], [px0 + 36, py0], [px0 + 32, py0 + 42], [px0 + 4, py0 + 42]],
    [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]], { y0: py0, y1: py0 + 42 });
  p.poly([[px0, py0], [px0 + 36, py0], [px0 + 35, py0 + 10], [px0 + 1, py0 + 10]], R.burg);
  for (let i = 0; i < 5; i++) p.ellipse(px0 + 4 + i * 7, py0 - 4, 5, 5, i % 2 ? R.cream[4] : R.gold[3]);

  p.outline(O, 2.3);
  return p.done();
}

/* ══════════════════════════════ CREATOR / DEFENDANT ════════════════════════ */
export function creator(o = {}) {
  const { pose, expr } = ctx({ ...o, tone: R.hairBrown });
  const p = new Pen(W, H);
  const Br = R.hairBrown;
  const ox = pose.lean, dy = pose.dy;

  p.ellipse(A.cx + ox, 110 + dy, 64, 60, [Br[0], Br[1], Br[2], Br[3], Br[3]]);
  body(p, { tone: R.pink, legs: R.pink, shoes: R.white, cuff: R.pink, pose });
  const bx = A.cx + ox, by = A.shY + dy;

  p.ellipse(bx, by - 2, 36, 18, [R.pink[1], R.pink[2], R.pink[3], R.pink[3], R.pink[4]]);
  p.roundRect(bx - 20, by + 34, 40, 34, 8, R.pink[1]);

  face(p, expr, { tone: Br, pose });

  // pixel heart
  const hx = bx - 12, hy = by + 30;
  const W2 = R.white[0];
  p.roundRect(hx, hy + 6, 8, 8, 1, W2);
  p.roundRect(hx + 16, hy + 6, 8, 8, 1, W2);
  p.roundRect(hx, hy, 8, 10, 1, W2);
  p.roundRect(hx + 16, hy, 8, 10, 1, W2);
  p.roundRect(hx + 8, hy + 4, 8, 10, 1, W2);
  p.roundRect(hx + 8, hy + 12, 8, 4, 1, W2);

  hair(p, {
    tone: Br, crownY: 72, crownRx: 58, crownRy: 34, pose,
    locks: [
      [70, 66, 60, 38, 64, 22, 17], [86, 56, 82, 28, 90, 16, 16],
      [106, 50, 104, 22, 116, 12, 16], [128, 48, 132, 18, 146, 14, 16],
      [152, 54, 160, 26, 174, 24, 15], [170, 62, 184, 40, 194, 32, 14],
    ],
  });

  p.roundRect(bx - 58, 106 + dy, 116, 32, 5, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(bx - 52, 110 + dy, 44, 24, 4, R.ink[1]);
  p.roundRect(bx + 8, 110 + dy, 44, 24, 4, R.ink[1]);
  p.roundRect(bx - 42, 114 + dy, 10, 7, 2, R.white[0]);
  p.roundRect(bx + 18, 114 + dy, 10, 7, 2, R.white[0]);

  p.outline(O, 2.3);
  return p.done();
}

export const CHARS = { judge, prosecutor, defense, bailiff, clerk, 'ai-narrator': narrator, juror, creator };
export const CHAR_IDS = Object.keys(CHARS);

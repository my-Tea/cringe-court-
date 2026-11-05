// All 8 characters — high-detail build on pen3 + artkit.
// Each character: hair as tapered locks with highlight stripes, garment with
// 5-tone ramp + trim, signature prop, and per-character face features.
import { Pen, mix, shade } from './pen3.mjs';
import {
  R, T, A, head, eye, brow, nose, mouth, blush,
} from './artkit.mjs';

const O = '#241A22';
const W = 256, H = 320;

/* ───────────────────────────── shared builders ───────────────────────────── */

/** Torso + arms + legs. `tone` is a 5-array ramp. */
function body(p, {
  tone, sleeve = null, cuff = null, legs = null, shoes = null,
  wide = 0, hem = 286,
}) {
  const sh = A.shDx + wide;
  const S = sleeve || tone, L = legs || tone;
  // legs
  for (const sx of [-1, 1]) {
    const x = A.cx + sx * 18;
    p.roundRect(x - 12, A.hipY - 6, 24, 58, 9, [L[1], L[2], L[2], L[3], L[3]]);
    p.roundRect(x - 15, A.hipY + 44, 30, 16, 7, shoes || R.ink);
  }
  // arms behind torso
  for (const sx of [-1, 1]) {
    p.ellipse(A.cx + sx * (sh + 13), A.shY + 28, 13, 32, [S[1], S[2], S[3], S[3], S[4]], { rot: sx * 0.07 });
    if (cuff) p.ellipse(A.cx + sx * (sh + 15), A.shY + 56, 11, 8, [cuff[1], cuff[2], cuff[3], cuff[3], cuff[4]]);
    p.ellipse(A.cx + sx * (sh + 16), A.shY + 64, 10, 10, [R.skin[1], R.skin[2], R.skin[3], R.skin[4], R.skin[4]]);
  }
  // torso
  p.poly([
    [A.cx - sh, A.shY - 8], [A.cx + sh, A.shY - 8],
    [A.cx + sh + 8, hem], [A.cx - sh - 8, hem],
  ], [tone[1], tone[2], tone[3], tone[3], tone[4]], { y0: A.shY - 8, y1: hem });
  // neck
  p.roundRect(A.cx - 9, A.neckY - 12, 18, 24, 6, [R.skin[1], R.skin[2], R.skin[2], R.skin[3], R.skin[3]]);
  return p;
}

/** Hair: back mass, then front locks with highlight stripes. */
function hair(p, {
  tone, style = 'short', back = true, locks = [], crown = true, crownY = 74, crownRx = 58, crownRy = 36,
}) {
  if (back) {
    p.ellipse(A.cx, A.headCy - 4, crownRx + 8, crownRy + 30,
      [tone[0], tone[1], tone[2], tone[3], tone[3]]);
  }
  if (crown) p.ellipse(A.cx, crownY, crownRx, crownRy,
    [tone[1], tone[2], tone[3], tone[4], tone[4]], { light: [-0.5, -0.87] });
  for (const L of locks) {
    const [x0, y0, cx, cy, x1, y1, w] = L;
    p.lock(x0, y0, cx, cy, x1, y1, w, tone[2], { hi: tone[4] });
  }
  return p;
}

/* ══════════════════════════════════ JUDGE ══════════════════════════════════ */
export function judge() {
  const p = new Pen(W, H);
  const O2 = [R.hairS[0], R.hairS[1], R.hairS[2], R.hairS[3], R.hairS[4]];

  // mane silhouette — one shape, notched
  p.shape(A.cx, 118, (a) => {
    const side = Math.pow(Math.abs(Math.cos(a)), 0.65);
    const bot = Math.pow(Math.max(0, Math.sin(a)), 1.7);
    const top = Math.pow(Math.max(0, -Math.sin(a)), 0.9);
    return 74 * (0.76 + 0.32 * side) * (1 - 0.30 * bot) * (1 + 0.10 * top);
  }, (x) => (x > A.cx + 14 ? O2[1] : O2[3]));
  // mane strand grooves
  for (let i = 0; i < 9; i++) {
    const x = 62 + i * 17;
    p.curve(x, 70, x + (i % 2 ? 8 : -8), 120, x + (i % 2 ? 4 : -4), 172, O2[1], 2.4, 1.2);
  }

  body(p, { tone: R.burg, cuff: R.cream, legs: R.burgD, shoes: R.ink, hem: 288 });
  // robe trim
  p.roundRect(A.cx - 3, A.shY, 6, 92, 2, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.roundRect(A.cx - 26, 280, 52, 8, 3, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);

  head(p);
  blush(p, 0.5);

  // eyes (partly behind shades)
  eye(p, -1, 'sharp'); eye(p, 1, 'sharp');

  // shades — focal point
  p.roundRect(70, 104, 54, 34, 6, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(132, 104, 54, 34, 6, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(120, 112, 14, 10, 3, R.ink[1]);
  p.stroke(70, 114, 56, 106, R.ink[1], 5);
  p.stroke(186, 114, 200, 106, R.ink[1], 5);
  p.roundRect(80, 110, 12, 8, 2, R.white[0]);
  p.roundRect(96, 119, 7, 5, 1, R.hairS[2]);
  p.roundRect(146, 110, 12, 8, 2, R.white[0]);
  p.roundRect(162, 119, 7, 5, 1, R.hairS[2]);

  // moustache
  p.lock(102, 158, 116, 148, 130, 156, 26, R.beard[3], { hi: R.beard[4] });
  p.lock(154, 158, 140, 148, 126, 156, 26, R.beard[3], { hi: R.beard[4] });
  p.ellipse(A.cx, 154, 13, 7, [R.beard[2], R.beard[3], R.beard[4], R.beard[4], R.beard[4]]);

  // beard — tapered poly + strand grooves
  p.poly([
    [86, 150], [170, 150], [166, 198], [150, 228], [128, 246], [106, 228], [90, 198],
  ], [R.beard[2], R.beard[3], R.beard[3], R.beard[4], R.beard[4]], { y0: 150, y1: 246 });
  for (let i = 0; i < 6; i++) {
    const x = 104 + i * 9;
    p.stroke(x, 170, x + (i % 2 ? 3 : -3), 214, R.beard[1], 2, 1.2);
  }
  p.stroke(92, 196, 112, 226, R.beard[1], 2.4, 1.2);
  p.stroke(164, 196, 144, 226, R.beard[1], 2.4, 1.2);

  // front hair locks (outer edges only, so the shades stay clear)
  hair(p, {
    tone: R.hairS, back: false, crownY: 72, crownRx: 58, crownRy: 34,
    locks: [
      [74, 68, 64, 42, 56, 74, 17], [86, 60, 82, 36, 74, 58, 16],
      [152, 68, 170, 42, 180, 74, 17], [160, 60, 178, 36, 186, 58, 16],
      [108, 54, 116, 30, 130, 50, 15], [140, 52, 148, 28, 158, 50, 14],
    ],
  });
  // sideburns into the beard
  for (const sx of [-1, 1]) {
    p.lock(A.cx + sx * 54, 90, A.cx + sx * 66, 128, A.cx + sx * 52, 158, 22, R.hairS[2], { hi: R.hairS[4] });
  }

  // fur mantle (arc, not disc)
  for (const sx of [-1, 1]) p.ellipse(A.cx + sx * 44, 200, 30, 21, [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]]);
  p.ellipse(A.cx, 208, 34, 15, [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]]);
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * (0.08 + (i / 12) * 0.84);
    const x = A.cx - Math.cos(a) * 54, y = 202 + Math.sin(a) * 15;
    p.stroke(x, y, x, y + 5, R.cream[1], 2.2, 1.2);
  }

  // chain + medallion
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * (0.05 + (i / 12) * 0.9);
    p.dot(A.cx + Math.cos(a) * 38, 198 + Math.sin(a) * 24, 3.4,
      i % 2 ? R.gold[3] : R.gold[2]);
  }
  p.ellipse(A.cx, 228, 14, 14, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.ellipse(A.cx, 228, 9, 9, [R.gold[2], R.gold[3], R.gold[4], R.gold[4], R.gold[4]]);
  p.roundRect(A.cx - 8, 225, 16, 3, 1, R.gold[1]);
  p.ellipse(A.cx - 7, 232, 4, 4, R.gold[1]);
  p.ellipse(A.cx + 7, 232, 4, 4, R.gold[1]);

  // gavel — oversized
  p.stroke(196, 268, 212, 180, R.brown[2], 11, 9);
  p.roundRect(190, 180, 8, 22, 3, R.gold[2]);
  p.roundRect(174, 140, 64, 36, 9, [R.brown[1], R.brown[2], R.brown[3], R.brown[3], R.brown[4]]);
  p.roundRect(168, 146, 12, 24, 4, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.roundRect(232, 146, 12, 24, 4, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.roundRect(184, 148, 46, 9, 3, R.brown[4]);

  p.outline(O, 2.4);
  return p.done();
}

/* ═══════════════════════════════ PROSECUTOR ════════════════════════════════ */
export function prosecutor() {
  const p = new Pen(W, H);
  const P = R.hairPink;

  // twin-tail back masses
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      p.ellipse(A.cx + sx * (58 + i * 6), 108 + i * 38, 20 - i * 3, 26 - i * 3,
        [P[0], P[1], P[2], P[3], P[3]]);
    }
  }
  p.ellipse(A.cx, 110, 66, 62, [P[0], P[1], P[2], P[3], P[3]]);

  body(p, { tone: R.burgD, cuff: R.cream, legs: R.navy, shoes: R.ink, wide: 2 });
  // blazer lapels + tie
  p.poly([[A.cx - 30, A.shY - 4], [A.cx - 6, A.shY - 4], [A.cx, A.shY + 40], [A.cx - 40, A.shY + 20]], R.burg);
  p.poly([[A.cx + 30, A.shY - 4], [A.cx + 6, A.shY - 4], [A.cx, A.shY + 40], [A.cx + 40, A.shY + 20]], R.burg);
  p.roundRect(A.cx - 8, A.shY - 6, 16, 40, 4, R.cream);
  p.roundRect(A.cx - 4, A.shY - 4, 8, 32, 3, R.burgD);
  p.poly([[A.cx - 5, A.shY - 4], [A.cx + 5, A.shY - 4], [A.cx, A.shY - 12]], R.burgD);

  head(p);
  blush(p, 0.7);
  eye(p, -1, 'sharp'); eye(p, 1, 'sharp');
  // pink iris override
  for (const sx of [-1, 1]) {
    p.ellipse(A.cx + sx * A.eyeDx, A.eyeY + 2, 7, 9, [P[1], P[2], P[3], P[3], P[4]]);
    p.ellipse(A.cx + sx * A.eyeDx, A.eyeY + 3, 3, 4, [T.pupil, T.pupil, T.pupil, T.pupil, T.iris]);
    p.dot(A.cx + sx * A.eyeDx - sx * 3, A.eyeY - 1, 2.6, R.white[0]);
    p.stroke(A.cx + sx * A.eyeDx - 15 * sx, A.eyeY - 9, A.cx + sx * A.eyeDx + 13 * sx, A.eyeY - 9, T.ink, 4, 3);
  }
  brow(p, -1, { tilt: -2, tone: P }); brow(p, 1, { tilt: -2, tone: P });
  nose(p); mouth(p, 'grit');

  // sunglasses pushed up on the head
  p.roundRect(78, 72, 100, 18, 6, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(80, 74, 26, 12, 4, R.ink[1]);
  p.roundRect(150, 74, 26, 12, 4, R.ink[1]);
  p.roundRect(88, 76, 7, 5, 2, R.white[0]);
  p.roundRect(158, 76, 7, 5, 2, R.white[0]);

  hair(p, {
    tone: P, back: false, crownY: 70, crownRx: 58, crownRy: 34,
    locks: [
      [72, 66, 60, 40, 52, 72, 18], [84, 58, 78, 34, 70, 56, 17],
      [150, 66, 168, 40, 178, 72, 18], [160, 58, 176, 34, 186, 56, 17],
      [100, 52, 110, 28, 124, 48, 16], [130, 50, 140, 26, 152, 48, 15],
      [112, 56, 120, 32, 134, 52, 14],
    ],
  });

  // gold scales earrings
  for (const sx of [-1, 1]) {
    p.ellipse(A.cx + sx * 54, 138, 3, 5, R.gold);
    p.ellipse(A.cx + sx * 54, 148, 5, 5, R.gold);
    p.roundRect(A.cx + sx * 54 - 5, 147, 10, 2, 1, R.gold[1]);
  }

  // pointing hand
  p.ellipse(A.cx + 74, A.shY + 20, 11, 11, [R.skin[1], R.skin[2], R.skin[3], R.skin[4], R.skin[4]]);
  p.stroke(A.cx + 80, A.shY + 14, A.cx + 96, A.shY + 4, R.skin[2], 7, 4);

  p.outline(O, 2.3);
  return p.done();
}

/* ═══════════════════════════════ DEFENSE ═══════════════════════════════════ */
export function defense() {
  const p = new Pen(W, H);
  const Br = R.hairBrown;

  p.ellipse(A.cx, 110, 66, 62, [Br[0], Br[1], Br[2], Br[3], Br[3]]);

  body(p, { tone: R.navy, cuff: R.cream, legs: R.navy, shoes: R.ink });
  p.poly([[A.cx - 30, A.shY - 4], [A.cx - 6, A.shY - 4], [A.cx, A.shY + 40], [A.cx - 40, A.shY + 20]], R.navy);
  p.poly([[A.cx + 30, A.shY - 4], [A.cx + 6, A.shY - 4], [A.cx, A.shY + 40], [A.cx + 40, A.shY + 20]], R.navy);
  p.roundRect(A.cx - 8, A.shY - 6, 16, 40, 4, R.cream);
  p.roundRect(A.cx - 4, A.shY - 4, 8, 32, 3, R.burg);
  p.poly([[A.cx - 5, A.shY - 4], [A.cx + 5, A.shY - 4], [A.cx, A.shY - 12]], R.burg);

  head(p);
  blush(p, 0.4);
  eye(p, -1, 'round'); eye(p, 1, 'round');
  brow(p, -1, { tone: Br }); brow(p, 1, { tone: Br });
  nose(p); mouth(p, 'smirk');

  // bandage on cheek
  p.roundRect(96, 132, 22, 9, 3, [R.cream[2], R.cream[3], R.cream[4], R.cream[4], R.cream[4]]);
  for (let i = 0; i < 3; i++) p.stroke(100 + i * 6, 133, 100 + i * 6, 140, R.cream[1], 1.4);

  // messy spiky hair
  hair(p, {
    tone: Br, back: false, crownY: 72, crownRx: 58, crownRy: 34,
    locks: [
      [70, 66, 58, 36, 62, 20, 18], [86, 56, 80, 26, 88, 14, 16],
      [104, 50, 102, 20, 114, 10, 17], [126, 48, 130, 16, 144, 12, 16],
      [150, 54, 158, 24, 172, 22, 16], [168, 62, 182, 38, 192, 30, 15],
      [60, 74, 48, 50, 40, 44, 14], [196, 76, 208, 52, 214, 46, 13],
    ],
  });
  // ahoge
  p.lock(124, 48, 118, 22, 108, 8, 9, Br[2], { hi: Br[4] });

  // EXHIBIT A paper
  p.poly([[A.cx - 84, A.shY + 26], [A.cx - 52, A.shY + 20], [A.cx - 48, A.shY + 58], [A.cx - 80, A.shY + 64]],
    [R.cream[3], R.cream[4], R.cream[4], R.cream[4], R.cream[4]], { vertical: false });
  p.roundRect(A.cx - 78, A.shY + 30, 24, 5, 2, R.burg[2]);
  p.roundRect(A.cx - 78, A.shY + 40, 20, 4, 2, R.skin[1]);
  p.roundRect(A.cx - 78, A.shY + 49, 22, 4, 2, R.skin[1]);

  // gold lapel pin
  p.ellipse(A.cx + 34, A.shY + 14, 4, 4, R.gold);

  p.outline(O, 2.3);
  return p.done();
}

  /* ═══════════════════════════════ BAILIFF ═══════════════════════════════════ */
export function bailiff() {
  const p = new Pen(W, H);
  const Br = R.hairBrown;

  // back hair FIRST (a full head-sized mass must never be painted over the face)
  p.ellipse(A.cx, A.headCy - 2, 60, 52, [Br[0], Br[1], Br[2], Br[3], Br[3]]);

  body(p, { tone: R.navy, legs: R.navy, shoes: R.ink, wide: 6, cuff: R.ink });

  // epaulettes
  for (const sx of [-1, 1]) {
    p.roundRect(A.cx + sx * 50 - 14, A.shY - 6, 28, 9, 4, R.gold);
    p.roundRect(A.cx + sx * 50 - 10, A.shY - 5, 20, 4, 2, R.gold[4]);
  }
  p.roundRect(A.cx - 26, A.shY - 6, 52, 6, 3, R.gold[2]);
  for (let i = 0; i < 3; i++) p.ellipse(A.cx, A.shY + 16 + i * 16, 3.4, 3.4, R.gold[3]);
  p.roundRect(A.cx - 50, A.shY + 56, 100, 10, 3, R.ink);
  p.roundRect(A.cx - 9, A.shY + 55, 18, 12, 3, R.gold);

  head(p);
  blush(p, 0.25);
  eye(p, -1, 'sharp'); eye(p, 1, 'sharp');
  brow(p, -1, { tilt: 2, tone: Br }); brow(p, 1, { tilt: 2, tone: Br });
  nose(p); mouth(p, 'neutral');

  // hair: only a thin fringe UNDER the cap line (y > 88) so the face stays clear
  for (let i = 0; i < 5; i++) {
    const x = 84 + i * 22;
    p.lock(x, 96, x + 6, 88, x + 12, 76, 22, Br[2], { hi: Br[4] });
  }

  // peaked cap — sits at the TOP of the head, above the eyes
  p.roundRect(66, 52, 124, 30, 11, [R.navy[0], R.navy[1], R.navy[2], R.navy[3], R.navy[3]]);
  p.roundRect(64, 78, 128, 10, 4, R.ink);
  p.roundRect(86, 86, 84, 8, 4, R.ink);        // peak/brim
  p.roundRect(66, 74, 124, 6, 3, R.gold[2]);   // cap band
  p.ellipse(A.cx, 62, 14, 10, [R.gold[1], R.gold[2], R.gold[3], R.gold[4], R.gold[4]]);
  p.ellipse(A.cx, 62, 8, 6, R.gold[4]);

  // whistle
  p.stroke(A.cx, A.shY + 20, A.cx, A.shY + 34, R.gold[2], 2.4);
  p.ellipse(A.cx, A.shY + 38, 6, 5, R.cream);

  p.outline(O, 2.3);
  return p.done();
}

/* ════════════════════════════════ CLERK ════════════════════════════════════ */
export function clerk() {
  const p = new Pen(W, H);
  const Br = R.hairBrown;

  p.ellipse(A.cx, 110, 64, 60, [Br[0], Br[1], Br[2], Br[3], Br[3]]);

  body(p, { tone: R.cream, cuff: R.burg, legs: R.burgD, shoes: R.ink });
  // waistcoat
  p.poly([[A.cx - 30, A.shY], [A.cx + 30, A.shY], [A.cx + 34, A.hipY + 6], [A.cx - 34, A.hipY + 6]], R.burg);
  for (let i = 0; i < 4; i++) p.ellipse(A.cx, A.shY + 18 + i * 16, 3, 3, R.gold[3]);
  p.roundRect(A.cx - 8, A.shY - 6, 16, 24, 5, R.cream);

  head(p);
  blush(p, 0.45);
  eye(p, -1, 'round'); eye(p, 1, 'round');
  brow(p, -1, { tone: Br }); brow(p, 1, { tone: Br });
  nose(p); mouth(p, 'neutral');

  // round glasses
  for (const sx of [-1, 1]) {
    const ex = A.cx + sx * A.eyeDx;
    for (let a = 0; a < 360; a += 10) {
      const r = (a * Math.PI) / 180;
      p.dot(ex + Math.cos(r) * 17, A.eyeY + Math.sin(r) * 16, 1.6, R.navy[1]);
    }
    p.ellipse(ex, A.eyeY, 16, 15, ['#EAF4FF', '#EAF4FF', '#EAF4FF', '#EAF4FF', '#EAF4FF']);
  }
  for (const sx of [-1, 1]) { eye(p, sx, 'round'); }
  p.roundRect(A.cx - 6, A.eyeY - 2, 12, 3, 1, R.navy[1]);

  // hair: bun + fringe
  hair(p, {
    tone: Br, back: false, crownY: 70, crownRx: 56, crownRy: 32,
    locks: [
      [74, 66, 64, 44, 58, 74, 16], [88, 58, 84, 36, 78, 60, 15],
      [152, 66, 168, 44, 176, 74, 16], [160, 58, 174, 36, 182, 60, 15],
      [108, 52, 116, 30, 130, 50, 14],
    ],
  });
  p.ellipse(A.cx, 48, 26, 22, [Br[1], Br[2], Br[3], Br[4], Br[4]]);
  p.ellipse(A.cx - 6, 44, 12, 10, Br[3]);
  // escaped strand
  p.lock(A.cx + 50, 84, A.cx + 66, 110, A.cx + 58, 132, 8, Br[2], { hi: Br[4] });

  // armful of papers
  for (let i = 0; i < 5; i++) {
    p.poly([
      [A.cx - 82 + i * 2, A.shY + 30 + i * 7], [A.cx - 50 + i * 2, A.shY + 24 + i * 7],
      [A.cx - 46 + i * 2, A.shY + 34 + i * 7], [A.cx - 78 + i * 2, A.shY + 40 + i * 7],
    ], [R.cream[2], R.cream[3], R.cream[4], R.cream[4], R.cream[4]], { vertical: false });
  }
  p.roundRect(A.cx - 76, A.shY + 34, 22, 4, 2, R.burg[2]);

  p.outline(O, 2.3);
  return p.done();
}

/* ═════════════════════════════ AI NARRATOR (0G) ════════════════════════════ */
export function narrator() {
  const p = new Pen(W, H);

  // floating chassis
  p.roundRect(76, 130, 104, 92, 16, [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]]);
  p.roundRect(72, 124, 112, 18, 8, R.purple);
  p.roundRect(88, 112, 80, 16, 7, R.purple);
  // antenna
  p.stroke(A.cx, 112, A.cx, 96, R.gold[2], 5);
  p.ellipse(A.cx, 90, 9, 9, R.cyan);
  p.ellipse(A.cx, 90, 5, 5, R.cyan[4]);

  // screen
  p.roundRect(86, 144, 84, 56, 8, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[1]]);
  p.roundRect(90, 148, 76, 48, 6, ['#A8F0F8', '#A8F0F8', '#C8F7FC', '#C8F7FC', '#C8F7FC']);
  // digital face
  p.roundRect(98, 160, 16, 16, 3, R.ink[1]);
  p.roundRect(142, 160, 16, 16, 3, R.ink[1]);
  p.roundRect(114, 178, 28, 6, 2, R.ink[1]);
  p.roundRect(122, 170, 12, 5, 2, R.ink[1]);

  // side pods
  for (const sx of [-1, 1]) {
    p.roundRect(A.cx + sx * 54 - 10, 146, 20, 46, 7, R.purple);
    p.roundRect(A.cx + sx * 54 - 5, 156, 10, 26, 4, R.cyan);
  }
  // thruster
  p.roundRect(96, 222, 64, 16, 6, R.purpleD || R.purple);
  p.roundRect(108, 236, 40, 14, 6, R.cyan);
  p.roundRect(118, 248, 20, 10, 4, R.cyan[4]);

  // orbiting papers
  for (const [x, y, w] of [[196, 160, 22], [40, 190, 20], [188, 214, 18]]) {
    p.roundRect(x, y, w, w * 1.25, 3, [R.cream[2], R.cream[3], R.cream[4], R.cream[4], R.cream[4]]);
    p.roundRect(x + 3, y + 4, w - 6, 2, 1, R.skin[1]);
    p.roundRect(x + 3, y + 9, w - 9, 2, 1, R.skin[1]);
  }
  // gold trim
  p.roundRect(76, 128, 104, 5, 2, R.gold[3]);

  p.outline(O, 2.4);
  return p.done();
}

/* ════════════════════════════════ JUROR ════════════════════════════════════ */
export function juror() {
  const p = new Pen(W, H);
  const Br = R.hairBrown;

  p.ellipse(A.cx, 110, 62, 58, [Br[0], Br[1], Br[2], Br[3], Br[3]]);

  body(p, { tone: R.blue, legs: R.navy, shoes: R.ink, cuff: R.blue });
  // hoodie hood + pocket + strings
  p.ellipse(A.cx, A.shY - 2, 36, 18, [R.blue[1], R.blue[2], R.blue[3], R.blue[3], R.blue[4]]);
  p.roundRect(A.cx - 20, A.shY + 34, 40, 34, 8, R.blue[1]);
  p.stroke(A.cx - 8, A.shY + 4, A.cx - 8, A.shY + 28, R.cream[3], 3);
  p.stroke(A.cx + 8, A.shY + 4, A.cx + 8, A.shY + 28, R.cream[3], 3);

  head(p);
  blush(p, 0.6);
  eye(p, -1, 'round'); eye(p, 1, 'round');
  brow(p, -1, { tone: Br }); brow(p, 1, { tone: Br });
  nose(p); mouth(p, 'smile');

  // oversized round glasses
  for (const sx of [-1, 1]) {
    const ex = A.cx + sx * A.eyeDx;
    p.ellipse(ex, A.eyeY, 19, 18, ['#E8F6FF', '#E8F6FF', '#E8F6FF', '#E8F6FF', '#E8F6FF']);
  }
  for (const sx of [-1, 1]) eye(p, sx, 'round');
  for (const sx of [-1, 1]) {
    const ex = A.cx + sx * A.eyeDx;
    for (let a = 0; a < 360; a += 9) {
      const r = (a * Math.PI) / 180;
      p.dot(ex + Math.cos(r) * 19, A.eyeY + Math.sin(r) * 18, 1.8, R.brown[1]);
    }
  }
  p.roundRect(A.cx - 6, A.eyeY - 2, 12, 3, 1, R.brown[1]);

  // shaggy fringe under the cap
  hair(p, {
    tone: Br, back: false, crownY: 74, crownRx: 56, crownRy: 30,
    locks: [
      [78, 72, 70, 54, 66, 84, 14], [96, 62, 90, 44, 84, 74, 14],
      [150, 72, 168, 54, 174, 84, 14], [158, 62, 172, 44, 180, 74, 14],
      [120, 58, 128, 40, 140, 62, 13],
    ],
  });

  // cap
  p.roundRect(64, 58, 128, 30, 11, [R.blue[0], R.blue[1], R.blue[2], R.blue[3], R.blue[3]]);
  p.roundRect(62, 82, 132, 10, 4, R.blue[1]);
  p.roundRect(96, 90, 96, 10, 5, R.blue[0]);   // brim
  p.roundRect(A.cx - 12, 62, 24, 16, 5, R.cyan);  // cat motif
  p.roundRect(A.cx - 8, 66, 4, 4, 1, R.ink[1]);
  p.roundRect(A.cx + 4, 66, 4, 4, 1, R.ink[1]);

  // headphones
  for (const sx of [-1, 1]) {
    p.roundRect(A.cx + sx * 62 - 12, 118, 24, 42, 9, R.ink);
    p.roundRect(A.cx + sx * 62 - 7, 126, 14, 26, 6, R.cyan);
  }
  p.stroke(A.cx - 62, 112, A.cx + 62, 112, R.ink[1], 8, 8);

  // popcorn bucket
  p.poly([[A.cx - 88, A.shY + 20], [A.cx - 52, A.shY + 20], [A.cx - 56, A.shY + 62], [A.cx - 84, A.shY + 62]],
    [R.cream[1], R.cream[2], R.cream[3], R.cream[4], R.cream[4]], { y0: A.shY + 20, y1: A.shY + 62 });
  p.poly([[A.cx - 88, A.shY + 20], [A.cx - 52, A.shY + 20], [A.cx - 53, A.shY + 30], [A.cx - 87, A.shY + 30]], R.burg);
  for (let i = 0; i < 5; i++) p.ellipse(A.cx - 84 + i * 7, A.shY + 16, 5, 5, i % 2 ? R.cream[4] : R.gold[3]);

  p.outline(O, 2.3);
  return p.done();
}

/* ══════════════════════════════ CREATOR / DEFENDANT ════════════════════════ */
export function creator() {
  const p = new Pen(W, H);
  const Br = R.hairBrown;

  p.ellipse(A.cx, 110, 64, 60, [Br[0], Br[1], Br[2], Br[3], Br[3]]);

  body(p, { tone: R.pink, legs: R.pink, shoes: R.white, cuff: R.pink });
  p.ellipse(A.cx, A.shY - 2, 36, 18, [R.pink[1], R.pink[2], R.pink[3], R.pink[3], R.pink[4]]);
  p.roundRect(A.cx - 20, A.shY + 34, 40, 34, 8, R.pink[1]);

  head(p);
  blush(p, 0.6);
  eye(p, -1, 'round'); eye(p, 1, 'round');
  brow(p, -1, { tone: Br }); brow(p, 1, { tone: Br });
  nose(p); mouth(p, 'grin');

  // hoodie pixel-heart
  const hx = A.cx - 12, hy = A.shY + 30;
  const W2 = R.white[0];
  p.roundRect(hx, hy + 6, 8, 8, 1, W2);
  p.roundRect(hx + 16, hy + 6, 8, 8, 1, W2);
  p.roundRect(hx, hy, 8, 10, 1, W2);
  p.roundRect(hx + 16, hy, 8, 10, 1, W2);
  p.roundRect(hx + 8, hy + 4, 8, 10, 1, W2);
  p.roundRect(hx + 8, hy + 12, 8, 4, 1, W2);

  // messy dark hair
  hair(p, {
    tone: Br, back: false, crownY: 72, crownRx: 58, crownRy: 34,
    locks: [
      [70, 66, 60, 38, 64, 22, 17], [86, 56, 82, 28, 90, 16, 16],
      [106, 50, 104, 22, 116, 12, 16], [128, 48, 132, 18, 146, 14, 16],
      [152, 54, 160, 26, 174, 24, 15], [170, 62, 184, 40, 194, 32, 14],
    ],
  });

  // pixel shades
  p.roundRect(70, 106, 116, 32, 5, [R.ink[0], R.ink[0], R.ink[1], R.ink[1], R.ink[2]]);
  p.roundRect(76, 110, 44, 24, 4, R.ink[1]);
  p.roundRect(136, 110, 44, 24, 4, R.ink[1]);
  p.roundRect(86, 114, 10, 7, 2, R.white[0]);
  p.roundRect(146, 114, 10, 7, 2, R.white[0]);
  p.roundRect(A.cx - 4, 114, 8, 12, 2, R.ink[1]);

  p.outline(O, 2.3);
  return p.done();
}

export const CHARS = { judge, prosecutor, defense, bailiff, clerk, 'ai-narrator': narrator, juror, creator };
export const CHAR_IDS = Object.keys(CHARS);

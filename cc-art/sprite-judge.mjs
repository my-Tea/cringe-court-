// Judge Gavel.exe — 2D sprite. Silver mane, black pixel shades, huge white
// beard, burgundy robe, oversized gavel.
import { Sprite } from './sprite2d.mjs';
import { P, body, eye, brow, mouth, nose, face, O, INK, A } from './sprite-parts.mjs';

export function judgeSprite() {
  const s = new Sprite(256, 320);

  /* ── back hair: big silver mass behind the head ─────────────────── */
  s.ellipse(128, 108, 74, 70, P.silverSh);
  // side curtains
  s.ellipse(62, 150, 26, 62, P.silverSh, { rot: -0.18 });
  s.ellipse(194, 150, 26, 62, P.silverSh, { rot: 0.18 });

  /* ── body (robe) ─────────────────────────────────────────────────── */
  body(s, { col: P.burg, colSh: P.burgD, style: 'robe', sleeve: P.burg, cuff: P.cream, legs: P.burgD, shoes: P.black });

  /* ── fur mantle ──────────────────────────────────────────────────── */
  s.ellipse(128, 200, 62, 22, P.cream);
  for (let i = 0; i < 9; i++) {
    const x = 74 + i * 13.5;
    s.ellipse(x, 194 + Math.sin(i) * 3, 11, 9, i % 2 ? P.cream : P.creamSh);
  }

  /* ── face ────────────────────────────────────────────────────────── */
  face(s, { blush: false });

  /* ── ears ────────────────────────────────────────────────────────── */
  s.ellipse(78, 126, 9, 13, P.skinSh);
  s.ellipse(178, 126, 9, 13, P.skinSh);

  /* ── eyes behind shades (glint only) ─────────────────────────────── */
  eye(s, -1, { style: 'sharp', iris: P.iris });
  eye(s, 1, { style: 'sharp', iris: P.iris });

  /* ── black pixel shades ──────────────────────────────────────────── */
  s.roundRect(74, 108, 108, 26, 7, P.black);
  s.roundRect(72, 106, 46, 30, 8, P.black);      // left lens
  s.roundRect(138, 106, 46, 30, 8, P.black);     // right lens
  s.roundRect(116, 112, 24, 10, 4, P.black);     // bridge
  // pixel glints
  s.roundRect(84, 112, 9, 6, 2, P.white);
  s.roundRect(150, 112, 9, 6, 2, P.white);
  s.roundRect(98, 118, 5, 4, 1, P.silverSh);
  s.roundRect(164, 118, 5, 4, 1, P.silverSh);

  /* ── moustache + beard ───────────────────────────────────────────── */
  // moustache: two swept lobes
  s.ellipse(112, 154, 20, 11, P.white, { rot: -0.22 });
  s.ellipse(144, 154, 20, 11, P.white, { rot: 0.22 });
  s.ellipse(128, 152, 13, 8, P.white);
  // beard — narrower so the robe reads underneath
  s.ellipse(128, 188, 44, 38, P.white);
  s.ellipse(128, 210, 34, 24, P.white);
  s.ellipse(128, 224, 22, 16, P.white);
  // beard strand lines (subtle)
  for (let i = 0; i < 5; i++) {
    const x = 110 + i * 9;
    s.curve(x, 180, x + (i % 2 ? 4 : -4), 204, x - 2 + i, 228, P.creamSh, 2);
  }
  // mouth hint under moustache
  s.ellipse(128, 168, 10, 5, P.mouth);

  /* ── front hair: swept-back crown + strands ──────────────────────── */
  s.ellipse(128, 78, 60, 42, P.silver);
  s.ellipse(98, 68, 26, 24, P.silver);
  s.ellipse(158, 68, 26, 24, P.silver);
  // swept strands — short, angled, all ON the crown silhouette
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x0 = 104 + t * 48;
    s.curve(x0, 66, x0 + 6, 52, x0 + 16, 40, i % 2 ? P.silver : P.silverSh, 4);
  }
  // sideburn tufts
  s.ellipse(78, 152, 13, 28, P.silver, { rot: -0.1 });
  s.ellipse(178, 152, 13, 28, P.silver, { rot: 0.1 });

  /* ── gold chain + scales medallion ───────────────────────────────── */
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const a = Math.PI * (0.1 + t * 0.8);
    const x = 128 + Math.cos(a) * 34, y = 196 + Math.sin(a) * 22;
    s.ellipse(x, y, 3.2, 3.2, P.gold);
  }
  s.ellipse(128, 232, 12, 12, P.gold);
  s.ellipse(128, 232, 8, 8, P.goldL);
  s.line(121, 229, 135, 229, P.goldD, 2.2);
  s.ellipse(122, 234, 3.6, 3.6, P.goldD);
  s.ellipse(134, 234, 3.6, 3.6, P.goldD);

  /* ── gavel, held by the right hand at rest ───────────────────────── */
  s.line(198, 262, 214, 190, P.brownL, 10);          // shaft
  s.roundRect(188, 150, 46, 28, 9, P.brownL);        // head
  s.roundRect(184, 154, 10, 20, 4, P.gold);
  s.roundRect(228, 154, 10, 20, 4, P.gold);
  s.ellipse(211, 168, 11, 5, P.brown);               // head shading

  /* ── robe trim ───────────────────────────────────────────────────── */
  s.line(128, 210, 128, 292, P.gold, 4);
  s.roundRect(98, 286, 60, 9, 4, P.gold);

  s.outline(O, 2.2);
  return s.done();
}

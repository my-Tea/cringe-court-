// Judge Gavel.exe — v2. Shape-first, cel-shaded.
//
// Design intent (from the character sheet):
//   · Enormous silver mane that reads as ONE silhouette with notches, not blobs
//   · Black pixel shades as the focal point — high contrast, dead centre
//   · Beard with vertical strand grooves, tapering to a point
//   · Burgundy robe with gold trim, fur mantle at the shoulders
//   · Oversized gavel, big enough to dwarf his head
import { Pen, shade, mix } from './pen.mjs';

const O = '#241A22';

const C = {
  skin: '#F7D3B6', skinSh: '#E2AE8C', skinDp: '#C58A66',
  hair: '#E4E1DA', hairSh: '#C2BFB7', hairDk: '#9A968E',
  beard: '#FBF7EF', beardSh: '#DFD8CB',
  robe: '#6E1B2A', robeSh: '#4A1020', robeHi: '#8E2A3C',
  gold: '#D9A046', goldSh: '#A97C2A', goldHi: '#F6C75B',
  cream: '#FFF6E4',
  ink: '#1A1620', white: '#FFFFFF',
  mouth: '#8E3B42',
};

const W = 256, H = 320;
const HEAD = { cx: 128, cy: 116, rx: 50, ry: 52 };

export function judgeV2() {
  const p = new Pen(W, H);

  /* ── 1. BEHIND: mane silhouette ───────────────────────────────────── */
  // One big shape, then carve notches with darker background-coloured wedges.
  p.shape(128, 118, (a) => {
    // wide at the sides, squared off at the shoulders — not a circle
    const base = 74;
    const side = Math.pow(Math.abs(Math.cos(a)), 0.7);
    const top = Math.pow(Math.max(0, -Math.sin(a)), 0.9);
    const bot = Math.pow(Math.max(0, Math.sin(a)), 1.6);
    return base * (0.78 + 0.30 * side) * (1 - 0.30 * bot) * (1 + 0.10 * top);
  }, (x, y) => {
    const t = (x - 128) / 74;
    return t > 0.18 ? C.hairSh : C.hair;
  });

  /* ── 2. BODY: robe ────────────────────────────────────────────────── */
  // torso with a flared hem
  p.poly([
    [128 - 46, 196], [128 + 46, 196],
    [128 + 60, 286], [128 - 60, 286],
  ], C.robe);
  // cel shadow on the right side of the robe
  p.poly([
    [128 + 12, 196], [128 + 46, 196], [128 + 60, 286], [128 + 18, 286],
  ], C.robeSh);
  // arms
  for (const sx of [-1, 1]) {
    p.ellipse(128 + sx * 58, 226, 15, 34, sx < 0 ? C.robe : C.robeSh, { shadeCol: C.robeSh, rot: sx * 0.06 });
    p.ellipse(128 + sx * 62, 262, 12, 12, C.skin, { shadeCol: C.skinSh });
  }
  // robe centre trim
  p.roundRect(126, 200, 5, 84, 2, C.gold);
  p.roundRect(104, 280, 48, 7, 3, C.gold);
  // hem shadow
  p.roundRect(70, 276, 116, 8, 3, C.robeSh);

  /* ── 3. FACE ──────────────────────────────────────────────────────── */
  p.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, C.skin, { shadeCol: C.skinSh });
  // jaw/chin shading
  p.ellipse(HEAD.cx, HEAD.cy + 34, HEAD.rx - 10, 16, C.skinSh);
  // ears
  for (const sx of [-1, 1]) p.ellipse(HEAD.cx + sx * 50, HEAD.cy + 12, 9, 13, C.skinSh);
  // blush
  p.ellipse(HEAD.cx - 34, HEAD.cy + 22, 9, 5, '#F3A0A6');
  p.ellipse(HEAD.cx + 34, HEAD.cy + 22, 9, 5, '#F3A0A6');
  // nose
  p.stroke(130, 146, 133, 152, C.skinDp, 2.2);

  /* ── 4. EYES (under the shades — only the lower lid + glint show) ── */
  for (const sx of [-1, 1]) {
    const ex = 128 + sx * 22, ey = 122;
    p.ellipse(ex, ey + 3, 13, 10, C.white);
    p.ellipse(ex, ey + 4, 8, 8, '#4A342C');
    p.ellipse(ex, ey + 5, 4, 5, C.ink);
    p.dot(ex - sx * 3, ey, 2.4, C.white);
  }

  /* ── 5. SHADES — the focal point ──────────────────────────────────── */
  // thick frame, deep black lenses, two hard glints
  p.roundRect(70, 106, 52, 32, 6, C.ink);
  p.roundRect(134, 106, 52, 32, 6, C.ink);
  p.roundRect(120, 112, 16, 10, 3, C.ink);            // bridge
  p.stroke(70, 116, 56, 108, C.ink, 5);               // temple arms
  p.stroke(186, 116, 200, 108, C.ink, 5);
  // glints (2 per lens, asymmetric = more life)
  p.roundRect(80, 112, 11, 7, 2, C.white);
  p.roundRect(96, 120, 6, 5, 1, C.hairSh);
  p.roundRect(146, 112, 11, 7, 2, C.white);
  p.roundRect(162, 120, 6, 5, 1, C.hairSh);

  /* ── 6. MOUSTACHE ─────────────────────────────────────────────────── */
  p.lock(104, 160, 118, 150, 130, 158, 26, C.beard);
  p.lock(152, 160, 138, 150, 126, 158, 26, C.beard);
  p.ellipse(128, 156, 14, 8, C.beard);
  p.ellipse(128, 160, 10, 4, C.mouth);                // mouth under the tache

  /* ── 7. BEARD — tapered, with strand grooves ──────────────────────── */
  p.poly([
    [86, 150], [170, 150], [166, 196], [150, 226],
    [128, 244], [106, 226], [90, 196],
  ], C.beard);
  // shadow on the right half
  p.poly([
    [128, 150], [170, 150], [166, 196], [150, 226], [128, 244],
  ], C.beardSh);
  // strand grooves — subtle, tucked inside the beard mass
  for (let i = 0; i < 5; i++) {
    const x = 108 + i * 9;
    p.stroke(x, 172, x + (i % 2 ? 2 : -2), 206, C.beardSh, 1.8);
  }
  // front edge accents
  p.stroke(94, 192, 112, 222, C.beardSh, 2);
  p.stroke(162, 192, 144, 222, C.beardSh, 2);

  /* ── 8. FRONT HAIR — locks with real volume ───────────────────────── */
  // crown mass
  p.ellipse(128, 74, 58, 34, C.hair, { shadeCol: C.hairSh });
  // 6 swept locks falling to the OUTER edges of the forehead, so the shades
  // (the focal point) stay unobstructed
  const locks = [
    [76, 70, 66, 44, 58, 74, 16],
    [88, 62, 84, 38, 76, 58, 15],
    [150, 70, 168, 44, 178, 76, 16],
    [160, 62, 176, 38, 186, 58, 15],
    [110, 56, 118, 32, 132, 52, 15],
    [140, 54, 148, 30, 158, 52, 14],
  ];
  for (const [x0, y0, cx, cy, x1, y1, w] of locks) {
    p.lock(x0, y0, cx, cy, x1, y1, w, C.hair);
  }
  // lock shadows for depth
  for (const [x0, y0, cx, cy, x1, y1, w] of locks) {
    p.lock(x0 + 2, y0 + 4, cx + 2, cy + 5, x1, y1, w * 0.38, C.hairSh);
  }
  // sideburns tying hair into beard
  for (const sx of [-1, 1]) {
    p.lock(128 + sx * 56, 92, 128 + sx * 66, 130, 128 + sx * 54, 160, 22, C.hair);
  }

  /* ── 9. FUR MANTLE (an arc, NOT a disc) ───────────────────────────── */
  // A full shape() here produced a white sunburst over the chest. A mantle is a
  // band across the shoulders — draw it as two shoulder pads + a low arc.
  for (const sx of [-1, 1]) {
    p.ellipse(128 + sx * 44, 198, 30, 22, C.cream, { shadeCol: C.beardSh });
  }
  p.ellipse(128, 206, 34, 16, C.cream, { shadeCol: C.beardSh });
  // fur texture: short ticks along the band
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (0.08 + (i / 13) * 0.84);
    const x = 128 - Math.cos(a) * 54, y = 200 + Math.sin(a) * 16;
    p.stroke(x, y, x, y + 5, C.beardSh, 2.2);
  }

  /* ── 10. GAVEL — oversized, held right ────────────────────────────── */
  p.stroke(196, 268, 212, 182, C.hairDk, 11);          // shaft
  p.roundRect(190, 182, 8, 22, 3, C.gold);
  // head — big block
  p.roundRect(176, 142, 62, 34, 8, '#8E5A34', { shadeCol: '#6B4226' });
  p.roundRect(170, 148, 12, 22, 4, C.gold, { shadeCol: C.goldSh });
  p.roundRect(232, 148, 12, 22, 4, C.gold, { shadeCol: C.goldSh });
  p.roundRect(186, 150, 44, 8, 3, '#A96E42');          // highlight band

  /* ── 11. CHAIN + SCALES MEDALLION ─────────────────────────────────── */
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const a = Math.PI * (0.05 + t * 0.9);
    p.dot(128 + Math.cos(a) * 38, 196 + Math.sin(a) * 24, 3.4, C.gold);
  }
  p.ellipse(128, 226, 14, 14, C.gold, { shadeCol: C.goldSh });
  p.ellipse(128, 226, 9, 9, C.goldHi);
  p.roundRect(120, 223, 16, 3, 1, C.goldSh);
  p.ellipse(121, 230, 4, 4, C.goldSh);
  p.ellipse(135, 230, 4, 4, C.goldSh);

  p.outline(O, 2.4);
  return p.done();
}

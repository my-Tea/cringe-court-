// PLAYER avatar — layered 2D sprite parts the user can equip.
//
// Unlike the earlier rejected placeholder, these are real drawn parts: same
// engine as the Judge, proper outline, anime eyes, real hair volumes.
// Every part is drawn on the SAME 256x320 canvas so they stack with no offset.
import { Sprite } from './sprite2d.mjs';
import { P, body, eye, brow, mouth, nose, face, O, INK, A } from './sprite-parts.mjs';

/* ══════════════════════ LAYER ORDER (bottom → top) ════════════════════
   0 hairBack   1 body   2 clothing   3 face   4 eyes   5 brows
   6 expression 7 hairFront   8 accessory
   hairBack MUST be first: it is a full head-sized mass and buries the face.
   ═══════════════════════════════════════════════════════════════════════ */

export const PLAYER = {
  body: ['masculine', 'feminine', 'androgynous'],
  skin: ['#FBE0C8', '#F5D2B4', '#E8C4A8', '#C49A7A', '#A87B5C', '#7C5842'],
  eyes: ['round', 'sharp', 'sleepy', 'sparkle'],
  hair: ['short', 'long', 'ponytail', 'buns', 'messy', 'buzz', 'afro', 'spiky'],
  hairColor: ['#1A1A1A', '#6B4226', '#E6D08A', '#F08CBE', '#9B6BE0', '#5FD3E0', '#DCD9D3'],
  clothing: ['tee', 'hoodie', 'shirt', 'suit', 'jacket', 'robe', 'meme'],
  clothingColor: ['#6E1B2A', '#232A44', '#6B4226', '#9B6BE0', '#D9A046', '#FFF6E4', '#3F6FB5'],
  accessory: ['none', 'glasses', 'shades', 'cap', 'headphones', 'chain', 'earrings', 'mask'],
  expression: ['neutral', 'happy', 'angry', 'shocked', 'laughing', 'crying', 'confused', 'smug'],
};

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b2 = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0')}`;
};

/* ── 0. HAIR BACK ────────────────────────────────────────────────────── */
export function hairBack(style, col) {
  const s = new Sprite(256, 320);
  const dk = shade(col, 0.82);
  if (style === 'long') {
    s.ellipse(128, 150, 74, 96, dk);
    s.ellipse(128, 108, 68, 62, col);
  } else if (style === 'ponytail') {
    s.ellipse(128, 110, 66, 60, col);
    s.ellipse(186, 150, 22, 54, dk, { rot: 0.35 });
    s.ellipse(192, 196, 15, 26, dk, { rot: 0.5 });
  } else if (style === 'buns') {
    s.ellipse(128, 110, 66, 60, col);
    s.ellipse(76, 74, 26, 26, dk);
    s.ellipse(180, 74, 26, 26, dk);
  } else if (style === 'afro') {
    s.ellipse(128, 106, 84, 78, col);
    s.ellipse(128, 112, 80, 74, dk);
    s.ellipse(128, 104, 78, 72, col);
  } else if (style === 'messy' || style === 'spiky') {
    s.ellipse(128, 108, 70, 62, col);
    s.ellipse(128, 112, 66, 58, dk);
  } else {
    s.ellipse(128, 108, 64, 58, dk);
  }
  return s;
}

/* ── 1. BODY ─────────────────────────────────────────────────────────── */
export function bodyLayer(kind, skin) {
  const s = new Sprite(256, 320);
  const sh = kind === 'masculine' ? 46 : kind === 'feminine' ? 38 : 42;
  const hip = kind === 'feminine' ? 21 : 18;
  const lc = shade(skin, 0.9);
  // arms first so the torso overlaps them (arms behind body, not inside it)
  for (const sx of [-1, 1]) {
    const ax = 128 + sx * (sh + 11);
    s.ellipse(ax, A.shY + 28, 12, 30, shade(skin, 0.95), { rot: sx * 0.08 });
    s.ellipse(ax + sx * 2, A.shY + 60, 10, 10, skin);
  }
  // legs
  for (const sx of [-1, 1]) {
    const x = 128 + sx * hip;
    s.roundRect(x - 11, A.hipY - 4, 22, 56, 10, lc);
    s.roundRect(x - 14, A.hipY + 42, 28, 17, 8, INK);
  }
  // torso
  s.roundRect(128 - sh, A.shY - 10, sh * 2, A.hipY - A.shY + 26, 20, skin);
  // neck
  s.roundRect(119, A.neckY - 14, 18, 22, 7, shade(skin, 0.88));
  return s;
}

/* ── 2. CLOTHING ─────────────────────────────────────────────────────── */
export function clothingLayer(item, col, kind = 'androgynous') {
  const s = new Sprite(256, 320);
  const sh = kind === 'masculine' ? 46 : kind === 'feminine' ? 38 : 42;
  const dk = shade(col, 0.8), lt = shade(col, 1.18);
  const top = A.shY - 10, bot = A.hipY + 14;
  // sleeves sit OUTSIDE the torso so the arms read
  const sleeves = () => {
    for (const sx of [-1, 1]) s.ellipse(128 + sx * (sh + 10), A.shY + 24, 13, 26, col, { rot: sx * 0.08 });
  };

  if (item === 'tee') {
    s.roundRect(128 - sh, top, sh * 2, bot - top, 20, col);
    sleeves();
    s.ellipse(128, top + 4, 20, 9, dk);                       // collar
  } else if (item === 'hoodie') {
    s.roundRect(128 - sh - 2, top, (sh + 2) * 2, bot - top, 22, col);
    for (const sx of [-1, 1]) s.ellipse(128 + sx * (sh + 11), A.shY + 26, 14, 29, col, { rot: sx * 0.08 });
    s.ellipse(128, top + 2, 32, 17, dk);                       // hood
    s.roundRect(110, top + 30, 36, 38, 8, dk);                 // pocket
    s.line(122, top + 8, 122, top + 30, lt, 3.2);              // drawstrings
    s.line(134, top + 8, 134, top + 30, lt, 3.2);
    s.ellipse(122, top + 32, 3, 3, P.white);
    s.ellipse(134, top + 32, 3, 3, P.white);
  } else if (item === 'shirt') {
    s.roundRect(128 - sh, top, sh * 2, bot - top, 20, col);
    for (const sx of [-1, 1]) s.ellipse(128 + sx * (sh + 5), A.shY + 20, 15, 22, col, { rot: sx * 0.09 });
    s.poly([[128 - 22, top + 2], [128 + 22, top + 2], [128, top + 26]], dk);
    for (let i = 0; i < 4; i++) s.ellipse(128, top + 34 + i * 14, 2.6, 2.6, dk);
  } else if (item === 'suit') {
    s.roundRect(128 - sh, top, sh * 2, bot - top, 18, col);
    for (const sx of [-1, 1]) s.ellipse(128 + sx * (sh + 5), A.shY + 22, 15, 24, col, { rot: sx * 0.09 });
    s.poly([[128 - 20, top + 2], [128 - 4, top + 2], [128, top + 34], [128 - 26, top + 20]], dk);
    s.poly([[128 + 20, top + 2], [128 + 4, top + 2], [128, top + 34], [128 + 26, top + 20]], dk);
    s.roundRect(120, top + 2, 16, 36, 5, P.white);             // shirt
    s.roundRect(124, top + 4, 8, 30, 3, P.pinkD);              // tie
    s.poly([[124, top + 4], [132, top + 4], [128, top - 4]], P.pinkD);
  } else if (item === 'jacket') {
    s.roundRect(128 - sh - 5, top - 2, (sh + 5) * 2, bot - top + 6, 24, col);
    for (const sx of [-1, 1]) s.ellipse(128 + sx * (sh + 8), A.shY + 26, 17, 32, col, { rot: sx * 0.09 });
    s.roundRect(126, top, 6, bot - top, 2, dk);                // open front
    for (let i = 0; i < 3; i++) s.ellipse(112, top + 30 + i * 18, 4, 4, lt);
  } else if (item === 'robe') {
    s.roundRect(128 - sh - 4, top - 4, (sh + 4) * 2, bot - top + 16, 26, col);
    for (const sx of [-1, 1]) s.ellipse(128 + sx * (sh + 6), A.shY + 26, 16, 32, col, { rot: sx * 0.09 });
    s.ellipse(128, top + 2, 32, 16, P.cream);                  // fur collar
    s.line(128, top + 6, 128, bot + 6, P.gold, 4);
    for (let i = 0; i < 4; i++) s.roundRect(112, top + 40 + i * 18, 32, 4, 2, P.gold);
  } else { // meme
    s.roundRect(128 - sh, top, sh * 2, bot - top, 22, col);
    for (const sx of [-1, 1]) s.ellipse(128 + sx * (sh + 5), A.shY + 20, 15, 22, col, { rot: sx * 0.09 });
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      if ((i + j) % 2 === 0) s.roundRect(108 + i * 8, top + 26 + j * 8, 7, 7, 1, lt);
    }
  }
  return s;
}

/* ── 3. FACE ─────────────────────────────────────────────────────────── */
export function faceLayer(skin) {
  const s = new Sprite(256, 320);
  s.ellipse(A.headCx, A.headCy, A.headRx, A.headRy, skin);
  s.ellipse(A.headCx, A.headCy + 32, A.headRx - 8, 18, shade(skin, 0.94));
  s.ellipse(A.headCx - 38, A.headCy + 20, 10, 6, P.blush);
  s.ellipse(A.headCx + 38, A.headCy + 20, 10, 6, P.blush);
  s.ellipse(76, 128, 9, 13, shade(skin, 0.92));   // ears
  s.ellipse(180, 128, 9, 13, shade(skin, 0.92));
  s.line(130, A.mouthY - 14, 133, A.mouthY - 9, shade(skin, 0.82), 2.4); // nose
  return s;
}

/* ── 4. EYES ─────────────────────────────────────────────────────────── */
export function eyesLayer(style) {
  const s = new Sprite(256, 320);
  eye(s, -1, { style });
  eye(s, 1, { style });
  return s;
}

/* ── 5. BROWS ────────────────────────────────────────────────────────── */
export function browsLayer(hairColor, tiltLeft = 0, tiltRight = 0) {
  const s = new Sprite(256, 320);
  brow(s, -1, tiltLeft, shade(hairColor, 0.7));
  brow(s, 1, tiltRight, shade(hairColor, 0.7));
  return s;
}

/* ── 6. EXPRESSION (mouth + brow override) ───────────────────────────── */
export function expressionLayer(id) {
  const s = new Sprite(256, 320);
  if (id === 'happy') { mouth(s, 'smile'); s.ellipse(92, 150, 8, 4, P.blush); s.ellipse(164, 150, 8, 4, P.blush); }
  else if (id === 'laughing') { mouth(s, 'grin'); s.line(76, 108, 100, 102, INK, 3.6); s.line(156, 102, 180, 108, INK, 3.6); }
  else if (id === 'angry') { mouth(s, 'shout'); s.line(78, 96, 104, 104, INK, 4.4); s.line(152, 104, 178, 96, INK, 4.4); }
  else if (id === 'shocked') { s.ellipse(128, A.mouthY + 6, 12, 14, P.mouth); s.ellipse(128, A.mouthY + 12, 7, 5, P.tongue); }
  else if (id === 'crying') {
    mouth(s, 'frown');
    for (let i = 0; i < 6; i++) { s.ellipse(94 + 2, 132 + i * 7, 4, 5, '#8ED8F0'); s.ellipse(162 - 2, 132 + i * 7, 4, 5, '#8ED8F0'); }
  }
  else if (id === 'confused') { mouth(s, 'frown'); s.ellipse(186, 88, 8, 8, INK); s.ellipse(186, 88, 5, 5, P.white); }
  else if (id === 'smug') { mouth(s, 'smirk'); s.line(78, 100, 102, 106, INK, 3.6); s.line(152, 104, 176, 98, INK, 3.6); }
  else { mouth(s, 'neutral'); }
  return s;
}

/* ── 7. HAIR FRONT ───────────────────────────────────────────────────── */
export function hairFront(style, col) {
  const s = new Sprite(256, 320);
  const dk = shade(col, 0.84), lt = shade(col, 1.15);
  const fringe = (n, y, ry, rxo) => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = 128 - 46 + t * 92;
      s.ellipse(x, y - Math.abs(t - 0.5) * 10, rxo, ry, i % 2 ? col : dk);
    }
  };
  if (style === 'buzz') {
    s.ellipse(128, 76, 56, 30, col);
    s.ellipse(128, 82, 54, 26, dk);
  } else if (style === 'spiky') {
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const a = -Math.PI + t * Math.PI;
      const x = 128 + Math.cos(a) * 50, y = 84 + Math.sin(a) * 34;
      s.ellipse(x, y, 17, 20, i % 2 ? col : dk);
    }
    fringe(5, 80, 13, 12);
  } else if (style === 'messy') {
    s.ellipse(128, 78, 58, 36, col);
    fringe(7, 82, 14, 11);
    s.ellipse(150, 46, 11, 16, dk);        // cowlick
    s.ellipse(158, 34, 7, 11, dk);
    s.ellipse(96, 52, 12, 14, dk);
  } else if (style === 'afro') {
    s.ellipse(128, 72, 64, 44, col);
    s.ellipse(128, 78, 60, 38, dk);
    fringe(4, 84, 12, 13);
  } else if (style === 'buns') {
    s.ellipse(128, 80, 56, 34, col);
    fringe(5, 82, 13, 12);
    s.ellipse(76, 74, 24, 24, dk); s.ellipse(180, 74, 24, 24, dk);
  } else if (style === 'ponytail') {
    s.ellipse(128, 80, 56, 34, col);
    fringe(6, 82, 13, 12);
    s.ellipse(96, 62, 20, 16, lt);
  } else if (style === 'long') {
    s.ellipse(128, 78, 58, 36, col);
    fringe(6, 82, 14, 12);
    s.ellipse(74, 150, 14, 46, col, { rot: -0.1 });   // face-framing locks
    s.ellipse(182, 150, 14, 46, col, { rot: 0.1 });
  } else {
    s.ellipse(128, 80, 54, 32, col);
    fringe(5, 82, 13, 13);
  }
  return s;
}

/* ── 8. ACCESSORY ────────────────────────────────────────────────────── */
export function accessoryLayer(item, col = '#1A1620') {
  const s = new Sprite(256, 320);
  if (item === 'glasses') {
    for (const sx of [-1, 1]) {
      const cx = 128 + sx * A.eyeDx;
      for (let a = 0; a < 360; a += 9) {
        const r = (a * Math.PI) / 180;
        s.ellipse(cx + Math.cos(r) * 17, A.eyeY + Math.sin(r) * 16, 2.2, 2.2, INK);
      }
    }
    s.roundRect(120, A.eyeY - 2, 16, 4, 2, INK);
    s.line(72, A.eyeY - 6, 56, A.eyeY - 12, INK, 3);
    s.line(184, A.eyeY - 6, 200, A.eyeY - 12, INK, 3);
  } else if (item === 'shades') {
    s.roundRect(74, A.eyeY - 18, 46, 30, 8, INK);
    s.roundRect(136, A.eyeY - 18, 46, 30, 8, INK);
    s.roundRect(116, A.eyeY - 12, 24, 9, 4, INK);
    s.roundRect(84, A.eyeY - 14, 9, 6, 2, P.white);
    s.roundRect(146, A.eyeY - 14, 9, 6, 2, P.white);
  } else if (item === 'cap') {
    s.ellipse(128, 76, 58, 34, col);
    s.roundRect(128 - 60, 76, 120, 13, 6, shade(col, 0.82));
    s.roundRect(150, 78, 40, 10, 5, shade(col, 0.72));
    s.ellipse(128, 62, 10, 10, shade(col, 1.2));
  } else if (item === 'headphones') {
    for (const sx of [-1, 1]) {
      s.ellipse(128 + sx * 58, 124, 15, 22, INK);
      s.ellipse(128 + sx * 58, 124, 9, 15, col);
    }
    for (let a = -Math.PI; a <= 0; a += 0.04) {
      s.ellipse(128 + Math.cos(a) * 62, 116 + Math.sin(a) * 50, 5, 5, INK);
    }
  } else if (item === 'chain') {
    for (let i = 0; i < 16; i++) {
      const a = 0.15 + (i / 15) * 1.1;
      s.ellipse(128 + Math.cos(a) * 38, 200 + Math.sin(a) * 26, 3.6, 3.6, P.gold);
    }
    s.ellipse(128, 226, 11, 11, P.gold);
    s.ellipse(128, 226, 7, 7, P.goldL);
  } else if (item === 'earrings') {
    s.ellipse(76, 146, 4, 7, P.gold); s.ellipse(180, 146, 4, 7, P.gold);
    s.ellipse(76, 156, 5, 5, P.goldL); s.ellipse(180, 156, 5, 5, P.goldL);
  } else if (item === 'mask') {
    s.roundRect(88, A.mouthY - 12, 80, 30, 12, col);
    s.roundRect(88, A.mouthY - 12, 80, 6, 3, shade(col, 0.8));
  }
  return s;
}

/* ══════════════════════ COMPOSITOR ═══════════════════════════════════ */
export const LAYER_ORDER = [
  'hairBack', 'body', 'clothing', 'face', 'eyes', 'brows',
  'expression', 'hairFront', 'accessory',
];

export function composePlayer(cfg = {}) {
  const {
    body: kind = 'androgynous', skin = P.skin, eyes = 'round',
    hair = 'short', hairColor = '#6B4226', clothing = 'tee',
    clothingColor = '#6E1B2A', accessory = 'none', expression = 'neutral',
  } = cfg;

  const parts = {
    hairBack: hairBack(hair, hairColor),
    body: bodyLayer(kind, skin),
    clothing: clothingLayer(clothing, clothingColor, kind),
    face: faceLayer(skin),
    eyes: eyesLayer(eyes),
    brows: browsLayer(hairColor),
    expression: expressionLayer(expression),
    hairFront: hairFront(hair, hairColor),
    accessory: accessoryLayer(accessory, clothingColor),
  };

  // composite onto one sprite, then outline the union so layering has no seams
  const out = new Sprite(256, 320);
  for (const key of LAYER_ORDER) {
    const layer = parts[key].c;               // supersampled buffer
    for (let y = 0; y < layer.h; y++) for (let x = 0; x < layer.w; x++) {
      const p = layer.get(x, y);
      if (p[3] > 8) out.c.set(x, y, p);
    }
  }
  out.outline(O, 2.1);
  return out.done();
}

/** Render every option in one category onto a sheet. */
export function categorySheet(category, values, outFile, cell = 150) {
  const base = {
    body: 'androgynous', skin: P.skin, eyes: 'round', hair: 'short',
    hairColor: '#6B4226', clothing: 'tee', clothingColor: '#6E1B2A',
    accessory: 'none', expression: 'neutral',
  };
  const field = { body: 'body', skin: 'skin', eyes: 'eyes', hair: 'hair',
    hairColor: 'hairColor', clothing: 'clothing', clothingColor: 'clothingColor',
    accessory: 'accessory', expression: 'expression' }[category];
  const cols = Math.min(values.length, 4);
  const rows = Math.ceil(values.length / cols);
  const sheet = new Sprite(cols * cell, rows * cell);
  sheet.c.fill([24, 20, 26, 255]);
  values.forEach((v, i) => {
    const img = composePlayer({ ...base, [field]: v });
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    for (let py = 0; py < img.h; py++) for (let px = 0; px < img.w; px++) {
      const p = img.get(px, py);
      if (p[3] > 0) sheet.c.set(x + Math.round(px * (cell / img.w)), y + Math.round(py * (cell / img.h)), p);
    }
  });
  return sheet.done().save(outFile);
}

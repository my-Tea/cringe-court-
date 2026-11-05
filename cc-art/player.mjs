// Player avatar layered compositor — the working preview required by the spec.
// Proves the layer stack before any character art exists: it synthesises
// placeholder art procedurally so the ORDER and ANCHORS are testable today.
import { Canvas, parseColor } from './core.mjs';
import { MAT as M } from './palette.mjs';
import fs from 'node:fs';

/** Anchor contract — every layer aligns to these. See CHARACTER-SPEC.md §6.4. */
export const CANVAS = { w: 256, h: 256 };
export const ANCHORS = {
  head: [128, 66], eye: 69, neck: [128, 116],
  shoulderL: [84, 125], shoulderR: [172, 125],
  hip: [128, 186], foot: 235,
};

export const PLAYER_LIBRARY = {
  gender: ['masculine', 'feminine', 'androgynous'],
  skin: ['#F5D5BE', '#E8C4A8', '#C49A7A', '#A87B5C', '#7C5842', '#5A3D2E'],
  face: ['round', 'angular', 'long'],
  eyes: ['round', 'sharp', 'sleepy', 'sparkle'],
  hairstyle: ['short', 'long', 'ponytail', 'buns', 'messy', 'buzz', 'afro', 'spiky'],
  hairColor: ['#1A1A1A', '#6B4226', '#E6D08A', '#FF9AC6', '#9B6BE0', '#6BD6D6', '#DCDCDC'],
  clothing: ['tee', 'hoodie', 'shirt', 'suit', 'jacket', 'robe', 'meme'],
  clothingColor: ['#5C1A26', '#2E5F73', '#4A3A32', '#9B6BE0', '#D9A046', '#FFF9ED'],
  accessory: ['glasses', 'headphones', 'cap', 'chain', 'earrings', 'mask', 'shades'],
  expression: ['neutral', 'happy', 'angry', 'shocked', 'laughing', 'crying', 'confused', 'smug'],
};

// ── shape helpers ────────────────────────────────────────────────────────
const ell = (c, cx, cy, rx, ry, col) => {
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    for (let x = -w; x <= w; x++) c.set(cx + x, cy + y, col);
  }
};
const rrect = (c, x, y, w, h, r, col) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = Math.min(i, w - 1 - i), dy = Math.min(j, h - 1 - j);
    if (dx < r && dy < r && (r - dx) ** 2 + (r - dy) ** 2 > r * r) continue;
    c.set(x + i, y + j, col);
  }
};
const shade = (hex, mul) => {
  const [r, g, b] = parseColor(hex);
  return [Math.min(255, r * mul) | 0, Math.min(255, g * mul) | 0, Math.min(255, b * mul) | 0];
};

// ── layer painters ───────────────────────────────────────────────────────
/** order 0 — base body. Gender only changes shoulder/hip width + jaw. */
function baseBody(gender, skin) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const [hx, hy] = ANCHORS.head;
  const wide = gender === 'masculine' ? 6 : gender === 'feminine' ? -3 : 0;
  const hipW = gender === 'feminine' ? 3 : gender === 'masculine' ? -1 : 0;

  // legs
  rrect(c, 108 - hipW, 186, 16, 46, 5, shade(skin, 0.86));
  rrect(c, 132 + hipW, 186, 16, 46, 5, shade(skin, 0.86));
  // shoes
  rrect(c, 104 - hipW, 230, 22, 8, 3, '#2A2028');
  rrect(c, 130 + hipW, 230, 22, 8, 3, '#2A2028');
  // torso
  rrect(c, 104 - wide - hipW, 116, 48 + wide * 2 + hipW * 2, 74, 14, skin);
  // arms
  rrect(c, 84 - wide, 122, 15, 62, 7, shade(skin, 0.94));
  rrect(c, 157 + wide, 122, 15, 62, 7, shade(skin, 0.94));
  // hands
  ell(c, 91 - wide, 188, 8, 8, shade(skin, 0.98));
  ell(c, 164 + wide, 188, 8, 8, shade(skin, 0.98));
  // neck
  rrect(c, 122, 108, 12, 12, 3, shade(skin, 0.9));
  // head
  const rx = gender === 'masculine' ? 34 : gender === 'feminine' ? 32 : 33;
  ell(c, hx, hy, rx, 34, skin);
  return c;
}

/** order 1 — face shape: jaw width + chin length. */
function faceLayer(shape, skin) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const [hx, hy] = ANCHORS.head;
  if (shape === 'round') ell(c, hx, hy + 4, 33, 30, skin);
  else if (shape === 'angular') {
    for (let y = -30; y <= 30; y++) {
      const w = y < 6 ? 32 - Math.abs(y) * 0.1 : 30 - (y - 6) * 0.9;
      for (let x = -w; x <= w; x++) c.set(hx + x, hy + 4 + y, skin);
    }
  } else ell(c, hx, hy + 7, 30, 36, skin);
  // ear hints
  ell(c, hx - 33, hy + 2, 5, 8, shade(skin, 0.92));
  ell(c, hx + 33, hy + 2, 5, 8, shade(skin, 0.92));
  return c;
}

/** order 2 — eyes. Drawn on the eye line anchor. */
function eyeLayer(style, hairCol) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const [hx] = ANCHORS.head;
  const ey = ANCHORS.eye;
  const iris = '#3A2E28';
  for (const sx of [-1, 1]) {
    const ex = hx + sx * 13;
    if (style === 'sharp') {
      for (let i = 0; i < 4; i++) c.set(ex - 4 + i, ey + 2 - i, '#FFFFFF');
      for (let i = 0; i < 4; i++) c.set(ex + i, ey - 1 + i, '#FFFFFF');
      c.rect(ex - 2, ey - 2, 5, 6, iris);
    } else if (style === 'sleepy') {
      c.rect(ex - 6, ey + 1, 13, 3, '#FFFFFF');
      c.rect(ex - 3, ey + 1, 7, 3, iris);
      c.rect(ex - 7, ey - 1, 15, 2, '#2A2028');
    } else if (style === 'sparkle') {
      ell(c, ex, ey + 1, 6, 7, '#FFFFFF');
      ell(c, ex, ey + 2, 4, 5, iris);
      c.set(ex - 2, ey - 1, '#FFFFFF');
      c.set(ex - 1, ey - 1, '#FFFFFF');
      c.set(ex + 2, ey + 4, '#FFFFFF');
    } else {
      ell(c, ex, ey + 1, 6, 7, '#FFFFFF');
      ell(c, ex, ey + 2, 4, 5, iris);
      c.set(ex - 1, ey, '#FFFFFF');
      c.set(ex, ey, '#FFFFFF');
    }
    // upper lash
    c.rect(ex - 6, ey - 6, 13, 2, '#2A2028');
  }
  // brows
  const brow = shade(hairCol, 0.82);
  c.rect(hx - 21, ey - 12, 12, 3, brow);
  c.rect(hx + 9, ey - 12, 12, 3, brow);
  return c;
}

/** order 3 / 5 — hair. back.png sits behind the head, front.png over it. */
function hairBack(style, col) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const [hx, hy] = ANCHORS.head;
  if (style === 'long') ell(c, hx, hy + 26, 40, 52, shade(col, 0.9));
  else if (style === 'ponytail') { ell(c, hx, hy, 36, 36, shade(col, 0.92)); ell(c, hx + 40, hy + 34, 16, 30, shade(col, 0.88)); }
  else if (style === 'buns') { ell(c, hx - 30, hy - 24, 15, 15, shade(col, 0.92)); ell(c, hx + 30, hy - 24, 15, 15, shade(col, 0.92)); ell(c, hx, hy, 36, 36, shade(col, 0.9)); }
  else if (style === 'afro') ell(c, hx, hy - 4, 46, 44, shade(col, 0.9));
  else ell(c, hx, hy - 2, 35, 34, shade(col, 0.94));
  return c;
}

function hairFront(style, col) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const [hx, hy] = ANCHORS.head;
  const fringe = (n) => {
    for (let i = 0; i < n; i++) {
      const x = hx - 30 + i * (60 / n);
      // fringe sits on the FOREHEAD only — never over the eye line
      ell(c, Math.round(x), Math.round(hy - 26 + (i % 2) * 3), 9, 11, col);
    }
  };
  if (style === 'buzz') { rrect(c, hx - 32, hy - 40, 64, 12, 8, col); return c; }
  if (style === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + (i / 6) * Math.PI;
      ell(c, Math.round(hx + Math.cos(a) * 30), Math.round(hy - 22 + Math.sin(a) * 20), 10, 11, col);
    }
    return c;
  }
  if (style === 'messy') { fringe(7); ell(c, hx, hy - 32, 33, 12, col); c.set(hx + 4, hy - 46, col); c.set(hx + 5, hy - 47, col); return c; }
  if (style === 'afro') { ell(c, hx, hy - 26, 42, 24, col); return c; }
  if (style === 'buns') { fringe(6); ell(c, hx, hy - 30, 32, 11, col); return c; }
  if (style === 'ponytail') { fringe(6); ell(c, hx, hy - 30, 33, 12, col); return c; }
  if (style === 'long') { fringe(6); ell(c, hx, hy - 30, 34, 13, col); ell(c, hx - 32, hy + 22, 9, 30, col); ell(c, hx + 32, hy + 22, 9, 30, col); return c; }
  fringe(5); ell(c, hx, hy - 31, 32, 12, col);
  return c;
}

/** order 4 — clothing. Covers the torso and upper legs. */
function clothing(item, col) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const dark = shade(col, 0.78);
  const light = shade(col, 1.16);
  if (item === 'tee') {
    rrect(c, 100, 116, 56, 66, 12, col);
    rrect(c, 86, 120, 15, 26, 7, col); rrect(c, 155, 120, 15, 26, 7, col);
    c.rect(124, 108, 8, 12, shade(col, 0.9));
  } else if (item === 'hoodie') {
    rrect(c, 96, 114, 64, 78, 14, col);
    rrect(c, 84, 118, 17, 60, 8, col); rrect(c, 155, 118, 17, 60, 8, col);
    ell(c, 128, 118, 26, 14, dark);          // hood bunched at neck
    rrect(c, 120, 140, 16, 34, 4, dark);     // pocket
    c.rect(122, 124, 3, 14, light); c.rect(131, 124, 3, 14, light); // drawstrings
  } else if (item === 'shirt') {
    rrect(c, 100, 116, 56, 68, 10, col);
    rrect(c, 86, 120, 15, 56, 7, col); rrect(c, 155, 120, 15, 56, 7, col);
    for (let i = 0; i < 5; i++) c.rect(127, 122 + i * 12, 2, 2, dark);
    ell(c, 128, 112, 12, 8, shade(col, 0.86)); // collar
  } else if (item === 'suit') {
    rrect(c, 98, 114, 60, 76, 8, col);
    rrect(c, 84, 118, 16, 60, 6, col); rrect(c, 156, 118, 16, 60, 6, col);
    for (let s = -1; s <= 1; s += 2) {       // lapels
      for (let i = 0; i < 26; i++) c.rect(128 + s * (6 + i * 0.5), 118 + i, 6, 2, dark);
    }
    c.rect(121, 118, 14, 30, '#FFF9ED');     // shirt
    c.rect(124, 118, 8, 24, '#8E2438');      // tie
    c.rect(126, 116, 4, 3, '#8E2438');
  } else if (item === 'jacket') {
    rrect(c, 92, 112, 72, 84, 12, col);
    rrect(c, 80, 116, 16, 66, 8, col); rrect(c, 160, 116, 16, 66, 8, col);
    c.rect(128, 118, 3, 76, dark);           // open front
    for (let i = 0; i < 3; i++) c.rect(120 + i * 6, 130, 4, 4, light);
  } else if (item === 'robe') {
    rrect(c, 94, 112, 68, 96, 16, col);
    ell(c, 128, 118, 30, 16, '#FAFAFA');     // fur collar
    c.rect(128, 120, 4, 84, shade(col, 0.7));
    for (let i = 0; i < 4; i++) c.rect(112, 150 + i * 16, 32, 3, '#D9A046');
  } else { // meme
    rrect(c, 100, 116, 56, 72, 12, col);
    rrect(c, 86, 120, 16, 54, 8, col); rrect(c, 154, 120, 16, 54, 8, col);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      if (i % 2 === j % 2) c.rect(116 + i * 5, 136 + j * 5, 4, 4, light);
    }
  }
  return c;
}

/** order 6 — accessories. */
function accessory(item, col) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const [hx, hy] = ANCHORS.head;
  const ey = ANCHORS.eye;
  if (item === 'glasses') {
    for (const s of [-1, 1]) {
      const ex = hx + s * 13;
      for (let a = 0; a < 360; a += 12) {
        const r = (a * Math.PI) / 180;
        c.set(Math.round(ex + Math.cos(r) * 10), Math.round(ey + Math.sin(r) * 9), '#2A2028');
      }
    }
    c.rect(hx - 4, ey - 1, 8, 2, '#2A2028');
  } else if (item === 'headphones') {
    for (let a = -Math.PI; a <= 0; a += 0.03) {
      c.set(Math.round(hx + Math.cos(a) * 38), Math.round(hy - 2 + Math.sin(a) * 40), '#2A2028');
    }
    ell(c, hx - 38, hy + 4, 9, 13, '#2A2028');
    ell(c, hx + 38, hy + 4, 9, 13, '#2A2028');
    ell(c, hx + 38, hy + 4, 4, 5, col);
  } else if (item === 'cap') {
    ell(c, hx, hy - 20, 36, 22, col);
    rrect(c, hx - 34, hy - 18, 68, 8, 4, shade(col, 0.8));
    rrect(c, hx + 16, hy - 16, 26, 6, 3, shade(col, 0.7)); // brim
  } else if (item === 'chain') {
    for (let i = 0; i < 24; i++) {
      const a = Math.PI * 0.15 + (i / 23) * Math.PI * 0.7;
      c.set(Math.round(hx + Math.cos(a) * 26), Math.round(126 + Math.sin(a) * 22), '#D9A046');
    }
    ell(c, hx, 148, 7, 9, '#D9A046');
    ell(c, hx, 148, 4, 6, '#F6C75B');
  } else if (item === 'earrings') {
    ell(c, hx - 33, ey + 12, 3, 5, '#D9A046');
    ell(c, hx + 33, ey + 12, 3, 5, '#D9A046');
  } else if (item === 'mask') {
    rrect(c, hx - 26, ey + 4, 52, 22, 8, col);
    c.rect(hx - 20, ey + 8, 40, 2, shade(col, 0.8));
  } else { // shades
    for (const s of [-1, 1]) rrect(c, hx + s * 13 - 11, ey - 5, 22, 11, 3, '#12100F');
    c.rect(hx - 3, ey - 2, 6, 3, '#12100F');
    c.set(hx - 16, ey - 3, '#FFFFFF'); c.set(hx + 12, ey - 3, '#FFFFFF');
  }
  return c;
}

/** expression overlay — brow + mouth only, sits over the face. */
function expressionLayer(id) {
  const c = new Canvas(CANVAS.w, CANVAS.h);
  const [hx, hy] = ANCHORS.head;
  const ey = ANCHORS.eye;
  const ink = '#2A2028';
  const mouthY = hy + 16;
  const brow = (tilt, dy) => {
    for (let i = 0; i < 12; i++) {
      c.rect(hx - 21 + i, ey - 12 + dy + Math.round((i / 11) * tilt), 2, 3, ink);
      c.rect(hx + 9 + i, ey - 12 + dy - Math.round((i / 11) * tilt), 2, 3, ink);
    }
  };
  if (id === 'happy') { brow(-1, -2); ell(c, hx, mouthY, 10, 6, ink); }
  else if (id === 'laughing') { brow(-2, -3); ell(c, hx, mouthY + 1, 13, 9, ink); ell(c, hx, mouthY + 4, 8, 4, '#C0504F'); }
  else if (id === 'angry') { brow(4, 2); rrect(c, hx - 9, mouthY - 2, 18, 7, 2, ink); c.rect(hx - 9, mouthY - 2, 18, 2, '#FFF9ED'); }
  else if (id === 'shocked') { brow(-3, -4); ell(c, hx, mouthY + 1, 7, 9, ink); }
  else if (id === 'crying') { brow(-4, -3); for (let i = 0; i < 18; i++) { c.rect(hx - 20, ey + 8 + i, 3, 2, '#7FC4E8'); c.rect(hx + 17, ey + 8 + i, 3, 2, '#7FC4E8'); } rrect(c, hx - 7, mouthY, 14, 6, 2, ink); }
  else if (id === 'confused') { brow(-3, 1); c.rect(hx - 6, mouthY, 12, 3, ink); c.set(hx + 24, hy - 26, ink); c.rect(hx + 23, hy - 24, 2, 4, ink); }
  else if (id === 'smug') { brow(-1, 0); for (let i = 0; i < 12; i++) c.set(hx - 6 + i, mouthY + (i < 6 ? 0 : -2), ink); }
  return c;
}

// ── compositor ───────────────────────────────────────────────────────────
/** Draw order is fixed by CHARACTER-SPEC.md §6.1, with one correction learned
 *  the hard way: `hairBack` must paint FIRST (it is a full head-sized mass and
 *  will bury the face otherwise), and `hairFront` last-but-one so the fringe
 *  overlaps the forehead rather than the eyes. */
export const LAYER_ORDER = [
  'hairBack', 'base', 'face', 'eyes', 'expression', 'clothing', 'hairFront', 'accessory',
];

export function composeAvatar(cfg = {}) {
  const {
    gender = 'androgynous', skin = '#E8C4A8', face = 'round', eyes = 'round',
    hairstyle = 'short', hairColor = '#6B4226', clothing: item = 'tee',
    clothingColor = '#5C2B39', accessory: acc = null, expression = 'neutral',
  } = cfg;

  const layers = {
    base: baseBody(gender, skin),
    face: faceLayer(face, skin),
    expression: expressionLayer(expression),
    eyes: eyeLayer(eyes, hairColor),
    hairBack: hairBack(hairstyle, hairColor),
    clothing: clothing(item, clothingColor),
    hairFront: hairFront(hairstyle, hairColor),
    accessory: acc ? accessory(acc, clothingColor) : new Canvas(CANVAS.w, CANVAS.h),
  };

  const out = new Canvas(CANVAS.w, CANVAS.h);
  for (const key of LAYER_ORDER) out.blit(layers[key], 0, 0);
  return out;
}

export function exportPlayerLibrary(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const made = [];
  const push = (sub, name, cfg) => {
    const c = composeAvatar(cfg);
    c.save(`${outDir}/${sub}/${name}.png`);
    c.scale(2).save(`${outDir}/${sub}/${name}@2x.png`);
    made.push(`${sub}/${name}`);
  };
  // one sheet per category, varying only that category
  for (const g of PLAYER_LIBRARY.gender) push('base', g, { gender: g });
  for (const f of PLAYER_LIBRARY.face) push('faces', f, { face: f });
  for (const e of PLAYER_LIBRARY.eyes) push('eyes', e, { eyes: e });
  for (const h of PLAYER_LIBRARY.hairstyle) push('hairstyles', h, { hairstyle: h });
  for (const s of PLAYER_LIBRARY.skin) push('skin', s.replace('#', ''), { skin: s });
  for (const cl of PLAYER_LIBRARY.clothing) push('clothing', cl, { clothing: cl });
  for (const a of PLAYER_LIBRARY.accessory) push('accessories', a, { accessory: a });
  for (const ex of PLAYER_LIBRARY.expression) push('expressions', ex, { expression: ex });

  fs.writeFileSync(`${outDir}/player-library.json`, JSON.stringify({
    canvas: CANVAS, anchors: ANCHORS, layerOrder: LAYER_ORDER, library: PLAYER_LIBRARY,
  }, null, 2));
  return made;
}

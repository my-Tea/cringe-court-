// Player avatar — voxel, same proportions as the cast (4.5–5 heads tall).
// Built as composable part lists so a user can mix hair / clothing / accessories.
import { H, C, b, pair, head, torso, arms, legs, shadeHex } from './vox-base.mjs';

/* ───────────────────────────── option sets ───────────────────────────── */
export const PLAYER = {
  body: ['masculine', 'feminine', 'androgynous'],
  skin: ['#FBE0C8', '#F5D2B4', '#E8C4A8', '#C49A7A', '#A87B5C', '#7C5842'],
  eyes: ['round', 'sharp', 'sleepy', 'sparkle'],
  hair: ['short', 'long', 'ponytail', 'buns', 'messy', 'buzz', 'afro', 'spiky'],
  hairColor: ['#1A1A1A', '#6B4226', '#E6D08A', '#E87DB4', '#9B6BE0', '#5FD3E0', '#DCD9D3'],
  clothing: ['tee', 'hoodie', 'shirt', 'suit', 'jacket', 'robe', 'meme'],
  clothingColor: ['#6E1B2A', '#232A44', '#6B4226', '#9B6BE0', '#D9A046', '#FFF6E4', '#3F6FB5'],
  accessory: ['none', 'glasses', 'shades', 'cap', 'headphones', 'chain', 'earrings', 'mask'],
  expression: ['neutral', 'happy', 'angry', 'shocked', 'laughing', 'crying', 'confused', 'smug'],
};

const EXPR_MOUTH = {
  neutral: 'neutral', happy: 'grin', angry: 'grit', shocked: 'shout',
  laughing: 'grin', crying: 'frown', confused: 'frown', smug: 'neutral',
};

/* ───────────────────────────── hair builders ─────────────────────────────
   Every hairstyle is a back mass + optional side locks + a fringe that stops
   ABOVE the eye line. Hair is never drawn across the face plane. */
function hair(style, col, bodyKind) {
  const out = [];
  const hw = H.headW;
  const dk = shadeHex(col, 0.82);
  const lt = shadeHex(col, 1.15);
  const fz = -hw;

  // back mass (always) — sits behind the head
  out.push(b([-hw - 1, H.headBot + 8, hw - 4], [hw + 1, H.headTop + 2, hw + 2], dk));

  // crown on top of the skull
  out.push(b([-hw - 0.5, H.headTop - 3, -hw + 1], [hw + 0.5, H.headTop + 2, hw + 1.5], col));

  if (style === 'buzz') {
    out.push(b([-hw, H.headTop - 5, -hw + 1], [hw, H.headTop + 0.5, hw], dk));
    return out;
  }

  if (style === 'long') {
    // side curtains down past the shoulders
    out.push(...pair([-hw - 1.5, H.headBot + 4, -hw + 2], [-hw + 0.5, H.torsoTop - 2, hw], col));
    out.push(...pair([-hw - 1, H.headBot + 2, hw - 3], [-hw + 1, H.headTop + 1, hw + 1], col));
  } else if (style === 'ponytail') {
    out.push(b([hw, H.headBot + 6, hw - 3], [hw + 4, H.torsoTop - 4, hw + 1], dk));
    out.push(b([-hw - 1, H.headBot + 10, hw - 2], [-hw + 1, H.headTop + 1, hw + 1], col));
  } else if (style === 'buns') {
    out.push(...pair([-hw - 2.5, H.headTop - 6, hw - 5], [-hw + 2, H.headTop + 2, hw + 1], dk));
    out.push(...pair([-hw - 2, H.headTop - 5, hw - 4], [-hw + 1, H.headTop + 1, hw], lt));
  } else if (style === 'messy' || style === 'spiky') {
    const spikes = style === 'spiky'
      ? [[-hw - 1, 7, 4], [-hw + 2.5, 9.5, 4], [-1, 11, 4], [hw - 5.5, 9.5, 4], [hw - 2, 7, 3.5]]
      : [[-hw + 1, 5, 5], [-2, 7, 4], [hw - 6, 5.5, 4.5]];
    for (const [x, h2, w2] of spikes) {
      out.push(b([x, H.headTop + 1, -hw + 2], [x + w2, H.headTop + 1 + h2, hw - 2], (x + h2) % 2 ? dk : col));
    }
    if (style === 'messy') out.push(b([2, H.headTop + 10, -3], [4.5, H.headTop + 15, 0], lt)); // cowlick
  } else if (style === 'afro') {
    out.push(b([-hw - 4, H.headBot + 12, -hw - 3], [hw + 4, H.headTop + 4, hw + 3], col));
    out.push(b([-hw - 3, H.headTop + 2, -hw - 2], [hw + 3, H.headTop + 6, hw + 2], lt));
  } else {
    // short
    out.push(...pair([-hw - 1, H.headBot + 12, -hw + 3], [-hw + 1, H.headTop + 1, hw], col));
  }

  // fringe: top of the forehead only — never over the eyes
  const fCount = style === 'afro' ? 4 : 5;
  for (let i = 0; i < fCount; i++) {
    const x = -hw + 1 + i * ((hw * 2 - 2) / fCount);
    out.push(b([x, H.eyeY + 7, fz - 1.2], [x + (hw * 2 - 2) / fCount, H.headTop + 1, fz + 2], i % 2 ? lt : col));
  }
  // sideburn sliver
  out.push(...pair([-hw - 1, H.headBot + 4, fz + 1], [-hw + 1, H.headTop - 2, fz + 4], dk));
  return out;
}

/* ───────────────────────────── accessory builders ───────────────────────── */
function accessory(item, col, bodyKind) {
  const out = [];
  const hw = H.headW;
  const fz = -hw;
  if (item === 'none') return out;

  if (item === 'glasses') {
    for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      out.push(b([ex - 3.4, H.eyeY - 3, fz - 1.6], [ex + 3.4, H.eyeY + 3.6, fz - 1], '#3A2A24'));
      out.push(b([ex - 2.8, H.eyeY - 2.4, fz - 1.8], [ex + 2.8, H.eyeY + 3, fz - 1.2], '#DCE8F4'));
    }
    out.push(b([-3, H.eyeY - 0.6, fz - 1.7], [3, H.eyeY + 0.6, fz - 1.1], '#3A2A24'));
  } else if (item === 'shades') {
    out.push(b([-hw + 1.5, H.eyeY - 3.5, fz - 1.6], [hw - 1.5, H.eyeY + 3, fz - 0.4], C.ink));
    out.push(b([-hw + 2.5, H.eyeY - 2.5, fz - 2.1], [-2.5, H.eyeY + 2, fz - 1.2], C.ink));
    out.push(b([2.5, H.eyeY - 2.5, fz - 2.1], [hw - 2.5, H.eyeY + 2, fz - 1.2], C.ink));
    out.push(b([-3.5, H.eyeY - 2, fz - 2.2], [-1.5, H.eyeY + 0.4, fz - 1.3], C.white));
    out.push(b([4.5, H.eyeY - 2, fz - 2.2], [6.5, H.eyeY + 0.4, fz - 1.3], C.white));
  } else if (item === 'cap') {
    out.push(b([-hw - 2, H.headTop, -hw - 1], [hw + 2, H.headTop + 4, hw + 1], col));
    out.push(b([-hw - 2.4, H.headTop + 4, -hw - 1.4], [hw + 2.4, H.headTop + 5.4, hw + 1.4], shadeHex(col, 1.2)));
    out.push(b([-hw - 2, H.headTop - 1.4, -hw - 4], [hw - 1, H.headTop + 1, -hw + 1], shadeHex(col, 0.75)));
    out.push(b([-2, H.headTop + 1, -hw - 2], [2, H.headTop + 3.4, -hw], shadeHex(col, 1.35)));
  } else if (item === 'headphones') {
    out.push(...pair([-hw - 4.4, H.headBot + 2, -5], [-hw - 1.6, H.headBot + 14, 5], C.ink));
    out.push(...pair([-hw - 4.6, H.headBot + 4, -4], [-hw - 2.6, H.headBot + 12, 4], col));
    out.push(b([-hw - 4, H.headTop - 2, -5], [hw + 4, H.headTop + 1, 5], C.ink));
  } else if (item === 'chain') {
    const td = Math.round(H.torsoW * 0.62);
    for (let i = 0; i < 8; i++) {
      const t = i / 7, a = Math.PI * (0.2 + t * 0.6);
      const x = Math.cos(a) * (H.torsoW - 4), y = H.torsoTop - 6 + Math.sin(a) * 8;
      out.push(b([x - 0.8, y - 0.8, -td - 2], [x + 0.8, y + 0.8, -td - 1.3], C.gold));
    }
    out.push(b([-2.6, H.torsoTop - 13, -td - 2.2], [2.6, H.torsoTop - 8, -td - 1.3], C.gold));
  } else if (item === 'earrings') {
    out.push(...pair([-hw - 2, H.eyeY - 7, -2], [-hw + 0.2, H.eyeY - 3, 2], C.gold));
    out.push(...pair([-hw - 2, H.eyeY - 10, -1.4], [-hw + 0.4, H.eyeY - 7, 1.4], C.goldLt));
  } else if (item === 'mask') {
    out.push(b([-hw + 1, H.mouthY - 3, fz - 1.8], [hw - 1, H.mouthY + 5, fz - 0.4], col));
    out.push(b([-hw + 1, H.mouthY - 3, fz - 2.1], [hw - 1, H.mouthY - 1.5, fz - 1.2], shadeHex(col, 0.8)));
  }
  return out;
}

/* ───────────────────────────── full avatar ───────────────────────────── */
export function buildPlayer(cfg = {}) {
  const {
    body: kind = 'androgynous', skin = '#E8C4A8', eyes = 'round',
    hair: hairStyle = 'short', hairColor = '#6B4226',
    clothing = 'tee', clothingColor = '#6E1B2A',
    accessory: acc = 'none', expression = 'neutral',
  } = cfg;

  const out = [];
  const hw = H.headW;

  // body silhouette tweaks by presentation
  const shoulder = kind === 'masculine' ? 1.5 : kind === 'feminine' ? -1.5 : 0;
  const hip = kind === 'feminine' ? 1.5 : 0;

  // hair back FIRST so it never covers the face
  out.push(...hair(hairStyle, hairColor, kind));

  // head + face
  out.push(...head({
    skin,
    eyeStyle: eyes === 'sharp' ? 'sharp' : 'round',
    mouth: EXPR_MOUTH[expression] || 'neutral',
    expr: expression,
    hair: hairColor,
  }));

  // torso / arms / legs
  const td = Math.round(H.torsoW * 0.62);
  const colSh = shadeHex(clothingColor, 0.78);
  const styleMap = { tee: 'suit', hoodie: 'hoodie', shirt: 'suit', suit: 'suit', jacket: 'suit', robe: 'robe', meme: 'hoodie' };
  out.push(...torso({
    col: clothingColor, colSh, style: styleMap[clothing] || 'suit',
    w: H.torsoW + shoulder,
  }));
  out.push(...arms({ col: clothingColor, colSh, cuff: shadeHex(clothingColor, 1.2), hand: skin }));
  out.push(...legs({ col: shadeHex(clothingColor, 0.55), shoe: C.ink }));

  // accessory last (sits over everything)
  out.push(...accessory(acc, clothingColor, kind));

  return out;
}

export const PLAYER_CFG_DEFAULT = {
  body: 'androgynous', skin: '#E8C4A8', eyes: 'round',
  hair: 'short', hairColor: '#6B4226',
  clothing: 'tee', clothingColor: '#6E1B2A',
  accessory: 'none', expression: 'neutral',
};

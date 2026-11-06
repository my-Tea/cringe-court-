// Gallery / audience NPCs — low-detail seated background cast for the courtroom
// benches. Generated parametrically from a seed, so the set is reproducible:
// `buildGallery(seed, n)` always returns the same people for the same seed.
//
// Axes: hair style x hair colour, skin tone, top style x top colour, accessory.
// The camera looks over the gallery toward the bench, so the BACK of the head
// carries the identity: every hair style has a distinct back silhouette, and
// accessories (backpack, headphone band, cap strap, scarf, hood) read from behind.
// Uses the voxel rig (vox-base posed + 'seated' pose); heads are the shared head().
import { H, C, b, pair, head, torso, arms, legs, tag, posed, shadeHex } from './vox-base.mjs';

export const GALLERY_SEED = 0xC0FFEE;

/* ── seeded RNG (mulberry32) ─────────────────────────────────────────────── */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── parameter pools (palette reuse: C from vox-base + two courtroom greens) ── */
export const SKIN = ['#F3D5BD', '#E8C4A8', '#D2A98C', '#B98560', '#8B5E42', '#5E3E2B'];
export const HAIR = {
  brown: C.hairBr, silver: C.hairS, navy: C.hairNv, pink: C.hairPk,
  black: '#1A1620', blonde: '#E2B965', auburn: '#8E3B2A', teal: '#2E5F73',
};
export const TOPS = {
  blue: C.blue, burgundy: C.burg, navy: C.navy, purple: C.purple,
  pink: C.pink, gold: C.gold, teal: '#2E5F73', green: '#3E7F50', cream: C.creamSh,
};
export const LEGS = ['#3F6FB5', '#264A85', '#6B5A4E', '#5C5560', '#452F75', '#8B5E2A', '#2E5F73', '#4A3A32'];
export const SHOES = [C.ink, C.white, C.cream, C.burg, C.ink, C.goldDk];
export const HAIR_STYLES = ['short', 'long', 'bun', 'ponytail', 'spiky', 'curly', 'bob', 'bald'];
export const TOP_STYLES = ['tee', 'hoodie', 'jacket', 'sweater'];
export const ACCESSORIES = ['none', 'glasses', 'headphones', 'cap', 'beanie', 'scarf', 'backpack', 'earrings'];

/* ── hair (all built for a readable BACK view) ───────────────────────────── */
function hairBoxes(style, col) {
  const hw = H.headW, lo = H.headBot, hi = H.headTop, sh = shadeHex(col, 0.78), lt = shadeHex(col, 1.18);
  const o = [];
  const cap = () => {
    o.push(b([-hw - 0.5, hi - 4, -hw + 1], [hw + 0.5, hi + 2.4, hw + 1], col));             // crown
    o.push(b([-hw - 0.5, lo + 7, hw - 3], [hw + 0.5, hi, hw + 1], sh));                     // back
    o.push(...pair([-hw - 0.6, lo + 9, -hw + 4], [-hw + 1.2, hi - 3, hw], col));            // sides above the ears
  };
  const fringe = () => {
    for (let i = 0; i < 5; i++) o.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.2], [-hw + 4.2 + i * 4.6, hi + 1, -hw + 2], i % 2 ? col : sh));
  };
  switch (style) {
    case 'short': cap(); fringe(); break;
    case 'bob':
      cap(); fringe();
      o.push(b([-hw - 1.4, lo + 1, hw - 4], [hw + 1.4, hi, hw + 1.6], col));                // back curtain to the jaw
      o.push(...pair([-hw - 1.4, lo + 1, -hw + 5], [-hw + 1, hi - 3, hw + 1], sh));
      break;
    case 'long':
      cap(); fringe();
      o.push(b([-hw - 1.6, lo - 18, hw - 3], [hw + 1.6, hi - 1, hw + 2.2], col));          // falls onto the shoulders
      o.push(b([-hw - 1.6, lo - 18, hw + 0.6], [hw + 1.6, lo - 6, hw + 3], sh));
      o.push(...pair([-hw - 1.8, lo - 10, -hw + 7], [-hw + 0.4, hi - 4, hw + 1], col));
      break;
    case 'bun':
      cap();
      o.push(b([-5.5, hi - 2, hw - 1], [5.5, hi + 9, hw + 8], col));                        // bun, high and behind
      o.push(b([-6, hi + 2, hw], [6, hi + 4, hw + 8.6], lt));
      o.push(b([-1.6, hi - 4, hw + 1], [1.6, hi + 6, hw + 1.8], C.goldLt));                 // hair tie
      break;
    case 'ponytail':
      cap(); fringe();
      o.push(b([-3, lo - 10, hw + 1], [3, hi - 6, hw + 5], col));
      o.push(b([-3.2, lo - 4, hw + 4], [3.2, lo + 2, hw + 6], sh));
      o.push(b([-3.4, hi - 10, hw + 0.6], [3.4, hi - 8, hw + 5.4], C.goldLt));              // band
      break;
    case 'spiky':
      cap(); fringe();
      for (const [x, h2, w2] of [[-hw, 6, 5], [-hw + 5, 9, 5], [-1.5, 11, 5], [hw - 9, 8, 5], [hw - 4, 5, 4]])
        o.push(b([x, hi + 1, -hw + 3], [x + w2, hi + 1 + h2, hw - 1], h2 % 2 ? col : lt));
      break;
    case 'curly':
      o.push(b([-hw - 3, lo + 4, -hw + 2], [hw + 3, hi + 6, hw + 4], col));                 // big round mass
      for (let i = 0; i < 4; i++) o.push(b([-hw - 3.6 + i * 6.6, hi + 4, -hw + 3 + (i % 2) * 6], [-hw + 1.4 + i * 6.6, hi + 8, hw + 3], i % 2 ? lt : col));
      o.push(b([-hw - 3.4, lo + 4, hw + 1], [hw + 3.4, hi + 4, hw + 4.6], sh));
      o.push(b([-hw + 1, hi - 2, -hw - 1.2], [hw - 1, hi + 2, -hw + 2], col));              // brow of the mass, above the eyes
      break;
    case 'bald':
      o.push(b([-hw + 3, hi + 1.6, -4], [hw - 3, hi + 2.2, 4], lt));                        // a shine, nothing else
      break;
  }
  return o;
}

/* ── accessories ─────────────────────────────────────────────────────────── */
function accessoryBoxes(acc, ctx) {
  const hw = H.headW, lo = H.headBot, hi = H.headTop, td = Math.round(H.torsoW * 0.62);
  const o = [], head_ = [];
  switch (acc) {
    case 'glasses':
      for (const sx of [-1, 1]) {
        const ex = sx * H.eyeX;
        head_.push(b([ex - 3.6, H.eyeY - 3, -hw - 1.8], [ex + 3.6, H.eyeY + 3.6, -hw - 1], C.ink));
        head_.push(b([ex - 2.8, H.eyeY - 2.4, -hw - 2], [ex + 2.8, H.eyeY + 3, -hw - 1.2], '#E8F6FF'));
      }
      head_.push(b([-hw, H.eyeY + 1.4, -hw - 1.6], [hw, H.eyeY + 2.2, -hw - 1], C.ink));   // arms run back along the head
      break;
    case 'headphones':
      head_.push(b([-hw - 2.6, hi - 1, -3], [hw + 2.6, hi + 2.4, 3], C.ink));               // band over the crown
      head_.push(...pair([-hw - 3, hi - 3, -3], [-hw - 1, hi + 2, 3], C.ink));
      head_.push(...pair([-hw - 5, lo + 4, -5], [-hw - 1.8, lo + 15, 5], C.ink));            // ear cups
      head_.push(...pair([-hw - 5.4, lo + 6, -4], [-hw - 3.6, lo + 13, 4], C.cyan));
      break;
    case 'cap': {                                                                           // worn backwards: strap + tab show from behind
      const cc = ctx.accent;
      head_.push(b([-hw - 1.6, hi - 1, -hw - 0.6], [hw + 1.6, hi + 4, hw + 1.6], cc));
      head_.push(b([-hw - 1.8, hi + 3.6, -hw - 0.8], [hw + 1.8, hi + 4.8, hw + 1.8], shadeHex(cc, 1.2)));
      head_.push(b([-hw + 3, hi - 2.6, hw + 0.8], [hw - 3, hi + 0.4, hw + 2.2], shadeHex(cc, 0.7)));   // adjuster strap
      head_.push(b([-hw + 1, hi - 1.4, hw + 1.6], [hw - 1, hi + 1, hw + 5.6], cc));                   // brim, pointing back
      break;
    }
    case 'beanie': {
      const cc = ctx.accent;
      head_.push(b([-hw - 1.6, hi - 7, -hw - 0.6], [hw + 1.6, hi + 4, hw + 1.6], cc));
      head_.push(b([-hw - 2, hi - 8, -hw - 1], [hw + 2, hi - 5.4, hw + 2], shadeHex(cc, 0.72)));        // cuff
      head_.push(b([-2.4, hi + 4, -2.4], [2.4, hi + 8, 2.4], shadeHex(cc, 1.25)));                      // pom
      break;
    }
    case 'scarf': {
      const cc = ctx.accent;
      o.push(b([-H.torsoW + 2, H.torsoTop - 2, -td - 2], [H.torsoW - 2, H.torsoTop + 3.4, td + 2], cc));
      o.push(b([-H.torsoW + 2, H.torsoTop - 3.6, -td - 2.4], [-H.torsoW + 7, H.torsoTop - 1, td - 4], shadeHex(cc, 0.8)));
      break;
    }
    case 'backpack': {
      const cc = ctx.accent;
      o.push(b([-9, H.torsoBot + 3, td], [9, H.torsoTop - 6, td + 8], cc));                 // seen head-on from behind
      o.push(b([-9, H.torsoBot + 3, td + 6], [9, H.torsoBot + 10, td + 8.6], shadeHex(cc, 0.75)));
      o.push(b([-6, H.torsoBot + 8, td + 8], [6, H.torsoTop - 12, td + 9], C.cream));       // pocket flap
      for (const sx of [-1, 1]) o.push(b([sx * 8 - 1.5, H.torsoBot + 6, -td - 0.5], [sx * 8 + 1.5, H.torsoTop - 1, td + 0.5], shadeHex(cc, 0.8))); // straps
      break;
    }
    case 'earrings':
      head_.push(...pair([-hw - 0.4, H.eyeY - 9, -1], [-hw + 0.6 - 1.4, H.eyeY - 5.6, 1], C.goldLt));
      break;
  }
  return { body: o, head: head_ };
}

/* ── tops: back detail is what the camera sees ───────────────────────────── */
function topBoxes(style, col) {
  const w = H.torsoW, lo = H.torsoBot, hi = H.torsoTop, d = Math.round(w * 0.62), sh = shadeHex(col, 0.78), lt = shadeHex(col, 1.2);
  const o = [];
  switch (style) {
    case 'hoodie':
      o.push(b([-w + 2, hi - 7, d - 0.4], [w - 2, hi + 1.6, d + 3.4], sh));                 // hood hanging down the back
      o.push(b([-w + 3, hi - 7.6, d + 2.6], [w - 3, hi - 4, d + 3.8], col));
      o.push(b([-w + 1, hi - 1, -d - 0.4], [w - 1, hi + 2, d + 1], sh));                    // hood rim around the neck
      break;
    case 'jacket':
      o.push(b([-0.5, lo, d - 0.2], [0.5, hi - 1, d + 0.5], sh));                           // back seam
      o.push(b([-w + 1, hi - 3, -d - 0.4], [w - 1, hi + 1.4, d + 0.8], sh));                // collar
      o.push(b([-w, lo, -d - 0.5], [w, lo + 2.4, d + 0.6], sh));                            // hem band
      break;
    case 'sweater':
      for (let i = 0; i < 3; i++) o.push(b([-w, lo + 7 + i * 7, -d - 0.4], [w, lo + 9 + i * 7, d + 0.5], i % 2 ? lt : sh));   // stripes wrap around
      o.push(b([-w + 3, hi - 1, -d + 1], [w - 3, hi + 2, d - 1], lt));                       // crew neck
      break;
    case 'tee':
    default:
      o.push(b([-w + 3, hi - 12, d - 0.2], [w - 3, hi - 4, d + 0.6], lt));                   // a big printed back panel
      o.push(b([-w + 5, hi - 10, d + 0.4], [w - 5, hi - 6, d + 1], sh));
      break;
  }
  return o;
}

/* ── generator ───────────────────────────────────────────────────────────── */
/** n distinct NPC specs from a seed. Distinctness is by (hair style, top style)
 *  plus the colour draws; hair styles and accessories are walked without repeats
 *  so a small cast cannot be 8 clones. */
export function buildGallery(seed = GALLERY_SEED, n = 8) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const hs = shuffle(HAIR_STYLES), ts = shuffle(TOP_STYLES), topNames = Object.keys(TOPS);
  const skins = shuffle(SKIN), tops = shuffle(topNames), hairs = shuffle(Object.keys(HAIR));
  const legs_ = shuffle(LEGS), shoes = shuffle(SHOES);
  const free = shuffle(ACCESSORIES), used = new Set();
  const out = [];
  for (let i = 0; i < n; i++) {
    const hair = hs[i % hs.length];
    // first unused accessory that suits the hair (hats need a smooth head shape)
    const hatOk = !['spiky', 'curly', 'bun'].includes(hair);
    let acc = free.find((a) => !used.has(a) && (hatOk || (a !== 'cap' && a !== 'beanie')))
      ?? free.find((a) => hatOk || (a !== 'cap' && a !== 'beanie'));
    if (hair === 'bald' && acc === 'beanie') acc = 'cap';
    used.add(acc);
    const topKey = tops[i % tops.length];
    out.push({
      id: `npc${String(i + 1).padStart(2, '0')}`,
      hair, hairColor: hairs[i % hairs.length], skin: skins[i % skins.length],
      top: ts[i % ts.length], topColor: topKey, accessory: acc,
      accent: TOPS[pick(topNames.filter((k) => k !== topKey))],
      legColor: legs_[i % legs_.length], shoe: shoes[i % shoes.length],
    });
  }
  return out;
}

/** Box list for one NPC. pose defaults to 'seated' (the only use here). */
export function npcParts(spec, pose = 'seated', expr = 'neutral') {
  const hw = H.headW;
  const hairCol = HAIR[spec.hairColor], topCol = TOPS[spec.topColor];
  const ctx = { accent: spec.accent };
  const out = [];
  out.push(...hairBoxes(spec.hair, hairCol));
  out.push(...head({ skin: spec.skin, eyeStyle: 'round', mouth: 'neutral', hair: hairCol }));
  const acc = accessoryBoxes(spec.accessory, ctx);
  out.push(...acc.head);
  tag('head', out);
  out.push(...torso({ col: topCol, colSh: shadeHex(topCol, 0.78), style: 'none' }));
  out.push(...topBoxes(spec.top, topCol));
  out.push(...acc.body);
  out.push(...arms({ col: topCol, colSh: shadeHex(topCol, 0.78), cuff: spec.top === 'jacket' ? shadeHex(topCol, 0.7) : null, hand: spec.skin }));
  out.push(...legs({ col: spec.legColor, shoe: spec.shoe, seat: pose === 'seated' }));
  return posed(out, pose);
}

/** Bench for previews / scene reference: seat slab under the hips and thighs
 *  plus a low backrest on the camera side (+z). World space (not rigged).
 *  Seat top is y=17, exactly where the seated thighs rest. */
export function benchBoxes(width = 24) {
  const wd = '#8B5E2A', wl = '#B77D3A', wk = '#6B4A24';
  return [
    b([-width, 14, -22], [width, 17, 8], wl),
    b([-width, 14, -22], [width, 15.4, 8], wd),
    b([-width, 17, 8], [width, 25, 10], wd),                    // low backrest
    b([-width, 23.4, 8], [width, 25, 10.6], wl),
    b([-width - 2, 0, -22], [-width, 17, 10], wk),              // pew end panels
    b([width, 0, -22], [width + 2, 17, 10], wk),
  ];
}

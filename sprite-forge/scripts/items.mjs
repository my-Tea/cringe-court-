// items.mjs — 16x16 handheld items drawn from explicit pixel maps.
// Hand-authored maps beat procedural noise for items, because silhouette
// legibility is everything at this size.
import { Canvas, ramp, alpha0 } from './core.mjs';

// Legend: '.' transparent, 'o' outline, 'w' wood shaft, 'd' wood dark,
// 'm' metal light, 'M' metal mid, 'n' metal dark, 'g' gem light, 'G' gem mid, 'k' gem dark
const PICKS = null; // head is generated geometrically (see pickaxeHead), maps are too error-prone for a curve

const SWORD = [
  '................',
  '...........ooo..',
  '..........ommMo.',
  '.........ommMno.',
  '........ommMno..',
  '.......ommMno...',
  '......ommMno....',
  '.....ommMno.....',
  '....ommMno......',
  '...oomMno.......',
  '..odoooo........',
  '..odo...........',
  '.odoo...........',
  '.od.............',
  'oo..............',
  '................',
];

export function fromMap(rows, legend) {
  const h = rows.length, w = rows[0].length;
  const c = new Canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.' || ch === ' ') continue;
    const col = legend[ch];
    if (!col) throw new Error(`unmapped pixel '${ch}' at ${x},${y}`);
    c.set(x, y, col);
  }
  return c;
}

const metal = ramp(214, 10, { dark: 26, light: 84, steps: 4, shift: 10 }); // n, M, m
const wood = ramp(30, 42, { dark: 24, light: 52, steps: 4, shift: 12 });
const gem = ramp(268, 62, { dark: 22, light: 76, steps: 4, shift: 18 });
const outline = [22, 16, 30, 255];

/** Pickaxe built from geometry rather than a hand map: an arc head swept over a
 *  diagonal shaft. The arc guarantees a crisp crescent that reads instantly. */
function pickaxeHead(headRamp) {
  const c = new Canvas(16, 16);
  const [dark, mid, lit] = headRamp;
  const shaft = wood[2], shaftDark = wood[0];

  // Shaft: from under the head down to the lower-left, 1px wide with a dark edge.
  const pts = [[8, 9], [8, 10], [7, 11], [7, 12], [6, 13], [6, 14], [5, 15]];
  for (const [x, y] of pts) { c.set(x, y, shaft); c.set(x - 1, y, shaftDark); }

  // Head: a shallow elliptical crescent. An ellipse (not a circle) gives the
 //  wide, low arc a pickaxe actually has, and keeps the whole head inside 16px.
  const cx = 7.5, cy = 13.5, rx = 8.2, ry = 11.0, thick = 3.0;
  for (let a = 198; a <= 342; a += 0.4) {
    const rad = (a * Math.PI) / 180;
    const ca = Math.cos(rad), sa = Math.sin(rad);
    for (let t = 0; t <= 1; t += 0.08) {
      // Sweep the band inward from the outer rim toward the centre.
      const rr = 1 - (thick / Math.max(rx, ry)) * t;
      const x = Math.round(cx + ca * rx * rr);
      const y = Math.round(cy + sa * ry * rr);
      c.set(x, y, t < 0.34 ? lit : t < 0.7 ? mid : dark);
    }
  }
  return c.outline(outline);
}

export const ITEM_LEGEND = {
  o: outline,
  w: wood[2], d: wood[0],
  m: metal[3], M: metal[2], n: metal[0],
  g: gem[3], G: gem[2], k: gem[0],
};

export const ITEMS = {
  'iron_pickaxe': () => pickaxeHead([metal[0], metal[2], metal[3]]),
  'iron_sword': () => fromMap(SWORD, ITEM_LEGEND).outline(outline),
};

/** Emissive variant of the pickaxe: gem-headed, for the crystal tier. */
export function crystalPickaxe() {
  return pickaxeHead([gem[0], gem[2], gem[3]]);
}

export function buildItems(outDir) {
  const made = [];
  for (const [name, fn] of Object.entries(ITEMS)) {
    const c = fn();
    made.push(c.save(`${outDir}/items/${name}.png`));
    c.scale(8).save(`${outDir}/items/@8x/${name}.png`);
  }
  const cp = crystalPickaxe();
  made.push(cp.save(`${outDir}/items/crystal_pickaxe.png`));
  cp.scale(8).save(`${outDir}/items/@8x/crystal_pickaxe.png`);
  return made;
}

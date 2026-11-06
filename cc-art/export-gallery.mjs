// Gallery NPC export — seated background audience, deterministic from a seed.
//   node export-gallery.mjs [seed] [count]
// Writes dist/characters/gallery/<npc>/{back,back3q,threeq}{,@2x}.png (transparent),
// gallery/manifest.json, and dist/characters/_previews/gallery*.png.
// Every sprite shares ONE framing (same canvas, same scale, same origin), so
// frames line up when placed on a bench and the set stays comparable.
import { buildGallery, npcParts, benchBoxes, GALLERY_SEED } from './gallery-npcs.mjs';
import { renderCharacter, boundsOf } from './char-render.mjs';
import { Canvas } from './core.mjs';
import fs from 'node:fs';

const OUT = './dist/characters/gallery';
const PREV = './dist/characters/_previews';
const seed = process.argv[2] ? Number(process.argv[2]) : GALLERY_SEED;
const count = process.argv[3] ? Number(process.argv[3]) : 8;

// camera: yaw 180 = straight from behind (the player/camera looks over the gallery)
const VIEWS = {
  back:   { yaw: 180, pitch: 24, note: 'camera directly behind the seat' },
  back3q: { yaw: 148, pitch: 24, note: 'rear three-quarter' },
  threeq: { yaw: -32, pitch: 22, note: 'front three-quarter, faces visible' },
};
const W = 260, Hh = 340, SS = 4;
const BG = [22, 18, 24, 255];

/** Render with a keyed background, then box-downsample with real alpha coverage. */
function sprite(boxes, view, bounds) {
  const big = renderCharacter(boxes, { w: W * SS, h: Hh * SS, ss: 1, bg: BG, bounds, pad: 0.04, ...view });
  const out = new Canvas(W, Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, bl = 0, n = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const p = big.get(x * SS + dx, y * SS + dy);
      if (p[0] === BG[0] && p[1] === BG[1] && p[2] === BG[2]) continue;
      r += p[0]; g += p[1]; bl += p[2]; n++;
    }
    if (n) out.set(x, y, [Math.round(r / n), Math.round(g / n), Math.round(bl / n), Math.round(255 * n / (SS * SS))]);
  }
  return out;
}

const specs = buildGallery(seed, count);
const parts = specs.map((s) => npcParts(s, 'seated'));
// one shared frame for every NPC and view: union of all NPC boxes (rotated views
// only change yaw, and the renderer centres on these bounds)
const bounds = boundsOf(parts.flat());
// square the horizontal footprint so a yaw sweep never clips
const half = Math.max(bounds.mx[0] - bounds.mn[0], bounds.mx[2] - bounds.mn[2]) / 2;
const cx = (bounds.mx[0] + bounds.mn[0]) / 2, cz = (bounds.mx[2] + bounds.mn[2]) / 2;
bounds.mn[0] = cx - half; bounds.mx[0] = cx + half; bounds.mn[2] = cz - half; bounds.mx[2] = cz + half;

fs.mkdirSync(PREV, { recursive: true });
const rows = Object.keys(VIEWS).map(() => []);
const bench = benchBoxes();
const benchRow = [];
let files = 0;

specs.forEach((s, i) => {
  const dir = `${OUT}/${s.id}`;
  fs.mkdirSync(dir, { recursive: true });
  Object.entries(VIEWS).forEach(([name, v], vi) => {
    const img = sprite(parts[i], v, bounds);
    img.save(`${dir}/${name}.png`);
    img.scale(2).save(`${dir}/${name}@2x.png`);
    rows[vi].push(img);
    files += 2;
  });
  benchRow.push(sprite([...parts[i], ...bench], VIEWS.back, bounds));
});

/** Grid on the dark preview background. */
function grid(rowsOfImgs, outFile) {
  const cols = Math.max(...rowsOfImgs.map((r) => r.length));
  const s = new Canvas(cols * W, rowsOfImgs.length * Hh);
  s.fill([26, 22, 28, 255]);
  rowsOfImgs.forEach((row, ry) => row.forEach((im, cx_) => {
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const p = im.get(x, y);
      if (!p[3]) continue;
      const q = s.get(cx_ * W + x, ry * Hh + y), a = p[3] / 255;
      s.set(cx_ * W + x, ry * Hh + y, [0, 1, 2].map((k) => Math.round(p[k] * a + q[k] * (1 - a))).concat(255));
    }
  }));
  s.save(outFile);
  return outFile;
}
grid(rows, `${PREV}/gallery.png`);
grid([benchRow.slice(0, 4), benchRow.slice(4, 8)], `${PREV}/gallery_benches.png`);

fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  seed, count,
  note: 'Seated background NPCs for the gallery benches. Source of truth: cc-art/gallery-npcs.mjs (buildGallery(seed, n) is deterministic).',
  canvas: [W, Hh], views: VIEWS, pose: 'seated (vox-base.mjs EXTRA_POSES)',
  background: 'transparent; all sprites share one framing/scale/origin',
  previews: ['_previews/gallery.png', '_previews/gallery_benches.png'],
  npcs: specs.map((s) => ({ ...s, files: Object.keys(VIEWS).map((v) => `${s.id}/${v}.png`) })),
}, null, 2));
console.log(`gallery: ${specs.length} NPCs, ${files} sprites (seed ${seed})`);

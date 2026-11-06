// Dialogue portraits — head-and-shoulders busts, 4 expressions per character
// (art bible part 4: 32–64px, neutral / smug / shocked / defeated).
// Rendered from the same voxel models as the full-body sprites.
import { CHARS, CHAR_IDS } from './vox-chars.mjs';
import { renderCharacter } from './char-render.mjs';
import { Canvas } from './core.mjs';
import fs from 'node:fs';

const OUT = './dist/characters';
const BG = [42, 22, 54, 255];   // dialogue-box plum, so busts sit on the UI
/** Portrait expression → model expression. There is no 'defeated' face; the
 *  closest the face rig has is crying. */
const PORTRAIT = { neutral: 'neutral', smug: 'smug', shocked: 'shocked', defeated: 'crying' };
const SIZES = { '': 64, '@2x': 128, '_32': 32 };

/** Render the whole body large with a transparent background, then crop a
 *  head-and-shoulders square, so the frame cuts the body instead of leaving
 *  floating fragments of it. */
function bust(id, expr) {
  const big = renderCharacter(CHARS[id].parts('idle', expr), { w: 600, h: 840, ss: 1, yaw: 12, pitch: 4, pad: 0.04, bg: [0, 0, 0, 0] });
  let top = big.h, bot = 0;
  for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) if (big.get(x, y)[3]) { top = Math.min(top, y); bot = Math.max(bot, y); }
  // the narrator is all head; humans are ~4.3 heads tall, so head + shoulders is ~44%
  const side = Math.round((bot - top) * (id === 'ai-narrator' ? 0.75 : 0.44));
  // centre on the head: mean x of the top tenth of the silhouette
  let sx = 0, n = 0;
  for (let y = top; y < top + side * 0.5; y++) for (let x = 0; x < big.w; x++) if (big.get(x, y)[3]) { sx += x; n++; }
  const cx = Math.round(sx / n), y0 = top - Math.round(side * 0.06);
  const crop = new Canvas(side, side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) crop.set(x, y, big.get(cx - (side >> 1) + x, y0 + y));
  return crop;
}

/** Box-filter `src` down to px×px over the plum background. */
function fit(src, px) {
  const out = new Canvas(px, px), k = src.w / px;
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = Math.floor(y * k); sy < Math.floor((y + 1) * k); sy++) for (let sx = Math.floor(x * k); sx < Math.floor((x + 1) * k); sx++) {
      const p = src.get(sx, sy), a = p[3] / 255;
      r += p[0] * a + BG[0] * (1 - a); g += p[1] * a + BG[1] * (1 - a); b += p[2] * a + BG[2] * (1 - a); n++;
    }
    out.set(x, y, [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255]);
  }
  return out;
}

const sheetRows = [];
for (const id of CHAR_IDS) {
  const dir = `${OUT}/${id}/portraits`;
  fs.mkdirSync(dir, { recursive: true });
  const row = [];
  for (const [name, expr] of Object.entries(PORTRAIT)) {
    const src = bust(id, expr);
    for (const [suffix, px] of Object.entries(SIZES)) {
      const img = fit(src, px);
      img.save(`${dir}/${name}${suffix}.png`);
      if (suffix === '@2x') row.push(img);
    }
  }
  sheetRows.push(row);
  console.log(`${id}: ${Object.keys(PORTRAIT).length} portraits`);
}

// contact sheet: one row per character, columns neutral/smug/shocked/defeated
const cell = 136;
const sheet = new Canvas(4 * cell, sheetRows.length * cell);
sheet.fill([26, 22, 28, 255]);
sheetRows.forEach((row, r) => row.forEach((img, c) => sheet.blit(img, c * cell + 4, r * cell + 4)));
sheet.save(`${OUT}/_previews/portraits.png`);
fs.writeFileSync(`${OUT}/portraits.json`, JSON.stringify({
  note: 'Head-and-shoulders dialogue busts on dialogue-box plum. 64px base, @2x = 128px, _32 = 32px. defeated uses the crying face.',
  expressions: Object.keys(PORTRAIT),
  sizes: SIZES,
  characters: CHAR_IDS.map((id) => ({ id, label: CHARS[id].label, dir: `${id}/portraits/` })),
}, null, 2));

// Anonymous Defendant portraits — per-case swappable stand-in.
//   node export-defendant.mjs [caseId ...]
// With no args: 3 stock sets (one per mask style) + 2 sample cases.
// Per set: 6 poses × (64 / @2x 128 / _32), a "CHARGES FILED" composite and a
// 4-frame stamp-impact sequence. Reuses the portrait bust-crop approach and
// plum background of export-portraits.mjs, and the 5x7 pixel font (pixel-font.mjs).
import { defendantParts, variantForCase, MASKS, ACCENTS, GLINTS, EXPRESSIONS } from './defendant-vox.mjs';
import { renderCharacter } from './char-render.mjs';
import { Canvas } from './core.mjs';
import { GLYPHS } from './pixel-font.mjs';   // same letterforms as the UI kit stamps
import fs from 'node:fs';

const OUT = './dist/characters/defendant';
const BG = [42, 22, 54, 255];                  // dialogue-box plum (same as export-portraits.mjs)
const SIZES = { '': 64, '@2x': 128, '_32': 32 };
const STAMP_FILL = [176, 30, 60, 255], CREAM = [255, 248, 236, 255];

/** Head-and-shoulders crop, identical in spirit to export-portraits.mjs bust(). */
/** Crop frame (top/centre/side) comes from the neutral pose so all poses of a set share one frame. */
function render(variant, expr) {
  return renderCharacter(defendantParts(variant, expr), { w: 600, h: 840, ss: 1, yaw: 12, pitch: 4, pad: 0.04, bg: [0, 0, 0, 0] });
}
function frameOf(big) {
  let top = big.h, bot = 0;
  for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) if (big.get(x, y)[3]) { top = Math.min(top, y); bot = Math.max(bot, y); }
  const side = Math.round((bot - top) * 0.44);
  let sx = 0, n = 0;
  for (let y = top; y < top + side * 0.5; y++) for (let x = 0; x < big.w; x++) if (big.get(x, y)[3]) { sx += x; n++; }
  return { side, cx: Math.round(sx / n), y0: top - Math.round(side * 0.06) };
}
function bust(variant, expr, fr) {
  const big = render(variant, expr), { side, cx, y0 } = fr;
  const crop = new Canvas(side, side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) crop.set(x, y, big.get(cx - (side >> 1) + x, y0 + y));
  return crop;
}

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

/** "CHARGES / FILED" stamp, glyphs at integer scale s, sheared ~-12° so it reads as hand-stamped. */
function stampCanvas(s, { slope = -0.22 } = {}) {
  const lines = ['CHARGES', 'FILED'], pad = 2 * s, gw = 6 * s;
  const w = 7 * gw - s + pad * 2 + 2 * s, h = 2 * 7 * s + s + pad * 2 + 2 * s;
  const flat = new Canvas(w, h);
  flat.rect(0, 0, w, h, CREAM);
  flat.rect(s, s, w - 2 * s, h - 2 * s, STAMP_FILL);
  lines.forEach((t, li) => {
    const tw = t.length * gw - s, x0 = Math.round((w - tw) / 2), y0 = pad + s + li * 8 * s;
    [...t].forEach((ch, i) => {
      const g = GLYPHS[ch];
      for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (g[gy][gx] === '1') flat.rect(x0 + i * gw + gx * s, y0 + gy * s, s, s, CREAM);
    });
  });
  const lift = Math.ceil(Math.abs(slope) * w);
  const out = new Canvas(w, h + lift);
  for (let x = 0; x < w; x++) {
    const dy = Math.round(slope * (x - w / 2)) + (lift >> 1) + (lift & 1);
    for (let y = 0; y < h; y++) { const p = flat.get(x, y); if (p[3]) out.set(x, y + dy, p); }
  }
  return out;
}

/** Tiny stand-in for 32px: no room for 7 letters, so a stamped slab with a gold bar. */
function tinyStamp() {
  const c = new Canvas(20, 9);
  c.rect(0, 0, 20, 9, CREAM); c.rect(1, 1, 18, 7, STAMP_FILL); c.rect(3, 3, 14, 1, CREAM); c.rect(3, 5, 9, 1, CREAM);
  const out = new Canvas(20, 12);
  for (let x = 0; x < 20; x++) { const dy = Math.round(-0.22 * (x - 10)) + 2; for (let y = 0; y < 9; y++) { const p = c.get(x, y); if (p[3]) out.set(x, y + dy, p); } }
  return out;
}

function stampFor(px) { return px >= 128 ? stampCanvas(2) : px >= 64 ? stampCanvas(1) : tinyStamp(); }

function blitDither(dst, src, ox, oy) {   // 50% checker so a "ghost" stamp stays pixel-hard
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const p = src.get(x, y); if (p[3] && (x + y) % 2 === 0) dst.set(ox + x, oy + y, p); }
}

function stampPos(px, st) { return [Math.round(px / 2 - st.w / 2), Math.round(px * (px >= 64 ? 0.62 : 0.66) - st.h / 2)]; }

function charged(base, px) {
  const c = base.clone(), st = stampFor(px), [x, y] = stampPos(px, st);
  return c.blit(st, x, y);
}

function sequence(base, px) {
  const st = stampFor(px), [x, y] = stampPos(px, st), k = Math.max(1, px / 64);
  const frames = [];
  // 0: pop-in — portrait small, no stamp
  const f0 = new Canvas(px, px); f0.fill(BG);
  const sc = 0.8, o = Math.round(px * (1 - sc) / 2);
  for (let j = 0; j < Math.round(px * sc); j++) for (let i = 0; i < Math.round(px * sc); i++) f0.set(o + i, o + j, base.get(Math.floor(i / sc), Math.floor(j / sc)));
  frames.push(f0);
  // 1: portrait full, stamp hovers high, dithered
  const f1 = base.clone(); blitDither(f1, st, x, y - Math.round(18 * k)); frames.push(f1);
  // 2: impact — portrait jolts down, stamp lands, cream burst lines
  const f2 = new Canvas(px, px); f2.fill(BG); f2.blit(base, 0, Math.round(1 * k));
  f2.blit(st, x, y);
  const bl = Math.max(2, Math.round(4 * k));
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const cx = x + (sx < 0 ? -1 : sx > 0 ? st.w + 1 : st.w >> 1) , cy = y + (sy < 0 ? -1 : sy > 0 ? st.h + 1 : st.h >> 1);
    for (let t = 0; t < bl; t++) f2.set(cx + sx * (t + 1), cy + sy * (t + 1), CREAM);
  }
  frames.push(f2);
  // 3: settled
  frames.push(charged(base, px));
  return frames;
}

function exportSet(name, variant, sheetRows) {
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  const row = [];
  const fr = frameOf(render(variant, 'neutral'));
  for (const expr of EXPRESSIONS) {
    const src = bust(variant, expr, fr);
    for (const [suffix, px] of Object.entries(SIZES)) {
      const img = fit(src, px);
      img.save(`${dir}/${expr}${suffix}.png`);
      if (expr === 'neutral') charged(img, px).save(`${dir}/charges_filed${suffix}.png`);
      if (suffix === '@2x') row.push(img);
      if (expr === 'neutral' && suffix !== '_32') sequence(img, px).forEach((f, i) => f.save(`${dir}/stamp_impact_${i}${suffix}.png`));
      if (expr === 'neutral' && suffix === '@2x') row.push(charged(img, px));
    }
  }
  sheetRows.push(row);
  return { name, dir: `${name}/`, caseId: variant.caseId ?? null, mask: variant.mask, accent: variant.accent, glint: variant.glint, tagBits: variant.tagBits };
}

const STOCK = {
  'stock-bag': { mask: 'bag', accent: 'burgundy', glint: 'gold', tagBits: [1, 0, 1, 1, 0, 1] },
  'stock-censor': { mask: 'censor', accent: 'nearblack', glint: 'cyan', tagBits: [1, 1, 0, 1, 0, 0] },
  'stock-hood': { mask: 'hood', accent: 'magenta', glint: 'gold', tagBits: [0, 1, 1, 0, 1, 1] },
};
const args = process.argv.slice(2);
const sets = args.length
  ? args.map((id) => [`case-${String(id).replace(/[^\w-]/g, '_')}`, variantForCase(id)])
  : [...Object.entries(STOCK), ['case-sample-0001', variantForCase('case-0001')], ['case-sample-0002', variantForCase('case-0002')]];

const rows = [], made = [];
for (const [name, v] of sets) { made.push(exportSet(name, v, rows)); console.log(`${name}: ${v.mask}/${v.accent}/${v.glint}`); }

if (!args.length) {
  const cell = 136, cols = 8;
  const sheet = new Canvas(cols * cell, rows.length * cell);
  sheet.fill([26, 22, 28, 255]);
  rows.forEach((row, r) => row.forEach((img, c) => sheet.blit(img, c * cell + 4, r * cell + 4)));
  sheet.save('./dist/characters/_previews/defendant.png');
  fs.writeFileSync(`${OUT}/defendant.json`, JSON.stringify({
    note: 'Anonymous per-case defendant stand-in: hooded/masked voxel bust, no face, never the Creator\'s look. Plum background, 64px base, @2x = 128px, _32 = 32px. The 32px charges_filed uses a stamped slab, not legible text. stamp_impact_* exist at 64 and @2x only.',
    poses: EXPRESSIONS,
    expressionNotes: 'No face: bag = eye-hole shape + marker mouth; censor = mosaic bar tilt + glint mouth; hood = glint-eye shapes. Marks: shocked "!", smug sparkle, defeated/slump sweat, celebrate confetti + raised arms. defeated = head dips; slump = head hangs, arms down.',
    files: { pose: '<set>/<pose>{,@2x,_32}.png', composite: '<set>/charges_filed{,@2x,_32}.png', stampSequence: '<set>/stamp_impact_{0..3}{,@2x}.png (0 pop-in, 1 stamp hovers dithered, 2 impact + burst + portrait jolt, 3 settled == charges_filed)' },
    parameters: { mask: MASKS, accent: ACCENTS, glint: GLINTS, tagBits: '6-bit booking-tag barcode on the chest' },
    caseIdToVariant: 'variantForCase(caseId) in defendant-vox.mjs: seed = FNV-1a 32-bit of String(caseId) (code points); rnd = mulberry32(seed); draws in order: mask = MASKS[floor(rnd()*3)], accent = keys(ACCENTS)[floor(rnd()*5)], glint = keys(GLINTS)[floor(rnd()*3)], tagBits = 6 × (rnd()<0.5?0:1) (forced bit0=1 if all zero). Pure/deterministic; pass the same caseId to get the same stand-in. CLI: node export-defendant.mjs <caseId...> writes dist/characters/defendant/case-<id>/.',
    sets: made,
  }, null, 2));
}

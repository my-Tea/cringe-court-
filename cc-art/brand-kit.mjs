// Brand kit — voxel wordmark, social share card, collectible case card.
// The wordmark is real geometry: each font pixel becomes a maroon-faced voxel
// with a gold highlight row and a dark-brown extrusion, rendered through the
// character renderer. Frames follow the parchment / maroon / gold style guide.
import { Pen, mix } from './pen3.mjs';
import { Canvas } from './core.mjs';
import { renderCharacter } from './char-render.mjs';
import { GLYPHS, drawText } from './pixel-font.mjs';
import fs from 'node:fs';

const OUT = './dist/brand';

const B = {
  parch: '#FFF2C7', cream: '#FFF9ED', tan: '#DCC8B0', taupe: '#A9917D',
  gold: '#D9A046', goldLt: '#F6C75B', goldDk: '#B77D3A', goldDeep: '#8B5E2A',
  burg: '#A32D3F', burgLt: '#CE4A44', burgDk: '#7A1C2E',
  ink: '#4A3A32', inkSoft: '#7B645A',
};

/* ─────────────────────────────── wordmark ─────────────────────────────── */

/** Extruded voxel boxes for one or more lines of text. Horizontal pixel runs
 *  are merged into one box so the extrusion reads as solid letters. */
function wordBoxes(lines, depth = 4) {
  const out = [];
  lines.forEach((text, li) => {
    const chars = [...text];
    const lineW = chars.length * 6 - 1;
    const yTop = -li * 9;
    chars.forEach((ch, ci) => {
      const g = GLYPHS[ch];
      for (let gy = 0; gy < 7; gy++) {
        let gx = 0;
        while (gx < 5) {
          if (g[gy][gx] !== '1') { gx++; continue; }
          let run = gx;
          while (run < 5 && g[gy][run] === '1') run++;
          const x0 = ci * 6 + gx - lineW / 2, x1 = ci * 6 + run - lineW / 2;
          const y1 = yTop - gy, y0 = y1 - 1;
          // maroon face, gold highlight on the top row, darker maroon at the base
          out.push({ f: [x0, y0, -0.6], t: [x1, y1, 0], m: gy === 0 ? B.goldLt : gy > 4 ? B.burgDk : B.burg });
          out.push({ f: [x0, y0, 0], t: [x1, y1, depth], m: B.ink });
          gx = run;
        }
      }
    });
  });
  return out;
}

/** Alpha-aware box downsample, so the transparent wordmark keeps soft edges. */
function downsample(src, k) {
  const out = new Canvas(Math.floor(src.w / k), Math.floor(src.h / k));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
      const p = src.get(x * k + dx, y * k + dy);
      r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
    }
    if (a) out.set(x, y, [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / (k * k))]);
  }
  return out;
}

function trim(img, pad = 4) {
  let mnx = img.w, mny = img.h, mxx = 0, mxy = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.get(x, y)[3] > 8) {
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
    }
  }
  const out = new Canvas(mxx - mnx + 1 + pad * 2, mxy - mny + 1 + pad * 2);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.set(x, y, img.get(mnx - pad + x, mny - pad + y));
  return out;
}

/** Render the wordmark with a transparent background at width ~`w`. */
function wordmark(lines, w, h) {
  const k = 3;
  const raw = renderCharacter(wordBoxes(lines), { w: w * k, h: h * k, ss: 1, yaw: -7, pitch: 18, pad: 0.04, bg: [0, 0, 0, 0] });
  return trim(downsample(raw, k));
}

/** Composite `src` over `dst` with alpha. */
function over(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const s = src.get(x, y);
    if (!s[3]) continue;
    const d = dst.get(ox + x, oy + y), a = s[3] / 255, da = d[3] / 255;
    const oa = a + da * (1 - a);
    const c = (i) => Math.round((s[i] * a + d[i] * da * (1 - a)) / (oa || 1));
    dst.set(ox + x, oy + y, [c(0), c(1), c(2), Math.round(oa * 255)]);
  }
  return dst;
}

function scaleDown(img, f) {
  const out = new Canvas(Math.round(img.w * f), Math.round(img.h * f));
  const k = 1 / f;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = Math.floor(y * k); sy < Math.floor((y + 1) * k); sy++) for (let sx = Math.floor(x * k); sx < Math.floor((x + 1) * k); sx++) {
      const p = img.get(sx, sy);
      r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3]; n++;
    }
    if (a) out.set(x, y, [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / n)]);
  }
  return out;
}

/* ─────────────────────────────── frames ─────────────────────────────── */

/** Ornate parchment frame: soft gold glow, maroon rule, gold inlay, cream field. */
function goldFrame(p, x, y, w, h, r, field = B.parch) {
  for (let i = 6; i >= 1; i--) {
    const c = mix(B.parch, B.goldLt, 1 - i / 7);
    p.roundRect(x - i, y - i, w + i * 2, h + i * 2, r + i, [c, c]);
  }
  p.roundRect(x, y, w, h, r, [B.burgDk, B.burgDk]);
  p.roundRect(x + 3, y + 3, w - 6, h - 6, r - 2, [B.gold, B.gold]);
  p.roundRect(x + 6, y + 6, w - 12, h - 12, r - 3, [B.burg, B.burg]);
  p.roundRect(x + 8, y + 8, w - 16, h - 16, r - 4, [B.goldLt, B.goldLt]);
  p.roundRect(x + 10, y + 10, w - 20, h - 20, r - 5, [field, field]);
}

/** Dashed slot outline marking where runtime content drops in. */
function slot(p, x, y, w, h, col, label) {
  const dash = 10;
  for (let i = 0; i < w; i += dash * 2) {
    p.roundRect(x + i, y, Math.min(dash, w - i), 2, 0, [col, col]);
    p.roundRect(x + i, y + h - 2, Math.min(dash, w - i), 2, 0, [col, col]);
  }
  for (let i = 0; i < h; i += dash * 2) {
    p.roundRect(x, y + i, 2, Math.min(dash, h - i), 0, [col, col]);
    p.roundRect(x + w - 2, y + i, 2, Math.min(dash, h - i), 0, [col, col]);
  }
  if (label) drawText(p, label, x + w / 2, y + h / 2, 2, col);
}

/** Anonymous defendant bust — the Solo-mode defendant is never shown. */
function silhouette(p, cx, by, s, col) {
  p.roundRect(cx - 34 * s, by - 46 * s, 68 * s, 46 * s, 22 * s, [col, col]);       // shoulders
  p.roundRect(cx - 9 * s, by - 56 * s, 18 * s, 14 * s, 0, [col, col]);           // neck
  p.roundRect(cx - 24 * s, by - 100 * s, 48 * s, 48 * s, 10 * s, [col, col]);     // cubic head
  drawText(p, '?', cx, by - 76 * s, Math.round(4 * s), B.ink);
}

function corner(p, x, y, sx, sy, col) {
  p.roundRect(sx > 0 ? x : x - 28, y, 28, 4, 0, [col, col]);
  p.roundRect(x - (sx > 0 ? 0 : 4), sy > 0 ? y : y - 24, 4, 28, 0, [col, col]);
}

/* ─────────────────────────────── build ─────────────────────────────── */

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const made = [];

  // wordmark — one line and stacked
  const wm = wordmark(['CRINGECOURT'], 1200, 260);
  wm.save(`${OUT}/wordmark.png`);
  scaleDown(wm, 0.5).save(`${OUT}/wordmark_small.png`);
  made.push('wordmark', 'wordmark_small');
  const wmStack = wordmark(['CRINGE', 'COURT'], 700, 400);
  wmStack.save(`${OUT}/wordmark_stacked.png`);
  made.push('wordmark_stacked');

  // share card — 1200x630, the standard link-preview size
  {
    const W = 1200, H = 630;
    const p = new Pen(W, H);
    p.roundRect(0, 0, W, H, 0, [B.parch, B.parch]);
    goldFrame(p, 24, 24, W - 48, H - 48, 18);
    // defendant portrait slot (left)
    p.roundRect(70, 150, 300, 380, 14, [B.tan, B.tan]);
    silhouette(p, 220, 500, 2, B.taupe);
    slot(p, 70, 150, 300, 380, B.inkSoft, null);
    drawText(p, 'DEFENDANT', 220, 175, 2, B.burgDk);
    // verdict slot (right) sized for card_* verdict cards at 1.5x (540x300)
    slot(p, 600, 150, 540, 300, B.goldDk, 'VERDICT CARD');
    drawText(p, 'THE HUMAN JURY HAS SPOKEN', 870, 132, 2, B.burgDk);
    // fact rows: labels only, runtime fills the values
    for (const [i, label] of ['CASE', 'JURY', 'CATEGORY'].entries()) {
      const x = 600 + i * 184;
      p.roundRect(x, 470, 172, 60, 8, [B.tan, B.tan]);
      p.roundRect(x, 470, 172, 3, 1, [B.burg, B.burg]);
      drawText(p, label, x + 86, 488, 2, B.burgDk);
    }
    drawText(p, 'THE AI PERFORMS. HUMANS DECIDE.', W / 2, 572, 2, B.inkSoft);
    for (const [x, y, sx, sy] of [[44, 44, 1, 1], [W - 44, 44, -1, 1], [44, H - 44, 1, -1], [W - 44, H - 44, -1, -1]]) corner(p, x, y, sx, sy, B.gold);
    const card = p.done();
    const small = scaleDown(wm, 0.4);
    over(card, small, Math.round(W / 2 - small.w / 2), 40);
    card.save(`${OUT}/share_card.png`);
    made.push('share_card');
  }

  // collectible case card — 360x500 portrait template
  {
    const W = 360, H = 500;
    const p = new Pen(W, H);
    p.roundRect(0, 0, W, H, 18, [B.burgDk, B.burgDk]);
    p.roundRect(4, 4, W - 8, H - 8, 15, [B.gold, B.gold]);
    p.roundRect(8, 8, W - 16, H - 16, 12, [B.goldLt, B.goldLt]);
    p.roundRect(11, 11, W - 22, H - 22, 10, [B.parch, B.parch]);
    // header banner
    p.roundRect(18, 18, W - 36, 44, 8, [B.burgDk, B.burgDk, B.burg, B.burg, B.burg]);
    p.roundRect(18, 18, W - 36, 3, 2, [B.goldLt, B.goldLt]);
    drawText(p, 'CASE FILE', 104, 40, 3, B.goldLt);
    slot(p, 196, 26, 140, 28, B.goldLt, null);
    // art window with a spotlight cone
    p.roundRect(18, 72, W - 36, 220, 10, [B.tan, B.tan]);
    p.poly([[W / 2 - 18, 72], [W / 2 + 18, 72], [W / 2 + 110, 292], [W / 2 - 110, 292]], [mix(B.tan, B.cream, 0.55), mix(B.tan, B.cream, 0.55)]);
    silhouette(p, W / 2, 288, 1.5, B.taupe);
    p.roundRect(18, 72, W - 36, 3, 1, [B.burg, B.burg]);
    // stat rows
    for (const [i, label] of ['CHARGE', 'CATEGORY', 'JURY', 'VERDICT'].entries()) {
      const y = 306 + i * 36;
      p.roundRect(18, y, W - 36, 30, 6, [B.cream, B.cream]);
      p.roundRect(18, y, 4, 30, 2, [B.gold, B.gold]);
      drawText(p, label, 18 + 12 + (label.length * 6 - 1), y + 15, 2, B.burgDk);
    }
    drawText(p, 'CRINGECOURT', W / 2, H - 28, 2, B.burgDk);
    p.done().save(`${OUT}/case_card.png`);
    made.push('case_card');
  }

  return made;
}

const made = build();
console.log('Brand assets:', made.length);
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  note: 'Voxel wordmark (maroon face, gold highlight, dark-brown extrusion, transparent), 1200x630 parchment share card and 360x500 case card. Card slots are templates: dashed outlines and labels mark where runtime content drops in.',
  assets: made,
}, null, 2));

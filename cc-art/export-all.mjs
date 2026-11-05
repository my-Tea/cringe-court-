// Bulk export: 8 characters x 8 expressions + 10 poses, plus preview sheets.
import * as V4 from './chars-v4.mjs';
import { EXPRESSIONS, POSES } from './chars-v4-core.mjs';
import { Canvas } from './core.mjs';
import fs from 'node:fs';

const OUT = './dist/characters';
const EXPR = Object.keys(EXPRESSIONS);
const POSE = Object.keys(POSES);

const HUMANS = ['judge', 'prosecutor', 'defense', 'bailiff', 'clerk', 'juror', 'creator'];
const ALL = V4.CHAR_IDS;

/** Crop to content bounds with a small margin. */
function trim(img, pad = 6) {
  let mnx = img.w, mny = img.h, mxx = 0, mxy = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.get(x, y)[3] > 8) {
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
    }
  }
  if (mxx <= mnx) return img;
  const w = mxx - mnx + 1 + pad * 2, h = mxy - mny + 1 + pad * 2;
  const out = new Canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = img.get(mnx - pad + x, mny - pad + y);
    if (p[3] > 0) out.set(x, y, p);
  }
  return out;
}

/** Sheet of N images in a grid, aligned to a common baseline. */
function sheet(imgs, cols, cellW, cellH, outFile) {
  const rows = Math.ceil(imgs.length / cols);
  const s = new Canvas(cols * cellW, rows * cellH);
  s.fill([26, 22, 28, 255]);
  imgs.forEach((im, i) => {
    const x = (i % cols) * cellW + Math.floor((cellW - im.w) / 2);
    const y = Math.floor(i / cols) * cellH + (cellH - im.h) - 8;
    s.blit(im, x, y);
  });
  s.save(outFile);
  return outFile;
}

let n = 0;
const report = [];

for (const id of ALL) {
  const dir = `${OUT}/${id}`;
  fs.mkdirSync(`${dir}/poses`, { recursive: true });
  fs.mkdirSync(`${dir}/expressions`, { recursive: true });

  // neutral full-body master
  const master = trim(V4.CHARS[id]({}));
  master.save(`${dir}/sprite.png`);
  master.scale(2).save(`${dir}/sprite@2x.png`);

  // 8 expressions (full body, but the sheet crops to the head)
  const exprImgs = [];
  for (const e of EXPR) {
    const img = trim(V4.CHARS[id]({ expr: e }));
    img.save(`${dir}/expressions/${e}.png`);
    img.scale(2).save(`${dir}/expressions/${e}@2x.png`);
    exprImgs.push(img);
    n++;
  }
  sheet(exprImgs, 4, 200, 260, `${dir}/_expressions.png`);

  // 10 poses (full body)
  const poseImgs = [];
  for (const po of POSE) {
    const img = trim(V4.CHARS[id]({ pose: po }));
    img.save(`${dir}/poses/${po}.png`);
    img.scale(2).save(`${dir}/poses/${po}@2x.png`);
    poseImgs.push(img);
    n++;
  }
  sheet(poseImgs, 5, 170, 240, `${dir}/_poses.png`);

  report.push({ id, expressions: EXPR.length, poses: POSE.length, boxes: 'procedural' });
  console.log(`${id}: ${EXPR.length} expressions, ${POSE.length} poses`);
}

// master lineup
const lineup = ALL.map((id) => trim(V4.CHARS[id]({})));
sheet(lineup, 4, 300, 400, `${OUT}/_previews/lineup.png`);
// upscaled
const lu = ALL.map((id) => trim(V4.CHARS[id]({})));
sheet(lu, 4, 300, 400, `${OUT}/_previews/lineup_tmp.png`);

fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  canvas: { w: 256, h: 320 },
  note: 'Procedurally drawn 2D sprites. Source of truth: cc-art/chars-v4.mjs. Each character has 8 expressions and 10 poses.',
  expressions: EXPR,
  poses: POSE,
  characters: report,
}, null, 2));

console.log(`\nTOTAL FILES: ${n}`);

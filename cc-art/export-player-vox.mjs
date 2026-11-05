import { PLAYER, PLAYER_CFG_DEFAULT, buildPlayer } from './player-vox.mjs';
import { renderCharacter } from './char-render.mjs';
import { Canvas } from './core.mjs';
import fs from 'node:fs';

const OUT = './dist/characters/player';
fs.mkdirSync(OUT, { recursive: true });

function trim(img, pad = 8) {
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
const render = (cfg) => trim(renderCharacter(buildPlayer(cfg), { w: 220, h: 320, yaw: 12, pitch: 5 }));

let n = 0;
const fieldMap = {
  body: 'body', skin: 'skin', eyes: 'eyes', hair: 'hair', hairColor: 'hairColor',
  clothing: 'clothing', clothingColor: 'clothingColor', accessory: 'accessory', expression: 'expression',
};
for (const [cat, vals] of Object.entries(PLAYER)) {
  const dir = `${OUT}/${cat}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const v of vals) {
    const cfg = { ...PLAYER_CFG_DEFAULT, [fieldMap[cat]]: v };
    const img = render(cfg);
    const name = String(v).replace('#', '');
    img.save(`${dir}/${name}.png`);
    img.scale(2).save(`${dir}/${name}@2x.png`);
    n++;
  }
  console.log(`${cat}: ${vals.length}`);
}

// default master
const def = render(PLAYER_CFG_DEFAULT);
def.save(`${OUT}/default.png`);
def.scale(2).save(`${OUT}/default@2x.png`);

// option grid sheet
const cats = Object.keys(PLAYER);
const cellW = 150, cellH = 200;
const maxCols = 8;
const sheetImg = new Canvas(maxCols * cellW, cats.length * cellH);
sheetImg.fill([26, 22, 28, 255]);
cats.forEach((cat, r) => {
  PLAYER[cat].slice(0, maxCols).forEach((v, i) => {
    const cfg = { ...PLAYER_CFG_DEFAULT, [fieldMap[cat]]: v };
    const img = trim(renderCharacter(buildPlayer(cfg), { w: 120, h: 175, yaw: 12, pitch: 5 }), 3);
    const x = i * cellW + Math.floor((cellW - img.w) / 2);
    const y = r * cellH + (cellH - img.h) - 4;
    for (let py = 0; py < img.h; py++) for (let px = 0; px < img.w; px++) {
      const p = img.get(px, py);
      if (p[3] > 8) sheetImg.set(x + px, y + py, p);
    }
  });
});
sheetImg.save(`${OUT}/_options.png`);

fs.writeFileSync(`${OUT}/player-library.json`, JSON.stringify({
  style: 'voxel, 4.5-5 heads tall (same proportions as the cast)',
  canvas: { w: 220, h: 320 },
  default: PLAYER_CFG_DEFAULT,
  options: PLAYER,
  build: 'buildPlayer({ body, skin, eyes, hair, hairColor, clothing, clothingColor, accessory, expression })',
  note: 'Parts are composable box lists — not pre-rendered combinations.',
}, null, 2));

console.log(`\nTOTAL player parts: ${n}`);

/* global console, process */
// Compose the walk frames into a 4×3 contact sheet with frame numbers.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const OUT = process.env.OUT ?? 'roam-shots';
const frames = JSON.parse(fs.readFileSync(`${OUT}/walk-frames.json`, 'utf8')).map((f) => PNG.sync.read(fs.readFileSync(f)));
const scale = 2; // downsample by 2
const w = Math.floor(frames[0].width / scale), h = Math.floor(frames[0].height / scale), gap = 6, cols = 4, rows = Math.ceil(frames.length / cols);
const sheet = new PNG({ width: cols * w + (cols + 1) * gap, height: rows * h + (rows + 1) * gap });
for (let i = 0; i < sheet.data.length; i += 4) sheet.data.set([0x4a, 0x3a, 0x32, 255], i);
frames.forEach((f, i) => {
  const ox = gap + (i % cols) * (w + gap), oy = gap + Math.floor(i / cols) * (h + gap);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y * scale) * f.width + x * scale) * 4, di = ((oy + y) * sheet.width + ox + x) * 4;
    sheet.data.set(f.data.subarray(si, si + 4), di);
  }
});
fs.writeFileSync(`${OUT}/roam-walk-sheet.png`, PNG.sync.write(sheet));
console.log('sheet', sheet.width, sheet.height, frames.length, 'frames');

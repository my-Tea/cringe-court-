// Render a .bbmodel's rest pose to PNG with the cc-art voxel renderer, so the
// model can be checked without opening Blockbench. Colour per cube = the
// centre pixel of its north-face texture (the Judge's textures are flat).
//   node judge/tools/preview.mjs judge/dist/GavelExe.bbmodel out.png
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { renderCharacter } from '../../cc-art/char-render.mjs';
import { Canvas } from '../../cc-art/core.mjs';

const require = createRequire(new URL('../../cc-art/core.mjs', import.meta.url));
const { PNG } = require('pngjs');

const [src, out] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(src, 'utf8'));
const colours = m.textures.map((t) => {
  const png = PNG.sync.read(Buffer.from(t.source.split(',')[1], 'base64'));
  const i = ((png.height >> 1) * png.width + (png.width >> 1)) * 4;
  return '#' + [0, 1, 2].map((k) => png.data[i + k].toString(16).padStart(2, '0')).join('');
});
const boxes = m.elements.map((e) => ({ f: e.from, t: e.to, m: colours[e.faces.north.texture] }));

// front three-quarter and right side, side by side
const views = [{ yaw: 24, pitch: 8 }, { yaw: 80, pitch: 6 }].map((v) => renderCharacter(boxes, { w: 360, h: 520, ...v }));
const sheet = new Canvas(views.length * 360, 520);
views.forEach((im, i) => sheet.blit(im, i * 360, 0));
sheet.save(out);
console.log(`${m.elements.length} cubes -> ${out}`);

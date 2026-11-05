import { buildCourtroom, SHOTS } from './scene.mjs';
import { renderScene } from './render3d.mjs';
import fs from 'node:fs';
const { boxes, placed } = buildCourtroom();
const OUT = './out/scene';
fs.mkdirSync(OUT, { recursive: true });
console.log('boxes:', boxes.length, 'props:', placed.length);
for (const [name, cam] of Object.entries(SHOTS)) {
  const t0 = Date.now();
  // ss:1 for speed on the heavy interior shots, ss:2 for hero frames
  const img = renderScene(boxes, cam, { w: 1400, h: 880, fov: cam.fov, bg: [16, 12, 18, 255], ss: 1 });
  img.save(`${OUT}/${name}.png`);
  console.log(name, 'x' + img.w, (Date.now() - t0) + 'ms');
}

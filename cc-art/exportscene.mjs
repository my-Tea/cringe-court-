import { buildCourtroom, SHOTS, ROOM } from './scene.mjs';
import fs from 'node:fs';
const { boxes, placed } = buildCourtroom();
const D = './dist';
fs.mkdirSync(`${D}/scene`, { recursive: true });
// copy renders
if (fs.existsSync('./out/scene')) {
  for (const f of fs.readdirSync('./out/scene')) {
    fs.copyFileSync(`./out/scene/${f}`, `${D}/scene/${f}`);
  }
}
const meta = {
  room: ROOM,
  boxes: boxes.length,
  propsPlaced: placed.length,
  shots: SHOTS,
  layout: placed,
};
fs.writeFileSync(`${D}/scene/courtroom.layout.json`, JSON.stringify(meta, null, 2));
fs.writeFileSync(`${D}/scene/courtroom.boxes.json`, JSON.stringify(boxes));
console.log('boxes:', boxes.length, 'props:', placed.length);
console.log('renders:', fs.existsSync(`${D}/scene`) ? fs.readdirSync(`${D}/scene`).length : 0);

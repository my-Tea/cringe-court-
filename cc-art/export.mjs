import { renderProp } from './render.mjs';
import { PROPS, PROP_NAMES } from './props.mjs';
import fs from 'node:fs';

const OUT = './out/props';
fs.mkdirSync(OUT, { recursive: true });

const manifest = [];
for (const name of PROP_NAMES) {
  const p = PROPS[name];
  const c = renderProp(p.parts, 2);
  c.save(`${OUT}/${name}.png`);
  c.scale(4).save(`${OUT}/${name}@4x.png`);
  // bounds, so the engine can place a collider / footprint
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const b of p.parts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.f[i]);
      max[i] = Math.max(max[i], b.t[i]);
    }
  }
  manifest.push({
    name,
    label: p.label,
    boxes: p.parts.length,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    pivot: [0, 0, 0],
    footprint: { w: max[0] - min[0], d: max[2] - min[2] },
    height: max[1],
    image: `${name}.png`,
    image4x: `${name}@4x.png`,
  });
}
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log('props exported:', manifest.length);
console.log('total boxes:', manifest.reduce((n, m) => n + m.boxes, 0));

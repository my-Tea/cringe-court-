import { renderCharacter, characterSheet } from './char-render.mjs';
import { CHARACTERS, CHARACTER_IDS } from './chibi-chars.mjs';
import fs from 'node:fs';

const OUT = './dist/characters';
fs.mkdirSync(`${OUT}/_previews`, { recursive: true });
const all = {}, meta = [];

for (const id of CHARACTER_IDS) {
  const ch = CHARACTERS[id];
  const parts = ch.parts();
  all[id] = parts;
  fs.mkdirSync(`${OUT}/${id}`, { recursive: true });

  // front, 3/4 and side renders
  const views = {
    front:  { yaw: 0,   pitch: 6 },
    threeq: { yaw: 18,  pitch: 9 },
    side:   { yaw: 72,  pitch: 7 },
  };
  for (const [v, o] of Object.entries(views)) {
    const img = renderCharacter(parts, { w: 420, h: 540, ss: 2, ...o, bg: [0, 0, 0, 0] });
    img.save(`${OUT}/${id}/${v}.png`);
    img.scale(2).save(`${OUT}/${id}/${v}@2x.png`);
  }
  // bounds for the manifest
  let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  for (const b of parts) for (let i=0;i<3;i++){ mn[i]=Math.min(mn[i],b.f[i]); mx[i]=Math.max(mx[i],b.t[i]); }
  meta.push({
    id, label: ch.label, boxes: parts.length,
    size: [Math.round(mx[0]-mn[0]), Math.round(mx[1]-mn[1]), Math.round(mx[2]-mn[2])],
    height: Math.round(mx[1]-mn[1]),
    materialCount: new Set(parts.map(p=>p.m)).size,
    files: { front: 'front.png', threeQuarter: 'threeq.png', side: 'side.png' },
  });
  console.log(id, parts.length, 'boxes');
}

fs.writeFileSync(OUT + '/manifest.json', JSON.stringify({
  canvas: { w: 420, h: 540, ss: 2 },
  note: 'Voxel chibi characters. Authoritative geometry is the box list in ../source/chibi-chars.mjs; PNGs are reference renders.',
  characters: meta,
}, null, 2));

const sheet = characterSheet(all, `${OUT}/_previews/lineup.png`, { cell: 400, cols: 4 });
console.log('sheet:', JSON.stringify(sheet));

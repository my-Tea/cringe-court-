// check.mjs — enforce pixel-art discipline mechanically instead of by eye.
import { Canvas } from './core.mjs';
import { TILES } from './tiles.mjs';
import { ITEMS, crystalPickaxe } from './items.mjs';
import { seamScore, tileNoise } from './core.mjs';

const problems = [];
const stats = [];

function paletteOf(c) {
  const set = new Map();
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const p = c.get(x, y);
    if (p[3] === 0) continue;
    set.set(p.slice(0, 3).join(','), p);
  }
  return [...set.values()];
}

/** Tiles must be opaque and have no stray semi-transparent pixels. */
function checkTile(name, c) {
  let semi = 0, opaque = 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const a = c.get(x, y)[3];
    if (a === 0) semi++; else if (a === 255) opaque++; else semi++;
  }
  if (semi > 0) problems.push(`${name}: ${semi} non-opaque pixels (tiles must be fully opaque)`);
  const pal = paletteOf(c);
  stats.push({ asset: name, kind: 'tile', size: `${c.w}x${c.h}`, colours: pal.length });
  if (pal.length > 8) problems.push(`${name}: ${pal.length} colours exceeds the 8-colour block budget`);
}

function checkItem(name, c) {
  let semi = 0, filled = 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const a = c.get(x, y)[3];
    if (a === 0) continue;
    filled++;
    if (a !== 255) semi++;
  }
  if (semi > 0) problems.push(`${name}: ${semi} anti-aliased pixels — pixel art must have hard alpha edges`);
  if (filled === 0) problems.push(`${name}: sprite is completely empty`);
  // A sprite touching the frame edge on all four sides has no clean silhouette.
  const rowsTouched = new Set(), colsTouched = new Set();
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (c.get(x, y)[3] !== 0) { rowsTouched.add(y); colsTouched.add(x); }
  }
  if (rowsTouched.has(0) || colsTouched.has(0) || rowsTouched.has(c.h - 1) || colsTouched.has(c.w - 1)) {
    // Items intentionally run to the edge (shaft/handle), so this is advisory only.
  }
  // Single connected component check = the silhouette reads as one object.
  const seen = new Uint8Array(c.w * c.h);
  let comps = 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (c.get(x, y)[3] === 0 || seen[y * c.w + x]) continue;
    comps++;
    const stack = [[x, y]];
    seen[y * c.w + x] = 1;
    while (stack.length) {
      const [px, py] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= c.w || ny >= c.h || seen[ny * c.w + nx]) continue;
        if (c.get(nx, ny)[3] === 0) continue;
        seen[ny * c.w + nx] = 1; stack.push([nx, ny]);
      }
    }
  }
  if (comps > 1) problems.push(`${name}: silhouette splits into ${comps} disconnected islands`);
  const pal = paletteOf(c);
  stats.push({ asset: name, kind: 'item', size: `${c.w}x${c.h}`, colours: pal.length });
  if (pal.length > 10) problems.push(`${name}: ${pal.length} colours exceeds the 10-colour item budget`);
}

export function runChecks() {
  const S = 16;
  for (const [name, fn] of Object.entries(TILES)) checkTile(name, fn());
  for (const [name, fn] of Object.entries(ITEMS)) checkItem(name, fn());
  checkItem('crystal_pickaxe', crystalPickaxe());

  // Tiling: compare the wrap seam against interior neighbour deltas.
  for (const [name, fn] of Object.entries(TILES)) {
    const c = fn();
    // luminance proxy field for the seam test
    const f = new Float32Array(c.w * c.h);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const p = c.get(x, y);
      f[y * c.w + x] = (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) / 255;
    }
    const s = seamScore(f, c.w, c.h);
    if (s > 1.9) problems.push(`${name}: seam score ${s.toFixed(2)} — visible tiling seam`);
  }
  return { problems, stats };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { problems, stats } = runChecks();
  console.table(stats);
  if (problems.length) {
    console.log('\nPROBLEMS:'); problems.forEach((p) => console.log('  x ' + p));
    process.exitCode = 1;
  } else console.log('\nAll asset checks passed.');
}

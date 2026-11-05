// Block textures — 16x16, native voxel size, in the CringeCourt palette.
// Theme: bright polished marble, warm gold, burgundy, daylight.
import { Canvas, tileNoise, bucketize, DITHER, mulberry32 } from './core.mjs';
import { PAL, RAMPS } from './palette.mjs';

const T = 16;

function rampTile(ramp, opts) {
  const { seed = 1, cells = 4, octaves = 3, dither = DITHER.checker, speck = 0.06, structure = null } = opts;
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells, octaves, seed });
  const R = ramp;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let i = bucketize(n[y * T + x], R.length, { dither, x, y });
    const r = mulberry32(x * 7919 + y * 1299709 + seed)();
    if (r > 1 - speck) i = Math.max(0, i - 1);
    else if (r < speck * 0.7) i = Math.min(R.length - 1, i + 1);
    if (structure) i = structure(x, y, i, R.length);
    c.set(x, y, R[Math.max(0, Math.min(R.length - 1, i))]);
  }
  return c;
}

// --- marble: near-white with faint warm veins
function marble(seed = 5) {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 2, octaves: 2, seed });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = n[y * T + x];
    // veins: diagonal streaks
    const vein = Math.abs(((x + y * 2 + Math.floor(v * 6)) % 11) - 5) < 1;
    let col = PAL.neu5;
    if (vein) col = PAL.neu4;
    else if (v > 0.62) col = '#FFFFFF';
    else if (v < 0.28) col = PAL.neu4;
    c.set(x, y, col);
  }
  return c;
}

// --- polished marble floor tile with gold inlay border
function marbleFloor() {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 2, octaves: 2, seed: 9 });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const edge = x === 0 || y === 0 || x === T - 1 || y === T - 1;
    if (edge) { c.set(x, y, PAL.gold3); continue; }
    const v = n[y * T + x];
    c.set(x, y, v > 0.66 ? '#FFFFFF' : v < 0.3 ? PAL.neu4 : PAL.neu5);
  }
  return c;
}

// --- gold leaf / polished gold
function gold() {
  const c = new Canvas(T, T);
  const R = RAMPS.gold;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const sheen = Math.sin((x * 0.9 + y * 0.5)) * 0.5 + 0.5;
    let i = Math.round(sheen * 2) + 1;
    if (x % 5 === 0 || y % 5 === 0) i = Math.max(0, i - 1);
    c.set(x, y, R[Math.max(0, Math.min(R.length - 1, i))]);
  }
  return c;
}

// --- burgundy roof shingles
function roof() {
  const c = new Canvas(T, T);
  const R = RAMPS.roof;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = Math.floor(y / 4);
    const off = (row % 2) * 4;
    const shingle = (x + off) % 8;
    let i = 2;
    if (y % 4 === 3) i = 0;
    else if (shingle === 0) i = 0;
    else if (y % 4 === 0) i = 3;
    else i = 2 + ((x * 7 + y * 3) % 5 === 0 ? 1 : 0);
    c.set(x, y, R[Math.max(0, Math.min(R.length - 1, i))]);
  }
  return c;
}

// --- dark wood (benches, desks)
function wood() {
  const c = new Canvas(T, T);
  const R = [PAL.gold1, PAL.gold2, PAL.gold3];
  const rnd = mulberry32(31);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const board = Math.floor(y / 4);
    const seam = (board % 2 === 0) ? 11 : 4;
    let i = 1;
    if (y % 4 === 3) i = 0;
    else if (x === seam) i = 0;
    else {
      const g = Math.sin((x + board * 2.7) * 0.8) * 0.5 + 0.5;
      i = g > 0.7 ? 2 : 1;
      if (rnd() > 0.9) i = 0;
    }
    c.set(x, y, R[i]);
  }
  return c;
}

// --- grass (village / courtyard)
function grass() {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 3, octaves: 3, seed: 17 });
  const R = RAMPS.grass;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let i = bucketize(n[y * T + x], R.length, { dither: DITHER.sparse, x, y });
    const r = mulberry32(x * 928371 + y * 1299709 + 3)();
    if (r > 0.87) { c.set(x, y, R[Math.min(3, i + 1)]); continue; }
    if (r < 0.08) i = Math.max(0, i - 1);
    c.set(x, y, R[i]);
  }
  return c;
}

// --- cobblestone / paved courtyard
function cobble() {
  const rnd = mulberry32(77);
  const seeds = [];
  for (let i = 0; i < 9; i++) seeds.push({ x: (i % 3) * 5.2 + 1 + rnd() * 3, y: Math.floor(i / 3) * 5.2 + 1 + rnd() * 3, t: rnd() });
  const R = [PAL.neu2, PAL.neu3, PAL.neu4, PAL.neu5];
  const c = new Canvas(T, T);
  const id = new Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let best = 1e9, bi = 0;
    for (let s = 0; s < seeds.length; s++) {
      let dx = Math.abs(x + 0.5 - seeds[s].x); dx = Math.min(dx, T - dx);
      let dy = Math.abs(y + 0.5 - seeds[s].y); dy = Math.min(dy, T - dy);
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; bi = s; }
    }
    id[y * T + x] = bi;
  }
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const s = id[y * T + x];
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => id[((y + dy + T) % T) * T + ((x + dx + T) % T)] !== s);
    if (edge) { c.set(x, y, R[0]); continue; }
    const above = id[((y - 1 + T) % T) * T + x] !== s;
    c.set(x, y, R[above ? 3 : 1 + Math.floor(seeds[s].t * 2)]);
  }
  return c;
}

// --- red carpet (with gold trim rows)
function carpet() {
  const c = new Canvas(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const trim = y === 0 || y === T - 1;
    const weave = (x * 3 + y * 5) % 7 === 0;
    c.set(x, y, trim ? PAL.gold4 : weave ? PAL.royal1 : PAL.royal2);
  }
  return c;
}

// --- water (fountain pools)
function water() {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 4, octaves: 2, seed: 41 });
  const R = RAMPS.water;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let i = bucketize(n[y * T + x], R.length, { dither: DITHER.diagonal, x, y });
    if ((y + Math.floor(n[y * T + x] * 4)) % 6 === 0) i = 3; // caustic highlight
    c.set(x, y, R[i]);
  }
  return c;
}

// --- velvet (throne upholstery)
function velvet() {
  const c = new Canvas(T, T);
  const R = [PAL.royal1, PAL.royal2, PAL.royal3];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const fold = Math.sin(x * 1.6) * 0.5 + 0.5;
    const i = fold > 0.72 ? 2 : fold > 0.34 ? 1 : 0;
    c.set(x, y, R[i]);
  }
  return c;
}

// --- banner cloth with a scales motif row
function banner() {
  const c = new Canvas(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const border = x === 0 || x === T - 1;
    c.set(x, y, border ? PAL.gold3 : PAL.royal1);
  }
  // simple scales glyph - horizontal bar, pivot, two pans
  const G = PAL.gold4;
  for (let x = 4; x <= 11; x++) c.set(x, 6, G);
  c.set(7, 5, G); c.set(7, 7, G); c.set(8, 5, G); c.set(8, 7, G);
  for (let x = 3; x <= 5; x++) c.set(x, 9, G);
  for (let x = 10; x <= 12; x++) c.set(x, 9, G);
  c.set(4, 8, G); c.set(11, 8, G);
  return c;
}

// --- parchment (UI / paper)
function parchment() {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 3, octaves: 2, seed: 23 });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = n[y * T + x];
    c.set(x, y, v > 0.7 ? '#FFFFFF' : v < 0.3 ? PAL.neu4 : PAL.neu5);
  }
  return c;
}

// --- marble pillar shaft (vertical fluting)
function pillar() {
  const c = new Canvas(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const flute = x % 4;
    const v = flute === 0 ? PAL.neu3 : flute === 3 ? '#FFFFFF' : PAL.neu5;
    c.set(x, y, v);
  }
  return c;
}

export const BLOCKS = {
  marble, marble_floor: marbleFloor, gold, roof, wood, grass, cobble, carpet,
  water, velvet, banner, parchment, pillar,
};

export function buildBlocks(outDir) {
  const names = Object.keys(BLOCKS);
  const out = [];
  for (const name of names) {
    const c = BLOCKS[name]();
    out.push(c.save(`${outDir}/textures/blocks/${name}.png`));
  }
  return out;
}

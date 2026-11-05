// tiles.mjs — 16x16 tileable block textures, Minecraft-native resolution
// but with hue-shifted ramps, controlled dithering and real material noise.
import { Canvas, ramp, tileNoise, bucketize, DITHER, mulberry32, hsl } from './core.mjs';

const T = 16; // native block texture size — keep this, it's the MC convention

/* ------------------------------------------------------------ generators */

function grassTop() {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 3, octaves: 3, seed: 11 });
  // Wider ramp (dark 16 → light 66) so the surface has real depth instead of
  // reading as one bright green square.
  const R = ramp(102, 52, { dark: 16, light: 66, steps: 6, shift: 22 });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = n[y * T + x];
    let i = bucketize(v, 6, { dither: DITHER.sparse, x, y });
    const r = mulberry32(x * 928371 + y * 1299709 + 7)();
    // Blade strokes: vertical 2px light dashes read as individual blades and
    // stop the tile looking like a smooth gradient.
    if (r > 0.86) { c.set(x, y, R[Math.min(5, i + 2)]); if (y % 2 === 0) c.set(x, y + 1, R[Math.min(5, i + 1)]); continue; }
    // Dark notches between tufts.
    if (r < 0.10) i = Math.max(0, i - 2);
    c.set(x, y, R[Math.min(5, i)]);
  }
  return c;
}

function grassSide() {
  // dirt body with a green lip that hangs down in ragged pixel tufts
  const c = dirtBody(3);
  const R = ramp(96, 46, { dark: 24, light: 62, steps: 5, shift: 20 });
  const rnd = mulberry32(4242);
  for (let x = 0; x < T; x++) {
    const depth = 2 + Math.floor(rnd() * 3); // 2..4 px of grass per column
    for (let y = 0; y < depth; y++) {
      c.set(x, y, R[y === depth - 1 ? 1 : (y === 0 ? 4 : 3)]);
    }
    // a single tuft hanging one pixel further, some columns only
    if (rnd() > 0.6) c.set(x, depth, R[1]);
  }
  return c;
}

function dirtBody(seed = 3) {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 4, octaves: 3, seed });
  const R = ramp(26, 34, { dark: 20, light: 46, steps: 5, shift: 14 });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = n[y * T + x];
    let i = bucketize(v, 5, { dither: DITHER.checker, x, y });
    // pebbles: isolated 1px darker nodules
    const r = mulberry32(x * 7919 + y * 104729 + seed)();
    if (r > 0.9) i = Math.max(0, i - 2);
    else if (r > 0.84) i = Math.min(4, i + 1);
    c.set(x, y, R[i]);
  }
  return c;
}

function stone() {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 4, octaves: 3, seed: 21 });
  const R = ramp(222, 9, { dark: 22, light: 62, steps: 6, shift: 12 }); // cool grey
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let i = bucketize(n[y * T + x], 6, { dither: DITHER.quarter, x, y });
    const r = mulberry32(x * 31337 + y * 6151 + 5)();
    if (r > 0.95) i = Math.max(0, i - 2); // aggregate pits
    else if (r > 0.90) i = Math.min(5, i + 1);
    // Horizontal fracture lines: rock reads as layered, not as TV static.
    if ((x * 3 + y * 11) % 37 < 2 && i > 1) i = Math.max(0, i - 2);
    c.set(x, y, R[i]);
  }
  return c;
}

function cobblestone() {
  // Voronoi-ish stones: pick seed points, colour each pixel by nearest seed.
  const rnd = mulberry32(99);
  const seeds = [];
  for (let i = 0; i < 9; i++) seeds.push({ x: (i % 3) * 5.2 + 1 + rnd() * 3, y: Math.floor(i / 3) * 5.2 + 1 + rnd() * 3, t: rnd() });
  const R = ramp(215, 7, { dark: 22, light: 62, steps: 6, shift: 12 });
  const c = new Canvas(T, T);
  const id = new Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // wrap-aware distance so the tile stays seamless
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
    // mortar: pixel whose 4-neighbourhood belongs to another stone
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const xx = (x + dx + T) % T, yy = (y + dy + T) % T;
      return id[yy * T + xx] !== s;
    });
    if (edge) { c.set(x, y, R[0]); continue; }
    // per-stone base tone, with a light top edge to fake thickness
    const base = 2 + Math.floor(seeds[s].t * 3);
    const above = id[((y - 1 + T) % T) * T + x] !== s;
    c.set(x, y, R[above ? Math.min(5, base + 2) : base]);
  }
  return c;
}

function planks() {
  // horizontal boards, 4px tall, with staggered end seams and grain lines
  const c = new Canvas(T, T);
  const R = ramp(32, 44, { dark: 24, light: 58, steps: 5, shift: 14 });
  const rnd = mulberry32(7);
  for (let y = 0; y < T; y++) {
    const board = Math.floor(y / 4);
    const endSeam = (board % 2 === 0) ? 11 : 4; // stagger the vertical join
    for (let x = 0; x < T; x++) {
      let i = 2;
      if (y % 4 === 0) i = 0;               // dark groove between boards
      else if (y % 4 === 3) i = 1;          // shadow under the groove
      else if (x === endSeam) i = 0;        // board end
      else {
        // grain: slight tone variation along the board
        const g = Math.sin((x + board * 3.1) * 0.9) * 0.5 + 0.5;
        i = 2 + (g > 0.72 ? 1 : 0);
        if (rnd() > 0.93) i = 1;
      }
      c.set(x, y, R[i]);
    }
  }
  return c;
}

function sand() {
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 6, octaves: 2, seed: 33 });
  const R = ramp(45, 48, { dark: 52, light: 80, steps: 5, shift: 10 });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let i = bucketize(n[y * T + x], 5, { dither: DITHER.diagonal, x, y });
    const r = mulberry32(x * 1299721 + y * 37)();
    if (r > 0.95) i = Math.max(0, i - 1);
    c.set(x, y, R[i]);
  }
  return c;
}

function crystal() {
  // hero block: deep violet facets with a hot cyan emissive core
  const c = new Canvas(T, T);
  const n = tileNoise(T, T, { cells: 3, octaves: 3, seed: 55 });
  const R = ramp(272, 58, { dark: 16, light: 58, steps: 6, shift: 18 });
  const glow = ramp(188, 82, { dark: 40, light: 88, steps: 4, shift: 10 });
  const cx = 7.5, cy = 7.5;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // faceted diamond core
    const d = Math.abs(x - cx) + Math.abs(y - cy);
    if (d < 3.2) { c.set(x, y, glow[3]); continue; }
    if (d < 4.6) { c.set(x, y, glow[1]); continue; }
    let i = bucketize(n[y * T + x], 6, { dither: DITHER.checker, x, y });
    // facet lines radiate from centre → reads as cut gemstone
    const ang = Math.atan2(y - cy, x - cx);
    const spoke = Math.abs(Math.sin(ang * 3)) < 0.12;
    if (spoke && d < 7.6) i = Math.min(5, i + 1);
    c.set(x, y, R[i]);
  }
  return c;
}

/* ---------------------------------------------------------------- export */
export const TILES = {
  'grass_top': grassTop,
  'grass_side': grassSide,
  'dirt': () => dirtBody(3),
  'stone': stone,
  'cobblestone': cobblestone,
  'oak_planks': planks,
  'sand': sand,
  'crystal': crystal,
};

export function buildTiles(outDir) {
  const made = [];
  for (const [name, fn] of Object.entries(TILES)) {
    const c = fn();
    made.push(c.save(`${outDir}/blocks/${name}.png`));
    c.scale(4).save(`${outDir}/blocks/@4x/${name}.png`);
  }
  return made;
}

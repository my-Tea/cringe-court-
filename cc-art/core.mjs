// core.mjs — deterministic pixel-art primitives.
// Hard edges only. No anti-aliasing anywhere: every value is an integer pixel.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------- random */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------------------------------------------------------- color */
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Hue-shifted colour ramp: shadows shift cool, highlights shift warm.
 *  This is the single biggest difference between flat art and good pixel art. */
export function ramp(hue, sat, { dark = 18, light = 78, steps = 5, shift = 16 } = {}) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const h = hue + (0.5 - t) * shift * 2;
    const s = sat * (1 - Math.abs(t - 0.5) * 0.45);
    out.push(hsl(h, Math.min(100, s), dark + t * (light - dark)));
  }
  return out;
}

export const alpha0 = [0, 0, 0, 0];

/** Accept '#RRGGBB' / '#RGB' / 'rgb()' and normalise to [r,g,b] or [r,g,b,a].
 *  Draw code can then pass palette hex strings directly without conversion. */
export function parseColor(c) {
  if (typeof c !== 'string') return c;
  const s = c.trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    if (h.length === 8) {
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16)];
    }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(',').map((n) => Math.round(parseFloat(n.trim())));
  return [0, 0, 0];
}

/* ---------------------------------------------------------------- canvas */
export class Canvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  idx(x, y) { return (y * this.w + x) * 4; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    if (!this.inb(x, y)) return;
    if (typeof c === 'string') c = parseColor(c);
    const i = this.idx(x, y);
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? c[3] : 255;
  }
  get(x, y) {
    if (!this.inb(x, y)) return alpha0;
    const i = this.idx(x, y);
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  fill(c) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c); }
  rect(x, y, w, h, c) {
    if (typeof c === 'string') c = parseColor(c);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  line(x0, y0, x1, y1, c, thickness = 1) {
    // Bresenham with a square brush — keeps perfectly hard edges.
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
    const o = Math.floor((thickness - 1) / 2);
    for (;;) {
      for (let j = 0; j < thickness; j++) for (let i = 0; i < thickness; i++) this.set(x0 + i - o, y0 + j - o, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  /** Dilate the opaque silhouette by 1px and paint that ring with `c`.
   *  Produces the crisp dark outline real sprites have. */
  outline(c) {
    const src = this.clone();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src.get(x, y)[3] !== 0) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => src.get(x + dx, y + dy)[3] !== 0);
      if (n) this.set(x, y, c);
    }
    return this;
  }
  /** Only draw the outline into empty pixels adjacent to the silhouette, keeping the
   *  silhouette itself untouched (for shapes that are lighter than the outline). */
  shadeFromSilhouette(fn) {
    const src = this.clone();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src.get(x, y)[3] !== 0) continue;
      const up = src.get(x, y - 1), dn = src.get(x, y + 1);
      if (up[3] !== 0) this.set(x, y, fn('bottom'));
      if (dn[3] !== 0) this.set(x, y, fn('top'));
    }
    return this;
  }
  clone() {
    const c = new Canvas(this.w, this.h);
    c.data.set(this.data);
    return c;
  }
  /** Nearest-neighbour integer upscale — never interpolate pixel art. */
  scale(n) {
    const c = new Canvas(this.w * n, this.h * n);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const p = this.get(x, y);
      c.rect(x * n, y * n, n, n, p);
    }
    return c;
  }
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const p = src.get(x, y);
      if (p[3] !== 0) this.set(ox + x, oy + y, p);
    }
    return this;
  }
  png() {
    const png = new PNG({ width: this.w, height: this.h });
    png.data = Buffer.from(this.data);
    return PNG.sync.write(png, { colorType: 6 });
  }
  save(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.png());
    return file;
  }
}

/* ------------------------------------------------------ tileable texture */
/** Tileable value noise. The lattice wraps, so the field is exactly periodic
 *  on the tile boundary — this is why the output tiles without visible seams. */
export function tileNoise(w, h, { cells = 4, octaves = 3, seed = 1, persistence = 0.5 } = {}) {
  const rnd = mulberry32(seed);
  const field = new Float32Array(w * h);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const c = Math.max(1, Math.round(cells * Math.pow(2, o)));
    const g = new Float32Array(c * c);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = (x / w) * c, fy = (y / h) * c;
      const x0 = Math.floor(fx) % c, y0 = Math.floor(fy) % c;
      const x1 = (x0 + 1) % c, y1 = (y0 + 1) % c;
      let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[y0 * c + x0], b = g[y0 * c + x1];
      const cc = g[y1 * c + x0], d = g[y1 * c + x1];
      const top = a + (b - a) * tx, bot = cc + (d - cc) * tx;
      field[y * w + x] += (top + (bot - top) * ty) * amp;
    }
    total += amp; amp *= persistence;
  }
  for (let i = 0; i < field.length; i++) field[i] /= total;
  return field;
}

/** Seam quality: 1.0 means the wrap-between-edge difference is statistically
 *  identical to a normal interior neighbour step, i.e. truly tileable. */
export function seamScore(field, w, h) {
  let seam = 0, interior = 0, n = 0;
  for (let y = 0; y < h; y++) seam += Math.abs(field[y * w] - field[y * w + w - 1]), n++;
  const s = seam / n;
  let im = 0, m = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) im += Math.abs(field[y * w + x] - field[y * w + x + 1]), m++;
  const i = im / m;
  return i === 0 ? 1 : s / i; // ~1 = seamless, >2 = visible seam
}

/* -------------------------------------------------------------- dithering */
export const DITHER = {
  checker: (x, y) => (x + y) % 2 === 0,
  quarter: (x, y) => (y % 2 === 0) && (x % 2 === 0),
  diagonal: (x, y) => x % 2 === y % 2,
  sparse: (x, y) => (x + y * 2) % 3 === 0,
};

/** Map a 0..1 scalar field onto a ramp bucket, with optional ordered dithering
 *  between buckets so gradients stay chunky instead of banded. */
export function bucketize(v, steps, { dither = null, x = 0, y = 0 } = {}) {
  let pos = v * (steps - 1);
  let lo = Math.floor(pos);
  const frac = pos - lo;
  if (dither && dither(x, y) && frac > 0.5) lo += 1;
  return Math.max(0, Math.min(steps - 1, Math.round(lo)));
}

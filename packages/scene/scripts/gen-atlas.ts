// Per-character sprite atlases for the 3D courtroom (ANIMATION-GUIDE §7: "use a
// per-character texture atlas"). Each pose PNG in cc-art/dist is drawn on an
// opaque #161218 card; the card is flood-filled away from the edges, the frame
// is trimmed to its content and shelf-packed into one PNG per character.
//   npm run atlas -w @cringe-court/scene            regenerate assets/atlas/*
//   npm run atlas -w @cringe-court/scene -- --check exit 1 if anything is stale
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ART = fileURLToPath(new URL('../../../cc-art/dist/characters/', import.meta.url));
const OUT = fileURLToPath(new URL('../assets/atlas/', import.meta.url));
const PANEL = [22, 18, 24] as const;
const PAD = 2;
const MAX_W = 2048;

export const ATLAS_CHARACTERS = ['judge', 'prosecutor', 'defense', 'bailiff', 'clerk', 'juror', 'creator', 'side-a', 'side-b', 'ai-narrator'] as const;

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Trim offset inside the source canvas (top-left). */
  ox: number;
  oy: number;
}

function cutout(png: PNG): PNG {
  const { width: w, height: h, data } = png;
  const isBackground = (i: number) =>
    data[i * 4 + 3] === 0 || (data[i * 4] === PANEL[0] && data[i * 4 + 1] === PANEL[1] && data[i * 4 + 2] === PANEL[2]);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i] || !isBackground(i)) continue;
    seen[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] === 0) data.fill(0, i * 4, i * 4 + 4);
  return png;
}

function bounds(png: PNG): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++)
      if (png.data[(y * png.width + x) * 4 + 3]! > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error('empty frame');
  return { x0, y0, x1, y1 };
}

function build(character: string) {
  const dir = `${ART}${character}/poses/`;
  const poses = readdirSync(dir)
    .filter((f) => f.endsWith('.png') && !f.includes('@2x'))
    .map((f) => f.replace(/\.png$/, ''))
    .sort();
  const sources = poses.map((pose) => {
    const png = cutout(PNG.sync.read(readFileSync(`${dir}${pose}.png`)));
    return { pose, png, b: bounds(png) };
  });
  const canvas = { w: sources[0]!.png.width, h: sources[0]!.png.height };
  // Shelf packing, tallest first (stable by name).
  const order = [...sources].sort((a, b) => b.b.y1 - b.b.y0 - (a.b.y1 - a.b.y0) || a.pose.localeCompare(b.pose));
  const frames: Record<string, Frame> = {};
  let x = PAD, y = PAD, shelf = 0, width = 0;
  for (const s of order) {
    const w = s.b.x1 - s.b.x0 + 1;
    const h = s.b.y1 - s.b.y0 + 1;
    if (x + w + PAD > MAX_W) {
      x = PAD;
      y += shelf + PAD;
      shelf = 0;
    }
    frames[s.pose] = { x, y, w, h, ox: s.b.x0, oy: s.b.y0 };
    x += w + PAD;
    shelf = Math.max(shelf, h);
    width = Math.max(width, x);
  }
  const height = y + shelf + PAD;
  const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(n));
  const atlas = new PNG({ width: pow2(width), height: pow2(height) });
  atlas.data.fill(0);
  for (const s of sources) {
    const f = frames[s.pose]!;
    for (let yy = 0; yy < f.h; yy++) {
      const src = ((s.b.y0 + yy) * s.png.width + s.b.x0) * 4;
      const dst = ((f.y + yy) * atlas.width + f.x) * 4;
      s.png.data.copy(atlas.data, dst, src, src + f.w * 4);
    }
  }
  const idle = frames.idle!;
  return {
    png: PNG.sync.write(atlas, { colorType: 6 }),
    meta: {
      image: `${character}.png`,
      size: { w: atlas.width, h: atlas.height },
      canvas,
      /** Bottom of the idle pose's content, i.e. where the feet are, in canvas pixels. */
      baseline: idle.oy + idle.h,
      contentHeight: idle.h,
      frames: Object.fromEntries(Object.keys(frames).sort().map((k) => [k, frames[k]!])),
    },
  };
}

const check = process.argv.includes('--check');
mkdirSync(OUT, { recursive: true });
const manifest: Record<string, unknown> = {};
let stale = 0;
const compare = (file: string, fresh: Buffer) => {
  if (check) {
    if (!existsSync(file) || !readFileSync(file).equals(fresh)) {
      console.error(`stale: ${file}`);
      stale++;
    }
  } else writeFileSync(file, fresh);
};
for (const c of ATLAS_CHARACTERS) {
  const { png, meta } = build(c);
  manifest[c] = meta;
  compare(`${OUT}${c}.png`, png);
}
compare(`${OUT}atlas.json`, Buffer.from(`${JSON.stringify({ schemaVersion: 1, source: 'cc-art/dist/characters/*/poses/*.png', characters: manifest }, null, 2)}\n`));
if (check && stale) {
  console.error(`${stale} atlas file(s) stale. Run \`npm run atlas -w @cringe-court/scene\`.`);
  process.exit(1);
}
console.log(check ? 'atlases up to date' : `wrote ${ATLAS_CHARACTERS.length} atlases to ${OUT}`);

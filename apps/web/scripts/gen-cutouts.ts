// Pose sprites in cc-art/dist are rendered on an opaque #161218 panel (a "card").
// The web stages need true cutouts, so this flood-fills the panel from the image
// edges to transparent. Interior pixels of the same colour are kept.
//   npm run cutouts            regenerate src/art/cutouts/*.png
//   npm run cutouts -- --check exit 1 if any committed cutout is stale or missing
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { STAGE_POSES } from '../src/art/stagePoses.ts';

const ART = fileURLToPath(new URL('../../../cc-art/dist/characters/', import.meta.url));
const OUT = fileURLToPath(new URL('../src/art/cutouts/', import.meta.url));
const PANEL = [22, 18, 24] as const;

function cutout(src: Buffer): Buffer {
  const png = PNG.sync.read(src);
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
  // Zero the colour of transparent pixels so output is byte-stable.
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] === 0) data.fill(0, i * 4, i * 4 + 4);
  return PNG.sync.write(png, { colorType: 6 });
}

const check = process.argv.includes('--check');
mkdirSync(OUT, { recursive: true });
const expected = new Set<string>();
let stale = 0;
for (const [character, pose] of STAGE_POSES) {
  const name = `${character}__${pose}.png`;
  expected.add(name);
  const fresh = cutout(readFileSync(`${ART}${character}/poses/${pose}@2x.png`));
  if (check) {
    let current: Buffer | null = null;
    try {
      current = readFileSync(OUT + name);
    } catch {
      // missing counts as stale
    }
    if (!current || !current.equals(fresh)) {
      console.error(`stale: ${name}`);
      stale++;
    }
  } else {
    writeFileSync(OUT + name, fresh);
  }
}
const extra = readdirSync(OUT).filter((f) => !expected.has(f));
if (check) {
  for (const f of extra) console.error(`not in STAGE_POSES: ${f}`);
  if (stale || extra.length) {
    console.error('Cutouts are out of date. Run `npm run cutouts`.');
    process.exit(1);
  }
  console.log(`${expected.size} cutouts are up to date.`);
} else {
  console.log(`Wrote ${expected.size} cutouts to ${OUT}${extra.length ? ` (remove unused: ${extra.join(', ')})` : ''}`);
}

// Isometric pixel renderer for box-based props. Renders at 1 unit = 1px then
// nearest-upscales, which is what gives the reference image its pixel-art look.
import { Canvas } from './core.mjs';
import { parseColor } from './core.mjs';
import { PROPS, PROP_NAMES } from './props.mjs';

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

function shade(hex, mul) {
  const [r, g, b] = parseColor(hex);
  return [Math.min(255, r * mul) | 0, Math.min(255, g * mul) | 0, Math.min(255, b * mul) | 0, 255];
}

/** Render one prop's boxes to an isometric Canvas. */
export function renderProp(parts, pad = 2) {
  // Project every box corner to find bounds first.
  const proj = (x, y, z) => [(x - z) * COS30, (x + z) * SIN30 - y];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const b of parts) {
    for (const x of [b.f[0], b.t[0]]) for (const y of [b.f[1], b.t[1]]) for (const z of [b.f[2], b.t[2]]) {
      const [px, py] = proj(x, y, z);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  const w = Math.ceil(maxX - minX) + pad * 2 + 1;
  const h = Math.ceil(maxY - minY) + pad * 2 + 1;
  const c = new Canvas(w, h);
  const ox = -minX + pad, oy = -minY + pad;

  // Painter's algorithm: farther boxes first. Depth grows with x+z+... ; also
  // sort so higher y (further up) draws last.
  const order = parts
    .map((b, i) => ({
      b, i,
      d: (b.f[0] + b.t[0]) / 2 + (b.f[2] + b.t[2]) / 2 - (b.f[1] + b.t[1]) / 2,
    }))
    .sort((a, b) => a.d - b.d);

  for (const { b } of order) {
    const [x0, y0, z0] = b.f, [x1, y1, z1] = b.t;
    // Three-tone shading: top brightest, right mid, front (left) darkest.
    // A little extra contrast on small detail boxes keeps them readable.
    const vol = (x1 - x0) + (y1 - y0) + (z1 - z0);
    const boost = vol < 9 ? 0.06 : 0;
    const top = shade(b.m, 1.0 + boost);
    const left = shade(b.m, 0.66 - boost);
    const right = shade(b.m, 0.84);
    const edge = shade(b.m, 0.52 - boost);

    // helper: fill a projected quad by scanline
    const fillQuad = (p0, p1, p2, p3, col) => {
      const pts = [p0, p1, p2, p3].map(([x, y]) => [x + ox, y + oy]);
      const ys = pts.map((p) => p[1]);
      const yA = Math.ceil(Math.min(...ys)), yB = Math.floor(Math.max(...ys));
      for (let y = yA; y <= yB; y++) {
        const xs = [];
        for (let i = 0; i < 4; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 4];
          if ((ay <= y && by > y) || (by <= y && ay > y)) {
            xs.push(ax + (bx - ax) * ((y - ay) / (by - ay)));
          }
        }
        if (xs.length >= 2) {
          const xA = Math.ceil(Math.min(...xs)), xB = Math.floor(Math.max(...xs));
          for (let x = xA; x <= xB; x++) c.set(x, y, col);
        }
      }
    };

    // top face (y = y1)
    fillQuad(proj(x0, y1, z0), proj(x1, y1, z0), proj(x1, y1, z1), proj(x0, y1, z1), top);
    // right face (x = x1)
    fillQuad(proj(x1, y0, z1), proj(x1, y1, z1), proj(x1, y1, z0), proj(x1, y0, z0), right);
    // left/front face (z = z1)
    fillQuad(proj(x0, y0, z1), proj(x0, y1, z1), proj(x1, y1, z1), proj(x1, y0, z1), left);
    // 1px contact shadow on the ground-facing bottom edge of the silhouette
    if (y0 <= 1) {
      fillQuad(proj(x0, 0, z1), proj(x0, 0.5, z1), proj(x1, 0.5, z1), proj(x1, 0, z1), edge);
    }
  }
  return c;
}

/** Contact sheet of every prop, left-aligned into uniform cells. */
export function propSheet(outFile, scale = 5, cols = 7) {
  const imgs = PROP_NAMES.map((n) => ({ name: n, c: renderProp(PROPS[n].parts) }));
  const cw = Math.max(...imgs.map((i) => i.c.w)) + 6;
  const ch = Math.max(...imgs.map((i) => i.c.h)) + 6;
  const rows = Math.ceil(imgs.length / cols);
  const sheet = new Canvas(cols * cw + 4, rows * ch + 4);
  sheet.fill([30, 26, 28, 255]);
  imgs.forEach((im, i) => {
    const x = 4 + (i % cols) * cw + Math.floor((cw - im.c.w) / 2);
    const y = 4 + Math.floor(i / cols) * ch + (ch - im.c.h);
    sheet.blit(im.c, x, y);
  });
  sheet.save(outFile);
  sheet.scale(scale).save(outFile.replace(/\.png$/, `@${scale}x.png`));
  return { file: outFile, props: imgs.length, cell: [cw, ch] };
}

// Character renderer — orthographic front/elevated views with supersampled AA.
// Orthographic (not perspective) so every character is directly comparable and
// the silhouette reads like a sprite sheet.
import { Canvas, parseColor } from './core.mjs';

function shade(hex, mul) {
  const [r, g, b] = parseColor(hex);
  return [Math.min(255, r * mul) | 0, Math.min(255, g * mul) | 0, Math.min(255, b * mul) | 0, 255];
}

/** The 8 corners of a box, run through its optional affine transform `M`
 *  (row-major 3x4: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]). */
function corners(bx) {
  const [x0, y0, z0] = bx.f, [x1, y1, z1] = bx.t;
  const V = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const M = bx.M;
  if (!M) return V;
  return V.map(([x, y, z]) => [
    M[0] * x + M[1] * y + M[2] * z + M[3],
    M[4] * x + M[5] * y + M[6] * z + M[7],
    M[8] * x + M[9] * y + M[10] * z + M[11],
  ]);
}

/** World-space bounds of a box list, honouring per-box transforms. */
export function boundsOf(boxes) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const bx of boxes) for (const v of corners(bx)) for (let i = 0; i < 3; i++) {
    mn[i] = Math.min(mn[i], v[i]); mx[i] = Math.max(mx[i], v[i]);
  }
  return { mn, mx };
}

export function renderCharacter(boxes, opts = {}) {
  const {
    w = 480, h = 620, ss = 2,
    yaw = 18, pitch = 10,          // degrees: slight 3/4 + looking down a touch
    pad = 0.06, bg = [22, 18, 24, 255],
    bounds = null,                 // fixed framing, so a pose set shares one scale
  } = opts;
  const W = w * ss, H = h * ss;
  const c = new Canvas(W, H);
  c.fill(bg);

  const { mn, mx } = bounds || boundsOf(boxes);
  const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, cz = (mn[2] + mx[2]) / 2;
  const spanY = mx[1] - mn[1], spanX = mx[0] - mn[0];
  const scale = Math.min(H * (1 - pad * 2) / spanY, W * (1 - pad * 2) / Math.max(spanX, spanY * 0.62));

  const ry = (yaw * Math.PI) / 180, rp = (pitch * Math.PI) / 180;
  const cyw = Math.cos(ry), syw = Math.sin(ry), cp = Math.cos(rp), sp = Math.sin(rp);

  // NOTE: characters are authored facing -Z, and the camera sits on -Z looking
  // toward +Z. A positive yaw therefore has to rotate the OTHER way, or you
  // render the back of every character (which is exactly what happened once).

  // model → view: yaw about Y, then pitch about X, then screen projection
  const project = (p) => {
    let x = p[0] - cx, y = p[1] - cy, z = p[2] - cz;
    // flip the yaw sign so faces point at the camera
    let x1 = x * cyw - z * syw;
    let z1 = x * syw + z * cyw;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [W / 2 + x1 * scale, H / 2 - y2 * scale, z2];
  };

  // two-light rig
  const KEY = norm([-0.40, 0.78, 0.48]);
  const FILL = norm([0.66, 0.22, -0.42]);

  const faces = [];
  for (const bx of boxes) {
    const V = corners(bx);
    const M = bx.M;
    const F = [
      [[0, 1, 2, 3], [0, 0, -1]],
      [[5, 4, 7, 6], [0, 0, 1]],
      [[4, 0, 3, 7], [-1, 0, 0]],
      [[1, 5, 6, 2], [1, 0, 0]],
      [[4, 5, 1, 0], [0, -1, 0]],
      [[3, 2, 6, 7], [0, 1, 0]],
    ];
    for (const [idx, n0] of F) {
      const n = M ? [
        M[0] * n0[0] + M[1] * n0[1] + M[2] * n0[2],
        M[4] * n0[0] + M[5] * n0[1] + M[6] * n0[2],
        M[8] * n0[0] + M[9] * n0[1] + M[10] * n0[2],
      ] : n0;
      // rotate normal into view space for shading + culling
      const nx = n[0] * cyw - n[2] * syw;
      const nz1 = n[0] * syw + n[2] * cyw;
      const ny = n[1] * cp - nz1 * sp;
      const nz = n[1] * sp + nz1 * cp;
      // Backface cull. NOTE: eyes/iris/highlights are stacked boxes only 0.2–1
      // unit deep, so a strict epsilon here can cull the iris and leave a blank
      // white sclera. 0.02 is tight enough to cull real backfaces without
      // eating thin face detail.
      if (nz >= -0.02) continue;
      const pts = idx.map((i) => project(V[i]));
      const kd = Math.max(0, nx * KEY[0] + ny * KEY[1] + (nz) * KEY[2]);
      const fd = Math.max(0, nx * FILL[0] + ny * FILL[1] + nz * FILL[2]);
      // Front-facing surfaces need the most light — they carry the face.
      const frontBoost = nz < -0.7 ? 0.30 : 0;
      const lit = 0.62 + 0.60 * kd + 0.22 * fd + frontBoost;
      // face-type tint: tops brightest, fronts mid, sides darker — reads as form
      const faceMul = n[1] > 0.5 ? 1.02 : n[1] < -0.5 ? 0.60 : (Math.abs(n[0]) > 0.5 ? 0.80 : 1.06);
      const col = shade(bx.m, lit * faceMul);
      const zAvg = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
      faces.push({ pts, z: zAvg, col });
    }
  }
  // Painter's algorithm: draw FAR first. In view space a larger z2 is farther
  // from the camera (which sits at -Z), so sort DESCENDING. Sorting ascending
  // draws the face first and then paints the back of the head over it.
  faces.sort((a, b) => b.z - a.z);

  // Depth buffer. Sorting by a quad's AVERAGE depth is not enough: a large
  // face (the narrator's screen, a sclera) can average nearer than a small
  // feature sitting in front of part of it, and paint over it. Rasterise each
  // quad as two triangles with interpolated depth and keep the nearest.
  const zbuf = new Float32Array(W * H).fill(Infinity);
  const fillTri = (a, b2, c2, col) => {
    const yA = Math.ceil(Math.min(a[1], b2[1], c2[1])), yB = Math.floor(Math.max(a[1], b2[1], c2[1]));
    const xA = Math.ceil(Math.min(a[0], b2[0], c2[0])), xB = Math.floor(Math.max(a[0], b2[0], c2[0]));
    const den = (b2[1] - c2[1]) * (a[0] - c2[0]) + (c2[0] - b2[0]) * (a[1] - c2[1]);
    if (Math.abs(den) < 1e-9) return;
    for (let y = Math.max(0, yA); y <= Math.min(H - 1, yB); y++) {
      for (let x = Math.max(0, xA); x <= Math.min(W - 1, xB); x++) {
        const l1 = ((b2[1] - c2[1]) * (x - c2[0]) + (c2[0] - b2[0]) * (y - c2[1])) / den;
        const l2 = ((c2[1] - a[1]) * (x - c2[0]) + (a[0] - c2[0]) * (y - c2[1])) / den;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const z = l1 * a[2] + l2 * b2[2] + l3 * c2[2];
        const i = y * W + x;
        // <= so that, on exact ties, the later (nearer-sorted) face still wins
        if (z <= zbuf[i] + 1e-6) { zbuf[i] = z; c.set(x, y, col); }
      }
    }
  };
  const fillQuad = (pts, col) => { fillTri(pts[0], pts[1], pts[2], col); fillTri(pts[0], pts[2], pts[3], col); };
  for (const f of faces) fillQuad(f.pts, f.col);

  // downsample
  if (ss > 1) {
    const out = new Canvas(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b2 = 0;
      for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) {
        const p = c.get(x * ss + dx, y * ss + dy);
        r += p[0]; g += p[1]; b2 += p[2];
      }
      const n = ss * ss;
      out.set(x, y, [r / n | 0, g / n | 0, b2 / n | 0, 255]);
    }
    return out;
  }
  return c;
}

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

/** Contact sheet: all characters side by side at equal scale. */
export function characterSheet(chars, outFile, opts = {}) {
  const names = Object.keys(chars);
  const cell = opts.cell || 320;
  const cols = opts.cols || 4;
  const rows = Math.ceil(names.length / cols);
  const sheet = new Canvas(cols * cell, rows * cell);
  sheet.fill([24, 20, 26, 255]);
  names.forEach((n, i) => {
    const img = renderCharacter(chars[n], { w: cell, h: cell, yaw: 16, pitch: 9 });
    sheet.blit(img, (i % cols) * cell, Math.floor(i / cols) * cell);
  });
  sheet.save(outFile);
  sheet.scale(2).save(outFile.replace(/\.png$/, '@2x.png'));
  return { file: outFile, chars: names.length, cell, cols, rows };
}

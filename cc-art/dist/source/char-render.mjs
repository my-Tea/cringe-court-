// Character renderer — orthographic front/elevated views with supersampled AA.
// Orthographic (not perspective) so every character is directly comparable and
// the silhouette reads like a sprite sheet.
import { Canvas, parseColor } from './core.mjs';

function shade(hex, mul) {
  const [r, g, b] = parseColor(hex);
  return [Math.min(255, r * mul) | 0, Math.min(255, g * mul) | 0, Math.min(255, b * mul) | 0, 255];
}

export function renderCharacter(boxes, opts = {}) {
  const {
    w = 480, h = 620, ss = 2,
    yaw = 18, pitch = 10,          // degrees: slight 3/4 + looking down a touch
    pad = 0.06, bg = [22, 18, 24, 255],
  } = opts;
  const W = w * ss, H = h * ss;
  const c = new Canvas(W, H);
  c.fill(bg);

  // bounds
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const b of boxes) for (let i = 0; i < 3; i++) {
    mn[i] = Math.min(mn[i], b.f[i]); mx[i] = Math.max(mx[i], b.t[i]);
  }
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
    const [x0, y0, z0] = bx.f, [x1, y1, z1] = bx.t;
    const V = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const F = [
      [[0, 1, 2, 3], [0, 0, -1]],
      [[5, 4, 7, 6], [0, 0, 1]],
      [[4, 0, 3, 7], [-1, 0, 0]],
      [[1, 5, 6, 2], [1, 0, 0]],
      [[4, 5, 1, 0], [0, -1, 0]],
      [[3, 2, 6, 7], [0, 1, 0]],
    ];
    for (const [idx, n] of F) {
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

  const fillQuad = (pts, col) => {
    const ys = pts.map((p) => p[1]);
    const yA = Math.ceil(Math.min(...ys)), yB = Math.floor(Math.max(...ys));
    for (let y = yA; y <= yB; y++) {
      const xs = [];
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = pts[i], [bx2, by] = pts[(i + 1) % 4];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (bx2 - ax) * ((y - ay) / (by - ay)));
      }
      if (xs.length < 2) continue;
      const xA = Math.ceil(Math.min(...xs)), xB = Math.floor(Math.max(...xs));
      for (let x = xA; x <= xB; x++) c.set(x, y, col);
    }
  };
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

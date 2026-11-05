// Perspective renderer with painter depth sort — for full-scene hero shots.
// True perspective + backface culling + per-face lighting reads far closer to a
// game engine than the isometric sprite renderer.
import { Canvas, parseColor } from './core.mjs';

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

function shade(hex, mul) {
  const [r, g, b] = parseColor(hex);
  return [Math.min(255, r*mul)|0, Math.min(255, g*mul)|0, Math.min(255, b*mul)|0, 255];
}

/** Atmospheric depth: darken + cool toward the far plane, warm the near plane.
 *  This is what stops a flat-shaded voxel scene reading as a blueprint. */
function depthTint(col, z, near, far) {
  const t = Math.min(1, Math.max(0, (z - near) / (far - near)));
  const k = 1 - 0.52 * t;           // far is 48% darker
  const cool = [0.90, 0.94, 1.06];  // shift far toward blue
  return [
    Math.min(255, col[0] * k * (1 + (cool[0] - 1) * t)) | 0,
    Math.min(255, col[1] * k * (1 + (cool[1] - 1) * t)) | 0,
    Math.min(255, col[2] * k * (1 + (cool[2] - 1) * t)) | 0,
    255,
  ];
}

export function renderScene(boxes, cam, opts = {}) {
  // Render at 2x then box-downsample: cheap but effective AA for hard-edged
  // voxels, and it kills the stair-stepping on long diagonal edges.
  const { w: outW = 1600, h: outH = 1000, fov = 60, bg = [18, 14, 20, 255], ss = 2 } = opts;
  const w = outW * ss, h = outH * ss;
  const c = new Canvas(w, h);
  c.fill(bg);

  const fwd = norm(sub(cam.target, cam.pos));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const focal = (h / 2) / Math.tan((fov * Math.PI / 180) / 2);

  const project = (p) => {
    const d = sub(p, cam.pos);
    const z = dot(d, fwd);
    if (z <= 0.5) return null;
    const x = dot(d, right), y = dot(d, up);
    return [w / 2 + (x / z) * focal, h / 2 - (y / z) * focal, z];
  };

  // two-light rig: warm key from front-above-left, cool fill from the right
  const KEY = norm([-0.42, 0.80, 0.42]);
  const FILL = norm([0.65, 0.20, -0.35]);
  const KEY_COL = [1.0, 0.94, 0.84];
  const FILL_COL = [0.62, 0.70, 0.86];

  const faces = [];
  const zNear = 40, zFar = 340;
  for (const bx of boxes) {
    const [x0, y0, z0] = bx.f, [x1, y1, z1] = bx.t;
    const V = [
      [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
      [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],
    ];
    // 6 faces: [indices, normal]
    const F = [
      [[0,1,2,3],[0,0,-1]], // back  (-z)
      [[5,4,7,6],[0,0,1]],  // front (+z)
      [[4,0,3,7],[-1,0,0]], // left
      [[1,5,6,2],[1,0,0]],  // right
      [[4,5,1,0],[0,-1,0]], // bottom
      [[3,2,6,7],[0,1,0]],  // top
    ];
    for (const [idx, n] of F) {
      const ndl = dot(n, KEY);
      const nfl = Math.max(0, dot(n, FILL));
      const lit = nfl > 0.02 ? dot(n, FILL) : 0;
      // skip only faces that face fully away from the camera
      const pts = idx.map((i) => V[i]);
      const centroid = [
        (pts[0][0]+pts[1][0]+pts[2][0]+pts[3][0]) / 4,
        (pts[0][1]+pts[1][1]+pts[2][1]+pts[3][1]) / 4,
        (pts[0][2]+pts[1][2]+pts[2][2]+pts[3][2]) / 4,
      ];
      if (dot(n, sub(centroid, cam.pos)) > 0) continue;
      const proj = pts.map(project);
      if (proj.some((p) => p === null)) continue;
      const zAvg = (proj[0][2] + proj[1][2] + proj[2][2] + proj[3][2]) / 4;
      // key + fill, then a floor so nothing goes pure black
      const kd = Math.max(0, ndl), fd = Math.max(0, lit);
      const base = shade(bx.m, 1);
      const mixed = [
        base[0] * (0.40 + 0.62 * kd * KEY_COL[0] + 0.28 * fd * FILL_COL[0]),
        base[1] * (0.40 + 0.62 * kd * KEY_COL[1] + 0.28 * fd * FILL_COL[1]),
        base[2] * (0.40 + 0.62 * kd * KEY_COL[2] + 0.28 * fd * FILL_COL[2]),
        255,
      ].map((v) => Math.min(255, v) | 0);
      faces.push({ proj, z: zAvg, col: depthTint(mixed, zAvg, zNear, zFar), centroid });
    }
  }

  faces.sort((a, b) => b.z - a.z); // far → near

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
      for (let x = xA; x <= xB; x++) {
        c.set(x, y, col);
      }
    }
  };

  for (const f of faces) fillQuad(f.proj, f.col);

  // box downsample (supersample → 1x)
  if (ss > 1) {
    const out = new Canvas(outW, outH);
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < ss; dy++) {
          for (let dx = 0; dx < ss; dx++) {
            const p = c.get(x * ss + dx, y * ss + dy);
            r += p[0]; g += p[1]; b += p[2];
          }
        }
        const n = ss * ss;
        out.set(x, y, [r / n | 0, g / n | 0, b / n | 0, 255]);
      }
    }
    return out;
  }
  return c;
}

// 2D sprite engine — supersampled vector-ish drawing for anime chibi sprites.
//
// Pipeline: draw shapes on an oversized canvas, dilate the silhouette for a
// cartoon outline, then box-downsample. That gives clean anti-aliased edges and
// the bold outline the reference art has, which a pixel-buffer approach can't.
import { Canvas, parseColor } from './core.mjs';

const SS = 4;                        // supersample factor
const OUTLINE_STEPS = 16;            // stamps around the silhouette

export class Sprite {
  /** @param w,h logical size (final PNG size) */
  constructor(w = 256, h = 320) {
    this.w = w; this.h = h;
    this.c = new Canvas(w * SS, h * SS);
  }
  get k() { return SS; }             // coordinate multiplier

  /** Hex or [r,g,b] → normalized colour array. */
  static col(c, a = 255) {
    if (typeof c === 'string') return [...parseColor(c), a];
    return [c[0], c[1], c[2], a ?? 255];
  }

  /** Filled ellipse. `rot` in radians rotates the ellipse. */
  ellipse(cx, cy, rx, ry, fill, { rot = 0, stroke = null, sw = 0 } = {}) {
    const k = SS, c = this.c;
    const X = cx * k, Y = cy * k, RX = rx * k, RY = ry * k, SW = sw * k;
    const col = Sprite.col(fill), sCol = stroke ? Sprite.col(stroke) : null;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const ext = Math.ceil((Math.max(RX, RY) + SW) * 1.05);
    for (let dy = -ext; dy <= ext; dy++) {
      for (let dx = -ext; dx <= ext; dx++) {
        // rotate into ellipse space
        const lx = dx * cr + dy * sr;
        const ly = -dx * sr + dy * cr;
        const d = (lx * lx) / (RX * RX) + (ly * ly) / (RY * RY);
        if (d <= 1) c.set(Math.round(X + dx), Math.round(Y + dy), col);
        else if (sCol && SW > 0) {
          const oRx = RX + SW, oRy = RY + SW;
          const od = (lx * lx) / (oRx * oRx) + (ly * ly) / (oRy * oRy);
          const iRx = Math.max(0.1, RX - SW), iRy = Math.max(0.1, RY - SW);
          const id = (lx * lx) / (iRx * iRx) + (ly * ly) / (iRy * iRy);
          if (od <= 1 && id > 1) c.set(Math.round(X + dx), Math.round(Y + dy), sCol);
        }
      }
    }
    return this;
  }

  /** Filled rounded rectangle. */
  roundRect(x, y, w, h, r, fill, { stroke = null, sw = 0 } = {}) {
    const k = SS, c = this.c;
    const X = x * k, Y = y * k, W = w * k, H = h * k, R = Math.min(r * k, W / 2, H / 2);
    const col = Sprite.col(fill), sCol = stroke ? Sprite.col(stroke) : null;
    const SW = sw * k;
    for (let dy = -SW; dy < H + SW; dy++) {
      for (let dx = -SW; dx < W + SW; dx++) {
        const px = dx, py = dy;
        // inside test with rounded corners
        const inR = (R) => {
          if (px >= R && px <= W - R) return py >= -R + R - R || true ? (py >= -R && py <= H + R) : false;
          return false;
        };
        // simpler: distance to inner rect
        const cx = Math.min(Math.max(px, R), W - R);
        const cy = Math.min(Math.max(py, R), H - R);
        const dist = Math.hypot(px - cx, py - cy);
        const inside = px >= 0 && px <= W && py >= 0 && py <= H && dist <= R;
        const outerR = R + SW;
        const ocx = Math.min(Math.max(px, outerR), W - outerR);
        const ocy = Math.min(Math.max(py, outerR), H - outerR);
        const od = Math.hypot(px - ocx, py - ocy);
        const outside = px >= -SW && px <= W + SW && py >= -SW && py <= H + SW && od <= outerR;
        if (inside) c.set(Math.round(X + dx), Math.round(Y + dy), col);
        else if (sCol && outside) c.set(Math.round(X + dx), Math.round(Y + dy), sCol);
      }
    }
    return this;
  }

  /** Closed polygon from [x,y] points. */
  poly(pts, fill, { stroke = null, sw = 0 } = {}) {
    const k = SS, c = this.c;
    const P = pts.map(([x, y]) => [x * k, y * k]);
    const col = Sprite.col(fill), sCol = stroke ? Sprite.col(stroke) : null;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const [x, y] of P) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const SW = sw * k;
    for (let y = Math.floor(minY - SW); y <= Math.ceil(maxY + SW); y++) {
      const xs = [];
      for (let i = 0; i < P.length; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (bx - ax) * ((y - ay) / (by - ay)));
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i += 2) {
        for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) {
          c.set(x, y, col);
        }
      }
    }
    if (sCol && SW > 0) this.strokePolyline([...P, P[0]], sCol, SW);
    return this;
  }

  /** Thick line (round caps) — used for lashes, strands, outlines. */
  line(x1, y1, x2, y2, col, w = 2) {
    const k = SS;
    const X1 = x1 * k, Y1 = y1 * k, X2 = x2 * k, Y2 = y2 * k, W = (w * k) / 2;
    const steps = Math.max(2, Math.ceil(Math.hypot(X2 - X1, Y2 - Y1) / 1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = X1 + (X2 - X1) * t, py = Y1 + (Y2 - Y1) * t;
      this.dot(px, py, W, col);
    }
    return this;
  }

  /** Quadratic bezier as a thick stroke — organic hair strands. */
  curve(x0, y0, cx, cy, x1, y1, col, w = 3, steps = 24) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      pts.push([
        it * it * x0 + 2 * it * t * cx + t * t * x1,
        it * it * y0 + 2 * it * t * cy + t * t * y1,
      ]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w);
    }
    return this;
  }

  /** Filled bezier ribbon — a hair lock with volume. */
  ribbon(pts, widthFn, fill) {
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[Math.min(i + 1, pts.length - 1)];
      const r = pts[Math.max(i - 1, 0)];
      const dx = q[0] - r[0], dy = q[1] - r[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w = widthFn(i / (pts.length - 1)) / 2;
      left.push([p[0] + nx * w, p[1] + ny * w]);
      right.push([p[0] - nx * w, p[1] - ny * w]);
    }
    return this.poly([...left, ...right.reverse()], fill);
  }

  dot(px, py, r, col) {
    const R = Math.ceil(r);
    const C = Sprite.col(col);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy <= r * r) this.c.set(Math.round(px + dx), Math.round(py + dy), C);
      }
    }
  }

  strokePolyline(P, col, w) {
    for (let i = 0; i < P.length - 1; i++) {
      this.line(P[i][0] / SS, P[i][1] / SS, P[i + 1][0] / SS, P[i + 1][1] / SS, col, w / SS);
    }
  }

  /** Stamp this layer's silhouette in `col` at N offsets → cartoon outline. */
  outline(col = '#241A22', thickness = 1.6) {
    const k = SS;
    const layer = this.c.clone();       // keep the artwork
    const W = this.w * k, H = this.h * k;
    const C = Sprite.col(col);
    const T = thickness * k;

    // collect opaque mask
    const mask = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (layer.get(x, y)[3] > 8) mask.push([x, y]);
    }
    this.c = new Canvas(W, H);
    const steps = OUTLINE_STEPS;
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const ox = Math.round(Math.cos(a) * T), oy = Math.round(Math.sin(a) * T);
      for (const [x, y] of mask) {
        const nx = x + ox, ny = y + oy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) this.c.set(nx, ny, C);
      }
    }
    // artwork on top
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = layer.get(x, y);
      if (p[3] > 0) this.c.set(x, y, p);
    }
    return this;
  }

  /** Box-downsample to the logical size → clean AA edges. */
  done() {
    const k = SS, out = new Canvas(this.w, this.h);
    const a = k * k;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r = 0, g = 0, b = 0, al = 0;
        for (let dy = 0; dy < k; dy++) {
          for (let dx = 0; dx < k; dx++) {
            const p = this.c.get(x * k + dx, y * k + dy);
            const av = p[3] / 255;
            r += p[0] * av; g += p[1] * av; b += p[2] * av; al += p[3];
          }
        }
        const alpha = al / a;
        if (alpha < 1) out.set(x, y, [0, 0, 0, 0]);
        else {
          const sum = (al / 255) || 1;
          out.set(x, y, [Math.round(r / sum), Math.round(g / sum), Math.round(b / sum), Math.round(alpha)]);
        }
      }
    }
    return out;
  }
}

export { SS };

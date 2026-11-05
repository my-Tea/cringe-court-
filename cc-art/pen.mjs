// Sprite engine v2 — shape-first drawing with cel shading.
//
// The v1 engine could only stack ellipses, which is why the Judge read as a
// blob: no form, no focal shape, no cel shading. v2 draws shapes from a radius
// function and lets every pixel choose its own colour, so hard-edged 2-tone
// anime shading is free instead of faked with extra ellipses.
import { Canvas, parseColor } from './core.mjs';

const SS = 4;

/** Blend two hex colours. t=0 → a, t=1 → b. */
export function mix(a, b, t) {
  const A = parseColor(a), B = parseColor(b);
  return `#${[0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('')}`;
}
export function shade(hex, f) {
  const n = parseColor(hex);
  return `#${n.map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('')}`;
}

export class Pen {
  constructor(w = 256, h = 320) {
    this.w = w; this.h = h;
    this.c = new Canvas(w * SS, h * SS);
  }

  /* ───────────────────────────── primitives ───────────────────────────── */

  /** Radial shape. `rFn(angle)` → radius in design units. `colFn(x,y,d,a)` → colour. */
  shape(cx, cy, rFn, colFn) {
    const X = cx * SS, Y = cy * SS;
    let R = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.05) R = Math.max(R, rFn(a));
    const ext = Math.ceil(R * SS) + 2;
    for (let dy = -ext; dy <= ext; dy++) {
      for (let dx = -ext; dx <= ext; dx++) {
        const px = dx / SS, py = dy / SS;
        const d = Math.hypot(px, py);
        const a = Math.atan2(py, px);
        const rr = rFn(a);
        if (d <= rr) {
          const col = typeof colFn === 'function' ? colFn(cx + px, cy + py, d, a, rr) : colFn;
          this.c.set(Math.round(X + dx), Math.round(Y + dy), col);
        }
      }
    }
    return this;
  }

  /** Filled ellipse with optional cel shading. */
  ellipse(cx, cy, rx, ry, fill, { rot = 0, shadeCol = null, light = [-1, -1] } = {}) {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const L = Math.hypot(light[0], light[1]) || 1;
    const lx = light[0] / L, ly = light[1] / L;
    return this.shape(cx, cy, (a) => {
      const ca = Math.cos(a - rot), sa = Math.sin(a - rot);
      // radius of the rotated ellipse along this direction
      return 1 / Math.sqrt((ca * ca) / (rx * rx) + (sa * sa) / (ry * ry));
    }, (x, y) => {
      if (!shadeCol) return fill;
      // cel boundary: perpendicular to the light direction
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const t = dx * lx + dy * ly;
      return t > 0.30 ? shadeCol : fill;
    });
  }

  /** Rounded rectangle. */
  roundRect(x, y, w, h, r, fill, { shadeCol = null, light = [-1, -1] } = {}) {
    const R = Math.min(r, w / 2, h / 2);
    const inside = (px, py) => {
      if (px < x || px > x + w || py < y || py > y + h) return false;
      const cx = Math.min(Math.max(px, x + R), x + w - R);
      const cy = Math.min(Math.max(py, y + R), y + h - R);
      return Math.hypot(px - cx, py - cy) <= R;
    };
    const L = Math.hypot(light[0], light[1]) || 1;
    for (let py = y - 1; py <= y + h + 1; py += 1 / SS) {
      for (let px = x - 1; px <= x + w + 1; px += 1 / SS) {
        if (!inside(px, py)) continue;
        let col = fill;
        if (shadeCol) {
          const nx = (px - (x + w / 2)) / (w / 2);
          const ny = (py - (y + h / 2)) / (h / 2);
          const t = (nx * light[0] + ny * light[1]) / L;
          col = t > 0.28 ? shadeCol : fill;
        }
        this.c.set(Math.round(px * SS), Math.round(py * SS), col);
      }
    }
    return this;
  }

  /** Filled polygon. */
  poly(pts, fill) {
    const P = pts.map(([x, y]) => [x * SS, y * SS]);
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of P) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      for (let i = 0; i < P.length; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (bx - ax) * ((y - ay) / (by - ay)));
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i += 2) {
        for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) this.c.set(x, y, fill);
      }
    }
    return this;
  }

  /** Dot — the unit of every stroke. */
  dot(cx, cy, r, col) {
    const X = cx * SS, Y = cy * SS, R = r * SS;
    const ext = Math.ceil(R) + 1;
    for (let dy = -ext; dy <= ext; dy++) {
      for (let dx = -ext; dx <= ext; dx++) {
        if (dx * dx + dy * dy <= R * R) this.c.set(Math.round(X + dx), Math.round(Y + dy), col);
      }
    }
  }

  /** Tapered stroke: width interpolates start→end. Use for lashes and strands. */
  stroke(x1, y1, x2, y2, col, w1, w2 = null) {
    const W2 = w2 == null ? w1 : w2;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.ceil(len * SS / 1.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.dot(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, (w1 + (W2 - w1) * t) / 2, col);
    }
    return this;
  }

  /** Quadratic bezier stroke, optionally tapered. */
  curve(x0, y0, cx, cy, x1, y1, col, w0, w1 = null) {
    const W1 = w1 == null ? w0 : w1;
    const steps = 28;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const p = (t) => {
        const it = 1 - t;
        return [it * it * x0 + 2 * it * t * cx + t * t * x1, it * it * y0 + 2 * it * t * cy + t * t * y1];
      };
      const [ax, ay] = p(t0), [bx, by] = p(t1);
      const w = (w0 + (W1 - w0) * t0) / 2;
      this.dot((ax + bx) / 2, (ay + by) / 2, w, col);
    }
    return this;
  }

  /** Tapered ribbon along a bezier — a hair lock with volume. */
  lock(x0, y0, cx, cy, x1, y1, w0, fill, { tipSharp = true } = {}) {
    const steps = 26;
    const left = [], right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
      // tangent
      const tx = 2 * it * (cx - x0) + 2 * t * (x1 - cx);
      const ty = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
      const L = Math.hypot(tx, ty) || 1;
      const nx = -ty / L, ny = tx / L;
      const w = (w0 * (1 - t) * (tipSharp ? 1 : 1) + (tipSharp ? 0 : w0 * 0.25)) / 2;
      left.push([px + nx * w, py + ny * w]);
      right.push([px - nx * w, py - ny * w]);
    }
    return this.poly([...left, ...right.reverse()], fill);
  }

  /** Merge another Pen's pixels on top. */
  blit(other) {
    const l = other.c;
    for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
      const p = l.get(x, y);
      if (p[3] > 8) this.c.set(x, y, p);
    }
    return this;
  }

  /** Silhouette outline by dilation. Thickness in design units. */
  outline(col, thickness = 2) {
    const k = SS;
    const W = this.w * k, H = this.h * k;
    const art = this.c.clone();
    const C = parseColor(col);
    const T = thickness * k;
    const c2 = new Canvas(W, H);
    const steps = 20;
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const ox = Math.cos(a) * T, oy = Math.sin(a) * T;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (art.get(x, y)[3] <= 8) continue;
          const nx = Math.round(x + ox), ny = Math.round(y + oy);
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) c2.set(nx, ny, C);
        }
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = art.get(x, y);
      if (p[3] > 0) c2.set(x, y, p);
    }
    this.c = c2;
    return this;
  }

  /** Downsample to design resolution. */
  done() {
    const k = SS, out = new Canvas(this.w, this.h);
    const a = k * k;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r = 0, g = 0, b = 0, al = 0;
        for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
          const p = this.c.get(x * k + dx, y * k + dy);
          const av = p[3] / 255;
          r += p[0] * av; g += p[1] * av; b += p[2] * av; al += p[3];
        }
        const alpha = al / a;
        if (alpha < 2) out.set(x, y, [0, 0, 0, 0]);
        else {
          const s = (al / 255) || 1;
          out.set(x, y, [Math.round(r / s), Math.round(g / s), Math.round(b / s), Math.round(alpha)]);
        }
      }
    }
    return out;
  }

  save(file) { return this.done().save(file); }
}

export { SS };

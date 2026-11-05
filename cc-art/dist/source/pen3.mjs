// Sprite engine v3 — gradients, multi-tone cel ramps, soft shading.
//
// v2 could only do 2-tone cels, which caps quality. v3 adds:
//   · linear/radial gradients inside shapes
//   · 3–5 tone cel ramps computed from a light vector
//   · soft (dithered) transitions between tones
//   · a proper ramp helper so every material has a consistent 5-step family
import { Canvas, parseColor } from './core.mjs';

const SS = 4;

/* ───────────────────────────── colour utils ───────────────────────────── */
export const hex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export function mix(a, b, t) {
  const A = parseColor(a), B = parseColor(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function shade(c, f) {
  const n = parseColor(c);
  return hex(n[0] * f, n[1] * f, n[2] * f);
}

/** Build an N-step ramp from a base colour: darker → base → lighter, with a
 *  slight hue shift so shadows go cool and highlights go warm (the same rule
 *  the block textures use). */
export function ramp(base, n = 5, { dark = 0.55, light = 1.30, warm = 0.06 } = {}) {
  const c = parseColor(base);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);            // 0 = darkest, 1 = lightest
    const f = dark + (light - dark) * t;
    // hue shift: shadows cooler (more blue), highlights warmer (more red/yellow)
    const shift = (t - 0.5) * 2;      // -1..1
    const r = c[0] * f * (1 + shift * warm);
    const g = c[1] * f * (1 + Math.abs(shift) * warm * 0.3);
    const b = c[2] * f * (1 - shift * warm);
    out.push(hex(r, g, b));
  }
  return out;
}

/* ─────────────────────────────────── pen ─────────────────────────────────── */
export class Pen {
  constructor(w = 256, h = 320) {
    this.w = w; this.h = h;
    this.c = new Canvas(w * SS, h * SS);
    // Draw straight onto the main buffer by default. The separate `layer` buffer
    // existed for compositing experiments but nothing merged it, so every draw
    // landed in a buffer that was never read — the sprite rendered blank.
    this.layer = this.c;
  }

  /** Start a detached layer and merge it into the main buffer immediately. */
  begin() { this.layer = new Canvas(this.w * SS, this.h * SS); return this; }
  merge() {
    for (let y = 0; y < this.layer.h; y++) for (let x = 0; x < this.layer.w; x++) {
      const p = this.layer.get(x, y);
      if (p[3] > 8) this.c.set(x, y, p);
    }
    this.layer = this.c;
    return this;
  }
  _set(x, y, col) { this.layer.set(x, y, col); }

  /**
   * Radial shape. `rFn(angle)` → radius. `colFn(x, y, d, a, rr)` → colour.
   */
  shape(cx, cy, rFn, colFn) {
    const X = cx * SS, Y = cy * SS;
    let R = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.04) R = Math.max(R, rFn(a));
    const ext = Math.ceil(R * SS) + 2;
    for (let dy = -ext; dy <= ext; dy++) {
      for (let dx = -ext; dx <= ext; dx++) {
        const px = dx / SS, py = dy / SS;
        const d = Math.hypot(px, py);
        const a = Math.atan2(py, px);
        const rr = rFn(a);
        if (d > rr) continue;
        const col = typeof colFn === 'function'
          ? colFn(cx + px, cy + py, d / (rr || 1), a, rr)
          : colFn;
        this._set(Math.round(X + dx), Math.round(Y + dy), col);
      }
    }
    return this;
  }

  /**
   * Ellipse with a full cel ramp.
   * `tones` = array dark→light. Light comes from `light` direction.
   */
  ellipse(cx, cy, rx, ry, tones, { rot = 0, light = [-0.55, -0.83], bands = null, soft = true } = {}) {
    const T = Array.isArray(tones) ? tones : [tones];
    const n = T.length;
    const L = Math.hypot(light[0], light[1]) || 1;
    const lx = light[0] / L, ly = light[1] / L;
    const cuts = bands || (n <= 1 ? [] : Array.from({ length: n - 1 }, (_, i) => -0.55 + (1.35 * (i + 0.5)) / (n - 1)));
    return this.shape(cx, cy, (a) => {
      const ca = Math.cos(a - rot), sa = Math.sin(a - rot);
      return 1 / Math.sqrt((ca * ca) / (rx * rx) + (sa * sa) / (ry * ry));
    }, (x, y) => {
      if (n === 1) return T[0];
      // projected position along the light axis, in ellipse space
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const t = nx * lx + ny * ly;
      let idx = 0;
      for (let i = 0; i < cuts.length; i++) if (t > cuts[i]) idx = i + 1;
      // dither the boundary one step for a soft transition
      if (soft && idx > 0 && idx < n) {
        const edge = cuts[idx - 1];
        const frac = (t - edge) / 0.16;
        if (frac < 0.55 && ((Math.round(x * SS) + Math.round(y * SS)) % 2 === 0)) return T[idx - 1];
      }
      return T[Math.min(n - 1, Math.max(0, idx))];
    });
  }

  /** Rounded rect with optional vertical gradient (top→bottom tone list). */
  roundRect(x, y, w, h, r, tones, { vertical = true, light = [-0.55, -0.83] } = {}) {
    const T = Array.isArray(tones) ? tones : [tones];
    const n = T.length;
    const R = Math.min(r, w / 2, h / 2);
    const inside = (px, py) => {
      if (px < x || px > x + w || py < y || py > y + h) return false;
      const cx = Math.min(Math.max(px, x + R), x + w - R);
      const cy = Math.min(Math.max(py, y + R), y + h - R);
      return Math.hypot(px - cx, py - cy) <= R;
    };
    for (let py = y - 1; py <= y + h + 1; py += 1 / SS) {
      for (let px = x - 1; px <= x + w + 1; px += 1 / SS) {
        if (!inside(px, py)) continue;
        let col;
        if (n === 1) col = T[0];
        else {
          const t = vertical
            ? (py - y) / h
            : ((px - (x + w / 2)) / (w / 2)) * (light[0]) + ((py - (y + h / 2)) / (h / 2)) * (light[1]);
          const idx = Math.min(n - 1, Math.max(0, Math.floor(t * n)));
          col = T[idx];
        }
        this._set(Math.round(px * SS), Math.round(py * SS), col);
      }
    }
    return this;
  }

  /** Polygon, flat fill or vertical gradient. */
  poly(pts, tones, { vertical = true, y0 = null, y1 = null } = {}) {
    const T = Array.isArray(tones) ? tones : [tones];
    const n = T.length;
    const P = pts.map(([x, y]) => [x * SS, y * SS]);
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of P) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const lo = y0 != null ? y0 * SS : minY, hi = y1 != null ? y1 * SS : maxY;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      for (let i = 0; i < P.length; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (bx - ax) * ((y - ay) / (by - ay)));
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i += 2) {
        for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) {
          let col;
          if (n === 1) col = T[0];
          else {
            const t = vertical ? (y - lo) / Math.max(1, hi - lo) : 0.5;
            col = T[Math.min(n - 1, Math.max(0, Math.floor(t * n)))];
          }
          this._set(x, y, col);
        }
      }
    }
    return this;
  }

  dot(cx, cy, r, col) {
    const X = cx * SS, Y = cy * SS, R = r * SS;
    const ext = Math.ceil(R) + 1;
    for (let dy = -ext; dy <= ext; dy++) for (let dx = -ext; dx <= ext; dx++) {
      if (dx * dx + dy * dy <= R * R) this._set(Math.round(X + dx), Math.round(Y + dy), col);
    }
    return this;
  }

  stroke(x1, y1, x2, y2, col, w1, w2 = null) {
    const W2 = w2 == null ? w1 : w2;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.ceil(len * SS / 1.1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.dot(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, (w1 + (W2 - w1) * t) / 2, col);
    }
    return this;
  }

  curve(x0, y0, cx, cy, x1, y1, col, w0, w1 = null) {
    const W1 = w1 == null ? w0 : w1;
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const pt = (t) => { const it = 1 - t; return [it * it * x0 + 2 * it * t * cx + t * t * x1, it * it * y0 + 2 * it * t * cy + t * t * y1]; };
      const [ax, ay] = pt(t0), [bx, by] = pt(t1);
      this.dot((ax + bx) / 2, (ay + by) / 2, (w0 + (W1 - w0) * t0) / 2, col);
    }
    return this;
  }

  /** Tapered hair lock along a bezier, with an inner highlight stripe. */
  lock(x0, y0, cx, cy, x1, y1, w0, tone, { hi = null, tip = 0.06 } = {}) {
    const steps = 30;
    const left = [], right = [], mid = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
      const tx = 2 * it * (cx - x0) + 2 * t * (x1 - cx);
      const ty = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
      const L = Math.hypot(tx, ty) || 1;
      const nx = -ty / L, ny = tx / L;
      const w = (w0 * Math.pow(1 - t, 1.15) + w0 * tip) / 2;
      left.push([px + nx * w, py + ny * w]);
      right.push([px - nx * w, py - ny * w]);
      mid.push([px + nx * w * 0.35, py + ny * w * 0.35]);
    }
    this.poly([...left, ...right.reverse()], tone, { vertical: false });
    if (hi) {
      const mleft = [], mright = [];
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const w = (w0 * Math.pow(1 - t, 1.15) + w0 * tip) * 0.16;
        mleft.push([mid[i][0] + w, mid[i][1] + w]);
        mright.push([mid[i][0] - w, mid[i][1] - w]);
      }
      this.poly([...mleft, ...mright.reverse()], hi, { vertical: false });
    }
    return this;
  }

  /** Silhouette outline. */
  outline(col, thickness = 2) {
    const k = SS, W = this.w * k, H = this.h * k;
    const art = this.c.clone();
    const C = parseColor(col);
    const T = thickness * k;
    const out = new Canvas(W, H);
    const steps = 22;
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const ox = Math.cos(a) * T, oy = Math.sin(a) * T;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (art.get(x, y)[3] <= 8) continue;
        const nx = Math.round(x + ox), ny = Math.round(y + oy);
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.set(nx, ny, C);
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = art.get(x, y);
      if (p[3] > 0) out.set(x, y, p);
    }
    this.c = out;
    return this;
  }

  done() {
    const k = SS, out = new Canvas(this.w, this.h), a = k * k;
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

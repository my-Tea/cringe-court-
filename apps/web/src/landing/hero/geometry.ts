/** Geometry and colour helpers for the papercraft courtroom (STYLE-GUIDE §9.9). */

/** A palette swatch name: `royal-700`, `neutral-100`, … */
export type Swatch = `${'royal' | 'teal' | 'gold' | 'neutral' | 'green' | 'blue'}-${100 | 300 | 500 | 700 | 900}`;

export const ink = (s: Swatch) => `var(--cc-${s})`;

export type Pt = readonly [number, number];

export const pts = (p: readonly Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Regular-ish polygon around a centre: faceted circles (heads, globes, pans). */
export function ring(cx: number, cy: number, rx: number, ry: number, n: number, rot = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as const;
  });
}

/**
 * Spiky folded-paper hair: alternating inner and outer points along an arc.
 * `from`/`to` are degrees (0 = right, 90 = down), so 180→360 is the top half.
 */
export function spikes(cx: number, cy: number, r: number, len: number, n: number, from = 160, to = 380, jitter = 0.25): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = ((from + ((to - from) * i) / (n * 2)) * Math.PI) / 180;
    // deterministic wobble so every render is identical
    const wob = 1 + Math.sin(i * 12.9898) * jitter;
    const rr = i % 2 ? r + len * wob : r;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
}


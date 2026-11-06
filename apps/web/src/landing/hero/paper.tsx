import type { CSSProperties, ReactNode } from 'react';
import { ink, pts, type Pt, type Swatch } from './geometry';


/**
 * Drawing kit for the papercraft courtroom (STYLE-GUIDE §9.9). Every colour is a
 * palette token (`royal-700` → `var(--cc-royal-700)`), so the scene can never
 * drift from the 30 swatches. Shapes are flat polygons: a lit sheet with a
 * shaded facet on top, the way folded card catches one light from the top left.
 */

interface ShapeProps {
  t: Swatch;
  o?: number;
  className?: string;
  style?: CSSProperties;
}

/** A flat paper polygon. */
export function Poly({ p, t, o, className, style }: ShapeProps & { p: readonly Pt[] }) {
  return <polygon points={pts(p)} className={className} style={{ fill: ink(t), opacity: o, ...style }} />;
}

/** A flat paper path. */
export function Cut({ d, t, o, className, style }: ShapeProps & { d: string }) {
  return <path d={d} className={className} style={{ fill: ink(t), opacity: o, ...style }} />;
}

/** A crease or outline drawn as a stroke. */
export function Line({ d, t, w = 2, o, cap = 'round' }: { d: string; t: Swatch; w?: number; o?: number; cap?: 'round' | 'butt' }) {
  return <path d={d} style={{ fill: 'none', stroke: ink(t), strokeWidth: w, strokeLinecap: cap, strokeLinejoin: 'round', opacity: o }} />;
}

/** A faceted box: lit front, darker top lip and a shaded right fold. */
export function Block({ x, y, w, h, lit, shade, lip, lipH = 10 }: { x: number; y: number; w: number; h: number; lit: Swatch; shade: Swatch; lip?: Swatch; lipH?: number }) {
  return (
    <g>
      <Poly t={lit} p={[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]} />
      <Poly t={shade} o={0.55} p={[[x + w * 0.62, y], [x + w, y], [x + w, y + h], [x + w * 0.5, y + h]]} />
      {lip && <Poly t={lip} p={[[x - 6, y - lipH], [x + w + 6, y - lipH], [x + w, y], [x, y]]} />}
    </g>
  );
}

/** The gold scales emblem used on banners, desks and the bench. */
export function Scales({ x, y, s = 1, t = 'gold-300', shade = 'gold-500' }: { x: number; y: number; s?: number; t?: Swatch; shade?: Swatch }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Poly t={t} p={[[-2, -18], [2, -18], [3, 14], [-3, 14]]} />
      <Poly t={t} p={[[-20, -12], [20, -12], [20, -9], [-20, -9]]} />
      <Line t={t} w={1.4} d="M-18 -9 L-24 4 M-18 -9 L-12 4 M18 -9 L12 4 M18 -9 L24 4" />
      <Poly t={t} p={[[-26, 4], [-10, 4], [-14, 9], [-22, 9]]} />
      <Poly t={shade} p={[[-18, 4], [-10, 4], [-14, 9], [-18, 9]]} />
      <Poly t={t} p={[[10, 4], [26, 4], [22, 9], [14, 9]]} />
      <Poly t={shade} p={[[18, 4], [26, 4], [22, 9], [18, 9]]} />
      <Poly t={t} p={[[-9, 14], [9, 14], [11, 18], [-11, 18]]} />
      <Poly t={shade} p={[[0, 14], [9, 14], [11, 18], [0, 18]]} />
    </g>
  );
}

/** Little gold "ha!" sparks that fly off laughing characters. */
export function Sparks({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} className="cc-hero-sparks">
      <Poly t="gold-300" p={[[0, 0], [6, -22], [10, -2]]} />
      <Poly t="gold-500" p={[[6, -22], [10, -2], [8, -1]]} />
      <Poly t="gold-300" p={[[14, 6], [34, -8], [18, 12]]} />
      <Poly t="gold-300" p={[[16, 20], [36, 18], [18, 26]]} />
    </g>
  );
}

/** A layer of the scene: parallax depth and entrance order. */
export function Layer({ depth, order, className, children }: { depth: number; order: number; className: string | undefined; children: ReactNode }) {
  return (
    <g className={className} style={{ '--d': depth, '--cc-stagger': order } as CSSProperties}>
      {children}
    </g>
  );
}

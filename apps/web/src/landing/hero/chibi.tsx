import type { ReactNode } from 'react';
import { ring, spikes, type Swatch } from './geometry';
import { Cut, Line, Poly } from './paper';

/**
 * One chibi courtroom character, folded from paper: a faceted head, spiky card
 * hair, a costume hood or hat, and the house expression (laughing, eyes
 * squeezed shut). Drawn in local coordinates around the centre of the head.
 */

export type Eyes = 'happy' | 'shades' | 'stars' | 'swirl' | 'smug';
export type Mouth = 'laugh' | 'grin' | 'flat';
export type Hood = 'chicken' | 'frog' | 'cat';
export type Hat = 'pizza' | 'cop';

export interface ChibiProps {
  x: number;
  y: number;
  r: number;
  tilt?: number;
  skin?: Swatch;
  skinShade?: Swatch;
  hair?: { t: Swatch; shade: Swatch; style: 'spiky' | 'bob' | 'messy'; n?: number };
  eyes?: Eyes;
  mouth?: Mouth;
  hood?: Hood;
  hat?: Hat;
  /** Torso under the head: robe or suit colour. */
  body?: { t: Swatch; shade: Swatch; w?: number; h?: number; collar?: 'shirt' | 'fur' | 'none'; tie?: Swatch };
  /** Drawn on top of the body (arms, props). */
  front?: ReactNode;
  /** Drawn behind everything (a raised arm, a gavel). */
  back?: ReactNode;
  /** A big folded-paper beard and moustache (the judge). */
  beard?: Swatch;
}

function Beard({ r, t }: { r: number; t: Swatch }) {
  return (
    <g>
      <Poly t={t} p={[[-k(r, 0.98), k(r, 0.02)], ...spikes(0, k(r, 0.12), k(r, 0.92), k(r, 0.62), 6, 8, 172, 0.3), [-k(r, 0.98), k(r, 0.02)]]} />
      <Poly t="neutral-300" o={0.7} p={[[k(r, 0.1), k(r, 0.5)], ...spikes(0, k(r, 0.12), k(r, 0.92), k(r, 0.62), 3, 8, 90, 0.3).reverse(), [k(r, 0.9), k(r, 0.1)]]} />
      {/* moustache: two folded wings */}
      <Poly t={t} p={[[0, k(r, 0.22)], [-k(r, 0.62), k(r, 0.14)], [-k(r, 0.82), k(r, 0.36)], [-k(r, 0.3), k(r, 0.36)]]} />
      <Poly t={t} p={[[0, k(r, 0.22)], [k(r, 0.62), k(r, 0.14)], [k(r, 0.82), k(r, 0.36)], [k(r, 0.3), k(r, 0.36)]]} />
      <Poly t="neutral-300" p={[[0, k(r, 0.22)], [k(r, 0.62), k(r, 0.14)], [k(r, 0.4), k(r, 0.26)]]} />
    </g>
  );
}

const k = (r: number, v: number) => r * v;

function Body({ r, t, shade, w = 2.2, h = 1.4, collar = 'shirt', tie }: { r: number } & NonNullable<ChibiProps['body']>) {
  const top = k(r, 0.78);
  const bw = k(r, w);
  const bh = k(r, h);
  return (
    <g>
      <Poly t={t} p={[[-bw * 0.36, top], [bw * 0.36, top], [bw * 0.5, top + bh], [-bw * 0.5, top + bh]]} />
      <Poly t={shade} o={0.7} p={[[bw * 0.08, top], [bw * 0.36, top], [bw * 0.5, top + bh], [bw * 0.14, top + bh]]} />
      {collar === 'shirt' && (
        <>
          <Poly t="neutral-100" p={[[-k(r, 0.3), top], [k(r, 0.3), top], [0, top + k(r, 0.55)]]} />
          <Poly t={tie ?? 'royal-700'} p={[[-k(r, 0.07), top + k(r, 0.06)], [k(r, 0.07), top + k(r, 0.06)], [k(r, 0.1), top + k(r, 0.5)], [0, top + k(r, 0.62)], [-k(r, 0.1), top + k(r, 0.5)]]} />
        </>
      )}
      {collar === 'fur' && (
        <Poly
          t="neutral-100"
          p={[
            [-bw * 0.46, top + k(r, 0.05)],
            [-bw * 0.3, top - k(r, 0.12)],
            [-bw * 0.16, top + k(r, 0.02)],
            [0, top - k(r, 0.1)],
            [bw * 0.16, top + k(r, 0.02)],
            [bw * 0.3, top - k(r, 0.12)],
            [bw * 0.46, top + k(r, 0.05)],
            [bw * 0.4, top + k(r, 0.34)],
            [bw * 0.2, top + k(r, 0.22)],
            [0, top + k(r, 0.36)],
            [-bw * 0.2, top + k(r, 0.22)],
            [-bw * 0.4, top + k(r, 0.34)],
          ]}
        />
      )}
    </g>
  );
}

function Head({ r, skin, skinShade }: { r: number; skin: Swatch; skinShade: Swatch }) {
  const shape = ring(0, 0, r, r * 0.93, 12, -Math.PI / 12);
  return (
    <g>
      {/* ears */}
      <Poly t={skinShade} p={[[-k(r, 1.02), -k(r, 0.05)], [-k(r, 1.16), k(r, 0.12)], [-k(r, 0.96), k(r, 0.3)]]} />
      <Poly t={skinShade} p={[[k(r, 1.02), -k(r, 0.05)], [k(r, 1.16), k(r, 0.12)], [k(r, 0.96), k(r, 0.3)]]} />
      <Poly t={skin} p={shape} />
      {/* the fold: right cheek and jaw in shade */}
      <Poly t={skinShade} o={0.55} p={[[k(r, 0.22), -k(r, 0.9)], [k(r, 0.86), -k(r, 0.46)], [k(r, 1), k(r, 0.08)], [k(r, 0.78), k(r, 0.6)], [k(r, 0.3), k(r, 0.9)], [k(r, 0.46), k(r, 0.12)]]} />
      {/* chin crease */}
      <Poly t={skinShade} o={0.35} p={[[-k(r, 0.5), k(r, 0.72)], [k(r, 0.3), k(r, 0.9)], [-k(r, 0.12), k(r, 0.93)]]} />
    </g>
  );
}

function star(cx: number, cy: number, R: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? R * 0.45 : R;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as const;
  });
}

function Face({ r, eyes, mouth }: { r: number; eyes: Eyes; mouth: Mouth }) {
  const ex = k(r, 0.4);
  const ey = k(r, 0.02);
  const sw = Math.max(2, k(r, 0.09));
  return (
    <g>
      {/* blush */}
      <ellipse cx={-k(r, 0.62)} cy={k(r, 0.3)} rx={k(r, 0.16)} ry={k(r, 0.09)} style={{ fill: 'var(--cc-royal-300)', opacity: 0.55 }} />
      <ellipse cx={k(r, 0.62)} cy={k(r, 0.3)} rx={k(r, 0.16)} ry={k(r, 0.09)} style={{ fill: 'var(--cc-royal-300)', opacity: 0.55 }} />

      {eyes === 'happy' && (
        <>
          <Line t="neutral-900" w={sw} d={`M${-ex - k(r, 0.18)} ${ey + k(r, 0.05)} Q${-ex} ${ey - k(r, 0.22)} ${-ex + k(r, 0.18)} ${ey + k(r, 0.05)}`} />
          <Line t="neutral-900" w={sw} d={`M${ex - k(r, 0.18)} ${ey + k(r, 0.05)} Q${ex} ${ey - k(r, 0.22)} ${ex + k(r, 0.18)} ${ey + k(r, 0.05)}`} />
        </>
      )}
      {eyes === 'smug' && (
        <>
          <Line t="neutral-900" w={sw} d={`M${-ex - k(r, 0.2)} ${ey - k(r, 0.04)} L${-ex + k(r, 0.18)} ${ey + k(r, 0.04)}`} />
          <Line t="neutral-900" w={sw} d={`M${ex - k(r, 0.18)} ${ey + k(r, 0.04)} L${ex + k(r, 0.2)} ${ey - k(r, 0.04)}`} />
        </>
      )}
      {eyes === 'shades' && (
        <g>
          <Poly t="neutral-900" p={[[-k(r, 0.92), -k(r, 0.2)], [k(r, 0.92), -k(r, 0.2)], [k(r, 0.92), -k(r, 0.1)], [-k(r, 0.92), -k(r, 0.1)]]} />
          <Poly t="neutral-900" p={[[-k(r, 0.8), -k(r, 0.12)], [-k(r, 0.08), -k(r, 0.12)], [-k(r, 0.14), k(r, 0.16)], [-k(r, 0.7), k(r, 0.16)]]} />
          <Poly t="neutral-900" p={[[k(r, 0.08), -k(r, 0.12)], [k(r, 0.8), -k(r, 0.12)], [k(r, 0.7), k(r, 0.16)], [k(r, 0.14), k(r, 0.16)]]} />
          {/* the glint: two paper slivers */}
          <Poly t="neutral-100" o={0.85} p={[[-k(r, 0.66), -k(r, 0.08)], [-k(r, 0.54), -k(r, 0.08)], [-k(r, 0.6), k(r, 0.03)], [-k(r, 0.7), k(r, 0.03)]]} />
          <Poly t="neutral-100" o={0.85} p={[[k(r, 0.24), -k(r, 0.08)], [k(r, 0.36), -k(r, 0.08)], [k(r, 0.3), k(r, 0.03)], [k(r, 0.2), k(r, 0.03)]]} />
        </g>
      )}
      {eyes === 'stars' && (
        <>
          <Poly t="gold-300" p={star(-ex, ey, k(r, 0.22))} style={{ stroke: 'var(--cc-gold-900)', strokeWidth: Math.max(1, k(r, 0.04)) }} />
          <Poly t="gold-300" p={star(ex, ey, k(r, 0.22))} style={{ stroke: 'var(--cc-gold-900)', strokeWidth: Math.max(1, k(r, 0.04)) }} />
        </>
      )}
      {eyes === 'swirl' && (
        <>
          {[-ex, ex].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={ey} r={k(r, 0.26)} style={{ fill: 'var(--cc-neutral-100)', stroke: 'var(--cc-neutral-900)', strokeWidth: sw }} />
              <Line t="neutral-900" w={Math.max(1.2, k(r, 0.05))} d={`M${cx} ${ey} m0 -${k(r, 0.04)} a${k(r, 0.05)} ${k(r, 0.05)} 0 1 1 -${k(r, 0.06)} ${k(r, 0.07)} a${k(r, 0.11)} ${k(r, 0.11)} 0 1 1 ${k(r, 0.2)} -${k(r, 0.02)} a${k(r, 0.16)} ${k(r, 0.16)} 0 1 1 -${k(r, 0.3)} ${k(r, 0.08)}`} />
            </g>
          ))}
          <Line t="neutral-900" w={sw} d={`M${-ex + k(r, 0.26)} ${ey} L${ex - k(r, 0.26)} ${ey}`} />
        </>
      )}

      {mouth === 'laugh' && (
        <g>
          <Cut t="royal-900" d={`M${-k(r, 0.36)} ${k(r, 0.3)} L${k(r, 0.36)} ${k(r, 0.3)} Q${k(r, 0.3)} ${k(r, 0.86)} 0 ${k(r, 0.86)} Q${-k(r, 0.3)} ${k(r, 0.86)} ${-k(r, 0.36)} ${k(r, 0.3)} Z`} />
          <Cut t="royal-500" d={`M${-k(r, 0.2)} ${k(r, 0.74)} Q0 ${k(r, 0.54)} ${k(r, 0.22)} ${k(r, 0.72)} Q${k(r, 0.1)} ${k(r, 0.86)} 0 ${k(r, 0.86)} Q${-k(r, 0.12)} ${k(r, 0.86)} ${-k(r, 0.2)} ${k(r, 0.74)} Z`} />
          <Poly t="neutral-100" p={[[-k(r, 0.3), k(r, 0.3)], [k(r, 0.3), k(r, 0.3)], [k(r, 0.27), k(r, 0.38)], [-k(r, 0.27), k(r, 0.38)]]} />
        </g>
      )}
      {mouth === 'grin' && (
        <g>
          <Cut t="royal-900" d={`M${-k(r, 0.28)} ${k(r, 0.36)} L${k(r, 0.28)} ${k(r, 0.36)} Q${k(r, 0.2)} ${k(r, 0.64)} 0 ${k(r, 0.64)} Q${-k(r, 0.2)} ${k(r, 0.64)} ${-k(r, 0.28)} ${k(r, 0.36)} Z`} />
          <Poly t="neutral-100" p={[[-k(r, 0.24), k(r, 0.36)], [k(r, 0.24), k(r, 0.36)], [k(r, 0.2), k(r, 0.43)], [-k(r, 0.2), k(r, 0.43)]]} />
        </g>
      )}
      {mouth === 'flat' && <Line t="neutral-900" w={sw} d={`M${-k(r, 0.2)} ${k(r, 0.48)} Q0 ${k(r, 0.4)} ${k(r, 0.22)} ${k(r, 0.46)}`} />}
    </g>
  );
}

function BackHair({ r, hair }: { r: number; hair: NonNullable<ChibiProps['hair']> }) {
  const n = hair.n ?? 7;
  if (hair.style === 'bob') {
    return (
      <g>
        <Poly t={hair.t} p={[...spikes(0, -k(r, 0.05), k(r, 1.08), k(r, 0.18), n, 150, 390, 0.4), [k(r, 1.15), k(r, 1.3)], [k(r, 0.6), k(r, 1.05)], [-k(r, 0.6), k(r, 1.05)], [-k(r, 1.2), k(r, 1.35)]]} />
        <Poly t={hair.shade} o={0.75} p={[[k(r, 0.2), -k(r, 1.1)], [k(r, 1.12), -k(r, 0.3)], [k(r, 1.15), k(r, 1.3)], [k(r, 0.6), k(r, 1.05)]]} />
      </g>
    );
  }
  const len = hair.style === 'messy' ? k(r, 0.5) : k(r, 0.38);
  return (
    <g>
      <Poly t={hair.t} p={spikes(0, -k(r, 0.08), k(r, 1.02), len, n, 150, 390, hair.style === 'messy' ? 0.45 : 0.25)} />
      <Poly t={hair.shade} o={0.7} p={spikes(0, -k(r, 0.08), k(r, 1.0), len * 0.8, Math.ceil(n / 2), 280, 390, 0.3).concat([[0, -k(r, 0.1)]])} />
    </g>
  );
}

function Fringe({ r, hair }: { r: number; hair: NonNullable<ChibiProps['hair']> }) {
  // bangs: points along the hairline alternating with tips that dip into the forehead
  const n = 5;
  const p: Array<readonly [number, number]> = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = ((196 + (148 * i) / (n * 2)) * Math.PI) / 180;
    const rr = i % 2 ? k(r, 0.5 + 0.08 * Math.sin(i * 3.1)) : k(r, 1.04);
    p.push([Math.cos(a) * rr, Math.sin(a) * rr - k(r, 0.02)]);
  }
  p.push([k(r, 0.4), -k(r, 1.16)], [-k(r, 0.4), -k(r, 1.16)]);
  return (
    <g>
      <Poly t={hair.t} p={p} />
      <Poly t={hair.shade} o={0.6} p={[[k(r, 0.1), -k(r, 1.1)], [k(r, 0.98), -k(r, 0.36)], [k(r, 0.62), -k(r, 0.3)]]} />
    </g>
  );
}

function HoodBack({ r, hood }: { r: number; hood: Hood }) {
  const tone: Record<Hood, [Swatch, Swatch]> = {
    chicken: ['neutral-100', 'neutral-300'],
    frog: ['green-500', 'green-700'],
    cat: ['blue-700', 'blue-900'],
  };
  const [t, s] = tone[hood];
  const shell = ring(0, -k(r, 0.06), k(r, 1.36), k(r, 1.3), 11, -Math.PI / 2);
  return (
    <g>
      {hood === 'cat' && (
        <>
          <Poly t={t} p={[[-k(r, 1.15), -k(r, 0.6)], [-k(r, 0.95), -k(r, 1.75)], [-k(r, 0.3), -k(r, 1.15)]]} />
          <Poly t="royal-100" p={[[-k(r, 0.98), -k(r, 0.85)], [-k(r, 0.92), -k(r, 1.45)], [-k(r, 0.55), -k(r, 1.1)]]} />
          <Poly t={t} p={[[k(r, 1.15), -k(r, 0.6)], [k(r, 0.95), -k(r, 1.75)], [k(r, 0.3), -k(r, 1.15)]]} />
          <Poly t={s} p={[[k(r, 0.98), -k(r, 0.85)], [k(r, 0.92), -k(r, 1.45)], [k(r, 0.55), -k(r, 1.1)]]} />
        </>
      )}
      {hood === 'frog' &&
        [-1, 1].map((side) => (
          <g key={side}>
            <Poly t={t} p={ring(side * k(r, 0.62), -k(r, 1.22), k(r, 0.42), k(r, 0.38), 8)} />
            <Poly t="neutral-100" p={ring(side * k(r, 0.62), -k(r, 1.24), k(r, 0.27), k(r, 0.25), 8)} />
            <Poly t="neutral-900" p={ring(side * k(r, 0.6), -k(r, 1.22), k(r, 0.12), k(r, 0.13), 6)} />
          </g>
        ))}
      {hood === 'chicken' && (
        <>
          <Poly t="royal-500" p={[[-k(r, 0.4), -k(r, 1.22)], [-k(r, 0.3), -k(r, 1.7)], [-k(r, 0.08), -k(r, 1.36)], [k(r, 0.08), -k(r, 1.82)], [k(r, 0.24), -k(r, 1.36)], [k(r, 0.44), -k(r, 1.66)], [k(r, 0.46), -k(r, 1.2)]]} />
          <Poly t="royal-700" o={0.6} p={[[k(r, 0.08), -k(r, 1.82)], [k(r, 0.24), -k(r, 1.36)], [k(r, 0.44), -k(r, 1.66)], [k(r, 0.46), -k(r, 1.2)], [k(r, 0.04), -k(r, 1.26)]]} />
        </>
      )}
      <Poly t={t} p={shell} />
      <Poly t={s} o={0.7} p={[[0, -k(r, 1.36)], [k(r, 1.1), -k(r, 0.8)], [k(r, 1.36), k(r, 0.2)], [k(r, 1.0), k(r, 1.0)], [k(r, 0.5), k(r, 0.2)]]} />
    </g>
  );
}

function HoodFront({ r, hood }: { r: number; hood: Hood }) {
  if (hood === 'chicken') {
    return (
      <g>
        {/* the beak is the hood's peak, folded over the forehead */}
        <Poly t="gold-500" p={[[-k(r, 0.3), -k(r, 0.92)], [k(r, 0.3), -k(r, 0.92)], [0, -k(r, 0.46)]]} />
        <Poly t="gold-700" p={[[0, -k(r, 0.92)], [k(r, 0.3), -k(r, 0.92)], [0, -k(r, 0.46)]]} />
      </g>
    );
  }
  if (hood === 'frog') {
    return <Poly t="green-700" o={0.8} p={[[-k(r, 0.95), -k(r, 0.6)], [0, -k(r, 1.08)], [k(r, 0.95), -k(r, 0.6)], [0, -k(r, 0.88)]]} />;
  }
  return <Poly t="blue-900" o={0.55} p={[[-k(r, 0.95), -k(r, 0.6)], [0, -k(r, 1.08)], [k(r, 0.95), -k(r, 0.6)], [0, -k(r, 0.86)]]} />;
}

function HatTop({ r, hat }: { r: number; hat: Hat }) {
  if (hat === 'pizza') {
    return (
      <g transform={`rotate(14) translate(0 ${-k(r, 0.7)})`}>
        <Poly t="gold-500" p={[[-k(r, 0.95), 0], [k(r, 0.95), 0], [k(r, 0.9), k(r, 0.22)], [-k(r, 0.9), k(r, 0.22)]]} />
        <Poly t="gold-300" p={[[-k(r, 0.88), 0], [k(r, 0.88), 0], [k(r, 0.1), -k(r, 1.7)]]} />
        <Poly t="gold-500" o={0.6} p={[[k(r, 0.1), -k(r, 1.7)], [k(r, 0.88), 0], [k(r, 0.3), 0]]} />
        {[[-k(r, 0.3), -k(r, 0.35)], [k(r, 0.3), -k(r, 0.5)], [0, -k(r, 1.0)]].map(([x, y]) => (
          <g key={`${x}`}>
            <Poly t="royal-500" p={ring(x!, y!, k(r, 0.17), k(r, 0.16), 7)} />
            <Poly t="royal-700" o={0.6} p={[[x!, y! - k(r, 0.16)], [x! + k(r, 0.17), y!], [x!, y! + k(r, 0.16)]]} />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g transform={`translate(0 ${-k(r, 0.72)})`}>
      <Poly t="blue-900" p={[[-k(r, 1.0), 0], [-k(r, 1.15), -k(r, 0.62)], [0, -k(r, 0.9)], [k(r, 1.15), -k(r, 0.62)], [k(r, 1.0), 0]]} />
      <Poly t="blue-700" o={0.5} p={[[0, -k(r, 0.9)], [k(r, 1.15), -k(r, 0.62)], [k(r, 1.0), 0], [k(r, 0.2), 0]]} />
      <Poly t="neutral-900" p={[[-k(r, 1.05), 0], [k(r, 1.05), 0], [k(r, 0.85), k(r, 0.2)], [-k(r, 0.85), k(r, 0.2)]]} />
      <Poly t="gold-300" p={[[0, -k(r, 0.66)], [k(r, 0.2), -k(r, 0.46)], [k(r, 0.14), -k(r, 0.18)], [-k(r, 0.14), -k(r, 0.18)], [-k(r, 0.2), -k(r, 0.46)]]} />
      <Poly t="gold-500" p={[[0, -k(r, 0.66)], [k(r, 0.2), -k(r, 0.46)], [k(r, 0.14), -k(r, 0.18)], [0, -k(r, 0.18)]]} />
    </g>
  );
}

export function Chibi({ x, y, r, tilt = 0, skin = 'royal-100', skinShade = 'royal-300', hair, eyes = 'happy', mouth = 'laugh', hood, hat, body, front, back, beard }: ChibiProps) {
  return (
    <g transform={`translate(${x} ${y})`} className="cc-hero-chibi">
      {back}
      {body && <Body r={r} {...body} />}
      {front}
      <g transform={`rotate(${tilt})`}>
        {hood && <HoodBack r={r} hood={hood} />}
        {hair && !hood && <BackHair r={r} hair={hair} />}
        <Head r={r} skin={skin} skinShade={skinShade} />
        {hair && !hood && <Fringe r={r} hair={hair} />}
        {hood && <HoodFront r={r} hood={hood} />}
        {beard && <Beard r={r} t={beard} />}
        <Face r={r} eyes={eyes} mouth={mouth} />
        {hat && <HatTop r={r} hat={hat} />}
      </g>
    </g>
  );
}

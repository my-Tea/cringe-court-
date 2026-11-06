import { useId, type SVGProps } from 'react';
import { cx } from '../../lib/cx';
import styles from './Logo.module.css';

export interface LogoProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** `stacked`: the scales-and-crown crest above the wordmark (login panel). `inline`: crest beside it (nav). `mark`: crest only. */
  layout?: 'stacked' | 'inline' | 'mark';
  /** Accessible name. Pass `null` when a visible text label sits next to it. */
  title?: string | null;
}

const v = (name: string) => ({ stopColor: `var(--cc-${name})` });

/** The crest: gold paper scales with a three-point crown on the beam, every piece split into a lit and a shaded facet. */
function Crest({ x, y, s, id }: { x: number; y: number; s: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={styles.crest}>
      {/* crown on the beam */}
      <path className={styles.goldLit} d="M30 34 L36 14 L44 28 L50 6 L56 28 L64 14 L70 34 Z" />
      <path className={styles.goldShade} d="M50 6 L56 28 L64 14 L70 34 L50 34 Z" />
      <path className={styles.ink} d="M30 34 H70 V38 H30 Z" />
      {/* post */}
      <path className={styles.goldLit} d="M46 38 H50 V92 H44 Z" />
      <path className={styles.goldShade} d="M50 38 H54 L56 92 H50 Z" />
      {/* beam */}
      <path className={styles.goldLit} d="M8 40 L50 36 L92 40 L92 45 L8 45 Z" />
      <path className={styles.goldShade} d="M8 45 H92 L90 48 H10 Z" />
      {/* strings */}
      <path className={styles.string} d="M12 46 L2 72 M12 46 L22 72 M88 46 L78 72 M88 46 L98 72" />
      {/* pans */}
      <path className={styles.goldLit} d="M0 72 H24 L18 82 H6 Z" />
      <path className={styles.goldShade} d="M12 72 H24 L18 82 H12 Z" />
      <path className={styles.goldLit} d="M76 72 H100 L94 82 H82 Z" />
      <path className={styles.goldShade} d="M88 72 H100 L94 82 H88 Z" />
      {/* base */}
      <path className={styles.goldLit} d="M34 92 H66 L70 100 H30 Z" />
      <path className={styles.goldShade} d="M50 92 H66 L70 100 H50 Z" />
      {/* jewel */}
      <path fill={`url(#${id}-jewel)`} d="M50 18 L54 24 L50 30 L46 24 Z" />
    </g>
  );
}

/** A small gold gavel tucked under the wordmark plate. */
function Gavel({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(-28 30 20)`}>
      <path className={styles.woodLit} d="M26 20 H60 V26 H26 Z" />
      <path className={styles.woodShade} d="M26 23 H60 V26 H26 Z" />
      <path className={styles.goldLit} d="M8 8 H28 V38 H8 Z" />
      <path className={styles.goldShade} d="M18 8 H28 V38 H18 Z" />
      <path className={styles.ink} d="M6 6 H10 V40 H6 Z M26 6 H30 V40 H26 Z" />
    </g>
  );
}

function Wordmark({ x, y, w, id }: { x: number; y: number; w: number; id: string }) {
  const common = { x, y, textLength: w, lengthAdjust: 'spacingAndGlyphs' as const, className: styles.word };
  return (
    <g>
      {/* paper thickness: the dark card under the letters */}
      <text {...common} transform="translate(0 5)" className={cx(styles.word, styles.extrude)}>
        CRINGECOURT
      </text>
      {/* maroon outline cut around the letters */}
      <text {...common} className={cx(styles.word, styles.outline)}>
        CRINGECOURT
      </text>
      {/* the gold card letters, folded across the middle */}
      <text {...common} fill={`url(#${id}-letters)`}>
        CRINGECOURT
      </text>
    </g>
  );
}

/**
 * CRINGECOURT folded-paper wordmark with the gavel-and-scales crown (STYLE-GUIDE §9.8).
 * Pure SVG: the letters are live text in the paper display face (sized with
 * `textLength`, so the plate fits before and after the font loads).
 */
export function Logo({ layout = 'stacked', title = 'CringeCourt', className, ...rest }: LogoProps) {
  const id = useId().replace(/:/g, '');
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const };
  const viewBox = layout === 'stacked' ? '0 0 360 214' : layout === 'inline' ? '0 0 330 72' : '0 0 104 104';

  return (
    <svg viewBox={viewBox} className={cx(styles.logo, className)} data-layout={layout} focusable="false" {...a11y} {...rest}>
      <defs>
        <linearGradient id={`${id}-letters`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={v('neutral-100')} />
          <stop offset="0.52" style={v('gold-100')} />
          <stop offset="0.52" style={v('gold-300')} />
          <stop offset="1" style={v('gold-500')} />
        </linearGradient>
        <linearGradient id={`${id}-jewel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.5" style={v('royal-500')} />
          <stop offset="0.5" style={v('royal-900')} />
        </linearGradient>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={v('royal-700')} />
          <stop offset="0.5" style={v('royal-700')} />
          <stop offset="0.5" style={v('royal-900')} />
          <stop offset="1" style={v('royal-900')} />
        </linearGradient>
      </defs>

      {layout === 'stacked' && (
        <g className={styles.paper}>
          <Crest x={122} y={0} s={1.16} id={id} />
          {/* gold rim plate, then maroon plate, both hand-trimmed */}
          <path className={styles.goldShade} d="M6 118 L30 104 L180 112 L330 102 L354 118 L344 170 L356 186 L180 180 L4 188 L16 168 Z" />
          <path fill={`url(#${id}-plate)`} d="M14 120 L34 110 L180 118 L326 108 L346 120 L336 168 L346 180 L180 174 L14 182 L24 166 Z" />
          <Wordmark x={30} y={164} w={300} id={id} />
          <Gavel x={196} y={170} s={1.05} />
        </g>
      )}

      {layout === 'inline' && (
        <g className={styles.paper}>
          <Crest x={0} y={2} s={0.66} id={id} />
          <path className={styles.goldShade} d="M74 14 L320 8 L328 36 L320 64 L74 60 L80 36 Z" />
          <path fill={`url(#${id}-plate)`} d="M80 18 L314 13 L321 36 L314 59 L80 56 L85 36 Z" />
          <Wordmark x={92} y={50} w={214} id={id} />
        </g>
      )}

      {layout === 'mark' && (
        <g className={styles.paper}>
          <Crest x={2} y={2} s={1} id={id} />
        </g>
      )}
    </svg>
  );
}

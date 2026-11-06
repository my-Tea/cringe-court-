import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './OrnateFrame.module.css';

/** 7×7 pixel diamond knot that sits on each frame corner (style-guide frame flourishes). */
const KNOT_OUTLINE = 'M3 0h1v1H3zM2 1h1v1H2zM4 1h1v1H4zM1 2h1v1H1zM5 2h1v1H5zM0 3h1v1H0zM6 3h1v1H6zM1 4h1v1H1zM5 4h1v1H5zM2 5h1v1H2zM4 5h1v1H4zM3 6h1v1H3z';
const KNOT_FILL = 'M3 1h1v1H3zM2 2h3v1H2zM1 3h5v1H1zM2 4h3v1H2zM3 5h1v1H3z';
const KNOT_SHINE = 'M3 2h1v1H3zM2 3h1v1H2z';

function Knot({ className }: { className: string | undefined }) {
  return (
    <svg className={className} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden focusable="false">
      <path d={KNOT_OUTLINE} className={styles.knotOutline} />
      <path d={KNOT_FILL} className={styles.knotFill} />
      <path d={KNOT_SHINE} className={styles.knotShine} />
    </svg>
  );
}

/** The four gold corner knots. Put inside any `position: relative` box with an ornate border. */
export function OrnateCorners() {
  return (
    <>
      <Knot className={cx(styles.knot, styles.tl)} />
      <Knot className={cx(styles.knot, styles.tr)} />
      <Knot className={cx(styles.knot, styles.bl)} />
      <Knot className={cx(styles.knot, styles.br)} />
    </>
  );
}

export interface OrnateFrameProps extends HTMLAttributes<HTMLElement> {
  /** `parchment` (default): cream paper, gold double rule. `wood`: maroon velvet panel with the same gold rule. */
  tone?: 'parchment' | 'wood';
  padding?: 'sm' | 'md' | 'lg';
  /** Optional title on a maroon ribbon across the top rule. */
  ribbon?: ReactNode;
  as?: 'div' | 'section' | 'article' | 'aside' | 'figure';
}

/**
 * The parchment frame from the style guide: a rounded gold double rule with
 * pixel corner knots around a cream (or maroon) panel. Children re-theme
 * automatically through `data-surface`.
 */
export function OrnateFrame({ tone = 'parchment', padding = 'md', ribbon, as: Tag = 'div', className, children, ...rest }: OrnateFrameProps) {
  return (
    <Tag className={cx(styles.frame, styles[padding], ribbon != null && styles.withRibbon, className)} data-surface={tone} {...rest}>
      <OrnateCorners />
      {ribbon != null && <p className={styles.ribbon}>{ribbon}</p>}
      {children}
    </Tag>
  );
}

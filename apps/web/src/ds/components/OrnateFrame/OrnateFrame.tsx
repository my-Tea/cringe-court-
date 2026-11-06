import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './OrnateFrame.module.css';

/**
 * Gold card photo-corners: a folded triangle of foil tucked over each corner of
 * the sheet (papercraft, STYLE-GUIDE §9.3). Put inside any `position: relative` box.
 */
export function OrnateCorners() {
  return (
    <>
      <span className={cx(styles.corner, styles.tl)} aria-hidden />
      <span className={cx(styles.corner, styles.tr)} aria-hidden />
      <span className={cx(styles.corner, styles.bl)} aria-hidden />
      <span className={cx(styles.corner, styles.br)} aria-hidden />
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
 * A mounted sheet: cream (or maroon) card on a gold card mount, trimmed corners,
 * gold photo-corners and an optional maroon ribbon across the top. Children
 * re-theme automatically through `data-surface`.
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

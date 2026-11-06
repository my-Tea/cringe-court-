import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './PaperPanel.module.css';

export type PaperTone = 'cream' | 'maroon' | 'gold' | 'kraft';
export type PaperEdge = 'clean' | 'cut' | 'torn' | 'zigzag';
export type PaperElevation = 0 | 1 | 2 | 3 | 4;

export interface PaperPanelProps extends HTMLAttributes<HTMLElement> {
  /**
   * Paper stock. `cream` (default) is parchment card; `maroon` is the velvet
   * maroon card of the login panel and re-themes its children to the wood
   * surface; `gold` is foil card; `kraft` is the warm tan backing sheet.
   */
  tone?: PaperTone;
  /** How the sheet was cut: square, chamfered corners, a torn top and bottom, or pinking-shear zig-zag. */
  edge?: PaperEdge;
  /** Paper layers below this one (shadow depth). */
  elevation?: PaperElevation;
  /** Fold facets (light and shade planes). On by default. */
  facets?: boolean;
  /** A second, offset sheet peeking out underneath (the layered look). */
  backing?: 'none' | 'gold' | 'maroon' | 'cream';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Unfold on mount (skipped under reduced motion). */
  unfold?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'nav' | 'li' | 'form';
}

const surfaceFor: Record<PaperTone, 'parchment' | 'wood'> = { cream: 'parchment', gold: 'parchment', kraft: 'parchment', maroon: 'wood' };

/**
 * A sheet of card stock: the base layer of the papercraft language.
 *
 * The outline (torn, zig-zag or cut) is a mask on the sheet; the shadow is a
 * `drop-shadow` filter on the layer wrapper so it follows the cut outline
 * without shadowing the text.
 * Children re-theme through `data-surface` (maroon → wood roles).
 */
export function PaperPanel({
  tone = 'cream',
  edge = 'clean',
  elevation = 2,
  facets = true,
  backing = 'none',
  padding = 'md',
  unfold = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: PaperPanelProps) {
  return (
    <Tag
      className={cx(styles.panel, unfold && 'cc-unfold', className)}
      data-tone={tone}
      data-edge={edge}
      data-elevation={elevation}
      data-backing={backing}
      data-surface={surfaceFor[tone]}
      {...rest}
    >
      <span className={styles.layers} aria-hidden>
        {backing !== 'none' && <span className={styles.backing} />}
        <span className={cx(styles.sheet, facets && styles.facets)} />
      </span>
      <div className={cx(styles.content, styles[`pad-${padding}`])}>{children}</div>
    </Tag>
  );
}

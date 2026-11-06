import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './PaperRibbon.module.css';

export interface PaperRibbonProps extends HTMLAttributes<HTMLElement> {
  /** Paper stock: `cream` (default, ink text), `maroon` (cream text), `gold` (maroon text). */
  tone?: 'cream' | 'maroon' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  /** Folded swallowtail ends behind the band. Off for a plain strip (a tagline slip). */
  tails?: boolean;
  /** Gold chevron sparks either side of the text, as on the reference heading. */
  sparks?: boolean;
  /** Heading level or plain paragraph. Ribbons are often the section heading. */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div';
}

/**
 * A heading banner cut from a strip of card: the band sits in front, the two
 * swallowtail ends are folded behind it (darker, because they face away from
 * the light). The text is real text; all paper is decoration.
 */
export function PaperRibbon({ tone = 'cream', size = 'md', tails = true, sparks = false, as: Tag = 'h2', className, children, ...rest }: PaperRibbonProps) {
  return (
    <Tag className={cx(styles.ribbon, className)} data-tone={tone} data-size={size} data-tails={tails || undefined} {...rest}>
      <span className={styles.layers} aria-hidden>
        {tails && (
          <>
            <span className={styles.tail} data-side="start" />
            <span className={styles.tail} data-side="end" />
          </>
        )}
        <span className={styles.band} />
      </span>
      {sparks && <span className={styles.spark} data-side="start" aria-hidden />}
      <span className={styles.text}>{children}</span>
      {sparks && <span className={styles.spark} data-side="end" aria-hidden />}
    </Tag>
  );
}

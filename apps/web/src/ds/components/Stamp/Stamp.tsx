import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Stamp.module.css';

export type StampTone = 'guilty' | 'not-cooked' | 'no-verdict' | 'filed' | 'case-number' | 'side-a' | 'side-b';

const toneClass: Record<StampTone, string | undefined> = {
  guilty: styles.guilty,
  'not-cooked': styles.notCooked,
  'no-verdict': styles.noVerdict,
  filed: styles.filed,
  'case-number': styles.caseNumber,
  'side-a': styles.sideA,
  'side-b': styles.sideB,
};

export interface StampProps {
  children: ReactNode;
  /** Small second line ("SENTENCE PENDING", "FULL REFUND"). */
  sub?: ReactNode;
  tone?: StampTone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Slam onto the page when mounted (instant under reduced motion). */
  animate?: boolean;
  className?: string;
}

/**
 * A verdict slip: a pinked cream card slip with the verdict rubber-stamped on it
 * in ink (STYLE-GUIDE §9.11). Text is live HTML, so labels stay accessible.
 */
export function Stamp({ children, sub, tone = 'guilty', size = 'md', animate, className }: StampProps) {
  return (
    // The ink is always read against the cream slip, so the tones resolve on the parchment surface.
    <span className={cx(styles.stamp, toneClass[tone], size !== 'md' && styles[size], animate && styles.animate, className)} data-surface="parchment">
      <span className={styles.ink}>
        <span>{children}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
    </span>
  );
}

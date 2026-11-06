import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'highlight' | 'success' | 'danger' | 'info' | 'side-a' | 'side-b';

const toneClass: Record<BadgeTone, string | undefined> = {
  neutral: styles.neutral,
  accent: styles.accent,
  highlight: styles.highlight,
  success: styles.success,
  danger: styles.danger,
  info: styles.info,
  'side-a': styles.sideA,
  'side-b': styles.sideB,
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Filled instead of tinted. */
  solid?: boolean;
  /** Leading status dot; `pulse` animates it for "live" states. */
  dot?: boolean | 'pulse';
}

export function Badge({ tone = 'neutral', solid, dot, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(styles.badge, toneClass[tone], solid && styles.solid, dot && styles.dot, dot === 'pulse' && styles.pulse, className)}
      {...rest}
    />
  );
}

/**
 * Every screen shows this (D14: testnet only, all modes). It explains itself to
 * assistive tech, since "TESTNET" alone is jargon.
 */
export function TestnetBadge({ className }: { className?: string }) {
  return (
    <span className={cx(styles.badge, styles.testnet, className)} title="Arc testnet: test USDC only, no real money">
      Testnet
      <span className="cc-visually-hidden">: Arc testnet, test USDC only, no real money</span>
    </span>
  );
}

import { formatUsdc, type Usdc } from '@cringe-court/core';
import { cx } from '../../lib/cx';
import styles from './Amount.module.css';

export interface AmountProps {
  value: Usdc;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Money coming to you (+, green) or leaving you (−, red). Neutral by default. */
  direction?: 'credit' | 'debit';
  className?: string;
}

/**
 * Test USDC, exact to the micro-unit (never rounded), in tabular figures so
 * columns of money line up. Screen readers hear "1.20 test USDC".
 */
export function Amount({ value, size = 'md', direction, className }: AmountProps) {
  const number = formatUsdc(value, { unit: false });
  const sign = direction === 'credit' ? '+' : direction === 'debit' ? '−' : '';
  const spoken = `${direction === 'credit' ? 'plus ' : direction === 'debit' ? 'minus ' : ''}${number} test USDC`;
  return (
    <span className={cx(styles.amount, size !== 'md' && styles[size], direction && styles[direction], className)}>
      <span aria-hidden>
        {sign}
        {number}
      </span>
      <span className={styles.unit} aria-hidden>
        USDC
      </span>
      <span className="cc-visually-hidden">{spoken}</span>
    </span>
  );
}

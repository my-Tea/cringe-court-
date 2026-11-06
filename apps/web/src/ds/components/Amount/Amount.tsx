import { formatUsdc, type Usdc } from '@cringe-court/core';
import { t } from '@/i18n';
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
  const spoken = t('common.unit.usdc', { amount: `${direction === 'credit' ? `${t('ds.amount.plus')} ` : direction === 'debit' ? `${t('ds.amount.minus')} ` : ''}${number}` });
  return (
    <span className={cx(styles.amount, size !== 'md' && styles[size], direction && styles[direction], className)}>
      <span aria-hidden>
        {sign}
        {number}
      </span>
      <span className={styles.unit} aria-hidden>
        {t('ds.amount.unit')}
      </span>
      <span className="cc-visually-hidden">{spoken}</span>
    </span>
  );
}

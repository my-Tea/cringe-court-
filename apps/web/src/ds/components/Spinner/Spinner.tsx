import { cx } from '../../lib/cx';
import { t } from '@/i18n';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Accessible name. Pass `null` when a parent already announces the busy state. */
  label?: string | null;
  className?: string;
}

export function Spinner({ size = 'md', label = t('ds.spinner.label'), className }: SpinnerProps) {
  const a11y = label === null ? { 'aria-hidden': true as const } : { role: 'status' as const, 'aria-label': label };
  return (
    <span className={cx(styles.spinner, size !== 'md' && styles[size], className)} {...a11y}>
      <span className={styles.block} />
      <span className={styles.block} />
      <span className={styles.block} />
      <span className={styles.block} />
    </span>
  );
}

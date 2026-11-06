import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Alert.module.css';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const icons: Record<AlertTone, IconName> = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' };

export interface AlertProps {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Dismiss / close control rendered at the end. */
  trailing?: ReactNode;
  /**
   * Announce on mount. `assertive` (role="alert") is for errors that block the
   * task; `polite` (role="status") for everything else; `off` for static notes.
   */
  live?: 'off' | 'polite' | 'assertive';
  className?: string;
}

export function Alert({ tone = 'info', title, children, actions, trailing, live = 'off', className }: AlertProps) {
  const role = live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined;
  return (
    <div role={role} className={cx(styles.alert, tone !== 'info' && styles[tone], className)}>
      <Icon name={icons[tone]} size="1.25rem" className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {trailing}
    </div>
  );
}

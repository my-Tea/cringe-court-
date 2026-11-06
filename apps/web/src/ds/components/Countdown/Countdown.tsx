import { formatDateTime, t } from '@/i18n';
import { cx } from '../../lib/cx';
import { useNow } from '../../lib/useNow';
import { Icon } from '../Icon/Icon';
import styles from './Countdown.module.css';
import { formatRemaining, speakRemaining, urgencyOf } from './format';

export interface CountdownProps {
  /** What ends ("Commit your ballot"). */
  label: string;
  /** Phase start and end, ms since epoch. The bar shows the share of time left. */
  startsAt: number;
  endsAt: number;
  /** Fixed clock for tests and demos; omit to tick in real time. */
  now?: number;
  /** One-line version for headers and lists. */
  compact?: boolean;
  className?: string;
}

export function Countdown({ label, startsAt, endsAt, now: fixedNow, compact, className }: CountdownProps) {
  const liveNow = useNow(1000, fixedNow !== undefined);
  const now = fixedNow ?? liveNow;
  const remaining = endsAt - now;
  const total = endsAt - startsAt;
  const urgency = urgencyOf(remaining, total);
  const left = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  const deadline = formatDateTime(endsAt, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

  return (
    <div className={cx(styles.countdown, urgency !== 'calm' && styles[urgency], compact && styles.compact, className)}>
      <div className={styles.row}>
        <span className={styles.label}>
          <Icon name="clock" />
          {label}
        </span>
        {/* role="timer" is not live by default, so screen readers are not spammed every second. */}
        <span role="timer" aria-label={urgency === 'ended' ? t('ds.countdown.aria.ended', { label, deadline }) : t('ds.countdown.aria.left', { label, remaining: speakRemaining(remaining), deadline })} className={styles.time}>
          {urgency === 'ended' ? t('ds.countdown.ended') : formatRemaining(remaining)}
        </span>
      </div>
      <div className={styles.track} aria-hidden>
        <div className={styles.fill} style={{ ['--_left' as string]: left }} />
      </div>
      <p className={styles.deadline}>{t('ds.countdown.deadline', { deadline })}</p>
    </div>
  );
}

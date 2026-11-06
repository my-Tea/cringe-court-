import { t, type MessageKey } from '@/i18n';
import { cx } from '../../lib/cx';
import styles from './ImpactText.module.css';

export type ImpactKind = 'objection' | 'cook' | 'order' | 'counter';

const DEFAULT_TEXT: Record<ImpactKind, MessageKey> = {
  objection: 'ds.impact.objection',
  cook: 'ds.impact.cook',
  order: 'ds.impact.order',
  counter: 'ds.impact.counter',
};

export interface ImpactTextProps {
  kind?: ImpactKind;
  /** Override the words. Keep it short: these are shouted. */
  children?: string;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

export function ImpactText({ kind = 'objection', children, size = 'md', animate, className }: ImpactTextProps) {
  return (
    <span className={cx(styles.impact, styles[kind], size !== 'md' && styles[size], animate && styles.animate, className)}>
      <span className={styles.text}>{children ?? t(DEFAULT_TEXT[kind])}</span>
    </span>
  );
}

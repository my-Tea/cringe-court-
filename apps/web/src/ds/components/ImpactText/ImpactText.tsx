import { cx } from '../../lib/cx';
import styles from './ImpactText.module.css';

export type ImpactKind = 'objection' | 'cook' | 'order' | 'counter';

const DEFAULT_TEXT: Record<ImpactKind, string> = {
  objection: 'Objection!',
  cook: 'Let bro cook',
  order: 'Order!',
  counter: 'Counter!',
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
      <span className={styles.text}>{children ?? DEFAULT_TEXT[kind]}</span>
    </span>
  );
}

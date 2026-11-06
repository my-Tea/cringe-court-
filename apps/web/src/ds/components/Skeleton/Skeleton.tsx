import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  variant?: 'block' | 'text' | 'circle';
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}

/** Placeholder shape. Purely visual: wrap groups in an element with aria-busy and a label. */
export function Skeleton({ variant = 'block', width, height, className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cx(styles.skeleton, variant !== 'block' && styles[variant], className)}
      style={{ width, height: height ?? (variant === 'circle' ? width : undefined) }}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cx(styles.lines, className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" />
      ))}
    </span>
  );
}

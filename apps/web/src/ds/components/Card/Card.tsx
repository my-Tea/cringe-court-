import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { OrnateCorners } from '../OrnateFrame/OrnateFrame';
import styles from './Card.module.css';

export type CardTone = 'default' | 'raised' | 'ornate' | 'parchment' | 'sunken';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: CardTone;
  padding?: 'sm' | 'md' | 'lg';
  /** Lifts on hover; put `data-card-link` on the title link to make the whole card clickable. */
  interactive?: boolean;
  /** Render as <article> (default), <section> or <div>. */
  as?: 'article' | 'section' | 'div' | 'li';
}

/** `ornate` and `parchment` carry the mounted-sheet frame with gold photo-corners. */
const pad = { sm: styles.padSm, md: styles.padMd, lg: styles.padLg };

export function Card({ tone = 'default', padding = 'md', interactive, as: Tag = 'article', className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(styles.card, tone !== 'default' && styles[tone], pad[padding], interactive && styles.interactive, className)}
      {...rest}
    >
      {(tone === 'ornate' || tone === 'parchment') && <OrnateCorners />}
      {children}
    </Tag>
  );
}

export function CardHeader({ eyebrow, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { eyebrow?: ReactNode }) {
  return (
    <div className={cx(styles.header, className)} {...rest}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      {children}
    </div>
  );
}

export function CardTitle({ as: Tag = 'h3', className, ...rest }: HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }) {
  return <Tag className={cx(styles.title, className)} {...rest} />;
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx(styles.description, className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.body, className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.footer, className)} {...rest} />;
}

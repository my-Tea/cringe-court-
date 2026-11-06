import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './RoundIconButton.module.css';

type Tone = 'royal' | 'gold';
type Size = 'md' | 'lg';

function roundIconClassName({ tone = 'royal', size = 'md', className }: { tone?: Tone; size?: Size; className?: string | undefined }) {
  return cx(styles.button, styles[tone], styles[size], className);
}

export interface RoundIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required accessible name (also the tooltip text callers usually show). */
  label: string;
  icon: IconName;
  /** `royal` (default): maroon disc, gold glyph. `gold`: gold disc, maroon glyph. */
  tone?: Tone;
  size?: Size;
  /** Toggle state; renders aria-pressed. */
  pressed?: boolean;
}

/**
 * The round ornate icon button from the style guide (scales, document, gear,
 * star): a maroon disc in a gold rim with a pixel glyph. Pressing sinks it
 * onto its dark edge, like the other buttons.
 */
export const RoundIconButton = forwardRef<HTMLButtonElement, RoundIconButtonProps>(function RoundIconButton(
  { label, icon, tone = 'royal', size = 'md', pressed, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={roundIconClassName({ tone, size, className })}
      {...rest}
    >
      <Icon name={icon} className={styles.glyph} />
    </button>
  );
});

export interface RoundIconLinkProps extends Omit<LinkProps, 'children' | 'className'> {
  /** Required accessible name. */
  label: string;
  icon: IconName;
  tone?: Tone;
  size?: Size;
  className?: string;
}

/** The tile alone, decorative, for links that carry a visible caption (hover follows the parent link). */
export function RoundIconTile({ icon, tone, size, className }: { icon: IconName; tone?: Tone; size?: Size; className?: string }) {
  return (
    <span className={roundIconClassName({ tone, size, className: cx(styles.tile, className) })} aria-hidden>
      <Icon name={icon} className={styles.glyph} />
    </span>
  );
}

/** The same ornate tile as a router link (navigation stays a link for a11y). */
export const RoundIconLink = forwardRef<HTMLAnchorElement, RoundIconLinkProps>(function RoundIconLink(
  { label, icon, tone, size, className, ...rest },
  ref,
) {
  return (
    <Link ref={ref} aria-label={label} className={roundIconClassName({ tone, size, className })} {...rest}>
      <Icon name={icon} className={styles.glyph} />
    </Link>
  );
});

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '../../lib/cx';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.css';

/**
 * `primary` follows the surface (maroon plate on parchment, gold plate on the
 * maroon/wood surface); `gold` and `maroon` are fixed paper stocks (the
 * papercraft reference's "ENTER THE COURT" and "PLAY AS GUEST").
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'swear' | 'gold' | 'maroon';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
}

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth,
  iconOnly,
  className,
}: Pick<ButtonStyleProps, 'variant' | 'size' | 'fullWidth'> & { iconOnly?: boolean; className?: string | undefined }) {
  return cx(
    styles.button,
    variant !== 'primary' && styles[variant],
    size !== 'md' && styles[size],
    fullWidth && styles.fullWidth,
    iconOnly && styles.iconOnly,
    className,
  );
}

function Content({ iconStart, iconEnd, children }: Pick<ButtonStyleProps, 'iconStart' | 'iconEnd'> & { children?: ReactNode }) {
  return (
    <>
      {iconStart && <span className={styles.icon} aria-hidden>{iconStart}</span>}
      {children !== undefined && <span className={styles.label}>{children}</span>}
      {iconEnd && <span className={styles.icon} aria-hidden>{iconEnd}</span>}
    </>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  /** Shows a spinner, keeps the width, blocks clicks and announces "busy". */
  loading?: boolean;
}

/**
 * The one button. `disabled` is rendered as `aria-disabled` so the control stays
 * focusable and can explain why it is unavailable; clicks are swallowed.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, iconStart, iconEnd, loading = false, disabled, className, children, onClick, type = 'button', ...rest },
  ref,
) {
  const inert = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonClassName({ variant, size, fullWidth, className }), loading && styles.loading)}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      <Content iconStart={iconStart} iconEnd={iconEnd}>
        {children}
      </Content>
      {loading && (
        <span className={styles.spinner}>
          <Spinner size={size === 'lg' ? 'md' : 'sm'} label={null} />
        </span>
      )}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps, Pick<ButtonStyleProps, 'variant' | 'size' | 'fullWidth' | 'iconStart' | 'iconEnd'> {}

/** A router link that looks like a button (navigation stays a link for a11y). */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant, size, fullWidth, iconStart, iconEnd, className, children, ...rest },
  ref,
) {
  return (
    <Link ref={ref} className={buttonClassName({ variant, size, fullWidth, className: typeof className === 'string' ? className : undefined })} {...rest}>
      <Content iconStart={iconStart} iconEnd={iconEnd}>
        {children as ReactNode}
      </Content>
    </Link>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'iconStart' | 'iconEnd' | 'children' | 'fullWidth'> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', className, ...rest },
  ref,
) {
  return (
    <Button ref={ref} variant={variant} aria-label={label} className={cx(styles.iconOnly, className)} iconStart={icon} {...rest} />
  );
});

export type PaperButtonVariant = 'gold' | 'maroon' | 'ghost';

export interface PaperButtonProps extends Omit<ButtonProps, 'variant'> {
  /** `gold` (default): the primary paper plate. `maroon`: secondary. `ghost`: text only. */
  variant?: PaperButtonVariant;
}

/**
 * The papercraft plate with explicit paper stock, independent of the surface:
 * gold foil, deep maroon card or ghost. Same press, focus and disabled rules as
 * `Button` (it is one).
 */
export const PaperButton = forwardRef<HTMLButtonElement, PaperButtonProps>(function PaperButton({ variant = 'gold', ...rest }, ref) {
  return <Button ref={ref} variant={variant} {...rest} />;
});

export interface PaperButtonLinkProps extends Omit<ButtonLinkProps, 'variant'> {
  variant?: PaperButtonVariant;
}

export const PaperButtonLink = forwardRef<HTMLAnchorElement, PaperButtonLinkProps>(function PaperButtonLink({ variant = 'gold', ...rest }, ref) {
  return <ButtonLink ref={ref} variant={variant} {...rest} />;
});

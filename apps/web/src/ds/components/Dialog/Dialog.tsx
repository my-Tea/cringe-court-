import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './Dialog.module.css';

/**
 * Modal dialog on Radix (focus trap, Escape, scroll lock, aria wiring, focus
 * return). Title is required; description strongly encouraged, since it is
 * what a screen reader announces after the title.
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned; stacked full-width on small screens. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Red header rule for destructive confirmations. */
  tone?: 'default' | 'danger';
  /** `sheet` slides in from the right edge. */
  variant?: 'modal' | 'sheet';
  /** Hide the × button (only when the footer has an explicit cancel). */
  hideClose?: boolean;
  className?: string;
}

export function DialogContent({
  title,
  description,
  children,
  footer,
  size = 'md',
  tone = 'default',
  variant = 'modal',
  hideClose,
  className,
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={styles.overlay} />
      <RadixDialog.Content
        className={cx(styles.content, size !== 'md' && styles[size], tone === 'danger' && styles.danger, variant === 'sheet' && styles.sheet, className)}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            {description && <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>}
          </div>
          {!hideClose && (
            <RadixDialog.Close asChild>
              <IconButton label="Close" icon={<Icon name="close" />} size="sm" className={styles.close} />
            </RadixDialog.Close>
          )}
        </div>
        {children && <div className={styles.body}>{children}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

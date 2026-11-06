import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { t } from '@/i18n';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './PaperField.module.css';

export interface PaperFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  label: ReactNode;
  /** Leading icon. Beside the label by default (as on the reference), or inside the strip. */
  icon?: IconName;
  iconPlacement?: 'label' | 'inside';
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** Password fields: an eye button toggles the text visible. */
  revealable?: boolean;
  className?: string;
}

/**
 * A strip of cream card with a text input on it: label (with its icon) above,
 * the hand-trimmed strip below, hint and error under it. The focus ring is a
 * double ring (ink inside, the surface's focus colour outside) so it clears 3:1
 * against both the cream strip and the sheet behind it.
 */
export const PaperField = forwardRef<HTMLInputElement, PaperFieldProps>(function PaperField(
  { label, icon, iconPlacement = 'label', hint, error, optional, revealable, type = 'text', id: idProp, className, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? `paper-field-${auto}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const [revealed, setRevealed] = useState(false);
  const inputType = revealable && revealed ? 'text' : type;

  return (
    <div className={cx(styles.field, className)} data-invalid={error ? true : undefined}>
      <label htmlFor={id} className={styles.label}>
        {icon && iconPlacement === 'label' && <Icon name={icon} className={styles.labelIcon} />}
        <span>{label}</span>
        {optional && <span className={styles.optional}>{t('ds.field.optional')}</span>}
      </label>
      <div className={styles.strip} data-has-icon={icon && iconPlacement === 'inside' ? true : undefined} data-revealable={revealable || undefined}>
        {icon && iconPlacement === 'inside' && <Icon name={icon} className={styles.insideIcon} />}
        <input
          ref={ref}
          id={id}
          type={inputType}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={!optional}
          {...rest}
        />
        {revealable && (
          <button
            type="button"
            className={styles.reveal}
            aria-label={revealed ? t('ds.field.password.hide') : t('ds.field.password.show')}
            aria-pressed={revealed}
            aria-controls={id}
            onClick={() => setRevealed((r) => !r)}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} />
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <Icon name="alert" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

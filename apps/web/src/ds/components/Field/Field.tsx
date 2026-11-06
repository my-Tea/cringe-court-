import {
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';
import styles from './Field.module.css';

interface FieldChromeProps {
  label: ReactNode;
  /** Help text under the control. Linked with aria-describedby. */
  hint?: ReactNode;
  /** Error text. Sets aria-invalid and replaces nothing: the hint stays visible. */
  error?: ReactNode;
  /** Mark optional fields instead of required ones (the common case is required). */
  optional?: boolean;
  className?: string;
}

interface ShellProps extends FieldChromeProps {
  id: string;
  hintId: string;
  errorId: string;
  counter?: ReactNode;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, optional, hintId, errorId, counter, className, children }: ShellProps) {
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional && <span className={styles.optional}>(optional)</span>}
        </label>
        {counter}
      </div>
      {children}
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
}

function useFieldIds(idProp: string | undefined, hint: ReactNode, error: ReactNode) {
  const auto = useId();
  const id = idProp ?? `field-${auto}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

/** Live character counter. Announces politely only when close to the limit. */
function Counter({ length, max }: { length: number; max: number }) {
  const left = max - length;
  const near = left <= Math.max(10, Math.floor(max * 0.1));
  return (
    <span className={cx(styles.counter, left < 0 && styles.counterOver)} aria-live={near ? 'polite' : 'off'}>
      {length}/{max}
      <span className="cc-visually-hidden"> characters{left < 0 ? `, ${-left} over the limit` : ''}</span>
    </span>
  );
}

/* ── TextField ───────────────────────────────────────────────────── */

export interface TextFieldProps extends FieldChromeProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, className, id: idProp, ...rest },
  ref,
) {
  const { id, hintId, errorId, describedBy } = useFieldIds(idProp, hint, error);
  return (
    <FieldShell {...{ id, label, hint, error, optional, hintId, errorId, className }}>
      <input
        ref={ref}
        id={id}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={!optional}
        {...rest}
      />
    </FieldShell>
  );
});

/* ── TextArea ────────────────────────────────────────────────────── */

export interface TextAreaProps extends FieldChromeProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'maxLength'> {
  /**
   * Soft limit: shows a counter and flags overflow, but lets people keep typing
   * so pasted text is never silently cut. Validate on submit.
   */
  maxLength?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, optional, className, id: idProp, maxLength, value, defaultValue, onChange, ...rest },
  ref,
) {
  const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? ''));
  const length = (value !== undefined ? String(value) : uncontrolled).length;
  const over = maxLength !== undefined && length > maxLength;
  const shownError = error ?? (over ? `Keep it to ${maxLength} characters.` : undefined);
  const { id, hintId, errorId, describedBy } = useFieldIds(idProp, hint, shownError);
  return (
    <FieldShell
      {...{ id, label, hint, optional, hintId, errorId, className }}
      error={shownError}
      counter={maxLength !== undefined ? <Counter length={length} max={maxLength} /> : undefined}
    >
      <textarea
        ref={ref}
        id={id}
        className={cx(styles.control, styles.textarea)}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={describedBy}
        required={!optional}
        value={value}
        defaultValue={defaultValue}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          if (value === undefined) setUncontrolled(event.target.value);
          onChange?.(event);
        }}
        {...rest}
      />
    </FieldShell>
  );
});

/* ── Select ──────────────────────────────────────────────────────── */

export interface SelectProps extends FieldChromeProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  /** Shown as a disabled first option when nothing is chosen yet. */
  placeholder?: string;
}

/** Native select: best keyboard, screen-reader and mobile behaviour for free. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, optional, className, id: idProp, options, placeholder, defaultValue, ...rest },
  ref,
) {
  const { id, hintId, errorId, describedBy } = useFieldIds(idProp, hint, error);
  return (
    <FieldShell {...{ id, label, hint, error, optional, hintId, errorId, className }}>
      <div className={styles.selectWrap}>
        <select
          ref={ref}
          id={id}
          className={cx(styles.control, styles.select)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={!optional}
          defaultValue={defaultValue ?? (placeholder && rest.value === undefined ? '' : undefined)}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" className={styles.selectIcon} />
      </div>
    </FieldShell>
  );
});

/* ── Checkbox ────────────────────────────────────────────────────── */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, error, className, id: idProp, disabled, ...rest },
  ref,
) {
  const { id, hintId, errorId, describedBy } = useFieldIds(idProp, description, error);
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={cx(styles.choice, disabled && styles.choiceDisabled)}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={styles.checkbox}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <span className={styles.choiceText}>
          <span className={styles.choiceLabel}>{label}</span>
          {description && (
            <span id={hintId} className={styles.hint}>
              {description}
            </span>
          )}
        </span>
      </label>
      {error && (
        <p id={errorId} className={styles.error}>
          <Icon name="alert" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

/* ── Switch ──────────────────────────────────────────────────────── */

export interface SwitchProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ label, description, checked, onCheckedChange, disabled, id: idProp, className }: SwitchProps) {
  const { id, hintId, describedBy } = useFieldIds(idProp, description, undefined);
  return (
    <div className={cx(styles.choice, disabled && styles.choiceDisabled, className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={describedBy}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onCheckedChange(!checked)}
      />
      <span className={styles.choiceText}>
        <label htmlFor={id} className={styles.choiceLabel}>
          {label}
        </label>
        {description && (
          <span id={hintId} className={styles.hint}>
            {description}
          </span>
        )}
      </span>
    </div>
  );
}

/* ── RadioCards ──────────────────────────────────────────────────── */

export type RadioTone = 'accent' | 'guilty' | 'not-cooked' | 'side-a' | 'side-b' | 'highlight';

const toneClass: Record<RadioTone, string | undefined> = {
  accent: undefined,
  guilty: styles.toneGuilty,
  'not-cooked': styles.toneNotCooked,
  'side-a': styles.toneSideA,
  'side-b': styles.toneSideB,
  highlight: styles.toneHighlight,
};

export interface RadioCardOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  tone?: RadioTone;
  disabled?: boolean;
}

export interface RadioCardsProps {
  legend: ReactNode;
  name: string;
  options: readonly RadioCardOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}

/** Large tappable choices in a native radio group: arrow keys, form semantics and all. */
export function RadioCards({ legend, name, options, value, defaultValue, onValueChange, hint, error, className }: RadioCardsProps) {
  const { id, hintId, errorId, describedBy } = useFieldIds(undefined, hint, error);
  return (
    <fieldset className={cx(styles.radioGroup, className)} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.radioGroupBody}>
        <div className={styles.radioGrid}>
          {options.map((o) => {
            const optionId = `${id}-${o.value}`;
            return (
              <label key={o.value} htmlFor={optionId} className={cx(styles.radioCard, o.tone && toneClass[o.tone])}>
                <input
                  id={optionId}
                  type="radio"
                  name={name}
                  value={o.value}
                  className={styles.radio}
                  disabled={o.disabled}
                  {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
                  onChange={(e) => e.target.checked && onValueChange?.(o.value)}
                />
                <span className={styles.choiceText}>
                  <span className={styles.choiceLabel}>{o.label}</span>
                  {o.description && <span className={styles.hint}>{o.description}</span>}
                </span>
              </label>
            );
          })}
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
    </fieldset>
  );
}

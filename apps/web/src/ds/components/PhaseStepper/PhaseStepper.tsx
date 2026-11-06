import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';
import styles from './PhaseStepper.module.css';

export interface PhaseStepperProps {
  /** Step names, in order. */
  steps: readonly string[];
  /** Index of the current step; `steps.length` means all done. */
  current: number;
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/** Trial progress. An ordered list; the current step carries aria-current="step". */
export function PhaseStepper({ steps, current, label = 'Trial progress', orientation = 'horizontal', className }: PhaseStepperProps) {
  return (
    <ol aria-label={label} className={cx(styles.stepper, orientation === 'vertical' && styles.vertical, className)}>
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
        return (
          <li key={step} className={cx(styles.step, state !== 'upcoming' && styles[state])} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.bar} aria-hidden />
            <span className={styles.text}>
              <span className={styles.marker} aria-hidden>
                {state === 'done' ? <Icon name="check" size="0.7rem" /> : i + 1}
              </span>
              <span>
                {step}
                {state === 'done' && <span className="cc-visually-hidden"> (done)</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

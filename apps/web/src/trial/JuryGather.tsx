/**
 * Seats fill one by one, then the hearing starts — same ceremony for Solo,
 * Versus and Grand Jury so every mode opens like Mode 1.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/ds';
import { t } from '@/i18n';
import styles from './JuryGather.module.css';

/** How long each empty seat stays empty before the next juror sits. */
export const JURY_SEAT_MS = 1100;
/** Pause on a full bench before the trial starts. */
export const JURY_SEATED_HOLD_MS = 800;

/** Test seam: skip the seat-fill ceremony (Versus ballot / roam stubs). */
let skipGatherForTests = false;
export function __setSkipJuryGatherForTests(skip: boolean): void {
  skipGatherForTests = skip;
}
/** True while tests ask to jump straight into the hearing. */
export function __isJuryGatherSkippedForTests(): boolean {
  return skipGatherForTests;
}

export interface JuryGatherProps {
  jurors: number;
  onSeated: () => void;
  /** Override title (defaults to shared trial.jury.waitTitle). */
  title?: string;
  /** Override body; `{jurors}` is filled from `jurors`. */
  body?: string;
}

export function JuryGather({ jurors, onSeated, title, body }: JuryGatherProps) {
  const reduced = useReducedMotion() || skipGatherForTests;
  const size = Math.max(1, jurors);
  const [seated, setSeated] = useState(reduced ? size : 0);

  useEffect(() => {
    if (reduced) {
      // No ceremony under reduce-motion — same as Solo live when the OS asks for calm.
      onSeated();
      return;
    }
    if (seated >= size) {
      const id = window.setTimeout(onSeated, JURY_SEATED_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setSeated((n) => n + 1), JURY_SEAT_MS);
    return () => window.clearTimeout(id);
  }, [reduced, seated, size, onSeated]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{title ?? t('trial.jury.waitTitle')}</h1>
      <p className={styles.lede}>{body ?? t('trial.jury.waitBody', { jurors: size })}</p>
      <div className={styles.bench} aria-hidden>
        {Array.from({ length: size }, (_, i) => (
          <span key={i} className={i < seated ? styles.benchFull : styles.benchEmpty} />
        ))}
      </div>
      <p role="status">{seated >= size ? t('trial.jury.full') : t('trial.jury.seats', { seated, jurors: size })}</p>
    </div>
  );
}

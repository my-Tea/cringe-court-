/**
 * The trial as the first-person roaming courtroom: you sit at the defendant's
 * table (or in the gallery), and the hearing plays as roam beats driven by the
 * mode's frozen transcript and verdict. Loaded lazily: it carries three.js.
 */
import type { AvatarSpec, PlayerRole, RemotePlayerFeed, SpawnId } from '@cringe-court/scene/roam';
import { RoamCourtroom, useRoamCourtroom } from '@cringe-court/scene/roam/react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Icon, Spinner } from '@/ds';
import { t } from '@/i18n';
import { appAudio } from '@/platform/audio';
import { playBeats, type PlannedBeat } from './beats';
import { roamStrings } from './roamStrings';
import styles from './Trial.module.css';

export interface RoamTrialProps {
  beats: readonly PlannedBeat[];
  /** Accessible name of the room. */
  label: string;
  role?: PlayerRole;
  spawn?: SpawnId;
  avatar?: AvatarSpec;
  remotes?: RemotePlayerFeed;
  /** Switch to the classic stage ("Skip to menu view"). */
  onExit: () => void;
  /** Called as each beat starts. */
  onBeat?: (index: number) => void;
  /** Called once every beat has played. */
  onDone?: () => void;
}

export function RoamTrial({
  beats,
  label,
  role = 'defendant',
  spawn = 'defendant',
  avatar = { model: 'creator', name: t('trial.roam.you') },
  remotes,
  onExit,
  onBeat,
  onDone,
}: RoamTrialProps) {
  const roam = useRoamCourtroom({ audio: appAudio(), role, spawn, avatar, ...(remotes ? { remotes } : {}) });
  const [run, setRun] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === box.current && box.current !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const canFull = typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function';
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen();
  };
  const cb = useRef({ onBeat, onDone });
  useEffect(() => {
    cb.current = { onBeat, onDone };
  });
  const controller = roam.status === 'ready' ? roam.controller : null;
  // Re-plan only when the transcript changes, not on every parent render.
  const plan = JSON.stringify(beats);

  useEffect(() => {
    if (!controller) return;
    const abort = new AbortController();
    const planned = JSON.parse(plan) as PlannedBeat[];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the finished flag when a new run starts
    setDone(false);
    void playBeats(controller, planned, abort.signal, (i) => {
      setCurrent(i);
      cb.current.onBeat?.(i);
    }).then((all) => {
      if (!all) return;
      setCurrent(null);
      setDone(true);
      cb.current.onDone?.();
    });
    return () => abort.abort();
  }, [controller, plan, run]);

  if (roam.status === 'error')
    return (
      <Alert tone="warning" title={t('trial.roam.error')} actions={<Button onClick={onExit}>{t('trial.roam.useClassic')}</Button>}>
        {roam.error.message}
      </Alert>
    );
  if (roam.status !== 'ready')
    return (
      <div className={styles.loading} role="status">
        <Spinner label={null} /> {t('trial.roam.building')}
      </div>
    );

  const strings = roamStrings();
  const beat = current !== null ? beats[current] : undefined;
  return (
    <div className={styles.roam} ref={box}>
      <RoamCourtroom controller={roam.controller} data={roam.data} onExit={onExit} label={label} strings={strings} className={styles.canvas} />
      <div className={styles.roamBar} data-surface="wood">
        <p className={styles.roamStatus} aria-live="polite">
          {beat ? (
            <>
              <span className={styles.roamStep}>{t('trial.roam.beatOf', { current: current! + 1, total: beats.length })}</span> {strings.beatLabels[beat.id]}
            </>
          ) : done ? (
            t('trial.roam.over')
          ) : (
            t('trial.roam.aboutToSit')
          )}
        </p>
        <div className={styles.roamActions}>
          {beat && (
            <Button size="sm" variant="ghost" onClick={() => roam.controller.skipBeat()}>
              {t('trial.roam.skipBeat')}
            </Button>
          )}
          <Button size="sm" variant="ghost" iconStart={<Icon name="refresh" />} onClick={() => setRun((n) => n + 1)}>
            {t('trial.roam.replay')}
          </Button>
          {canFull && (
            <Button size="sm" variant="ghost" aria-pressed={full} onClick={toggleFull}>
              {full ? t('trial.roam.exitFullScreen') : t('trial.roam.fullScreen')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

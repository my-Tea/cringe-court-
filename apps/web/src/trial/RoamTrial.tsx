/**
 * The trial as the first-person roaming courtroom: you sit where your role
 * sits (a party at their table, a juror in the jury box, a spectator in the
 * gallery), and the hearing plays as roam beats driven by the mode's frozen
 * transcript and verdict. Loaded lazily: it carries three.js.
 *
 * Pace (scene/roam pace.ts): Standard by default (~60–75 s for a typical
 * hearing), Highlights, or Full; Fast-forward and Skip to the verdict sit in the
 * bar. Nothing skips the verdict beat itself.
 */
import { HEARING_PACES, type AvatarSpec, type HearingPace, type PerspectiveChoice, type PlayerRole, type RemotePlayerFeed, type SpawnId } from '@cringe-court/scene/roam';
import { RoamCourtroom, useRoamCourtroom } from '@cringe-court/scene/roam/react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Icon, Spinner } from '@/ds';
import { t } from '@/i18n';
import { appAudio } from '@/platform/audio';
import { readPerspective, writePerspective } from '@/roam/perspectivePref';
import { playBeats, type PlannedBeat } from './beats';
import { setHearingPace, useHearingPace } from './hearingPace';
import { roamStrings } from './roamStrings';
import styles from './Trial.module.css';
import { savedLook } from '@/play/profile';

export interface RoamTrialProps {
  beats: readonly PlannedBeat[];
  /** Accessible name of the room. */
  label: string;
  role?: PlayerRole;
  /** Where the player stands before the first beat seats them. Defaults to their role's seat. */
  spawn?: SpawnId;
  /** Jurors in this hearing, the player included (Solo and Versus 3, Grand Jury 7). Default 3. */
  jurors?: number;
  avatar?: AvatarSpec;
  remotes?: RemotePlayerFeed;
  /** Switch to the classic stage ("Skip to menu view"). */
  onExit: () => void;
  /** Called as each beat starts. */
  onBeat?: (index: number) => void;
  /** Called once every beat has played. */
  onDone?: () => void;
  /** Keep the room open but do not start the hearing yet (the jury is still arriving). */
  hold?: boolean;
  /** How many jurors are in the box so far. Default: all of them. */
  seated?: number;
  /** Stay in session after the hearing; `finale` then plays the vote and the verdict in the room. */
  stayInSession?: boolean;
  finale?: readonly PlannedBeat[] | null;
  onFinale?: () => void;
  /** No control bar, for a recording of the hearing. */
  chromeless?: boolean;
  /** Fill the screen; the page draws its HUD over the room. */
  bleed?: boolean;
}

/** Before the first beat seats you: at your table, in the jury box, or walking in from the aisle. */
const ROLE_SPAWN: Readonly<Record<PlayerRole, SpawnId>> = { defendant: 'defendant', 'side-a': 'prosecution', 'side-b': 'defendant', juror: 'jury-box', spectator: 'aisle' };

const PACE_KEYS = { standard: 'trial.roam.pace.standard', highlights: 'trial.roam.pace.highlights', full: 'trial.roam.pace.full' } as const;

/**
 * The room is rebuilt when the viewer's role or the jury size changes (taking a
 * Grand Jury seat turns a spectator into a juror): the controller seats by role
 * and fills the jury box when it is created.
 */
export function RoamTrial(props: RoamTrialProps) {
  return <RoamTrialRoom key={`${props.role ?? 'defendant'}:${props.jurors ?? 3}`} {...props} />;
}

function RoamTrialRoom({
  beats,
  label,
  role = 'defendant',
  spawn,
  jurors = 3,
  avatar = { model: 'defendant', name: t('trial.roam.you'), ...(savedLook() ? { look: savedLook()! } : {}) },
  remotes,
  onExit,
  onBeat,
  onDone,
  hold = false,
  seated,
  stayInSession = false,
  finale,
  onFinale,
  chromeless = false,
  bleed = false,
}: RoamTrialProps) {
  const pace = useHearingPace();
  const [perspective, setPerspective] = useState<PerspectiveChoice>(() => readPerspective());
  const roam = useRoamCourtroom({ audio: appAudio(), role, spawn: spawn ?? ROLE_SPAWN[role], avatar, jurors, pace, ...(remotes ? { remotes } : {}) });
  const [fast, setFast] = useState(false);
  const skipping = useRef(false);
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
  const cb = useRef({ onBeat, onDone, onFinale, stayInSession });
  useEffect(() => {
    cb.current = { onBeat, onDone, onFinale, stayInSession };
  });
  const controller = roam.status === 'ready' ? roam.controller : null;
  useEffect(() => controller?.setPace(pace), [controller, pace]);
  useEffect(() => controller?.setFastForward(fast), [controller, fast]);
  // Re-plan only when the transcript changes, not on every parent render.
  const plan = JSON.stringify(beats);

  useEffect(() => {
    if (seated !== undefined) controller?.setJurors(seated);
  }, [controller, seated]);

  useEffect(() => {
    if (!controller || !chromeless) return;
    (window as unknown as { __hearing?: unknown }).__hearing = controller;
  }, [controller, chromeless]);

  useEffect(() => {
    if (!controller || hold) return;
    const abort = new AbortController();
    const planned = JSON.parse(plan) as PlannedBeat[];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the finished flag when a new run starts
    setDone(false);
    controller.reconvene();
    void playBeats(controller, planned, abort.signal, (i) => {
      setCurrent(i);
      cb.current.onBeat?.(i);
    }).then((all) => {
      if (!all) return;
      if (!cb.current.stayInSession) controller.adjourn();
      setCurrent(null);
      setDone(true);
      cb.current.onDone?.();
    });
    return () => abort.abort();
  }, [controller, plan, run, hold]);

  const finalePlan = finale ? JSON.stringify(finale) : null;
  useEffect(() => {
    if (!controller || !finalePlan) return;
    const abort = new AbortController();
    void playBeats(controller, JSON.parse(finalePlan) as PlannedBeat[], abort.signal).then((all) => {
      if (all) cb.current.onFinale?.();
    });
    return () => abort.abort();
  }, [controller, finalePlan]);

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
  const hasVerdict = beats.some((b) => b.id === 'verdict');
  const inVerdict = beat?.id === 'verdict';
  const skipToVerdict = () => {
    skipping.current = true;
    roam.controller.skipBeat();
  };
  return (
    <div className={styles.roam} ref={box} data-bleed={bleed || undefined}>
      <RoamCourtroom
        controller={roam.controller}
        data={roam.data}
        onExit={onExit}
        label={label}
        strings={strings}
        className={styles.canvas}
        perspective={perspective}
        onPerspectiveChange={(p) => {
          writePerspective(p);
          setPerspective(p);
        }}
      />
      <div className={styles.roamBar} data-surface="wood" style={chromeless ? { display: 'none' } : undefined}>
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
          <label className={styles.pace}>
            <span>{t('trial.roam.pace.label')}</span>
            <select value={pace} onChange={(e) => setHearingPace(e.target.value as HearingPace)} title={t('trial.roam.pace.hint')}>
              {HEARING_PACES.map((p) => (
                <option key={p} value={p}>
                  {t(PACE_KEYS[p])}
                </option>
              ))}
            </select>
          </label>
          {beat && (
            <Button size="sm" variant="ghost" aria-pressed={fast} onClick={() => setFast((f) => !f)}>
              {t('trial.roam.fastForward')}
            </Button>
          )}
          {beat && !inVerdict && (
            <Button size="sm" variant="ghost" onClick={() => roam.controller.skipBeat()}>
              {t('trial.roam.skipBeat')}
            </Button>
          )}
          {beat && hasVerdict && !inVerdict && (
            <Button size="sm" variant="ghost" onClick={skipToVerdict}>
              {t('trial.roam.skipToVerdict')}
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

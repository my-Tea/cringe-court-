import { Courtroom, useCourtroom } from '@cringe-court/scene/react';
import { BASE_MODES } from '@cringe-court/core';
import { BEAT_IDS, MockRemotePlayers, QUALITY_LEVELS, type BeatId, type PlayerRole, type QualityLevel, type RoamController, type SpawnId, type VerdictKind } from '@cringe-court/scene/roam';
import { RoamCourtroom, useRoamCourtroom } from '@cringe-court/scene/roam/react';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { paths } from '@/app/routes';
import { Alert, Button, EmptyState, PaperButtonLink, Spinner, useReducedMotion } from '@/ds';
import { t, type MessageKey } from '@/i18n';
import { appAudio } from '@/platform/audio';
import { roamStrings } from '@/trial/roamStrings';
import { canRoam } from '@/trial/trialView';
import styles from './WalkPage.module.css';

const VERDICTS: ReadonlyArray<{ id: VerdictKind; label: MessageKey }> = [
  { id: 'guilty', label: 'trial.walk.verdict.guilty' },
  { id: 'not-cooked', label: 'trial.walk.verdict.notCooked' },
  { id: 'side-a', label: 'trial.walk.verdict.sideA' },
  { id: 'mistrial', label: 'trial.walk.verdict.mistrial' },
];

const PLACES: ReadonlyArray<{ id: SpawnId; label: MessageKey }> = [
  { id: 'lobby', label: 'trial.walk.jump.lobby' },
  { id: 'aisle', label: 'trial.walk.jump.aisle' },
  { id: 'well', label: 'trial.walk.jump.well' },
  { id: 'bench-front', label: 'trial.walk.jump.bench' },
  { id: 'jury-view', label: 'trial.walk.jump.juryBox' },
];

const QUALITY_LABELS: Readonly<Record<QualityLevel, MessageKey>> = {
  low: 'trial.hud.quality.low',
  medium: 'trial.hud.quality.medium',
  high: 'trial.hud.quality.high',
};

const SPAWNS = new Set<string>(['lobby', 'doorway', 'aisle', 'well', 'defendant', 'prosecution', 'witness', 'jury-box', 'jury-view', 'bench-front']);
const ROLES = new Set<string>(['defendant', 'side-a', 'side-b', 'juror', 'spectator']);

function initialParams() {
  const q = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const spawn = q.get('spawn');
  const quality = q.get('quality');
  return {
    spawn: (spawn && SPAWNS.has(spawn) ? spawn : 'lobby') as SpawnId,
    quality: (QUALITY_LEVELS as readonly string[]).includes(quality ?? '') ? (quality as QualityLevel) : 'medium',
    debug: q.has('debug'),
    touch: q.get('touch') === '1' ? true : ('auto' as const),
    auto: q.get('auto') !== '0',
    // Scripted checks: `?role=juror&jurors=7` seats you as one of seven jurors for the beats.
    role: (ROLES.has(q.get('role') ?? '') ? q.get('role') : 'defendant') as PlayerRole,
    jurors: Math.min(7, Math.max(0, Number(q.get('jurors') ?? 7) || 7)),
  };
}

/** The non-roam view (existing cutaway 3D courtroom) for "Skip to menu view". */
function MenuView({ onBack }: { onBack: () => void }) {
  const reduced = useReducedMotion();
  const court = useCourtroom({ reducedMotion: reduced });
  const back = useRef<HTMLButtonElement>(null);
  // Focus follows the view switch, so keyboard users land on the way back.
  useEffect(() => back.current?.focus(), []);
  useEffect(() => {
    if (court.state !== 'ready') return;
    court.port.setCast(BASE_MODES.solo.staging(BASE_MODES.solo.terms()));
    court.port.camera('pov_entrance', 0);
  }, [court]);
  return (
    <div className={styles.menuView}>
      {court.state === 'ready' ? <Courtroom runtime={court.runtime} className={styles.canvas} label={t('trial.walk.menuViewLabel')} /> : <Spinner label={t('trial.walk.loadingLabel')} />}
      <div className={styles.menuBar}>
        <Button ref={back} variant="primary" onClick={onBack}>
          {t('trial.walk.backToWalking')}
        </Button>
      </div>
    </div>
  );
}

class WalkBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error ? <CannotWalk details={this.state.error.message} /> : this.props.children;
  }
}

/** B7: no WebGL2 (or the 3D court failed): say so and point to where trials still play. */
function CannotWalk({ details }: { details?: string }) {
  return (
    <div className={styles.page}>
      <EmptyState
        title={t('trial.walk.noWebgl.title')}
        headingLevel={1}
        character="clerk"
        expression="shocked"
        actions={
          <>
            <PaperButtonLink to={paths.court}>{t('trial.walk.noWebgl.court')}</PaperButtonLink>
            <PaperButtonLink to={paths.howToPlay} variant="maroon">
              {t('trial.walk.noWebgl.howTo')}
            </PaperButtonLink>
          </>
        }
      >
        {t('trial.walk.noWebgl.body')}
        {details && <span className={styles.details}>{t('trial.walk.noWebgl.details', { details })}</span>}
      </EmptyState>
    </div>
  );
}

/**
 * /court/walk: the walkable courtroom sandbox. Needs WebGL2; without it (or if
 * the 3D court fails) the page explains and points to the classic stages,
 * instead of the route's crash page.
 */
export function WalkPage() {
  useDocumentTitle(t('trial.walk.title'));
  if (!canRoam()) return <CannotWalk />;
  return (
    <WalkBoundary>
      <WalkSandbox />
    </WalkBoundary>
  );
}

function WalkSandbox() {
  const params = useMemo(() => initialParams(), []);
  const audio = appAudio();
  const remotes = useMemo(() => new MockRemotePlayers(), []);
  const roam = useRoamCourtroom({ audio, remotes, spawn: params.spawn, role: params.role, jurors: params.jurors });
  const strings = roamStrings();
  const [view, setView] = useState<'roam' | 'menu'>('roam');
  const [quality, setQuality] = useState<QualityLevel>(params.quality);
  const [verdict, setVerdict] = useState<VerdictKind>('guilty');
  const [running, setRunning] = useState<BeatId | null>(null);
  const [renderer, setRenderer] = useState<unknown>(null);

  useEffect(() => {
    const unlock = () => void audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audio]);

  const controller: RoamController | null = roam.controller;
  useEffect(() => {
    if (!controller) return;
    return controller.subscribe((e) => {
      if (e.type === 'beat-start') setRunning(e.beat);
      if (e.type === 'beat-end') setRunning(null);
    });
  }, [controller]);

  // `?debug` exposes the controller for scripted browser checks (window.__roam).
  useEffect(() => {
    if (params.debug && roam.status === 'ready') (window as unknown as { __roam?: unknown }).__roam = { controller: roam.controller, data: roam.data, renderer };
  }, [params.debug, roam, renderer]);

  const beat = (id: BeatId) => {
    if (!controller) return;
    void controller.runBeat(id, id === 'verdict' ? { verdict } : {});
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t('trial.walk.eyebrow')}</p>
        <h1 className={styles.title}>{t('trial.walk.title')}</h1>
        <p className={styles.lede}>{t('trial.walk.lede')}</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.stage} aria-label={t('trial.walk.stage')}>
          {view === 'menu' ? (
            <MenuView onBack={() => setView('roam')} />
          ) : roam.status === 'ready' ? (
            <RoamCourtroom controller={roam.controller} data={roam.data} quality={quality} onQualityChange={setQuality} autoQuality={params.auto} strings={strings} touch={params.touch} onExit={() => setView('menu')} onRenderer={params.debug ? setRenderer : undefined} />
          ) : roam.status === 'error' ? (
            <Alert tone="danger" title={t('trial.walk.error')}>
              {roam.error.message}
            </Alert>
          ) : (
            <div className={styles.loading}>
              <Spinner label={t('trial.walk.buildingLabel')} />
              <span>{t('trial.walk.building')}</span>
            </div>
          )}
        </section>

        <aside className={styles.panel} aria-label={t('trial.walk.controls')}>
          <div className={styles.group}>
            <h2 className={styles.groupTitle}>{t('trial.walk.beats.title')}</h2>
            <p className={styles.hint}>{t('trial.walk.beats.hint')}</p>
            <div className={styles.beats}>
              {BEAT_IDS.map((id, i) => (
                <Button key={id} variant={running === id ? 'primary' : 'secondary'} size="sm" disabled={!controller || view !== 'roam'} onClick={() => beat(id)} aria-pressed={running === id}>
                  {t('trial.walk.beats.item', { number: i + 1, label: strings.beatLabels[id] })}
                </Button>
              ))}
            </div>
            <label className={styles.field}>
              <span>{t('trial.walk.verdict')}</span>
              <select value={verdict} onChange={(e) => setVerdict(e.target.value as VerdictKind)}>
                {VERDICTS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {t(v.label)}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="ghost" size="sm" disabled={!running} onClick={() => controller?.skipBeat()}>
              {t('trial.walk.skipCurrent')}
            </Button>
          </div>

          <div className={styles.group}>
            <h2 className={styles.groupTitle}>{t('trial.walk.jump.title')}</h2>
            <div className={styles.places}>
              {PLACES.map((p) => (
                <Button key={p.id} variant="ghost" size="sm" disabled={!controller || view !== 'roam'} onClick={() => controller?.teleport(p.id)}>
                  {t(p.label)}
                </Button>
              ))}
              <Button variant="ghost" size="sm" disabled={!controller || view !== 'roam'} onClick={() => controller?.sit('witness')}>
                {t('trial.walk.jump.witness')}
              </Button>
              <Button variant="ghost" size="sm" disabled={!controller || view !== 'roam'} onClick={() => controller?.sit('defendant')}>
                {t('trial.walk.jump.defendant')}
              </Button>
            </div>
          </div>

          <div className={styles.group}>
            <h2 className={styles.groupTitle}>{t('trial.walk.graphics.title')}</h2>
            <label className={styles.field}>
              <span>{t('trial.walk.graphics.quality')}</span>
              <select value={quality} onChange={(e) => setQuality(e.target.value as QualityLevel)}>
                {QUALITY_LEVELS.map((q) => (
                  <option key={q} value={q}>
                    {t(QUALITY_LABELS[q])}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.hint}>{t('trial.walk.graphics.hint')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

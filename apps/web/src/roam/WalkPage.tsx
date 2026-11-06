import { createAudioEngine } from '@cringe-court/audio';
import { Courtroom, useCourtroom } from '@cringe-court/scene/react';
import { BASE_MODES } from '@cringe-court/core';
import { BEAT_IDS, MockRemotePlayers, QUALITY_LEVELS, type BeatId, type QualityLevel, type RoamController, type SpawnId, type VerdictKind } from '@cringe-court/scene/roam';
import { BEAT_LABELS, RoamCourtroom, useRoamCourtroom } from '@cringe-court/scene/roam/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, Button, Spinner, useReducedMotion } from '@/ds';
import styles from './WalkPage.module.css';

const VERDICTS: ReadonlyArray<{ id: VerdictKind; label: string }> = [
  { id: 'guilty', label: 'Guilty' },
  { id: 'not-cooked', label: 'Not cooked' },
  { id: 'side-a', label: 'Side A wins' },
  { id: 'mistrial', label: 'Mistrial' },
];

const PLACES: ReadonlyArray<{ id: SpawnId; label: string }> = [
  { id: 'lobby', label: 'Lobby' },
  { id: 'aisle', label: 'Aisle' },
  { id: 'well', label: 'Well' },
  { id: 'bench-front', label: 'Bench' },
  { id: 'jury-view', label: 'Jury box' },
];

const SPAWNS = new Set<string>(['lobby', 'doorway', 'aisle', 'well', 'defendant', 'witness', 'jury-view', 'bench-front']);

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
      {court.state === 'ready' ? <Courtroom runtime={court.runtime} className={styles.canvas} label="The courtroom from the entrance (menu view)." /> : <Spinner label="Loading the courtroom" />}
      <div className={styles.menuBar}>
        <Button ref={back} variant="primary" onClick={onBack}>
          Back to walking
        </Button>
      </div>
    </div>
  );
}

export function WalkPage() {
  useDocumentTitle('Walk the court');
  const params = useMemo(() => initialParams(), []);
  const audio = useMemo(() => createAudioEngine(), []);
  const remotes = useMemo(() => new MockRemotePlayers(), []);
  const roam = useRoamCourtroom({ audio, remotes, spawn: params.spawn });
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
        <p className={styles.eyebrow}>Sandbox · first person</p>
        <h1 className={styles.title}>Walk the court</h1>
        <p className={styles.lede}>Roam the voxel courtroom as the defendant: start in the lobby, take the stand, inspect the exhibits, then run the trial beats and watch the jury react.</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.stage} aria-label="Courtroom">
          {view === 'menu' ? (
            <MenuView onBack={() => setView('roam')} />
          ) : roam.status === 'ready' ? (
            <RoamCourtroom controller={roam.controller} data={roam.data} quality={quality} onQualityChange={setQuality} autoQuality={params.auto} touch={params.touch} onExit={() => setView('menu')} onRenderer={params.debug ? setRenderer : undefined} />
          ) : roam.status === 'error' ? (
            <Alert tone="danger" title="The courtroom could not load">
              {roam.error.message}
            </Alert>
          ) : (
            <div className={styles.loading}>
              <Spinner label="Building the courtroom" />
              <span>Building the courtroom…</span>
            </div>
          )}
        </section>

        <aside className={styles.panel} aria-label="Sandbox controls">
          <div className={styles.group}>
            <h2 className={styles.groupTitle}>Trial beats</h2>
            <p className={styles.hint}>Each beat seats you at the defendant&apos;s table and takes the camera while someone speaks.</p>
            <div className={styles.beats}>
              {BEAT_IDS.map((id, i) => (
                <Button key={id} variant={running === id ? 'primary' : 'secondary'} size="sm" disabled={!controller || view !== 'roam'} onClick={() => beat(id)} aria-pressed={running === id}>
                  {i + 1}. {BEAT_LABELS[id]}
                </Button>
              ))}
            </div>
            <label className={styles.field}>
              <span>Verdict</span>
              <select value={verdict} onChange={(e) => setVerdict(e.target.value as VerdictKind)}>
                {VERDICTS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="ghost" size="sm" disabled={!running} onClick={() => controller?.skipBeat()}>
              Skip current beat
            </Button>
          </div>

          <div className={styles.group}>
            <h2 className={styles.groupTitle}>Jump to</h2>
            <div className={styles.places}>
              {PLACES.map((p) => (
                <Button key={p.id} variant="ghost" size="sm" disabled={!controller || view !== 'roam'} onClick={() => controller?.teleport(p.id)}>
                  {p.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" disabled={!controller || view !== 'roam'} onClick={() => controller?.sit('witness')}>
                Witness stand
              </Button>
              <Button variant="ghost" size="sm" disabled={!controller || view !== 'roam'} onClick={() => controller?.sit('defendant')}>
                Defendant&apos;s table
              </Button>
            </div>
          </div>

          <div className={styles.group}>
            <h2 className={styles.groupTitle}>Graphics</h2>
            <label className={styles.field}>
              <span>Quality</span>
              <select value={quality} onChange={(e) => setQuality(e.target.value as QualityLevel)}>
                {QUALITY_LEVELS.map((q) => (
                  <option key={q} value={q}>
                    {q[0]!.toUpperCase() + q.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.hint}>Drops a level by itself if the frame rate sags. Three remote visitors are mocked (no network) to show how Versus and Grand Jury players will appear.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * `/play` — the arrival run. Instead of a sign-in form, a World ID step and a
 * mode picker, the player walks it: the Shrine of Identity (World ID), the
 * wardrobe (their look, live on their own body), the Hall of Trials (Solo,
 * Versus, Grand Jury), then over the last bridge, up the courthouse steps and
 * through the doors into the chosen court. Each stop lifts the seal on the
 * next bridge; progress is remembered on this device.
 */
import type { ModeId } from '@cringe-court/core';
import { type PerspectiveChoice, type PlayerLook, type RoamController, type StationId } from '@cringe-court/scene/roam';
import { RoamCourtroom, useRoamCourtroom, useRoamSnapshot } from '@cringe-court/scene/roam/react';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, EmptyState, PaperButtonLink, Spinner, useToast } from '@/ds';
import { t } from '@/i18n';
import { appAudio } from '@/platform/audio';
import { platformConfig } from '@/platform/config';
import { identityFor } from '@/platform/identity';
import { readPerspective, writePerspective } from '@/roam/perspectivePref';
import { roamStrings } from '@/trial/roamStrings';
import { canRoam } from '@/trial/trialView';
import { MODE_KEYS } from './keys';
import { QuestTracker, TrialPanel, VerifyPanel, WardrobePanel } from './panels';
import { currentStep, openGatesFor, readProfile, writeProfile, type PlayerProfile } from './profile';
import styles from './PlayPage.module.css';

export function PlayPage() {
  useDocumentTitle(t('play.title'));
  if (!canRoam()) {
    return (
      <div className={styles.fallback}>
        <EmptyState title={t('play.title')} actions={<PaperButtonLink to={paths.court}>{t('play.noWebgl.cta')}</PaperButtonLink>}>
          {t('play.noWebgl')}
        </EmptyState>
      </div>
    );
  }
  return (
    <PlayBoundary>
      <PlayRun />
    </PlayBoundary>
  );
}

function modeOf(station: StationId | null): ModeId | null {
  return station?.startsWith('mode:') ? (station.slice(5) as ModeId) : null;
}

function PlayRun() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const audio = appAudio();
  const debug = useMemo(() => new URLSearchParams(window.location.search).has('debug'), []);
  // The world is built once, from the profile as it was on arrival.
  const [start] = useState<PlayerProfile>(readProfile);
  const [profile, setProfile] = useState<PlayerProfile>(start);
  const roam = useRoamCourtroom({
    audio,
    spawn: 'arrival',
    openGates: openGatesFor(start),
    avatar: { model: 'creator', name: t('trial.roam.you'), look: start.look },
  });
  const [perspective, setPerspective] = useState<PerspectiveChoice>(() => readPerspective());
  const strings = roamStrings();

  const save = useCallback((next: PlayerProfile) => {
    writeProfile(next);
    setProfile(next);
  }, []);
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

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
  const [station, setStation] = useState<StationId | null>(null);

  // The doors: with a trial chosen, walking in opens that court.
  useEffect(() => {
    if (!controller) return;
    return controller.subscribe((e) => {
      if (e.type === 'station') setStation(e.station);
      if (e.type === 'interact' && e.id === 'return-inside') {
        const mode = profileRef.current.mode;
        if (!mode) return;
        toast({ tone: 'success', title: t('play.enter.toast', { mode: t(MODE_KEYS[mode]) }) });
        navigate(paths.mode(mode));
      }
    });
  }, [controller, navigate, toast]);

  useEffect(() => {
    if (debug && controller) (window as unknown as { __roam?: unknown }).__roam = { controller, data: roam.data };
  }, [debug, controller, roam.data]);

  return (
    <main className={styles.page} aria-label={t('play.stage')}>
      {roam.status === 'ready' ? (
        <RoamCourtroom
          controller={roam.controller}
          data={roam.data}
          quality="medium"
          perspective={perspective}
          onPerspectiveChange={(p) => {
            writePerspective(p);
            setPerspective(p);
          }}
          strings={strings}
          className={styles.room}
          onExit={() => navigate(paths.court)}
        >
          <RunOverlay controller={roam.controller} profile={profile} save={save} station={station} />
        </RoamCourtroom>
      ) : roam.status === 'error' ? (
        <div className={styles.fallback}>
          <Alert tone="danger" title={t('play.error')}>
            {roam.error.message}
          </Alert>
        </div>
      ) : (
        <div className={styles.loading}>
          <Spinner label={t('play.buildingLabel')} />
          <span>{t('play.building')}</span>
        </div>
      )}
    </main>
  );
}

function RunOverlay({ controller, profile, save, station }: { controller: RoamController; profile: PlayerProfile; save: (p: PlayerProfile) => void; station: StationId | null }) {
  const snap = useRoamSnapshot(controller);
  const { toast } = useToast();
  const identity = useMemo(() => identityFor(platformConfig, 'player'), []);
  const mock = identity.id === 'mock';

  const setLook = useCallback(
    (look: PlayerLook) => controller.setAvatar({ ...controller.avatar, look }),
    [controller],
  );

  /** Save progress and lift every seal it has earned. */
  const commit = (next: PlayerProfile) => {
    save(next);
    for (const g of openGatesFor(next)) controller.openGate(g);
    controller.closePanel();
  };

  const verify = async () => {
    const request = { action: 'case-party' as const, signal: 'cringecourt:arrival', minLevel: 'device' as const };
    const proof = await identity.requestProof(request);
    if (!proof.ok) {
      if (proof.reason !== 'cancelled') toast({ tone: 'danger', title: t('play.verify.failed', { message: proof.message }) });
      return;
    }
    const screened = await identity.verify(proof.proof, request);
    if (!screened.ok) {
      toast({ tone: 'danger', title: t('play.verify.failed', { message: screened.message }) });
      return;
    }
    commit({ ...profile, verified: { nullifier: screened.nullifier, at: Date.now() } });
    toast({ tone: 'success', title: t('play.verify.ok.title'), description: t('play.verify.ok.body') });
  };

  const confirmLook = () => {
    const look = controller.avatar.look ?? profile.look;
    commit({ ...profile, look, dressed: true });
    toast({ tone: 'success', title: t('play.wardrobe.ok.title'), description: t('play.wardrobe.ok.body') });
  };

  const cancelLook = () => {
    setLook(profile.look);
    controller.closePanel();
  };

  const chooseMode = (mode: ModeId) => {
    commit({ ...profile, mode });
    const name = t(MODE_KEYS[mode]);
    toast({ tone: 'success', title: t('play.trial.ok.title', { mode: name }), description: t('play.trial.ok.body') });
  };

  const step = currentStep(profile);
  const mode = modeOf(station);
  const showQuest = !snap.panel && !snap.paused && snap.control !== 'cinematic';

  return (
    <>
      {showQuest ? <QuestTracker step={step} onSkip={step === 'enter' && snap.zone !== 'outside' ? () => controller.teleport('outside') : null} /> : null}
      {snap.panel === 'verify' ? <VerifyPanel mock={mock} done={!!profile.verified} onVerify={verify} onClose={() => controller.closePanel()} /> : null}
      {snap.panel === 'wardrobe' ? <WardrobePanel look={controller.avatar.look ?? profile.look} onChange={setLook} onConfirm={confirmLook} onCancel={cancelLook} /> : null}
      {snap.panel === 'trials' && mode ? <TrialPanel mode={mode} chosen={profile.mode} onChoose={() => chooseMode(mode)} onClose={() => controller.closePanel()} /> : null}
    </>
  );
}

class PlayBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={styles.fallback}>
        <EmptyState title={t('play.error')} actions={<PaperButtonLink to={paths.court}>{t('play.noWebgl.cta')}</PaperButtonLink>}>
          {t('play.noWebgl')}
        </EmptyState>
      </div>
    );
  }
}

import type { ModeId } from '@cringe-court/core';
import type { PerspectiveChoice, PlayerLook, RoamController, StationId } from '@cringe-court/scene/roam';
import { RoamCourtroom, useRoamCourtroom, useRoamSnapshot } from '@cringe-court/scene/roam/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cx, Spinner, useToast } from '@/ds';
import { t } from '@/i18n';
import { appAudio } from '@/platform/audio';
import { platformConfig } from '@/platform/config';
import { identityFor } from '@/platform/identity';
import { MODE_KEYS } from '@/play/keys';
import { QuestTracker, TrialPanel, VerifyPanel, WardrobePanel } from '@/play/panels';
import { currentStep, openGatesFor, type PlayerProfile } from '@/play/profile';
import { readPerspective, writePerspective } from '@/roam/perspectivePref';
import { roamStrings } from '@/trial/roamStrings';
import { GameMenuItems } from './GameMenu';
import { courtStart, useGame, type GameView } from './state';
import styles from './Game.module.css';

/**
 * The one world: built once per run, never unmounted while the game is open.
 * The title screen watches it orbit, the menu freezes it, a hearing hides it.
 */
export function GameWorld({ view }: { view: GameView }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const audio = appAudio();
  const { profile } = useGame();
  const [start] = useState<PlayerProfile>(profile);
  const roam = useRoamCourtroom({
    audio,
    // A returning player who has finished the run starts on the courthouse terrace.
    spawn: currentStep(start) === 'enter' ? 'outside' : 'arrival',
    openGates: openGatesFor(start),
    avatar: { model: 'creator', name: t('trial.roam.you'), look: start.look },
  });
  const [perspective, setPerspective] = useState<PerspectiveChoice>(() => readPerspective());
  const strings = useMemo(() => ({ ...roamStrings(), pause: t('game.menu.open'), pauseTitle: t('game.menu.title') }), []);
  const debug = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'), []);
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

  useEffect(() => {
    if (!controller) return;
    // No hearing runs in the open world: the street doors work both ways.
    controller.adjourn();
    return controller.subscribe((e) => {
      if (e.type === 'station') setStation(e.station);
      // Walking in with a trial chosen opens that court at its first step, over the lobby.
      if (e.type === 'interact' && e.id === 'return-inside') {
        const mode = profileRef.current.mode;
        if (!mode) return;
        toast({ tone: 'success', title: t('game.world.enter', { mode: t(MODE_KEYS[mode]) }) });
        navigate(courtStart(mode));
      }
    });
  }, [controller, navigate, toast]);

  // Leaving the world (title, a panel, a hearing) closes the in-world pause menu.
  useEffect(() => {
    if (controller && view !== 'world') controller.setPaused(false);
  }, [controller, view]);

  useEffect(() => {
    if (debug && controller) (window as unknown as { __roam?: unknown }).__roam = { controller, data: roam.data };
  }, [debug, controller, roam.data]);

  const presentation = view === 'title' ? 'attract' : view === 'world' ? 'play' : 'suspended';
  return (
    <div className={cx(styles.backdrop, view === 'panel' && styles.dimmed, view === 'scene' && styles.hidden)}>
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
          presentation={presentation}
          pauseLobby={false}
          pauseExtra={<GameMenuItems compact onNavigate={() => roam.controller.setPaused(false)} />}
        >
          {view === 'world' ? <RunOverlay controller={roam.controller} station={station} /> : null}
        </RoamCourtroom>
      ) : roam.status === 'error' ? (
        <div className={cx(styles.backdrop, styles.paper)} role="status">
          <p className={styles.worldNote}>{t('game.world.error')}</p>
        </div>
      ) : view === 'world' ? (
        <div className={styles.loading}>
          <Spinner label={t('game.world.loadingLabel')} />
          <span>{t('game.world.loading')}</span>
        </div>
      ) : null}
    </div>
  );
}

/** The arrival run's stations and quest tracker, drawn over the world while it is played. */
function RunOverlay({ controller, station }: { controller: RoamController; station: StationId | null }) {
  const snap = useRoamSnapshot(controller);
  const { toast } = useToast();
  const { profile, save } = useGame();
  const identity = useMemo(() => identityFor(platformConfig, 'player'), []);
  const mock = identity.id === 'mock';

  const setLook = useCallback((look: PlayerLook) => controller.setAvatar({ ...controller.avatar, look }), [controller]);

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
    commit({ ...profile, look: controller.avatar.look ?? profile.look, dressed: true });
    toast({ tone: 'success', title: t('play.wardrobe.ok.title'), description: t('play.wardrobe.ok.body') });
  };

  const cancelLook = () => {
    setLook(profile.look);
    controller.closePanel();
  };

  const chooseMode = (mode: ModeId) => {
    commit({ ...profile, mode });
    toast({ tone: 'success', title: t('play.trial.ok.title', { mode: t(MODE_KEYS[mode]) }), description: t('play.trial.ok.body') });
  };

  const step = currentStep(profile);
  const mode = station?.startsWith('mode:') ? (station.slice(5) as ModeId) : null;
  // The tracker belongs to the run outdoors; inside the courthouse it would only be noise.
  const outdoors = snap.zone === 'arrival' || snap.zone === 'wardrobe' || snap.zone === 'trials' || snap.zone === 'outside';
  const showQuest = outdoors && !snap.panel && !snap.paused && snap.control !== 'cinematic';

  return (
    <>
      {showQuest ? <QuestTracker step={step} onSkip={step === 'enter' && snap.zone !== 'outside' ? () => controller.teleport('outside') : null} /> : null}
      {snap.panel === 'verify' ? <VerifyPanel mock={mock} done={!!profile.verified} onVerify={verify} onClose={() => controller.closePanel()} /> : null}
      {snap.panel === 'wardrobe' ? <WardrobePanel look={controller.avatar.look ?? profile.look} onChange={setLook} onConfirm={confirmLook} onCancel={cancelLook} /> : null}
      {snap.panel === 'trials' && mode ? <TrialPanel mode={mode} chosen={profile.mode} onChoose={() => chooseMode(mode)} onClose={() => controller.closePanel()} /> : null}
    </>
  );
}

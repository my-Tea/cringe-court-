/**
 * The game shell: one persistent world for the whole session, with every
 * screen drawn over it, the way a console game works. There is no website
 * chrome here.
 *
 *   /            title screen; the world orbits slowly behind it
 *   /play        the world itself (arrival run, courthouse, lobby)
 *   /menu …      the game menu and its screens (leaderboard, settings, …),
 *                and every case-filing step, as panels over the paused world
 *   …/case/:id   a hearing: full screen, the world suspended behind it
 *
 * Routes, providers and rules of each mode are unchanged; only where they
 * render moved. Without WebGL2 the world is replaced by a paper backdrop and
 * everything still works from the menus.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { cx } from '@/ds';
import { t } from '@/i18n';
import { canRoam } from '@/trial/trialView';
import { readProfile, writeProfile, type PlayerProfile } from '@/play/profile';
import { GameFrame } from './GameFrame';
import { GameContext, viewFor } from './state';
import styles from './Game.module.css';

// The world pulls in three.js: its own chunk, so the title menu is up before the islands are.
const GameWorld = lazy(async () => ({ default: (await import('./GameWorld')).GameWorld }));

export function GameShell() {
  const { pathname } = useLocation();
  const view = viewFor(pathname);
  const [profile, setProfile] = useState<PlayerProfile>(readProfile);
  // A new game rebuilds the world (seals closed, spawn on the arrival island).
  const [run, setRun] = useState(0);
  const save = useCallback((next: PlayerProfile) => {
    writeProfile(next);
    setProfile(next);
  }, []);
  const reset = useCallback(() => {
    const { verified } = readProfile();
    try {
      window.localStorage.removeItem('cc:player');
    } catch {
      /* private mode */
    }
    // A new game is a new run, not a new person: World would refuse to verify them twice.
    const fresh = { ...readProfile(), verified };
    writeProfile(fresh);
    setProfile(fresh);
    setRun((n) => n + 1);
  }, []);
  const state = useMemo(() => ({ profile, save, reset }), [profile, save, reset]);
  const webgl = useMemo(() => canRoam(), []);

  return (
    <GameContext.Provider value={state}>
      <div className={styles.game} data-view={view}>
        {webgl ? (
          <Suspense fallback={<div className={cx(styles.backdrop, styles.paper)} aria-hidden />}>
            <GameWorld key={run} view={view} />
          </Suspense>
        ) : (
          <div className={cx(styles.backdrop, styles.paper)} aria-hidden />
        )}
        {view === 'panel' || view === 'scene' ? (
          <GameFrame view={view}>
            <Outlet />
          </GameFrame>
        ) : (
          <Outlet />
        )}
        {!webgl && view === 'world' ? <NoWorld /> : null}
      </div>
    </GameContext.Provider>
  );
}

/** Without WebGL2 there is no world to walk: send the player to the menu instead of a blank screen. */
function NoWorld(): ReactNode {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/menu', { replace: true });
  }, [navigate]);
  return <p className="cc-visually-hidden">{t('game.world.noWebgl')}</p>;
}

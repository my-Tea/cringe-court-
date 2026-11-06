import type { ModeId } from '@cringe-court/core';
import { createContext, useContext } from 'react';
import { paths } from '@/app/routes';
import type { IconName } from '@/ds';
import type { MessageKey } from '@/i18n';
import { webModes } from '@/modes/registry';
import type { PlayerProfile } from '@/play/profile';

/** What a path shows: the title, the walkable world, a panel over it, or a full-screen hearing. */
export type GameView = 'title' | 'world' | 'panel' | 'scene';

const HEARING = /^\/(solo|versus|grand-jury)\/case\/[^/]+/;

export function viewFor(pathname: string): GameView {
  if (pathname === '/' || pathname === '') return 'title';
  if (pathname === '/play') return 'world';
  if (HEARING.test(pathname)) return 'scene';
  return 'panel';
}

export interface GameState {
  profile: PlayerProfile;
  save: (next: PlayerProfile) => void;
  /** Start over: a freshly rolled look and no trial chosen. World ID verification stays. */
  reset: () => void;
}

export const GameContext = createContext<GameState | null>(null);

export function useGame(): GameState {
  const g = useContext(GameContext);
  if (!g) throw new Error('useGame outside the game shell');
  return g;
}

/** Where a chosen court starts: its own first step (filing, a new Versus case, the docket). */
export function courtStart(mode: ModeId): string {
  return webModes.get(mode)?.landing?.to ?? paths.mode(mode);
}

/** The game menu's screens, in menu order. Each is a route drawn as a panel over the paused world. */
export const MENU_SCREENS: ReadonlyArray<{ to: string; label: MessageKey; icon: IconName }> = [
  { to: paths.leaderboard, label: 'game.menu.leaderboard', icon: 'trophy' },
  { to: paths.cases, label: 'game.menu.cases', icon: 'document' },
  { to: paths.court, label: 'game.menu.courts', icon: 'scales' },
  { to: paths.howToPlay, label: 'game.menu.howToPlay', icon: 'book' },
  { to: paths.settings, label: 'game.menu.settings', icon: 'gear' },
];

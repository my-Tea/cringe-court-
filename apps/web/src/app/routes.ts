import type { ModeId } from '@cringe-court/core';
import type { MessageKey } from '@/i18n';

/** Every path in the app, so links never drift from the router. */
export const paths = {
  /** The landing: sign-in panel and the courtroom hero. */
  home: '/',
  /** The arrival run: verify, dress, pick a trial, walk into the courthouse. */
  play: '/play',
  /** The courts lobby: pick Solo, Versus or Grand Jury. */
  court: '/court',
  leaderboard: '/leaderboard',
  howToPlay: '/how-to-play',
  settings: '/settings',
  mode: (id: ModeId) => `/${id}`,
  courtroom: '/courtroom',
  walk: '/court/walk',
  town: '/town',
  gallery: '/gallery',
} as const;

/** Paths that live under "The court" tab (the lobby and every courtroom). */
export const isCourtPath = (pathname: string) =>
  pathname === paths.court || pathname === paths.play || ['/solo', '/versus', '/grand-jury', paths.courtroom, paths.walk, paths.town].some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** The reference's four paper tabs. */
export const NAV_ITEMS: ReadonlyArray<{ to: string; labelKey: MessageKey; icon: 'home' | 'scales' | 'trophy' | 'book'; activeFor?: (pathname: string) => boolean }> = [
  { to: paths.home, labelKey: 'shell.nav.home', icon: 'home' },
  { to: paths.court, labelKey: 'shell.nav.court', icon: 'scales', activeFor: isCourtPath },
  { to: paths.leaderboard, labelKey: 'shell.nav.leaderboard', icon: 'trophy' },
  { to: paths.howToPlay, labelKey: 'shell.nav.howToPlay', icon: 'book' },
];

/** The three courts, for the lobby, menus and the footer. */
export const COURT_LINKS: ReadonlyArray<{ to: string; labelKey: MessageKey }> = [
  { to: paths.mode('solo'), labelKey: 'shell.nav.courts.solo' },
  { to: paths.mode('versus'), labelKey: 'shell.nav.courts.versus' },
  { to: paths.mode('grand-jury'), labelKey: 'shell.nav.courts.grandJury' },
  { to: paths.courtroom, labelKey: 'shell.nav.courts.demo' },
  { to: paths.walk, labelKey: 'shell.nav.courts.walk' },
  { to: paths.town, labelKey: 'shell.nav.courts.town' },
];

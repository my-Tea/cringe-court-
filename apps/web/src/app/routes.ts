import type { ModeId } from '@cringe-court/core';

/** Every path in the app, so links never drift from the router. */
export const paths = {
  /** The landing: sign-in panel and the courtroom hero. */
  home: '/',
  /** The courts lobby: pick Solo, Versus or Grand Jury. */
  court: '/court',
  leaderboard: '/leaderboard',
  howToPlay: '/how-to-play',
  settings: '/settings',
  mode: (id: ModeId) => `/${id}`,
  courtroom: '/courtroom',
  walk: '/court/walk',
  gallery: '/gallery',
} as const;

/** Paths that live under "The court" tab (the lobby and every courtroom). */
export const isCourtPath = (pathname: string) =>
  pathname === paths.court || ['/solo', '/versus', '/grand-jury', paths.courtroom, paths.walk].some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** The reference's four paper tabs. */
export const NAV_ITEMS: ReadonlyArray<{ to: string; label: string; icon: 'home' | 'scales' | 'trophy' | 'book'; activeFor?: (pathname: string) => boolean }> = [
  { to: paths.home, label: 'Home', icon: 'home' },
  { to: paths.court, label: 'The court', icon: 'scales', activeFor: isCourtPath },
  { to: paths.leaderboard, label: 'Leaderboard', icon: 'trophy' },
  { to: paths.howToPlay, label: 'How to play', icon: 'book' },
];

/** The three courts, for the lobby, menus and the footer. */
export const COURT_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: paths.mode('solo'), label: 'Solo' },
  { to: paths.mode('versus'), label: 'Versus' },
  { to: paths.mode('grand-jury'), label: 'Grand Jury' },
  { to: paths.courtroom, label: 'Demo court' },
  { to: paths.walk, label: 'Walk the court' },
];

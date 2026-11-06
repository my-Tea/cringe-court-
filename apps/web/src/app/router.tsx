import { createBrowserRouter, type RouteObject } from 'react-router';
import { LoadingState } from '@/ds';
import { CasesScreen } from '@/game/CasesScreen';
import { MenuScreen } from '@/game/GameMenu';
import { GameShell } from '@/game/GameShell';
import { TitleScreen } from '@/game/TitleScreen';
import { HomePage } from '@/pages/HomePage';
import { HowToPlayPage } from '@/pages/HowToPlayPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { ModePage } from '@/pages/ModePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { modeChildRoutes } from '@/modes/registry';
import { RouteError } from './RouteError';
import { AppShell } from './shell/AppShell';

export const routes: RouteObject[] = [
  {
    // The game: one persistent world, every player-facing screen drawn over it (no site chrome).
    element: <GameShell />,
    errorElement: <RouteError />,
    // A deep link to a lazy page (/solo/case/…) loads its chunk before the first render.
    hydrateFallbackElement: <LoadingState />,
    children: [
      { index: true, element: <TitleScreen /> },
      // The world itself: nothing is drawn over it.
      { path: 'play', element: null },
      { path: 'menu', element: <MenuScreen /> },
      { path: 'cases', element: <CasesScreen /> },
      { path: 'court', element: <HomePage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'how-to-play', element: <HowToPlayPage /> },
      // Settings probes the ledger (viem) and identity adapters: its own chunk.
      { path: 'settings', lazy: async () => ({ Component: (await import('@/pages/settings/SettingsPage')).SettingsPage }) },
      { path: 'solo', children: [{ index: true, element: <ModePage id="solo" /> }, ...modeChildRoutes('solo')] },
      { path: 'versus', children: [{ index: true, element: <ModePage id="versus" /> }, ...modeChildRoutes('versus')] },
      { path: 'grand-jury', children: [{ index: true, element: <ModePage id="grand-jury" /> }, ...modeChildRoutes('grand-jury')] },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Developer sandboxes keep the site shell: they are tools, not part of the game.
    element: <AppShell />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingState />,
    children: [
      // The demo court pulls in three.js: its own chunk, loaded only on this route.
      { path: 'courtroom', lazy: async () => ({ Component: (await import('@/stage/DemoCourtPage')).DemoCourtPage }) },
      // First-person roaming courtroom sandbox (three.js, own chunk).
      { path: 'court/walk', lazy: async () => ({ Component: (await import('@/roam/WalkPage')).WalkPage }) },
      // Explorable isometric town (three.js, own chunk).
      { path: 'town', lazy: async () => ({ Component: (await import('@/town/TownPage')).TownPage }) },
      // The gallery is a developer tool: split out so it never weighs on real pages.
      { path: 'gallery', lazy: async () => ({ Component: (await import('@/gallery/GalleryPage')).GalleryPage }) },
    ],
  },
];

export const router = createBrowserRouter(routes);

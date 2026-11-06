import { createBrowserRouter, type RouteObject } from 'react-router';
import { LoadingState } from '@/ds';
import { HomePage } from '@/pages/HomePage';
import { HowToPlayPage } from '@/pages/HowToPlayPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { LandingPage } from '@/landing/LandingPage';
import { ModePage } from '@/pages/ModePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { modeChildRoutes } from '@/modes/registry';
import { RouteError } from './RouteError';
import { AppShell } from './shell/AppShell';

export const routes: RouteObject[] = [
  // The landing has its own layout: the sign-in panel and the courtroom hero.
  { index: true, element: <LandingPage />, errorElement: <RouteError /> },
  // The arrival run is full-bleed (no shell): walk through verification, the wardrobe and the trial gates (three.js, own chunk).
  { path: 'play', lazy: async () => ({ Component: (await import('@/play/PlayPage')).PlayPage }), errorElement: <RouteError />, hydrateFallbackElement: <LoadingState /> },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    // A deep link to a lazy page (/solo/case/…, /court/walk) loads its chunk before the first render.
    hydrateFallbackElement: <LoadingState />,
    children: [
      { path: 'court', element: <HomePage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'how-to-play', element: <HowToPlayPage /> },
      // Settings probes the ledger (viem) and identity adapters: its own chunk.
      { path: 'settings', lazy: async () => ({ Component: (await import('@/pages/settings/SettingsPage')).SettingsPage }) },
      { path: 'solo', children: [{ index: true, element: <ModePage id="solo" /> }, ...modeChildRoutes('solo')] },
      { path: 'versus', children: [{ index: true, element: <ModePage id="versus" /> }, ...modeChildRoutes('versus')] },
      { path: 'grand-jury', children: [{ index: true, element: <ModePage id="grand-jury" /> }, ...modeChildRoutes('grand-jury')] },
      // The gallery is a developer tool: split out so it never weighs on real pages.
      // The demo court pulls in three.js: its own chunk, loaded only on this route.
      { path: 'courtroom', lazy: async () => ({ Component: (await import('@/stage/DemoCourtPage')).DemoCourtPage }) },
      // First-person roaming courtroom sandbox (three.js, own chunk).
      { path: 'court/walk', lazy: async () => ({ Component: (await import('@/roam/WalkPage')).WalkPage }) },
      // Explorable isometric town (three.js, own chunk).
      { path: 'town', lazy: async () => ({ Component: (await import('@/town/TownPage')).TownPage }) },
      { path: 'gallery', lazy: async () => ({ Component: (await import('@/gallery/GalleryPage')).GalleryPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

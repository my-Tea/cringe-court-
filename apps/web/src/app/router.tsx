import { createBrowserRouter, type RouteObject } from 'react-router';
import { HomePage } from '@/pages/HomePage';
import { ModePage } from '@/pages/ModePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { modeChildRoutes } from '@/modes/registry';
import { RouteError } from './RouteError';
import { AppShell } from './shell/AppShell';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'solo', children: [{ index: true, element: <ModePage id="solo" /> }, ...modeChildRoutes('solo')] },
      { path: 'versus', children: [{ index: true, element: <ModePage id="versus" /> }, ...modeChildRoutes('versus')] },
      { path: 'grand-jury', children: [{ index: true, element: <ModePage id="grand-jury" /> }, ...modeChildRoutes('grand-jury')] },
      // The gallery is a developer tool: split out so it never weighs on real pages.
      // The demo court pulls in three.js: its own chunk, loaded only on this route.
      { path: 'courtroom', lazy: async () => ({ Component: (await import('@/stage/DemoCourtPage')).DemoCourtPage }) },
      // First-person roaming courtroom sandbox (three.js, own chunk).
      { path: 'court/walk', lazy: async () => ({ Component: (await import('@/roam/WalkPage')).WalkPage }) },
      { path: 'gallery', lazy: async () => ({ Component: (await import('@/gallery/GalleryPage')).GalleryPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

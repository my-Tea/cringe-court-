import { createBrowserRouter, type RouteObject } from 'react-router';
import { HomePage } from '@/pages/HomePage';
import { ModePage } from '@/pages/ModePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteError } from './RouteError';
import { AppShell } from './shell/AppShell';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'solo', element: <ModePage id="solo" /> },
      { path: 'versus', element: <ModePage id="versus" /> },
      { path: 'grand-jury', element: <ModePage id="grand-jury" /> },
      // The gallery is a developer tool: split out so it never weighs on real pages.
      { path: 'gallery', lazy: async () => ({ Component: (await import('@/gallery/GalleryPage')).GalleryPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

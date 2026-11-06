import type { ModeId } from '@cringe-court/core';

/** Every path in the app, so links never drift from the router. */
export const paths = {
  home: '/',
  mode: (id: ModeId) => `/${id}`,
  gallery: '/gallery',
} as const;

export const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: paths.mode('solo'), label: 'Solo' },
  { to: paths.mode('versus'), label: 'Versus' },
  { to: paths.mode('grand-jury'), label: 'Grand Jury' },
  { to: paths.gallery, label: 'Design gallery' },
];

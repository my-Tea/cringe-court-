import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/render';
import { __setCanRoamForTests } from '@/trial/trialView';
import type * as RoamReact from '@cringe-court/scene/roam/react';
import { WalkPage } from './WalkPage';

const roamFails = vi.hoisted(() => ({ on: false }));
vi.mock('@cringe-court/scene/roam/react', async (importOriginal) => {
  const real = await importOriginal<typeof RoamReact>();
  return {
    ...real,
    useRoamCourtroom: (...args: Parameters<typeof RoamReact.useRoamCourtroom>) => {
      if (roamFails.on) throw new Error('Error creating WebGL context.');
      return real.useRoamCourtroom(...args);
    },
  };
});

/** B7 (UX evaluation): /court/walk without WebGL2 crashed to the route error page. */
describe('/court/walk without WebGL2 (B7)', () => {
  afterEach(() => {
    __setCanRoamForTests(null);
    roamFails.on = false;
  });

  it('explains and points to the courts instead of crashing', async () => {
    __setCanRoamForTests(false);
    const { container } = renderWithProviders(<WalkPage />, { route: '/court/walk' });
    expect(screen.getByRole('heading', { level: 1, name: 'This browser can’t draw the walkable courtroom' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the courts' })).toHaveAttribute('href', '/court');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('falls back the same way if the 3D court fails while starting', () => {
    __setCanRoamForTests(true);
    roamFails.on = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithProviders(<WalkPage />, { route: '/court/walk' });
    spy.mockRestore();
    expect(screen.getByRole('heading', { level: 1, name: 'This browser can’t draw the walkable courtroom' })).toBeInTheDocument();
    expect(screen.getByText(/Error creating WebGL context/)).toBeInTheDocument();
  });
});

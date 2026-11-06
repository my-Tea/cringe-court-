import { render, screen, within } from '@testing-library/react';
import type { ModeId } from '@cringe-court/core';
import { webModes } from '@/modes/registry';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { axe } from 'vitest-axe';
import { MotionProvider, ToastProvider, TooltipProvider } from '@/ds';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <MotionProvider>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </MotionProvider>,
  );
  return { router, ...utils };
}

describe('landing', () => {
  it('renders the logo heading, the sign-in form and the main nav', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /CringeCourt/ })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});

describe('app shell', () => {
  it('renders landmarks, a skip link and the permanent testnet badge', async () => {
    renderAt('/court');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pick your court' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(within(screen.getByRole('banner')).getByText(/test USDC only/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('shows the decided numbers for every court on the courts lobby', async () => {
    renderAt('/court');
    await screen.findByRole('heading', { name: 'Pick your court' });
    expect(screen.getByText('1.20 test USDC')).toBeInTheDocument();
    expect(screen.getByText('1.40 test USDC')).toBeInTheDocument();
    expect(screen.getByText('7.30 test USDC')).toBeInTheDocument();
    expect(screen.getByText(/7 verified humans · 4 must match/)).toBeInTheDocument();
  });

  it.each([
    ['/solo', 'Solo Court', 'GUILTY / NOT COOKED'],
    ['/versus', 'Versus Court', 'SIDE A / SIDE B'],
    ['/grand-jury', 'Grand Jury', 'FOR / AGAINST'],
  ])('%s renders its mode page with ballot and a disabled filing button', async (path, title, ballot) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(ballot)).toBeInTheDocument();
    // A mode whose track has landed links to its play flow; the rest show the disabled button.
    const landing = webModes.get(path.slice(1) as ModeId)?.landing;
    if (landing) expect(screen.getByRole('link', { name: new RegExp(landing.label) })).toHaveAttribute('href', landing.to);
    else expect(screen.getByRole('button', { name: /Filing opens soon/ })).toHaveAttribute('aria-disabled', 'true');
    expect(document.title).toBe(`${title} · CringeCourt`);
  });

  it('marks the current nav item and navigates client-side, moving focus to main', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/court');
    await screen.findByRole('heading', { name: 'Pick your court' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Leaderboard' }));
    expect(router.state.location.pathname).toBe('/leaderboard');
    expect(within(nav).getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('keeps "The court" tab current on a mode page', async () => {
    renderAt('/versus');
    await screen.findByRole('heading', { level: 1, name: 'Versus Court' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'The court' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a 404 page for unknown paths', async () => {
    renderAt('/no-such-case');
    expect(await screen.findByRole('heading', { level: 1, name: 'This page was never filed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the courthouse/ })).toHaveAttribute('href', '/');
  });

  it('lazy-loads the design gallery', async () => {
    renderAt('/gallery');
    expect(await screen.findByRole('heading', { level: 1, name: 'Design gallery' }, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Gallery sections' })).toBeInTheDocument();
  });

  it.each([
    ['/', 'CringeCourt'],
    ['/court', 'Pick your court'],
    ['/how-to-play', 'How to play'],
    ['/leaderboard', 'Leaderboard'],
  ])('has no axe violations on %s', async (path, heading) => {
    const { container } = renderAt(path);
    await screen.findByRole('heading', { level: 1, name: new RegExp(heading) });
    // jsdom can't compute colour contrast; tokens.test.ts enforces it instead.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});

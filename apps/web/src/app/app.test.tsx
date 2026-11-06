import { render, screen, waitFor, within } from '@testing-library/react';
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

describe('title screen', () => {
  it('is the front door: the logo, a game menu and the testnet badge, no site nav', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /CringeCourt/ })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    for (const name of ['Play', 'How to play', 'Settings']) expect(within(menu).getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    expect(screen.getByText(/every coin is test USDC/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('Play enters the world; without WebGL2 the game falls back to its menu', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/');
    await user.click(await screen.findByRole('button', { name: /Play/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/menu'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Game menu' })).toBeInTheDocument();
  });
});

describe('game frame', () => {
  it('draws screens over the world with only the way back and the menu: no header nav, no footer', async () => {
    renderAt('/court');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pick your court' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('button', { name: /Back to the game/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Menu$/ })).toBeInTheDocument();
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('the menu opens its screens in place, moving focus to them; Escape steps back', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/menu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Game menu' })).toBeInTheDocument();
    for (const name of ['Resume', 'Leaderboard', 'My cases', 'The three courts', 'How to play', 'Settings', 'Quit to title']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: /Leaderboard/ }));
    expect(router.state.location.pathname).toBe('/leaderboard');
    expect(await screen.findByRole('heading', { level: 1, name: 'Leaderboard' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(router.state.location.pathname).toBe('/menu');
  });

  it('Escape never leaves a filing step (a half-written story is not thrown away)', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/versus');
    await screen.findByRole('heading', { level: 1, name: 'Versus Court' });
    await user.keyboard('{Escape}');
    expect(router.state.location.pathname).toBe('/versus');
  });
});

describe('courts and pages in the game', () => {
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

  it('/grand-jury explains that you are the verified juror and the others are simulated; Solo keeps the NPC-jurors notice', async () => {
    const gj = renderAt('/grand-jury');
    await screen.findByRole('heading', { level: 1, name: 'Grand Jury' });
    expect(screen.getByText('Playable on the demo court: you are a verified juror')).toBeInTheDocument();
    expect(screen.getByText(/mock World ID verifies you/)).toBeInTheDocument();
    expect(screen.queryByText(/NPC jurors stand in for World ID/)).not.toBeInTheDocument();
    gj.unmount();
    renderAt('/solo');
    await screen.findByRole('heading', { level: 1, name: 'Solo Court' });
    expect(screen.getByText('Testnet demo court')).toBeInTheDocument();
    expect(screen.getByText(/NPC jurors stand in for World ID/)).toBeInTheDocument();
  });

  it('/versus renders its mode page with ballot and the live filing calls to action', async () => {
    renderAt('/versus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Versus Court' })).toBeInTheDocument();
    expect(screen.getByText('SIDE A / SIDE B')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start a Versus case/ })).toHaveAttribute('href', '/versus/new');
    expect(screen.getByRole('link', { name: /I have an invite code/ })).toHaveAttribute('href', '/versus/join');
    expect(screen.queryByRole('button', { name: /Filing opens soon/ })).not.toBeInTheDocument();
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

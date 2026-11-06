import { render, screen, within } from '@testing-library/react';
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

describe('app shell', () => {
  it('renders landmarks, a skip link and the permanent testnet badge', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /CringeCourt/ })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(within(screen.getByRole('banner')).getByText(/test USDC only/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('shows the decided numbers for every court on the home page', async () => {
    renderAt('/');
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
    // Solo is playable (demo court); the other modes still show the disabled button until their tracks land.
    if (path === '/solo') expect(screen.getByRole('link', { name: /File a confession/ })).toHaveAttribute('href', '/solo/file');
    else expect(screen.getByRole('button', { name: /Filing opens soon/ })).toHaveAttribute('aria-disabled', 'true');
    expect(document.title).toBe(`${title} · CringeCourt`);
  });

  it('marks the current nav item and navigates client-side, moving focus to main', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/');
    await screen.findByRole('heading', { name: 'Pick your court' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Versus' }));
    expect(router.state.location.pathname).toBe('/versus');
    expect(within(nav).getByRole('link', { name: 'Versus' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toHaveFocus();
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

  it('has no axe violations on the home page', async () => {
    const { container } = renderAt('/');
    await screen.findByRole('heading', { name: 'Pick your court' });
    // jsdom can't compute colour contrast; tokens.test.ts enforces it instead.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});

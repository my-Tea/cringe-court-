import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { axe } from 'vitest-axe';
import { MotionProvider, ToastProvider, TooltipProvider } from '@/ds';
import { routes } from '@/app/router';

function renderLanding() {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
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
  it('shows the logo heading, both ribbons, the sign-in form and the courtroom', async () => {
    renderLanding();
    expect(await screen.findByRole('heading', { level: 1, name: 'CringeCourt' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /The court is now in session/i })).toBeInTheDocument();
    expect(screen.getByText(/Make your case\. Lose your dignity\./i)).toBeInTheDocument();
    const form = screen.getByRole('form', { name: 'Sign in' });
    expect(within(form).getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(within(form).getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('img', { name: /papercraft courtroom/i })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('runs top to bottom on the keyboard: nav, fields, reveal, enter, guest, social tiles', async () => {
    const user = userEvent.setup();
    renderLanding();
    await screen.findByRole('form', { name: 'Sign in' });
    const order = [
      screen.getByRole('link', { name: 'Skip to sign in' }),
      screen.getByRole('link', { name: 'Home' }),
      screen.getByRole('link', { name: 'The court' }),
      screen.getByRole('link', { name: 'Leaderboard' }),
      screen.getByRole('link', { name: 'How to play' }),
      screen.getByRole('link', { name: 'Enter court' }),
      screen.getByLabelText('Email'),
      screen.getByLabelText('Password'),
      screen.getByRole('button', { name: 'Show password' }),
      screen.getByRole('button', { name: 'Enter the court' }),
      screen.getByRole('button', { name: 'Play as guest' }),
      screen.getByRole('button', { name: 'Continue with Discord' }),
      screen.getByRole('button', { name: 'Continue with Google' }),
      screen.getByRole('button', { name: 'Continue with Apple' }),
    ];
    for (const el of order) {
      await user.tab();
      expect(el).toHaveFocus();
    }
  });

  it('reveals the password with the eye button and hides it again', async () => {
    const user = userEvent.setup();
    renderLanding();
    const password = await screen.findByLabelText('Password');
    await user.type(password, 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('validates on Enter, focuses the first bad field, and wipes the password', async () => {
    const user = userEvent.setup();
    const { router } = renderLanding();
    const email = await screen.findByLabelText('Email');
    const password = screen.getByLabelText('Password');
    await user.type(email, 'not-an-email');
    await user.type(password, 'secret{Enter}');
    expect(await screen.findByText('That email is missing an @ or a domain.')).toBeInTheDocument();
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveValue('');
    expect(router.state.location.pathname).toBe('/');
  });

  it('a well-formed demo entry walks into the arrival run without keeping the password', async () => {
    const user = userEvent.setup();
    const { router } = renderLanding();
    await user.type(await screen.findByLabelText('Email'), 'juror@example.com');
    const password = screen.getByLabelText('Password');
    await user.type(password, 'secret');
    await user.keyboard('{Enter}');
    // The run is a lazy route: the location moves once its chunk has loaded.
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'), { timeout: 5000 });
    expect(await screen.findByText(/nothing was sent or saved/)).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('PLAY AS GUEST works from the keyboard', async () => {
    const user = userEvent.setup();
    const { router } = renderLanding();
    (await screen.findByRole('button', { name: 'Play as guest' })).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/play'), { timeout: 5000 });
  });

  it('social tiles say "coming soon" and stay on the page', async () => {
    const user = userEvent.setup();
    const { router } = renderLanding();
    (await screen.findByRole('button', { name: 'Continue with Google' })).focus();
    await user.keyboard(' ');
    expect(await screen.findByText('Google sign-in is coming soon')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('makes no network requests and stores nothing', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const before = { local: localStorage.length, session: sessionStorage.length };
    renderLanding();
    await user.type(await screen.findByLabelText('Email'), 'juror@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret{Enter}');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(before.session);
    for (let i = 0; i < localStorage.length; i++) expect(localStorage.getItem(localStorage.key(i)!)).not.toContain('secret');
    fetchSpy.mockRestore();
  });

  it('has no axe violations', async () => {
    const { container } = renderLanding();
    await screen.findByRole('form', { name: 'Sign in' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

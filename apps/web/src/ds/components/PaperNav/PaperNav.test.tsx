import { screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PaperNavBar, PaperTab } from './PaperNav';

function Bar({ pathname }: { pathname: string }) {
  return (
    <PaperNavBar label="Main">
      <PaperTab to="/" icon="home" end>
        Home
      </PaperTab>
      <PaperTab to="/court" icon="scales" pathname={pathname} activeFor={(p) => p === '/solo'}>
        The court
      </PaperTab>
    </PaperNavBar>
  );
}

describe('PaperNavBar / PaperTab', () => {
  it('is a named navigation landmark with a list of links on the wood surface', () => {
    renderWithProviders(<Bar pathname="/" />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    expect(nav.closest('[data-surface]')).toHaveAttribute('data-surface', 'wood');
  });

  it('marks the current page', () => {
    renderWithProviders(<Bar pathname="/" />, { route: '/' });
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'The court' })).not.toHaveAttribute('aria-current');
  });

  it('activeFor marks a section tab current on its child pages', () => {
    renderWithProviders(<Bar pathname="/solo" />, { route: '/solo' });
    expect(screen.getByRole('link', { name: 'The court' })).toHaveAttribute('aria-current', 'page');
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<Bar pathname="/" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

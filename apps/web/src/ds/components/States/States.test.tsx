import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { EmptyState, ErrorState, LoadingState } from './States';

describe('EmptyState', () => {
  it('renders the title as a heading at the requested level', () => {
    renderWithProviders(<EmptyState title="No cases yet" headingLevel={3}>File one.</EmptyState>);
    expect(screen.getByRole('heading', { level: 3, name: 'No cases yet' })).toBeInTheDocument();
    expect(screen.getByText('File one.')).toBeInTheDocument();
  });

  it('defaults to h2', () => {
    renderWithProviders(<EmptyState title="Nothing" />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});

describe('LoadingState', () => {
  it('is a busy status region', () => {
    renderWithProviders(<LoadingState title="Fetching arguments" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Fetching arguments');
  });
});

describe('ErrorState', () => {
  it('is an alert with a working retry button and collapsed details', async () => {
    const onRetry = vi.fn();
    renderWithProviders(<ErrorState title="Broke" onRetry={onRetry} details="Error: boom">Nothing was charged.</ErrorState>);
    expect(screen.getByRole('alert')).toHaveTextContent('Broke');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    const details = screen.getByText('Error: boom').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
  });

  it('supports a custom retry label', () => {
    renderWithProviders(<ErrorState title="Broke" onRetry={() => {}} retryLabel="Reload" />);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});

describe('states accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderWithProviders(
      <main>
        <EmptyState title="Empty" />
        <LoadingState />
        <ErrorState title="Error" onRetry={() => {}} details="x" />
      </main>,
    );
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});

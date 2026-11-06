import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { useToast } from './Toast';

function Demo() {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast({ title: 'Verdict in', description: 'Guilty as charged', tone: 'success' })}>
      Fire
    </button>
  );
}

describe('Toast', () => {
  it('shows the title and description and offers a dismiss button', async () => {
    renderWithProviders(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Fire' }));
    expect(await screen.findByText('Verdict in')).toBeInTheDocument();
    expect(screen.getByText('Guilty as charged')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('useToast throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Demo />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

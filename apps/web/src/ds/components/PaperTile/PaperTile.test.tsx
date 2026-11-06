import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PaperTile } from './PaperTile';

describe('PaperTile', () => {
  it('is an icon-only button named by its label', async () => {
    const onClick = vi.fn();
    renderWithProviders(<PaperTile icon="discord" label="Continue with Discord" onClick={onClick} />);
    const tile = screen.getByRole('button', { name: 'Continue with Discord' });
    expect(tile).toHaveAttribute('data-shape', 'hex');
    await userEvent.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<PaperTile icon="google" label="Continue with Google" shape="round" tone="cream" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

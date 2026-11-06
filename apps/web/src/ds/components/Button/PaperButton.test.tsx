import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Icon } from '../Icon/Icon';
import { PaperButton, PaperButtonLink } from './Button';

describe('PaperButton', () => {
  it('is a native button named by its label (the icon is decorative)', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <PaperButton size="xl" iconStart={<Icon name="gavel" />} onClick={onClick}>
        Enter the court
      </PaperButton>,
    );
    const btn = screen.getByRole('button', { name: 'Enter the court' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.className).toMatch(/gold/);
    expect(btn.className).toMatch(/xl/);
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each(['gold', 'maroon', 'ghost'] as const)('variant %s maps to its paper stock class', (variant) => {
    renderWithProviders(<PaperButton variant={variant}>Go</PaperButton>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toMatch(new RegExp(variant));
  });

  it('works from the keyboard and keeps disabled focusable', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <PaperButton variant="maroon" disabled onClick={onClick}>
        Play as guest
      </PaperButton>,
    );
    await userEvent.tab();
    const btn = screen.getByRole('button', { name: 'Play as guest' });
    expect(btn).toHaveFocus();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('PaperButtonLink is a link', () => {
    renderWithProviders(<PaperButtonLink to="/court">The court</PaperButtonLink>);
    expect(screen.getByRole('link', { name: 'The court' })).toHaveAttribute('href', '/court');
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<PaperButton>Enter</PaperButton>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

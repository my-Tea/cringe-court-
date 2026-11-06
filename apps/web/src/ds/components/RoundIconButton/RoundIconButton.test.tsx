import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoundIconButton, RoundIconLink, RoundIconTile } from './RoundIconButton';

describe('RoundIconButton', () => {
  it('is a named button with a decorative pixel glyph', async () => {
    const onClick = vi.fn();
    const { container } = renderWithProviders(
      <main>
        <RoundIconButton icon="gear" label="Settings" onClick={onClick} />
      </main>,
    );
    const btn = screen.getByRole('button', { name: 'Settings' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(btn.querySelector('svg')).toHaveAttribute('data-icon', 'gear');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });

  it('exposes toggle state with aria-pressed', () => {
    renderWithProviders(<RoundIconButton icon="star" label="Pin case" pressed />);
    expect(screen.getByRole('button', { name: 'Pin case' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders as a router link with the same name', () => {
    renderWithProviders(<RoundIconLink to="/gallery" icon="star" label="Gallery" />);
    expect(screen.getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/gallery');
  });

  it('tile is decorative inside a captioned link', () => {
    renderWithProviders(
      <a href="#x">
        <RoundIconTile icon="scales" />
        Courts
      </a>,
    );
    expect(screen.getByRole('link', { name: 'Courts' })).toBeInTheDocument();
  });
});

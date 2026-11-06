import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PaperField } from './PaperField';

describe('PaperField', () => {
  it('labels the input (icon is decorative) and links hint and error', () => {
    renderWithProviders(<PaperField label="Email" icon="mail" type="email" hint="Demo only." error="Enter an email." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Demo only. Enter an email.');
    expect(document.querySelector('[data-icon="mail"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('reveals a password with a labelled toggle button', async () => {
    renderWithProviders(<PaperField label="Password" icon="lock" type="password" revealable />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks optional fields and keeps typing working', async () => {
    renderWithProviders(<PaperField label="Handle" optional icon="user" iconPlacement="inside" />);
    const input = screen.getByRole('textbox', { name: /Handle/ });
    expect(input).not.toBeRequired();
    await userEvent.type(input, 'judge');
    expect(input).toHaveValue('judge');
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<PaperField label="Password" type="password" revealable hint="Any password works." />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

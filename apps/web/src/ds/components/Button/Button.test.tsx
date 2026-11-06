import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Button, ButtonLink, IconButton } from './Button';

describe('Button', () => {
  it('renders a native button with type="button" and fires click', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('allows type="submit"', () => {
    renderWithProviders(<Button type="submit">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'submit');
  });

  it('disabled uses aria-disabled, stays focusable and swallows clicks', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button disabled onClick={onClick}>Nope</Button>);
    const btn = screen.getByRole('button', { name: 'Nope' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).not.toBeDisabled();
    await userEvent.tab();
    expect(btn).toHaveFocus();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading sets aria-busy and blocks clicks', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button loading onClick={onClick}>Sending</Button>);
    const btn = screen.getByRole('button', { name: /Sending/ });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('IconButton takes its accessible name from label', async () => {
    const onClick = vi.fn();
    renderWithProviders(<IconButton label="Open menu" icon={<svg aria-hidden />} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('ButtonLink renders an anchor with href', () => {
    renderWithProviders(<ButtonLink to="/cases">All cases</ButtonLink>);
    const link = screen.getByRole('link', { name: 'All cases' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/cases');
  });

  it('has no axe violations across the button set', async () => {
    const { container } = renderWithProviders(
      <div>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger" disabled>Danger</Button>
        <Button loading>Loading</Button>
        <IconButton label="Close" icon={<svg aria-hidden />} />
        <ButtonLink to="/x">Link</ButtonLink>
      </div>,
    );
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});

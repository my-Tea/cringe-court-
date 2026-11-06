import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Dialog, DialogContent, DialogTrigger } from './Dialog';

function Demo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button">Open it</button>
      </DialogTrigger>
      <DialogContent title="Confirm filing" description="This posts your bond.">
        <p>Body</p>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('opens with an accessible name and description', async () => {
    renderWithProviders(<Demo />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm filing' });
    expect(dialog).toHaveAccessibleDescription('This posts your bond.');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    renderWithProviders(<Demo />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes with the Close button', async () => {
    renderWithProviders(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

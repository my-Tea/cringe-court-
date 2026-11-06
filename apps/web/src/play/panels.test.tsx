import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/ds';
import { TrialPanel } from './panels';

function open(initial: 'solo' | 'versus' = 'solo') {
  const onChoose = vi.fn();
  render(
    <TooltipProvider>
      <TrialPanel initial={initial} chosen={null} onChoose={onChoose} onClose={vi.fn()} />
    </TooltipProvider>,
  );
  return onChoose;
}

describe('game mode panel', () => {
  it('offers every mode in one place', () => {
    open();
    for (const name of ['Solo', 'Versus', 'Grand Jury']) expect(screen.getByRole('tab', { name })).toBeInTheDocument();
  });

  it('opens on the mode of the gate the player stands at', () => {
    open('versus');
    expect(screen.getByRole('tab', { name: 'Versus' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches mode inside the panel and chooses the one on show', async () => {
    const user = userEvent.setup();
    const onChoose = open();
    await user.click(screen.getByRole('tab', { name: 'Grand Jury' }));
    await user.click(screen.getByRole('button', { name: /Choose Grand Jury/ }));
    expect(onChoose).toHaveBeenCalledWith('grand-jury');
  });
});

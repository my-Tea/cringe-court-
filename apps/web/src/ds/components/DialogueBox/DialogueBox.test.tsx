import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DialogueBox } from './DialogueBox';

const TEXT = 'Order in the court!';

describe('DialogueBox', () => {
  it('shows the full text instantly, with no Skip, under reduced motion', () => {
    localStorage.setItem('cc:motion', 'reduced');
    const onDone = vi.fn();
    renderWithProviders(<DialogueBox speaker="judge" text={TEXT} onDone={onDone} />);
    // One visually hidden copy for screen readers plus the complete visible copy.
    expect(screen.getAllByText(TEXT)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
    expect(screen.getByText('Judge Gavel.exe')).toBeInTheDocument();
  });

  it('gives screen readers the whole line immediately while typing', () => {
    renderWithProviders(<DialogueBox speaker="judge" text={TEXT} />);
    const hidden = screen.getByText(TEXT);
    expect(hidden).toHaveClass('cc-visually-hidden');
    expect(screen.getAllByText(TEXT)).toHaveLength(1); // visible copy is still partial
    expect(hidden.nextElementSibling).toHaveAttribute('aria-hidden', 'true');
  });

  it('Skip completes the text, calls onDone and disappears', async () => {
    const onDone = vi.fn();
    renderWithProviders(<DialogueBox speaker="judge" text={TEXT} speed={1} onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getAllByText(TEXT)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

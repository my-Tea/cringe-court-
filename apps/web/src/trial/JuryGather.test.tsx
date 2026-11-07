import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { JURY_SEAT_MS, JURY_SEATED_HOLD_MS, JuryGather } from './JuryGather';

describe('JuryGather', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills seats one by one then calls onSeated', async () => {
    const onSeated = vi.fn();
    renderWithProviders(<JuryGather jurors={3} onSeated={onSeated} />);
    expect(screen.getByRole('heading', { name: 'Waiting for the jury' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 of 3 seats filled');

    for (const text of ['1 of 3 seats filled', '2 of 3 seats filled', 'The jury is seated.']) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(JURY_SEAT_MS);
      });
      expect(screen.getByRole('status')).toHaveTextContent(text);
    }
    expect(onSeated).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JURY_SEATED_HOLD_MS);
    });
    expect(onSeated).toHaveBeenCalledTimes(1);
  });
});

import type { Hex } from '@cringe-court/core';
import { act, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { writeCase } from './liveCase';
import { JURY_SEAT_MS, JURY_SEATED_HOLD_MS, TrialPage, VOTE_HOLD_MS, VOTE_SEAL_MS } from './TrialPage';

vi.mock('./liveCase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./liveCase')>();
  return { ...actual, fetchTrial: vi.fn(() => new Promise(() => undefined)) };
});

vi.mock('@/trial/TrialViewFrame', () => ({
  TrialViewFrame: ({ roam }: { roam: { onDone?: () => void } }) => (
    <button type="button" onClick={() => roam.onDone?.()}>
      finish hearing
    </button>
  ),
}));

function renderTrial() {
  return renderWithProviders(
    <Routes>
      <Route path="/solo/trial/:caseNumber" element={<TrialPage />} />
    </Routes>,
    { route: '/solo/trial/7' },
  );
}

describe('live trial order', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writeCase('7', {
      title: 'The Public Confession',
      story: 'I clapped when the bus landed.',
      txHash: `0x${'ab'.repeat(32)}` as Hex,
      explorerUrl: 'https://example.test/tx',
      jurors: 3,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the empty jury the stake paid for, fills those seats, then starts the trial', async () => {
    renderTrial();
    expect(screen.getByRole('heading', { name: 'Waiting for the jury' })).toBeInTheDocument();
    expect(screen.getByText('Waiting for 3 jurors to join.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 of 3 seats filled');

    for (const text of ['1 of 3 seats filled', '2 of 3 seats filled', 'The jury is seated.']) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(JURY_SEAT_MS);
      });
      expect(screen.getByRole('status')).toHaveTextContent(text);
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(JURY_SEATED_HOLD_MS);
    });
    expect(screen.getByText('Waking up Counsel Chaos…')).toBeInTheDocument();
    expect(screen.queryByText(/seats filled/)).not.toBeInTheDocument();
  });

  it('after the hearing: voting tally, then judge verdict, then adjourned', async () => {
    const { fetchTrial } = await import('./liveCase');
    vi.mocked(fetchTrial).mockResolvedValue([
      { id: '1', speaker: 'judge', segment: 'call-to-order', beat: 'gavel', text: 'Order.' },
    ] as never);

    renderTrial();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(JURY_SEAT_MS);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JURY_SEATED_HOLD_MS);
    });
    // Resolve fetchTrial + React commit under fake timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'finish hearing' })).toBeInTheDocument();
    await act(async () => {
      screen.getByRole('button', { name: 'finish hearing' }).click();
    });

    expect(screen.getByRole('heading', { name: 'The jury is voting' })).toBeInTheDocument();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(VOTE_SEAL_MS);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VOTE_HOLD_MS);
    });

    expect(screen.getByText(/Judge Gavel.exe · the verdict/)).toBeInTheDocument();
    expect(screen.getByText(/The jury has spoken/)).toBeInTheDocument();
    await act(async () => {
      screen.getByRole('button', { name: 'Court is adjourned' }).click();
    });
    expect(screen.getByRole('heading', { name: 'Court is adjourned' })).toBeInTheDocument();
  });
});

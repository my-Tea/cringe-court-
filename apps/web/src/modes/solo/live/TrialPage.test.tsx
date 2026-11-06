import type { Hex } from '@cringe-court/core';
import { act, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { writeCase } from './liveCase';
import { JURY_SEAT_MS, JURY_SEATED_HOLD_MS, TrialPage } from './TrialPage';

vi.mock('./liveCase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./liveCase')>();
  return { ...actual, fetchTrial: vi.fn(() => new Promise(() => undefined)) };
});

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
});

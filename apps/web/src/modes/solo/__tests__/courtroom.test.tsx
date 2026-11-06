import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import type { CourtLine } from '@cringe-court/core';
import { RecordingAudio } from '@cringe-court/core/testing';
import { renderWithProviders } from '@/test/render';
import { Courtroom } from '../court/Courtroom';
import type { TrialView, TrialViewProps } from '../court/TrialView';

const LINES: CourtLine[] = [
  { id: 'L01', speaker: 'judge', segment: 'call-to-order', beat: 'gavel', text: 'ORDER! Court is in session.' },
  { id: 'L02', speaker: 'prosecutor', bench: 0, segment: 'opening', beat: 'desk-slam', text: 'The facts are cooked.' },
  { id: 'L03', speaker: 'prosecutor', bench: 0, segment: 'rebuttal', beat: 'objection', text: 'OBJECTION! Rap sheet.' },
  { id: 'L04', speaker: 'defense', bench: 1, segment: 'closing', beat: 'laugh', text: 'Vote NOT COOKED. Let bro cook.' },
  { id: 'L05', speaker: 'judge', segment: 'jury-out', beat: 'gavel', text: 'THE JURY IS OUT.' },
];

const live = () => document.querySelector('[aria-live="polite"][aria-atomic]')!;

describe('Courtroom', () => {
  it('stages each line, announces it once in full, and has no axe violations', async () => {
    const audio = new RecordingAudio();
    const { container } = renderWithProviders(<Courtroom lines={LINES} title="Reply-all" autoPlay={false} audio={audio} />);
    expect(screen.getByRole('region', { name: 'Courtroom: Reply-all' })).toBeInTheDocument();
    expect(live()).toHaveTextContent('Judge Gavel.exe: ORDER! Court is in session.');
    expect(audio.cues()).toContain('sfx.gavel');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves with the buttons, the chapter rail and the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Courtroom lines={LINES} title="Reply-all" autoPlay={false} />);
    await user.click(screen.getByRole('button', { name: 'Next line' }));
    expect(live()).toHaveTextContent('Miss Ratio: The facts are cooked.');
    await user.click(screen.getByRole('button', { name: 'Rebuttals' }));
    expect(screen.getByRole('button', { name: 'Rebuttals' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('OBJECTION!', { selector: 'span' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Rebuttals' }), { key: 'ArrowRight' });
    expect(live()).toHaveTextContent('Counsel Chaos: Vote NOT COOKED. Let bro cook.');
    fireEvent.keyDown(screen.getByRole('region', { name: /Courtroom/ }), { key: 'ArrowLeft' });
    expect(live()).toHaveTextContent('Miss Ratio: OBJECTION! Rap sheet.');
    expect(screen.getByRole('button', { name: 'Previous line' })).toBeEnabled();
  });

  it('shows the full transcript on demand', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Courtroom lines={LINES} title="Reply-all" autoPlay={false} />);
    await user.click(screen.getByRole('button', { name: 'Transcript' }));
    const list = screen.getByRole('list', { name: 'Full transcript' });
    expect(list.querySelectorAll('li')).toHaveLength(LINES.length);
    await user.click(screen.getByRole('button', { name: /THE JURY IS OUT/ }));
    expect(live()).toHaveTextContent('THE JURY IS OUT.');
  });

  it('plays through on its own and reports the end once (reduced motion: no typewriter)', async () => {
    vi.useFakeTimers();
    try {
      document.documentElement.dataset.reducedMotion = 'true';
      window.localStorage.setItem('cc:motion', 'reduced');
      const done = vi.fn();
      renderWithProviders(<Courtroom lines={LINES.slice(0, 3)} title="Reply-all" onFinished={done} />);
      // Reduced motion: the whole line is there at once.
      expect(screen.getAllByText('ORDER! Court is in session.').length).toBeGreaterThan(0);
      for (let i = 0; i < 4; i++) await act(async () => void vi.advanceTimersByTime(6000));
      expect(done).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Replay from the start' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('drives a pluggable TrialView beat by beat and falls back to the illustrated stage when it fails', async () => {
    const user = userEvent.setup();
    const beats: Array<[number, string]> = [];
    let fail: ((e: Error) => void) | undefined;
    function FakeView({ line, index, onReady, onError }: TrialViewProps) {
      beats.push([index, line.id]);
      fail = onError;
      onReady();
      return null;
    }
    const view: TrialView = { Component: FakeView, label: 'Roam the court', requiresWebGL: false, ownsSound: true };
    const audio = new RecordingAudio();
    renderWithProviders(<Courtroom lines={LINES} cast={[]} view={view} title="Reply-all" autoPlay={false} audio={audio} />);
    const toggle = screen.getByRole('button', { name: 'Roam the court' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const before = audio.cues().length;
    await user.click(screen.getByRole('button', { name: 'Next line' }));
    expect(beats.at(-1)).toEqual([1, 'L02']);
    // The view owns sound while it is on: Courtroom does not double the cues.
    expect(audio.cues().length).toBe(before);
    act(() => fail!(new Error('no roam')));
    expect(screen.queryByRole('button', { name: 'Roam the court' })).not.toBeInTheDocument();
    expect(screen.getByText(/“Roam the court” could not load here/)).toBeInTheDocument();
    expect(live()).toHaveTextContent('Miss Ratio: The facts are cooked.');
  });
});

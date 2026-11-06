import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Countdown } from './Countdown';

const start = 1_700_000_000_000;

describe('Countdown', () => {
  it('shows the remaining time with a descriptive timer label', () => {
    render(<Countdown label="Commit your ballot" startsAt={start} endsAt={start + 600_000} now={start + 355_000} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('4:05');
    const name = timer.getAttribute('aria-label')!;
    expect(name).toContain('Commit your ballot');
    expect(name).toContain('4 minutes 5 seconds left');
    expect(name).toContain('deadline');
  });

  it('shows "Ended" when time is up', () => {
    render(<Countdown label="Reveal" startsAt={start} endsAt={start + 1000} now={start + 5000} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('Ended');
    expect(timer.getAttribute('aria-label')).toContain('ended');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Countdown label="Vote" startsAt={start} endsAt={start + 1000} now={start + 500} />);
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});

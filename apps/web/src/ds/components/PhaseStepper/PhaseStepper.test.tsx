import { render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { PhaseStepper } from './PhaseStepper';

const steps = ['Filed', 'Evidence', 'Vote', 'Verdict'];

describe('PhaseStepper', () => {
  it('is a labelled ordered list with the current step marked', () => {
    render(<PhaseStepper steps={steps} current={2} />);
    const list = screen.getByRole('list', { name: 'Trial progress' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[3]).not.toHaveAttribute('aria-current');
  });

  it('labels done steps', () => {
    render(<PhaseStepper steps={steps} current={2} />);
    expect(screen.getByText('Filed').parentElement).toHaveTextContent('Filed (done)');
    expect(screen.getByText('Evidence').parentElement).toHaveTextContent('Evidence (done)');
    expect(screen.getByText('Vote').parentElement).not.toHaveTextContent('(done)');
  });

  it('marks everything done when current equals length', () => {
    render(<PhaseStepper steps={steps} current={4} />);
    expect(screen.getAllByText('(done)', { exact: false })).toHaveLength(4);
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<PhaseStepper steps={steps} current={1} />);
    // color-contrast cannot be computed in jsdom; it is covered by tokens.test.ts.
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});

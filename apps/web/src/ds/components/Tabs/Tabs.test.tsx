import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const items = [
  { value: 'a', label: 'Evidence', content: <p>Evidence panel</p> },
  { value: 'b', label: 'Arguments', content: <p>Arguments panel</p> },
  { value: 'c', label: 'Verdict', content: <p>Verdict panel</p> },
];

describe('Tabs', () => {
  it('exposes a labelled tablist and the first panel', () => {
    render(<Tabs items={items} label="Case sections" />);
    expect(screen.getByRole('tablist', { name: 'Case sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Evidence panel');
  });

  it('moves selection with arrow keys and shows the matching panel', async () => {
    const onValueChange = vi.fn();
    render(<Tabs items={items} label="Case sections" onValueChange={onValueChange} />);
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Arguments' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Arguments panel');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Arguments');
    expect(onValueChange).toHaveBeenLastCalledWith('b');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Evidence panel');
  });
});

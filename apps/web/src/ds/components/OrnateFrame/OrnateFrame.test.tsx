import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { OrnateFrame } from './OrnateFrame';

describe('OrnateFrame', () => {
  it('re-themes its subtree, shows the ribbon and decorative photo-corners', async () => {
    const { container } = render(
      <main>
        <OrnateFrame as="section" tone="wood" ribbon="Verdict" aria-label="Verdict">
          <p>Cooked.</p>
        </OrnateFrame>
      </main>,
    );
    const frame = screen.getByRole('region', { name: 'Verdict' });
    expect(frame).toHaveAttribute('data-surface', 'wood');
    expect(screen.getByText('Verdict', { selector: 'p' })).toBeInTheDocument();
    const corners = frame.querySelectorAll(':scope > span[aria-hidden="true"]');
    expect(corners).toHaveLength(4);
    expect(frame.querySelector('svg')).toBeNull();
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });

  it('defaults to parchment', () => {
    render(<OrnateFrame data-testid="f">x</OrnateFrame>);
    expect(screen.getByTestId('f')).toHaveAttribute('data-surface', 'parchment');
  });
});

import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { OrnateFrame } from './OrnateFrame';

describe('OrnateFrame', () => {
  it('re-themes its subtree, shows the ribbon and hides the corner knots', async () => {
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
    const knots = frame.querySelectorAll('svg');
    expect(knots).toHaveLength(4);
    knots.forEach((k) => expect(k).toHaveAttribute('aria-hidden', 'true'));
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });

  it('defaults to parchment', () => {
    render(<OrnateFrame data-testid="f">x</OrnateFrame>);
    expect(screen.getByTestId('f')).toHaveAttribute('data-surface', 'parchment');
  });
});

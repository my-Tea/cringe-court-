import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaperPanel } from './PaperPanel';
import { PaperRibbon } from '../PaperRibbon/PaperRibbon';

describe('PaperPanel', () => {
  it('maps paper stock to a surface so children re-theme', () => {
    render(
      <>
        <PaperPanel tone="maroon" as="section" aria-label="Login">
          in
        </PaperPanel>
        <PaperPanel aria-label="Cream">x</PaperPanel>
      </>,
    );
    expect(screen.getByRole('region', { name: 'Login' })).toHaveAttribute('data-surface', 'wood');
    expect(screen.getByLabelText('Cream')).toHaveAttribute('data-surface', 'parchment');
  });

  it('keeps all paper layers out of the accessibility tree', () => {
    const { container } = render(
      <PaperPanel edge="torn" backing="gold">
        Content
      </PaperPanel>,
    );
    const layers = container.querySelector('[aria-hidden]');
    expect(layers?.children.length).toBe(2);
    expect(screen.getByText('Content')).toBeVisible();
  });
});

describe('PaperRibbon', () => {
  it('is a real heading with the decoration hidden', () => {
    render(
      <PaperRibbon as="h2" sparks>
        The court is now in session
      </PaperRibbon>,
    );
    const h = screen.getByRole('heading', { level: 2, name: 'The court is now in session' });
    expect(h.querySelectorAll('[aria-hidden]').length).toBe(3);
  });
});

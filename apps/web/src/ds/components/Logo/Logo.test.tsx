import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it.each(['stacked', 'inline', 'mark'] as const)('%s renders an svg image named CringeCourt', (layout) => {
    render(<Logo layout={layout} />);
    const img = screen.getByRole('img', { name: 'CringeCourt' });
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(img).toHaveAttribute('data-layout', layout);
  });

  it('carries the wordmark as live text sized with textLength (fits before the font loads)', () => {
    const { container } = render(<Logo />);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(3);
    for (const t of texts) {
      expect(t.textContent).toBe('CRINGECOURT');
      expect(t).toHaveAttribute('textLength');
    }
  });

  it('is decorative with title={null}', () => {
    const { container } = render(<Logo title={null} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('gives each instance unique gradient ids', () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Logo />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

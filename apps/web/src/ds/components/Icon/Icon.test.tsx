import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, Icon } from './Icon';

describe('Icon', () => {
  it.each(ICON_NAMES)('%s renders a 24x24 svg with paths', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('data-icon')).toBe(name);
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('is decorative by default', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('role')).toBeNull();
  });

  it('exposes an accessible name when titled', () => {
    const { getByRole } = render(<Icon name="check" title="Done" />);
    expect(getByRole('img', { name: 'Done' })).toBeTruthy();
  });
});

import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { usePageEnter } from './usePageEnter';

function Page({ path }: { path: string }) {
  const ref = useRef<HTMLElement>(null);
  usePageEnter(ref, path);
  return (
    <main ref={ref}>
      <p>child</p>
    </main>
  );
}

describe('usePageEnter', () => {
  it('replays the enter animation on every key change without remounting', () => {
    const { rerender, getByRole, getByText } = render(<Page path="/a" />);
    const main = getByRole('main');
    const child = getByText('child');
    expect(main).toHaveClass('cc-page-enter');
    main.classList.remove('cc-page-enter');
    rerender(<Page path="/b" />);
    expect(main).toHaveClass('cc-page-enter');
    expect(getByText('child')).toBe(child);
  });

  it("clears the class when its own animation ends, not when a child's does", () => {
    const { getByRole, getByText } = render(<Page path="/a" />);
    const main = getByRole('main');
    getByText('child').dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(main).toHaveClass('cc-page-enter');
    main.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(main).not.toHaveClass('cc-page-enter');
  });
});

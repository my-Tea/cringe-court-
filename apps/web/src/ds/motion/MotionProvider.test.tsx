import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_STORAGE_KEY, MotionProvider, useMotion } from './MotionProvider';

function mockMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function Probe() {
  const { preference, reduced, setPreference } = useMotion();
  return (
    <div>
      <p>{`${preference}:${reduced}`}</p>
      {(['system', 'reduced', 'full'] as const).map((p) => (
        <button key={p} type="button" onClick={() => setPreference(p)}>{`set ${p}`}</button>
      ))}
    </div>
  );
}
const choose = (p: string) => fireEvent.click(screen.getByRole('button', { name: `set ${p}` }));
const setup = () =>
  render(
    <MotionProvider>
      <Probe />
    </MotionProvider>,
  );

describe('MotionProvider', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it('follows the system preference by default', () => {
    mockMedia(true);
    setup();
    expect(screen.getByText('system:true')).toBeInTheDocument();
    expect(document.documentElement.dataset.reducedMotion).toBe('true');
  });

  it('is not reduced when the system does not ask for it', () => {
    mockMedia(false);
    setup();
    expect(screen.getByText('system:false')).toBeInTheDocument();
    expect(document.documentElement.dataset.reducedMotion).toBe('false');
  });

  it('lets the user override and persists the choice', () => {
    mockMedia(true);
    setup();
    choose('full');
    expect(document.documentElement.dataset.reducedMotion).toBe('false');
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('full');
    choose('reduced');
    expect(document.documentElement.dataset.reducedMotion).toBe('true');
    expect(localStorage.getItem('cc:motion')).toBe('reduced');
  });

  it("'system' removes the stored key", () => {
    mockMedia(false);
    localStorage.setItem('cc:motion', 'reduced');
    setup();
    expect(screen.getByText('reduced:true')).toBeInTheDocument();
    choose('system');
    expect(localStorage.getItem('cc:motion')).toBeNull();
    expect(document.documentElement.dataset.reducedMotion).toBe('false');
  });

  it('useMotion throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/MotionProvider/);
    spy.mockRestore();
  });
});

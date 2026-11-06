// @vitest-environment jsdom
/**
 * <RoamCourtroom> overlays over a hearing (UX-EVALUATION B4, B5): the 3D canvas
 * and the renderer are stubbed, the HUD and the controller are real.
 */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoamController } from '../controller';
import type { RoamData } from '../load';
import { ONBOARDED_STORAGE_KEY, RoamCourtroom } from '../react/RoamCourtroom';
import { roamData } from './fixtures';

vi.mock('@react-three/fiber', () => ({ Canvas: () => null, useFrame: () => undefined, useThree: () => undefined }));
vi.mock('../three/renderer', () => ({
  RoamRenderer: class {
    preset = { level: 'medium' };
    setQuality() {}
    dispose() {}
  },
}));

let data: RoamData;
beforeAll(async () => {
  data = await roamData();
});
beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const room = (c: RoamController, touch = false) => render(<RoamCourtroom controller={c} data={data} touch={touch} onExit={() => undefined} />);

describe('first-person room overlays', () => {
  it('B4: no modal over the room; a dismissible corner card that stays dismissed', () => {
    const c = new RoamController(data.world, { spawn: 'aisle' });
    const first = room(c);
    expect(screen.queryByRole('dialog')).toBeNull();
    const card = screen.getByRole('region', { name: 'Step into the courtroom' });
    expect(card).toHaveClass('ccr-onboard');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('region', { name: 'Step into the courtroom' })).toBeNull();
    expect(window.localStorage.getItem(ONBOARDED_STORAGE_KEY)).toBe('1');
    first.unmount();
    room(new RoamController(data.world, { spawn: 'aisle' }));
    expect(screen.queryByRole('region', { name: 'Step into the courtroom' })).toBeNull();
  });

  it('B4: the card never sits over a cinematic beat, and the controls legend starts closed', () => {
    const c = new RoamController(data.world, { spawn: 'aisle' });
    room(c);
    expect(screen.queryByRole('region', { name: 'Controls' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Controls' })).toHaveAttribute('aria-expanded', 'false');
    act(() => void c.runBeat('opening'));
    expect(screen.queryByRole('region', { name: 'Step into the courtroom' })).toBeNull();
    act(() => c.skipBeat());
    expect(screen.getByRole('region', { name: 'Step into the courtroom' })).toBeInTheDocument();
  });

  it('B5: on touch, no joystick or buttons during a cinematic beat; tapping the line moves it on', () => {
    const c = new RoamController(data.world, { spawn: 'aisle' });
    room(c, true);
    expect(screen.getByTestId('roam-touch')).toBeInTheDocument();
    act(() => void c.runBeat('opening'));
    expect(screen.queryByTestId('roam-touch')).toBeNull();
    // The camera turns to the first speaker, then the line starts typing.
    act(() => {
      for (let i = 0; i < 40 && !c.snapshot().dialogue; i++) c.update(1 / 30);
    });
    const log = screen.getByRole('log');
    expect(c.snapshot().dialogue!.shown).toBeLessThan(c.snapshot().dialogue!.text.length);
    act(() => fireEvent.click(log));
    expect(c.snapshot().dialogue!.shown).toBe(c.snapshot().dialogue!.text.length);
    expect(log).toHaveTextContent('tap to continue');
    act(() => c.skipBeat());
    expect(screen.getByTestId('roam-touch')).toBeInTheDocument();
  });

  it('the verdict beat offers no Skip button', () => {
    const c = new RoamController(data.world, { spawn: 'defendant' });
    room(c);
    act(() => void c.runBeat('opening'));
    expect(screen.getByRole('button', { name: 'Skip beat' })).toBeInTheDocument();
    act(() => void c.runBeat('verdict', { verdict: 'guilty' }));
    expect(screen.queryByRole('button', { name: 'Skip beat' })).toBeNull();
  });
});

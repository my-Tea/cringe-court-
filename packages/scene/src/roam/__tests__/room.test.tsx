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
import { ONBOARDED_STORAGE_KEY } from '../react/onboarding';
import { RoamCourtroom, type RoamCourtroomProps } from '../react/RoamCourtroom';
import { useRoamSnapshot } from '../react/useRoamCourtroom';
import { roamData } from './fixtures';

vi.mock('@react-three/fiber', () => ({ Canvas: () => null, useFrame: () => undefined, useThree: () => undefined }));
vi.mock('../three/renderer', () => ({
  RoamRenderer: class {
    preset = { level: 'medium' };
    setQuality() {}
    setPerspective() {}
    setAttract() {}
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

describe('the keys always come back to the room', () => {
  /** Standing at the World ID plinth, looking at it, with its station live. */
  const atShrine = () => {
    const at = data.world.interactables.find((i) => i.station === 'verify')!.at;
    const c = new RoamController(data.world, { spawn: { pos: [at[0], -30, at[2] + 60], yaw: 0, pitch: Math.atan2(at[1] - 14, 60) }, openGates: [], stations: true });
    c.update(1 / 60);
    return c;
  };
  /** A host panel like the game's: a button that takes focus, gone when the panel closes. */
  function Panel({ controller }: { controller: RoamController }) {
    const snap = useRoamSnapshot(controller);
    return snap.panel ? <button type="button">Panel button</button> : null;
  }
  const play = (c: RoamController, props: Partial<RoamCourtroomProps> = { fullscreen: true }) =>
    render(
      <RoamCourtroom controller={c} data={data} touch={false} {...props}>
        <Panel controller={c} />
      </RoamCourtroom>,
    );
  const walking = (c: RoamController) => c.keys.has('forward');

  it('closing a station panel gives focus and WASD back (the panel button is gone, focus must not fall to the page)', () => {
    const c = atShrine();
    play(c);
    const roomEl = screen.getByRole('application');
    act(() => void c.interact());
    expect(c.panel).toBe('verify');
    const button = screen.getByRole('button', { name: 'Panel button' });
    button.focus();
    act(() => c.closePanel());
    expect(screen.queryByRole('button', { name: 'Panel button' })).toBeNull();
    expect(document.activeElement).toBe(roomEl);
    fireEvent.keyDown(roomEl, { code: 'KeyW' });
    expect(walking(c)).toBe(true);
    fireEvent.keyUp(roomEl, { code: 'KeyW' });
    expect(walking(c)).toBe(false);
  });

  it('holds the player while a panel is up, then walks again', () => {
    const c = atShrine();
    play(c);
    act(() => void c.interact());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Panel button' }), { code: 'KeyW' });
    expect(walking(c)).toBe(false);
    act(() => c.closePanel());
    fireEvent.keyDown(document.activeElement!, { code: 'KeyW' });
    expect(walking(c)).toBe(true);
  });

  it('Escape closes a station panel from inside it, without pausing', () => {
    const c = atShrine();
    play(c);
    act(() => void c.interact());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Panel button' }), { key: 'Escape', code: 'Escape' });
    expect(c.panel).toBeNull();
    expect(c.paused).toBe(false);
  });

  it('a key with no focused target is the player\'s in a full-screen room, the page\'s in an embedded one', () => {
    const full = new RoamController(data.world, { spawn: 'aisle' });
    const first = play(full);
    fireEvent.keyDown(document.body, { code: 'KeyW' });
    expect(walking(full)).toBe(true);
    fireEvent.keyUp(document.body, { code: 'KeyW' });
    expect(walking(full)).toBe(false);
    first.unmount();
    const embedded = new RoamController(data.world, { spawn: 'aisle' });
    play(embedded, {});
    fireEvent.keyDown(document.body, { code: 'KeyW' });
    expect(walking(embedded)).toBe(false);
  });

  it('a clicked HUD button does not stop the walk, but keeps its own keys; a menu keeps them all', () => {
    const c = new RoamController(data.world, { spawn: 'aisle' });
    play(c);
    const controls = screen.getByRole('button', { name: 'Controls' });
    controls.focus();
    fireEvent.keyDown(controls, { code: 'KeyW' });
    expect(walking(c)).toBe(true);
    fireEvent.keyUp(controls, { code: 'KeyW' });
    const jump = vi.spyOn(c, 'jump');
    fireEvent.keyDown(controls, { code: 'Space' });
    expect(jump).not.toHaveBeenCalled();
    act(() => c.setPaused(true));
    const resume = screen.getByRole('button', { name: 'Resume' });
    fireEvent.keyDown(resume, { code: 'KeyW' });
    expect(walking(c)).toBe(false);
  });

  it('a room behind another screen takes no keys, and losing the mouse there is not a pause', () => {
    const c = new RoamController(data.world, { spawn: 'aisle' });
    const { rerender } = play(c);
    fireEvent.keyDown(screen.getByRole('application'), { code: 'KeyW' });
    fireEvent.keyUp(screen.getByRole('application'), { code: 'KeyW' });
    rerender(<RoamCourtroom controller={c} data={data} touch={false} fullscreen presentation="suspended" />);
    act(() => void document.dispatchEvent(new Event('pointerlockchange')));
    expect(c.paused).toBe(false);
    fireEvent.keyDown(document.body, { code: 'KeyW' });
    expect(walking(c)).toBe(false);
  });
});

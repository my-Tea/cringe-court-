// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RoamController } from '../controller';
import type { RoamWorld } from '../types';
import { ControlLegend, ExhibitPanel, PauseMenu, Prompt, TopBar, Dialogue } from '../react/Hud';
import { TouchControls } from '../react/TouchControls';
import { roamData } from './fixtures';

let world: RoamWorld;
afterEach(cleanup);
beforeAll(async () => {
  world = (await roamData()).world;
});

describe('roam HUD', () => {
  it('shows the focus prompt with its key, and the touch variant on phones', () => {
    const c = new RoamController(world, { spawn: { pos: [-8, 8.4, -27], yaw: 1.6, pitch: -0.7 } });
    c.update(1 / 60);
    const snap = c.snapshot();
    const { rerender } = render(<Prompt snap={snap} touch={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(/E\s*Take the stand/);
    rerender(<Prompt snap={snap} touch />);
    expect(screen.getByRole('status')).toHaveTextContent('✋');
  });

  it('control legend lists every keyboard control', () => {
    render(<ControlLegend touch={false} />);
    const legend = screen.getByRole('region', { name: 'Controls' });
    for (const k of ['W', 'A', 'S', 'D', 'Shift', 'Space', 'E', 'Esc', 'Tab', 'PgUp']) expect(legend).toHaveTextContent(k);
  });

  it('top bar has a "Skip to menu view" button and a polite live zone label', () => {
    let exited = 0;
    const c = new RoamController(world, { spawn: 'lobby' });
    render(<TopBar snap={c.snapshot()} onExit={() => exited++} onPause={() => undefined} legendOpen onToggleLegend={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip to menu view' }));
    expect(exited).toBe(1);
    expect(screen.getByText('Lobby')).toBeInTheDocument();
  });

  it('dialogue exposes the full line to screen readers while the typewriter runs', () => {
    const c = new RoamController(world);
    c.apply({ kind: 'say', speaker: 'judge', text: 'The sunglasses stay on.' });
    render(<Dialogue snap={c.snapshot()} touch={false} />);
    expect(screen.getByRole('log')).toHaveTextContent('Judge Gavel.exe');
    expect(screen.getByText('The sunglasses stay on.')).toHaveClass('ccr-sr');
  });

  it('pause menu is a modal dialog that takes focus, changes settings and resumes', () => {
    const c = new RoamController(world);
    c.setPaused(true);
    let q = 'medium';
    let restored = 0;
    const view = render(<PauseMenu snap={c.snapshot()} controller={c} touch={false} quality="medium" onQuality={(v) => (q = v)} pixelated onPixelated={() => undefined} onExit={() => undefined} restoreFocus={() => restored++} />);
    const dialog = screen.getByRole('dialog', { name: 'Court in recess' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Graphics quality'), { target: { value: 'low' } });
    expect(q).toBe('low');
    fireEvent.click(screen.getByLabelText(/Reduce motion/));
    expect(c.reducedMotion).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(c.paused).toBe(false);
    view.rerender(<PauseMenu snap={c.snapshot()} controller={c} touch={false} quality="low" onQuality={() => undefined} pixelated onPixelated={() => undefined} restoreFocus={() => restored++} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(restored).toBe(1);
  });

  it('exhibit panel shows the card and closes with Esc', () => {
    const c = new RoamController(world, { spawn: { pos: [0, 0, 20], yaw: 0, pitch: -0.9 } });
    c.update(1 / 60);
    c.interact();
    render(<ExhibitPanel snap={c.snapshot()} controller={c} restoreFocus={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Exhibit B' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Put it back' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Put it back' }), { key: 'Escape' });
    expect(c.snapshot().exhibit).toBeNull();
  });

  it('touch controls: the joystick drives movement and the hand button interacts', () => {
    const c = new RoamController(world, { spawn: 'aisle' });
    const { container } = render(<TouchControls controller={c} prompt="Sit in the gallery" />);
    const zone = container.querySelector('.ccr-stick-zone')!;
    act(() => {
      fireEvent.pointerDown(zone, { pointerId: 1, clientX: 100, clientY: 500 });
      fireEvent.pointerMove(zone, { pointerId: 1, clientX: 100, clientY: 440 });
    });
    const z = c.playerState().pos[2];
    for (let i = 0; i < 30; i++) c.update(1 / 60);
    expect(c.playerState().pos[2]).toBeLessThan(z - 5);
    act(() => {
      fireEvent.pointerUp(zone, { pointerId: 1 });
    });
    expect(screen.getByRole('button', { name: 'Interact: Sit in the gallery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
});

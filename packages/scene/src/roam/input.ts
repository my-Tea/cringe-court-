/**
 * Input mapping, renderer- and DOM-free: key codes → actions, held keys → a
 * MoveIntent plus turn rates, virtual-joystick and drag-look maths, gamepad
 * axes. The React layer only forwards raw events here.
 */
import type { MoveIntent } from './physics';

export type RoamAction = 'forward' | 'back' | 'left' | 'right' | 'turn-left' | 'turn-right' | 'look-up' | 'look-down' | 'sprint' | 'jump' | 'interact' | 'pause' | 'skip';

/**
 * Default bindings. WASD moves and strafes; arrows move and turn, so the
 * keyboard alone can steer without a mouse; PageUp/PageDown tilt the view.
 */
export const DEFAULT_BINDINGS: Readonly<Record<string, RoamAction>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'turn-left',
  ArrowRight: 'turn-right',
  KeyQ: 'turn-left',
  KeyR: 'look-up',
  KeyF: 'look-down',
  PageUp: 'look-up',
  PageDown: 'look-down',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'jump',
  KeyE: 'interact',
  Enter: 'interact',
  Escape: 'pause',
  KeyP: 'pause',
  // Not Tab: Tab must always move focus out of the room (WCAG 2.1.2, no keyboard trap).
  KeyX: 'skip',
};

/** One-shot actions fire on key-down; the rest are held. */
export const TRIGGER_ACTIONS: ReadonlySet<RoamAction> = new Set(['interact', 'pause', 'jump', 'skip']);

/** Radians per second for keyboard turning / tilting. */
export const KEY_TURN_RATE = 2.4;
export const KEY_PITCH_RATE = 1.4;
export const PITCH_LIMIT = 1.35;

export interface HeldInput {
  intent: MoveIntent;
  /** Radians per second; + turns right. */
  turn: number;
  /** Radians per second; + looks up. */
  tilt: number;
}

export class KeyState {
  readonly #held = new Set<RoamAction>();
  constructor(readonly bindings: Readonly<Record<string, RoamAction>> = DEFAULT_BINDINGS) {}

  /** Returns the action for a key-down; one-shot actions are returned only on the first press (no auto-repeat). */
  down(code: string, repeat = false): RoamAction | null {
    const a = this.bindings[code];
    if (!a) return null;
    if (TRIGGER_ACTIONS.has(a)) return repeat ? null : a;
    this.#held.add(a);
    return a;
  }

  up(code: string): void {
    const a = this.bindings[code];
    if (a) this.#held.delete(a);
  }

  /** Window blur / pointer-lock loss: drop everything so nobody keeps walking. */
  clear(): void {
    this.#held.clear();
  }

  has(a: RoamAction): boolean {
    return this.#held.has(a);
  }

  read(): HeldInput {
    const h = this.#held;
    const axis = (p: RoamAction, n: RoamAction) => (h.has(p) ? 1 : 0) - (h.has(n) ? 1 : 0);
    return {
      intent: { forward: axis('forward', 'back'), strafe: axis('right', 'left'), sprint: h.has('sprint'), jump: false },
      turn: axis('turn-right', 'turn-left') * KEY_TURN_RATE,
      tilt: axis('look-up', 'look-down') * KEY_PITCH_RATE,
    };
  }
}

/** Mouse/touch look: pixels → radians. Positive dx turns right, positive dy looks down. */
export function lookDelta(dx: number, dy: number, sensitivity = 0.0024, invertY = false): { yaw: number; pitch: number } {
  return { yaw: -dx * sensitivity, pitch: (invertY ? dy : -dy) * sensitivity };
}

export function clampPitch(p: number): number {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
}

/**
 * Virtual joystick: thumb offset from the stick origin (CSS pixels) → a
 * MoveIntent. Dead zone in the middle, full speed at the rim, sprint past it.
 */
export function joystickIntent(dx: number, dy: number, radius: number, deadZone = 0.14): MoveIntent {
  const len = Math.hypot(dx, dy);
  const r = Math.max(1, radius);
  if (len / r < deadZone) return { forward: 0, strafe: 0, sprint: false, jump: false };
  const mag = (Math.min(len / r, 1) - deadZone) / (1 - deadZone);
  return { forward: (-dy / len) * mag, strafe: (dx / len) * mag, sprint: len > r * 1.15, jump: false };
}

/** Clamp the knob drawing position to the rim. */
export function joystickKnob(dx: number, dy: number, radius: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= radius) return { x: dx, y: dy };
  return { x: (dx / len) * radius, y: (dy / len) * radius };
}

export interface GamepadLike {
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean }>;
}

const dz = (v: number, d = 0.16) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

/** Standard mapping: left stick moves, right stick looks, A jumps, X interacts, L3 sprints, Start pauses. */
export function gamepadInput(pad: GamepadLike): HeldInput & { interact: boolean; pause: boolean } {
  const ax = (i: number) => dz(pad.axes[i] ?? 0);
  const btn = (i: number) => pad.buttons[i]?.pressed ?? false;
  return {
    intent: { forward: -ax(1), strafe: ax(0), sprint: btn(10), jump: btn(0) },
    turn: ax(2) * KEY_TURN_RATE,
    tilt: -ax(3) * KEY_PITCH_RATE,
    interact: btn(2),
    pause: btn(9),
  };
}

/** Combine sources: the stronger axis wins, flags OR together. */
export function mergeIntents(...list: MoveIntent[]): MoveIntent {
  const pick = (k: 'forward' | 'strafe') => list.reduce((best, i) => (Math.abs(i[k]) > Math.abs(best) ? i[k] : best), 0);
  return { forward: pick('forward'), strafe: pick('strafe'), sprint: list.some((i) => i.sprint), jump: list.some((i) => i.jump) };
}

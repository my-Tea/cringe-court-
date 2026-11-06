import { describe, expect, it } from 'vitest';
import { BODY, FIXED_DT, FixedStepper, SolidIndex, stepBody, type BodyState } from '../physics';
import type { Aabb } from '../types';

const floor: Aabb = { min: [-100, -1, -100], max: [100, 0, 100] };
const room: Aabb = { min: [-100, -10, -100], max: [100, 100, 100] };
const fresh = (): BodyState => ({ pos: [0, 0, 0], vel: [0, 0, 0], onGround: true });

describe('movement math', () => {
  it('accelerates to walk speed along the view direction (yaw 0 = −Z) and stops with friction', () => {
    const idx = new SolidIndex([floor]);
    const b = fresh();
    for (let i = 0; i < 60; i++) stepBody(b, { forward: 1, strafe: 0, sprint: false, jump: false }, 0, idx, [room]);
    expect(b.vel[2]).toBeCloseTo(-BODY.walk, 3);
    expect(b.pos[0]).toBeCloseTo(0, 6);
    expect(b.pos[2]).toBeLessThan(-40);
    for (let i = 0; i < 30; i++) stepBody(b, { forward: 0, strafe: 0, sprint: false, jump: false }, 0, idx, [room]);
    expect(Math.hypot(b.vel[0], b.vel[2])).toBe(0);
  });

  it('strafes right to +X at yaw 0, normalises diagonals, sprints only forward', () => {
    const idx = new SolidIndex([floor]);
    const s = fresh();
    for (let i = 0; i < 60; i++) stepBody(s, { forward: 0, strafe: 1, sprint: false, jump: false }, 0, idx, [room]);
    expect(s.vel[0]).toBeCloseTo(BODY.walk, 3);
    const d = fresh();
    for (let i = 0; i < 60; i++) stepBody(d, { forward: 1, strafe: 1, sprint: false, jump: false }, 0, idx, [room]);
    expect(Math.hypot(d.vel[0], d.vel[2])).toBeCloseTo(BODY.walk, 3);
    const r = fresh();
    for (let i = 0; i < 60; i++) stepBody(r, { forward: 1, strafe: 0, sprint: true, jump: false }, 0, idx, [room]);
    expect(-r.vel[2]).toBeCloseTo(BODY.sprint, 3);
    const back = fresh();
    for (let i = 0; i < 60; i++) stepBody(back, { forward: -1, strafe: 0, sprint: true, jump: false }, 0, idx, [room]);
    expect(back.vel[2]).toBeCloseTo(BODY.walk, 3);
  });

  it('stops flush against a wall without tunnelling, even at sprint and huge dt', () => {
    const wall: Aabb = { min: [-50, 0, -20.5], max: [50, 60, -20] };
    const idx = new SolidIndex([floor, wall]);
    const b = fresh();
    for (let i = 0; i < 200; i++) stepBody(b, { forward: 1, strafe: 0, sprint: true, jump: false }, 0, idx, [room], 0.2);
    expect(b.pos[2]).toBeCloseTo(-20 + BODY.radius, 4);
  });

  it('steps up a ledge below the step height but not a taller one', () => {
    const low: Aabb = { min: [-50, 0, -90], max: [50, BODY.step - 1, -10] };
    const b = fresh();
    for (let i = 0; i < 60; i++) stepBody(b, { forward: 1, strafe: 0, sprint: false, jump: false }, 0, new SolidIndex([floor, low]), [room]);
    expect(b.pos[1]).toBeCloseTo(BODY.step - 1, 4);
    const high: Aabb = { min: [-50, 0, -90], max: [50, BODY.step + 2, -10] };
    const c = fresh();
    for (let i = 0; i < 120; i++) stepBody(c, { forward: 1, strafe: 0, sprint: false, jump: false }, 0, new SolidIndex([floor, high]), [room]);
    expect(c.pos[1]).toBe(0);
    expect(c.pos[2]).toBeCloseTo(-10 + BODY.radius, 4);
  });

  it('is frame-rate independent through the fixed stepper (same path at 30, 60 and 144 fps)', () => {
    const run = (fps: number) => {
      const idx = new SolidIndex([floor]);
      const b = fresh();
      const stepper = new FixedStepper();
      for (let t = 0; t < 2 - 1e-9; t += 1 / fps) stepper.advance(1 / fps, (h) => stepBody(b, { forward: 1, strafe: 0.5, sprint: false, jump: false }, 0.3, idx, [room], h));
      return b.pos;
    };
    const a = run(30);
    const b = run(60);
    const c = run(144);
    for (let i = 0; i < 3; i++) {
      expect(a[i]).toBeCloseTo(b[i]!, 0);
      expect(c[i]).toBeCloseTo(b[i]!, 0);
    }
  });

  it('caps catch-up steps after a long stall', () => {
    const s = new FixedStepper(FIXED_DT, 8);
    let n = 0;
    s.advance(5, () => n++);
    expect(n).toBe(8);
  });
});

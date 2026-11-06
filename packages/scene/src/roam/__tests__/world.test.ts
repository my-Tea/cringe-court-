import { beforeAll, describe, expect, it } from 'vitest';
import { isPaletteColor } from '../palette';
import { BODY, FIXED_DT, insideAny, overlaps, SolidIndex, stepBody, type BodyState } from '../physics';
import type { RoamWorld, Vec3 } from '../types';
import { ROOM_SCALE } from '../scale';
import { zoneAt } from '../world';
import { roamData } from './fixtures';

let world: RoamWorld;
let index: SolidIndex;
let bounds: RoamWorld['rooms'][number]['bounds'][];

beforeAll(async () => {
  world = (await roamData()).world;
  index = new SolidIndex(world.solids);
  bounds = world.rooms.map((r) => r.bounds);
});

const body = (p: Vec3): BodyState => ({ pos: [p[0], p[1], p[2]], vel: [0, 0, 0], onGround: true });

/** Walk toward a point with real physics; returns the body after `seconds` (or arrival). */
function walkTo(b: BodyState, x: number, z: number, seconds = 12): BodyState {
  for (let t = 0; t < seconds; t += FIXED_DT) {
    const dx = x - b.pos[0];
    const dz = z - b.pos[2];
    if (Math.hypot(dx, dz) < 1.5) break;
    stepBody(b, { forward: 1, strafe: 0, sprint: false, jump: false }, Math.atan2(-dx, -dz), index, bounds);
  }
  return b;
}

describe('roam world', () => {
  it('uses only the 30 palette swatches for every in-world box', () => {
    const off = world.boxes.filter((b) => !isPaletteColor(b.m));
    expect(off).toEqual([]);
  });

  it('has the reference set dressing: exhibits, witness stand, jury, judge, police, two counsel', () => {
    for (const id of ['exhibit-a', 'exhibit-b', 'exhibit-c', 'witness-stand', 'defendant-table', 'bench', 'street-doors', 'globe', 'bust']) {
      expect(world.interactables.some((i) => i.id === id)).toBe(true);
    }
    const roles = world.npcs.map((n) => n.role);
    for (const r of ['judge', 'prosecutor', 'defense', 'bailiff', 'juror'] as const) expect(roles).toContain(r);
    expect(roles.filter((r) => r === 'juror')).toHaveLength(3);
  });

  it('spawns and seat exits are standing room (inside the rooms, not inside furniture)', () => {
    for (const [id, s] of Object.entries(world.spawns)) {
      if (id === 'defendant' || id === 'witness') continue;
      expect(insideAny(s.pos, bounds), id).toBe(true);
      expect(overlaps(index, s.pos[0], s.pos[2], s.pos[1]), id).toBe(false);
    }
    for (const s of Object.values(world.seats)) expect(overlaps(index, s.exit[0], s.exit[2], s.exit[1]), s.id).toBe(false);
  });

  it('walks from the lobby, through the doors and down the aisle into the well', () => {
    const b = body(world.spawns.lobby.pos);
    walkTo(b, 0, 72 * ROOM_SCALE);
    expect(zoneAt(world, b.pos[0], b.pos[2])?.id).toBe('doorway');
    walkTo(b, 0, 30 * ROOM_SCALE);
    expect(zoneAt(world, b.pos[0], b.pos[2])?.id).toBe('aisle');
    walkTo(b, 0, 6 * ROOM_SCALE);
    expect(zoneAt(world, b.pos[0], b.pos[2])?.id).toBe('well');
  });

  it('climbs the dais step to stand before the bench, and reaches every seat exit on foot', () => {
    const b = body(world.spawns.well.pos);
    walkTo(b, 22 * ROOM_SCALE, 2 * ROOM_SCALE);
    walkTo(b, 22 * ROOM_SCALE, -26 * ROOM_SCALE);
    expect(b.pos[1]).toBeCloseTo(8.4, 1);
    for (const s of Object.values(world.seats)) {
      const w = body(world.spawns.aisle.pos);
      if (s.exit[2] < 15 * ROOM_SCALE) {
        walkTo(w, 0, 20 * ROOM_SCALE);
        walkTo(w, s.exit[0] > 0 ? 24 * ROOM_SCALE : -22 * ROOM_SCALE, 6 * ROOM_SCALE);
      }
      if (s.id === 'witness') walkTo(w, -22 * ROOM_SCALE, -24 * ROOM_SCALE);
      if (s.id === 'lobby-bench') {
        // Round the open door leaf, which walls the corner off below z ≈ 99.
        walkTo(w, 0, 103 * ROOM_SCALE);
        walkTo(w, s.exit[0], 103 * ROOM_SCALE);
      }
      walkTo(w, s.exit[0], s.exit[2], 20);
      expect(Math.hypot(w.pos[0] - s.exit[0], w.pos[2] - s.exit[2]), s.id).toBeLessThan(2);
    }
  });

  it('cannot walk through furniture: the evidence table, a pew, the defence desk', () => {
    // Straight at the evidence table from the gate: stops at its edge.
    const t = body([0, 0, 10 * ROOM_SCALE]);
    walkTo(t, 0, -20 * ROOM_SCALE, 4);
    expect(t.pos[2]).toBeGreaterThan(2 * ROOM_SCALE + BODY.radius - 0.01);
    // Into the side of a pew from the aisle.
    const p = body([-28 * ROOM_SCALE, 0, 40 * ROOM_SCALE]);
    walkTo(p, -70 * ROOM_SCALE, 40 * ROOM_SCALE, 4);
    expect(p.pos[0]).toBeGreaterThan(-36.5 * ROOM_SCALE);
    // Into the defence desk from the gallery side.
    const d = body([56 * ROOM_SCALE, 0, 9 * ROOM_SCALE]);
    walkTo(d, 56 * ROOM_SCALE, -40 * ROOM_SCALE, 4);
    expect(d.pos[2]).toBeGreaterThan(-13 * ROOM_SCALE);
  });

  it('cannot leave the bounded rooms: walls, locked street doors, ceiling-high barriers', () => {
    const s = ROOM_SCALE;
    const tries: Array<[Vec3, number, number]> = [
      [[0, 0, 130 * s], 0, 300 * s], // through the locked street doors
      [[60 * s, 0, 120 * s], 400 * s, 120 * s], // through the lobby side wall
      [[-10 * s, 0, 40 * s], -400 * s, 40 * s], // through the courtroom wall
      [[0, 0, 0], 0, -400 * s], // past the bench into the back wall
      [[60 * s, 0, 4 * s], 200 * s, -40 * s], // into the jury box
    ];
    for (const [start, x, z] of tries) {
      const b = body(start);
      for (let i = 0; i < 1200; i++) {
        stepBody(b, { forward: 1, strafe: 0, sprint: true, jump: i % 30 === 0 }, Math.atan2(-(x - b.pos[0]), -(z - b.pos[2])), index, bounds);
        expect(insideAny(b.pos, bounds)).toBe(true);
      }
      expect(Math.abs(b.pos[0])).toBeLessThan(91 * s);
      expect(b.pos[2]).toBeLessThan(146 * s);
      expect(b.pos[2]).toBeGreaterThan(-71 * s);
      // Never into the jury box (x > 72.5 in its z range).
      if (b.pos[2] < -10.5 * s && b.pos[2] > -70 * s) expect(b.pos[0]).toBeLessThan(72.5 * s - BODY.radius + 0.01);
    }
  });

  it('walks off the plaza, up onto the porch, and around the fountain', () => {
    const b = body(world.spawns.outside.pos);
    expect(b.pos[1]).toBeLessThan(-4);
    const fountain = world.boxes.find((box) => box.m === '#3F8FA8' && box.f[1] < 0)!;
    walkTo(b, (fountain.f[0] + fountain.t[0]) / 2, (fountain.f[2] + fountain.t[2]) / 2, 8);
    expect(Math.abs(b.pos[0])).toBeGreaterThan(14 * ROOM_SCALE);
    walkTo(b, b.pos[0], 160 * ROOM_SCALE, 20);
    expect(b.pos[1]).toBeGreaterThan(-1);
    expect(zoneAt(world, b.pos[0], b.pos[2])?.id).toBe('outside');
  });

  it('a hop is a hop: no flying, no standing on furniture', () => {
    const b = body([0, 0, 44 * ROOM_SCALE]);
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      stepBody(b, { forward: 0, strafe: 0, sprint: false, jump: true }, 0, index, bounds);
      peak = Math.max(peak, b.pos[1]);
    }
    expect(peak).toBeGreaterThan(5);
    expect(peak).toBeLessThan(BODY.step + 3);
    // Hop-spamming against a pew never lands on top of it.
    const p = body([-30 * ROOM_SCALE, 0, 38 * ROOM_SCALE]);
    let top = 0;
    for (let i = 0; i < 600; i++) {
      stepBody(p, { forward: 1, strafe: 0, sprint: false, jump: true }, Math.PI / 2, index, bounds);
      top = Math.max(top, p.pos[1]);
    }
    expect(p.pos[0]).toBeGreaterThan(-36.4 * ROOM_SCALE + BODY.radius - 0.01);
    expect(top).toBeLessThan(BODY.step + 3);
  });
});

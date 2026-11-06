import { describe, expect, it } from 'vitest';
import { IsoCamera, ISO } from '../camera';
import { DialogueError, DialogueRunner, validateTree, type DialogueTree } from '../dialogue';
import { BODY, FIXED_DT, FixedStepper, NO_MOVE, SolidIndex, clampToMap, floorHeightAt, freeAt, intentToward, isoDirection, stepBody, walkableFootprint, type MoveIntent } from '../physics';
import { CELL, buildTownMap, type TownMapSpec } from '../world';

/**
 * A 12×12 paved room with one pillar at tile (6, 6) — x,z ∈ [168, 196).
 * The pillar is well clear of every edge, so a movement test can push into it
 * from any direction without first hitting the map boundary.
 */
const ROOM = 12;
const PILLAR_TILE = 6;
const PILLAR_MIN = PILLAR_TILE * CELL;

const room: TownMapSpec = {
  id: 'square',
  name: 'Test room',
  cols: ROOM,
  rows: ROOM,
  floor: Array.from({ length: ROOM }, () => 'C'.repeat(ROOM)),
  walls: Array.from({ length: ROOM }, (_, r) => (r === PILLAR_TILE ? `${'.'.repeat(PILLAR_TILE)}#${'.'.repeat(ROOM - PILLAR_TILE - 1)}` : '.'.repeat(ROOM))),
  props: [],
  spawns: { a: { tile: [3, 3], yaw: 0 }, mid: { tile: [8, 8], yaw: 0 } },
  defaultSpawn: 'a',
};

/** An empty room, for tests that only care about speed and bounds. */
const emptyRoom: TownMapSpec = {
  ...room,
  walls: Array.from({ length: ROOM }, () => '.'.repeat(ROOM)),
};
const world = buildTownMap({ spec: room, library: {} });
const index = new SolidIndex(world.solids);
const openWorld = buildTownMap({ spec: emptyRoom, library: {} });
const openIndex = new SolidIndex(openWorld.solids);

/** A body in open floor, away from the pillar. */
const openBody = () => ({ pos: [280, 0, 280] as [number, number, number], vel: [0, 0, 0] as [number, number, number] });

const WALK_FORWARD: MoveIntent = { forward: 1, strafe: 0, run: false };
const RUN_FORWARD: MoveIntent = { forward: 1, strafe: 0, run: true };

/* ── Direction ──────────────────────────────────────────────────────────── */

describe('isoDirection', () => {
  it('maps screen-up to world −X−Z on a 2:1 camera', () => {
    const [x, z] = isoDirection(WALK_FORWARD);
    expect(x).toBeCloseTo(-Math.SQRT1_2);
    expect(z).toBeCloseTo(-Math.SQRT1_2);
  });

  it('maps screen-right to world +X−Z', () => {
    const [x, z] = isoDirection({ forward: 0, strafe: 1, run: false });
    expect(x).toBeCloseTo(Math.SQRT1_2);
    expect(z).toBeCloseTo(-Math.SQRT1_2);
  });

  it('is zero with no input', () => {
    const [x, z] = isoDirection(NO_MOVE);
    expect(x === 0).toBe(true);
    expect(z === 0).toBe(true);
  });

  it('normalises so a diagonal is not faster than a straight line', () => {
    const straight = Math.hypot(...isoDirection(WALK_FORWARD));
    const diagonal = Math.hypot(...isoDirection({ forward: 1, strafe: 1, run: false }));
    expect(straight).toBeCloseTo(1, 6);
    expect(diagonal).toBeCloseTo(1, 6);
  });

  it('clamps out-of-range intent', () => {
    const [x, z] = isoDirection({ forward: 5, strafe: 0, run: false });
    expect(Math.hypot(x, z)).toBeCloseTo(1, 6);
  });

  it('round-trips a world offset back through isoDirection', () => {
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 1], [1, 1]] as const) {
      const [x, z] = isoDirection(intentToward(dx, dz));
      const len = Math.hypot(dx, dz);
      expect(x).toBeCloseTo(dx / len, 5);
      expect(z).toBeCloseTo(dz / len, 5);
    }
  });
});

/* ── Movement ───────────────────────────────────────────────────────────── */

describe('stepBody', () => {
  it('accelerates up to walking speed and not past it', () => {
    const body = openBody();
    for (let i = 0; i < 200; i++) stepBody(body, WALK_FORWARD, openIndex, openWorld);
    expect(Math.hypot(body.vel[0], body.vel[2])).toBeCloseTo(BODY.walk, 0);
  });

  it('runs faster than it walks', () => {
    const walk = openBody();
    const run = openBody();
    for (let i = 0; i < 200; i++) {
      stepBody(walk, WALK_FORWARD, openIndex, openWorld);
      stepBody(run, RUN_FORWARD, openIndex, openWorld);
    }
    expect(Math.hypot(run.vel[0], run.vel[2])).toBeGreaterThan(Math.hypot(walk.vel[0], walk.vel[2]));
  });

  it('decelerates to rest with no input', () => {
    const body = openBody();
    for (let i = 0; i < 100; i++) stepBody(body, WALK_FORWARD, openIndex, openWorld);
    expect(Math.hypot(body.vel[0], body.vel[2])).toBeGreaterThan(10);
    for (let i = 0; i < 200; i++) stepBody(body, NO_MOVE, openIndex, openWorld);
    expect(Math.hypot(body.vel[0], body.vel[2])).toBeCloseTo(0, 3);
  });

  it('stops at the pillar instead of passing through it', () => {
    // Walk +X into the pillar's west face from clear floor.
    const body: { pos: [number, number, number]; vel: [number, number, number] } = { pos: [120, 0, 182], vel: [0, 0, 0] };
    // forward −1 + strafe 1 normalises to a pure +X push.
    const intent: MoveIntent = { forward: -1, strafe: 1, run: true };
    let blocked = false;
    for (let i = 0; i < 400; i++) blocked ||= stepBody(body, intent, index, world).blocked;
    expect(blocked).toBe(true);
    // The footprint never enters the pillar.
    expect(body.pos[0] + BODY.radius).toBeLessThanOrEqual(PILLAR_MIN + 1e-6);
  });

  it('slides along an obstacle rather than sticking to it', () => {
    // Push diagonally into the pillar's south-west corner.
    const body: { pos: [number, number, number]; vel: [number, number, number] } = { pos: [140, 0, 200], vel: [0, 0, 0] };
    const startZ = body.pos[2];
    // forward+right on this camera moves toward −Z: into the pillar for x, past it for z.
    const intent: MoveIntent = { forward: 1, strafe: 1, run: false };
    for (let i = 0; i < 300; i++) stepBody(body, intent, index, world);
    // It made progress along at least one axis; a wedged body would freeze.
    expect(Math.abs(body.pos[2] - startZ) + Math.abs(body.pos[0] - 140)).toBeGreaterThan(5);
  });

  it('cannot be pushed out of the map', () => {
    const body: { pos: [number, number, number]; vel: [number, number, number] } = { pos: [70, 0, 70], vel: [0, 0, 0] };
    for (let i = 0; i < 600; i++) {
      stepBody(body, WALK_FORWARD, index, world);
      body.pos = [...clampToMap(world, body.pos)] as [number, number, number];
    }
    expect(body.pos[0]).toBeGreaterThan(0);
    expect(body.pos[2]).toBeGreaterThan(0);
    expect(body.pos[0]).toBeLessThan(world.cols * CELL);
    expect(body.pos[2]).toBeLessThan(world.rows * CELL);
  });

  it('never leaves the footprint on unwalkable ground', () => {
    const body: { pos: [number, number, number]; vel: [number, number, number] } = { pos: [70, 0, 70], vel: [0, 0, 0] };
    const dirs: MoveIntent[] = [
      { forward: 1, strafe: 0, run: true },
      { forward: -1, strafe: 0, run: true },
      { forward: 0, strafe: 1, run: true },
      { forward: 0, strafe: -1, run: true },
      { forward: 1, strafe: 1, run: true },
      { forward: -1, strafe: -1, run: true },
    ];
    for (const intent of dirs) {
      for (let i = 0; i < 120; i++) {
        stepBody(body, intent, index, world);
        expect(walkableFootprint(world, body.pos[0], body.pos[2])).toBe(true);
      }
    }
  });
});

describe('SolidIndex', () => {
  it('finds the pillar where it actually is', () => {
    const hits = index.query(PILLAR_MIN + 5, PILLAR_MIN + 5, PILLAR_MIN + 6, PILLAR_MIN + 6);
    expect(hits.some((s) => s.max[1] > BODY.step)).toBe(true);
  });

  it('finds nothing in open floor', () => {
    expect(index.query(10, 10, 11, 11).filter((s) => s.max[1] > BODY.step)).toHaveLength(0);
  });

  it('does not report the same solid twice', () => {
    const hits = index.query(0, 0, 400, 400);
    expect(new Set(hits).size).toBe(hits.length);
  });

  it('freeAt distinguishes open floor from the pillar', () => {
    expect(freeAt(index, 300, 300)).toBe(true);
    expect(freeAt(index, PILLAR_MIN + CELL / 2, PILLAR_MIN + CELL / 2)).toBe(false);
  });
});

describe('floorHeightAt', () => {
  it('is 0 on open floor', () => {
    expect(floorHeightAt(index, 300, 300)).toBe(0);
  });
});

describe('FixedStepper', () => {
  it('runs whole steps only', () => {
    const s = new FixedStepper();
    let n = 0;
    s.advance(FIXED_DT * 3.5, () => n++);
    expect(n).toBe(3);
  });

  it('caps catch-up so a stall cannot tunnel the player', () => {
    const s = new FixedStepper(FIXED_DT, 8);
    let n = 0;
    s.advance(10, () => n++);
    expect(n).toBe(8);
  });

  it('is frame-rate independent over the same elapsed time', () => {
    const a = new FixedStepper();
    const b = new FixedStepper();
    let na = 0;
    let nb = 0;
    for (let i = 0; i < 60; i++) a.advance(FIXED_DT, () => na++);
    for (let i = 0; i < 30; i++) b.advance(FIXED_DT * 2, () => nb++);
    expect(na).toBe(nb);
  });
});

/* ── Camera ─────────────────────────────────────────────────────────────── */

describe('IsoCamera', () => {
  const centre = world.cols * CELL * 0.5;

  it('sits on the iso rake above and behind the target', () => {
    const cam = new IsoCamera();
    cam.bind(world, [centre, 0, centre]);
    const [x, y, z] = cam.position();
    expect(y).toBeGreaterThan(cam.target.y);
    expect(x).toBeGreaterThan(cam.target.x);
    expect(z).toBeGreaterThan(cam.target.z);
    // 30° above horizontal: height = sin(30°) × distance.
    expect(y - cam.target.y).toBeCloseTo(Math.sin(ISO.pitch) * ISO.distance, 5);
  });

  it('eases toward the player instead of snapping', () => {
    const cam = new IsoCamera();
    cam.bind(world, [60, 0, 60]);
    cam.follow(centre, centre);
    const before = cam.target.x;
    cam.update(1 / 60);
    expect(cam.target.x).toBeGreaterThan(before);
    expect(cam.target.x).toBeLessThan(centre);
    for (let i = 0; i < 400; i++) cam.update(1 / 60);
    expect(cam.target.x).toBeCloseTo(centre, 0);
  });

  it('snaps on demand without easing', () => {
    const cam = new IsoCamera();
    cam.bind(world, [60, 0, 60]);
    cam.snapTo(centre, centre);
    expect(cam.target.x).toBeCloseTo(centre, 5);
  });

  it('is frame-rate independent', () => {
    const a = new IsoCamera();
    const b = new IsoCamera();
    a.bind(world, [60, 0, 60]);
    b.bind(world, [60, 0, 60]);
    a.follow(200, 200);
    b.follow(200, 200);
    for (let i = 0; i < 60; i++) a.update(1 / 60);
    for (let i = 0; i < 30; i++) b.update(2 / 60);
    expect(a.target.x).toBeCloseTo(b.target.x, 2);
  });

  it('clamps the view inside the map', () => {
    const cam = new IsoCamera();
    cam.bind(world, [centre, 0, centre]);
    cam.follow(-5000, -5000);
    for (let i = 0; i < 400; i++) cam.update(1 / 60);
    expect(cam.target.x).toBeGreaterThanOrEqual(0);
    expect(cam.target.z).toBeGreaterThanOrEqual(0);
    cam.follow(5000, 5000);
    for (let i = 0; i < 400; i++) cam.update(1 / 60);
    expect(cam.target.x).toBeLessThanOrEqual(world.cols * CELL);
    expect(cam.target.z).toBeLessThanOrEqual(world.rows * CELL);
  });
});

/* ── Dialogue ───────────────────────────────────────────────────────────── */

const tree: DialogueTree = {
  start: 'a',
  nodes: {
    a: {
      speaker: 'vera',
      text: 'Hello.',
      choices: [
        { text: 'Ask more', next: 'b' },
        { text: 'Leave', next: null },
      ],
    },
    b: { speaker: 'vera', text: 'More.', next: 'c' },
    c: { speaker: 'vera', text: 'Bye.' },
  },
};

describe('dialogue', () => {
  it('starts at the start node', () => {
    const r = new DialogueRunner(tree);
    expect(r.view().nodeId).toBe('a');
    expect(r.view().choices).toHaveLength(2);
  });

  it('requires a choice when the node offers choices', () => {
    const r = new DialogueRunner(tree);
    expect(r.view().canContinue).toBe(false);
    expect(r.advance()).toBe(false);
    expect(r.choose(0)).toBe(true);
    expect(r.view().nodeId).toBe('b');
  });

  it('continues through a plain node', () => {
    const r = new DialogueRunner(tree, 'b');
    expect(r.view().canContinue).toBe(true);
    expect(r.advance()).toBe(true);
    expect(r.view().nodeId).toBe('c');
  });

  it('a terminal node has nothing to advance to', () => {
    const r = new DialogueRunner(tree, 'c');
    expect(r.view().canContinue).toBe(false);
    // 'continue' on a terminal node consumes the input and ends the conversation.
    expect(r.advance()).toBe(true);
    expect(r.done).toBe(true);
    expect(r.view().node).toBeNull();
  });

  it('ends on a choice pointing at null', () => {
    const r = new DialogueRunner(tree);
    r.choose(1);
    expect(r.done).toBe(true);
  });

  it('ignores an out-of-range choice', () => {
    const r = new DialogueRunner(tree);
    expect(r.choose(9)).toBe(false);
    expect(r.view().nodeId).toBe('a');
  });

  it('validates every reference', () => {
    expect(() => validateTree({ start: 'a', nodes: { a: { speaker: 'x', text: 't', next: 'nope' } } } as DialogueTree)).toThrow(DialogueError);
    expect(() => validateTree({ start: 'zz', nodes: { a: { speaker: 'x', text: 't' } } } as DialogueTree)).toThrow(/does not exist/);
    expect(() => validateTree({ start: 'a', nodes: { a: { speaker: 'x', text: '' } } } as DialogueTree)).toThrow(/no text/);
    expect(() =>
      validateTree({ start: 'a', nodes: { a: { speaker: 'x', text: 't', choices: [{ text: 'go', next: 'zz' }] } } } as DialogueTree),
    ).toThrow(/missing node/);
  });

  it('rejects an empty choices array (omit it instead)', () => {
    expect(() => validateTree({ start: 'a', nodes: { a: { speaker: 'x', text: 't', choices: [] } } } as DialogueTree)).toThrow(/empty choices/);
  });

  it('does not mutate the shared tree', () => {
    const r1 = new DialogueRunner(tree);
    const r2 = new DialogueRunner(tree);
    r1.choose(0);
    expect(r2.view().nodeId).toBe('a');
  });
});

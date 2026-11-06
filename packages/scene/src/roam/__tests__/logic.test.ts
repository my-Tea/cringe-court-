import type { AudioCueId } from '@cringe-court/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { audioFromEngine, detectAudio } from '../audio';
import { BeatRunner, beatScript, type BeatHost } from '../beats';
import { BarkBook } from '../dialogue';
import { DEFAULT_BINDINGS, gamepadInput, joystickIntent, joystickKnob, KeyState, lookDelta, mergeIntents, clampPitch, PITCH_LIMIT } from '../input';
import { lookDir, rayAabb, selectFocus } from '../interact';
import { headTarget, HEAD_YAW_MAX } from '../npc';
import { AutoQuality, lowerQuality, QUALITY } from '../quality';
import { MockRemotePlayers, RemoteInterpolator, DEMO_WALKERS } from '../remote';
import { BODY, SolidIndex, overlaps } from '../physics';
import type { BeatStep, InteractableSpec, PlayerState, RoamWorld } from '../types';
import { roamData } from './fixtures';

let world: RoamWorld;
beforeAll(async () => {
  world = (await roamData()).world;
});

describe('interaction focus', () => {
  const items: InteractableSpec[] = [
    { id: 'near', prompt: 'Near', kind: 'inspect', at: [0, 10, -10], hull: { min: [-2, 8, -12], max: [2, 12, -8] }, range: 30 },
    { id: 'far', prompt: 'Far', kind: 'inspect', at: [0, 10, -25], hull: { min: [-2, 8, -27], max: [2, 12, -23] }, range: 30 },
    { id: 'side', prompt: 'Side', kind: 'inspect', at: [6, 10, -20], hull: { min: [5, 8, -21], max: [7, 12, -19] }, range: 30 },
    { id: 'out', prompt: 'Out of range', kind: 'inspect', at: [0, 10, -80], hull: { min: [-5, 0, -85], max: [5, 20, -75] }, range: 30 },
  ];
  const eye = [0, 10, 0] as const;

  it('ray hits win, nearest first', () => {
    expect(selectFocus(eye, lookDir(0, 0), items)).toMatchObject({ id: 'near', via: 'ray' });
    expect(selectFocus(eye, lookDir(0, 0), items, (i) => i.id !== 'near')).toMatchObject({ id: 'far', via: 'ray' });
  });

  it('falls back to the best-aligned item inside the cone, and nothing outside range or cone', () => {
    // Looking slightly right of "side": the ray misses its thin hull, the cone catches it.
    const yaw = -Math.atan2(6, 20) - 0.12;
    expect(selectFocus(eye, lookDir(yaw, 0), items, (i) => i.id === 'side')).toMatchObject({ id: 'side', via: 'cone' });
    expect(selectFocus(eye, lookDir(Math.PI, 0), items)).toBeNull();
    expect(selectFocus([0, 10, -50], lookDir(0, 0), items, (i) => i.id === 'out')?.id).toBe('out');
    expect(selectFocus([0, 10, 0], lookDir(0, 0), items, (i) => i.id === 'out')).toBeNull();
  });

  it('slab test handles axis-parallel rays and misses', () => {
    expect(rayAabb([0, 0, 0], [1, 0, 0], { min: [5, -1, -1], max: [6, 1, 1] })).toBeCloseTo(5);
    expect(rayAabb([0, 5, 0], [1, 0, 0], { min: [5, -1, -1], max: [6, 1, 1] })).toBeNull();
    expect(rayAabb([0, 0, 0], [-1, 0, 0], { min: [5, -1, -1], max: [6, 1, 1] })).toBeNull();
  });

  it('in the real room: facing the stand from the dais step focuses "Take the stand"; facing the exhibits focuses Exhibit B', () => {
    const fromStep = [-8, 8.4 + BODY.eye, -27] as const;
    const at = world.interactables.find((i) => i.id === 'witness-stand')!.at;
    const toStand = Math.atan2(-(at[0] - fromStep[0]), -(at[2] - fromStep[2]));
    const down = Math.atan2(at[1] - fromStep[1], Math.hypot(at[0] - fromStep[0], at[2] - fromStep[2]));
    expect(selectFocus(fromStep, lookDir(toStand, down), world.interactables)?.id).toBe('witness-stand');
    const b = world.interactables.find((i) => i.id === 'exhibit-b')!.at;
    const eye = [0, BODY.eye, 20] as const;
    expect(selectFocus(eye, lookDir(0, Math.atan2(b[1] - eye[1], eye[2] - b[2])), world.interactables)?.id).toBe('exhibit-b');
  });
});

describe('NPC attention', () => {
  it('turns toward a player in front, clamps the neck, ignores players behind or far away', () => {
    const npc = { pos: [0, 0, 0] as const, yaw: 0 };
    const head = [0, 40, 0] as const;
    const ahead = headTarget(npc, head, [0, 40, -20])!;
    expect(ahead.yaw).toBeCloseTo(0);
    expect(ahead.pitch).toBeCloseTo(0);
    expect(headTarget(npc, head, [-20, 40, -20])!.yaw).toBeCloseTo(Math.PI / 4);
    expect(headTarget(npc, head, [-30, 40, -1])!.yaw).toBeCloseTo(HEAD_YAW_MAX);
    expect(headTarget(npc, head, [0, 40, 30])).toBeNull();
    expect(headTarget(npc, head, [0, 40, -500])).toBeNull();
  });
});

describe('controller input mapping', () => {
  it('maps WASD and arrows: W/↑ forward, A/D strafe, ←/→ turn; trigger keys fire once (no auto-repeat)', () => {
    const k = new KeyState();
    k.down('KeyW');
    k.down('KeyD');
    expect(k.read().intent).toMatchObject({ forward: 1, strafe: 1, sprint: false });
    k.down('ShiftLeft');
    expect(k.read().intent.sprint).toBe(true);
    k.up('KeyW');
    k.down('ArrowDown');
    expect(k.read().intent.forward).toBe(-1);
    k.down('ArrowLeft');
    expect(k.read().turn).toBeLessThan(0);
    k.down('PageUp');
    expect(k.read().tilt).toBeGreaterThan(0);
    expect(k.down('KeyE')).toBe('interact');
    expect(k.down('KeyE', true)).toBeNull();
    expect(k.down('Escape')).toBe('pause');
    expect(k.down('KeyZ')).toBeNull();
    k.clear();
    expect(k.read().intent).toMatchObject({ forward: 0, strafe: 0 });
    expect(DEFAULT_BINDINGS.ArrowUp).toBe('forward');
  });

  it('virtual joystick: dead zone, full speed at the rim, sprint past it; knob clamps to the ring', () => {
    expect(joystickIntent(3, 3, 50)).toMatchObject({ forward: 0, strafe: 0 });
    const up = joystickIntent(0, -50, 50);
    expect(up.forward).toBeCloseTo(1);
    expect(up.strafe).toBeCloseTo(0);
    expect(up.sprint).toBe(false);
    expect(joystickIntent(0, -80, 50)).toMatchObject({ sprint: true });
    const half = joystickIntent(25, 0, 50);
    expect(half.strafe).toBeGreaterThan(0.3);
    expect(half.strafe).toBeLessThan(0.6);
    expect(joystickKnob(0, 100, 50)).toEqual({ x: 0, y: 50 });
  });

  it('drag/mouse look: right turns right (yaw decreases), down looks down; pitch clamps', () => {
    const d = lookDelta(10, 10);
    expect(d.yaw).toBeLessThan(0);
    expect(d.pitch).toBeLessThan(0);
    expect(clampPitch(5)).toBe(PITCH_LIMIT);
  });

  it('gamepad: left stick moves with a dead zone, right stick looks, A hops, X interacts', () => {
    const pad = { axes: [0.05, -1, 0.5, 0], buttons: Array.from({ length: 12 }, (_, i) => ({ pressed: i === 0 || i === 2 })) };
    const g = gamepadInput(pad);
    expect(g.intent.forward).toBeCloseTo(1);
    expect(g.intent.strafe).toBe(0);
    expect(g.intent.jump).toBe(true);
    expect(g.interact).toBe(true);
    expect(g.turn).toBeGreaterThan(0);
    expect(mergeIntents({ forward: 0.2, strafe: 0, sprint: false, jump: false }, { forward: -0.9, strafe: 0.1, sprint: true, jump: false })).toEqual({ forward: -0.9, strafe: 0.1, sprint: true, jump: false });
  });
});

describe('beat runner', () => {
  function host() {
    const applied: BeatStep[] = [];
    let busy = 0;
    const h: BeatHost & { applied: BeatStep[]; finishLine: () => void } = {
      applied,
      apply: (s) => {
        applied.push(s);
        if (s.kind === 'say') busy = 1;
      },
      dialogueBusy: () => busy > 0,
      clearDialogue: () => (busy = 0),
      finishLine: () => (busy = 0),
    };
    return h;
  }

  it('runs instant steps in one frame, waits for timed steps and for each line to finish', () => {
    const h = host();
    const r = new BeatRunner('opening', [{ kind: 'control', mode: 'cinematic' }, { kind: 'mood', mood: 'spotlight' }, { kind: 'wait', seconds: 1 }, { kind: 'say', speaker: 'judge', text: 'Hi' }, { kind: 'control', mode: 'look' }], h);
    r.start();
    expect(r.advance(0.016)).toBe(false);
    expect(h.applied.map((s) => s.kind)).toEqual(['control', 'mood', 'wait']);
    r.advance(0.5);
    expect(h.applied).toHaveLength(3);
    r.advance(0.6);
    expect(h.applied.map((s) => s.kind)).toEqual(['control', 'mood', 'wait', 'say']);
    expect(r.advance(5)).toBe(false); // still talking
    h.finishLine();
    expect(r.advance(0.016)).toBe(true);
    expect(r.state).toBe('done');
    expect(h.applied.at(-1)).toEqual({ kind: 'control', mode: 'look' });
  });

  it('skip lands in the final state without lines, waits, sounds or callouts', () => {
    const h = host();
    const steps = beatScript('verdict', { verdict: 'mistrial' });
    const r = new BeatRunner('verdict', steps, h);
    r.start();
    r.skip();
    expect(r.state).toBe('skipped');
    const kinds = h.applied.slice(1).map((s) => s.kind);
    expect(kinds).not.toContain('say');
    expect(kinds).not.toContain('cue');
    expect(h.applied).toContainEqual({ kind: 'mood', mood: 'mistrial' });
    expect(h.applied.at(-1)).toEqual({ kind: 'control', mode: 'look' });
  });

  it('every beat seats the defendant, owns the camera, and hands control back', () => {
    for (const id of ['all-rise', 'opening', 'counsel-arguing', 'jury-deliberating', 'verdict'] as const) {
      const s = beatScript(id);
      expect(s[0]).toEqual({ kind: 'control', mode: 'cinematic' });
      expect(s).toContainEqual({ kind: 'seat', seat: 'defendant' });
      expect(s.at(-1)).toEqual({ kind: 'control', mode: 'look' });
    }
    expect(beatScript('counsel-arguing').some((s) => s.kind === 'gavel')).toBe(true);
    expect(beatScript('verdict', { verdictText: 'SIDE B WINS', verdict: 'side-b' })).toContainEqual({ kind: 'callout', text: 'SIDE B WINS', style: 'verdict' });
  });

  it('mode-supplied lines replace the built-ins, with a look at each new speaker', () => {
    const s = beatScript('opening', { lines: [{ speaker: 'prosecutor', text: 'AI line 1' }, { speaker: 'prosecutor', text: 'AI line 2' }, { speaker: 'defense', text: 'AI line 3' }] });
    const says = s.filter((x) => x.kind === 'say').map((x) => (x as { text: string }).text);
    expect(says).toEqual(['AI line 1', 'AI line 2', 'AI line 3']);
    expect(s.filter((x) => x.kind === 'look')).toHaveLength(2);
  });
});

describe('remote players', () => {
  const sample = (t: number, x: number): PlayerState => ({ id: 'r', avatar: { model: 'side-a', name: 'A' }, role: 'side-a', pos: [x, 0, 0], yaw: 0, pitch: 0, seat: null, speed: 10, t });

  it('interpolates between samples, a fixed delay behind, never extrapolating', () => {
    const i = new RemoteInterpolator();
    i.push([sample(0, 0)]);
    i.push([sample(100, 10)]);
    expect(i.sample(170, 120)[0]!.pos[0]).toBeCloseTo(5);
    expect(i.sample(1000, 120)[0]!.pos[0]).toBe(10);
    expect(i.sample(50, 120)[0]!.pos[0]).toBe(0);
    i.push([sample(50, 99)]); // out of order: dropped
    expect(i.sample(220, 120)[0]!.pos[0]).toBe(10);
    i.remove('r');
    expect(i.size).toBe(0);
  });

  it('the mock feed publishes at its interval and its walkers stay on walkable ground', () => {
    const feed = new MockRemotePlayers(DEMO_WALKERS, 0.1);
    const got: number[] = [];
    feed.subscribe((s) => got.push(s.length));
    for (let k = 0; k < 60; k++) feed.tick(1 / 60, k * 16.7);
    expect(got.length).toBeGreaterThanOrEqual(9);
    expect(got.every((n) => n === DEMO_WALKERS.length)).toBe(true);
    const idx = new SolidIndex(world.solids);
    for (const w of DEMO_WALKERS) {
      for (let k = 0; k < w.path.length; k++) {
        const a = w.path[k]!;
        const b = w.path[(k + 1) % w.path.length]!;
        for (let t = 0; t <= 1; t += 0.05) {
          const x = a[0] + (b[0] - a[0]) * t;
          const z = a[2] + (b[2] - a[2]) * t;
          expect(overlaps(idx, x, z, 0, 4), `${w.id} at ${x},${z}`).toBe(false);
        }
      }
    }
  });
});

describe('quality', () => {
  it('presets cap DPR, shadow budget and lights; low has no shadows', () => {
    expect(QUALITY.low.shadowMap).toBe(0);
    expect(QUALITY.high.shadowMap).toBeGreaterThan(QUALITY.medium.shadowMap);
    expect(QUALITY.low.pixelHeight).toBeLessThan(QUALITY.high.pixelHeight);
    expect(lowerQuality('low')).toBeNull();
  });

  it('auto-downgrades after sustained slow frames, ignores warm-up and tab-switch spikes, never upgrades', () => {
    const a = new AutoQuality('high', { warmup: 1, window: 2 });
    let next = null;
    for (let i = 0; i < 60; i++) next = a.sample(1 / 30) ?? next;
    expect(next).toBeNull(); // still warming up / within the window
    for (let i = 0; i < 90 && !next; i++) next = a.sample(1 / 30);
    expect(next).toBe('medium');
    expect(a.sample(5)).toBeNull();
    const fast = new AutoQuality('medium', { warmup: 0.1, window: 1 });
    for (let i = 0; i < 600; i++) expect(fast.sample(1 / 60)).toBeNull();
  });
});

describe('dialogue and audio', () => {
  it('barks cycle without repeats until the pool wraps', () => {
    const b = new BarkBook({ p: ['a', 'b'] });
    expect([b.next('p'), b.next('p'), b.next('p')]).toEqual(['a', 'b', 'a']);
    expect(b.next('missing')).toBeNull();
  });

  it('audio is feature-detected: core ports pass through, engines get mapped ids, junk is ignored', () => {
    const port = { id: 'silent', play: vi.fn() };
    expect(detectAudio(port)).toBe(port);
    const engine = { play: vi.fn() };
    detectAudio(engine)!.play('sfx.gavel' as AudioCueId, { volume: 0.5 });
    expect(engine.play).toHaveBeenCalledWith('gavel_strike', { intensity: 0.5 });
    audioFromEngine(engine).play('voice.judge' as AudioCueId);
    expect(engine.play).toHaveBeenCalledTimes(1);
    expect(detectAudio(null)).toBeNull();
    expect(detectAudio({ play: 1 })).toBeNull();
  });
});

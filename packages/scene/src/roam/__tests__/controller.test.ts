import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RoamController } from '../controller';
import { ROOM_SCALE } from '../scale';
import { MockRemotePlayers } from '../remote';
import type { RoamEvent, RoamWorld } from '../types';
import { roamData } from './fixtures';

let world: RoamWorld;
beforeAll(async () => {
  world = (await roamData()).world;
});

const run = (c: RoamController, seconds: number, dt = 1 / 60) => {
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) c.update(dt);
};

/** Fast-forward a beat by finishing every line as it appears. */
async function playThrough(c: RoamController, p: Promise<void>) {
  let done = false;
  void p.then(() => (done = true));
  for (let i = 0; i < 4000 && !done; i++) {
    c.update(1 / 30);
    c.advanceDialogue();
    c.advanceDialogue();
    await Promise.resolve();
  }
  return done;
}

describe('RoamController', () => {
  it('walks with held keys at a fixed timestep, independent of frame rate', () => {
    const a = new RoamController(world, { spawn: 'aisle' });
    const b = new RoamController(world, { spawn: 'aisle' });
    a.keyDown('KeyW');
    b.keyDown('KeyW');
    run(a, 0.5, 1 / 30);
    run(b, 0.5, 1 / 144);
    expect(a.playerState().pos[2]).toBeCloseTo(b.playerState().pos[2], 0);
    expect(a.playerState().pos[2]).toBeLessThan(world.spawns.aisle.pos[2] - 20);
  });

  it('interacts: E on the stand seats you there; moving or E stands you up at the exit', () => {
    const at = world.interactables.find((i) => i.id === 'witness-stand')!.at;
    const eye = [-8 * ROOM_SCALE, 8.4 + 44, -27 * ROOM_SCALE] as const;
    const c = new RoamController(world, {
      spawn: { pos: [-8 * ROOM_SCALE, 8.4, -27 * ROOM_SCALE], yaw: Math.atan2(-(at[0] - eye[0]), -(at[2] - eye[2])), pitch: Math.atan2(at[1] - eye[1], Math.hypot(at[0] - eye[0], at[2] - eye[2])) },
    });
    const events: RoamEvent[] = [];
    c.subscribe((e) => events.push(e));
    c.update(1 / 60);
    expect(c.snapshot().focus?.prompt).toBe('Take the stand');
    c.keyDown('KeyE');
    expect(c.seat).toBe('witness');
    expect(c.snapshot().focus).toEqual({ id: 'stand', prompt: 'Stand up' });
    expect(c.snapshot().zone).toBe('witness-stand');
    c.keyDown('KeyW');
    expect(c.seat).toBeNull();
    expect(c.control).toBe('free');
    expect(events.some((e) => e.type === 'seat' && e.seat === 'witness')).toBe(true);
  });

  it('exhibits open a panel (movement frozen) and close with E or Esc', () => {
    const b = world.interactables.find((i) => i.id === 'exhibit-b')!.at;
    const c = new RoamController(world, { spawn: { pos: [0, 0, 20 * ROOM_SCALE], yaw: 0, pitch: Math.atan2(b[1] - 44, 20 * ROOM_SCALE - b[2]) } });
    c.update(1 / 60);
    expect(c.snapshot().focus?.prompt).toBe('Inspect Exhibit B');
    c.interact();
    expect(c.snapshot().exhibit).toBe('exhibit-b');
    const z = c.playerState().pos[2];
    c.keyDown('KeyW');
    run(c, 0.5);
    expect(c.playerState().pos[2]).toBe(z);
    c.keyDown('Escape');
    expect(c.snapshot().exhibit).toBeNull();
    expect(c.paused).toBe(false);
  });

  it('arrival run: a station opens its panel and holds the player; seals block the bridge until opened', () => {
    const verify = world.interactables.find((i) => i.station === 'verify')!;
    const at = verify.at;
    const from: [number, number, number] = [at[0], -30, at[2] + 60];
    const c = new RoamController(world, { spawn: { pos: from, yaw: 0, pitch: Math.atan2(at[1] - (from[1] + 44), 60) }, openGates: [] });
    const events: RoamEvent[] = [];
    c.subscribe((e) => events.push(e));
    expect(c.openGates).toEqual([]);
    c.update(1 / 60);
    expect(c.snapshot().focus?.id).toBe('station:verify');
    c.interact();
    expect(c.snapshot().panel).toBe('verify');
    expect(events).toContainEqual({ type: 'station', station: 'verify' });
    const z = c.playerState().pos[2];
    c.keyDown('KeyW');
    run(c, 0.5);
    expect(c.playerState().pos[2]).toBe(z);
    c.keyUp('KeyW');
    // Esc closes the panel (it does not pause).
    c.keyDown('Escape');
    expect(c.snapshot().panel).toBeNull();
    expect(c.paused).toBe(false);

    // The verify seal sits on the bridge north of the shrine: walk at it, stop; open it, walk through.
    const seal = world.gates!.find((g) => g.id === 'verify')!.solid;
    const sealZ = (seal.min[2] + seal.max[2]) / 2;
    c.teleport({ pos: [0, -30, seal.max[2] + 40], yaw: 0, pitch: 0 });
    c.keyDown('KeyW');
    run(c, 3);
    expect(c.playerState().pos[2]).toBeGreaterThan(seal.max[2]);
    c.openGate('verify');
    expect(c.isGateOpen('verify')).toBe(true);
    expect(events).toContainEqual({ type: 'gate', gate: 'verify' });
    run(c, 3);
    expect(c.playerState().pos[2]).toBeLessThan(sealZ - 20);
  });

  it('a new avatar look is announced and becomes the player\'s avatar', () => {
    const c = new RoamController(world, { spawn: 'arrival' });
    const seen: RoamEvent[] = [];
    c.subscribe((e) => seen.push(e));
    const look = { skin: 2, hair: 'bun', hairColor: 1, outfit: 'robe', outfitColor: 7, accessory: 'crown', effect: 'halo' };
    c.setAvatar({ ...c.avatar, look });
    expect(c.playerState().avatar.look).toEqual(look);
    expect(seen.some((e) => e.type === 'avatar')).toBe(true);
    // Worlds entered past the run have every seal open by default.
    expect(c.openGates.slice().sort()).toEqual(['trials', 'verify', 'wardrobe']);
  });

  it('runs a beat: auto-seats at the defendant table, locks the camera on the speaker, then returns control', async () => {
    const audio = { id: 'recording', play: vi.fn() };
    const c = new RoamController(world, { spawn: 'lobby', audio });
    const events: RoamEvent[] = [];
    c.subscribe((e) => events.push(e));
    const p = c.runBeat('counsel-arguing');
    expect(c.seat).toBe('defendant');
    expect(c.control).toBe('cinematic');
    // Mouse look is ignored while the beat owns the camera.
    const yaw0 = c.view().yaw;
    c.look(1, 0);
    expect(c.view().yaw).toBe(yaw0);
    run(c, 1.5);
    // Looking at the prosecutor (first speaker).
    const v = c.view();
    const m = world.marks.prosecutor!;
    const want = Math.atan2(-(m[0] - v.eye[0]), -(m[2] - v.eye[2]));
    expect(Math.abs(Math.atan2(Math.sin(v.yaw - want), Math.cos(v.yaw - want)))).toBeLessThan(0.08);
    expect(await playThrough(c, p)).toBe(true);
    expect(c.control).toBe('look');
    expect(c.seat).toBe('defendant');
    expect(events.filter((e) => e.type === 'gavel')).toHaveLength(1);
    expect(events.some((e) => e.type === 'callout' && e.style === 'objection')).toBe(true);
    expect(audio.play).toHaveBeenCalledWith('sfx.gavel', undefined);
    expect(events.find((e) => e.type === 'beat-end')).toMatchObject({ type: 'beat-end', beat: 'counsel-arguing', skipped: false });
  });

  it('verdict: jurors react and the player keeps free look', async () => {
    const c = new RoamController(world, { spawn: 'well' });
    expect(await playThrough(c, c.runBeat('verdict', { verdict: 'not-cooked' }))).toBe(true);
    expect(c.control).toBe('look');
    expect(c.mood).toBe('acquitted');
    expect(c.npcStates.filter((n) => n.id.startsWith('juror')).every((n) => n.pose === 'cheer')).toBe(true);
    const yaw = c.view().yaw;
    c.look(-1, 0);
    expect(c.view().yaw).toBeCloseTo(yaw - 1);
  });

  it('skipping or replacing a beat resolves its promise', async () => {
    const c = new RoamController(world);
    const p = c.runBeat('opening');
    c.skipBeat();
    await expect(p).resolves.toBeUndefined();
    const q = c.runBeat('all-rise');
    const r = c.runBeat('verdict');
    await expect(q).resolves.toBeUndefined();
    c.skipBeat();
    await expect(r).resolves.toBeUndefined();
    expect(c.mood).toBe('guilty');
  });

  it('gavel: screen shake normally; zero shake and zero head-bob with reduced motion; dialogue shown at once', () => {
    const c = new RoamController(world, { spawn: 'aisle' });
    c.apply({ kind: 'gavel' });
    expect(c.snapshot().shake).toBeGreaterThan(0.5);
    c.keyDown('KeyW');
    run(c, 0.6);
    expect(Math.abs(c.snapshot().bob) + Math.abs(c.view().shakeYaw)).toBeGreaterThan(0);

    const r = new RoamController(world, { spawn: 'aisle', reducedMotion: true });
    r.apply({ kind: 'gavel' });
    r.keyDown('KeyW');
    for (let i = 0; i < 40; i++) {
      r.update(1 / 60);
      expect(r.snapshot().bob).toBe(0);
      expect(r.snapshot().shake).toBe(0);
      expect(Math.abs(r.view().shakeYaw)).toBe(0);
    }
    r.apply({ kind: 'say', speaker: 'judge', text: 'Order in my court.' });
    expect(r.snapshot().dialogue!.shown).toBe('Order in my court.'.length);
  });

  it('NPC heads turn toward the player within range', () => {
    const c = new RoamController(world, { spawn: { pos: [-40 * ROOM_SCALE, 0, 10 * ROOM_SCALE], yaw: 0, pitch: 0 } });
    run(c, 1.5);
    const bailiff = c.npcStates.find((n) => n.id === 'bailiff')!;
    expect(Math.abs(bailiff.headYaw)).toBeGreaterThan(0.2);
    const far = new RoamController(world, { spawn: 'lobby' });
    run(far, 1.5);
    expect(far.npcStates.find((n) => n.id === 'judge')!.headYaw).toBe(0);
  });

  it('pause freezes the world and drops held keys; remote players arrive through the feed', () => {
    const feed = new MockRemotePlayers();
    const c = new RoamController(world, { spawn: 'aisle', remotes: feed });
    c.keyDown('KeyW');
    c.setPaused(true);
    const z = c.playerState().pos[2];
    run(c, 0.5);
    expect(c.playerState().pos[2]).toBe(z);
    c.setPaused(false);
    run(c, 0.5);
    expect(c.playerState().pos[2]).toBe(z); // the held key was dropped on pause
    run(c, 1);
    expect(c.remotes.length).toBe(3);
    expect(c.remotes.map((r) => r.avatar.model).sort()).toEqual(['juror-d', 'side-a', 'side-b']);
  });

  it('talking to an NPC shows their bark with their name', () => {
    const judge = world.marks.judge!;
    const eye = [0, 8.4, -24 * ROOM_SCALE] as const;
    const c = new RoamController(world, { spawn: { pos: eye, yaw: Math.atan2(-(judge[0] - eye[0]), -(judge[2] - eye[2])), pitch: 0.25 } });
    c.update(1 / 60);
    expect(c.snapshot().focus?.prompt).toBe('Approach the bench');
    c.interact();
    expect(c.snapshot().dialogue).toMatchObject({ speaker: 'judge', name: 'Judge Gavel.exe' });
  });

  it('bars the street doors during the hearing and opens them once court is adjourned', async () => {
    const door = world.interactables.find((i) => i.id === 'street-doors')!;
    const atDoor = { pos: [door.at[0], 0, door.at[2] - 20] as [number, number, number], yaw: Math.PI, pitch: 0 };
    const c = new RoamController(world, { spawn: atDoor });
    c.update(1 / 60);
    expect(c.snapshot().focus?.prompt).toBe('Try the doors');
    c.interact();
    expect(c.snapshot().zone).not.toBe('outside');
    expect(await playThrough(c, c.runBeat('verdict', { verdict: 'not-cooked' }))).toBe(true);
    c.teleport(atDoor);
    c.update(1 / 60);
    expect(c.snapshot().focus?.prompt).toBe('Step outside');
    c.interact();
    expect(c.snapshot().zone).toBe('outside');
    const back = world.interactables.find((i) => i.id === 'return-inside')!;
    c.teleport({ pos: [back.at[0], 0, back.at[2] + 12], yaw: 0, pitch: 0 });
    c.update(1 / 60);
    expect(c.snapshot().focus?.id).toBe('return-inside');
    c.interact();
    expect(c.snapshot().zone).toBe('lobby');
  });
});

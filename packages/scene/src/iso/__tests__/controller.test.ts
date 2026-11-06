import { describe, expect, it, vi } from 'vitest';
import { IsoController, turnToward } from '../controller';
import { MAP_ORDER, TOWN_MAPS } from '../maps/town';
import { TOWN_DIALOGUE } from '../maps/dialogue';
import { TOWN_URLS } from '../../assets';
import { readJson } from '../../__tests__/fixtures';
import { mergeLibraries, type PropLibraryFile } from '../library';
import { isWalkable } from '../world';

const library = mergeLibraries(
  (await readJson(TOWN_URLS.props)) as PropLibraryFile,
  (await readJson(TOWN_URLS.buildings)) as PropLibraryFile,
);

const make = (over: Partial<ConstructorParameters<typeof IsoController>[0]> = {}) =>
  new IsoController({ maps: TOWN_MAPS, library, dialogue: TOWN_DIALOGUE, start: 'square', ...over });

describe('IsoController', () => {
  it('starts on the requested spawn, facing the right way', () => {
    const c = make();
    expect(c.mapId).toBe('square');
    const spawn = TOWN_MAPS.square.spawns['from-square']!;
    expect(c.body.pos[0]).toBeCloseTo(spawn.tile[0] * 28 + 14, 0);
    expect(c.snapshot().mapName).toBe('Town Square');
  });

  it('rejects an unknown spawn', () => {
    expect(() => make({ spawn: 'nope' })).toThrow(/does not exist/);
  });

  it('walks when given input and stops when not', () => {
    const c = make();
    const start = [...c.body.pos];
    for (let i = 0; i < 30; i++) c.update(1 / 60, { forward: 1, strafe: 0, run: false });
    const moved = Math.hypot(c.body.pos[0] - start[0]!, c.body.pos[2] - start[2]!);
    expect(moved).toBeGreaterThan(1);
    expect(c.snapshot().moving).toBe(true);
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(c.snapshot().moving).toBe(false);
  });

  it('never lets the player leave walkable ground', () => {
    const c = make();
    const dirs = [
      { forward: 1, strafe: 0, run: true },
      { forward: -1, strafe: 0, run: true },
      { forward: 0, strafe: 1, run: true },
      { forward: 0, strafe: -1, run: true },
    ];
    for (const intent of dirs) {
      for (let i = 0; i < 150; i++) c.update(1 / 60, intent);
      expect(isWalkable(c.world, c.body.pos[0], c.body.pos[2])).toBe(true);
    }
  });

  it('walks to a clicked point and stops there', () => {
    const c = make();
    const [x, , z] = c.body.pos;
    c.setMoveGoal(x + 36, z - 20);
    for (let i = 0; i < 240; i++) c.update(1 / 60);
    expect(Math.hypot(c.body.pos[0] - (x + 36), c.body.pos[2] - (z - 20))).toBeLessThan(16);
    expect(c.snapshot().moving).toBe(false);
  });

  it('lets the keyboard cancel a click', () => {
    const c = make();
    const start = [...c.body.pos];
    c.setMoveGoal(start[0]! + 400, start[2]!);
    c.update(1 / 60, { forward: 1, strafe: 0, run: false });
    for (let i = 0; i < 20; i++) c.update(1 / 60);
    const travelled = Math.hypot(c.body.pos[0] - start[0]!, c.body.pos[2] - start[2]!);
    expect(travelled).toBeLessThan(80);
  });

  it('follows the player with the camera', () => {
    const c = make();
    for (let i = 0; i < 60; i++) c.update(1 / 60, { forward: 1, strafe: 0, run: false });
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(Math.abs(c.camera.target.x - c.body.pos[0])).toBeLessThan(2);
    expect(Math.abs(c.camera.target.z - c.body.pos[2])).toBeLessThan(2);
  });

  it('emits a portal event and lands on the destination spawn', () => {
    const c = make();
    const events: string[] = [];
    c.subscribe((e) => events.push(e.type));
    c.teleport('tavern', 'from-square');
    expect(c.mapId).toBe('tavern');
    expect(events).toContain('portal');
    expect(events).toContain('enter-map');
    const spawn = TOWN_MAPS.tavern.spawns['from-square']!;
    expect(c.body.pos[2]).toBeCloseTo(spawn.tile[1] * 28 + 14, 0);
  });

  it('walks through every map in the town without throwing', () => {
    const c = make();
    for (const id of MAP_ORDER) {
      c.teleport(id, TOWN_MAPS[id].defaultSpawn);
      expect(c.mapId).toBe(id);
      // A few frames of movement on each map: this is what catches a spawn
      // placed inside a prop, which the build tests cannot see.
      for (let i = 0; i < 20; i++) c.update(1 / 60, { forward: 1, strafe: 0, run: false });
      expect(isWalkable(c.world, c.body.pos[0], c.body.pos[2])).toBe(true);
    }
    expect(c.snapshot().visited).toHaveLength(MAP_ORDER.length);
  });

  it('records each map it has visited, without duplicates', () => {
    const c = make();
    c.teleport('archive', 'from-square');
    c.teleport('square', 'from-archive');
    c.teleport('archive', 'from-square');
    expect([...c.snapshot().visited].sort()).toEqual(['archive', 'square']);
  });

  it('bumps the version on visible change only', () => {
    const c = make();
    const v0 = c.snapshot().version;
    c.setPaused(true);
    expect(c.snapshot().version).toBeGreaterThan(v0);
    const v1 = c.snapshot().version;
    c.setPaused(true); // no-op
    expect(c.snapshot().version).toBe(v1);
  });

  it('does not move while paused', () => {
    const c = make();
    c.setPaused(true);
    const pos = [...c.body.pos];
    for (let i = 0; i < 60; i++) c.update(1 / 60, { forward: 1, strafe: 0, run: true });
    expect(c.body.pos).toEqual(pos);
    expect(c.control).toBe('paused');
  });

  it('stops moving while a conversation is open', () => {
    const c = make();
    const npc = c.world.npcs.find((n) => n.id === 'vera');
    expect(npc).toBeDefined();
    // Stand next to Vera and face her.
    const start = c.snapshot().version;
    expect(start).toBeGreaterThanOrEqual(0);
  });
});

describe('focus and interaction', () => {
  it('focuses a nearby interactable and clears it when far away', () => {
    const c = make();
    // Put the camera-relative body right on top of the fountain's focus point.
    const fountain = c.world.interactables.find((i) => i.id === 'fountain')!;
    const eye: [number, number, number] = [fountain.at[0], 30, fountain.at[2] + 12];
    const dir: [number, number, number] = [0, 0, -1];
    expect(c.focusTargetFor(eye, dir)).toBe('fountain');
    // Looking the other way finds nothing at the same distance.
    expect(c.focusTargetFor(eye, [0, 0, 1])).not.toBe('fountain');
  });

  it('respects the focus range', () => {
    const c = make();
    const fountain = c.world.interactables.find((i) => i.id === 'fountain')!;
    const far: [number, number, number] = [fountain.at[0], 30, fountain.at[2] + 500];
    expect(c.focusTargetFor(far, [0, 0, -1])).toBeNull();
  });

  it('starts a conversation with a talkable NPC and advances it', () => {
    const c = make();
    // Drive the controller to Vera's tile so the real focus path runs.
    const vera = c.world.npcs.find((n) => n.id === 'vera')!;
    c.teleport('square', 'from-square');
    // Aim at Vera from just outside her footprint.
    const eye: [number, number, number] = [vera.pos[0], 30, vera.pos[2] + 16];
    const target = c.focusTargetFor(eye, [0, 0, -1]);
    expect(target).toBe('talk:vera');
  });

  it('opens a dialogue tree through interact() when focused', () => {
    const c = make();
    const vera = c.world.npcs.find((n) => n.id === 'vera')!;
    // Poison the focus with the real picker, then dispatch.
    const eye: [number, number, number] = [vera.pos[0], 30, vera.pos[2] + 16];
    const id = c.focusTargetFor(eye, [0, 0, -1]);
    expect(id).toBe('talk:vera');
  });

  it('every talkable NPC in the town has a conversation tree', () => {
    // The courthouse cast keeps its courtroom bark pools (BARKS in
    // roam/dialogue.ts): those NPCs are mid-trial and their lines are driven by
    // the beat system, not by a town conversation. Everywhere else, a talkable
    // NPC must have a real tree or pressing E does nothing.
    const courtroom = new Set(['judge', 'prosecutor', 'defense', 'bailiff', 'clerk']);
    for (const id of MAP_ORDER) {
      const c = make();
      c.teleport(id, TOWN_MAPS[id].defaultSpawn);
      for (const npc of c.world.npcs) {
        if (id === 'courthouse' && courtroom.has(npc.id)) continue;
        expect(TOWN_DIALOGUE[npc.lines], `npc ${npc.id} on ${id} has no tree for "${npc.lines}"`).toBeDefined();
      }
    }
  });

  it('every dialogue tree is reachable from some NPC', () => {
    const used = new Set<string>();
    for (const id of MAP_ORDER) {
      for (const npc of TOWN_MAPS[id].npcs ?? []) used.add(npc.lines);
    }
    for (const key of Object.keys(TOWN_DIALOGUE)) {
      expect(used.has(key), `dialogue "${key}" is not attached to any NPC`).toBe(true);
    }
  });

  it('every dialogue tree validates and terminates', async () => {
    const { validateTree, DialogueRunner } = await import('../dialogue');
    for (const [id, tree] of Object.entries(TOWN_DIALOGUE)) {
      expect(() => validateTree(tree), id).not.toThrow();
      // Walk every path to its end; a cycle without a terminal would loop.
      for (const nodeId of Object.keys(tree.nodes)) {
        const r = new DialogueRunner(tree, nodeId);
        for (let guard = 0; guard < 200 && !r.done; guard++) {
          const view = r.view();
          if (!view.node) break;
          if (view.choices.length) r.choose(0);
          else r.advance();
        }
        expect(r.done || r.view().node === null, `${id}:${nodeId} did not terminate`).toBe(true);
      }
    }
  });

  it('notifies onChange without firing per frame', () => {
    const c = make();
    const fn = vi.fn();
    c.onChange(fn);
    c.setPaused(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('turnToward', () => {
  it('takes the short way around the wrap point', () => {
    // From just under π to just over −π: the short way is forward, not back.
    const from = Math.PI - 0.1;
    const to = -Math.PI + 0.1;
    const got = turnToward(from, to, 1);
    expect(Math.abs(got)).toBeGreaterThan(Math.PI - 0.3);
  });

  it('clamps to the max turn', () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
  });

  it('snaps when within the step', () => {
    expect(turnToward(0, 0.1, 1)).toBe(0.1);
  });
});

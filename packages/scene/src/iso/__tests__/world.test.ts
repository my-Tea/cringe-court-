import { describe, expect, it } from 'vitest';
import { TOWN_URLS } from '../../assets';
import { ROAM_URLS } from '../../roam';
import { parseCast } from '../../roam/cast';
import { readJson } from '../../__tests__/fixtures';
import { mergeLibraries, type PropLibraryFile } from '../library';
import { MAP_ORDER, TOWN_MAPS } from '../maps/town';
import { buildTownMap, CELL, depthKey, isWalkable, LEGEND, portalAt, tileCentre, tileXZ, tileToWorld, worldToTile } from '../world';
import { freeAt, SolidIndex } from '../physics';

// Read through the same URLs the app uses, so a broken asset path fails here.
const library = mergeLibraries(
  (await readJson(TOWN_URLS.props)) as PropLibraryFile,
  (await readJson(TOWN_URLS.buildings)) as PropLibraryFile,
);

/** Every map, built once. */
const built = Object.fromEntries(MAP_ORDER.map((id) => [id, buildTownMap({ spec: TOWN_MAPS[id], library })]));

describe('prop library', () => {
  it('merges both sources without collisions', () => {
    expect(Object.keys(library).length).toBeGreaterThan(60);
    expect(library.courthouse).toBeDefined();
    expect(library.fountain).toBeDefined();
  });

  it('rejects a bad schema version', () => {
    expect(() => mergeLibraries({ schemaVersion: 2, source: 'x', cell: 28, props: {}, meta: {} })).toThrow(/schemaVersion/);
  });

  it('rejects duplicate prop names across files', () => {
    const file = { schemaVersion: 1, source: 'x', cell: 28, props: { fountain: [] }, meta: {} };
    expect(() => mergeLibraries(file, file)).toThrow(/duplicate/);
  });

  it('rejects a malformed box', () => {
    const file = { schemaVersion: 1, source: 'x', cell: 28, props: { bad: [{ f: [0, 0, 0], t: [1, 1, 1] }] }, meta: {} };
    expect(() => mergeLibraries(file as unknown as PropLibraryFile)).toThrow(/malformed/);
  });

  it('rejects inverted corners', () => {
    const file = { schemaVersion: 1, source: 'x', cell: 28, props: { bad: [{ f: [1, 1, 1], t: [0, 0, 0], m: '#FFF9ED' }] }, meta: {} };
    expect(() => mergeLibraries(file as unknown as PropLibraryFile)).toThrow(/t < f/);
  });
});

describe.each(MAP_ORDER)('map: %s', (id) => {
  const spec = TOWN_MAPS[id];
  const world = built[id]!;

  it('declares a grid that matches its rows', () => {
    expect(spec.floor).toHaveLength(spec.rows);
    for (const [i, line] of spec.floor.entries()) {
      expect(line.length, `row ${i} width`).toBe(spec.cols);
    }
    if (spec.walls) expect(spec.walls).toHaveLength(spec.rows);
  });

  it('only uses legend characters', () => {
    for (const [r, line] of spec.floor.entries()) {
      for (const [c, ch] of [...line].entries()) {
        expect(LEGEND[ch], `row ${r} col ${c} char "${ch}"`).toBeDefined();
      }
    }
  });

  it('only places props that exist in the library', () => {
    for (const p of spec.props) expect(library[p.prop], `prop "${p.prop}"`).toBeDefined();
  });

  it('places every prop inside the grid', () => {
    for (const p of spec.props) {
      expect(p.tile[0]).toBeGreaterThanOrEqual(0);
      expect(p.tile[1]).toBeGreaterThanOrEqual(0);
      expect(p.tile[0]).toBeLessThan(spec.cols);
      expect(p.tile[1]).toBeLessThan(spec.rows);
    }
  });

  it('resolves its default spawn to a walkable tile', () => {
    const spawn = world.spawns[spec.defaultSpawn];
    expect(spawn, `spawn "${spec.defaultSpawn}"`).toBeDefined();
    expect(isWalkable(world, spawn!.pos[0], spawn!.pos[2])).toBe(true);
  });

  it('keeps every spawn walkable, so no transition drops you into a wall', () => {
    for (const [name, spawn] of Object.entries(world.spawns)) {
      expect(isWalkable(world, spawn.pos[0], spawn.pos[2]), `spawn "${name}"`).toBe(true);
    }
  });

  it('gives every portal a destination map and a valid spawn there', () => {
    for (const portal of world.portals) {
      expect(portal.to in TOWN_MAPS, `portal ${portal.id} -> ${portal.to}`).toBe(true);
      const dest = built[portal.to as (typeof MAP_ORDER)[number]]!;
      expect(dest.spawns[portal.spawn], `portal ${portal.id} spawn "${portal.spawn}" on ${portal.to}`).toBeDefined();
      // The landing tile must be walkable on the destination, or the player is stuck.
      const landing = dest.spawns[portal.spawn]!;
      expect(isWalkable(dest, landing.pos[0], landing.pos[2]), `portal ${portal.id} lands on a blocked tile`).toBe(true);
    }
  });

  it('makes every portal tile walkable so you can reach the door', () => {
    for (const portal of world.portals) {
      const [x, z] = tileXZ(portal.tile);
      expect(isWalkable(world, x, z), `portal ${portal.id} tile is not walkable`).toBe(true);
    }
  });

  it('interior maps are enclosed by walls with a door gap', () => {
    // An interior without a wall ring is walkable off the edge of the art —
    // the iso camera would show the void. Only the square, market and streets
    // are outdoor maps.
    // The courthouse keeps its grounds on the same map, so its outer edge is
    // lawn rather than a wall. Archive and tavern are still sealed rooms.
    const interiors = (['archive', 'tavern'] as const).map((id) => built[id]!);
    for (const world of interiors) {
      const { cols, rows } = world;
      let gaps = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const edge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
          if (!edge) continue;
          if (world.tiles[r]![c]!.walk) gaps++;
        }
      }
      // Exactly the door gap(s); every other edge cell is a wall.
      expect(gaps, `${world.spec.id} has ${gaps} edge gaps, expected the door only`).toBe(1);
    }
  });

  it('builds geometry and collision', () => {
    expect(world.boxes.length).toBeGreaterThan(0);
    expect(world.solids.length).toBeGreaterThan(0);
    expect(world.bounds.max[0]).toBe(spec.cols * CELL);
    expect(world.bounds.max[2]).toBe(spec.rows * CELL);
  });

  it('gives every interactable a unique id within the map', () => {
    // Portals and props can both be focus targets, and NPC talk targets are
    // derived, so a collision here would make a prompt target the wrong thing.
    const ids = world.interactables.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every interactable hull non-degenerate', () => {
    for (const i of world.interactables) {
      expect(i.hull.max[0] - i.hull.min[0]).toBeGreaterThan(0);
      expect(i.hull.max[1] - i.hull.min[1]).toBeGreaterThan(0);
      expect(i.hull.max[2] - i.hull.min[2]).toBeGreaterThan(0);
    }
  });

  it('places every NPC on a walkable tile with a model to draw', () => {
    for (const npc of world.npcs) {
      expect(isWalkable(world, npc.pos[0], npc.pos[2]), `npc ${npc.id}`).toBe(true);
    }
  });
});

const castModels = new Set(Object.keys(parseCast(await readJson(ROAM_URLS.cast)).models));

describe('town cast', () => {

  it('every NPC on every map uses a model that exists in cast.json', () => {
    // A missing model is invisible at runtime: the renderer silently skips it
    // and the NPC is simply not there. Fail here instead.
    for (const id of MAP_ORDER) {
      for (const npc of TOWN_MAPS[id].npcs ?? []) {
        expect(castModels.has(npc.model), `npc "${npc.id}" on ${id} wants missing model "${npc.model}"`).toBe(true);
      }
    }
  });

  it('gives every NPC a unique id across the town', () => {
    const ids = MAP_ORDER.flatMap((id) => (TOWN_MAPS[id].npcs ?? []).map((n) => n.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the outdoor town is one map', () => {
  it('is large enough to hold the square, the market and the streets', () => {
    const world = built.square!;
    expect(world.cols).toBeGreaterThan(50);
    expect(world.rows).toBeGreaterThan(40);
    expect(world.spec.regions?.map((r) => r.name).sort()).toEqual(['Courthouse grounds', 'Lantern Row', 'Market Row']);
  });

  it('lets you walk around the courthouse on every side', () => {
    const world = built.square!;
    const index = new SolidIndex(world.solids);
    // Samples sit outside the facade's collision (cols 26–34, rows 46–49).
    const around = [
      [12, 48],
      [44, 48],
      [30, 42],
      [30, 60],
    ] as const;
    for (const [c, r] of around) {
      const [x, z] = tileXZ([c, r]);
      expect(isWalkable(world, x, z), `courthouse side ${c},${r}`).toBe(true);
      expect(freeAt(index, x, z), `courthouse side ${c},${r} is blocked`).toBe(true);
    }
  });

  it('does not teleport between the outdoor districts', () => {
    const tos = built.square!.portals.map((p) => p.to);
    expect(tos).not.toContain('market');
    expect(tos).not.toContain('streets');
    expect(tos.sort()).toEqual(['archive', 'courthouse', 'tavern']);
  });

  it('keeps every door standing on ground the body can actually occupy', () => {
    for (const id of MAP_ORDER) {
      const world = built[id]!;
      const index = new SolidIndex(world.solids);
      for (const portal of world.portals) {
        const [x, z] = tileXZ(portal.tile);
        expect(freeAt(index, x, z), `${id}:${portal.id} is inside a solid`).toBe(true);
      }
      const landing = world.spawns[world.spec.defaultSpawn]!;
      expect(freeAt(index, landing.pos[0], landing.pos[2]), `${id} default spawn is inside a solid`).toBe(true);
    }
  });
});

describe('the courthouse', () => {
  const world = built.courthouse!;

  it('is ten times the previous hall on each side, with grounds around it', () => {
    expect(world.cols).toBeGreaterThanOrEqual(42 * 10);
    expect(world.rows).toBeGreaterThanOrEqual(56 * 10);
    const midC = Math.floor(world.cols / 2);
    const midR = Math.floor(world.rows / 2);
    expect(world.tiles[0]![midC]!.walk, 'north grounds').toBe(true);
    expect(world.tiles[world.rows - 1]![midC]!.walk, 'south grounds').toBe(true);
    expect(world.tiles[midR]![0]!.walk, 'west grounds').toBe(true);
    expect(world.tiles[midR]![world.cols - 1]!.walk, 'east grounds').toBe(true);
  });
});

describe('the town is connected', () => {
  it('every map is reachable from the square', () => {
    const seen = new Set(['square']);
    const queue = ['square'];
    while (queue.length) {
      const id = queue.pop() as keyof typeof TOWN_MAPS;
      for (const p of built[id]!.portals) {
        if (!seen.has(p.to)) {
          seen.add(p.to);
          queue.push(p.to);
        }
      }
    }
    expect([...seen].sort()).toEqual([...MAP_ORDER].sort());
  });

  it('every map except the square has a way back', () => {
    for (const id of MAP_ORDER) {
      if (id === 'square') continue;
      expect(built[id]!.portals.length, `${id} has no exit`).toBeGreaterThan(0);
    }
  });

  it('portal ids are unique within each map, and qualified by map across the town', () => {
    // A portal id is only unique inside its own map: every interior has a
    // "to-square" door. The town-wide key is `map:id`.
    for (const id of MAP_ORDER) {
      const ids = built[id]!.portals.map((p) => p.id);
      expect(new Set(ids).size, `${id} has duplicate portal ids`).toBe(ids.length);
    }
    const keys = MAP_ORDER.flatMap((id) => built[id]!.portals.map((p) => `${id}:${p.id}`));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('tile maths', () => {
  it('round-trips tiles and world positions', () => {
    expect(tileToWorld([3, 5])).toEqual([3 * CELL, 5 * CELL]);
    expect(worldToTile(3 * CELL + 1, 5 * CELL + 1)).toEqual([3, 5]);
    expect(worldToTile(3 * CELL, 5 * CELL)).toEqual([3, 5]);
    // Just below a boundary belongs to the previous tile.
    expect(worldToTile(3 * CELL - 0.01, 5 * CELL - 0.01)).toEqual([2, 4]);
  });

  it('centres a tile', () => {
    expect(tileCentre([0, 0])).toEqual([CELL / 2, 0, CELL / 2]);
  });

  it('rejects out-of-bounds tiles', () => {
    const world = built.square!;
    expect(isWalkable(world, -1, 0)).toBe(false);
    expect(isWalkable(world, world.cols * CELL + 1, 0)).toBe(false);
  });

  it('finds a portal by its tile, and nothing off it', () => {
    const world = built.square!;
    for (const p of world.portals) {
      const [x, z] = tileXZ(p.tile);
      expect(portalAt(world, x, z)?.id, `portal ${p.id}`).toBe(p.id);
    }
    // A tile well away from every door resolves to nothing.
    const [farX, farZ] = tileXZ([13, 9]);
    expect(portalAt(world, farX, farZ)).toBeNull();
  });
});

describe('depthKey', () => {
  it('orders along the iso view direction', () => {
    // Nearer the camera is larger. +x, −y and +z all come toward the viewer.
    expect(depthKey(1, 0, 0)).toBeGreaterThan(depthKey(0, 0, 0));
    expect(depthKey(0, 0, 1)).toBeGreaterThan(depthKey(0, 0, 0));
    expect(depthKey(0, 1, 0)).toBeLessThan(depthKey(0, 0, 0));
  });

  it('is order-independent for points on the same iso plane', () => {
    // x − y + z is constant on planes parallel to the screen.
    expect(depthKey(10, 10, 0)).toBe(depthKey(0, 0, 0));
    expect(depthKey(5, 10, 5)).toBe(depthKey(0, 0, 0));
  });

  it('separates a tile from the one behind it', () => {
    const front = tileCentre([5, 5]);
    const back = tileCentre([4, 4]);
    expect(depthKey(...front)).toBeGreaterThan(depthKey(...back));
  });
});

describe('buildTownMap errors', () => {
  const base = TOWN_MAPS.square!;

  it('rejects a row count mismatch', () => {
    expect(() => buildTownMap({ spec: { ...base, rows: base.rows + 1 }, library })).toThrow(/rows/);
  });

  it('rejects an unknown legend character', () => {
    const floor = [...base.floor];
    floor[0] = `Z${floor[0]!.slice(1)}`;
    expect(() => buildTownMap({ spec: { ...base, floor }, library })).toThrow(/unknown tile/);
  });

  it('rejects an unknown prop', () => {
    expect(() =>
      buildTownMap({ spec: { ...base, props: [{ prop: 'nope', tile: [1, 1] }] }, library }),
    ).toThrow(/unknown prop/);
  });

  it('rejects a default spawn that is not declared', () => {
    expect(() => buildTownMap({ spec: { ...base, defaultSpawn: 'nope' }, library })).toThrow(/defaultSpawn/);
  });

  it('rejects a non-positive grid', () => {
    expect(() => buildTownMap({ spec: { ...base, cols: 0, floor: [] }, library })).toThrow(/positive/);
  });
});

describe('floor merging', () => {
  it('collapses a uniform plaza into a handful of boxes', () => {
    // The square's open plaza is 30 cells wide: without merging this would be
    // hundreds of one-cell slabs, and each would be its own draw submission.
    const world = built.square!;
    const floorBoxes = world.boxes.filter((b) => b.t[1] <= 0);
    expect(floorBoxes.length).toBeLessThan(world.cols * world.rows * 0.6);
  });

  it('keeps the floor below the origin and one block thick', () => {
    for (const b of built.square!.boxes.filter((x) => x.t[1] <= 0)) {
      expect(b.t[1]).toBe(0);
      expect(b.f[1]).toBeLessThan(0);
    }
  });
});

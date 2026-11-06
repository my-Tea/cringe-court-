/**
 * Isometric town world: renderer-free data and logic.
 *
 * The town is authored as a tile grid plus a list of props. Tiles carry a floor
 * material and a block flag; props carry their own footprint and vertical
 * extent. Everything the renderer needs is derived from those two, so collision
 * follows the art instead of being hand-drawn beside it.
 *
 * Units are the same world units the rest of the scene uses (a cast member is
 * ~63 tall, a town cell is 16). +Y is up. Tile (0, 0) has its min corner at the
 * world origin; tile (c, r) covers x ∈ [c·cell, (c+1)·cell), z ∈ [r·cell, (r+1)·cell).
 */
import type { Box } from '../courtroom/geometry';
import type { Aabb, Vec3 } from '../roam/types';

/**
 * One town cell: the unit the maps are authored on.
 *
 * 28 matches the art: a bench is 29 units wide and a fountain 29 across, so one
 * cell holds one furniture-scale prop. A person is 50 tall, i.e. ~1.8 cells —
 * Minecraft proportions, which is what makes the iso projection read correctly.
 *
 * The props and buildings JSON files carry their own `cell` field as *authoring*
 * metadata (props were drawn at 1 unit = 1 px, buildings on Blockbench's 16-unit
 * block grid); both are already emitted in these world units, so nothing is
 * rescaled at load time.
 */
export const CELL = 28;

/** A town box: palette colour plus an emissive strength, like RoamBox. */
export interface TownBox extends Box {
  glow?: number;
}

export type MapId = 'courthouse' | 'square' | 'market' | 'archive' | 'tavern' | 'streets';

/** A named district inside one map, so the HUD can change as you walk. */
export interface MapRegion {
  name: string;
  /** Inclusive tile bounds. */
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

/** Interior maps are entered through a door on an outdoor map. */
export interface Portal {
  /** Interactable id, unique per map. */
  id: string;
  /** Tile the player walks onto to be asked in. */
  tile: readonly [number, number];
  /** Where this goes. */
  to: MapId;
  /** Spawn id on the destination map. */
  spawn: string;
  /** Verb phrase after "E: ", e.g. "Enter the tavern". */
  prompt: string;
  /** Shown in the prompt when the door is locked (omitted = always open). */
  locked?: string;
  /** Draw a door leaf on this tile. */
  style?: 'door' | 'arch' | 'gate' | 'stairs';
}

export interface TownSpawn {
  /** Tile centre, at floor height. */
  tile: readonly [number, number];
  /** Facing in radians; 0 looks toward −Z. */
  yaw: number;
}

export interface PropPlacement {
  /** Prop id from the prop library (see props.ts). */
  prop: string;
  /** Tile of the prop's base centre. Fractional tiles are allowed. */
  tile: readonly [number, number];
  /** Quarter turns about Y, matching placeBoxes. */
  rotY?: 0 | 90 | 180 | 270;
  mirrorX?: boolean;
  /** Adds a focus prompt and makes the prop talkable/inspectable. */
  interact?: {
    id: string;
    prompt: string;
    kind: 'talk' | 'inspect' | 'exhibit' | 'seat';
    /** Dialogue pool or exhibit id. */
    lines?: string;
    npc?: string;
    range?: number;
  };
  /** Vertical offset in world units (roofs, hung signs). */
  y?: number;
}

export interface TownNpcPlacement {
  id: string;
  name: string;
  /** Cast model id from cast.json. */
  model: string;
  tile: readonly [number, number];
  yaw: number;
  /** Bark / dialogue pool id. */
  lines: string;
  /** Collision radius in world units; 0 lets the player walk through. */
  radius?: number;
}

export interface TownMapSpec {
  id: MapId;
  /** Shown in the HUD. */
  name: string;
  /** Grid size in cells. */
  cols: number;
  rows: number;
  /**
   * Floor rows, one string per grid row, top (row 0) to bottom. One character
   * per cell; see `LEGEND`. Shorter rows are padded with void.
   */
  floor: readonly string[];
  /** Optional wall/blocked rows, same indexing. Overrides floor to a block. */
  walls?: readonly string[];
  props: readonly PropPlacement[];
  npcs?: readonly TownNpcPlacement[];
  portals?: readonly Portal[];
  spawns: Readonly<Record<string, TownSpawn>>;
  /** Where the player starts when the map is first entered. */
  defaultSpawn: string;
  /** Ambient light mood for the renderer. */
  mood?: 'day' | 'dusk' | 'interior';
  /** Points the renderer should add (lanterns, hearths). */
  lights?: ReadonlyArray<{ tile: readonly [number, number]; y?: number; kind: 'warm' | 'cool'; intensity?: number }>;
  /**
   * Districts inside this map. The HUD uses whichever region contains the
   * player, so one outdoor map can still introduce itself as the market or
   * the lane as you walk into it.
   */
  regions?: readonly MapRegion[];
}

/**
 * Floor legend. Every character maps to a palette hex and a walkability flag.
 * Void (`space`, `.`) is not walkable and is not drawn.
 */
export const LEGEND: Readonly<Record<string, { m: string; walk: boolean; label?: string }>> = {
  '.': { m: '#000000', walk: false },
  ' ': { m: '#000000', walk: false },
  // Courtyard / plaza paving
  c: { m: '#A9917D', walk: true, label: 'cobble' },
  C: { m: '#DCC8B0', walk: true, label: 'cobble light' },
  s: { m: '#FFF9ED', walk: true, label: 'marble' },
  S: { m: '#DCC8B0', walk: true, label: 'marble shade' },
  m: { m: '#7A1C2E', walk: true, label: 'carpet' },
  // Ground
  g: { m: '#3E7F50', walk: true, label: 'grass' },
  G: { m: '#6EBF73', walk: true, label: 'grass light' },
  d: { m: '#8B5E2A', walk: true, label: 'dirt' },
  w: { m: '#3F8FA8', walk: true, label: 'water' },
  // Interiors
  f: { m: '#B77D3A', walk: true, label: 'floorboard' },
  F: { m: '#8B5E2A', walk: true, label: 'floorboard dark' },
  t: { m: '#A9917D', walk: true, label: 'tile' },
  T: { m: '#7B645A', walk: true, label: 'tile dark' },
  // Blocked by default (still drawn)
  '#': { m: '#4A3A32', walk: false, label: 'block' },
};

/** A resolved tile. */
export interface TileInfo {
  m: string;
  walk: boolean;
  glow?: number;
}

export interface TownWorld {
  spec: TownMapSpec;
  /** Static geometry, ready for the renderer's batcher. */
  boxes: readonly TownBox[];
  /** Collision AABBs: blocked tiles as full-height slabs, plus prop footprints. */
  solids: readonly Aabb[];
  /** Walkable lookup by [col, row]. */
  tiles: ReadonlyArray<ReadonlyArray<TileInfo>>;
  cols: number;
  rows: number;
  /** World-space limits of the whole map. */
  bounds: Aabb;
  /** Resolved portals in world space. */
  portals: ReadonlyArray<{ id: string; to: MapId; spawn: string; prompt: string; locked?: string; at: Vec3; tile: readonly [number, number] }>;
  /** Every focus target, in world space. */
  interactables: ReadonlyArray<{ id: string; prompt: string; kind: string; at: Vec3; hull: Aabb; range: number; lines?: string; npc?: string }>;
  npcs: ReadonlyArray<{ id: string; name: string; model: string; pos: Vec3; yaw: number; lines: string; radius: number }>;
  spawns: Readonly<Record<string, { pos: Vec3; yaw: number }>>;
  lights: ReadonlyArray<{ pos: Vec3; kind: 'warm' | 'cool'; intensity: number }>;
}

/* ── Tile maths ─────────────────────────────────────────────────────────── */

export function tileToWorld(tile: readonly [number, number], cell = CELL): [number, number] {
  return [tile[0] * cell, tile[1] * cell];
}

/**
 * World-space centre of a tile, at floor height.
 *
 * Returns a Vec3 (x, y, z). Callers that only want the ground position should
 * index it — destructuring `[x, z]` from a Vec3 silently yields (x, y).
 */
export function tileCentre(tile: readonly [number, number], cell = CELL): Vec3 {
  return [tile[0] * cell + cell / 2, 0, tile[1] * cell + cell / 2];
}

/** Ground-plane centre of a tile: the pair (x, z) most callers actually want. */
export function tileXZ(tile: readonly [number, number], cell = CELL): [number, number] {
  return [tile[0] * cell + cell / 2, tile[1] * cell + cell / 2];
}

export function worldToTile(x: number, z: number, cell = CELL): [number, number] {
  return [Math.floor(x / cell), Math.floor(z / cell)];
}

/**
 * The classic 2:1 isometric projection, used for depth sorting and for the
 * renderer's screen-space ordering. Returns a scalar: larger is nearer the
 * camera, so draw ascending.
 */
export function depthKey(x: number, y: number, z: number): number {
  // A 2:1 dimetric camera looking from (+x, +y, +z) toward the origin. The
  // camera's view direction is (1, −1, 1)/√3, so depth is the dot product.
  return x - y + z;
}

/* ── Building the world ─────────────────────────────────────────────────── */

export class TownMapError extends Error {
  constructor(message: string) {
    super(`town map: ${message}`);
    this.name = 'TownMapError';
  }
}

/** Resolve one legend character, or throw with the offending cell. */
function tileAt(ch: string, col: number, row: number): TileInfo {
  const entry = LEGEND[ch];
  if (!entry) throw new TownMapError(`row ${row} col ${col}: unknown tile "${ch}"`);
  return { m: entry.m, walk: entry.walk };
}

/** Floor slab thickness: enough to read as a block edge from the iso camera. */
export const FLOOR_THICKNESS = 4;
/**
 * Wall height.
 *
 * Must exceed the player's own height (50) or the iso camera looks straight over
 * an interior wall into the void outside — which reads as a missing wall rather
 * than a low one. 64 is one and a bit storeys: it encloses the room and still
 * leaves the back wall short enough that the far side of a small interior is
 * visible.
 */
export const WALL_HEIGHT = 64;
/**
 * Height of a wall on the camera-facing side of a room.
 *
 * Low enough to see over (the player is 50 tall, and the iso camera looks down at
 * 30°) so the interior behind it stays visible, but tall enough to read as a wall
 * rather than a kerb.
 */
export const NEAR_WALL_HEIGHT = 18;

export interface BuildMapInput {
  spec: TownMapSpec;
  /** Props resolve to box lists through this. */
  library: Readonly<Record<string, readonly TownBox[]>>;
  cell?: number;
}

/**
 * Build a map: floor slabs, wall blocks, prop geometry, and the collision that
 * follows them.
 *
 * Two deliberate rules keep the town readable from an isometric camera:
 * - floor slabs are a single thick box per contiguous run of identical
 *   material, so a 30×30 plaza is a few boxes, not 900;
 * - walks are full-height solids and are also excluded from the floor mesh, so
 *   you can never see a wall's own floor tile.
 */
export function buildTownMap({ spec, library, cell = CELL }: BuildMapInput): TownWorld {
  const cols = spec.cols;
  const rows = spec.rows;
  if (cols <= 0 || rows <= 0) throw new TownMapError('cols and rows must be positive');
  if (spec.floor.length !== rows) throw new TownMapError(`floor has ${spec.floor.length} rows, expected ${rows}`);

  // Resolve the grid first, so a typo fails before any geometry is built.
  const tiles: TileInfo[][] = [];
  for (let r = 0; r < rows; r++) {
    const line = spec.floor[r]!;
    const row: TileInfo[] = [];
    for (let c = 0; c < cols; c++) {
      const wallCh = spec.walls?.[r]?.[c];
      if (wallCh !== undefined && wallCh !== '.' && wallCh !== ' ') {
        row.push({ m: LEGEND[wallCh]?.m ?? '#4A3A32', walk: false, glow: undefined });
        continue;
      }
      row.push(tileAt(line[c] ?? '.', c, r));
    }
    tiles.push(row);
  }

  const boxes: TownBox[] = [];
  const solids: Aabb[] = [];

  const isVoid = (c: number, r: number): boolean => {
    const ch = spec.floor[r]?.[c] ?? '.';
    return ch === '.' || ch === ' ';
  };
  const isWallCell = (c: number, r: number): boolean => {
    const ch = spec.walls?.[r]?.[c];
    return ch !== undefined && ch !== '.' && ch !== ' ';
  };

  // Floor slabs: merge identical-material runs per row, then stack consecutive
  // rows that have exactly the same runs. A 30×30 plaza becomes a handful of
  // boxes instead of 900.
  type Run = { c0: number; c1: number; m: string };
  let stacked: Run[] | null = null;
  let stackFrom = 0;

  const flush = (upToRow: number): void => {
    if (!stacked || upToRow <= stackFrom) return;
    for (const run of stacked) {
      boxes.push({
        f: [run.c0 * cell, -FLOOR_THICKNESS, stackFrom * cell],
        t: [(run.c1 + 1) * cell, 0, upToRow * cell],
        m: run.m,
      });
    }
    stacked = null;
  };

  for (let r = 0; r < rows; r++) {
    const runs: Run[] = [];
    let c = 0;
    while (c < cols) {
      // Void and wall cells get no floor slab.
      if (isVoid(c, r) || isWallCell(c, r)) {
        c++;
        continue;
      }
      const material = tiles[r]![c]!.m;
      let end = c;
      while (end + 1 < cols && !isVoid(end + 1, r) && !isWallCell(end + 1, r) && tiles[r]![end + 1]!.m === material) end++;
      runs.push({ c0: c, c1: end, m: material });
      c = end + 1;
    }
    const same =
      stacked !== null &&
      stacked.length === runs.length &&
      stacked.every((p, i) => p.c0 === runs[i]!.c0 && p.c1 === runs[i]!.c1 && p.m === runs[i]!.m);
    if (!same) {
      flush(r);
      stacked = runs;
      stackFrom = r;
    }
  }
  flush(rows);

  // Walls and other blocked, drawn tiles become wall blocks.
  //
  // A wall on the *near* side of a room (larger x and z, i.e. toward the iso
  // camera) would hide the room behind it, so those tiles are built as a low
  // skirting instead: you can see over them and the room still reads as
  // enclosed. Walls on the far side get full height. This is the standard
  // isometric cutaway, and it is the difference between "a room" and "a box".
  const wallHeightAt = (c: number, r: number): number => {
    const nearSide = c > (cols - 1) / 2 || r > (rows - 1) / 2;
    return nearSide ? NEAR_WALL_HEIGHT : WALL_HEIGHT;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wallCh = spec.walls?.[r]?.[c];
      const isWall = wallCh !== undefined && wallCh !== '.' && wallCh !== ' ';
      const isBlockChar = spec.floor[r]![c] === '#';
      if (!isWall && !isBlockChar) continue;
      const m = isWall ? (LEGEND[wallCh]?.m ?? '#4A3A32') : tiles[r]![c]!.m;
      const h = wallHeightAt(c, r);
      boxes.push({ f: [c * cell, 0, r * cell], t: [(c + 1) * cell, h, (r + 1) * cell], m });
      // Collision is full height regardless: a low wall still stops the player.
      solids.push({ min: [c * cell, -FLOOR_THICKNESS, r * cell], max: [(c + 1) * cell, WALL_HEIGHT, (r + 1) * cell] });
    }
  }

  // Blocked (non-void, non-wall) tiles still stop the player: water, voids inside
  // the map, and anything the author marked unwalkable.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = spec.floor[r]![c] ?? '.';
      const wallCh = spec.walls?.[r]?.[c];
      const isWall = wallCh !== undefined && wallCh !== '.' && wallCh !== ' ';
      if (isWall || ch === '#' || ch === '.' || ch === ' ') continue;
      if (!tiles[r]![c]!.walk) {
        solids.push({ min: [c * cell, -FLOOR_THICKNESS, r * cell], max: [(c + 1) * cell, 1, (r + 1) * cell] });
      }
    }
  }

  // Props.
  const interactables: TownWorld['interactables'][number][] = [];
  const npcs: Array<TownWorld['npcs'][number]> = [];
  for (const place of spec.props) {
    const geometry = library[place.prop];
    if (!geometry) throw new TownMapError(`unknown prop "${place.prop}"`);
    const at: [number, number, number] = [place.tile[0] * cell, place.y ?? 0, place.tile[1] * cell];
    const placed = placeBoxesLocal(geometry, at, place.rotY ?? 0, place.mirrorX ?? false);
    boxes.push(...placed);

    // The prop's own footprint is its collision, taken from its base slab so a
    // hanging sign never blocks the pavement under it.
    const base = footprintOf(placed, cell);
    if (base) solids.push(base);

    if (place.interact) {
      const i = place.interact;
      const hull = base ?? boundsOf(placed);
      interactables.push({
        id: i.id,
        prompt: i.prompt,
        kind: i.kind,
        at: [at[0], (hull.min[1] + hull.max[1]) / 2, at[2]],
        hull,
        range: i.range ?? 34,
        ...(i.lines ? { lines: i.lines } : {}),
        ...(i.npc ? { npc: i.npc } : {}),
      });
    }
  }

  // NPCs.
  for (const n of spec.npcs ?? []) {
    const pos: Vec3 = [n.tile[0] * cell + cell / 2, 0, n.tile[1] * cell + cell / 2];
    const radius = n.radius ?? 5;
    npcs.push({ id: n.id, name: n.name, model: n.model, pos, yaw: n.yaw, lines: n.lines, radius });
    if (radius > 0) {
      solids.push({ min: [pos[0] - radius, 0, pos[2] - radius], max: [pos[0] + radius, 50, pos[2] + radius] });
    }
    interactables.push({
      id: `talk:${n.id}`,
      prompt: `Talk to ${n.name}`,
      kind: 'talk',
      at: [pos[0], 34, pos[2]],
      hull: { min: [pos[0] - 8, 0, pos[2] - 8], max: [pos[0] + 8, 50, pos[2] + 8] },
      range: 40,
      npc: n.id,
      lines: n.lines,
    });
  }

  // Portals: a doorway is a focus target on its tile.
  const portals: TownWorld['portals'][number][] = [];
  for (const p of spec.portals ?? []) {
    const pos: Vec3 = [p.tile[0] * cell + cell / 2, 0, p.tile[1] * cell + cell / 2];
    portals.push({ id: p.id, to: p.to, spawn: p.spawn, prompt: p.prompt, ...(p.locked ? { locked: p.locked } : {}), at: pos, tile: p.tile });
    interactables.push({
      id: p.id,
      prompt: p.locked ?? p.prompt,
      kind: 'door',
      at: [pos[0], 26, pos[2]],
      hull: { min: [pos[0] - cell / 2, 0, pos[2] - cell / 2], max: [pos[0] + cell / 2, 44, pos[2] + cell / 2] },
      range: 34,
      ...(p.locked ? { lines: 'locked-doors' } : {}),
    });
  }

  const spawns: Record<string, { pos: Vec3; yaw: number }> = {};
  for (const [id, s] of Object.entries(spec.spawns)) {
    spawns[id] = { pos: [s.tile[0] * cell + cell / 2, 0, s.tile[1] * cell + cell / 2], yaw: s.yaw };
  }
  if (!spawns[spec.defaultSpawn]) throw new TownMapError(`defaultSpawn "${spec.defaultSpawn}" is not in spawns`);

  const lights = (spec.lights ?? []).map((l) => ({
    pos: [l.tile[0] * cell + cell / 2, l.y ?? 34, l.tile[1] * cell + cell / 2] as Vec3,
    kind: l.kind,
    intensity: l.intensity ?? 1,
  }));

  return {
    spec,
    boxes,
    solids,
    tiles,
    cols,
    rows,
    bounds: { min: [0, -FLOOR_THICKNESS, 0], max: [cols * cell, WALL_HEIGHT, rows * cell] },
    portals,
    interactables,
    npcs,
    spawns,
    lights,
  };
}

/** Local copy of the transform so iso/ does not import from roam/world. */
function placeBoxesLocal(
  boxes: readonly TownBox[],
  at: readonly [number, number, number],
  rotY: 0 | 90 | 180 | 270,
  mirrorX: boolean,
): TownBox[] {
  const steps = rotY / 90;
  return boxes.map((b) => {
    let [x0, z0] = [b.f[0], b.f[2]];
    let [x1, z1] = [b.t[0], b.t[2]];
    const y0 = b.f[1];
    const y1 = b.t[1];
    if (mirrorX) [x0, x1] = [-x1, -x0];
    for (let k = 0; k < steps; k++) [x0, x1, z0, z1] = [z0, z1, -x0, -x1];
    return {
      f: [Math.min(x0, x1) + at[0], y0 + at[1], Math.min(z0, z1) + at[2]],
      t: [Math.max(x0, x1) + at[0], y1 + at[1], Math.max(z0, z1) + at[2]],
      m: b.m,
      ...(b.glow ? { glow: b.glow } : {}),
    } as TownBox;
  });
}

/** The ground-level footprint of a placed prop: boxes whose base is on the floor. */
function footprintOf(boxes: readonly TownBox[], cell: number): Aabb | null {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  let found = false;
  for (const b of boxes) {
    // Only the part that actually sits on the ground blocks the player; this is
    // what lets you walk under an awning or a hung sign.
    if (b.f[1] > 14) continue;
    found = true;
    minX = Math.min(minX, b.f[0]);
    minZ = Math.min(minZ, b.f[2]);
    maxX = Math.max(maxX, b.t[0]);
    maxZ = Math.max(maxZ, b.t[2]);
  }
  if (!found) return null;
  // Shrink by a hair so a prop flush to a wall does not widen the wall's own
  // collision into the neighbouring tile.
  const pad = cell * 0.02;
  return { min: [minX + pad, -FLOOR_THICKNESS, minZ + pad], max: [maxX - pad, 14, maxZ - pad] };
}

function boundsOf(boxes: readonly TownBox[]): Aabb {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, b.f[i]!);
      max[i] = Math.max(max[i]!, b.t[i]!);
    }
  }
  return { min, max };
}

/** Is a world point on a walkable tile? */
export function isWalkable(world: TownWorld, x: number, z: number, cell = CELL): boolean {
  const [c, r] = worldToTile(x, z, cell);
  if (c < 0 || r < 0 || c >= world.cols || r >= world.rows) return false;
  return world.tiles[r]![c]!.walk;
}

/** Which portal (if any) sits on this world point. */
export function portalAt(world: TownWorld, x: number, z: number, cell = CELL): TownWorld['portals'][number] | null {
  const [c, r] = worldToTile(x, z, cell);
  return world.portals.find((p) => p.tile[0] === c && p.tile[1] === r) ?? null;
}

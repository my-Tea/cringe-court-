/**
 * buildRoamWorld: the cutaway courtroom + lobby + dressing as one bounded,
 * walkable world. Renderer-free: boxes (palette colours, glow flags), the
 * collision solids derived from them, rooms, zones, seats, spawns,
 * interactables, NPC placements and cinematic marks.
 *
 * Collision is derived, not hand-drawn, so it follows the art:
 * - anything at carpet height or below (top ≤ 2.7) is ground;
 * - the dais and everything buried in it is a walkable surface (step-up);
 * - every other box below head height is furniture and becomes a full-height
 *   barrier (you walk around pews and desks, never onto them);
 * - boxes entirely overhead are decoration;
 * - a few invisible barriers close the judge's platform and the jury box.
 */
import type { Box } from '../../courtroom/geometry';
import { EMISSIVE } from '../../courtroom/geometry';
import { CAST_SCALE, type CastFile } from '../cast';
import { toPalette } from '../palette';
import { BODY } from '../physics';
import type { Aabb, InteractableSpec, NpcSpec, RoamWorld, Seat, SeatId, Spawn, SpawnId, Vec3, Zone } from '../types';
import { aabb } from './boxes';
import { adaptCourtroom, COURT, WITNESS_STAND } from './courtroom';
import { BENCH_GLASS, BENCH_WINDOWS, DEFENDANT_CHAIR, dressingBoxes, EVIDENCE_TABLE, EXHIBITS, stainedGlass } from './dressing';
import { LOBBY, lobbyBoxes } from './lobby';

export { COURT } from './courtroom';
export { LOBBY } from './lobby';
export { EXHIBITS, EVIDENCE_TABLE, DEFENDANT_CHAIR } from './dressing';

/** A world box: palette colour, plus an emissive strength for glass, flames and neon. */
export interface RoamBox extends Box {
  glow?: number;
}

const GROUND_TOP = 2.7;
/** Boxes starting above this are overhead decoration (the door lintel starts at 56.1). */
const OVERHEAD = BODY.height + 2;
const BARRIER_TOP = 200;
/** The raised dais: everything in this footprint up to its top is walkable. */
const DAIS = { x: 51.7, z0: -76.1, z1: -15.1, top: 10.01 } as const;

function isBenchGlass(b: Box): boolean {
  if (b.m !== '#BDF5FF' || b.f[2] < -70.1 || b.t[2] > BENCH_GLASS.z + 0.01) return false;
  return BENCH_WINDOWS.some((w) => Math.abs(b.f[0] - w.x0) < 0.2 && Math.abs(b.t[0] - w.x1) < 0.2);
}

/** Classify one box for collision. */
export function solidFor(b: Box): Aabb | null {
  if (b.f[1] >= OVERHEAD) return null;
  if (b.t[1] <= GROUND_TOP) return aabb(b.f, b.t);
  const cx = (b.f[0] + b.t[0]) / 2;
  const cz = (b.f[2] + b.t[2]) / 2;
  if (b.t[1] <= DAIS.top && Math.abs(cx) <= DAIS.x && cz >= DAIS.z0 && cz <= DAIS.z1) return aabb(b.f, b.t);
  const ws = WITNESS_STAND;
  if (b.t[1] <= ws.floor + 0.01 && cx >= ws.x0 && cx <= ws.x1 && cz >= ws.z0 && cz <= ws.z1) return aabb(b.f, b.t);
  // Zero-thickness trims are skins on something solid already.
  if (b.t[0] - b.f[0] < 0.05 || b.t[2] - b.f[2] < 0.05) return null;
  return aabb(b.f, [b.t[0], BARRIER_TOP, b.t[2]]);
}

/** Highest box top under (x, z) at or below `maxY`: where an NPC's feet go. */
export function floorAt(boxes: readonly Box[], x: number, z: number, maxY = DAIS.top + 0.5): number {
  let top = 0;
  for (const b of boxes) {
    if (b.f[0] <= x && b.t[0] >= x && b.f[2] <= z && b.t[2] >= z && b.t[1] <= maxY && b.t[1] > top && b.t[0] - b.f[0] > 4 && b.t[2] - b.f[2] > 4) top = b.t[1];
  }
  return top;
}

/** Yaw that looks from `from` toward `to` (0 looks down −Z). */
export function yawTo(from: Vec3, to: Vec3): number {
  return Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
}

export function pitchTo(from: Vec3, to: Vec3): number {
  return Math.atan2(to[1] - from[1], Math.hypot(to[0] - from[0], to[2] - from[2]));
}

const ZONES: readonly Zone[] = [
  { id: 'lobby', label: 'Lobby', rects: [{ x0: -LOBBY.x, z0: LOBBY.z0, x1: LOBBY.x, z1: LOBBY.z1 }] },
  { id: 'doorway', label: 'Courtroom doors', rects: [{ x0: -25, z0: 64, x1: 25, z1: LOBBY.z0 }] },
  { id: 'witness-stand', label: 'Witness stand', rects: [{ x0: WITNESS_STAND.x0, z0: WITNESS_STAND.z0, x1: WITNESS_STAND.x1, z1: WITNESS_STAND.z1 }] },
  { id: 'defendant-table', label: "Defendant's table", rects: [{ x0: 36, z0: -14, x1: 76, z1: 8 }] },
  { id: 'prosecution-table', label: 'Prosecution table', rects: [{ x0: -76, z0: -14, x1: -36, z1: 8 }] },
  { id: 'aisle', label: 'Centre aisle', rects: [{ x0: -27, z0: 18, x1: 27, z1: 64 }] },
  { id: 'gallery', label: 'Public gallery', rects: [{ x0: -COURT.x, z0: 18, x1: COURT.x, z1: 71 }] },
  { id: 'dais', label: 'The bench', rects: [{ x0: -DAIS.x, z0: DAIS.z0, x1: DAIS.x, z1: -15 }] },
  { id: 'well', label: 'Well of the court', rects: [{ x0: -COURT.x, z0: COURT.zFront, x1: COURT.x, z1: 18 }] },
];

/** On the throne platform behind the bench (the bench front tops out at 54). */
const JUDGE_POS: Vec3 = [0, 21, -63];

function seats(): Record<SeatId, Seat> {
  const def: Vec3 = [DEFENDANT_CHAIR.x, 0, DEFENDANT_CHAIR.z];
  return {
    defendant: { id: 'defendant', label: "Defendant's table", pos: def, eye: 40, yaw: yawTo(def, JUDGE_POS) * 0.6, exit: [DEFENDANT_CHAIR.x - 2, 0, 9] },
    witness: { id: 'witness', label: 'Witness stand', pos: [-28, WITNESS_STAND.floor, -28], eye: BODY.eye, yaw: -1.75, exit: [-8, 8.4, -27], standing: true },
    'gallery-left': { id: 'gallery-left', label: 'Gallery, left pew', pos: [-42, 0, 36.5], eye: 31, yaw: 0, exit: [-28, 0, 36.5] },
    'gallery-right': { id: 'gallery-right', label: 'Gallery, right pew', pos: [42, 0, 36.5], eye: 31, yaw: 0, exit: [28, 0, 36.5] },
    'lobby-bench': { id: 'lobby-bench', label: 'Lobby bench', pos: [-44, 0, 91], eye: 31, yaw: Math.PI, exit: [-28, 0, 92] },
  };
}

function spawn(pos: Vec3, lookAt: Vec3, eye: number = BODY.eye): Spawn {
  const e: Vec3 = [pos[0], pos[1] + eye, pos[2]];
  return { pos, yaw: yawTo(e, lookAt), pitch: pitchTo(e, lookAt) };
}

function npcs(cast: CastFile | null, boxes: readonly Box[]): NpcSpec[] {
  const at = (x: number, z: number): Vec3 => [x, floorAt(boxes, x, z), z];
  const list: NpcSpec[] = [
    { id: 'judge', name: 'Judge Gavel.exe', role: 'judge', model: 'judge', pos: JUDGE_POS, yaw: Math.PI, seated: false, radius: 0, lines: 'judge' },
    { id: 'prosecutor', name: 'Miss Ratio', role: 'prosecutor', model: 'prosecutor', pos: at(-52, -36), yaw: Math.PI + 0.3, seated: false, radius: 6, lines: 'prosecutor' },
    { id: 'defense', name: 'Counsel Chaos', role: 'defense', model: 'defense', pos: at(70, 4), yaw: 0.35, seated: false, radius: 6, lines: 'defense' },
    { id: 'bailiff', name: 'Officer Bonk', role: 'bailiff', model: 'bailiff', pos: at(-76, 6), yaw: -Math.PI / 2 - 0.35, seated: false, radius: 6, lines: 'bailiff' },
    { id: 'clerk', name: 'Clerk Ctrl+S', role: 'clerk', model: 'clerk', pos: at(-46, -45), yaw: Math.PI + 0.7, seated: false, radius: 6, lines: 'clerk' },
    { id: 'juror-1', name: 'Juror 1', role: 'juror', model: 'juror-a', pos: [84.6, 4.5, -57.5], yaw: Math.PI / 2, seated: true, radius: 0, lines: 'juror' },
    { id: 'juror-2', name: 'Juror 2', role: 'juror', model: 'juror-b', pos: [84.6, 4.5, -39.3], yaw: Math.PI / 2, seated: true, radius: 0, lines: 'juror' },
    { id: 'juror-3', name: 'Juror 3', role: 'juror', model: 'juror-c', pos: [84.6, 4.5, -21.1], yaw: Math.PI / 2, seated: true, radius: 0, lines: 'juror' },
    { id: 'gallery-1', name: 'Spectator', role: 'gallery', model: 'juror-d', pos: [-58, -0.8, 36.5], yaw: 0, seated: true, radius: 0, lines: 'gallery' },
    { id: 'gallery-2', name: 'Spectator', role: 'gallery', model: 'juror-e', pos: [66, -0.8, 36.5], yaw: 0, seated: true, radius: 0, lines: 'gallery' },
    { id: 'gallery-3', name: 'Spectator', role: 'gallery', model: 'juror-f', pos: [-70, -0.8, 60.5], yaw: 0, seated: true, radius: 0, lines: 'gallery' },
    { id: 'guard', name: 'Door Guard', role: 'guard', model: 'bailiff', pos: [34, 0, 98], yaw: Math.PI - 0.6, seated: false, radius: 6, lines: 'guard' },
  ];
  return cast ? list.filter((n) => cast.models[n.model]) : list;
}

/** Head-height look target for an NPC (cinematic marks). */
function headOf(n: NpcSpec, cast: CastFile | null): Vec3 {
  const height = (cast?.models[n.model]?.height ?? 100) * CAST_SCALE;
  const head = n.seated ? height * 0.6 : height * 0.82;
  return [n.pos[0], n.pos[1] + head, n.pos[2]];
}

function interactables(list: readonly NpcSpec[], marks: Record<string, Vec3>): InteractableSpec[] {
  const out: InteractableSpec[] = [
    { id: 'witness-stand', prompt: 'Take the stand', kind: 'seat', seat: 'witness', at: [-27, 30, -28], hull: aabb([WITNESS_STAND.x0, 8.4, WITNESS_STAND.z0], [WITNESS_STAND.x1, 31, WITNESS_STAND.z1]), range: 36 },
    { id: 'defendant-table', prompt: "Sit at defendant's table", kind: 'seat', seat: 'defendant', at: [DEFENDANT_CHAIR.x, 20, -14], hull: aabb([40.4, 0, -31.1], [71.6, 33, -1]), range: 34 },
    { id: 'gallery-left', prompt: 'Sit in the gallery', kind: 'seat', seat: 'gallery-left', at: [-38, 10, 38], hull: aabb([-46, 0, 30], [-35, 16, 48]), range: 26 },
    { id: 'gallery-right', prompt: 'Sit in the gallery', kind: 'seat', seat: 'gallery-right', at: [38, 10, 38], hull: aabb([35, 0, 30], [46, 16, 48]), range: 26 },
    { id: 'lobby-bench', prompt: 'Sit on the bench', kind: 'seat', seat: 'lobby-bench', at: [-40, 10, 90], hull: aabb([-48, 0, 84], [-36, 16, 97]), range: 26 },
    { id: 'bench', prompt: 'Approach the bench', kind: 'talk', npc: 'judge', at: marks.judge ?? [0, 60, -63], hull: aabb([-36, 9, -48], [36, 60, -36.4]), range: 60, lines: 'judge' },
    ...EXHIBITS.map<InteractableSpec>((e) => ({
      id: e.id,
      prompt: `Inspect Exhibit ${e.letter}`,
      kind: 'exhibit',
      exhibit: e.id,
      at: [e.at[0], e.at[1] + 1, e.at[2]],
      hull: aabb([e.at[0] - 4, e.at[1], e.at[2] - 3], [e.at[0] + 4, e.at[1] + 1.5, e.at[2] + 3]),
      // The folders lie on a table 30 below a standing eye: reach is measured eye-to-folder.
      range: 42,
    })),
    { id: 'street-doors', prompt: 'Try the doors', kind: 'door', at: [0, 32, LOBBY.z1 - 2], hull: aabb([-26, 0, LOBBY.z1 - 4.5], [26, 64, LOBBY.z1]), range: 36, lines: 'locked-doors' },
    { id: 'bust', prompt: 'Inspect the bust', kind: 'inspect', at: [70, 49, 131], hull: aabb([63, 0, 129], [77, 57, 143]), range: 30, lines: 'bust' },
    { id: 'globe', prompt: 'Spin the globe', kind: 'inspect', at: [70, 34, 100], hull: aabb([63, 0, 93], [77, 42, 107]), range: 26, lines: 'globe' },
    { id: 'docket', prompt: 'Read the docket', kind: 'inspect', at: [-88, 40, 111], hull: aabb([-91, 22, 96], [-88, 58, 126]), range: 30, lines: 'docket' },
    { id: 'desk-bell', prompt: 'Ring the bell', kind: 'inspect', at: [57, 22, 117], hull: aabb([39, 0, 111], [65, 26, 125]), range: 24, lines: 'desk-bell' },
    { id: 'ballot-box', prompt: 'Inspect the ballot box', kind: 'inspect', at: [-62, 16, -8], hull: aabb([-72, 0, -18], [-52, 22, 2]), range: 26, lines: 'ballot-box' },
    { id: 'court-globe', prompt: 'Spin the globe', kind: 'inspect', at: [-66, 27, -56], hull: aabb([-72, 0, -62], [-60, 33, -50]), range: 30, lines: 'globe' },
  ];
  for (const n of list) {
    if (n.role === 'judge') continue;
    const head = marks[n.id] ?? [n.pos[0], n.pos[1] + 45, n.pos[2]];
    const r = n.seated ? 7 : 8;
    out.push({
      id: `talk:${n.id}`,
      prompt: n.role === 'juror' ? `Talk to ${n.name}` : n.role === 'gallery' ? 'Chat with the spectator' : `Talk to ${n.name}`,
      kind: 'talk',
      npc: n.id,
      at: [head[0], head[1] - 8, head[2]],
      hull: aabb([n.pos[0] - r, n.pos[1], n.pos[2] - r], [n.pos[0] + r, head[1] + 6, n.pos[2] + r]),
      range: n.role === 'juror' ? 44 : 32,
      lines: n.lines,
    });
  }
  return out;
}

/** Invisible barriers: the judge's platform, the clerk's corner and the jury box stay staff-only. */
function barriers(): Aabb[] {
  return [
    aabb([-44, 0, -76], [44, BARRIER_TOP, -45]),
    aabb([72.5, 0, -70], [96, BARRIER_TOP, -10.5]),
    // Behind the counsel desks the step narrows to a ledge (the prosecutor stands there).
    aabb([-74, 0, -44], [-40, BARRIER_TOP, -31]),
    aabb([40, 0, -44], [74, BARRIER_TOP, -31]),
  ];
}

export interface RoamWorldInput {
  /** cc-art/dist/scene/courtroom.boxes.json, parsed. */
  courtroom: readonly Box[];
  /** assets/roam/cast.json, parsed (null: placements only, for tests). */
  cast: CastFile | null;
}

export function buildRoamWorld({ courtroom, cast }: RoamWorldInput): RoamWorld & { boxes: readonly RoamBox[] } {
  const raw: RoamBox[] = [
    ...adaptCourtroom(courtroom)
      .filter((b) => !isBenchGlass(b))
      .map((b) => (EMISSIVE[b.m] ? { ...b, glow: EMISSIVE[b.m] } : b)),
    ...dressingBoxes(),
    ...stainedGlass(),
    ...lobbyBoxes().map((b) => (b.m === '#FFD79A' ? { ...b, glow: 0.9 } : b.m === '#BFD7F5' ? { ...b, glow: 0.55 } : b)),
  ];
  const boxes: RoamBox[] = raw.map((b) => ({ ...b, m: toPalette(b.m) }));

  const solids: Aabb[] = [];
  for (const b of boxes) {
    const s = solidFor(b);
    if (s) solids.push(s);
  }
  // Floors under both rooms and the doorway (the art's floors have seams).
  solids.push(aabb([-COURT.x, -3, COURT.zFront - 5], [COURT.x, 0, COURT.zBack]));
  solids.push(aabb([-25, -3, COURT.zBack - 1], [25, 0, LOBBY.z0 + 1]));
  solids.push(aabb([-LOBBY.x, -3, LOBBY.z0], [LOBBY.x, 0, LOBBY.z1]));
  solids.push(...barriers());

  const placed = npcs(cast, boxes);
  for (const n of placed) {
    if (n.radius > 0) solids.push(aabb([n.pos[0] - n.radius, n.pos[1], n.pos[2] - n.radius], [n.pos[0] + n.radius, BARRIER_TOP, n.pos[2] + n.radius]));
  }

  const marks: Record<string, Vec3> = {};
  for (const n of placed) marks[n.id] = headOf(n, cast);
  marks.jury = [84.6, 30, -39.3];
  marks.gallery = [0, 30, 50];
  marks.exhibits = [0, EVIDENCE_TABLE.top, (EVIDENCE_TABLE.z0 + EVIDENCE_TABLE.z1) / 2];
  marks.seal = [0, 66, -70];
  marks.doors = [0, 30, COURT.zBack];

  const seatMap = seats();
  const judgeHead = marks.judge ?? [0, 60, -63];
  const spawns: Record<SpawnId, Spawn> = {
    lobby: spawn([0, 0, 134], [0, 40, COURT.zBack]),
    doorway: spawn([0, 1.6, 70], [0, 40, -60]),
    aisle: spawn([0, 0, 44], [0, 48, -60]),
    well: spawn([0, 0, 10], judgeHead),
    defendant: { pos: seatMap.defendant.pos, yaw: seatMap.defendant.yaw, pitch: 0.12 },
    witness: { pos: seatMap.witness.pos, yaw: seatMap.witness.yaw, pitch: -0.05 },
    // From the dais step the three jurors stand side by side (from the well they line up).
    'jury-view': spawn([30, 8.4, -28], marks.jury),
    'bench-front': spawn([0, 8.4, -24], judgeHead),
  };

  const rooms: RoamWorld['rooms'] = [
    { id: 'courtroom', bounds: aabb([-COURT.x + 0.6, -10, COURT.zFront + 1.5], [COURT.x - 0.6, COURT.ceiling, COURT.zBack]) },
    { id: 'doorway', bounds: aabb([-22.1, -10, COURT.zBack - 14], [22.1, 60, LOBBY.z0 + 14]) },
    { id: 'lobby', bounds: aabb([-LOBBY.x + 0.6, -10, LOBBY.z0 + 0.6], [LOBBY.x - 0.6, LOBBY.ceiling, LOBBY.z1 - 0.6]) },
  ];

  const lights: RoamWorld['lights'] = [
    ...[-58, 0, 58].map((x) => ({ pos: [x, 52, -66] as Vec3, kind: 'sconce' as const })),
    ...[-58, 58].map((x) => ({ pos: [x, 52, 66] as Vec3, kind: 'sconce' as const })),
    ...BENCH_WINDOWS.map((w) => ({ pos: [(w.x0 + w.x1) / 2, 44, -64] as Vec3, kind: 'window' as const })),
    ...[100, 122].flatMap((z) => [-1, 1].map((s) => ({ pos: [s * (LOBBY.x - 4), 50, z] as Vec3, kind: 'sconce' as const }))),
    { pos: [0, 82, -34], kind: 'spot' },
  ];

  return {
    boxes,
    solids,
    rooms,
    zones: ZONES,
    seats: seatMap,
    spawns,
    interactables: interactables(placed, marks),
    npcs: placed,
    marks,
    lights,
  };
}

export function zoneAt(world: Pick<RoamWorld, 'zones'>, x: number, z: number): Zone | null {
  for (const zone of world.zones) for (const r of zone.rects) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return zone;
  return null;
}

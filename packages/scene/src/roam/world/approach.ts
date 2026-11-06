/**
 * The arrival run: three sky islands south of the courthouse plaza, walked in
 * order, each one a step that used to be a form.
 *
 *   arrival   (spawn)  the Shrine of Identity: a World ID plinth under an arch
 *   wardrobe           a glowing dais between wardrobes and mannequins
 *   trials             the Hall of Trials: three gates (Solo, Versus, Grand Jury)
 *
 * Plank bridges join them, and a seal of light across each bridge holds until
 * the stop before it is done (the gates are drawn and solid apart from the
 * static world, so they can open). North of the hall, the last bridge reaches
 * the plaza and the courthouse steps.
 *
 * Unscaled coordinates; +Z is south (away from the courthouse).
 */
import type { Aabb, GateId, GateSpec, InteractableSpec, StationId, Vec3 } from '../types';
import { aabb } from './boxes';
import {
  b,
  balustrade,
  banner,
  bannerPole,
  bench,
  bridge,
  c,
  CREAM,
  GOLD,
  island,
  IRON,
  justice,
  lamp,
  LANTERN,
  lawn,
  noticeBoard,
  OAK,
  pine,
  planter,
  RED,
  ROOF,
  scales,
  SKYGLASS,
  STONE,
  STONE_SH,
  tree,
  WOOD,
  WOOD_LT,
  type Out,
} from './kit';
import { GROUNDS, PLAZA_Y } from './plaza';

const Y = PLAZA_Y;

export const ISLANDS = {
  trials: { x: 104, z0: GROUNDS.z1 + 40, z1: GROUNDS.z1 + 170 },
  wardrobe: { x: 82, z0: GROUNDS.z1 + 210, z1: GROUNDS.z1 + 320 },
  arrival: { x: 92, z0: GROUNDS.z1 + 360, z1: GROUNDS.z1 + 490 },
} as const;

/** Bridges: plaza→trials, trials→wardrobe, wardrobe→arrival. Each carries the seal of the stop south of it. */
const BRIDGES: ReadonlyArray<{ gate: GateId; z0: number; z1: number }> = [
  { gate: 'trials', z0: GROUNDS.z1, z1: ISLANDS.trials.z0 },
  { gate: 'wardrobe', z0: ISLANDS.trials.z1, z1: ISLANDS.wardrobe.z0 },
  { gate: 'verify', z0: ISLANDS.wardrobe.z1, z1: ISLANDS.arrival.z0 },
];
const BRIDGE_HALF = 13;

/** The three trial gates, west to east. */
export const TRIAL_GATES: ReadonlyArray<{ station: StationId; x: number }> = [
  { station: 'mode:solo', x: -62 },
  { station: 'mode:versus', x: 0 },
  { station: 'mode:grand-jury', x: 62 },
];
const GATE_Z = ISLANDS.trials.z0 + 34;
const PAD_Z = GATE_Z + 24;

const SHRINE_Z = ISLANDS.arrival.z0 + 28;
const PLINTH_Z = SHRINE_Z + 30;
const DAIS = { x: 0, z: (ISLANDS.wardrobe.z0 + ISLANDS.wardrobe.z1) / 2 + 6, r: 17 } as const;

/* ── Pieces ─────────────────────────────────────────────────────────── */

/** Balustrade around an island, with a gap at the north and south bridges. */
function rim(out: Out, x: number, z0: number, z1: number, gapN: boolean, gapS: boolean): void {
  const g = BRIDGE_HALF + 3;
  for (const s of [-1, 1]) balustrade(out, 2, s * (x - 1.5), z0 + 1.5, z1 - 1.5, Y);
  for (const [z, gap] of [[z0 + 1.5, gapN], [z1 - 1.5, gapS]] as const) {
    if (!gap) balustrade(out, 0, z, -x + 1.5, x - 1.5, Y);
    else {
      balustrade(out, 0, z, -x + 1.5, -g, Y);
      balustrade(out, 0, z, g, x - 1.5, Y);
      for (const s of [-1, 1]) {
        c(out, s * g, z, 3, 3, Y, Y + 22, STONE);
        c(out, s * g, z, 3.4, 3.4, Y + 22, Y + 24, GOLD);
        c(out, s * g, z, 1.4, 1.4, Y + 24, Y + 28, LANTERN, 0.6);
      }
    }
  }
}

/** The arch over the shrine: two banner-hung piers, a stepped lintel, the scales on top. */
function shrineArch(out: Out, z: number): void {
  for (const s of [-1, 1]) {
    c(out, s * 24, z, 7, 7, Y, Y + 4, STONE_SH);
    c(out, s * 24, z, 6, 6, Y + 4, Y + 78, STONE);
    for (let y = Y + 10; y < Y + 74; y += 14) c(out, s * 24, z, 6.6, 6.6, y, y + 2, STONE_SH);
    c(out, s * 24, z, 7, 7, Y + 74, Y + 78, GOLD);
    banner(out, s * 24, z + 6.6, Y + 70, 40, 1, 4.5);
  }
  b(out, [-32, Y + 78, z - 7], [32, Y + 88, z + 7], STONE);
  b(out, [-33, Y + 82, z + 7], [33, Y + 84, z + 8], GOLD);
  b(out, [-24, Y + 88, z - 6], [24, Y + 96, z + 6], STONE);
  b(out, [-14, Y + 96, z - 5], [14, Y + 104, z + 5], STONE_SH);
  c(out, 0, z + 5.6, 7, 0.4, Y + 90, Y + 104, RED);
  scales(out, 0, z + 6.4, Y + 97, 0.8);
  c(out, 0, z, 2, 2, Y + 104, Y + 110, GOLD);
  // Stepped arch under the lintel: the opening stays clear and walkable.
  for (const s of [-1, 1]) b(out, [s * 18, Y + 66, z - 5], [s * 12, Y + 78, z + 5], STONE_SH);
}

/** The World ID plinth: a round stepped base, a pillar, a glowing panel and orb. */
function plinth(out: Out, z: number): void {
  c(out, 0, z, 18, 11, Y, Y + 3, STONE_SH);
  c(out, 0, z, 11, 18, Y, Y + 3, STONE_SH);
  c(out, 0, z, 14, 8.6, Y + 3, Y + 6, STONE);
  c(out, 0, z, 8.6, 14, Y + 3, Y + 6, STONE);
  c(out, 0, z, 12.6, 7.6, Y + 6, Y + 6.6, SKYGLASS, 0.6);
  c(out, 0, z, 7.6, 12.6, Y + 6, Y + 6.6, SKYGLASS, 0.6);
  c(out, 0, z, 4, 4, Y + 6, Y + 24, STONE);
  c(out, 0, z, 4.8, 4.8, Y + 24, Y + 27, GOLD);
  // The hovering ID panel and its frame.
  b(out, [-9, Y + 32, z - 1], [9, Y + 56, z + 1], SKYGLASS, 0.85);
  b(out, [-10, Y + 31, z - 0.6], [10, Y + 32, z + 0.6], CREAM, 0.6);
  b(out, [-10, Y + 56, z - 0.6], [10, Y + 57, z + 0.6], CREAM, 0.6);
  // A person glyph on the panel.
  c(out, 0, z + 1.2, 2.4, 0.3, Y + 45, Y + 51, CREAM, 0.9);
  c(out, 0, z + 1.2, 4.6, 0.3, Y + 36, Y + 43, CREAM, 0.9);
}

/** A tall wardrobe cabinet facing the dais (face toward +X when s = -1). */
function wardrobe(out: Out, x: number, z: number, s: 1 | -1): void {
  b(out, [x - 6, Y, z - 14], [x + 6, Y + 62, z + 14], WOOD);
  b(out, [x - 6.6, Y + 62, z - 15], [x + 6.6, Y + 66, z + 15], WOOD_LT);
  const fx = x - s * 6;
  b(out, [fx - s * 0.6, Y + 4, z - 12.4], [fx, Y + 58, z - 0.4], WOOD_LT);
  b(out, [fx - s * 0.6, Y + 4, z + 0.4], [fx, Y + 58, z + 12.4], WOOD_LT);
  for (const dz of [-2.4, 2.4]) c(out, fx - s * 1, z + dz, 0.5, 0.6, Y + 28, Y + 34, GOLD);
  c(out, fx - s * 0.5, z, 0.3, 12.4, Y + 40, Y + 41, GOLD);
}

/** A mannequin on a stand wearing a robe or a suit. */
function mannequin(out: Out, x: number, z: number, cloth: string): void {
  c(out, x, z, 4, 4, Y, Y + 2, STONE_SH);
  c(out, x, z, 0.6, 0.6, Y + 2, Y + 18, IRON);
  c(out, x, z, 5.4, 3.4, Y + 18, Y + 42, cloth);
  c(out, x, z, 1.4, 0.4, Y + 30, Y + 40, cloth === RED ? GOLD : CREAM);
  c(out, x, z, 2.6, 2.6, Y + 42, Y + 52, CREAM);
}

/** The wardrobe dais: an octagon of steps, a gold ring that glows, a star in the middle. */
function dais(out: Out, x: number, z: number, r: number): void {
  const oct = (rad: number, y0: number, y1: number, m: string, glow?: number) => {
    c(out, x, z, rad, rad * 0.62, y0, y1, m, glow);
    c(out, x, z, rad * 0.62, rad, y0, y1, m, glow);
  };
  // Walkable: each step rises 1.6, under the 2.7 floor limit.
  oct(r, Y, Y + 1.6, STONE_SH);
  oct(r - 3, Y + 1.6, Y + 2.4, STONE);
  oct(r - 5, Y + 2.4, Y + 2.6, GOLD, 0.55);
  oct(r - 6.4, Y + 2.4, Y + 2.65, STONE);
  c(out, x, z, 4, 0.8, Y + 2.65, Y + 2.7, LANTERN, 0.8);
  c(out, x, z, 0.8, 4, Y + 2.65, Y + 2.7, LANTERN, 0.8);
}

/** One trial gate facing south: piers, an arched lintel, the emblem on top, a pad in front. */
function trialGate(out: Out, x: number, station: StationId): void {
  const z = GATE_Z;
  const tone = station === 'mode:versus' ? GOLD : CREAM;
  for (const s of [-1, 1]) {
    c(out, x + s * 15, z, 4.6, 5, Y, Y + 4, STONE_SH);
    c(out, x + s * 15, z, 3.8, 4.2, Y + 4, Y + 60, STONE);
    c(out, x + s * 15, z, 4.4, 4.6, Y + 58, Y + 62, GOLD);
    c(out, x + s * 15, z + 4.6, 1, 0.4, Y + 10, Y + 54, station === 'mode:versus' ? GOLD : SKYGLASS, 0.5);
  }
  b(out, [x - 20, Y + 62, z - 5], [x + 20, Y + 70, z + 5], STONE);
  b(out, [x - 20.6, Y + 66, z + 5], [x + 20.6, Y + 67.4, z + 5.8], GOLD);
  b(out, [x - 14, Y + 70, z - 4], [x + 14, Y + 76, z + 4], STONE_SH);
  b(out, [x - 11.2, Y + 56, z - 4], [x - 6, Y + 62, z + 4], STONE_SH);
  b(out, [x + 6, Y + 56, z - 4], [x + 11.2, Y + 62, z + 4], STONE_SH);
  // The doorway glows faintly; it is overhead and decorative, the pad is the trigger.
  b(out, [x - 11, Y + 53, z - 0.4], [x + 11, Y + 57, z + 0.4], station === 'mode:versus' ? LANTERN : SKYGLASS, 0.45);
  // Emblems: gavel (Solo), crossed blades (Versus), scales (Grand Jury).
  const ey = Y + 86;
  const ez = z;
  if (station === 'mode:solo') {
    c(out, x, ez, 7, 3, ey + 2, ey + 9, OAK);
    c(out, x - 7.6, ez, 1, 3.4, ey + 1.6, ey + 9.4, GOLD);
    c(out, x + 7.6, ez, 1, 3.4, ey + 1.6, ey + 9.4, GOLD);
    c(out, x + 2, ez, 1.2, 1.2, ey - 10, ey + 2, WOOD);
    c(out, x, ez, 6, 3, ey - 12, ey - 9, OAK);
  } else if (station === 'mode:versus') {
    for (let i = 0; i < 9; i++) {
      c(out, x - 8 + i * 2, ez, 1.2, 0.8, ey - 8 + i * 2.2, ey - 5.4 + i * 2.2, tone);
      c(out, x + 8 - i * 2, ez, 1.2, 0.8, ey - 8 + i * 2.2, ey - 5.4 + i * 2.2, tone);
    }
    c(out, x - 9, ez, 2.6, 1, ey - 11, ey - 9, RED);
    c(out, x + 9, ez, 2.6, 1, ey - 11, ey - 9, RED);
    c(out, x, ez, 2, 2, ey + 12, ey + 15, LANTERN, 0.9);
  } else {
    scales(out, x, ez + 1, ey, 1.1);
    c(out, x, ez - 0.5, 9, 0.4, ey - 9, ey + 8, ROOF);
  }
  // The pad: a glowing ring on the floor in front of the gate.
  const pz = PAD_Z;
  const glow = station === 'mode:versus' ? LANTERN : SKYGLASS;
  c(out, x, pz, 12, 7.4, Y, Y + 1.2, STONE_SH);
  c(out, x, pz, 7.4, 12, Y, Y + 1.2, STONE_SH);
  c(out, x, pz, 9.6, 6, Y + 1.2, Y + 1.5, glow, 0.7);
  c(out, x, pz, 6, 9.6, Y + 1.2, Y + 1.5, glow, 0.7);
  c(out, x, pz, 7, 4.2, Y + 1.5, Y + 1.7, STONE);
  c(out, x, pz, 4.2, 7, Y + 1.5, Y + 1.7, STONE);
  for (const s of [-1, 1]) lamp(out, x + s * 24, pz, Y, 40);
}

/** The seal across a bridge: a curtain of light between gold bars. */
function sealBoxes(z: number): GateSpec['boxes'] {
  const out: Out = [];
  const h = BRIDGE_HALF - 1;
  b(out, [-h, Y, z - 0.5], [h, Y + 46, z + 0.5], LANTERN, 0.5);
  for (let y = Y + 6; y < Y + 46; y += 10) b(out, [-h, y, z - 0.8], [h, y + 1, z + 0.8], GOLD, 0.7);
  for (let x = -h + 4; x < h; x += 8) b(out, [x - 0.4, Y, z - 0.8], [x + 0.4, Y + 46, z + 0.8], GOLD, 0.7);
  scales(out, 0, z + 1.2, Y + 24, 0.9);
  return out.map((x) => ({ ...x, glow: x.glow ?? 0.7 }));
}

/* ── Assembly ───────────────────────────────────────────────────────── */

export function approachBoxes(): Out {
  const out: Out = [];
  const { trials: T, wardrobe: W, arrival: A } = ISLANDS;

  // Islands.
  island(out, -T.x, T.z0, T.x, T.z1, Y, 80, 21);
  island(out, -W.x, W.z0, W.x, W.z1, Y, 70, 22);
  island(out, -A.x, A.z0, A.x, A.z1, Y, 84, 23);
  rim(out, T.x, T.z0, T.z1, true, true);
  rim(out, W.x, W.z0, W.z1, true, true);
  rim(out, A.x, A.z0, A.z1, true, false);
  // Bridges and their pier posts (the plaza→trials bridge is built with the plaza).
  for (const br of BRIDGES.slice(1)) bridge(out, 0, br.z0, br.z1, Y, BRIDGE_HALF);
  for (const br of BRIDGES) {
    const z = (br.z0 + br.z1) / 2;
    for (const s of [-1, 1]) {
      c(out, s * (BRIDGE_HALF + 1), z, 2.4, 2.4, Y - 2, Y + 50, STONE);
      c(out, s * (BRIDGE_HALF + 1), z, 2.8, 2.8, Y + 50, Y + 53, GOLD);
    }
  }

  // ── Arrival: the Shrine of Identity ─────────────────────────────
  b(out, [-14, Y, A.z0], [14, Y + 0.4, A.z1 - 6], STONE);
  for (const s of [-1, 1]) b(out, [s * 14, Y, A.z0], [s * 15.2, Y + 0.5, A.z1 - 6], GOLD);
  shrineArch(out, SHRINE_Z);
  plinth(out, PLINTH_Z);
  for (const s of [-1, 1]) {
    lawn(out, s > 0 ? 22 : -A.x + 4, A.z0 + 46, s > 0 ? A.x - 4 : -22, A.z1 - 6, Y, 41 + s);
    tree(out, s * 58, A.z0 + 66, Y + 0.6, 1.1);
    tree(out, s * 70, A.z1 - 26, Y + 0.6, 0.95);
    pine(out, s * 84, A.z0 + 12, Y, 1.1);
    lamp(out, s * 19, PLINTH_Z + 22, Y, 44);
    lamp(out, s * 19, A.z1 - 30, Y, 44);
    planter(out, s * 36, SHRINE_Z + 4, Y);
  }
  justice(out, 52, PLINTH_Z + 8, Y);
  noticeBoard(out, -48, PLINTH_Z + 14, Y);
  bench(out, -40, A.z1 - 20, Y + 0.6, -1);
  bench(out, 40, A.z1 - 20, Y + 0.6, -1);

  // ── Wardrobe ────────────────────────────────────────────────────
  b(out, [-12, Y, W.z0], [12, Y + 0.4, W.z1], STONE);
  dais(out, DAIS.x, DAIS.z, DAIS.r);
  for (const s of [-1, 1] as const) {
    wardrobe(out, s * 54, DAIS.z, s);
    mannequin(out, s * 34, DAIS.z - 24, s < 0 ? RED : SKYGLASS);
    mannequin(out, s * 34, DAIS.z + 24, s < 0 ? CREAM : RED);
    lamp(out, s * 20, W.z0 + 14, Y, 42);
    lamp(out, s * 20, W.z1 - 14, Y, 42);
    pine(out, s * 72, W.z0 + 10, Y, 1);
    pine(out, s * 72, W.z1 - 10, Y, 0.9);
    bannerPole(out, s * 30, W.z1 - 16, Y, 1);
  }
  // A standing mirror beside the dais.
  b(out, [-30, Y, DAIS.z - 1.2], [-28, Y + 50, DAIS.z + 1.2], GOLD);
  b(out, [28, Y, DAIS.z - 1.2], [30, Y + 50, DAIS.z + 1.2], GOLD);

  // ── Hall of Trials ──────────────────────────────────────────────
  b(out, [-14, Y, T.z0], [14, Y + 0.4, T.z1], STONE);
  b(out, [-88, Y, PAD_Z - 16], [88, Y + 0.4, PAD_Z + 16], STONE);
  for (const g of TRIAL_GATES) trialGate(out, g.x, g.station);
  for (const s of [-1, 1]) {
    lawn(out, s > 0 ? 18 : -T.x + 4, PAD_Z + 18, s > 0 ? T.x - 4 : -18, T.z1 - 6, Y, 51 + s);
    tree(out, s * 84, T.z1 - 28, Y + 0.6, 1.15);
    tree(out, s * 50, T.z1 - 18, Y + 0.6, 0.85);
    pine(out, s * 96, T.z0 + 12, Y, 1.2);
    bannerPole(out, s * 92, GATE_Z, Y, 1);
    bench(out, s * 44, T.z1 - 30, Y + 0.6, -1);
  }
  return out;
}

export function approachGates(): GateSpec[] {
  return BRIDGES.map((br) => {
    const z = (br.z0 + br.z1) / 2;
    return { id: br.gate, solid: aabb([-BRIDGE_HALF, Y - 4, z - 3], [BRIDGE_HALF, Y + 80, z + 3]), boxes: sealBoxes(z) };
  });
}

const SEAL_LINES: Readonly<Record<GateId, string>> = { verify: 'seal-verify', wardrobe: 'seal-wardrobe', trials: 'seal-trials' };

export function approachInteractables(): InteractableSpec[] {
  const out: InteractableSpec[] = [
    { id: 'station:verify', prompt: 'Verify with World ID', kind: 'station', station: 'verify', at: [0, Y + 44, PLINTH_Z], hull: aabb([-10, Y, PLINTH_Z - 2], [10, Y + 58, PLINTH_Z + 2]), range: 56 },
    { id: 'station:wardrobe', prompt: 'Open the wardrobe', kind: 'station', station: 'wardrobe', at: [0, Y + 6, DAIS.z], hull: aabb([-DAIS.r + 5, Y, DAIS.z - DAIS.r + 5], [DAIS.r - 5, Y + 3, DAIS.z + DAIS.r - 5]), range: 64 },
    { id: 'arrival-board', prompt: 'Read the notice board', kind: 'inspect', at: [-48, Y + 24, PLINTH_Z + 15], hull: aabb([-58, Y + 12, PLINTH_Z + 13], [-38, Y + 34, PLINTH_Z + 16]), range: 34, lines: 'arrival-board' },
    { id: 'mannequin', prompt: 'Look at the mannequin', kind: 'inspect', at: [-34, Y + 34, DAIS.z - 24], hull: aabb([-40, Y, DAIS.z - 28], [-28, Y + 52, DAIS.z - 20]), range: 30, lines: 'mannequin' },
  ];
  const label: Record<string, string> = { 'mode:solo': 'Choose Solo', 'mode:versus': 'Choose Versus', 'mode:grand-jury': 'Choose Grand Jury' };
  for (const g of TRIAL_GATES) {
    out.push({ id: `station:${g.station}`, prompt: label[g.station]!, kind: 'station', station: g.station, at: [g.x, Y + 4, PAD_Z], hull: aabb([g.x - 10, Y, PAD_Z - 10], [g.x + 10, Y + 2, PAD_Z + 10]), range: 70 });
  }
  for (const br of BRIDGES) {
    const z = (br.z0 + br.z1) / 2;
    out.push({ id: `seal:${br.gate}`, prompt: 'Touch the seal', kind: 'door', gate: br.gate, at: [0, Y + 30, z], hull: aabb([-BRIDGE_HALF, Y, z - 1], [BRIDGE_HALF, Y + 46, z + 1]), range: 44, lines: SEAL_LINES[br.gate] });
  }
  return out;
}

/** Room bounds for the islands and the bridges (the player never leaves their union). */
export function approachRooms(): Array<{ id: 'arrival' | 'wardrobe' | 'trials' | 'bridge'; bounds: Aabb }> {
  const { trials: T, wardrobe: W, arrival: A } = ISLANDS;
  const room = (x: number, z0: number, z1: number) => aabb([-x + 1, Y - 20, z0 + 0.5], [x - 1, 120, z1 - 0.5]);
  return [
    { id: 'trials', bounds: room(T.x, T.z0, T.z1) },
    { id: 'wardrobe', bounds: room(W.x, W.z0, W.z1) },
    { id: 'arrival', bounds: room(A.x, A.z0, A.z1) },
    // Bridge rooms reach well into both islands: a body must fit wholly inside one room at every step.
    ...BRIDGES.map((br) => ({ id: 'bridge' as const, bounds: aabb([-BRIDGE_HALF + 1, Y - 20, br.z0 - 8], [BRIDGE_HALF - 1, 120, br.z1 + 8]) })),
  ];
}

/** HUD zones: each island owns the bridge north of it. */
export function approachZones(): Array<{ id: 'arrival' | 'wardrobe' | 'trials'; label: string; rects: Array<{ x0: number; z0: number; x1: number; z1: number }> }> {
  const { trials: T, wardrobe: W, arrival: A } = ISLANDS;
  return [
    { id: 'trials', label: 'Hall of Trials', rects: [{ x0: -T.x, z0: GROUNDS.z1 + 0.01, x1: T.x, z1: T.z1 }] },
    { id: 'wardrobe', label: 'The Wardrobe', rects: [{ x0: -W.x, z0: T.z1 + 0.01, x1: W.x, z1: W.z1 }] },
    { id: 'arrival', label: 'Shrine of Identity', rects: [{ x0: -A.x, z0: W.z1 + 0.01, x1: A.x, z1: A.z1 }] },
  ];
}

/** Spawn on the arrival island's south end, facing the shrine. */
export const ARRIVAL_SPAWN: { pos: Vec3; look: Vec3 } = {
  pos: [0, Y, ISLANDS.arrival.z1 - 14],
  look: [0, Y + 40, PLINTH_Z],
};

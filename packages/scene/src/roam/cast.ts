/**
 * The voxel cast (assets/roam/cast.json, generated from cc-art/vox-chars.mjs by
 * scripts/gen-roam-cast.ts): typed parsing and renderer-free mesh building.
 *
 * Model space: 1 unit = 1 voxel, feet at y = 0, the face looks toward −Z (the
 * same convention as a player at yaw 0). The roam world scales models by
 * CAST_SCALE so a 96-voxel character stands as tall as the courtroom cast.
 */
import type { Vec3 } from './types';

export const CAST_GROUPS = ['body', 'head', 'armR', 'armL', 'legR', 'legL', 'shinR', 'shinL'] as const;
export type CastGroup = (typeof CAST_GROUPS)[number];

/** The groups the renderer animates separately; legs and shins render with the body. */
export type RigGroup = 'body' | 'head' | 'armR' | 'armL';
export const RIG_GROUPS: readonly RigGroup[] = ['body', 'head', 'armR', 'armL'];

/** World units per voxel: a 100-voxel character stands 48 tall: chibi cast at desk scale (desks are 28.6), the player's eye (44) just above their heads. */
export const CAST_SCALE = 0.48;

/** Row: x0 y0 z0 x1 y1 z1 colourIndex groupIndex [M00..M23 when posed]. */
export type CastRow = readonly number[];

export interface CastModel {
  label: string;
  height: number;
  stand: readonly CastRow[];
  /** Seated geometry (jurors), baked from the cc-art `seated` pose. */
  sit?: readonly CastRow[];
}

export interface CastFile {
  version: 1;
  source: string;
  colors: readonly string[];
  models: Readonly<Record<string, CastModel>>;
}

/** Joint pivots in model units, per posture (the seated pose drops the body 13 voxels). */
export const PIVOTS: Readonly<Record<'stand' | 'sit', Readonly<Record<Exclude<RigGroup, 'body'>, Vec3>>>> = {
  stand: { head: [0, 71, 0], armR: [19, 66, 0], armL: [-19, 66, 0] },
  sit: { head: [0, 58, 0], armR: [19, 53, 0], armL: [-19, 53, 0] },
};

export class CastDataError extends Error {
  constructor(message: string) {
    super(`cast.json: ${message}`);
    this.name = 'CastDataError';
  }
}

export function parseCast(input: unknown): CastFile {
  const o = input as Partial<CastFile>;
  if (!o || o.version !== 1) throw new CastDataError('expected version 1');
  if (!Array.isArray(o.colors) || !o.colors.every((c) => typeof c === 'string' && /^#[0-9A-F]{6}$/i.test(c))) throw new CastDataError('colors must be hex strings');
  if (!o.models || typeof o.models !== 'object') throw new CastDataError('models missing');
  const nColors = o.colors.length;
  const checkRows = (id: string, rows: unknown) => {
    if (!Array.isArray(rows) || rows.length === 0) throw new CastDataError(`${id} has no boxes`);
    for (const r of rows) {
      if (!Array.isArray(r) || (r.length !== 8 && r.length !== 20) || !r.every((n) => typeof n === 'number' && Number.isFinite(n))) throw new CastDataError(`${id} has a malformed box row`);
      if (r[6] < 0 || r[6] >= nColors || r[7] < 0 || r[7] >= CAST_GROUPS.length) throw new CastDataError(`${id} references a missing colour or group`);
    }
  };
  for (const [id, m] of Object.entries(o.models)) {
    checkRows(id, m.stand);
    if (m.sit) checkRows(`${id} (sit)`, m.sit);
  }
  return o as CastFile;
}

export interface GroupMesh {
  positions: Float32Array;
  normals: Float32Array;
  /** Linear-ish 0..1 RGB with the face shade baked in. */
  colors: Float32Array;
  indices: Uint32Array;
}

/** Minecraft-style fixed face shading: top bright, sides stepped, underside dark. */
export const FACE_SHADE: Readonly<Record<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', number>> = {
  py: 1,
  ny: 0.55,
  px: 0.8,
  nx: 0.8,
  pz: 0.9,
  nz: 0.9,
};

const FACES: ReadonlyArray<{ n: Vec3; c: readonly [number, number, number, number]; shade: number }> = [
  { n: [1, 0, 0], c: [1, 3, 7, 5], shade: FACE_SHADE.px },
  { n: [-1, 0, 0], c: [4, 6, 2, 0], shade: FACE_SHADE.nx },
  { n: [0, 1, 0], c: [2, 6, 7, 3], shade: FACE_SHADE.py },
  { n: [0, -1, 0], c: [0, 1, 5, 4], shade: FACE_SHADE.ny },
  { n: [0, 0, 1], c: [4, 5, 7, 6], shade: FACE_SHADE.pz },
  { n: [0, 0, -1], c: [1, 0, 2, 3], shade: FACE_SHADE.nz },
];

export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Build one mesh per rig group. Positions are relative to the group's pivot
 * (so the renderer rotates a group by rotating its node), in model units.
 */
export function buildCastMeshes(cast: CastFile, modelId: string, posture: 'stand' | 'sit' = 'stand'): Record<RigGroup, GroupMesh> {
  const model = cast.models[modelId];
  if (!model) throw new CastDataError(`no model "${modelId}"`);
  const rows = (posture === 'sit' && model.sit) || model.stand;
  const pivots = PIVOTS[posture === 'sit' && model.sit ? 'sit' : 'stand'];
  const byGroup: Record<RigGroup, CastRow[]> = { body: [], head: [], armR: [], armL: [] };
  for (const r of rows) {
    const g = CAST_GROUPS[r[7]!]!;
    const rig: RigGroup = g === 'head' || g === 'armR' || g === 'armL' ? g : 'body';
    byGroup[rig].push(r);
  }
  const rgb = cast.colors.map(hexToRgb01);
  const out = {} as Record<RigGroup, GroupMesh>;
  for (const g of RIG_GROUPS) {
    const list = byGroup[g];
    const pivot: Vec3 = g === 'body' ? [0, 0, 0] : pivots[g];
    const positions = new Float32Array(list.length * 24 * 3);
    const normals = new Float32Array(list.length * 24 * 3);
    const colors = new Float32Array(list.length * 24 * 3);
    const indices = new Uint32Array(list.length * 36);
    let v = 0;
    let ix = 0;
    for (const r of list) {
      const M = r.length === 20 ? r.slice(8) : null;
      const xf = (p: [number, number, number]): [number, number, number] =>
        M ? [M[0]! * p[0] + M[1]! * p[1] + M[2]! * p[2] + M[3]!, M[4]! * p[0] + M[5]! * p[1] + M[6]! * p[2] + M[7]!, M[8]! * p[0] + M[9]! * p[1] + M[10]! * p[2] + M[11]!] : p;
      const rot = (n: Vec3): Vec3 => {
        if (!M) return n;
        const x = M[0]! * n[0] + M[1]! * n[1] + M[2]! * n[2];
        const y = M[4]! * n[0] + M[5]! * n[1] + M[6]! * n[2];
        const z = M[8]! * n[0] + M[9]! * n[1] + M[10]! * n[2];
        const l = Math.hypot(x, y, z) || 1;
        return [x / l, y / l, z / l];
      };
      const corner = (k: number): [number, number, number] => xf([k & 1 ? r[3]! : r[0]!, k & 2 ? r[4]! : r[1]!, k & 4 ? r[5]! : r[2]!]);
      const c = rgb[r[6]!]!;
      for (const face of FACES) {
        const base = v;
        const n = rot(face.n);
        // Shade by the posed normal so tilted parts keep the top-lit read.
        const shade = n[1] > 0.5 ? FACE_SHADE.py : n[1] < -0.5 ? FACE_SHADE.ny : Math.abs(n[0]) > Math.abs(n[2]) ? FACE_SHADE.px : FACE_SHADE.pz;
        for (const k of face.c) {
          const p = corner(k);
          positions.set([p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]], v * 3);
          normals.set(n, v * 3);
          colors.set([c[0] * shade, c[1] * shade, c[2] * shade], v * 3);
          v++;
        }
        indices.set([base, base + 1, base + 2, base, base + 2, base + 3], ix);
        ix += 6;
      }
    }
    out[g] = { positions, normals, colors, indices };
  }
  return out;
}

export function castModelIds(cast: CastFile): string[] {
  return Object.keys(cast.models);
}

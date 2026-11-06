/**
 * courtroom.boxes.json → one merged, indexed buffer per material (SCENE-GUIDE
 * "merge by material": 1606 boxes → 16 draw calls). Pure typed arrays, so it is
 * testable in node and reused by any renderer.
 */

export interface Box {
  /** Min corner (world units). */
  f: readonly [number, number, number];
  /** Max corner. */
  t: readonly [number, number, number];
  /** Material: a palette hex colour. */
  m: string;
}

export interface MaterialBatch {
  color: string;
  boxes: number;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export class SceneDataError extends Error {
  constructor(message: string) {
    super(`courtroom.boxes.json: ${message}`);
    this.name = 'SceneDataError';
  }
}

export function parseBoxes(input: unknown): Box[] {
  if (!Array.isArray(input)) throw new SceneDataError('expected an array of boxes');
  return input.map((raw, i) => {
    const b = raw as Partial<Box>;
    const ok = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
    if (!ok(b.f) || !ok(b.t)) throw new SceneDataError(`box ${i} needs numeric f and t corners`);
    if (typeof b.m !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(b.m)) throw new SceneDataError(`box ${i} has no hex material`);
    if (b.t[0] < b.f[0] || b.t[1] < b.f[1] || b.t[2] < b.f[2]) throw new SceneDataError(`box ${i} has t < f`);
    return { f: b.f, t: b.t, m: b.m.toUpperCase() };
  });
}

// Face order: +X, −X, +Y, −Y, +Z, −Z. Corners are indices into the 8 box corners
// (bit 0 = x max, bit 1 = y max, bit 2 = z max), wound counter-clockwise from outside.
const FACES: ReadonlyArray<{ n: readonly [number, number, number]; c: readonly [number, number, number, number] }> = [
  { n: [1, 0, 0], c: [1, 3, 7, 5] },
  { n: [-1, 0, 0], c: [4, 6, 2, 0] },
  { n: [0, 1, 0], c: [2, 6, 7, 3] },
  { n: [0, -1, 0], c: [0, 1, 5, 4] },
  { n: [0, 0, 1], c: [4, 5, 7, 6] },
  { n: [0, 0, -1], c: [1, 0, 2, 3] },
];

/** Merge boxes by material. Zero-volume axes still emit faces (thin trims are intentional). */
export function mergeByMaterial(boxes: readonly Box[]): MaterialBatch[] {
  const groups = new Map<string, Box[]>();
  for (const b of boxes) {
    if (!groups.has(b.m)) groups.set(b.m, []);
    groups.get(b.m)!.push(b);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([color, list]) => {
      const positions = new Float32Array(list.length * 24 * 3);
      const normals = new Float32Array(list.length * 24 * 3);
      const indices = new Uint32Array(list.length * 36);
      let v = 0;
      let ix = 0;
      for (const b of list) {
        const corner = (k: number) => [k & 1 ? b.t[0] : b.f[0], k & 2 ? b.t[1] : b.f[1], k & 4 ? b.t[2] : b.f[2]] as const;
        for (const face of FACES) {
          const base = v;
          for (const k of face.c) {
            const p = corner(k);
            positions.set(p, v * 3);
            normals.set(face.n, v * 3);
            v++;
          }
          indices.set([base, base + 1, base + 2, base, base + 2, base + 3], ix);
          ix += 6;
        }
      }
      return { color, boxes: list.length, positions, normals, indices };
    });
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export function boundsOf(boxes: readonly Box[]): Bounds {
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

/** Emissive surfaces (ASSET-GUIDE §6): window glass and screen, sconce tips, the neon tube. */
export const EMISSIVE: Readonly<Record<string, number>> = {
  '#BDF5FF': 0.55,
  '#FFD79A': 0.9,
  '#FF7AC6': 1.4,
};

/** Surface feel per palette colour: velvet and carpet are rough, gold and marble a little glossy. */
export function roughnessFor(color: string): number {
  switch (color) {
    case '#D9A046':
    case '#F6C75B':
    case '#B77D3A':
      return 0.42;
    case '#FFF9ED':
    case '#DCC8B0':
      return 0.6;
    case '#A32D3F':
    case '#7A1C2E':
      return 0.95;
    default:
      return 0.82;
  }
}

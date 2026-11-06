/**
 * The static world as a handful of merged meshes: boxes grouped by
 * (colour, glow, face), each face given world-space UVs on the shared pixel
 * grid and a baked Minecraft face shade in its vertex colour. Colours whose
 * tops wear their own tile (marble floors, lawns) split their upward faces into
 * a second batch. ~2,400 boxes → ~35 draw calls; nothing static is re-uploaded
 * after build.
 */
import * as THREE from 'three';
import { FACE_SHADE } from '../cast';
import type { RoamBox } from '../world';
import { hasTopTile, surfaceFor, surfaceGain, surfaceTexture, TEXEL, TILE, type FaceKind } from './textures';

export interface WorldBatch {
  color: string;
  glow: number;
  /** `top` holds only upward faces of a colour with a top tile; `side` holds the rest. */
  face: FaceKind;
  boxes: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  shades: Float32Array;
  indices: Uint32Array;
}

const FACES = [
  { n: [1, 0, 0], c: [1, 3, 7, 5], shade: FACE_SHADE.px, u: 2, v: 1 },
  { n: [-1, 0, 0], c: [4, 6, 2, 0], shade: FACE_SHADE.nx, u: 2, v: 1 },
  { n: [0, 1, 0], c: [2, 6, 7, 3], shade: FACE_SHADE.py, u: 0, v: 2 },
  { n: [0, -1, 0], c: [0, 1, 5, 4], shade: FACE_SHADE.ny, u: 0, v: 2 },
  { n: [0, 0, 1], c: [4, 5, 7, 6], shade: FACE_SHADE.pz, u: 0, v: 1 },
  { n: [0, 0, -1], c: [1, 0, 2, 3], shade: FACE_SHADE.nz, u: 0, v: 1 },
] as const;

/** Pure: merge boxes into typed-array batches (tested in node). */
export function batchWorld(boxes: readonly RoamBox[]): WorldBatch[] {
  const groups = new Map<string, RoamBox[]>();
  for (const b of boxes) {
    const k = `${b.m}|${b.glow ?? 0}`;
    let list = groups.get(k);
    if (!list) groups.set(k, (list = []));
    list.push(b);
  }
  const scale = 1 / (TEXEL * TILE);
  const out: WorldBatch[] = [];
  for (const [key, list] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const [color, glowText] = key.split('|') as [string, string];
    const glow = Number(glowText);
    if (!hasTopTile(color, glow)) out.push(merge(color, glow, 'side', list, FACES, scale));
    else {
      out.push(merge(color, glow, 'side', list, FACES.filter((f) => f.n[1] !== 1), scale));
      out.push(merge(color, glow, 'top', list, FACES.filter((f) => f.n[1] === 1), scale));
    }
  }
  return out;
}

type Face = (typeof FACES)[number];

function merge(color: string, glow: number, face: FaceKind, list: readonly RoamBox[], faces: readonly Face[], scale: number): WorldBatch {
  const n = list.length * faces.length * 4;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  const shades = new Float32Array(n * 3);
  const indices = new Uint32Array(list.length * faces.length * 6);
  let v = 0;
  let ix = 0;
  for (const b of list) {
    for (const f of faces) {
      const base = v;
      for (const k of f.c) {
        const p = [k & 1 ? b.t[0] : b.f[0], k & 2 ? b.t[1] : b.f[1], k & 4 ? b.t[2] : b.f[2]] as const;
        positions.set(p, v * 3);
        normals.set(f.n, v * 3);
        uvs.set([p[f.u] * scale, p[f.v] * scale], v * 2);
        shades.set([f.shade, f.shade, f.shade], v * 3);
        v++;
      }
      indices.set([base, base + 1, base + 2, base, base + 2, base + 3], ix);
      ix += 6;
    }
  }
  return { color, glow, face, boxes: list.length, positions, normals, uvs, shades, indices };
}

export interface WorldMeshes {
  group: THREE.Group;
  drawCalls: number;
  dispose(): void;
}

export function buildWorldMeshes(boxes: readonly RoamBox[]): WorldMeshes {
  const group = new THREE.Group();
  group.name = 'roam-world';
  const owned: Array<THREE.BufferGeometry | THREE.Material> = [];
  for (const batch of batchWorld(boxes)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(batch.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(batch.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(batch.uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(batch.shades, 3));
    geometry.setIndex(new THREE.BufferAttribute(batch.indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const kind = surfaceFor(batch.color, batch.glow, batch.face);
    const map = surfaceTexture(kind);
    const color = new THREE.Color(batch.color).multiplyScalar(surfaceGain(kind));
    const material =
      batch.glow > 0
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(batch.color).multiplyScalar(1 + batch.glow * 1.1), map, vertexColors: true, fog: true })
        : new THREE.MeshLambertMaterial({ color, map, vertexColors: true });
    material.name = `roam:${batch.color}${batch.glow ? ':glow' : ''}${batch.face === 'top' ? ':top' : ''}`;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = material.name;
    mesh.receiveShadow = batch.glow === 0;
    // Big static batches cast shadows too; thin trims are mostly flush with walls.
    mesh.castShadow = batch.glow === 0;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    owned.push(geometry, material);
  }
  return {
    group,
    drawCalls: group.children.length,
    dispose: () => owned.forEach((o) => o.dispose()),
  };
}

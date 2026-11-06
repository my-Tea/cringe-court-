/** Small helpers for authoring box lists (the same {f, t, m} shape as courtroom.boxes.json). */
import type { Box } from '../../courtroom/geometry';
import type { Aabb, Vec3 } from '../types';

export function box(f: Vec3, t: Vec3, m: string): Box {
  return {
    f: [Math.min(f[0], t[0]), Math.min(f[1], t[1]), Math.min(f[2], t[2])],
    t: [Math.max(f[0], t[0]), Math.max(f[1], t[1]), Math.max(f[2], t[2])],
    m: m.toUpperCase(),
  };
}

export function within(b: Box, r: { x?: [number, number]; y?: [number, number]; z?: [number, number] }): boolean {
  const ok = (i: 0 | 1 | 2, range?: [number, number]) => !range || (b.f[i] >= range[0] - 1e-6 && b.t[i] <= range[1] + 1e-6);
  return ok(0, r.x) && ok(1, r.y) && ok(2, r.z);
}

export function centre(b: Box): Vec3 {
  return [(b.f[0] + b.t[0]) / 2, (b.f[1] + b.t[1]) / 2, (b.f[2] + b.t[2]) / 2];
}

export function translate(list: readonly Box[], d: Vec3): Box[] {
  return list.map((b) => box([b.f[0] + d[0], b.f[1] + d[1], b.f[2] + d[2]], [b.t[0] + d[0], b.t[1] + d[1], b.t[2] + d[2]], b.m));
}

/** Mirror across the plane z = c (turns a −Z-facing prop around). */
export function mirrorZ(list: readonly Box[], c: number): Box[] {
  return list.map((b) => box([b.f[0], b.f[1], 2 * c - b.t[2]], [b.t[0], b.t[1], 2 * c - b.f[2]], b.m));
}

/** Rotate 90° about the Y axis through (cx, cz): (x, z) → (cx + (z − cz), cz − (x − cx)). */
export function rotY90(list: readonly Box[], cx: number, cz: number): Box[] {
  return list.map((b) => {
    const p = (x: number, z: number): [number, number] => [cx + (z - cz), cz - (x - cx)];
    const [ax, az] = p(b.f[0], b.f[2]);
    const [bx, bz] = p(b.t[0], b.t[2]);
    return box([ax, b.f[1], az], [bx, b.t[1], bz], b.m);
  });
}

export function aabbOf(list: readonly Box[]): Aabb {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of list) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, b.f[i]!);
      max[i] = Math.max(max[i]!, b.t[i]!);
    }
  }
  return { min, max };
}

export function aabb(min: Vec3, max: Vec3): Aabb {
  return { min, max };
}

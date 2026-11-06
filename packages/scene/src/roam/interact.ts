/**
 * Interaction focus: which interactable the player is "looking at". A ray from
 * the eye that hits an interactable's hull wins (nearest hit); otherwise the
 * best-aligned candidate inside a narrow cone. Pure, so it is unit tested.
 */
import type { Aabb, InteractableSpec, Vec3 } from './types';

/** Half-angle of the fallback cone (radians). */
export const FOCUS_CONE = 0.3;

export function lookDir(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

/** Slab test. Returns the entry distance along `dir`, or null. */
export function rayAabb(origin: Vec3, dir: Vec3, box: Aabb, maxT = Infinity): number | null {
  let t0 = 0;
  let t1 = maxT;
  for (let i = 0; i < 3; i++) {
    const o = origin[i]!;
    const d = dir[i]!;
    const lo = box.min[i]!;
    const hi = box.max[i]!;
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let a = (lo - o) / d;
    let b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
}

export interface FocusResult {
  id: string;
  /** How it was chosen. */
  via: 'ray' | 'cone';
  distance: number;
}

export function selectFocus(eye: Vec3, dir: Vec3, items: readonly InteractableSpec[], enabled: (item: InteractableSpec) => boolean = () => true): FocusResult | null {
  let best: FocusResult | null = null;
  for (const it of items) {
    if (!enabled(it)) continue;
    const dx = it.at[0] - eye[0];
    const dy = it.at[1] - eye[1];
    const dz = it.at[2] - eye[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist > it.range) continue;
    const t = rayAabb(eye, dir, it.hull, it.range);
    if (t !== null && (!best || best.via !== 'ray' || t < best.distance)) best = { id: it.id, via: 'ray', distance: t };
  }
  if (best) return best;
  let bestAngle = FOCUS_CONE;
  for (const it of items) {
    if (!enabled(it)) continue;
    const v: Vec3 = [it.at[0] - eye[0], it.at[1] - eye[1], it.at[2] - eye[2]];
    const dist = Math.hypot(v[0], v[1], v[2]);
    if (dist > it.range || dist < 1e-6) continue;
    const cos = (v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / dist;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle < bestAngle) {
      bestAngle = angle;
      best = { id: it.id, via: 'cone', distance: dist };
    }
  }
  return best;
}

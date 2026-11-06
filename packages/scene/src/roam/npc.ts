/**
 * NPC attention: heads turn toward the nearest player in range (local or
 * remote), clamped to a believable neck, eased so they never snap.
 */
import type { NpcPose, NpcSpec, NpcState, Vec3 } from './types';

import { ROOM_SCALE } from './scale';

export const HEAD_RANGE = 90 * ROOM_SCALE;
export const HEAD_YAW_MAX = 1.1;
export const HEAD_PITCH_MAX = 0.45;
/** Radians per second. */
export const HEAD_SPEED = 3.2;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Head yaw/pitch (relative to the body) that looks at `target`, or null when out of range or behind. */
export function headTarget(npc: Pick<NpcSpec, 'pos' | 'yaw'>, head: Vec3, target: Vec3): { yaw: number; pitch: number } | null {
  const dx = target[0] - head[0];
  const dz = target[2] - head[2];
  const flat = Math.hypot(dx, dz);
  if (flat > HEAD_RANGE || flat < 1) return null;
  const world = Math.atan2(-dx, -dz);
  const rel = wrap(world - npc.yaw);
  // Behind the shoulder: lose interest rather than spin the head around.
  if (Math.abs(rel) > HEAD_YAW_MAX + 0.6) return null;
  const yaw = Math.max(-HEAD_YAW_MAX, Math.min(HEAD_YAW_MAX, rel));
  const pitch = Math.max(-HEAD_PITCH_MAX, Math.min(HEAD_PITCH_MAX, Math.atan2(target[1] - head[1], flat)));
  return { yaw, pitch };
}

function approach(v: number, t: number, d: number): number {
  return v < t ? Math.min(v + d, t) : Math.max(v - d, t);
}

export function initialNpcState(n: NpcSpec): NpcState {
  return { id: n.id, pose: n.seated ? 'sit' : 'stand', headYaw: 0, headPitch: 0, yaw: n.yaw, talking: false };
}

/** Advance one NPC's head toward the nearest watched point (or forward). Mutates `s`. */
export function updateNpcHead(s: NpcState, n: NpcSpec, head: Vec3, watch: readonly Vec3[], dt: number, override?: Vec3 | null): void {
  let goal: { yaw: number; pitch: number } | null = null;
  if (override) goal = headTarget({ pos: n.pos, yaw: s.yaw }, head, override);
  if (!goal) {
    let bestD = Infinity;
    for (const w of watch) {
      const d = Math.hypot(w[0] - head[0], w[2] - head[2]);
      if (d >= bestD) continue;
      const g = headTarget({ pos: n.pos, yaw: s.yaw }, head, w);
      if (g) {
        bestD = d;
        goal = g;
      }
    }
  }
  const step = HEAD_SPEED * dt;
  s.headYaw = approach(s.headYaw, goal?.yaw ?? 0, step);
  s.headPitch = approach(s.headPitch, goal?.pitch ?? 0, step);
}

export const REACTION_POSES: readonly NpcPose[] = ['cheer', 'shock', 'facepalm'];

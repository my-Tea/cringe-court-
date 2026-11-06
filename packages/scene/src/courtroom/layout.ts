/**
 * courtroom.layout.json (room, prop instances, camera presets) plus the stage
 * marks from ANIMATION-GUIDE §7 and engine close-up shots.
 */
import type { CameraShot, StageMark } from '@cringe-court/core';

export type Vec3 = readonly [number, number, number];

export interface CameraPreset {
  pos: Vec3;
  target: Vec3;
  fov: number;
}

export interface PropInstance {
  prop: string;
  pos: Vec3;
  rot: number;
  scale: number;
  boxes: number;
}

export interface CourtroomLayout {
  room: { w: number; d: number; h: number; wall: number; bay: number };
  props: readonly PropInstance[];
  shots: Readonly<Record<string, CameraPreset>>;
}

function vec(v: unknown, what: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every((n) => typeof n === 'number')) throw new Error(`courtroom.layout.json: ${what} is not a vec3`);
  return [v[0] as number, v[1] as number, v[2] as number];
}

export function parseLayout(input: unknown): CourtroomLayout {
  const o = input as { room?: CourtroomLayout['room']; layout?: unknown[]; shots?: Record<string, { pos: unknown; target: unknown; fov: unknown }> };
  if (!o?.room || !Array.isArray(o.layout) || !o.shots) throw new Error('courtroom.layout.json: needs room, layout and shots');
  const shots: Record<string, CameraPreset> = {};
  for (const [id, s] of Object.entries(o.shots)) {
    if (typeof s.fov !== 'number') throw new Error(`courtroom.layout.json: shot ${id} has no fov`);
    shots[id] = { pos: vec(s.pos, `${id}.pos`), target: vec(s.target, `${id}.target`), fov: s.fov };
  }
  const props = o.layout.map((p, i) => {
    const r = p as Record<string, unknown>;
    if (typeof r.prop !== 'string') throw new Error(`courtroom.layout.json: layout[${i}] has no prop`);
    return { prop: r.prop, pos: vec(r.pos, `layout[${i}].pos`), rot: Number(r.rot ?? 0), scale: Number(r.scale ?? 1), boxes: Number(r.boxes ?? 0) };
  });
  return { room: o.room, props, shots };
}

export interface MarkSpec {
  pos: Vec3;
  /** Facing as a yaw (radians, 0 = +Z toward the room). Billboards still face the camera; this orients shadows/offsets. */
  yaw: number;
}

/**
 * Where each mark stands. ANIMATION-GUIDE §7 positions; the seven jury seats fan
 * out along the jury box (x = 84, facing −X). Juror y lifts them onto the box bench.
 */
export const STAGE_MARKS: Readonly<Record<StageMark, MarkSpec>> = {
  bench: { pos: [0, 21, -62], yaw: 0 },
  prosecution: { pos: [-56, 0, -22], yaw: 0 },
  defense: { pos: [56, 0, -22], yaw: 0 },
  witness: { pos: [-30, 0, -38], yaw: 0 },
  bailiff: { pos: [-18, 0, 8], yaw: 0 },
  clerk: { pos: [-30, 0, -6], yaw: 0 },
  'jury-1': { pos: [80, 4, -52], yaw: -Math.PI / 2 },
  'jury-2': { pos: [80, 4, -40], yaw: -Math.PI / 2 },
  'jury-3': { pos: [80, 4, -28], yaw: -Math.PI / 2 },
  'jury-4': { pos: [68, 0, -58], yaw: -Math.PI / 2 },
  'jury-5': { pos: [68, 0, -46], yaw: -Math.PI / 2 },
  'jury-6': { pos: [68, 0, -34], yaw: -Math.PI / 2 },
  'jury-7': { pos: [68, 0, -22], yaw: -Math.PI / 2 },
  'gallery-1': { pos: [-40, 4, 34], yaw: Math.PI },
  'gallery-2': { pos: [-14, 4, 46], yaw: Math.PI },
  'gallery-3': { pos: [14, 4, 34], yaw: Math.PI },
  'gallery-4': { pos: [40, 4, 46], yaw: Math.PI },
};

/** Engine close-ups, composed for the marks above (eye level ≈ 48–62, never inside the jury box). */
export const CLOSE_UPS: Readonly<Record<Extract<CameraShot, `close_${string}`>, CameraPreset>> = {
  close_judge: { pos: [0, 62, -14], target: [0, 52, -62], fov: 40 },
  close_prosecution: { pos: [-26, 50, 18], target: [-56, 36, -22], fov: 44 },
  close_defense: { pos: [26, 50, 18], target: [56, 36, -22], fov: 44 },
  close_jury: { pos: [30, 56, -6], target: [78, 38, -40], fov: 50 },
  close_witness: { pos: [-6, 50, -2], target: [-30, 36, -38], fov: 44 },
};

export function cameraFor(layout: CourtroomLayout, shot: CameraShot): CameraPreset {
  if (shot.startsWith('close_')) return CLOSE_UPS[shot as keyof typeof CLOSE_UPS];
  const preset = layout.shots[shot];
  if (!preset) throw new Error(`No camera preset "${shot}" in courtroom.layout.json`);
  return preset;
}

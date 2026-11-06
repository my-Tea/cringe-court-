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
 * Where each mark stands. ANIMATION-GUIDE §7 positions, adjusted so counsel stand
 * behind their desks. Seats 1–3 are the jury box's three velvet seats (box at
 * x = 84, rot 270, scale 1.3); a 7-person Grand Jury adds four standing jurors in front.
 */
export const STAGE_MARKS: Readonly<Record<StageMark, MarkSpec>> = {
  bench: { pos: [0, 21, -62], yaw: 0 },
  // Counsel stand behind their desks (desk instances sit at z = −22).
  prosecution: { pos: [-50, 0, -34], yaw: 0 },
  defense: { pos: [50, 0, -34], yaw: 0 },
  witness: { pos: [-30, 0, -45], yaw: 0 },
  // By the bar on the prosecution side, clear of the entrance sightline.
  bailiff: { pos: [-74, 0, 4], yaw: 0 },
  clerk: { pos: [30, 0, -50], yaw: 0 },
  'jury-1': { pos: [83, 6, -58], yaw: -Math.PI / 2 },
  'jury-2': { pos: [83, 6, -40], yaw: -Math.PI / 2 },
  'jury-3': { pos: [83, 6, -22], yaw: -Math.PI / 2 },
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
  close_judge: { pos: [0, 70, -12], target: [0, 64, -62], fov: 42 },
  close_prosecution: { pos: [-20, 54, 22], target: [-50, 44, -34], fov: 42 },
  close_defense: { pos: [20, 54, 22], target: [50, 44, -34], fov: 42 },
  close_jury: { pos: [30, 56, 8], target: [82, 30, -40], fov: 50 },
  close_witness: { pos: [0, 54, 10], target: [-30, 42, -38], fov: 44 },
};

export function cameraFor(layout: CourtroomLayout, shot: CameraShot): CameraPreset {
  if (shot.startsWith('close_')) return CLOSE_UPS[shot as keyof typeof CLOSE_UPS];
  const preset = layout.shots[shot];
  if (!preset) throw new Error(`No camera preset "${shot}" in courtroom.layout.json`);
  return preset;
}

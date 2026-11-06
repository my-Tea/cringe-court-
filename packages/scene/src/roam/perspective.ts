/**
 * How the roaming court is seen.
 *
 * `auto` is third-person isometric and nothing else: the camera keeps the
 * fixed rake and never drops into the eyes. First person is an explicit choice.
 */
export const PERSPECTIVES = ['auto', 'first'] as const;
export type PerspectiveChoice = (typeof PERSPECTIVES)[number];
export type CameraMode = 'iso' | 'first';

export function cameraMode(choice: PerspectiveChoice): CameraMode {
  return choice === 'first' ? 'first' : 'iso';
}

/** Fixed 2:1 dimetric rake, shared by the town and the roaming third person. */
export const ISO_RAKE = {
  yaw: Math.PI / 4,
  pitch: Math.PI / 6,
} as const;

/**
 * Camera rig. Indoors the camera sits above the room; the renderer cuts the
 * roof off so the rake looks into the room. Outside it sits high over the plaza.
 */
export function isoRig(outside: boolean): { distance: number; lookY: number; frustum: number; ceiling: number } {
  return outside
    ? { distance: 560, lookY: 42, frustum: 250, ceiling: 800 }
    : { distance: 340, lookY: 40, frustum: 170, ceiling: 420 };
}

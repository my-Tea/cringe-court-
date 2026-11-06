/**
 * How the roaming court is seen.
 *
 * `auto` is the Minecraft-style third person: the camera trails behind the
 * player's head, the mouse orbits it, and walls pull it in. First person is an
 * explicit choice. Both share one yaw and pitch, so switching never spins you.
 */
export const PERSPECTIVES = ['auto', 'first'] as const;
export type PerspectiveChoice = (typeof PERSPECTIVES)[number];
export type CameraMode = 'third' | 'first';

export function cameraMode(choice: PerspectiveChoice): CameraMode {
  return choice === 'first' ? 'first' : 'third';
}

/**
 * Third-person rig, in world units. A player is 50 tall (≈1.8 blocks), so
 * `distance` is a little past Minecraft's four blocks behind the head; with
 * the renderer's 70° field of view the player stands about 29% of the screen
 * tall, as Steve does. `lift` raises the
 * pivot over the eyes so the head sits just under the crosshair, not on it.
 * `cinematic` is the tighter over-the-shoulder distance used while a beat holds
 * the camera.
 */
export const THIRD_RIG = {
  distance: 125,
  cinematic: 72,
  lift: 14,
  /** Gap kept between the camera and any wall it backs into. */
  margin: 4,
  /** Closer than this, the player's own body is hidden (it would fill the screen). */
  hideBelow: 26,
  /** Easing back out after a wall let go (per second). Pulling in is instant. */
  easeOut: 6,
} as const;

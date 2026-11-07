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
 * Third-person rig, in world units. A player is 50 tall (≈1.8 blocks);
 * `distance` keeps the camera far enough back that, with the renderer's 70°
 * field of view, the player stands about a fifth of the screen tall and the
 * world around them reads first. `lift` raises the
 * pivot over the eyes so the head sits just under the crosshair, not on it.
 * `cinematic` is the tighter over-the-shoulder distance used while a beat holds
 * the camera and is not framing anyone.
 * `closeup` is how far the lens sits from the person a beat is looking at.
 * Counsel Chaos stands beside the defendant's chair, so a seated view already
 * fills the frame with him. The judge, the prosecution and the jury are across
 * the room; without this they stay small while he reads as a zoom.
 */
export const THIRD_RIG = {
  distance: 175,
  cinematic: 72,
  closeup: 96,
  /** Never push the lens inside a face. */
  closeupMin: 38,
  lift: 14,
  /** Gap kept between the camera and any wall it backs into. */
  margin: 4,
  /** Closer than this, the player's own body is hidden (it would fill the screen). */
  hideBelow: 26,
  /** Easing back out after a wall let go (per second). Pulling in is instant. */
  easeOut: 6,
} as const;

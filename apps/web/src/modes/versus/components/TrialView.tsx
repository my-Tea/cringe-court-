/**
 * The seam between a Versus case and whatever draws the trial.
 *
 * Today that is the 2D cutout `Courtroom`. The first-person roaming courtroom
 * (`<RoamCourtroom>`, branch v3/roam-fp) replaces it at integration by
 * re-pointing this file: the case pages only ever pass the frozen lines,
 * exhibits, filing, jury seats and verdict, and never reach into camera or
 * scene state.
 */
export { Courtroom as TrialView, type CourtroomProps as TrialViewProps, type CourtroomSeat as TrialSeat } from './Courtroom';

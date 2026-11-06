import { lazy, type ComponentType } from 'react';
import type { AudioPort, CastMember, CourtLine } from '@cringe-court/core';

/**
 * The seam between the Solo trial (Courtroom.tsx: dialogue, transport,
 * transcript, live region) and whatever renders the room behind it.
 *
 * A view receives one beat at a time: the current transcript line and its
 * index. It performs the beat (camera, poses, fx, positional sound) and must
 * stay decorative for assistive tech: Courtroom already speaks every line.
 * The illustrated stage is always underneath, so a view that cannot load just
 * calls `onError` and the trial carries on.
 *
 * Today the default is the voxel courtroom (@cringe-court/scene). The
 * first-person roaming courtroom (<RoamCourtroom>, v3/roam-fp) plugs in here by
 * wrapping `roam.runBeat(line)` in a component with these props.
 */
export interface TrialViewProps {
  line: CourtLine;
  /** Position of `line` in the transcript (beats can be revisited out of order). */
  index: number;
  cast: readonly CastMember[];
  audio?: AudioPort;
  reducedMotion: boolean;
  onReady: () => void;
  onError: (error: Error) => void;
}

export interface TrialView {
  Component: ComponentType<TrialViewProps>;
  /** Toggle label in the control bar. */
  label: string;
  /** Only offer the view when WebGL 2 is present. */
  requiresWebGL: boolean;
  /** The view plays the shot's sound cues itself (positional audio); Courtroom stays quiet while it is on. */
  ownsSound: boolean;
}

export const voxelTrialView: TrialView = {
  Component: lazy(() => import('./VoxelStage')),
  label: '3D courtroom (preview)',
  requiresWebGL: true,
  ownsSound: true,
};

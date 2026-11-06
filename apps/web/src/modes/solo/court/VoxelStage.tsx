/**
 * The 3D voxel courtroom (@cringe-court/scene, three.js) for the Solo trial.
 * Each transcript line is compiled by the engine's director (`directTrial`) and
 * its cues are performed through the ScenePort: camera, character animations,
 * lighting, props and fx. Dialogue, callouts and the transcript stay in the DOM
 * (Courtroom.tsx), so the canvas is decorative for assistive tech.
 *
 * Lazy-loaded: three.js only downloads when someone watches a trial.
 */
import { useEffect, useRef } from 'react';
import type { AudioPort, CastMember, CourtLine } from '@cringe-court/core';
import { directTrial } from '@cringe-court/engine';
import { Courtroom as VoxelCanvas, useCourtroom } from '@cringe-court/scene/react';
import { useReducedMotion } from '@/ds';
import styles from './Courtroom.module.css';

export interface VoxelStageProps {
  line: CourtLine;
  cast: readonly CastMember[];
  audio?: AudioPort;
  /** The scene could not load (no WebGL, asset error): fall back to the illustrated stage. */
  onError: (error: Error) => void;
  onReady: () => void;
}

export default function VoxelStage({ line, cast, audio, onError, onReady }: VoxelStageProps) {
  const reduced = useReducedMotion();
  const status = useCourtroom({ reducedMotion: reduced });
  const talking = useRef<string | null>(null);
  const castReady = useRef(false);

  useEffect(() => {
    if (status.state === 'error') onError(status.error);
    if (status.state !== 'ready' || castReady.current) return;
    // The bailiff and clerk stand between the camera and the bench in the wide shot.
    status.runtime.setCast(cast.filter((c) => c.actor !== 'bailiff' && c.actor !== 'clerk'));
    status.port.camera('pov_well', 0);
    castReady.current = true;
    onReady();
  }, [status, cast, onError, onReady]);

  useEffect(() => {
    if (status.state !== 'ready') return;
    const { runtime, port } = status;
    let show;
    try {
      show = directTrial(`line-${line.id}`, [line], cast.filter((c) => c.actor !== 'bailiff' && c.actor !== 'clerk'));
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    if (talking.current) runtime.setTalking(talking.current, false);
    for (const cue of show.cues) {
      switch (cue.kind) {
        case 'camera':
          // The scene's close-up presets are still being tuned (v3/p4-core); hold the wide shots.
          port.camera(cue.shot === 'pov_corner' ? 'pov_corner' : 'pov_well', cue.seconds);
          break;
        case 'animate':
          void port.animate(cue.actor, cue.animation);
          break;
        case 'system':
          // The entrance plays once, on the call to order.
          if (cue.animation !== 'enter_court' || line.segment === 'call-to-order') void port.system(cue.animation);
          break;
        case 'lighting':
          port.lighting(cue.mood, cue.seconds);
          break;
        case 'prop':
          port.prop(cue.state);
          break;
        case 'fx':
          if (!reduced) port.fx(cue.effect, cue.actor);
          break;
        case 'say':
          runtime.setTalking(cue.actor, true);
          talking.current = cue.actor;
          break;
        case 'sound':
          audio?.play(cue.cue, cue.pan !== undefined ? { pan: cue.pan } : {});
          break;
        default:
          break;
      }
    }
  }, [status, line, cast, audio, reduced, onError]);

  if (status.state !== 'ready') {
    return status.state === 'loading' ? (
      <div className={styles.voxelLoading} aria-hidden>
        <span>Building the courtroom… {Math.round(status.progress * 100)}%</span>
      </div>
    ) : null;
  }
  return <VoxelCanvas runtime={status.runtime} className={styles.voxel} label="The voxel courtroom" />;
}

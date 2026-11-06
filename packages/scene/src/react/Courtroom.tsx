import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, type CSSProperties } from 'react';
import * as THREE from 'three';
import type { CourtroomRuntime } from '../three/runtime';

function Driver({ runtime, paused }: { runtime: CourtroomRuntime; paused: boolean }) {
  const size = useThree((s) => s.size);

  useEffect(() => runtime.setViewport(size.width, size.height), [runtime, size.width, size.height]);

  // Priority 1: this component owns rendering (the runtime has its own scene and camera).
  useFrame((state, dt) => {
    if (!paused) runtime.update(dt);
    state.gl.render(runtime.scene, runtime.camera);
  }, 1);
  return null;
}

export interface CourtroomProps {
  runtime: CourtroomRuntime;
  /** Stop advancing time (e.g. the trial is paused); keeps drawing. */
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible description of the scene for screen readers. */
  label: string;
}

/** The voxel courtroom canvas. Decorative for assistive tech; the transcript carries the content. */
export function Courtroom({ runtime, paused = false, className, style, label }: CourtroomProps) {
  return (
    <div className={className} style={style} role="img" aria-label={label}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, outputColorSpace: THREE.SRGBColorSpace }}
        frameloop="always"
        aria-hidden="true"
      >
        <Driver runtime={runtime} paused={paused} />
      </Canvas>
    </div>
  );
}

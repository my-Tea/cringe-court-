import type { ScenePort } from '@cringe-court/core';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ATLAS_IMAGE_URLS } from '../assets';
import { loadCourtroomData } from '../load';
import { CourtroomRuntime, asScenePort } from '../three/runtime';

export type CourtroomStatus =
  | { state: 'loading'; progress: number }
  | { state: 'ready'; runtime: CourtroomRuntime; port: ScenePort }
  | { state: 'error'; error: Error };

function loadTexture(url: string, signal: AbortSignal): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    new THREE.TextureLoader().load(
      url,
      (t) => {
        // Pixel art: no smoothing, no mipmaps, correct colour space.
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      },
      undefined,
      () => reject(new Error(`Could not load sprite atlas ${url}`)),
    );
  });
}

/** Load the courtroom data and atlases and build one runtime. */
export function useCourtroom(options: { reducedMotion?: boolean } = {}): CourtroomStatus {
  const [status, setStatus] = useState<CourtroomStatus>({ state: 'loading', progress: 0 });
  const reduced = options.reducedMotion ?? false;
  // Reduced motion is applied live below; it must not rebuild the runtime.
  const initialReduced = useRef(reduced);

  useEffect(() => {
    const ctrl = new AbortController();
    let runtime: CourtroomRuntime | null = null;
    const entries = Object.entries(ATLAS_IMAGE_URLS);
    let loaded = 0;
    const tick = () => setStatus({ state: 'loading', progress: ++loaded / (entries.length + 1) });
    (async () => {
      const data = await loadCourtroomData(undefined, ctrl.signal);
      tick();
      const textures = Object.fromEntries(
        await Promise.all(entries.map(async ([id, url]) => {
          const t = await loadTexture(url, ctrl.signal);
          tick();
          return [id, t] as const;
        })),
      );
      if (ctrl.signal.aborted) return;
      runtime = new CourtroomRuntime({ data, textures, reducedMotion: initialReduced.current });
      setStatus({ state: 'ready', runtime, port: asScenePort(runtime) });
    })().catch((error: unknown) => {
      if (!ctrl.signal.aborted) setStatus({ state: 'error', error: error instanceof Error ? error : new Error(String(error)) });
    });
    return () => {
      ctrl.abort();
      runtime?.dispose();
    };
  }, []);

  useEffect(() => {
    if (status.state === 'ready') status.runtime.setReducedMotion(reduced);
  }, [status, reduced]);

  return status;
}

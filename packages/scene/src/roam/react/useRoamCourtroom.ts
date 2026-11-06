import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { JsonFetcher } from '../../load';
import { RoamController, type RoamControllerOptions } from '../controller';
import { loadRoamData, type RoamData } from '../load';
import type { RoamSnapshot } from '../types';

export type RoamStatus =
  | { status: 'loading'; controller: null; data: null; error: null }
  | { status: 'ready'; controller: RoamController; data: RoamData; error: null }
  | { status: 'error'; controller: null; data: null; error: Error };

export interface UseRoamOptions extends Omit<RoamControllerOptions, 'reducedMotion'> {
  /** Defaults to the user's prefers-reduced-motion setting (and follows it live). */
  reducedMotion?: boolean;
  fetcher?: JsonFetcher;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Load the world and make one controller for the component's lifetime. */
export function useRoamCourtroom(options: UseRoamOptions = {}): RoamStatus {
  const [state, setState] = useState<RoamStatus>({ status: 'loading', controller: null, data: null, error: null });
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    const abort = new AbortController();
    let controller: RoamController | null = null;
    loadRoamData(opts.current.fetcher, abort.signal).then(
      (data) => {
        if (abort.signal.aborted) return;
        const { fetcher: _f, reducedMotion, ...rest } = opts.current;
        void _f;
        controller = new RoamController(data.world, { ...rest, reducedMotion: reducedMotion ?? prefersReducedMotion() });
        setState({ status: 'ready', controller, data, error: null });
      },
      (error: unknown) => {
        if (!abort.signal.aborted) setState({ status: 'error', controller: null, data: null, error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      abort.abort();
      controller?.dispose();
    };
  }, []);

  // Follow the explicit flag, or the OS setting when none is given.
  const explicit = options.reducedMotion;
  const ctrl = state.controller;
  useEffect(() => {
    if (!ctrl) return;
    if (explicit !== undefined) {
      ctrl.setReducedMotion(explicit);
      return;
    }
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => ctrl.setReducedMotion(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [ctrl, explicit]);

  return state;
}

/** HUD state: re-renders only when the controller reports a visible change. */
export function useRoamSnapshot(controller: RoamController): RoamSnapshot {
  const cache = useRef<{ v: number; s: RoamSnapshot } | null>(null);
  return useSyncExternalStore(
    (cb) => controller.onChange(cb),
    () => {
      if (!cache.current || cache.current.v !== controller.version) cache.current = { v: controller.version, s: controller.snapshot() };
      return cache.current.s;
    },
  );
}

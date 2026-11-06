/**
 * Which room draws a trial: the first-person roaming courtroom (primary) or the
 * classic papercraft stage (fallback). One app-wide choice, saved per browser.
 * Without WebGL2 the roaming courtroom cannot run, so the classic stage is used
 * and the choice is not offered.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type TrialViewKind = 'roam' | 'classic';

export const TRIAL_VIEW_STORAGE_KEY = 'cc:trial-view';

let webgl2: boolean | null = null;

/** True when this browser can create a WebGL2 context (cached). */
export function canRoam(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    webgl2 = typeof document !== 'undefined' && Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

/** Test seam. */
export function __setCanRoamForTests(value: boolean | null): void {
  webgl2 = value;
}

const listeners = new Set<() => void>();

function read(): TrialViewKind {
  if (!canRoam()) return 'classic';
  try {
    return window.localStorage.getItem(TRIAL_VIEW_STORAGE_KEY) === 'classic' ? 'classic' : 'roam';
  } catch {
    return 'roam';
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === TRIAL_VIEW_STORAGE_KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function setTrialView(next: TrialViewKind): void {
  try {
    window.localStorage.setItem(TRIAL_VIEW_STORAGE_KEY, next);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  listeners.forEach((l) => l());
}

/** The current trial view and a setter; `available` is false when only the classic stage can run. */
export function useTrialView(): { view: TrialViewKind; setView: (next: TrialViewKind) => void; available: boolean } {
  const view = useSyncExternalStore(subscribe, read, () => 'classic' as const);
  const setView = useCallback((next: TrialViewKind) => setTrialView(next), []);
  return { view, setView, available: canRoam() };
}

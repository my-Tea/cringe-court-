/**
 * The hearing pace for first-person trials (Standard, Highlights, Full), one
 * app-wide choice saved per browser, like the trial view toggle.
 */
import { HEARING_PACES, type HearingPace } from '@cringe-court/scene/roam';
import { useSyncExternalStore } from 'react';

/** The chosen hearing pace, saved per browser. */
export const HEARING_PACE_STORAGE_KEY = 'cc:hearing-pace';
const paceListeners = new Set<() => void>();

function readPace(): HearingPace {
  try {
    const v = window.localStorage.getItem(HEARING_PACE_STORAGE_KEY);
    return (HEARING_PACES as readonly string[]).includes(v ?? '') ? (v as HearingPace) : 'standard';
  } catch {
    return 'standard';
  }
}

export function setHearingPace(pace: HearingPace): void {
  try {
    window.localStorage.setItem(HEARING_PACE_STORAGE_KEY, pace);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  paceListeners.forEach((l) => l());
}

export function useHearingPace(): HearingPace {
  return useSyncExternalStore(
    (l) => {
      paceListeners.add(l);
      return () => paceListeners.delete(l);
    },
    readPace,
    () => 'standard' as const,
  );
}


import { useSyncExternalStore } from 'react';
import type { SoloSession, SoloSnapshot } from '@cringe-court/modes-solo';

const noop = () => () => {};

/** Subscribe to a session's snapshots (null-safe). */
export function useSessionSnapshot(session: SoloSession | null): SoloSnapshot | null {
  return useSyncExternalStore(session ? session.subscribe : noop, () => session?.getSnapshot() ?? null);
}

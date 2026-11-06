import type { DemoCourt } from '@cringe-court/modes-grand-jury';
import { createDemoCourt } from '@cringe-court/modes-grand-jury';
import { createContext, useContext } from 'react';
import { platformConfig } from '@/platform/config';
import { identityFor } from '@/platform/identity/createIdentity';

/**
 * The Grand Jury court for the app. Testnet demo build: a seeded docket on the
 * in-memory ledger twin, with the rest of the world simulated. The court
 * outlives route changes (module singleton) so navigating never loses state.
 */
export interface CourtContextValue {
  demo: DemoCourt;
  /** Bumps on every ledger, docket or local change: a cheap "something moved" signal. */
  version: number;
  /** Throw the demo away and seed a fresh docket. */
  reset: () => void;
}

export const CourtContext = createContext<CourtContextValue | null>(null);

let shared: Promise<DemoCourt> | null = null;

export function sharedDemo(): Promise<DemoCourt> {
  // The human player's identity follows the platform config; the simulated crowd stays mock.
  shared ??= createDemoCourt({ identity: (viewer) => identityFor(platformConfig, `demo-human:${viewer}`) });
  return shared;
}

/** Forget the shared court (after a failure or a reset); the next provider seeds a fresh one. */
export function forgetSharedDemo(): void {
  shared = null;
}

/** Test hook: start the next provider from a known court. */
export function __setDemoCourtForTests(court: Promise<DemoCourt> | null): void {
  shared = court;
}

export type CourtStatus = { state: 'loading' } | { state: 'error'; error: Error } | { state: 'ready'; demo: DemoCourt };

export function useCourtContext(): CourtContextValue {
  const ctx = useContext(CourtContext);
  if (!ctx) throw new Error('useCourtContext must be used inside <CourtProvider>');
  return ctx;
}

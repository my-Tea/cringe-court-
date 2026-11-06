import { createDemoCourt, type DemoCourt } from '@cringe-court/modes-grand-jury';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Owns the Grand Jury court for the app. Testnet demo build: a seeded docket on
 * the in-memory ledger twin, with the rest of the world simulated. The court
 * outlives route changes (module singleton) so navigating never loses state.
 */
export interface CourtContextValue {
  demo: DemoCourt;
  /** Bumps on every ledger, docket or local change: a cheap "something moved" signal. */
  version: number;
  /** Throw the demo away and seed a fresh docket. */
  reset: () => void;
}

const CourtContext = createContext<CourtContextValue | null>(null);

let shared: Promise<DemoCourt> | null = null;
function sharedDemo(): Promise<DemoCourt> {
  shared ??= createDemoCourt();
  return shared;
}

/** Test hook: start the next provider from a known court. */
export function __setDemoCourtForTests(court: Promise<DemoCourt> | null): void {
  shared = court;
}

export type CourtStatus = { state: 'loading' } | { state: 'error'; error: Error } | { state: 'ready'; demo: DemoCourt };

export function CourtProvider({ children, fallback, tick = true }: { children: ReactNode; fallback: (status: Exclude<CourtStatus, { state: 'ready' }>, retry: () => void) => ReactNode; tick?: boolean }) {
  const [status, setStatus] = useState<CourtStatus>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    sharedDemo().then(
      (demo) => live && setStatus({ state: 'ready', demo }),
      (error: unknown) => {
        shared = null;
        if (live) setStatus({ state: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const demo = status.state === 'ready' ? status.demo : null;

  useEffect(() => {
    if (!demo) return;
    return demo.court.subscribe(() => setVersion((v) => v + 1));
  }, [demo]);

  // The world's heartbeat: other summoners, jurors and the bailiff act once a second.
  const ticking = useRef(false);
  useEffect(() => {
    if (!demo || !tick) return;
    const id = window.setInterval(() => {
      if (document.hidden || ticking.current) return;
      ticking.current = true;
      void demo.sim.tick().finally(() => {
        ticking.current = false;
        setVersion((v) => v + 1);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [demo, tick]);

  const retry = useCallback(() => {
    setStatus({ state: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  const reset = useCallback(() => {
    demo?.dispose();
    shared = null;
    setStatus({ state: 'loading' });
    setAttempt((a) => a + 1);
  }, [demo]);

  const value = useMemo(() => (demo ? { demo, version, reset } : null), [demo, version, reset]);
  if (status.state !== 'ready' || !value) return <>{fallback(status as Exclude<CourtStatus, { state: 'ready' }>, retry)}</>;
  return <CourtContext.Provider value={value}>{children}</CourtContext.Provider>;
}

export function useCourtContext(): CourtContextValue {
  const ctx = useContext(CourtContext);
  if (!ctx) throw new Error('useCourtContext must be used inside <CourtProvider>');
  return ctx;
}

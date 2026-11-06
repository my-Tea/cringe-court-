import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BackendClient } from '@/platform/backend';
import { CourtContext, forgetSharedDemo, sharedDemo, type CourtStatus } from './context';

/**
 * Provides the court (this browser's demo, or the shared court server when
 * `client` is given), its change signal and, for the demo, the once-a-second
 * simulated world. On the server the world ticks there and changes arrive live.
 */
export function CourtProvider({
  children,
  fallback,
  tick = true,
  client = null,
}: {
  children: ReactNode;
  fallback: (status: Exclude<CourtStatus, { state: 'ready' }>, retry: () => void) => ReactNode;
  tick?: boolean;
  client?: BackendClient | null;
}) {
  const [status, setStatus] = useState<CourtStatus>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    sharedDemo(client).then(
      (demo) => live && setStatus({ state: 'ready', demo }),
      (error: unknown) => {
        forgetSharedDemo();
        if (live) setStatus({ state: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt, client]);

  const demo = status.state === 'ready' ? status.demo : null;

  useEffect(() => {
    if (!demo) return;
    return demo.court.subscribe(() => setVersion((v) => v + 1));
  }, [demo]);

  // The world's heartbeat: other summoners, jurors and the bailiff act once a second.
  const ticking = useRef(false);
  useEffect(() => {
    const step = demo?.tick;
    if (!demo || !tick || !step) return;
    const id = window.setInterval(() => {
      if (document.hidden || ticking.current) return;
      ticking.current = true;
      void step().finally(() => {
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
    forgetSharedDemo();
    setStatus({ state: 'loading' });
    setAttempt((a) => a + 1);
  }, [demo]);

  const value = useMemo(() => (demo ? { demo, version, reset } : null), [demo, version, reset]);
  if (status.state !== 'ready' || !value) return <>{fallback(status as Exclude<CourtStatus, { state: 'ready' }>, retry)}</>;
  return <CourtContext.Provider value={value}>{children}</CourtContext.Provider>;
}

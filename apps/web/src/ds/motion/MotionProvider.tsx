import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Motion preference. `system` follows `prefers-reduced-motion`; the user can
 * override it either way from the shell. The effective value is written to
 * <html data-reduced-motion="true|false">, which tokens.css uses to collapse
 * every --cc-duration-* to 0ms and components use to switch off loops.
 */
export type MotionPreference = 'system' | 'reduced' | 'full';

export const MOTION_STORAGE_KEY = 'cc:motion';
const QUERY = '(prefers-reduced-motion: reduce)';

interface MotionContextValue {
  preference: MotionPreference;
  setPreference: (next: MotionPreference) => void;
  /** True when animation should be reduced right now. */
  reduced: boolean;
}

const MotionContext = createContext<MotionContextValue | null>(null);

function readStored(): MotionPreference {
  try {
    const v = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return v === 'reduced' || v === 'full' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersReduced(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<MotionPreference>(readStored);
  const [systemReduced, setSystemReduced] = useState(systemPrefersReduced);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setSystemReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const reduced = preference === 'system' ? systemReduced : preference === 'reduced';

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);

  const setPreference = useCallback((next: MotionPreference) => {
    setPreferenceState(next);
    try {
      if (next === 'system') window.localStorage.removeItem(MOTION_STORAGE_KEY);
      else window.localStorage.setItem(MOTION_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice still applies for this visit.
    }
  }, []);

  const value = useMemo(() => ({ preference, setPreference, reduced }), [preference, setPreference, reduced]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion(): MotionContextValue {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error('useMotion must be used inside <MotionProvider>');
  return ctx;
}

/** Convenience: true when animation should be reduced. */
export function useReducedMotion(): boolean {
  return useMotion().reduced;
}

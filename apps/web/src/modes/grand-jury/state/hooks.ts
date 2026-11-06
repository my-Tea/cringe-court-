import type { ActionResult, CaseDetail, DocketEntry } from '@cringe-court/modes-grand-jury';
import type { CaseNumber, Usdc } from '@cringe-court/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from '@/ds/lib/useNow';
import { useCourtContext } from './context';

export type Loadable<T> = { state: 'loading' } | { state: 'error'; error: Error } | { state: 'ready'; data: T };

/** Re-run `load` whenever the court moves. Keeps the last good data while refreshing. */
function useCourtQuery<T>(load: () => Promise<T>, deps: readonly unknown[]): Loadable<T> & { retry: () => void } {
  const { version } = useCourtContext();
  const [result, setResult] = useState<Loadable<T>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let live = true;
    loadRef.current().then(
      (data) => live && setResult({ state: 'ready', data }),
      (error: unknown) => live && setResult({ state: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
  }, [version, attempt, ...deps]);
  const retry = useCallback(() => {
    setResult({ state: 'loading' });
    setAttempt((a) => a + 1);
  }, []);
  return { ...result, retry };
}

export function useDocket() {
  const { demo } = useCourtContext();
  return useCourtQuery<readonly DocketEntry[]>(() => demo.court.list(), [demo]);
}

export function useCase(n: CaseNumber | null) {
  const { demo } = useCourtContext();
  return useCourtQuery<CaseDetail | null>(() => (n === null ? Promise.resolve(null) : demo.court.detail(n)), [demo, n]);
}

export function useWallet() {
  const { demo } = useCourtContext();
  return useCourtQuery<{ account: string | null; balance: Usdc | null }>(async () => ({ account: await demo.court.account(), balance: await demo.court.balance() }), [demo]);
}

/** Court time in unix seconds (demo time can be skipped forward), refreshed every second. */
export function useCourtNow(): number {
  const { demo } = useCourtContext();
  useNow(1000);
  return demo.court.now();
}

/** Court time in ms, for the design-system Countdown. */
export function useCourtNowMs(): number {
  return useCourtNow() * 1000;
}

export type ActionState<T> = { state: 'idle' } | { state: 'pending' } | { state: 'done'; result: ActionResult<T> };

/** Run a court action with pending/result state; never throws. */
export function useAction<A extends unknown[], T>(fn: (...args: A) => Promise<ActionResult<T>>) {
  const [st, setSt] = useState<ActionState<T>>({ state: 'idle' });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async (...args: A): Promise<ActionResult<T>> => {
    setSt({ state: 'pending' });
    let result: ActionResult<T>;
    try {
      result = await fnRef.current(...args);
    } catch (err) {
      result = { ok: false, code: 'error', message: err instanceof Error ? err.message : String(err) };
    }
    setSt({ state: 'done', result });
    return result;
  }, []);
  const reset = useCallback(() => setSt({ state: 'idle' }), []);
  return { status: st, pending: st.state === 'pending', error: st.state === 'done' && !st.result.ok ? st.result.message : null, run, reset };
}

/** Every case with its viewer state, for "My court". */
export function useAllCases() {
  const { demo } = useCourtContext();
  return useCourtQuery<readonly CaseDetail[]>(async () => {
    const list = await demo.court.list();
    const details = await Promise.all(list.map((e) => demo.court.detail(e.caseNumber)));
    return details.filter((d): d is CaseDetail => d !== null);
  }, [demo]);
}

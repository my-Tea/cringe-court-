import type { Hex, Usdc } from '@cringe-court/core';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { appLedger } from './appLedger';

const POLL_MS = 15000;

interface WalletState {
  account: Hex | null;
  balance: Usdc | null;
}

let state: WalletState = { account: null, balance: null };
const listeners = new Set<() => void>();
const set = (next: WalletState) => {
  state = next;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

async function readBalance(): Promise<void> {
  if (!state.account) return;
  const balance = await appLedger().port.usdcBalance(state.account);
  set({ ...state, balance });
}

/** The player's real wallet, shared by every screen. The balance is watched, because the faucet is in another tab. */
export function useArcWallet() {
  const { account, balance } = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    void appLedger().connect?.({ silent: true }).then((a) => {
      if (a && !state.account) set({ account: a, balance: null });
    });
  }, []);

  useEffect(() => {
    if (!account) return;
    void readBalance().catch(() => undefined);
    // Hidden tabs stay quiet: several open tabs add up against the RPC's rate limit.
    const poll = setInterval(() => {
      if (!document.hidden) void readBalance().catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [account]);

  const connect = useCallback(async (): Promise<Hex | null> => {
    const a = (await appLedger().connect?.()) ?? null;
    if (a) set({ account: a, balance: null });
    return a;
  }, []);

  return { account, balance, connect, refresh: readBalance, hasWallet: appLedger().hasWallet?.() ?? false };
}

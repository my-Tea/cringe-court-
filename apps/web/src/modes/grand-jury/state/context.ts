import type { CaseNumber, Usdc } from '@cringe-court/core';
import type { DemoCourt } from '@cringe-court/modes-grand-jury';
import { createDemoCourt } from '@cringe-court/modes-grand-jury';
import { RemoteGrandJuryCourt, type GrandJuryCourtApi } from '@cringe-court/net';
import { StorageSaltVault } from '@cringe-court/modes-grand-jury';
import { createContext, useContext } from 'react';
import { platformConfig } from '@/platform/config';
import { identityFor } from '@/platform/identity/createIdentity';
import { describeBackendError, type BackendClient } from '@/platform/backend';

/**
 * The Grand Jury court for the app: either this browser's offline demo (a
 * seeded docket on the in-memory ledger twin, the rest of the world simulated)
 * or the shared court server, where every device sees the same docket and
 * jurors are real people on their own devices. The screens use one handle for
 * both. The court outlives route changes (module singleton) so navigating
 * never loses state.
 */
export interface CourtHandle {
  court: GrandJuryCourtApi;
  /** True on the shared court server. */
  remote: boolean;
  /** Testnet faucet stand-in: test USDC for the viewer. */
  faucet(amount: Usdc): Promise<void>;
  /** Demo control: let the simulated crowd act, then jump the court clock past this case's deadline. */
  skip(n: CaseNumber): Promise<void>;
  /** The simulated world's heartbeat, or null when the server keeps it. */
  tick: (() => Promise<void>) | null;
  /** D10 marketing-cap publications so far (the pricing page). */
  marketingUsed(): number;
  dispose(): void;
}

export interface CourtContextValue {
  demo: CourtHandle;
  /** Bumps on every ledger, docket or local change: a cheap "something moved" signal. */
  version: number;
  /** Throw the demo away and seed a fresh docket. */
  reset: () => void;
}

export const CourtContext = createContext<CourtContextValue | null>(null);

/** This browser's demo court, as a handle. */
export function localHandle(demo: DemoCourt): CourtHandle {
  return {
    court: demo.court,
    remote: false,
    faucet: async (amount) => demo.faucet(amount),
    skip: async (n) => {
      const detail = await demo.court.detail(n);
      if (!detail || detail.phaseEndsAt === null) return;
      const left = detail.phaseEndsAt - demo.court.now();
      if (left <= 0) return;
      await demo.sim.catchUp(n);
      demo.clock.skip(left + 1);
      await demo.sim.tick();
    },
    tick: () => demo.sim.tick(),
    marketingUsed: () => demo.court.docket.marketingUsed,
    dispose: () => demo.dispose(),
  };
}

/** The shared court server's Grand Jury, as a handle. Failures surface as action results, never silently. */
export function remoteHandle(client: BackendClient): CourtHandle {
  const account = client.account ?? 'anonymous';
  const court = new RemoteGrandJuryCourt({
    connection: client.connection,
    identity: identityFor(platformConfig, `demo-human:${account}`, {
      token: () => client.connection.token,
      wallet: () => client.account ?? undefined,
    }),
    salts: new StorageSaltVault(window.localStorage),
    describe: describeBackendError,
  });
  const check = async (r: Promise<{ ok: boolean; message?: string }>) => {
    const result = await r;
    if (!result.ok) throw new Error(result.message);
  };
  return {
    court,
    remote: true,
    faucet: (amount) => check(court.faucet(amount)),
    skip: (n) => check(court.skip(n)),
    tick: null,
    marketingUsed: () => court.marketingUsed(),
    dispose: () => court.dispose(),
  };
}

let shared: { key: string; court: Promise<CourtHandle> } | null = null;

export function sharedDemo(client: BackendClient | null = null): Promise<CourtHandle> {
  const key = client ? `remote:${client.url}:${client.account ?? ''}` : 'local';
  if (shared?.key !== key) {
    // The human player's identity follows the platform config; the simulated crowd stays mock.
    const court = client ? Promise.resolve(remoteHandle(client)) : createDemoCourt({ identity: (viewer) => identityFor(platformConfig, `demo-human:${viewer}`) }).then(localHandle);
    shared = { key, court };
  }
  return shared.court;
}

/** Forget the shared court (after a failure or a reset); the next provider seeds a fresh one. */
export function forgetSharedDemo(): void {
  shared = null;
}

/** Test hook: start the next provider from a known court. */
export function __setDemoCourtForTests(court: Promise<DemoCourt> | null): void {
  shared = court ? { key: 'local', court: court.then(localHandle) } : null;
}

export type CourtStatus = { state: 'loading' } | { state: 'error'; error: Error } | { state: 'ready'; demo: CourtHandle };

export function useCourtContext(): CourtContextValue {
  const ctx = useContext(CourtContext);
  if (!ctx) throw new Error('useCourtContext must be used inside <CourtProvider>');
  return ctx;
}

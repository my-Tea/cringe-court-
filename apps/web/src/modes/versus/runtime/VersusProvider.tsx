import type { AudioEngine } from '@cringe-court/audio';
import { ZERO_USDC, monotonicUnixClock, type AiCounselPort, type IdentityPort, type SaltVault } from '@cringe-court/core';
import { VersusCounsel, VersusDesk, VersusError, World, type FactStore, type Persona, type VersusDeskOptions, type WorldSnapshot } from '@cringe-court/modes-versus';
import { BackendError } from '@cringe-court/net';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { VersusContext, type CourtKind, type VersusRuntime } from './context';
import { describeBackendError } from '@/platform/backend/messages';
import { useToast } from '@/ds';
import { t } from '@/i18n';
import { platformConfig } from '@/platform/config';
import { identityFor } from '@/platform/identity/createIdentity';
import { appAudio } from '@/platform/audio';
import { LocalFactStore } from './localStore';
import { createPersona, listPersonas, secureRandom, switchTabPersona, tabPersona } from './personas';
import { LocalSaltVault, clearSalts } from './saltVault';

export interface VersusProviderProps {
  children: ReactNode;
  /** Test seams; the browser defaults are the demo adapters. */
  store?: FactStore & { reset?: () => void };
  persona?: Persona;
  counsel?: AiCounselPort;
  identity?: (persona: Persona) => IdentityPort;
  salts?: SaltVault;
  clock?: () => number;
  audio?: AudioEngine;
  /** ms between world rebuilds and clerk rounds; 0 disables the timers (tests drive them). */
  tickMs?: number;
  /** Build the desk (a shared court uses `RemoteVersusDesk`). */
  createDesk?: (options: VersusDeskOptions) => VersusDesk;
  /** Run the court clerk on this device. A shared court's clerk runs on the server. */
  clerk?: boolean;
  /** Who this device can be, when someone other than this browser keeps the list (the court server). */
  personaControl?: { list: readonly Persona[]; switchTo(id: string): void; create(): void };
  /** Which court this is, for the persona bar. Default: this device's demo court. */
  court?: CourtKind;
  /** A shared court: open an invite by code (or signed link) before looking it up. */
  openInvite?: (code: string, token?: string) => Promise<string | null>;
  /** A shared court: the signed invite link for Side A to send. */
  inviteUrl?: (trialId: string) => Promise<string>;
}

const LOCAL_COURT: CourtKind = { kind: 'local' };

export function VersusProvider({
  children,
  store: storeProp,
  persona: personaProp,
  counsel: counselProp,
  identity,
  salts: saltsProp,
  clock: clockProp,
  audio: audioProp,
  tickMs = 1000,
  createDesk,
  clerk = true,
  personaControl,
  court = LOCAL_COURT,
  openInvite,
  inviteUrl,
}: VersusProviderProps) {
  const { toast } = useToast();
  const store = useMemo(() => storeProp ?? new LocalFactStore(), [storeProp]);
  // Monotonic after page load (B19): a wall-clock jump does not expire invites or jury windows.
  const clock = useMemo(() => {
    if (clockProp) return clockProp;
    const real = monotonicUnixClock();
    return () => Math.floor(real());
  }, [clockProp]);
  const counsel = useMemo(() => counselProp ?? new VersusCounsel({ latencyMs: 1400 }), [counselProp]);
  const salts = useMemo(() => saltsProp ?? new LocalSaltVault(), [saltsProp]);
  const audio = audioProp ?? appAudio();
  const [persona, setPersona] = useState<Persona>(() => personaProp ?? tabPersona());
  const [personas, setPersonas] = useState<readonly Persona[]>(() => (personaProp ? [personaProp] : listPersonas()));

  const desk = useMemo(() => {
    const options: VersusDeskOptions = {
      store,
      persona,
      counsel,
      identity: identity ? identity(persona) : identityFor(platformConfig, persona.id),
      salts,
      clock,
      random: secureRandom,
      demo: true,
    };
    return createDesk ? createDesk(options) : new VersusDesk(options);
  }, [store, persona, counsel, identity, salts, clock, createDesk]);

  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const busy = useRef(false);
  const dirty = useRef(false);

  const rebuild = useCallback(async () => {
    if (busy.current) {
      dirty.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        dirty.current = false;
        const w = await World.replay(store.read());
        await w.advanceTo(clock() + w.skew);
        setSnapshot(await w.snapshot([persona.account]));
        setError(null);
      } while (dirty.current);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      busy.current = false;
    }
  }, [store, clock, persona.account]);

  useEffect(() => {
    // First build on the next microtask; later ones follow the store and the clock.
    void Promise.resolve().then(rebuild);
    const off = store.subscribe(() => void rebuild());
    if (!tickMs) return off;
    const id = window.setInterval(() => void rebuild(), tickMs);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [store, rebuild, tickMs]);

  // The court clerk: permissionless housekeeping (drafting, finalizing, the demo jury).
  useEffect(() => {
    if (!tickMs || !clerk) return;
    let running = false;
    const id = window.setInterval(() => {
      if (running) return;
      running = true;
      desk
        .tick()
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    }, Math.round(tickMs * 1.5));
    return () => window.clearInterval(id);
  }, [desk, tickMs, clerk]);

  // The shared app engine already unlocks on the document; an injected engine (tests) needs its own.
  useEffect(() => (audioProp ? audioProp.attachUnlock() : undefined), [audioProp]);

  const run = useCallback(
    async (action: () => Promise<unknown>, options: { success?: string; quiet?: boolean } = {}) => {
      try {
        await action();
        if (options.success) toast({ title: options.success, tone: 'success' });
        await rebuild();
        return true;
      } catch (err) {
        const message = err instanceof BackendError ? describeBackendError(err) : err instanceof Error ? err.message : t('versus.error.generic');
        if (!options.quiet) toast({ title: err instanceof VersusError && err.code === 'identity' ? t('versus.error.identity') : t('versus.error.refused'), description: message, tone: 'danger' });
        audio.handle({ type: 'tx.failed' });
        return false;
      }
    },
    [toast, rebuild, audio],
  );

  const value = useMemo<VersusRuntime>(
    () => ({
      desk,
      persona,
      personas: personaControl ? personaControl.list : personas,
      switchPersona: (id) => {
        if (personaControl) return personaControl.switchTo(id);
        const p = switchTabPersona(id);
        if (p) setPersona(p);
      },
      newPersona: () => {
        if (personaControl) return personaControl.create();
        const p = createPersona();
        switchTabPersona(p.id);
        setPersona(p);
        setPersonas(listPersonas());
      },
      court,
      ...(openInvite ? { openInvite } : {}),
      ...(inviteUrl ? { inviteUrl } : {}),
      snapshot,
      error,
      now: snapshot ? Math.max(snapshot.now, clock() + snapshot.skew) : clock(),
      balance: snapshot?.balances.get(persona.account.toLowerCase()) ?? ZERO_USDC,
      run,
      audio,
      resetDemo: () => {
        (store as { reset?: () => void }).reset?.();
        clearSalts();
        void rebuild();
      },
    }),
    [desk, persona, personas, personaControl, court, openInvite, inviteUrl, snapshot, error, clock, run, audio, store, rebuild],
  );

  return <VersusContext.Provider value={value}>{children}</VersusContext.Provider>;
}


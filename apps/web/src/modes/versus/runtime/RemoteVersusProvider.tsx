/**
 * Versus on the shared court server: the same provider and screens, with the
 * server's fact log (redacted for this device), the server's clock, and the
 * server's clerk. People on this device are court-server sessions.
 */
import { invitePath, type Persona } from '@cringe-court/modes-versus';
import { RemoteVersusDesk, type BackendError } from '@cringe-court/net';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ErrorState, LoadingState } from '@/ds';
import { t } from '@/i18n';
import { describeBackendError, useBackendLink, type BackendClient } from '@/platform/backend';
import { VersusProvider } from './VersusProvider';

export function RemoteVersusProvider({ client, children }: { client: BackendClient; children: ReactNode }) {
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const status = useBackendLink(client);
  const current = state.phase === 'ready' ? state.persona : null;
  const sessions = client.sessions();
  const name = useCallback((id: string) => t('backend.persona.name', { n: Math.max(1, sessions.findIndex((s) => s.persona.id === id) + 1) }), [sessions]);
  const persona = useMemo<Persona | null>(() => (current ? { id: current.id, name: name(current.id), account: current.account } : null), [current, name]);
  const store = useMemo(() => (persona ? client.versusStore() : null), [client, persona]);
  const clock = useMemo(() => () => client.connection.serverNow(), [client]);
  const [sync, setSync] = useState<{ state: 'loading' } | { state: 'ready' } | { state: 'error'; error: BackendError }>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!store) return;
    let live = true;
    setSync({ state: 'loading' });
    store.ready().then(
      () => live && setSync({ state: 'ready' }),
      (error: BackendError) => live && setSync({ state: 'error', error }),
    );
    return () => {
      live = false;
    };
  }, [store, attempt]);

  if (!persona || !store || sync.state === 'loading') return <LoadingState title={t('backend.gate.connecting.title')} />;
  if (sync.state === 'error') {
    return (
      <ErrorState title={t('backend.gate.error.title')} onRetry={() => setAttempt((a) => a + 1)} retryLabel={t('backend.gate.retry')}>
        {t('backend.gate.error.body', { host: client.host, reason: describeBackendError(sync.error) })}
      </ErrorState>
    );
  }
  return (
    <VersusProvider
      key={persona.id}
      store={store}
      persona={persona}
      clock={clock}
      clerk={false}
      createDesk={(o) => new RemoteVersusDesk({ ...o, store })}
      personaControl={{
        list: sessions.map((s) => ({ id: s.persona.id, name: name(s.persona.id), account: s.persona.account })),
        switchTo: (id) => void client.switchTo(id),
        create: () => void client.newPerson().catch(() => undefined),
      }}
      court={{ kind: 'remote', host: client.host, status }}
      openInvite={(code, token) => store.openInvite(code, token)}
      inviteUrl={async (trialId) => {
        const r = await store.invite(trialId);
        return `${window.location.origin}${invitePath(r.code as never)}?t=${encodeURIComponent(r.token)}`;
      }}
    >
      {children}
    </VersusProvider>
  );
}

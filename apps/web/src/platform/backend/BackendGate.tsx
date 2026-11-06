/**
 * Which court a mode plays on. With no VITE_BACKEND_URL, the local demo (as
 * before). With one, the shared court server, after an honest connection
 * step: if the server cannot be reached the player is told so, can retry, or
 * can explicitly choose the local demo for this device. Never a silent fallback.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, ErrorState, LoadingState, PaperButton } from '@/ds';
import { t } from '@/i18n';
import { platformConfig, type BackendConfig } from '../config';
import { backendClient, prefersLocal, setPrefersLocal, type BackendClient } from './client';
import { describeBackendError } from './messages';
import styles from './backend.module.css';

export type CourtChoice = { kind: 'local'; serverAvailable: boolean } | { kind: 'remote'; client: BackendClient };

export interface BackendGateProps {
  children: (court: CourtChoice) => ReactNode;
  /** Test seam: defaults to the build's config. */
  backend?: BackendConfig | null;
  client?: BackendClient;
}

export function BackendGate({ children, backend = platformConfig.backend, client: clientProp }: BackendGateProps) {
  const [local, setLocal] = useState(() => backend !== null && prefersLocal());
  if (!backend) return <>{children({ kind: 'local', serverAvailable: false })}</>;
  if (local) {
    return (
      <>
        <LocalNotice
          onUseServer={() => {
            setPrefersLocal(false);
            setLocal(false);
          }}
        />
        {children({ kind: 'local', serverAvailable: true })}
      </>
    );
  }
  return (
    <Connect
      client={clientProp ?? backendClient(backend)}
      onLocal={() => {
        setPrefersLocal(true);
        setLocal(true);
      }}
    >
      {children}
    </Connect>
  );
}

function Connect({ client, onLocal, children }: { client: BackendClient; onLocal: () => void; children: BackendGateProps['children'] }) {
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  // Connect on first show, and retry on a fresh visit after a failure (e.g. coming back from the local demo).
  useEffect(() => {
    if (client.getSnapshot().phase === 'idle' || client.getSnapshot().phase === 'error') void client.connect();
  }, [client]);
  useEffect(() => {
    if (state.phase === 'idle') void client.connect();
  }, [client, state.phase]);

  if (state.phase === 'error') {
    return (
      <div className={styles.gate}>
        <ErrorState
          title={t('backend.gate.error.title')}
          onRetry={() => void client.connect()}
          retryLabel={t('backend.gate.retry')}
          actions={
            <PaperButton variant="ghost" onClick={onLocal}>
              {t('backend.gate.local')}
            </PaperButton>
          }
        >
          {t('backend.gate.error.body', { host: client.host, reason: describeBackendError(state.error) })}
        </ErrorState>
      </div>
    );
  }
  if (state.phase !== 'ready') {
    return (
      <div className={styles.gate}>
        <LoadingState title={t('backend.gate.connecting.title')}>{t('backend.gate.connecting.body')}</LoadingState>
      </div>
    );
  }
  return (
    <>
      {state.notice === 'new-session' && (
        <div className={styles.notice}>
          <Alert
            tone="info"
            live="polite"
            title={t('backend.gate.newSession.title')}
            actions={
              <PaperButton size="sm" variant="ghost" onClick={() => client.dismissNotice()}>
                {t('backend.gate.newSession.dismiss')}
              </PaperButton>
            }
          >
            {t('backend.gate.newSession.body')}
          </Alert>
        </div>
      )}
      {state.link === 'offline' && (
        <div className={styles.notice}>
          <Alert tone="warning" live="polite" title={t('backend.status.offline.title')}>
            {t('backend.status.offline.body')}
          </Alert>
        </div>
      )}
      {children({ kind: 'remote', client })}
    </>
  );
}

function LocalNotice({ onUseServer }: { onUseServer: () => void }) {
  return (
    <div className={styles.notice}>
      <Alert
        tone="info"
        title={t('backend.local.title')}
        actions={
          <PaperButton size="sm" variant="ghost" onClick={onUseServer}>
            {t('backend.local.useServer')}
          </PaperButton>
        }
      >
        {t('backend.local.body')}
      </Alert>
    </div>
  );
}

/** The live link, for badges ("Shared court · live"). */
export function useBackendLink(client: BackendClient | null): string | null {
  const state = useSyncExternalStore(client?.subscribe ?? noop, client?.getSnapshot ?? idle, client?.getSnapshot ?? idle);
  if (!client || state.phase !== 'ready') return null;
  return state.link === 'live' ? t('backend.status.live') : state.link === 'polling' ? t('backend.status.polling') : state.link === 'offline' ? t('backend.status.offline') : t('backend.status.connecting');
}

const noop = () => () => undefined;
const IDLE = { phase: 'idle' } as const;
const idle = () => IDLE;

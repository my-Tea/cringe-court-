import { useSyncExternalStore } from 'react';
import { t } from '@/i18n';
import type { BackendClient } from './client';

/** The live link, for badges ("Shared court · live"). */
export function useBackendLink(client: BackendClient | null): string | null {
  const state = useSyncExternalStore(client?.subscribe ?? noop, client?.getSnapshot ?? idle, client?.getSnapshot ?? idle);
  if (!client || state.phase !== 'ready') return null;
  return state.link === 'live' ? t('backend.status.live') : state.link === 'polling' ? t('backend.status.polling') : state.link === 'offline' ? t('backend.status.offline') : t('backend.status.connecting');
}

const noop = () => () => undefined;
const IDLE = { phase: 'idle' } as const;
const idle = () => IDLE;

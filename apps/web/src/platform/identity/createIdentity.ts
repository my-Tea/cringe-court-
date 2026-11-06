import type { IdentityPort } from '@cringe-court/core';
import { t } from '@/i18n';
import type { PlatformConfig } from '../config';
import { IdkitIdentityPort, type ConnectHandler } from './idkitIdentity';
import { createMockIdentity } from './mockIdentity';
import { presentWorldIdConnect } from './connectBridge';

export interface IdentityOptions {
  /** Where the World App link goes. Default: the app-wide connect dialog (`WorldIdConnectHost`). */
  onConnect?: ConnectHandler;
  wallet?: () => string | undefined;
  fetch?: typeof fetch;
}

/** The identity port for one human: the mock persona by default, real World IDKit when configured. */
export function identityFor(config: Pick<PlatformConfig, 'identity' | 'world'>, human: string, options: IdentityOptions = {}): IdentityPort {
  if (config.identity === 'world-idkit' && config.world) {
    return new IdkitIdentityPort({
      appId: config.world.appId,
      backendUrl: config.world.backendUrl,
      onConnect: options.onConnect ?? presentWorldIdConnect,
      ...(options.wallet ? { wallet: options.wallet } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }
  return createMockIdentity(human);
}

export interface IdentityInfo {
  kind: 'mock' | 'world-idkit';
  label: string;
  detail: string;
}

/** Settings-panel description of the active identity adapter. */
export function identityInfo(config: Pick<PlatformConfig, 'identity' | 'world'>): IdentityInfo {
  if (config.identity === 'world-idkit' && config.world) {
    let host = config.world.backendUrl;
    try {
      host = new URL(config.world.backendUrl).host;
    } catch {
      /* keep the raw value */
    }
    return { kind: 'world-idkit', label: t('shell.identity.world.label'), detail: t('shell.identity.world.detail', { appId: config.world.appId, host }) };
  }
  return { kind: 'mock', label: t('shell.identity.mock.label'), detail: t('shell.identity.mock.detail') };
}

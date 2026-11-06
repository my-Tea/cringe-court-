/**
 * Platform configuration: which adapters sit behind the app's ports.
 *
 * Everything defaults to the in-browser demo (D14: testnet only). A deploy opts
 * into real services with Vite env vars; a half-configured service falls back
 * to its demo adapter and says why, so a typo never strands a player on a
 * broken court.
 *
 *   VITE_LEDGER            demo | arc-testnet
 *   VITE_ARC_RPC_URL       Arc testnet JSON-RPC (default: the public endpoint)
 *   VITE_ARC_COURT         CringeCourt contract address        (required for arc-testnet)
 *   VITE_ARC_USDC          USDC (ERC-20 interface) address      (required for arc-testnet)
 *   VITE_ARC_REGISTRY      HumanRegistry address                (required for arc-testnet)
 *   VITE_IDENTITY          mock | world-idkit
 *   VITE_WORLD_APP_ID      World Developer Portal app id        (required for world-idkit)
 *   VITE_WORLD_BACKEND_URL Verifier backend: /rp-context and /verify (required for world-idkit)
 *   VITE_BACKEND_URL       Shared court server (apps/server) so Versus and Grand Jury work across
 *                          devices. Unset: every court lives in this browser only (the default).
 */
import type { MessageKey, MessageParams } from '@/i18n';

export type LedgerKind = 'demo' | 'arc-testnet';
export type IdentityKind = 'mock' | 'world-idkit';

export type Address = `0x${string}`;

export interface ArcConfig {
  rpcUrl: string;
  chainId: 5042002;
  court: Address;
  usdc: Address;
  registry: Address;
}

/** The shared court server (docs/BACKEND.md). */
export interface BackendConfig {
  /** Origin of apps/server, no trailing slash. */
  url: string;
}

export interface WorldConfig {
  appId: `app_${string}`;
  backendUrl: string;
}

/** A deploy-config problem as catalog key + params, so the UI can translate it. */
export interface ConfigWarning {
  key: MessageKey;
  params: MessageParams;
}

export interface PlatformConfig {
  ledger: LedgerKind;
  arc: ArcConfig | null;
  identity: IdentityKind;
  world: WorldConfig | null;
  /** Shared court server for Versus and Grand Jury, or null for this-browser-only courts. */
  backend: BackendConfig | null;
  /** Why a requested adapter fell back to its demo stand-in. Translated where shown (config is read once, at load). */
  warnings: readonly ConfigWarning[];
}

export const ARC_TESTNET_CHAIN_ID = 5042002 as const;
export const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network';

type Env = Readonly<Record<string, string | boolean | undefined>>;

const isAddress = (v: unknown): v is Address => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function readPlatformConfig(env: Env): PlatformConfig {
  const warnings: ConfigWarning[] = [];

  let ledger: LedgerKind = 'demo';
  let arc: ArcConfig | null = null;
  const wantLedger = str(env.VITE_LEDGER) || 'demo';
  if (wantLedger === 'arc-testnet') {
    const court = str(env.VITE_ARC_COURT);
    const usdc = str(env.VITE_ARC_USDC);
    const registry = str(env.VITE_ARC_REGISTRY);
    const missing = [
      ['VITE_ARC_COURT', court],
      ['VITE_ARC_USDC', usdc],
      ['VITE_ARC_REGISTRY', registry],
    ]
      .filter(([, v]) => !isAddress(v))
      .map(([k]) => k);
    if (missing.length === 0) {
      ledger = 'arc-testnet';
      arc = {
        rpcUrl: str(env.VITE_ARC_RPC_URL) || ARC_TESTNET_RPC,
        chainId: ARC_TESTNET_CHAIN_ID,
        court: court as Address,
        usdc: usdc as Address,
        registry: registry as Address,
      };
    } else {
      warnings.push({ key: 'shell.config.arcMissing', params: { vars: missing.join(', '), count: missing.length } });
    }
  } else if (wantLedger !== 'demo') {
    warnings.push({ key: 'shell.config.unknownLedger', params: { value: wantLedger } });
  }

  let identity: IdentityKind = 'mock';
  let world: WorldConfig | null = null;
  const wantIdentity = str(env.VITE_IDENTITY) || 'mock';
  if (wantIdentity === 'world-idkit') {
    const appId = str(env.VITE_WORLD_APP_ID);
    const backendUrl = str(env.VITE_WORLD_BACKEND_URL).replace(/\/+$/, '');
    const missing = [!/^app_[A-Za-z0-9_]+$/.test(appId) && 'VITE_WORLD_APP_ID', !/^https?:\/\//.test(backendUrl) && 'VITE_WORLD_BACKEND_URL'].filter(Boolean);
    if (missing.length === 0) {
      identity = 'world-idkit';
      world = { appId: appId as `app_${string}`, backendUrl };
    } else {
      warnings.push({ key: 'shell.config.worldMissing', params: { vars: missing.join(', '), count: missing.length } });
    }
  } else if (wantIdentity !== 'mock') {
    warnings.push({ key: 'shell.config.unknownIdentity', params: { value: wantIdentity } });
  }

  let backend: BackendConfig | null = null;
  const wantBackend = str(env.VITE_BACKEND_URL).replace(/\/+$/, '');
  if (wantBackend) {
    if (/^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(wantBackend)) backend = { url: wantBackend };
    else warnings.push({ key: 'backend.config.invalid', params: { value: wantBackend } });
    if (backend && identity === 'world-idkit') warnings.push({ key: 'backend.config.idkit', params: {} });
  }

  return { ledger, arc, identity, world, backend, warnings };
}

/** The config this build was made with. */
export const platformConfig: PlatformConfig = readPlatformConfig(import.meta.env as unknown as Env);

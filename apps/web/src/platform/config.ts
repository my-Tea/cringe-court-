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
 */
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

export interface WorldConfig {
  appId: `app_${string}`;
  backendUrl: string;
}

export interface PlatformConfig {
  ledger: LedgerKind;
  arc: ArcConfig | null;
  identity: IdentityKind;
  world: WorldConfig | null;
  /** Human-readable reasons a requested real adapter fell back to the demo. */
  warnings: readonly string[];
}

export const ARC_TESTNET_CHAIN_ID = 5042002 as const;
export const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network';

type Env = Readonly<Record<string, string | boolean | undefined>>;

const isAddress = (v: unknown): v is Address => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function readPlatformConfig(env: Env): PlatformConfig {
  const warnings: string[] = [];

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
      warnings.push(`Arc testnet was requested but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing or not an address; using the demo ledger.`);
    }
  } else if (wantLedger !== 'demo') {
    warnings.push(`Unknown VITE_LEDGER "${wantLedger}"; using the demo ledger.`);
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
      warnings.push(`World ID was requested but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing or invalid; using the mock verifier.`);
    }
  } else if (wantIdentity !== 'mock') {
    warnings.push(`Unknown VITE_IDENTITY "${wantIdentity}"; using the mock verifier.`);
  }

  return { ledger, arc, identity, world, warnings };
}

/** The config this build was made with. */
export const platformConfig: PlatformConfig = readPlatformConfig(import.meta.env as unknown as Env);

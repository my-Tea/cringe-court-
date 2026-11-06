/**
 * The ledger factory: which chain sits behind the app's ChainPort.
 *   demo         ArcLedger over createMemoryChain (exact contract semantics, in the browser)
 *   arc-testnet  ArcLedger over createViemChainPort (read-only until a wallet connects)
 */
import {
  arcTestnet,
  createMemoryChain,
  createViemChainPort,
  type ChainPort as ChainClient,
  type MemoryChain,
} from '@cringe-court/chain-client';
import { ChainError, monotonicUnixClock, type Hex } from '@cringe-court/core';
import { humanRegistryAbi } from '@cringe-court/chain-client';
import { createPublicClient, createWalletClient, custom, http, numberToHex, type EIP1193Provider } from 'viem';
import type { Address, PlatformConfig } from '../config';
import { ArcLedger, RelayerSeatOffers } from './arcLedger';
import { DemoBackend } from './demoBackend';
import { t } from '@/i18n';

export interface LedgerInfo {
  kind: 'demo' | 'arc-testnet';
  label: string;
  chainId: number;
  court: Address;
  usdc: Address | null;
  registry: Address | null;
  rpcUrl: string | null;
  /** True when no real chain is involved (labelled everywhere it matters, D14). */
  simulated: boolean;
  explorerTx: (hash: Hex) => string;
  notes: readonly string[];
}

export interface DemoHandles {
  chain: MemoryChain;
  backend: DemoBackend;
  /** Test faucet: mint test USDC. */
  faucet: (account: Hex, amount: bigint) => void;
  /** Move the in-memory clock forward. */
  advance: (seconds: number) => void;
}

export interface Ledger {
  kind: 'demo' | 'arc-testnet';
  port: ArcLedger;
  info: LedgerInfo;
  /** Arc only: ask the injected wallet for an account and attach it. Resolves to the account or null. */
  connect?: (options?: { silent?: boolean }) => Promise<Hex | null>;
  /** Arc only: the level HumanRegistry holds for this wallet (0 means the court refuses its stake). */
  humanLevel?: (account: Hex) => Promise<number>;
  /** Arc only: the connected wallet signs a plain message. */
  sign?: (account: Hex, message: string) => Promise<Hex>;
  /** Arc only: is a wallet extension installed? */
  hasWallet?: () => boolean;
  demo?: DemoHandles;
}

export interface CreateLedgerOptions {
  /** Unix-seconds clock the demo chain follows (default wall time). */
  clock?: () => number;
}

const ARC_EXPLORER_HOME = 'https://testnet.arcscan.app';
const ARC_EXPLORER = `${ARC_EXPLORER_HOME}/tx/`;

function injectedProvider(): EIP1193Provider | null {
  const w = typeof window === 'undefined' ? undefined : (window as unknown as { ethereum?: EIP1193Provider });
  return w?.ethereum ?? null;
}

export function createLedger(config: PlatformConfig, options: CreateLedgerOptions = {}): Ledger {
  if (config.ledger === 'arc-testnet') {
    if (!config.arc) throw new ChainError('rejected', t('shell.ledger.error.arcConfig'));
    return createArc(config.arc);
  }
  return createDemo(options);
}

function createDemo(options: CreateLedgerOptions): Ledger {
  const real = monotonicUnixClock();
  const clock = options.clock ?? (() => Math.floor(real()));
  const chain = createMemoryChain({ chainId: 5042002n, timing: 'demo', startTime: BigInt(clock()) });
  const backend = new DemoBackend(chain);
  const sync = () => {
    const t = BigInt(clock());
    if (t > chain.now()) chain.setTime(t);
  };
  const explorerTx = (hash: Hex) => `memory://arc-testnet/tx/${hash}`;
  const port = new ArcLedger({
    port: chain.as(chain.adminAddress),
    offers: backend,
    backend,
    accountFor: (a) => chain.as(a),
    explorerTx,
    sync,
  });
  return {
    kind: 'demo',
    port,
    info: {
      kind: 'demo',
      label: t('shell.ledger.demo.label'),
      chainId: 5042002,
      court: chain.court,
      usdc: null,
      registry: null,
      rpcUrl: null,
      simulated: true,
      explorerTx,
      notes: [t('shell.ledger.demo.note')],
    },
    demo: { chain, backend, faucet: (a, n) => chain.mint(a, n), advance: (s) => chain.advance(s) },
  };
}

/** Moves the wallet to Arc, and teaches it the network first if it has never seen it. */
async function ensureArc(provider: EIP1193Provider, arc: NonNullable<PlatformConfig['arc']>): Promise<void> {
  const chainId = numberToHex(arc.chainId);
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (e) {
    const code = (e as { code?: number; data?: { originalError?: { code?: number } } }).code ?? (e as { data?: { originalError?: { code?: number } } }).data?.originalError?.code;
    if (code !== 4902) throw e;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId, chainName: arcTestnet.name, nativeCurrency: arcTestnet.nativeCurrency, rpcUrls: [arc.rpcUrl], blockExplorerUrls: [ARC_EXPLORER_HOME] }],
    });
  }
}

function createArc(arc: NonNullable<PlatformConfig['arc']>): Ledger {
  const chain = { ...arcTestnet, rpcUrls: { default: { http: [arc.rpcUrl] } } };
  const publicClient = createPublicClient({ chain, transport: http(arc.rpcUrl, { retryCount: 0 }) });
  const addresses = { court: arc.court, usdc: arc.usdc, registry: arc.registry };
  const readOnly = createViemChainPort({ publicClient, addresses, chainId: BigInt(arc.chainId) });
  const explorerTx = (hash: Hex) => `${ARC_EXPLORER}${hash}`;
  const port = new ArcLedger({ port: readOnly, offers: new RelayerSeatOffers(), explorerTx });

  const connect = async (o: { silent?: boolean } = {}): Promise<Hex | null> => {
    const provider = injectedProvider();
    if (!provider) return null;
    try {
      const accounts = (await provider.request({ method: o.silent ? 'eth_accounts' : 'eth_requestAccounts' })) as string[];
      const account = accounts[0] as Hex | undefined;
      if (!account) return null;
      if (!o.silent) await ensureArc(provider, arc);
      const walletClient = createWalletClient({ chain, transport: custom(provider), account });
      port.attach(createViemChainPort({ publicClient, walletClient, addresses, chainId: BigInt(arc.chainId) }) as ChainClient);
      return account.toLowerCase() as Hex;
    } catch (e) {
      if (o.silent) return null;
      throw e instanceof ChainError ? e : new ChainError('rejected', t('shell.ledger.error.walletDeclined'));
    }
  };

  return {
    kind: 'arc-testnet',
    port,
    info: {
      kind: 'arc-testnet',
      label: t('shell.ledger.arc.label'),
      chainId: arc.chainId,
      court: arc.court,
      usdc: arc.usdc,
      registry: arc.registry,
      rpcUrl: arc.rpcUrl,
      simulated: false,
      explorerTx,
      notes: [t('shell.ledger.arc.note')],
    },
    connect,
    humanLevel: async (account) => {
      const [, level] = await publicClient.readContract({ address: arc.registry, abi: humanRegistryAbi, functionName: 'humanOf', args: [account] });
      return level;
    },
    sign: async (account, message) => {
      const provider = injectedProvider();
      if (!provider) throw new ChainError('rejected', t('shell.ledger.error.walletDeclined'));
      return createWalletClient({ chain, transport: custom(provider), account }).signMessage({ message });
    },
    hasWallet: () => injectedProvider() !== null,
  };
}

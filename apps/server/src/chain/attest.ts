/**
 * Puts a World ID verified human's own wallet on Arc's HumanRegistry, so the
 * court contract accepts their stake. The player signs to prove the wallet is
 * theirs; the relayer pays and sends the attestation. Testnet only.
 */
import { GRAND_JURY_QUESTIONS } from '@cringe-court/net';
import { createPublicClient, createWalletClient, http, isAddress, keccak256, parseAbi, stringToBytes, verifyMessage, zeroAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { HumanRecord } from '../world/humans';

const REGISTRY_ABI = parseAbi([
  'function attest(address wallet, bytes32 humanId, uint8 level, uint64 expiresAt)',
  'function humanOf(address wallet) view returns (bytes32 humanId, uint8 level)',
]);

export const ARC_RPC = 'https://rpc.testnet.arc.network';
const ARC_CHAIN_ID = 5042002;
export const ARC_REGISTRY: Address = '0x7DecbE8467F1A4319d33B0e41ED0ab14123f9657';
export const ARC_COURT: Address = '0x33a4Af074b710F9BdCB73b0190e9Aa65f0A6cc90';
/** The contract allows 40 unsponsored cases in all, so a caller cannot burn them quickly. */
const PUBLISH_COOLDOWN_MS = 5 * 60 * 1000;
const COURT_ABI = parseAbi(['function publishGrandJury(bytes32 contentHash, address sponsor, uint128 sponsorAmount) returns (uint256)', 'function caseCount() view returns (uint256)']);
const ATTESTATION_SECONDS = 30 * 24 * 60 * 60;

/** What the player signs. Tied to their session, so a signature cannot be replayed by someone else. */
export function ownershipMessage(personaId: string, wallet: string): string {
  return `CringeCourt: I own this wallet.\nWallet: ${wallet.toLowerCase()}\nSession: ${personaId}`;
}

/** The registry stores bytes32. The store keeps an HMAC, which may not be that shape. */
export function chainHumanId(humanId: string): Hex {
  return /^0x[0-9a-f]{64}$/i.test(humanId) ? (humanId.toLowerCase() as Hex) : keccak256(stringToBytes(humanId));
}

export interface HumanWriter {
  levelOf(wallet: Address): Promise<number>;
  attest(wallet: Address, humanId: Hex, level: number): Promise<Hex>;
  /** Curator role: put the next question on Arc. Returns the transaction, or null if a publish just ran. */
  publishNextCase(): Promise<Hex | null>;
}

export type AttestFailure = 'bad-wallet' | 'bad-signature' | 'not-verified' | 'disabled';

export type AttestResult = { ok: true; txHash: Hex | null } | { ok: false; reason: AttestFailure };

export function arcHumanWriter(env: Readonly<Record<string, string | undefined>>, clockMs: () => number): HumanWriter | null {
  const key = env.ARC_RELAYER_KEY?.trim();
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const rpc = env.ARC_RPC_URL?.trim() || ARC_RPC;
  const registry = (env.ARC_REGISTRY?.trim() || ARC_REGISTRY) as Address;
  const court = (env.ARC_COURT?.trim() || ARC_COURT) as Address;
  let lastPublish = -Infinity;
  const chain = { id: ARC_CHAIN_ID, name: 'Arc Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } };
  const client = createPublicClient({ chain, transport: http(rpc) });
  const wallet = createWalletClient({ chain, transport: http(rpc), account: privateKeyToAccount(key as Hex) });
  // One relayer, one nonce: attestations go out one at a time.
  let queue: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(send: () => Promise<T>): Promise<T> => {
    const run = queue.then(send, send);
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    async levelOf(address) {
      const [, level] = await client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'humanOf', args: [address] });
      return level;
    },
    attest(address, humanId, level) {
      const send = async (): Promise<Hex> => {
        const expiresAt = BigInt(Math.floor(clockMs() / 1000) + ATTESTATION_SECONDS);
        const hash = await wallet.writeContract({ address: registry, abi: REGISTRY_ABI, functionName: 'attest', args: [address, humanId, level, expiresAt] });
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error('The attestation reverted.');
        return hash;
      };
      return inTurn(send);
    },
    publishNextCase() {
      if (clockMs() - lastPublish < PUBLISH_COOLDOWN_MS) return Promise.resolve(null);
      lastPublish = clockMs();
      return inTurn(async () => {
        const count = await client.readContract({ address: court, abi: COURT_ABI, functionName: 'caseCount' });
        const question = GRAND_JURY_QUESTIONS[Number(count) % GRAND_JURY_QUESTIONS.length]!;
        const contentHash = keccak256(stringToBytes(question));
        const hash = await wallet.writeContract({ address: court, abi: COURT_ABI, functionName: 'publishGrandJury', args: [contentHash, zeroAddress, 0n] });
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error('Publishing the case reverted.');
        return hash;
      });
    },
  };
}

export async function attestWallet(o: {
  writer: HumanWriter | null;
  human: HumanRecord | undefined;
  personaId: string;
  wallet: unknown;
  signature: unknown;
}): Promise<AttestResult> {
  if (!o.writer) return { ok: false, reason: 'disabled' };
  if (typeof o.wallet !== 'string' || !isAddress(o.wallet)) return { ok: false, reason: 'bad-wallet' };
  if (!o.human) return { ok: false, reason: 'not-verified' };
  if (typeof o.signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(o.signature)) return { ok: false, reason: 'bad-signature' };
  const wallet = o.wallet as Address;
  const mine = await verifyMessage({ address: wallet, message: ownershipMessage(o.personaId, wallet), signature: o.signature as Hex }).catch(() => false);
  if (!mine) return { ok: false, reason: 'bad-signature' };
  if ((await o.writer.levelOf(wallet)) >= o.human.level) return { ok: true, txHash: null };
  return { ok: true, txHash: await o.writer.attest(wallet, chainHumanId(o.human.humanId), o.human.level) };
}

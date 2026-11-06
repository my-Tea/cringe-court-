/**
 * ChainPort over the deployed contracts, using viem. Reads go through the
 * public client; writes are simulated first (so reverts surface as CourtError
 * before a wallet prompt), sent, awaited, and their results decoded from the
 * receipt's events.
 */
import {
  BaseError, ContractFunctionRevertedError, decodeErrorResult, maxUint256, parseEventLogs,
  type Account, type Chain, type PublicClient, type Transport, type WalletClient,
} from "viem";
import { CourtError } from "./errors.js";
import { cringeCourtAbi, humanRegistryAbi, mockUsdcAbi } from "./generated/abis.js";
import type { ChainPort, CourtEvent } from "./port.js";
import type { Address, CancelReason, CaseView, Choice, Hex, JurorView, Mode, Phase, SeatOffer, Settlement, Terms } from "./types.js";

export interface ViemChainPortConfig {
  publicClient: PublicClient<Transport, Chain | undefined>;
  /** Omit for a read-only port. */
  walletClient?: WalletClient<Transport, Chain | undefined, Account>;
  addresses: { court: Address; usdc: Address; registry: Address };
  /** Required when the chain object is not set on the clients. */
  chainId?: bigint;
}

const errorAbi = [...cringeCourtAbi, ...humanRegistryAbi, ...mockUsdcAbi].filter((x) => x.type === "error");

/** Turns a viem error into a CourtError carrying the Solidity error name, when there is one. */
export function toCourtError(e: unknown): unknown {
  if (!(e instanceof BaseError)) return e;
  const reverted = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  if (reverted) {
    if (reverted.data?.errorName) return new CourtError(reverted.data.errorName, reverted.data.args ?? [], e.shortMessage);
    const raw = (reverted as unknown as { raw?: Hex }).raw;
    if (raw) {
      try {
        const d = decodeErrorResult({ abi: errorAbi, data: raw });
        return new CourtError(d.errorName, (d.args as readonly unknown[]) ?? [], e.shortMessage);
      } catch {
        /* fall through */
      }
    }
  }
  return e;
}

export function createViemChainPort(cfg: ViemChainPortConfig): ChainPort {
  const { publicClient: pc, walletClient: wc, addresses } = cfg;
  const chainId = cfg.chainId ?? BigInt(pc.chain?.id ?? wc?.chain?.id ?? 0);
  if (chainId === 0n) throw new Error("chainId unknown: pass `chainId` or clients with a chain");
  const court = { address: addresses.court, abi: cringeCourtAbi } as const;

  const read = async <T>(functionName: string, args: readonly unknown[] = []): Promise<T> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await pc.readContract({ ...court, functionName: functionName as any, args: args as any })) as T;
    } catch (e) {
      throw toCourtError(e);
    }
  };

  const write = async (address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[]) => {
    if (!wc) throw new Error("read-only port: no wallet client");
    try {
      const { request } = await pc.simulateContract({
        address,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: abi as any,
        functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: args as any,
        account: wc.account,
        chain: wc.chain,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txHash = await wc.writeContract(request as any);
      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error(`transaction ${txHash} reverted`);
      const events = parseEventLogs({ abi: cringeCourtAbi, logs: receipt.logs }).filter(
        (l) => l.address.toLowerCase() === addresses.court.toLowerCase(),
      );
      return { txHash, events };
    } catch (e) {
      throw toCourtError(e);
    }
  };
  const courtWrite = (fn: string, args: readonly unknown[]) => write(addresses.court, cringeCourtAbi, fn, args);

  type Ev = Awaited<ReturnType<typeof courtWrite>>["events"][number];
  const find = (events: Ev[], name: string) => {
    const e = events.find((x) => x.eventName === name);
    if (!e) throw new Error(`expected ${name} event`);
    return e.args as Record<string, unknown>;
  };

  const port: ChainPort = {
    kind: "viem",
    chainId,
    court: addresses.court,
    account: wc?.account.address,

    async now() {
      const block = await pc.getBlock({ blockTag: "latest" });
      return block.timestamp;
    },

    termsOf: (mode: Mode) => read<Terms>("termsOf", [mode]),
    caseTerms: (id: bigint) => read<Terms>("caseTerms", [id]),
    caseCount: () => read<bigint>("caseCount"),
    getCase: (id: bigint) => read<CaseView>("getCase", [id]),
    jurorsOf: async (id: bigint) => [...(await read<readonly Address[]>("jurorsOf", [id]))],
    jurorOf: (id: bigint, juror: Address) => read<JurorView>("jurorOf", [id, juror]),
    phaseOf: (id: bigint) => read<Phase>("phaseOf", [id]),
    quote: (mode: Mode, sideA: boolean, usePass: boolean) => read<bigint>("quote", [mode, sideA, usePass]),
    claimable: (a: Address) => read<bigint>("claimable", [a]),
    paidBy: (id: bigint, a: Address) => read<bigint>("paidBy", [id, a]),
    isRefundable: (id: bigint) => read<boolean>("isRefundable", [id]),
    commitmentOf: (id: bigint, juror: Address, choice: Choice, salt: Hex) => read<Hex>("commitmentOf", [id, juror, choice, salt]),
    async humanOf(wallet: Address) {
      const [humanId, level] = (await pc.readContract({
        address: addresses.registry, abi: humanRegistryAbi, functionName: "humanOf", args: [wallet],
      })) as readonly [Hex, number];
      return { humanId, level };
    },
    usdcBalance: (a: Address) => pc.readContract({ address: addresses.usdc, abi: mockUsdcAbi, functionName: "balanceOf", args: [a] }),
    usdcAllowance: (owner: Address) =>
      pc.readContract({ address: addresses.usdc, abi: mockUsdcAbi, functionName: "allowance", args: [owner, addresses.court] }),
    async reserve() {
      const [balance, locked] = await Promise.all([read<bigint>("reserveBalance"), read<bigint>("reserveLocked")]);
      return { balance, locked };
    },
    async marketing() {
      const [cap, used] = await Promise.all([read<number>("marketingCap"), read<number>("marketingUsed")]);
      return { cap: Number(cap), used: Number(used) };
    },

    async approveUsdc(amount: bigint) {
      const { txHash } = await write(addresses.usdc, mockUsdcAbi, "approve", [addresses.court, amount]);
      return { txHash };
    },
    async fileSolo(p) {
      const r = await courtWrite("fileSolo", [p.contentHash, !!p.usePass]);
      return { txHash: r.txHash, caseId: find(r.events, "CaseCreated").caseId as bigint };
    },
    async fileSoloJury(p) {
      const r = await courtWrite("fileSoloJury", [p.contentHash, p.jurors]);
      return { txHash: r.txHash, caseId: find(r.events, "CaseCreated").caseId as bigint };
    },
    async soloPrice(jurors) {
      const [price, bond, successBonus] = await read<readonly [bigint, bigint, bigint]>("soloPrice", [jurors]);
      return { price, bond, successBonus };
    },
    async openVersus(p) {
      const r = await courtWrite("openVersus", [p.sideB, p.contentHash, !!p.usePass]);
      return { txHash: r.txHash, caseId: find(r.events, "CaseCreated").caseId as bigint };
    },
    async joinVersus(id, usePass = false) {
      return { txHash: (await courtWrite("joinVersus", [id, usePass])).txHash };
    },
    async withdrawInvite(id) {
      return { txHash: (await courtWrite("withdrawInvite", [id])).txHash };
    },
    async publishGrandJury(p) {
      const r = await courtWrite("publishGrandJury", [
        p.contentHash, p.sponsor ?? "0x0000000000000000000000000000000000000000", p.sponsorAmount ?? 0n,
      ]);
      return { txHash: r.txHash, caseId: find(r.events, "CaseCreated").caseId as bigint };
    },
    async contribute(id, amount) {
      const r = await courtWrite("contribute", [id, amount]);
      return { txHash: r.txHash, accepted: find(r.events, "PaymentReceived").amount as bigint };
    },
    async acceptSeat(offer: SeatOffer) {
      return { txHash: (await courtWrite("acceptSeat", [offer.caseId, offer.expiresAt, offer.signature])).txHash };
    },
    async openCourt(id, transcriptHash) {
      return { txHash: (await courtWrite("openCourt", [id, transcriptHash])).txHash };
    },
    async failPreparation(id) {
      return { txHash: (await courtWrite("failPreparation", [id])).txHash };
    },
    async protectiveCancel(id) {
      return { txHash: (await courtWrite("protectiveCancel", [id])).txHash };
    },
    async commitVote(id, commitment) {
      return { txHash: (await courtWrite("commitVote", [id, commitment])).txHash };
    },
    async revealVote(id, choice, salt) {
      return { txHash: (await courtWrite("revealVote", [id, choice, salt])).txHash };
    },
    async finalize(id) {
      const r = await courtWrite("finalize", [id]);
      return { txHash: r.txHash, settlement: find(r.events, "CaseFinalized").settlement as Settlement };
    },
    async cancelExpired(id) {
      const r = await courtWrite("cancelExpired", [id]);
      return { txHash: r.txHash, reason: find(r.events, "CaseCancelled").reason as CancelReason };
    },
    async claimRefund(id, payer) {
      const r = payer ? await courtWrite("claimRefundFor", [id, payer]) : await courtWrite("claimRefund", [id]);
      return { txHash: r.txHash, amount: find(r.events, "RefundClaimed").amount as bigint };
    },
    async withdraw() {
      const r = await courtWrite("withdraw", []);
      return { txHash: r.txHash, amount: find(r.events, "Withdrawn").amount as bigint };
    },
    async fundReserve(amount) {
      return { txHash: (await courtWrite("fundReserve", [amount])).txHash };
    },

    onEvent(listener: (e: CourtEvent) => void) {
      return pc.watchContractEvent({
        address: addresses.court,
        abi: cringeCourtAbi,
        onLogs: (logs) => {
          for (const l of logs) {
            listener({ name: l.eventName as string, args: (l.args ?? {}) as Record<string, unknown>, txHash: l.transactionHash ?? undefined });
          }
        },
      });
    },
  };
  return port;
}

/** Infinite approval helper for demo wallets (testnet only). */
export const UNLIMITED = maxUint256;

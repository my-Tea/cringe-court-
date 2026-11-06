/**
 * One test-facing surface over two worlds: the in-memory MemoryChain and the
 * real contracts on a Hardhat node. Conformance tests use only `Harness` and
 * `ChainPort`, so the same code proves the same behaviour on both.
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient, createTestClient, createWalletClient, http, keccak256, maxUint256, toHex,
  type Account, type Chain, type Hex as VHex,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import {
  createMemoryChain, createViemChainPort, signSeatOffer, buildTerms, termsConfig, cringeCourtAbi, humanRegistryAbi,
  mockUsdcAbi, Mode, Level, ROLES, type Address, type ChainPort, type Hex, type MemoryChain, type Pricing, type SeatOffer,
  type Terms, type Timing,
} from "../src/index.js";

export interface Accounts {
  admin: Address;
  operator: Address;
  assigner: Address;
  curator: Address;
  attester: Address;
  treasury: Address;
  aiTreasury: Address;
  sponsor: Address;
  creator: Address;
  sideB: Address;
  jurors: Address[];
  others: Address[];
}

export interface Harness {
  name: "memory" | "evm";
  a: Accounts;
  port(account: Address): ChainPort;
  now(): Promise<bigint>;
  advanceTo(t: bigint): Promise<void>;
  setTerms(mode: Mode, t: Terms): Promise<void>;
  attest(wallet: Address, humanId: Hex, level: number): Promise<void>;
  seatOffer(caseId: bigint, juror: Address, ttl?: bigint): Promise<SeatOffer>;
  courtBalance(): Promise<bigint>;
}

export const humanIdOf = (persona: string): Hex => keccak256(toHex(`human:${persona}`));
const FUND = 1000n * 10n ** 6n;
const YEAR = 365n * 24n * 3600n;

// The well-known Hardhat development mnemonic (public test keys, not secrets).
const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";

function accountsFrom(list: Address[]): Accounts {
  const [admin, operator, assigner, curator, attester, treasury, aiTreasury, sponsor, creator, sideB] = list;
  return { admin, operator, assigner, curator, attester, treasury, aiTreasury, sponsor, creator, sideB, jurors: list.slice(10, 20), others: list.slice(20, 26) };
}

// ---------------------------------------------------------------- memory

export async function memoryHarness(opts: { timing?: Timing; pricing?: Pricing; reserve?: bigint } = {}): Promise<Harness> {
  const local = Array.from({ length: 26 }, (_, i) => mnemonicToAccount(HARDHAT_MNEMONIC, { addressIndex: i }));
  const a = accountsFrom(local.map((x) => x.address));
  const chain: MemoryChain = createMemoryChain({ timing: opts.timing, pricing: opts.pricing, admin: a.admin, treasury: a.treasury, aiTreasury: a.aiTreasury });
  chain.grantRole(ROLES.OPERATOR, a.operator);
  chain.grantRole(ROLES.ASSIGNER, a.assigner);
  chain.grantRole(ROLES.CURATOR, a.curator);
  chain.grantRole(ROLES.ATTESTER, a.attester);
  for (const w of [a.admin, a.sponsor, a.creator, a.sideB, ...a.jurors, ...a.others]) {
    chain.mint(w, FUND);
    await chain.as(w).approveUsdc(maxUint256);
  }
  const h: Harness = {
    name: "memory",
    a,
    port: (acct) => chain.as(acct),
    now: async () => chain.now(),
    advanceTo: async (t) => chain.setTime(t),
    setTerms: async (mode, t) => void chain.setTerms(a.admin, mode, t),
    attest: async (wallet, humanId, level) => void chain.attest(a.attester, wallet, humanId, level, chain.now() + YEAR),
    seatOffer: async (caseId, juror, ttl = 600n) =>
      signSeatOffer(local[2], { chainId: chain.chainId, court: chain.court, caseId, juror, expiresAt: chain.now() + ttl }),
    courtBalance: async () => chain.courtBalance(),
  };
  await seed(h, opts.reserve);
  return h;
}

// ---------------------------------------------------------------- evm

const CONTRACTS = path.resolve(__dirname, "../../../contracts");
const artifact = (p: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, "artifacts", p), "utf8")) as { bytecode: VHex };

export interface EvmWorld {
  url: string;
  baseSnapshot: VHex;
  addresses: { court: Address; usdc: Address; registry: Address };
  local: Account[];
}

/**
 * EVM snapshots are global to the node, so only one world (timing × pricing)
 * can be live: switching worlds reverts to a pristine pre-deployment snapshot
 * and deploys again.
 */
let current: { key: string; world: EvmWorld } | undefined;
let pristine: VHex | undefined;

/**
 * Deploys once per (timing, pricing) and reverts to a snapshot for every
 * harness, so each test starts from the same fresh deployment.
 */
export async function evmHarness(url: string, opts: { timing?: Timing; pricing?: Pricing; reserve?: bigint } = {}): Promise<Harness> {
  const chain: Chain = { ...hardhat, rpcUrls: { default: { http: [url] } } };
  // No retries: a local node never drops requests, and viem would retry reverts (Hardhat reports them as internal errors).
  const transport = http(url, { retryCount: 0, timeout: 60_000 });
  const pc = createPublicClient({ chain, transport, pollingInterval: 50, cacheTime: 0 });
  const test = createTestClient({ chain, transport, mode: "hardhat" });
  const local = Array.from({ length: 26 }, (_, i) => mnemonicToAccount(HARDHAT_MNEMONIC, { addressIndex: i }));
  const a = accountsFrom(local.map((x) => x.address));
  const wallet = (acct: Account) => createWalletClient({ chain, transport, account: acct, pollingInterval: 50, cacheTime: 0 });
  const key = `${url}|${opts.timing ?? "production"}|${opts.pricing ?? "hackathon"}|${opts.reserve ?? "default"}`;

  if (current?.key === key) {
    await test.revert({ id: current.world.baseSnapshot });
    current.world.baseSnapshot = await test.snapshot();
    return makeEvm(current.world);
  }
  {
    if (pristine) {
      await test.revert({ id: pristine });
    }
    pristine = await test.snapshot();
    const admin = wallet(local[0]);
    const deploy = async (abi: readonly unknown[], bytecode: VHex, args: readonly unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await admin.deployContract({ abi: abi as any, bytecode, args: args as any });
      const r = await pc.waitForTransactionReceipt({ hash });
      return r.contractAddress as Address;
    };
    const usdc = await deploy(mockUsdcAbi, artifact("src/test/MockUSDC.sol/MockUSDC.json").bytecode, []);
    const registry = await deploy(humanRegistryAbi, artifact("src/HumanRegistry.sol/HumanRegistry.json").bytecode, [a.admin, a.attester]);
    const court = await deploy(cringeCourtAbi, artifact("src/CringeCourt.sol/CringeCourt.json").bytecode, [usdc, registry, a.admin, a.treasury, a.aiTreasury]);
    const send = async (acct: Account, address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await wallet(acct).writeContract({ address, abi: abi as any, functionName, args: args as any, chain });
      await pc.waitForTransactionReceipt({ hash });
    };
    await send(local[0], court, cringeCourtAbi, "grantRole", [ROLES.OPERATOR, a.operator]);
    await send(local[0], court, cringeCourtAbi, "grantRole", [ROLES.ASSIGNER, a.assigner]);
    await send(local[0], court, cringeCourtAbi, "grantRole", [ROLES.CURATOR, a.curator]);
    for (const m of [Mode.Solo, Mode.Versus, Mode.GrandJury]) {
      await send(local[0], court, cringeCourtAbi, "setTerms", [m, buildTerms(m, opts.timing ?? "production", opts.pricing ?? "hackathon")]);
    }
    await send(local[0], court, cringeCourtAbi, "setMarketingCap", [termsConfig.marketingCap[opts.pricing ?? "hackathon"]]);
    for (const i of [0, 7, 8, 9, ...Array.from({ length: 16 }, (_, k) => 10 + k)]) {
      await send(local[0], usdc, mockUsdcAbi, "mint", [local[i].address, FUND]);
      await send(local[i], usdc, mockUsdcAbi, "approve", [court, maxUint256]);
    }
    const world: EvmWorld = { url, baseSnapshot: "0x0", addresses: { court, usdc, registry }, local };
    current = { key, world };
    // seed before snapshotting so every harness starts seeded
    const h0 = makeEvm(world);
    await seed(h0, opts.reserve);
    world.baseSnapshot = await test.snapshot();
    return h0;
  }

  function makeEvm(w: EvmWorld): Harness {
    const ports = new Map<Address, ChainPort>();
    const sendRaw = async (acct: Account, address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await wallet(acct).writeContract({ address, abi: abi as any, functionName, args: args as any, chain });
      await pc.waitForTransactionReceipt({ hash });
    };
    const now = async () => (await pc.getBlock({ blockTag: "latest" })).timestamp;
    return {
      name: "evm",
      a,
      port(acct) {
        let p = ports.get(acct);
        if (!p) {
          const signer = w.local.find((x) => x.address === acct);
          if (!signer) throw new Error(`no key for ${acct}`);
          p = createViemChainPort({ publicClient: pc, walletClient: wallet(signer), addresses: w.addresses, chainId: BigInt(chain.id) });
          ports.set(acct, p);
        }
        return p;
      },
      now,
      async advanceTo(t) {
        const cur = await now();
        if (t <= cur) return;
        // the next transaction will be mined at exactly `t`, as in the memory chain
        await test.setNextBlockTimestamp({ timestamp: t });
        await test.mine({ blocks: 1 });
      },
      setTerms: (mode, t) => sendRaw(w.local[0], w.addresses.court, cringeCourtAbi, "setTerms", [mode, t]),
      async attest(wallet_, humanId, level) {
        await sendRaw(w.local[4], w.addresses.registry, humanRegistryAbi, "attest", [wallet_, humanId, level, (await now()) + YEAR]);
      },
      async seatOffer(caseId, juror, ttl = 600n) {
        return signSeatOffer(w.local[2] as never, { chainId: BigInt(chain.id), court: w.addresses.court, caseId, juror, expiresAt: (await now()) + ttl });
      },
      courtBalance: () => pc.readContract({ address: w.addresses.usdc, abi: mockUsdcAbi, functionName: "balanceOf", args: [w.addresses.court] }),
    };
  }
}

async function seed(h: Harness, reserve = 50n * 10n ** 6n) {
  await h.attest(h.a.creator, humanIdOf("creator"), Level.DEVICE);
  await h.attest(h.a.sideB, humanIdOf("sideB"), Level.DEVICE);
  for (let i = 0; i < h.a.jurors.length; i++) await h.attest(h.a.jurors[i], humanIdOf(`juror${i}`), Level.ORB);
  if (reserve > 0n) await h.port(h.a.admin).fundReserve(reserve);
}

export const MOCK_ASSIGNER_NOTE = "assigner = Hardhat dev account #2 (public test key)";
export { privateKeyToAccount };

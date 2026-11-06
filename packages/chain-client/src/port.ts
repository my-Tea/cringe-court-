import type {
  Address, CancelReason, CaseView, Choice, Hex, JurorView, Mode, Phase, SeatOffer, Settlement, Terms,
} from "./types.js";

/** A decoded contract event. `args` uses the Solidity parameter names. */
export interface CourtEvent {
  name: string;
  args: Record<string, unknown>;
  txHash?: Hex;
}

export interface TxResult {
  txHash: Hex;
}

/**
 * What the UI and the mode tracks talk to. Two implementations share these
 * semantics exactly: `createViemChainPort` (real contracts) and
 * `createMemoryChain` (in-memory, for tests, storybook and offline demos).
 * Reverts throw `CourtError` with the Solidity custom error name as `code`.
 * A port acts as one `account`; use `memory.as(address)` or a second viem
 * wallet client to act as someone else.
 */
export interface ChainPort {
  readonly kind: "viem" | "memory";
  readonly chainId: bigint;
  readonly court: Address;
  readonly account: Address | undefined;

  /** Chain time (latest block timestamp, or the mock clock). */
  now(): Promise<bigint>;

  // reads
  termsOf(mode: Mode): Promise<Terms>;
  caseTerms(caseId: bigint): Promise<Terms>;
  caseCount(): Promise<bigint>;
  getCase(caseId: bigint): Promise<CaseView>;
  jurorsOf(caseId: bigint): Promise<Address[]>;
  jurorOf(caseId: bigint, juror: Address): Promise<JurorView>;
  phaseOf(caseId: bigint): Promise<Phase>;
  quote(mode: Mode, sideA: boolean, usePass: boolean): Promise<bigint>;
  claimable(account: Address): Promise<bigint>;
  paidBy(caseId: bigint, payer: Address): Promise<bigint>;
  isRefundable(caseId: bigint): Promise<boolean>;
  commitmentOf(caseId: bigint, juror: Address, choice: Choice, salt: Hex): Promise<Hex>;
  humanOf(wallet: Address): Promise<{ humanId: Hex; level: number }>;
  usdcBalance(account: Address): Promise<bigint>;
  usdcAllowance(owner: Address): Promise<bigint>;
  reserve(): Promise<{ balance: bigint; locked: bigint }>;
  marketing(): Promise<{ cap: number; used: number }>;

  // writes, as `account`
  approveUsdc(amount: bigint): Promise<TxResult>;
  fileSolo(p: { contentHash: Hex; usePass?: boolean }): Promise<TxResult & { caseId: bigint }>;
  /** Arc only: a Solo case with a jury of 3, 5 or 7. */
  fileSoloJury?(p: { contentHash: Hex; jurors: number }): Promise<TxResult & { caseId: bigint }>;
  /** Arc only: what that jury costs the filer, and what a juror stakes and earns. */
  soloPrice?(jurors: number): Promise<{ price: bigint; bond: bigint; successBonus: bigint }>;
  openVersus(p: { sideB: Address; contentHash: Hex; usePass?: boolean }): Promise<TxResult & { caseId: bigint }>;
  joinVersus(caseId: bigint, usePass?: boolean): Promise<TxResult>;
  withdrawInvite(caseId: bigint): Promise<TxResult>;
  publishGrandJury(p: { contentHash: Hex; sponsor?: Address; sponsorAmount?: bigint }): Promise<TxResult & { caseId: bigint }>;
  contribute(caseId: bigint, amount: bigint): Promise<TxResult & { accepted: bigint }>;
  acceptSeat(offer: SeatOffer): Promise<TxResult>;
  openCourt(caseId: bigint, transcriptHash: Hex): Promise<TxResult>;
  failPreparation(caseId: bigint): Promise<TxResult>;
  protectiveCancel(caseId: bigint): Promise<TxResult>;
  commitVote(caseId: bigint, commitment: Hex): Promise<TxResult>;
  revealVote(caseId: bigint, choice: Choice, salt: Hex): Promise<TxResult>;
  finalize(caseId: bigint): Promise<TxResult & { settlement: Settlement }>;
  cancelExpired(caseId: bigint): Promise<TxResult & { reason: CancelReason }>;
  /** Refund `payer` (default: own account). Permissionless. */
  claimRefund(caseId: bigint, payer?: Address): Promise<TxResult & { amount: bigint }>;
  withdraw(): Promise<TxResult & { amount: bigint }>;
  fundReserve(amount: bigint): Promise<TxResult>;

  /** Subscribes to court events. Returns an unsubscribe function. */
  onEvent(listener: (e: CourtEvent) => void): () => void;
}

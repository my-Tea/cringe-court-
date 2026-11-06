/**
 * Domain types mirroring contracts/src/interfaces/ICringeCourt.sol. Numeric
 * enum values are the on-chain uint8 values. Amounts are USDC base units
 * (6 decimals) as bigint; timestamps are unix seconds as bigint.
 */
export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export const Mode = { Solo: 0, Versus: 1, GrandJury: 2 } as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

export const Status = { None: 0, Pending: 1, Recruiting: 2, Preparing: 3, Voting: 4, Finalized: 5, Cancelled: 6 } as const;
export type Status = (typeof Status)[keyof typeof Status];

/** Choice0 / Choice1 are ballot positions; labels per mode live in `BALLOT_LABELS`. */
export const Outcome = { None: 0, Choice0: 1, Choice1: 2, NoVerdict: 3 } as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export const CancelReason = {
  None: 0,
  ConsentExpired: 1,
  InviteWithdrawn: 2,
  FundingExpired: 3,
  JuryNotFilled: 4,
  PreparationFailed: 5,
  PreparationExpired: 6,
  ProtectiveCancel: 7,
} as const;
export type CancelReason = (typeof CancelReason)[keyof typeof CancelReason];

export const Phase = {
  None: 0,
  AwaitingCounterparty: 1,
  Crowdfunding: 2,
  Recruiting: 3,
  Preparing: 4,
  Commit: 5,
  Reveal: 6,
  Finalizable: 7,
  Expired: 8,
  Finalized: 9,
  Cancelled: 10,
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

/** IHumanRegistry levels (same numbers as @cringe-court/world-id IdentityLevel). */
export const Level = { NONE: 0, DEVICE: 1, DOCUMENT: 2, ORB: 3 } as const;
export type Level = (typeof Level)[keyof typeof Level];

export type Choice = 0 | 1;

export interface Terms {
  n: number;
  minJurorLevel: number;
  minPartyLevel: number;
  enabled: boolean;
  passEnabled: boolean;
  demoTiming: boolean;
  bond: bigint;
  successBonus: bigint;
  failedTrialBonus: bigint;
  protocolFee: bigint;
  aiFeePerAgent: bigint;
  incidentStipend: bigint;
  minContribution: bigint;
  sponsorFloor: bigint;
  pendingWindow: number;
  recruitWindow: number;
  prepWindow: number;
  commitWindow: number;
  revealWindow: number;
}

export interface CaseView {
  mode: Mode;
  status: Status;
  outcome: Outcome;
  cancelReason: CancelReason;
  jurySize: number;
  seated: number;
  committed: number;
  revealed: number;
  votes0: number;
  votes1: number;
  sponsored: boolean;
  creator: Address;
  counterparty: Address;
  sponsor: Address;
  creatorHuman: Hex;
  counterpartyHuman: Hex;
  contentHash: Hex;
  transcriptHash: Hex;
  createdAt: bigint;
  pendingDeadline: bigint;
  recruitDeadline: bigint;
  prepDeadline: bigint;
  commitDeadline: bigint;
  revealDeadline: bigint;
  target: bigint;
  raised: bigint;
  poolHeld: bigint;
  protocolFeeHeld: bigint;
  aiFeeHeld: bigint;
  sponsorDeposit: bigint;
  stipendLocked: bigint;
}

export interface JurorView {
  seated: boolean;
  revealed: boolean;
  seat: number;
  choice: number;
  humanId: Hex;
  commitment: Hex;
}

/** The settlement receipt emitted by CaseFinalized (D13 per-case disclosure). */
export interface Settlement {
  outcome: Outcome;
  timely: number;
  absent: number;
  payoutPerTimelyJuror: bigint;
  bonusPerTimelyJuror: bigint;
  forfeitedBonds: bigint;
  unearnedBonus: bigint;
  protocolFees: bigint;
  aiFees: bigint;
  sponsorFee: bigint;
  toTreasury: bigint;
  toAiTreasury: bigint;
  refundableToPayers: bigint;
}

/** EIP-712 SeatOffer signed by an ASSIGNER: the random seat offer a juror may accept. */
export interface SeatOffer {
  caseId: bigint;
  juror: Address;
  expiresAt: bigint;
  signature: Hex;
}

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
export const ZERO_HASH: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Ballot labels per mode (D5, D8). Grand Jury titles come from the reviewed context card. */
export const BALLOT_LABELS: Record<Mode, readonly [string, string] | null> = {
  [Mode.Solo]: ["GUILTY", "NOT COOKED"],
  [Mode.Versus]: ["SIDE A", "SIDE B"],
  [Mode.GrandJury]: null,
};

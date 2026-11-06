/**
 * ChainPort: Arc testnet escrow, juror bonds, commit–reveal, deadlines, payouts,
 * refunds and fee splits. The contract is the source of truth for money and
 * phase; this port reads it and sends transactions. The in-memory twin
 * (`MemoryChain`, core/testing) settles with `settle()` so both agree.
 *
 * Compatibility notes for the contract (v3/p5-contracts):
 * - One ballot for every mode: choice ∈ {0, 1}, NO_VERDICT as an outcome (D5).
 * - N is a per-case parameter; threshold = N + 1 (D7, D8).
 * - All terms are written at creation and immutable for the case (rule 2).
 * - The commitment encoding belongs to the adapter (`commitmentFor`), so the app
 *   never hard-codes it. The memory twin uses
 *   keccak256(abi.encode(caseNumber, juror, choice, salt)).
 */
import type { CaseNumber, CasePhase, CaseSummary, Hex, ReceiptLine } from '../case';
import type { SideId } from '../cast';
import type { ModeId } from '../modes';
import type { Usdc } from '../money';
import type { BallotChoice, FunderKind } from '../settlement';
import type { CaseTerms } from '../terms';
import type { TxReceipt } from './court';

export type Unsubscribe = () => void;

export interface CreateCaseParams {
  terms: CaseTerms;
  /** Fingerprint of the frozen transcript, recorded before voting (V4 §6.5). */
  transcriptHash: Hex;
  /** Named payers in payer order (Solo [filer], Versus [A, B]); empty for crowdfunds. */
  payers: readonly Hex[];
  /** Public, sanitized title for the case card. */
  title: string;
  /** Unix seconds; the funding window (pre-trial) starts here. */
  openedAt?: number;
}

export interface ChainSeat {
  seat: number;
  juror: Hex;
  committed: boolean;
  revealed: boolean;
  /** Present only after reveal. */
  choice?: BallotChoice;
}

export interface ChainDeposit {
  account: Hex;
  kind: FunderKind;
  amount: Usdc;
  side?: SideId;
}

/** Everything the contract knows about one case. */
export interface ChainCase extends CaseSummary {
  terms: CaseTerms;
  payers: readonly Hex[];
  deposits: readonly ChainDeposit[];
  raised: Usdc;
  seats: readonly ChainSeat[];
  /** Absolute unix-second deadlines (null until that window opens). */
  deadlines: {
    funding: number | null;
    recruitment: number | null;
    commit: number | null;
    reveal: number | null;
  };
  /** Accounts that still have an unclaimed payout or refund. */
  claimable: readonly Hex[];
}

export type ChainEvent =
  | { type: 'case-created'; caseNumber: CaseNumber; transcriptHash: Hex }
  | { type: 'funded'; caseNumber: CaseNumber; account: Hex; kind: FunderKind; amount: Usdc; raised: Usdc }
  | { type: 'seat-accepted'; caseNumber: CaseNumber; juror: Hex; seat: number }
  | { type: 'phase'; caseNumber: CaseNumber; phase: CasePhase; endsAt: number | null }
  | { type: 'committed'; caseNumber: CaseNumber; juror: Hex }
  | { type: 'revealed'; caseNumber: CaseNumber; juror: Hex; choice: BallotChoice }
  | { type: 'finalized'; caseNumber: CaseNumber; verdictKind: 'ballot-0' | 'ballot-1' | 'no-verdict' }
  | { type: 'cancelled'; caseNumber: CaseNumber; reason: string }
  | { type: 'claimed'; caseNumber: CaseNumber; account: Hex; amount: Usdc };

export class ChainError extends Error {
  constructor(
    readonly code:
      | 'not-found'
      | 'wrong-phase'
      | 'deadline'
      | 'not-allowed'
      | 'bad-amount'
      | 'bad-reveal'
      | 'duplicate'
      | 'rejected'
      | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'ChainError';
  }
}

export interface ChainPort {
  readonly id: 'arc-testnet' | 'memory';
  /** D14: a mainnet ledger does not type-check. */
  readonly network: 'arc-testnet';
  readonly chainId: number;
  /** The connected account, or null. */
  account(): Promise<Hex | null>;
  usdcBalance(account: Hex): Promise<Usdc>;

  createCase(params: CreateCaseParams): Promise<{ caseNumber: CaseNumber; receipt: TxReceipt }>;
  getCase(caseNumber: CaseNumber): Promise<ChainCase | null>;
  listCases(filter?: { mode?: ModeId; phase?: CasePhase }): Promise<readonly ChainCase[]>;

  /** Named payer's share (Solo/Versus) or a crowdfund contribution (≥ min, D9). */
  fund(caseNumber: CaseNumber, amount: Usdc): Promise<TxReceipt>;
  /** Grand Jury sponsor slot (D9/D10). */
  sponsor(caseNumber: CaseNumber, amount: Usdc): Promise<TxReceipt>;

  /** Deposit the case's bond for a seat. `nullifier` is the World ID proof for this case (verified on-chain or by the relayer). */
  acceptSeat(caseNumber: CaseNumber, nullifier: Hex): Promise<TxReceipt>;
  /** The commitment the contract expects. Pure; adapter-owned encoding. */
  commitmentFor(caseNumber: CaseNumber, juror: Hex, choice: BallotChoice, salt: Hex): Hex;
  commit(caseNumber: CaseNumber, commitment: Hex): Promise<TxReceipt>;
  reveal(caseNumber: CaseNumber, choice: BallotChoice, salt: Hex): Promise<TxReceipt>;

  /** Permissionless: anyone can advance a phase whose deadline has passed (D13). */
  advance(caseNumber: CaseNumber): Promise<TxReceipt>;
  /** Permissionless finalization after the reveal deadline. */
  finalize(caseNumber: CaseNumber): Promise<TxReceipt>;
  /** Pull this account's payout or refund. */
  claim(caseNumber: CaseNumber): Promise<TxReceipt>;
  /** Per-account receipt lines once settled (or refunded). */
  receipts(caseNumber: CaseNumber, account: Hex): Promise<readonly ReceiptLine[]>;

  subscribe(caseNumber: CaseNumber | '*', listener: (event: ChainEvent) => void): Unsubscribe;
}

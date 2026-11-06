import type { ModeId } from './modes';
import type { Usdc } from './money';

/** "CASE #0069". Case numbers are assigned by the contract and only ever grow. */
export type CaseNumber = number & { readonly __caseNumber: true };

export function caseNumber(n: number): CaseNumber {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Case numbers start at 1: ${n}`);
  return n as CaseNumber;
}

export function formatCaseNumber(n: CaseNumber): string {
  return `CASE #${String(n).padStart(4, '0')}`;
}

export type Category = 'crypto-crimes' | 'dating-crimes' | 'npc-behavior' | 'internet-crimes';

export const CATEGORIES: Readonly<Record<Category, string>> = {
  'crypto-crimes': 'Crypto Crimes',
  'dating-crimes': 'Dating Crimes',
  'npc-behavior': 'NPC Behavior',
  'internet-crimes': 'Internet Crimes',
};

/**
 * Where a case is in its life. The order is the happy path (V4 §6); `cancelled`
 * can follow any phase before `settled` and always refunds (V4 §8).
 *
 *   draft → pre-trial → recruiting → preparing → commit → reveal → finalizing → settled
 *                                  ↘ cancelled (any time before settled)
 */
export type CasePhase =
  | 'draft'
  | 'pre-trial'
  | 'recruiting'
  | 'preparing'
  | 'commit'
  | 'reveal'
  | 'finalizing'
  | 'settled'
  | 'cancelled';

export const PHASE_ORDER: readonly CasePhase[] = [
  'draft',
  'pre-trial',
  'recruiting',
  'preparing',
  'commit',
  'reveal',
  'finalizing',
  'settled',
];

/** Player-facing names. Compliance steps wear courtroom costumes (V4 §13). */
export const PHASE_LABELS: Readonly<Record<CasePhase, string>> = {
  draft: 'Filing',
  'pre-trial': 'Pre-trial',
  recruiting: 'Jury selection',
  preparing: 'Counsel preparing',
  commit: 'Secret Verdict Scroll',
  reveal: 'Open Your Scroll',
  finalizing: 'Deliberation closed',
  settled: 'Verdict',
  cancelled: 'Cancelled',
};

/** Which phases come next. Used by the engine to reject impossible transitions. */
export const PHASE_TRANSITIONS: Readonly<Record<CasePhase, readonly CasePhase[]>> = {
  draft: ['pre-trial', 'recruiting', 'cancelled'],
  'pre-trial': ['recruiting', 'cancelled'],
  recruiting: ['preparing', 'cancelled'],
  preparing: ['commit', 'cancelled'],
  commit: ['reveal', 'cancelled'],
  reveal: ['finalizing', 'cancelled'],
  finalizing: ['settled', 'cancelled'],
  settled: [],
  cancelled: [],
};

export function canTransition(from: CasePhase, to: CasePhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

/**
 * The human outcome. `NO_VERDICT` means fewer than N + 1 matching revealed votes;
 * the app shows it as a MISTRIAL screen with a full refund (V4 §13).
 */
export type VerdictKind = 'ballot-0' | 'ballot-1' | 'no-verdict';

export interface Verdict {
  kind: VerdictKind;
  /** The winning ballot label ("GUILTY", "SIDE B" …), or "NO VERDICT". */
  label: string;
  /** Revealed votes per ballot option, in ballot order. */
  tally: readonly [number, number];
  /** Jurors who completed both commit and reveal in time. */
  completedDuty: number;
  appointed: number;
}

/** Per-person settlement line ("receipt"), labelled honestly (V4 §5). */
export type ReceiptKind = 'bond-returned' | 'reward' | 'refund' | 'forfeit' | 'stipend' | 'fee';

export interface ReceiptLine {
  kind: ReceiptKind;
  label: string;
  amount: Usdc;
}

/** A 0x-prefixed hex string (addresses, hashes, commitments). */
export type Hex = `0x${string}`;

export interface CaseSummary {
  number: CaseNumber;
  mode: ModeId;
  category: Category;
  /** Sanitized, approved public title. */
  title: string;
  phase: CasePhase;
  /** Unix seconds when the current phase ends, if it has a deadline. */
  phaseEndsAt: number | null;
  /** Content fingerprint of the frozen transcript, recorded before voting (V4 §6.5). */
  transcriptHash: Hex | null;
  verdict: Verdict | null;
}

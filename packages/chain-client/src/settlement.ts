/** Mirror of contracts/src/CourtMath.sol. Keep the two in lockstep. */
import { Outcome, type Settlement } from "./types.js";

export const MAX_N = 10;

export const jurySize = (n: number): number => 2 * n + 1;
export const poolOf = (n: number, successBonus: bigint): bigint => BigInt(jurySize(n)) * successBonus;
/** Versus split: Side A carries the odd base unit. */
export const sideShare = (amount: bigint, sideA: boolean): bigint => (sideA ? amount - amount / 2n : amount / 2n);

export function outcomeOf(n: number, votes0: number, votes1: number): Outcome {
  if (votes0 >= n + 1) return Outcome.Choice0;
  if (votes1 >= n + 1) return Outcome.Choice1;
  return Outcome.NoVerdict;
}

export interface SettleInput {
  n: number;
  timely: number;
  votes0: number;
  votes1: number;
  bond: bigint;
  successBonus: bigint;
  failedTrialBonus: bigint;
  poolHeld: bigint;
  protocolFeeHeld: bigint;
  aiFeeHeld: bigint;
  sponsorDeposit: bigint;
  raised: bigint;
}

export function settle(i: SettleInput): Settlement {
  const absent = jurySize(i.n) - i.timely;
  const outcome = outcomeOf(i.n, i.votes0, i.votes1);
  const forfeitedBonds = BigInt(absent) * i.bond;
  const s: Settlement = {
    outcome,
    timely: i.timely,
    absent,
    payoutPerTimelyJuror: 0n,
    bonusPerTimelyJuror: 0n,
    forfeitedBonds,
    unearnedBonus: 0n,
    protocolFees: 0n,
    aiFees: 0n,
    sponsorFee: i.sponsorDeposit,
    toTreasury: 0n,
    toAiTreasury: 0n,
    refundableToPayers: 0n,
  };
  if (outcome === Outcome.NoVerdict) {
    s.bonusPerTimelyJuror = i.failedTrialBonus;
    const owed = BigInt(i.timely) * i.failedTrialBonus;
    if (owed > forfeitedBonds) throw new Error("panic: failed-trial bonus not covered by forfeits");
    s.toTreasury = forfeitedBonds - owed + s.sponsorFee;
    s.refundableToPayers = i.raised;
  } else {
    s.bonusPerTimelyJuror = i.successBonus;
    s.unearnedBonus = i.poolHeld - BigInt(i.timely) * i.successBonus;
    s.protocolFees = i.protocolFeeHeld;
    s.aiFees = i.aiFeeHeld;
    s.toTreasury = forfeitedBonds + s.unearnedBonus + s.protocolFees + s.sponsorFee;
    s.toAiTreasury = s.aiFees;
  }
  s.payoutPerTimelyJuror = i.bond + s.bonusPerTimelyJuror;
  return s;
}

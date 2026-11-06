/**
 * Case terms: the per-case snapshot of a mode's rules, written when the case is
 * created and immutable for that case (DECISIONS rule 2). Everything that runs a
 * case (engine, settlement, chain adapters) reads terms, never MODES.
 */
import type { BallotLabels, Deadlines, FundingModel, ModeConfig, ModeId } from './modes';
import { caseCharge, jurySize, verdictThreshold } from './modes';
import { ZERO_USDC, micro, mulUsdc, subUsdc, type Usdc } from './money';

export interface CaseTerms {
  mode: ModeId;
  /** N: an appointed jury of 2N + 1. */
  n: number;
  jurySize: number;
  /** N + 1 matching revealed votes (D8). */
  threshold: number;
  ballot: BallotLabels;
  funding: FundingModel;
  bondPerJuror: Usdc;
  successBonusPerJuror: Usdc;
  failedTrialBonusPerTimelyJuror: Usdc;
  protocolFee: Usdc;
  /** AI fee actually charged, after any 0G Compute Pass waivers (D12). */
  aiFee: Usdc;
  incidentStipend: Usdc;
  /** (2N + 1) × success bonus, locked by the funders. */
  juryPool: Usdc;
  /** What the funders must deposit in total: pool + protocol fee + AI fee charged. */
  target: Usdc;
  /**
   * What each named payer owes, in payer order: Solo [filer], Versus [side A, side B]
   * (0.70 each, less a side's own Pass waiver). Empty for crowdfunds.
   */
  payerShares: readonly Usdc[];
  /** Grand Jury sponsor slot (D9/D10), on top of the target. */
  sponsorDeposit: Usdc | null;
  deadlines: Deadlines;
}

export interface TermsOptions {
  /**
   * Which named payers bring their own 0G credits (D12), by payer index. Ignored
   * when the mode has no Pass (Grand Jury).
   */
  passWaivers?: readonly boolean[];
  /** Override the ballot labels (Grand Jury reviewed titles, D8). */
  ballot?: BallotLabels;
  sponsorDeposit?: Usdc | null;
  /** Demo builds may shorten deadlines; they must be labelled as demo settings (D14). */
  deadlines?: Partial<Deadlines>;
}

function payers(mode: ModeConfig): number {
  return mode.funding.kind === 'split' ? mode.funding.sides : mode.funding.kind === 'filer-pays' ? 1 : 0;
}

/** Freeze a mode's current constants into the terms of one new case. */
export function termsFor(mode: ModeConfig, options: TermsOptions = {}): CaseTerms {
  const e = mode.economics;
  const count = payers(mode);
  const waivedBy = Array.from({ length: count }, (_, i) => Boolean(e.passWaiver && options.passWaivers?.[i]));
  const waiver = e.passWaiver ?? ZERO_USDC;
  const waived = mulUsdc(waiver, waivedBy.filter(Boolean).length);
  const aiFee = subUsdc(e.aiFee, waived);
  const pool = mulUsdc(e.successBonusPerJuror, jurySize(mode));
  const fullShare = count > 0 ? micro(caseCharge(mode) / BigInt(count)) : ZERO_USDC;
  if (count > 0 && fullShare * BigInt(count) !== caseCharge(mode)) {
    throw new RangeError(`${mode.id}: case charge does not split evenly between ${count} payers`);
  }
  const payerShares = waivedBy.map((w) => (w ? subUsdc(fullShare, waiver) : fullShare));
  const sponsor =
    options.sponsorDeposit !== undefined
      ? options.sponsorDeposit
      : mode.funding.kind === 'crowdfund'
        ? mode.funding.sponsorDeposit
        : null;
  return {
    mode: mode.id,
    n: e.n,
    jurySize: jurySize(mode),
    threshold: verdictThreshold(mode),
    ballot: options.ballot ?? mode.ballot,
    funding: mode.funding,
    bondPerJuror: e.bondPerJuror,
    successBonusPerJuror: e.successBonusPerJuror,
    failedTrialBonusPerTimelyJuror: e.failedTrialBonusPerTimelyJuror,
    protocolFee: e.protocolFee,
    aiFee,
    incidentStipend: e.incidentStipend,
    juryPool: pool,
    target: subUsdc(caseCharge(mode), waived),
    payerShares,
    sponsorDeposit: sponsor,
    deadlines: { ...mode.deadlines, ...options.deadlines },
  };
}

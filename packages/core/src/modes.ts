import { addUsdc, mulUsdc, usdc, type Usdc } from './money';

/**
 * The three ways to go to court. Names follow docs/GAME-MODES.md; the economics
 * are the "Implementation constants" table in docs/DECISIONS.md.
 */
export type ModeId = 'solo' | 'versus' | 'grand-jury';

export const MODE_IDS: readonly ModeId[] = ['solo', 'versus', 'grand-jury'];

/** Who funds a case, which decides the intake flow the app has to show. */
export type FundingModel =
  | { kind: 'filer-pays' }
  | { kind: 'split'; sides: 2 }
  | { kind: 'crowdfund'; minContribution: Usdc; sponsorDeposit: Usdc | null };

export type BallotLabels = readonly [string, string];

/** Deadlines in seconds. Fixed at case creation and immutable for that case (DECISIONS rule 2). */
export interface Deadlines {
  /** Before the trial: Versus consent (24 h) or Grand Jury funding (48 h). Null for Solo. */
  preTrial: number | null;
  recruitment: number;
  commit: number;
  reveal: number;
}

export interface ModeEconomics {
  /** N: a jury of 2N+1. */
  n: number;
  bondPerJuror: Usdc;
  successBonusPerJuror: Usdc;
  failedTrialBonusPerTimelyJuror: Usdc;
  protocolFee: Usdc;
  /** Total AI fee for the case (Versus charges it per side, so this is both sides together). */
  aiFee: Usdc;
  /** 0G Compute Pass waiver per paying side, or null if the mode has no Pass (D12). */
  passWaiver: Usdc | null;
  incidentStipend: Usdc;
}

export interface ModeConfig {
  id: ModeId;
  /** Display name. */
  name: string;
  /** One-line pitch, shown on mode cards. */
  tagline: string;
  /** Who argues, in plain words. */
  cast: string;
  ballot: BallotLabels;
  funding: FundingModel;
  economics: ModeEconomics;
  deadlines: Deadlines;
}

const MIN = 60;
const HOUR = 60 * MIN;

const STANDARD_TRIAL = { recruitment: 30 * MIN, commit: 20 * MIN, reveal: 10 * MIN } as const;

export const MODES: Readonly<Record<ModeId, ModeConfig>> = {
  solo: {
    id: 'solo',
    name: 'Solo Court',
    tagline: 'Confess a crime against common sense. Your lawyer is an AI. So is the prosecutor.',
    cast: 'You + Counsel Chaos vs Miss Ratio (NPC)',
    ballot: ['GUILTY', 'NOT COOKED'],
    funding: { kind: 'filer-pays' },
    economics: {
      n: 1,
      bondPerJuror: usdc('0.40'),
      successBonusPerJuror: usdc('0.30'),
      failedTrialBonusPerTimelyJuror: usdc('0.20'),
      protocolFee: usdc('0.10'),
      aiFee: usdc('0.20'),
      passWaiver: usdc('0.20'),
      incidentStipend: usdc('0.20'),
    },
    deadlines: { preTrial: null, ...STANDARD_TRIAL },
  },
  versus: {
    id: 'versus',
    name: 'Versus Court',
    tagline: 'Two people, one argument, two AI lawyers. A real jury picks the better case.',
    cast: 'Side A + their AI vs Side B + their AI',
    ballot: ['SIDE A', 'SIDE B'],
    funding: { kind: 'split', sides: 2 },
    economics: {
      n: 1,
      bondPerJuror: usdc('0.40'),
      successBonusPerJuror: usdc('0.30'),
      failedTrialBonusPerTimelyJuror: usdc('0.20'),
      protocolFee: usdc('0.10'),
      aiFee: usdc('0.40'),
      passWaiver: usdc('0.20'),
      incidentStipend: usdc('0.20'),
    },
    deadlines: { preTrial: 24 * HOUR, ...STANDARD_TRIAL },
  },
  'grand-jury': {
    id: 'grand-jury',
    name: 'Grand Jury',
    tagline: 'One famous question. Anyone can chip in, spectate and call it. Seven sworn jurors decide.',
    cast: 'Miss Ratio vs Counsel Chaos, argued in public',
    // Grand Jury ballots carry reviewed titles per case (D8); these are the defaults.
    ballot: ['FOR', 'AGAINST'],
    funding: { kind: 'crowdfund', minContribution: usdc('0.10'), sponsorDeposit: null },
    economics: {
      n: 3,
      bondPerJuror: usdc('1.20'),
      successBonusPerJuror: usdc('0.90'),
      failedTrialBonusPerTimelyJuror: usdc('0.20'),
      protocolFee: usdc('0.50'),
      aiFee: usdc('0.50'),
      passWaiver: null,
      incidentStipend: usdc('0.20'),
    },
    deadlines: { preTrial: 48 * HOUR, ...STANDARD_TRIAL },
  },
};

/**
 * Grand Jury launch pricing ("Sponsored Docket", D10). MODES['grand-jury'] holds the
 * hackathon profile (7.30, capped budget) because the app ships on testnet first.
 */
export const GRAND_JURY_LAUNCH: ModeConfig = {
  ...MODES['grand-jury'],
  funding: { kind: 'crowdfund', minContribution: usdc('0.10'), sponsorDeposit: usdc('2.00') },
  economics: { ...MODES['grand-jury'].economics, protocolFee: usdc('1.00') },
};

/** 2N + 1 appointed jurors. */
export function jurySize(mode: ModeConfig): number {
  return 2 * mode.economics.n + 1;
}

/** N + 1 matching revealed votes of the appointed jury (D8). */
export function verdictThreshold(mode: ModeConfig): number {
  return mode.economics.n + 1;
}

/** (2N + 1) × success bonus. */
export function juryPool(mode: ModeConfig): Usdc {
  return mulUsdc(mode.economics.successBonusPerJuror, jurySize(mode));
}

/** Everything the case's funders pay in total, before any Pass waiver. */
export function caseCharge(mode: ModeConfig): Usdc {
  return addUsdc(juryPool(mode), mode.economics.protocolFee, mode.economics.aiFee);
}

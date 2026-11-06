/**
 * D10 — Grand Jury pricing, exactly as decided in docs/DECISIONS.md.
 *
 * Two phases, both decided now:
 * - `hackathon` (what the testnet app runs): fees 0.50 + 0.50, target 7.30, at
 *   most 40 editorially chosen published cases (A27) inside a capped marketing
 *   budget (modelled loss 46.06 test USDC = 40 × 1.1515). The sponsor slot is
 *   built and shown with a test sponsor, but the budget assumes none.
 * - `launch` ("Sponsored Docket"): protocol fee 1.00, AI fee 0.50, target 7.80,
 *   a sponsor commitment of at least 2.00 per funded case made before the case
 *   is published, review cost ≤ 1.50, and contribution > 0 at 100 % attendance.
 *
 * Fees are fixed per case (DECISIONS rule 2): a case freezes its profile's
 * terms when it is published and keeps them whatever the schedule does later.
 */
import {
  GRAND_JURY_LAUNCH,
  MODES,
  ZERO_USDC,
  addUsdc,
  formatUsdc,
  jurySize,
  juryPool,
  micro,
  subUsdc,
  usdc,
  verdictThreshold,
  type CaseTerms,
  type ModeConfig,
  type Usdc,
} from '@cringe-court/core';

export type PricingPhase = 'hackathon' | 'launch';

export interface PricingProfile {
  phase: PricingPhase;
  /** Shown to people: "Hackathon docket" / "Sponsored Docket". */
  name: string;
  config: ModeConfig;
  protocolFee: Usdc;
  aiFee: Usdc;
  /** (2N + 1) × success bonus: 7 × 0.90 = 6.30. */
  juryPool: Usdc;
  /** What the crowd raises: pool + protocol fee + AI fee. */
  target: Usdc;
  minContribution: Usdc;
  /** Minimum sponsor deposit that counts as a sponsored case, or null if a sponsor is optional. */
  sponsorFloor: Usdc | null;
  /** Whether a case needs a sponsor commitment to be published outside the marketing cap. */
  sponsorRequired: boolean;
  /** Published cases allowed without a sponsor (A27), or null for "no cap applies". */
  marketingCap: number | null;
  /** Modelled loss for the whole capped budget (40 × 1.1515), hackathon only. */
  marketingBudget: Usdc | null;
  /** Human sourcing/legal review cost per published case (A23 / D10 target). */
  reviewCost: Usdc;
  /** Contribution per published case from the D10 results table (e = 0), as a signed decimal string. */
  modelledContribution: string;
  /** Contribution at 100 % attendance (no forfeit revenue), e = 1. */
  contributionFullAttendance: string;
  /** Typical ticket used to size the crowd ("about 15.6 contributors at 0.50"). */
  typicalTicket: Usdc;
  fundingWindowHours: number;
  jurors: number;
  threshold: number;
  bond: Usdc;
  successBonus: Usdc;
  failedTrialBonus: Usdc;
}

function profile(phase: PricingPhase, config: ModeConfig, extra: Pick<PricingProfile, 'name' | 'sponsorRequired' | 'marketingCap' | 'marketingBudget' | 'reviewCost' | 'modelledContribution' | 'contributionFullAttendance' | 'sponsorFloor'>): PricingProfile {
  const e = config.economics;
  if (config.funding.kind !== 'crowdfund') throw new Error('Grand Jury is crowdfunded');
  const pool = juryPool(config);
  return {
    phase,
    config,
    protocolFee: e.protocolFee,
    aiFee: e.aiFee,
    juryPool: pool,
    target: addUsdc(pool, e.protocolFee, e.aiFee),
    minContribution: config.funding.minContribution,
    typicalTicket: usdc('0.50'),
    fundingWindowHours: (config.deadlines.preTrial ?? 0) / 3600,
    jurors: jurySize(config),
    threshold: verdictThreshold(config),
    bond: e.bondPerJuror,
    successBonus: e.successBonusPerJuror,
    failedTrialBonus: e.failedTrialBonusPerTimelyJuror,
    ...extra,
  };
}

/** The two D10 phases. Numbers are DECISIONS.md D10 verbatim; tests pin them. */
export const PRICING: Readonly<Record<PricingPhase, PricingProfile>> = {
  hackathon: profile('hackathon', MODES['grand-jury'], {
    name: 'Hackathon docket',
    // The slot exists and is shown; a sponsor is welcome but never required.
    sponsorFloor: usdc('2.00'),
    sponsorRequired: false,
    marketingCap: 40,
    marketingBudget: usdc('46.06'),
    reviewCost: usdc('2.00'),
    modelledContribution: '-1.1515',
    contributionFullAttendance: '-1.6358',
  }),
  launch: profile('launch', GRAND_JURY_LAUNCH, {
    name: 'Sponsored Docket',
    sponsorFloor: usdc('2.00'),
    sponsorRequired: true,
    // Launch publishes a case only with a sponsor, or inside an explicit marketing cap.
    marketingCap: null,
    marketingBudget: null,
    reviewCost: usdc('1.50'),
    modelledContribution: '+0.7105',
    contributionFullAttendance: '+0.1597',
  }),
};

/** The testnet app ships the hackathon profile (D10 phase 1, D14). */
export const CURRENT_PRICING: PricingProfile = PRICING.hackathon;

/** Line items for "where your contribution goes". Sums to the target. */
export interface TargetBreakdown {
  juryPool: Usdc;
  protocolFee: Usdc;
  aiFee: Usdc;
  target: Usdc;
  jurors: number;
  rewardPerJuror: Usdc;
}

export function targetBreakdown(terms: CaseTerms): TargetBreakdown {
  return {
    juryPool: terms.juryPool,
    protocolFee: terms.protocolFee,
    aiFee: terms.aiFee,
    target: terms.target,
    jurors: terms.jurySize,
    rewardPerJuror: terms.successBonusPerJuror,
  };
}

/** About how many people it takes at a typical ticket ("about 15.6 at 0.50"). */
export function crowdSize(target: Usdc, ticket: Usdc = usdc('0.50')): number {
  return Math.round((Number(target) / Number(ticket)) * 10) / 10;
}

export type PublicationDecision =
  | { ok: true; basis: 'sponsored' | 'marketing-cap'; marketingLeft: number | null }
  | { ok: false; reason: 'sponsor-below-floor' | 'sponsor-required' | 'marketing-cap-reached'; message: string };

/**
 * D10 publication rule, as the publishing tool enforces it: a case is published
 * with a sponsor commitment ≥ the floor, or inside the explicit marketing cap.
 * A sponsor below the floor is rejected outright (it would look sponsored but
 * not cover the review cost).
 */
export function canPublish(p: PricingProfile, input: { sponsorDeposit: Usdc | null; marketingUsed: number }): PublicationDecision {
  const sponsor = input.sponsorDeposit ?? ZERO_USDC;
  if (sponsor > 0n && p.sponsorFloor !== null && sponsor < p.sponsorFloor) {
    return { ok: false, reason: 'sponsor-below-floor', message: `A sponsor commits at least ${formatUsdc(p.sponsorFloor)} per case.` };
  }
  if (sponsor > 0n) return { ok: true, basis: 'sponsored', marketingLeft: p.marketingCap === null ? null : p.marketingCap - input.marketingUsed };
  if (p.marketingCap === null) {
    return { ok: false, reason: 'sponsor-required', message: 'Sponsored Docket: a public case needs a sponsor commitment before it is published.' };
  }
  if (input.marketingUsed >= p.marketingCap) {
    return { ok: false, reason: 'marketing-cap-reached', message: `The marketing budget covers ${p.marketingCap} unsponsored cases and they are all published.` };
  }
  return { ok: true, basis: 'marketing-cap', marketingLeft: p.marketingCap - input.marketingUsed - 1 };
}

/** Remaining modelled marketing budget after `used` unsponsored cases (hackathon dashboard). */
export function marketingBudgetLeft(p: PricingProfile, used: number): Usdc | null {
  if (p.marketingBudget === null || p.marketingCap === null) return null;
  const perCase = micro(p.marketingBudget / BigInt(p.marketingCap));
  const spent = micro(perCase * BigInt(Math.min(used, p.marketingCap)));
  return spent >= p.marketingBudget ? ZERO_USDC : subUsdc(p.marketingBudget, spent);
}

/** Copy the case page shows about money (D9/D10 "UI" consequence): no odds, no payouts for funders. */
export const FUNDING_PROMISES = {
  summoner: 'Summoners get a cosmetic credit on the case page. It is the same whatever the verdict.',
  refund:
    'Full refund, pro rata, if the target is not reached in time, the jury does not fill, the AI cannot prepare a fair case, the court cancels for safety, or the trial ends with NO VERDICT.',
  sponsor: 'The sponsor has no say over case selection, content or the verdict. They get “Presented by” and nothing else.',
  noOdds: 'This is a ticket to a show, not a bet. Nothing a contributor gets depends on the outcome.',
} as const;

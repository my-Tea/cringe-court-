/**
 * Versus revenue and refunds (DECISIONS D4, D6, D12, D13 and "Per-mode revenue
 * model → Mode 2"). Every figure is computed from a case's own frozen terms and
 * core `settle()`, the same maths the memory chain and the Arc contract use, so
 * the preview a side sees before paying is exactly what settlement pays out.
 *
 *   Each side pays 0.70 = 0.45 jury-pool share + 0.05 protocol share + 0.20 for its own agent.
 *   On a verdict the court keeps 0.10 protocol + 0.40 AI (both agents). Jurors split the 0.90 pool.
 *   On NO VERDICT, a missed deadline or a cancellation, each side gets its own 0.70 back.
 *   If Side B never consents, nobody is charged and the platform absorbs Side A's intake (D6).
 */
import {
  ZERO_USDC,
  addUsdc,
  micro,
  settle,
  statementFor,
  subUsdc,
  usdc,
  type CaseTerms,
  type Hex,
  type JurorRecord,
  type Settlement,
  type SideId,
  type Usdc,
} from '@cringe-court/core';

/** D6: inference the platform absorbs when Side B never consents (6,000 in / 1,200 out tokens × 1.5). */
export const ABANDONED_INTAKE_COST: Usdc = usdc('0.0072');

/** D12: the 0G Compute Pass is off until V4 §17 gate 2 (secure delegated credit use) passes. */
export const COMPUTE_PASS_ENABLED = false;

export interface ChargePart {
  label: string;
  amount: Usdc;
}

export interface SideCharge {
  side: SideId;
  total: Usdc;
  parts: readonly ChargePart[];
  passWaived: boolean;
}

/** What each side pays, and what for. */
export function sideCharges(terms: CaseTerms): readonly [SideCharge, SideCharge] {
  const sides = 2;
  const pool = micro(terms.juryPool / BigInt(sides));
  const protocol = micro(terms.protocolFee / BigInt(sides));
  const charge = (side: SideId, i: number): SideCharge => {
    const total = terms.payerShares[i] ?? ZERO_USDC;
    const ai = subUsdc(total, addUsdc(pool, protocol));
    return {
      side,
      total,
      passWaived: ai === ZERO_USDC,
      parts: [
        { label: 'Half the jury pool (paid to jurors who finish)', amount: pool },
        { label: 'Half the protocol fee', amount: protocol },
        { label: ai === ZERO_USDC ? 'Your agent (paid with your own 0G Pass)' : 'Your own AI agent (0G Compute)', amount: ai },
      ],
    };
  };
  return [charge('a', 0), charge('b', 1)];
}

export type VersusOutcome =
  | 'verdict'
  | 'verdict-with-no-show'
  | 'no-verdict'
  | 'consent-missed'
  | 'withdrawn'
  | 'funding-missed'
  | 'jury-unfilled';

export const OUTCOME_LABELS: Readonly<Record<VersusOutcome, string>> = {
  verdict: 'A verdict (all three jurors finish)',
  'verdict-with-no-show': 'A verdict, one juror misses a deadline',
  'no-verdict': 'NO VERDICT (fewer than 2 matching votes)',
  'consent-missed': 'Side B never answers the invite',
  withdrawn: 'Either side withdraws before paying',
  'funding-missed': 'One side pays, the other does not by the deadline',
  'jury-unfilled': 'Not enough jurors take a seat in time',
};

export interface OutcomePreview {
  outcome: VersusOutcome;
  /** Net cost to each side (paid − refunded). */
  sideCost: readonly [Usdc, Usdc];
  /** Back to each side. */
  sideRefund: readonly [Usdc, Usdc];
  /** Platform revenue: fees + forfeits + unearned allocation. */
  courtKeeps: Usdc;
  /** Paid to jurors on top of their bonds. */
  jurorRewards: Usdc;
  /** Platform-absorbed cost that is not in the settlement (D6 intake). */
  platformAbsorbs: Usdc;
  settlement: Settlement | null;
}

const SIDE_A = '0x00000000000000000000000000000000000000aa' as Hex;
const SIDE_B = '0x00000000000000000000000000000000000000bb' as Hex;
const juror = (i: number) => `0x00000000000000000000000000000000000000c${i}` as Hex;

/**
 * What each outcome costs and pays, computed by running the real settlement on
 * the case's terms. Used by the "Follow the money" panel before anyone pays.
 */
export function previewOutcome(terms: CaseTerms, outcome: VersusOutcome): OutcomePreview {
  const shares = [terms.payerShares[0] ?? ZERO_USDC, terms.payerShares[1] ?? ZERO_USDC] as const;
  const both = [
    { account: SIDE_A, kind: 'side' as const, amount: shares[0] },
    { account: SIDE_B, kind: 'side' as const, amount: shares[1] },
  ];
  const jurors = (pattern: readonly ('a' | 'b' | 'absent')[]): JurorRecord[] =>
    pattern.map((p, i) => (p === 'absent' ? { account: juror(i), committed: true, revealed: false } : { account: juror(i), committed: true, revealed: true, choice: p === 'a' ? 0 : 1 }));
  const full = (p: readonly ('a' | 'b' | 'absent')[]) => [...p, ...Array(Math.max(0, terms.jurySize - p.length)).fill('a')].slice(0, terms.jurySize) as ('a' | 'b' | 'absent')[];

  let settlement: Settlement | null = null;
  let funders = both;
  let platformAbsorbs = ZERO_USDC;
  switch (outcome) {
    case 'verdict':
      settlement = settle({ terms, funders, jurors: jurors(full(['a', 'a', 'b'])), outcome: 'trial' });
      break;
    case 'verdict-with-no-show':
      settlement = settle({ terms, funders, jurors: jurors(full(['a', 'a', 'absent'])), outcome: 'trial' });
      break;
    case 'no-verdict':
      settlement = settle({ terms, funders, jurors: jurors(full(['a', 'b', 'absent'])), outcome: 'trial' });
      break;
    case 'funding-missed':
      funders = [both[0]!];
      settlement = settle({ terms, funders, jurors: [], outcome: 'cancelled' });
      break;
    case 'jury-unfilled':
      settlement = settle({ terms, funders, jurors: jurors(['a']), outcome: 'cancelled' });
      break;
    case 'consent-missed':
      platformAbsorbs = ABANDONED_INTAKE_COST;
      break;
    case 'withdrawn':
      break;
  }
  if (!settlement) {
    return { outcome, sideCost: [ZERO_USDC, ZERO_USDC], sideRefund: [ZERO_USDC, ZERO_USDC], courtKeeps: ZERO_USDC, jurorRewards: ZERO_USDC, platformAbsorbs, settlement };
  }
  const s = settlement;
  const paid = (account: Hex) => addUsdc(ZERO_USDC, ...funders.filter((f) => f.account === account).map((f) => f.amount));
  const back = (account: Hex) => statementFor(s, account).payout;
  const cost = (account: Hex) => subUsdc(paid(account), back(account));
  const rewards = s.statements
    .filter((st) => st.party !== 'protocol' && st.party !== 'platform' && st.party !== SIDE_A && st.party !== SIDE_B)
    .flatMap((st) => st.lines)
    .filter((l) => l.kind === 'reward' || l.kind === 'stipend')
    .reduce((sum, l) => addUsdc(sum, l.amount), ZERO_USDC);
  return {
    outcome,
    sideCost: [cost(SIDE_A), cost(SIDE_B)],
    sideRefund: [back(SIDE_A), back(SIDE_B)],
    courtKeeps: s.protocol.total,
    jurorRewards: rewards,
    platformAbsorbs,
    settlement: s,
  };
}

export const PREVIEW_OUTCOMES: readonly VersusOutcome[] = ['verdict', 'verdict-with-no-show', 'no-verdict', 'funding-missed', 'jury-unfilled', 'consent-missed', 'withdrawn'];

/** D13 per-case disclosure: what the court kept from a settled case, and why. */
export interface CourtDisclosure {
  fees: Usdc;
  forfeits: Usdc;
  unearnedBonus: Usdc;
  total: Usdc;
  attendance: { completed: number; appointed: number };
}

export function disclose(settlement: Settlement, appointed: number): CourtDisclosure {
  const completed = settlement.verdict?.completedDuty ?? 0;
  return {
    fees: settlement.protocol.fees,
    forfeits: settlement.protocol.forfeits,
    unearnedBonus: settlement.protocol.unearnedBonus,
    total: settlement.protocol.total,
    attendance: { completed, appointed },
  };
}

/** Juror view: bond at stake and the most they can earn (V4 §9). */
export function jurorStake(terms: CaseTerms): { bond: Usdc; reward: Usdc; bestCase: Usdc; failedTrialBonus: Usdc } {
  return {
    bond: terms.bondPerJuror,
    reward: terms.successBonusPerJuror,
    bestCase: addUsdc(terms.bondPerJuror, terms.successBonusPerJuror),
    failedTrialBonus: terms.failedTrialBonusPerTimelyJuror,
  };
}

/** Total both sides pay. */
export function caseTotal(terms: CaseTerms): Usdc {
  return addUsdc(ZERO_USDC, ...terms.payerShares);
}

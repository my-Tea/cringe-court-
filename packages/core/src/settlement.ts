/**
 * Settlement maths (V4 §9, generalised to a jury of 2N + 1 with N + 1 to win,
 * D8). Pure and exact: the in-memory chain twin pays out with it, the app
 * previews with it, and the Arc contract must agree with it line for line.
 *
 * Invariant (tested): everything paid in (funding, sponsor, bonds, platform
 * stipends) equals everything paid out (refunds, bonds back, bonuses, protocol).
 */
import type { Hex, ReceiptLine, Verdict } from './case';
import { ZERO_USDC, addUsdc, formatUsdc, micro, mulUsdc, subUsdc, type Usdc } from './money';
import type { CaseTerms } from './terms';

export type BallotChoice = 0 | 1;

export type FunderKind = 'filer' | 'side' | 'contributor' | 'sponsor';

export interface FunderDeposit {
  account: Hex;
  kind: FunderKind;
  amount: Usdc;
}

export interface JurorRecord {
  account: Hex;
  /** Committed a ballot before the commit deadline. */
  committed: boolean;
  /** Revealed a choice matching the commitment before the reveal deadline. */
  revealed: boolean;
  /** Only meaningful when revealed. */
  choice?: BallotChoice;
}

/**
 * How the case ended.
 * - `trial`: the jury was seated and the reveal deadline passed (verdict or NO VERDICT).
 * - `cancelled`: cancelled before voting (consent/funding missed, jury unfilled, AI unfair/failed). Full refunds.
 * - `protective`: platform-caused inability to vote (V4 §8). Full refunds, bonds back, stipends from platform funds.
 */
export type SettlementOutcome = 'trial' | 'cancelled' | 'protective';

export interface SettlementInput {
  terms: CaseTerms;
  funders: readonly FunderDeposit[];
  /** Seated jurors (bond paid). Empty if the jury never filled. */
  jurors: readonly JurorRecord[];
  outcome: SettlementOutcome;
  /** Protective cancellations only: had the reveal window opened? Decides who "completed" so far. */
  revealOpened?: boolean;
}

export interface PartyStatement {
  party: Hex | 'protocol' | 'platform';
  lines: readonly ReceiptLine[];
  /** Net amount this party receives back from the case (never negative). */
  payout: Usdc;
}

export interface Settlement {
  verdict: Verdict | null;
  statements: readonly PartyStatement[];
  protocol: {
    fees: Usdc;
    forfeits: Usdc;
    unearnedBonus: Usdc;
    sponsor: Usdc;
    total: Usdc;
  };
  /** Paid from platform-owned funds (protective stipends). */
  platformCost: Usdc;
  totalIn: Usdc;
  totalOut: Usdc;
}

/** Count revealed votes and apply the N + 1 rule. */
export function tallyVerdict(terms: CaseTerms, jurors: readonly JurorRecord[]): Verdict {
  const tally: [number, number] = [0, 0];
  let completed = 0;
  for (const j of jurors) {
    if (!isComplete(j)) continue;
    completed++;
    tally[j.choice!]++;
  }
  const winner: BallotChoice | null = tally[0] >= terms.threshold ? 0 : tally[1] >= terms.threshold ? 1 : null;
  return {
    kind: winner === null ? 'no-verdict' : winner === 0 ? 'ballot-0' : 'ballot-1',
    label: winner === null ? 'NO VERDICT' : terms.ballot[winner],
    tally,
    completedDuty: completed,
    appointed: terms.jurySize,
  };
}

function isComplete(j: JurorRecord): boolean {
  return j.committed && j.revealed && (j.choice === 0 || j.choice === 1);
}

const line = (kind: ReceiptLine['kind'], label: string, amount: Usdc): ReceiptLine => ({ kind, label, amount });

export function settle(input: SettlementInput): Settlement {
  const { terms, funders, jurors, outcome } = input;
  if (jurors.length > terms.jurySize) throw new RangeError(`More jurors (${jurors.length}) than seats (${terms.jurySize})`);
  const statements = new Map<string, { party: PartyStatement['party']; lines: ReceiptLine[] }>();
  const add = (party: PartyStatement['party'], l: ReceiptLine) => {
    const key = party;
    if (!statements.has(key)) statements.set(key, { party, lines: [] });
    statements.get(key)!.lines.push(l);
  };

  const sponsorIn = addUsdc(...funders.filter((f) => f.kind === 'sponsor').map((f) => f.amount));
  const fundingIn = addUsdc(...funders.filter((f) => f.kind !== 'sponsor').map((f) => f.amount));
  const bondsIn = mulUsdc(terms.bondPerJuror, jurors.length);

  let fees = ZERO_USDC;
  let forfeits = ZERO_USDC;
  let unearned = ZERO_USDC;
  let sponsor = ZERO_USDC;
  let platformCost = ZERO_USDC;
  let verdict: Verdict | null = null;

  const refundFunders = (includeSponsor: boolean) => {
    for (const f of funders) {
      if (f.kind === 'sponsor' && !includeSponsor) continue;
      add(f.account, line('refund', f.kind === 'sponsor' ? 'Sponsor deposit refunded' : 'Case payment refunded in full', f.amount));
    }
  };

  if (outcome === 'cancelled' || outcome === 'protective') {
    refundFunders(true);
    for (const j of jurors) add(j.account, line('bond-returned', 'Your bond, returned', terms.bondPerJuror));
    if (outcome === 'protective') {
      for (const j of jurors) {
        const done = j.committed && (input.revealOpened ? j.revealed : true);
        if (!done) continue;
        add(j.account, line('stipend', 'Incident stipend (paid by CringeCourt)', terms.incidentStipend));
        platformCost = addUsdc(platformCost, terms.incidentStipend);
      }
    }
  } else {
    if (jurors.length !== terms.jurySize) throw new RangeError('A trial settles only with a full jury');
    verdict = tallyVerdict(terms, jurors);
    const complete = jurors.filter(isComplete);
    const absent = jurors.filter((j) => !isComplete(j));
    forfeits = mulUsdc(terms.bondPerJuror, absent.length);
    for (const j of absent) add(j.account, line('forfeit', 'Bond forfeited: duty not completed in time', terms.bondPerJuror));
    sponsor = sponsorIn;

    if (verdict.kind !== 'no-verdict') {
      if (fundingIn !== terms.target) throw new RangeError(`Funding ${fundingIn} does not match the target ${terms.target}`);
      fees = addUsdc(terms.protocolFee, terms.aiFee);
      for (const j of complete) {
        add(j.account, line('bond-returned', `Your bond, returned (the ${formatUsdc(terms.bondPerJuror, { unit: false })} was yours)`, terms.bondPerJuror));
        add(j.account, line('reward', 'Jury duty reward', terms.successBonusPerJuror));
      }
      unearned = subUsdc(terms.juryPool, mulUsdc(terms.successBonusPerJuror, complete.length));
    } else {
      refundFunders(false);
      // Timely jurors' failed-trial bonus comes from forfeited bonds (V4 §9), split
      // evenly if forfeits ever fall short (they cannot for 2N+1 / N+1 terms).
      const want = mulUsdc(terms.failedTrialBonusPerTimelyJuror, complete.length);
      const each =
        want <= forfeits ? terms.failedTrialBonusPerTimelyJuror : complete.length ? micro(forfeits / BigInt(complete.length)) : ZERO_USDC;
      for (const j of complete) {
        add(j.account, line('bond-returned', 'Your bond, returned', terms.bondPerJuror));
        if (each > 0n) add(j.account, line('reward', 'Failed-trial bonus (from forfeited bonds)', each));
      }
      forfeits = subUsdc(forfeits, mulUsdc(each, complete.length));
    }
  }

  const protocolTotal = addUsdc(fees, forfeits, unearned, sponsor);
  if (fees > 0n) add('protocol', line('fee', 'Protocol + AI fees', fees));
  if (forfeits > 0n) add('protocol', line('forfeit', 'Forfeited bonds kept (disclosed, D13)', forfeits));
  if (unearned > 0n) add('protocol', line('fee', 'Unearned jury reward allocation', unearned));
  if (sponsor > 0n) add('protocol', line('fee', 'Sponsor fee (trial ran)', sponsor));
  if (platformCost > 0n) add('platform', line('stipend', 'Incident stipends funded', platformCost));

  const out: PartyStatement[] = [...statements.values()].map(({ party, lines }) => ({
    party,
    lines,
    payout:
      party === 'platform'
        ? ZERO_USDC
        : addUsdc(...lines.filter((l) => l.kind !== 'forfeit' || party === 'protocol').map((l) => l.amount)),
  }));

  const totalIn = addUsdc(fundingIn, sponsorIn, bondsIn, platformCost);
  const totalOut = addUsdc(...out.filter((s) => s.party !== 'platform').map((s) => s.payout));
  if (totalIn !== totalOut) throw new Error(`Settlement does not balance: in ${totalIn}, out ${totalOut}`);

  return {
    verdict,
    statements: out,
    protocol: { fees, forfeits, unearnedBonus: unearned, sponsor, total: protocolTotal },
    platformCost,
    totalIn,
    totalOut,
  };
}

/** One party's statement, or an empty one. */
export function statementFor(settlement: Settlement, party: Hex | 'protocol' | 'platform'): PartyStatement {
  return settlement.statements.find((s) => s.party === party) ?? { party, lines: [], payout: ZERO_USDC };
}

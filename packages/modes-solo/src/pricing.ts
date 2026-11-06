/**
 * What Solo costs and where the money goes (DECISIONS "Per-mode revenue model",
 * Mode 1). Every figure is derived from the case's frozen terms and core
 * `settle()`, so the price screen, the verdict receipt and the ledger cannot
 * disagree.
 *
 *   The filer pays 1.20 = 0.90 jury pool + 0.10 protocol + 0.20 AI
 *   (1.00 with the 0G Compute Pass, which stays off until V4 §17 gate 2, D12).
 *   The court keeps protocol + AI fees only on a verdict. NO VERDICT, an unfilled
 *   jury, AI failure or a protective cancel refund the full payment.
 */
import {
  MODES,
  addUsdc,
  subUsdc,
  settle,
  statementFor,
  type CaseTerms,
  type Hex,
  type JurorRecord,
  type ReceiptLine,
  type Settlement,
  type Usdc,
} from '@cringe-court/core';

export interface QuoteLine {
  id: 'jury-pool' | 'protocol-fee' | 'ai-fee';
  label: string;
  detail: string;
  amount: Usdc;
}

export interface SoloQuote {
  lines: readonly QuoteLine[];
  /** What the filer pays (their payer share). */
  total: Usdc;
  /** Pass waiver applied to the AI fee, if any (D12). */
  passWaiver: Usdc;
}

/** The price breakdown shown before paying. */
export function soloQuote(terms: CaseTerms): SoloQuote {
  if (terms.mode !== 'solo') throw new RangeError(`Not Solo terms: ${terms.mode}`);
  const total = terms.payerShares[0] ?? terms.target;
  const lines: QuoteLine[] = [
    {
      id: 'jury-pool',
      label: 'Jury pool',
      detail: `${terms.jurySize} jurors × reward, paid only to jurors who vote and reveal on time`,
      amount: terms.juryPool,
    },
    { id: 'protocol-fee', label: 'Court fee', detail: 'Kept only if the jury reaches a verdict', amount: terms.protocolFee },
    { id: 'ai-fee', label: 'AI counsel', detail: 'Both lawyers, same model, same budget (D1)', amount: terms.aiFee },
  ];
  const sum = addUsdc(...lines.map((l) => l.amount));
  if (sum !== total) throw new Error(`Quote lines ${sum} do not add up to the payer share ${total}`);
  return { lines, total, passWaiver: subUsdc(MODES.solo.economics.aiFee, terms.aiFee) };
}

export type SoloOutcome = 'verdict' | 'no-verdict' | 'cancelled';

export interface OutcomePreview {
  outcome: SoloOutcome;
  title: string;
  /** What the filer gets back. */
  filerRefund: Usdc;
  /** What the court keeps (fees; never forfeits in this preview, D13 rule 1). */
  courtKeeps: Usdc;
  /** What the jury earns in rewards (on top of their own bonds coming back). */
  juryEarns: Usdc;
}

const PREVIEW_FILER = '0x00000000000000000000000000000000000f11e5' as Hex;
const previewJuror = (i: number) => `0x00000000000000000000000000000000000ee${String(i).padStart(3, '0')}` as Hex;

/**
 * "What happens to your payment" for each way the case can end, computed with
 * the real settlement maths at 100 % attendance (DECISIONS rule 1: pricing never
 * needs no-shows).
 */
export function outcomePreviews(terms: CaseTerms): readonly OutcomePreview[] {
  const funders = [{ account: PREVIEW_FILER, kind: 'filer' as const, amount: terms.payerShares[0] ?? terms.target }];
  const jurors = (choices: readonly (0 | 1)[]): JurorRecord[] =>
    choices.map((choice, i) => ({ account: previewJuror(i), committed: true, revealed: true, choice }));
  // A verdict needs N + 1 matching votes; a split needs a tie, which only exists if someone abstains.
  const verdictVotes = Array.from({ length: terms.jurySize }, (_, i) => (i < terms.threshold ? 0 : 1)) as (0 | 1)[];
  const verdict = settle({ terms, funders, jurors: jurors(verdictVotes), outcome: 'trial' });
  const noVerdict = settle({
    terms,
    funders,
    // One juror fails to reveal and the rest split: below threshold on both sides.
    jurors: jurors(verdictVotes).map((j, i) =>
      i === 0 ? { account: j.account, committed: true, revealed: false } : { ...j, choice: (i % 2) as 0 | 1 },
    ),
    outcome: 'trial',
  });
  const cancelled = settle({ terms, funders, jurors: [], outcome: 'cancelled' });
  const view = (outcome: SoloOutcome, title: string, s: Settlement): OutcomePreview => ({
    outcome,
    title,
    filerRefund: statementFor(s, PREVIEW_FILER).payout,
    courtKeeps: s.protocol.fees,
    juryEarns: addUsdc(
      ...s.statements.filter((st) => st.party !== PREVIEW_FILER && st.party !== 'protocol' && st.party !== 'platform').flatMap((st) => st.lines.filter((l) => l.kind === 'reward').map((l) => l.amount)),
    ),
  });
  return [
    view('verdict', `${terms.ballot[0]} or ${terms.ballot[1]}`, verdict),
    view('no-verdict', 'NO VERDICT', noVerdict),
    view('cancelled', 'Jury never filled, or the AI failed', cancelled),
  ];
}

export interface RevenueDisclosure {
  /** Protocol + AI fees kept. */
  fees: Usdc;
  /** Bonds forfeited by jurors who did not finish (D13, disclosed per case). */
  forfeits: Usdc;
  unearnedBonus: Usdc;
  total: Usdc;
  /** Jurors who committed and revealed in time / seats. */
  attendance: { completed: number; seats: number };
}

/** D13 per-case disclosure: what the court kept, and why. */
export function revenueDisclosure(settlement: Settlement, terms: CaseTerms): RevenueDisclosure {
  return {
    fees: settlement.protocol.fees,
    forfeits: settlement.protocol.forfeits,
    unearnedBonus: settlement.protocol.unearnedBonus,
    total: settlement.protocol.total,
    attendance: { completed: settlement.verdict?.completedDuty ?? 0, seats: terms.jurySize },
  };
}

/** The filer's own receipt lines from a settlement (empty if they get nothing back). */
export function filerReceipt(settlement: Settlement, filer: Hex): readonly ReceiptLine[] {
  return statementFor(settlement, filer.toLowerCase() as Hex).lines;
}

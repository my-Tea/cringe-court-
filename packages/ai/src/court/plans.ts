/**
 * Mode plans: the beat sheet for each mode. A plan is a fixed list of slots;
 * the model fills the `model` slots and the harness fills the `template` slots
 * (procedure and vote invitations, so they can never leak a verdict).
 *
 * `answers` links a reply slot to the slot it must rebut; the validator checks
 * the reply actually engages that line (docs/ai/06 "rebuttal quality").
 */
import type { Segment } from '@cringe-court/core';
import type { CourtMode, CourtSpeaker, PreparedCase } from './schema';

/** Who holds a slot. `benchA` / `benchB` resolve to an advocate in Versus/Viral. */
export type SlotRole = 'clerk' | 'judge' | 'prosecutor' | 'defense' | 'benchA' | 'benchB';

export interface SlotPlan {
  id: string;
  role: SlotRole;
  segment: Segment;
  /** What the line must do, in the words the model receives. */
  purpose: string;
  /** Slot this line must answer (rebuttals, challenges). */
  answers?: string;
  /** Character budget for the line. */
  minChars: number;
  maxChars: number;
  /** Harness-written line. */
  template?: (c: PreparedCase) => string;
}

export interface ModePlan {
  mode: CourtMode;
  version: string;
  slots: readonly SlotPlan[];
  /** Read-aloud target for the whole trial, seconds (configurable, see TrialOptions). */
  targetSeconds: readonly [number, number];
}

const COUNSEL = { minChars: 70, maxChars: 300 } as const;
const JUDGE = { minChars: 25, maxChars: 220 } as const;
const CLERK = { minChars: 25, maxChars: 220 } as const;

const quote = (s: string) => `"${s}"`;

export const SOLO_PLAN: ModePlan = {
  mode: 'solo',
  version: 'solo-trial@1',
  targetSeconds: [60, 100],
  slots: [
    { id: 'L01', role: 'clerk', segment: 'call-to-order', ...CLERK, purpose: 'Introduce the case by its title and the confessed act in plain words, with one light, specific observation. No argument.' },
    { id: 'L02', role: 'prosecutor', segment: 'opening', ...COUNSEL, purpose: 'Prosecution opening: name the exact questionable decision and the specific contradiction that makes it questionable. Quote or closely paraphrase a concrete detail.' },
    { id: 'L03', role: 'defense', segment: 'opening', ...COUNSEL, answers: 'L02', purpose: 'Defense opening: answer the prosecution\'s specific charge with the strongest plausible reinterpretation of the motive. A clever analogy is welcome.' },
    { id: 'L04', role: 'prosecutor', segment: 'rebuttal', ...COUNSEL, answers: 'L03', purpose: 'Prosecution challenge: attack the specific reasoning the defense just used (its analogy or reframe) and expose where it breaks on the facts.' },
    { id: 'L05', role: 'defense', segment: 'rebuttal', ...COUNSEL, answers: 'L04', purpose: 'Defense rebuttal: answer that challenge with a new point (not a repeat), ideally turning the prosecution\'s own words around.' },
    { id: 'L06', role: 'judge', segment: 'rebuttal', ...JUDGE, purpose: 'Judge reaction: a dry, deadpan reaction to the absurdity of the facts so far. No hint of who is winning.' },
    { id: 'L07', role: 'prosecutor', segment: 'closing', ...COUNSEL, purpose: 'Prosecution closing: one memorable line that calls back to an earlier detail or phrase and asks the jury for GUILTY.' },
    { id: 'L08', role: 'defense', segment: 'closing', ...COUNSEL, purpose: 'Defense closing: one memorable line that calls back to an earlier detail and asks the jury for NOT COOKED.' },
    {
      id: 'L09',
      role: 'judge',
      segment: 'jury-out',
      ...JUDGE,
      purpose: 'Vote invitation (written by the court, not the model).',
      template: (c) => `The court has heard enough about ${quote(c.title)}. Jurors: GUILTY, or NOT COOKED? The jury is out.`,
    },
  ],
};

export const VERSUS_PLAN: ModePlan = {
  mode: 'versus',
  version: 'versus-trial@1',
  targetSeconds: [70, 110],
  slots: [
    { id: 'L01', role: 'clerk', segment: 'call-to-order', ...CLERK, purpose: 'Neutral introduction: name the dispute and both participants. Take no side. One light, specific observation about the situation itself.' },
    { id: 'L02', role: 'benchA', segment: 'opening', ...COUNSEL, purpose: 'Side A presentation: Side A\'s strongest claim, using agreed facts first and attributing Side A\'s own claims ("my client says...").' },
    { id: 'L03', role: 'benchB', segment: 'opening', ...COUNSEL, purpose: 'Side B presentation: Side B\'s strongest claim, using agreed facts first and attributing Side B\'s own claims.' },
    { id: 'L04', role: 'benchB', segment: 'rebuttal', ...COUNSEL, answers: 'L02', purpose: 'Question Side A\'s strongest claim: probe its weakest assumption without inventing anything.' },
    { id: 'L05', role: 'benchA', segment: 'rebuttal', ...COUNSEL, answers: 'L03', purpose: 'Question Side B\'s strongest claim: probe its weakest assumption without inventing anything.' },
    { id: 'L06', role: 'benchA', segment: 'rebuttal', ...COUNSEL, answers: 'L04', purpose: 'Rebuttal supporting Side A: answer the questioning in L04 with a new point.' },
    { id: 'L07', role: 'benchB', segment: 'rebuttal', ...COUNSEL, answers: 'L05', purpose: 'Rebuttal supporting Side B: answer the questioning in L05 with a new point.' },
    { id: 'L08', role: 'judge', segment: 'rebuttal', ...JUDGE, purpose: 'Judge reaction: deadpan reaction to the dispute as a whole, even-handed, no hint of a winner.' },
    { id: 'L09', role: 'benchA', segment: 'closing', ...COUNSEL, purpose: 'Closing for Side A: one memorable line with a callback, asking the jury for SIDE A.' },
    { id: 'L10', role: 'benchB', segment: 'closing', ...COUNSEL, purpose: 'Closing for Side B: one memorable line with a callback, asking the jury for SIDE B.' },
    {
      id: 'L11',
      role: 'judge',
      segment: 'jury-out',
      ...JUDGE,
      purpose: 'Vote invitation (written by the court, not the model).',
      template: (c) => `Both sides have been heard. Jurors: SIDE A, ${c.parties.sideA ?? 'Side A'}, or SIDE B, ${c.parties.sideB ?? 'Side B'}? The jury is out.`,
    },
  ],
};

export const VIRAL_PLAN: ModePlan = {
  mode: 'viral',
  version: 'viral-trial@1',
  targetSeconds: [70, 110],
  slots: [
    {
      id: 'L01',
      role: 'clerk',
      segment: 'call-to-order',
      ...CLERK,
      maxChars: 320,
      purpose: 'Public-case introduction with the verbatim question (written by the court, not the model).',
      template: (c) => `Public case: ${quote(c.title)}. The question before the court, exactly as approved: ${quote(c.viral?.question ?? c.title)}`,
    },
    { id: 'L02', role: 'judge', segment: 'opening', ...JUDGE, maxChars: 260, purpose: 'Neutral background: what the debate is, using only the approved summary and sources. Mark opinions as opinions. Dry, spectator-friendly.' },
    { id: 'L03', role: 'benchA', segment: 'opening', ...COUNSEL, purpose: 'Side A argument: the approved Side A position at its most persuasive and entertaining.' },
    { id: 'L04', role: 'benchB', segment: 'opening', ...COUNSEL, purpose: 'Side B argument: the approved Side B position at its most persuasive and entertaining.' },
    { id: 'L05', role: 'benchB', segment: 'rebuttal', ...COUNSEL, answers: 'L03', purpose: 'Challenge to Side A: attack the reasoning of L03 specifically.' },
    { id: 'L06', role: 'benchA', segment: 'rebuttal', ...COUNSEL, answers: 'L04', purpose: 'Challenge to Side B: attack the reasoning of L04 specifically.' },
    { id: 'L07', role: 'benchA', segment: 'rebuttal', ...COUNSEL, answers: 'L05', purpose: 'Rebuttal for Side A: answer the challenge in L05 with a new point.' },
    { id: 'L08', role: 'benchB', segment: 'rebuttal', ...COUNSEL, answers: 'L06', purpose: 'Rebuttal for Side B: answer the challenge in L06 with a new point.' },
    { id: 'L09', role: 'judge', segment: 'rebuttal', ...JUDGE, purpose: 'Comedic judge reaction to the debate itself. Even-handed.' },
    { id: 'L10', role: 'judge', segment: 'closing', ...JUDGE, maxChars: 260, purpose: 'Balanced conclusion: one fair sentence for each side\'s best point. No winner, no prediction, no mention of bets, odds or money.' },
    {
      id: 'L11',
      role: 'clerk',
      segment: 'jury-out',
      ...CLERK,
      purpose: 'Resolution-pending announcement (written by the court, not the model).',
      template: () => 'Arguments are closed. This case is resolved by its approved process, not by the court\'s AI. Result pending.',
    },
  ],
};

export const PLANS: Readonly<Record<CourtMode, ModePlan>> = { solo: SOLO_PLAN, versus: VERSUS_PLAN, viral: VIRAL_PLAN };

/** The character who speaks a slot for this case. */
export function speakerFor(slot: SlotPlan, c: PreparedCase): CourtSpeaker {
  if (slot.role === 'benchA') return c.advocates?.A ?? 'prosecutor';
  if (slot.role === 'benchB') return c.advocates?.B ?? 'defense';
  return slot.role;
}

/** Ballot index a slot argues for (counsel slots only). Solo: prosecution = 0 (GUILTY). */
export function benchFor(slot: SlotPlan): 0 | 1 | undefined {
  switch (slot.role) {
    case 'prosecutor':
    case 'benchA':
      return 0;
    case 'defense':
    case 'benchB':
      return 1;
    default:
      return undefined;
  }
}

export const modelSlots = (plan: ModePlan): readonly SlotPlan[] => plan.slots.filter((s) => !s.template);

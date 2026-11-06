import type { ModeId } from '@cringe-court/core';
import type { StagePose } from '@/art/stagePoses';

/** Presentation for each mode. Numbers come from @cringe-court/core, never from here. */
export interface ModePresentation {
  id: ModeId;
  eyebrow: string;
  headline: string;
  pitch: string;
  /** Who stands on the mode card, left to right. */
  cast: ReadonlyArray<{ character: StagePose[0]; pose: StagePose[1] }>;
  steps: readonly string[];
  whoPays: string;
  revenue: string;
  refunds: string;
  accent: 'accent' | 'side' | 'highlight';
}

export const MODE_PRESENTATION: Readonly<Record<ModeId, ModePresentation>> = {
  solo: {
    id: 'solo',
    eyebrow: 'Mode 1 · Solo',
    headline: 'Confess. Get roasted. Let the jury decide.',
    pitch:
      'File your own crime against common sense. Counsel Chaos argues for you, Miss Ratio argues against you, and three verified strangers decide: GUILTY or NOT COOKED.',
    cast: [
      { character: 'defense', pose: 'idle_a' },
      { character: 'judge', pose: 'idle' },
      { character: 'prosecutor', pose: 'objection' },
    ],
    steps: ['Write your confession and pick a category', 'Steer your lawyer with one angle', 'Three jurors swear in with a bond', 'They seal, then reveal, their votes', 'Verdict, sentence and a share card'],
    whoPays: 'You pay the case charge once. The free teaser (openings only) costs nothing.',
    revenue: 'The platform keeps the protocol and AI fees only when a verdict is reached.',
    refunds: 'Full refund on NO VERDICT, an unfilled jury, an AI failure or a protective cancel.',
    accent: 'accent',
  },
  versus: {
    id: 'versus',
    eyebrow: 'Mode 2 · Versus',
    headline: 'Two sides. Two AI lawyers. One jury.',
    pitch:
      'Settle it properly. Each side tells their story privately, approves what goes public, and gets their own AI advocate. Neither side can edit the other. The jury picks the better case.',
    cast: [
      { character: 'side-a', pose: 'talking' },
      { character: 'judge', pose: 'idle_b' },
      { character: 'side-b', pose: 'angry' },
    ],
    steps: ['Side A files and invites Side B', 'Both approve their public story', 'Each side pays half', 'A random verified jury hears both', 'SIDE A or SIDE B: bragging rights only'],
    whoPays: 'Split 50/50. Nothing is charged unless the other side consents and pays their half.',
    revenue: 'Protocol fee plus both AI fees, kept only on a verdict.',
    refunds: 'Each side gets their own half back on any failure. Nobody wins the other side’s money.',
    accent: 'side',
  },
  'grand-jury': {
    id: 'grand-jury',
    eyebrow: 'Mode 3 · Grand Jury',
    headline: 'The internet’s biggest arguments, on trial.',
    pitch:
      'One famous question, argued in public. Anyone can chip in to fund the trial, watch it live and make a free, points-only call. Seven sworn, verified jurors decide.',
    cast: [
      { character: 'prosecutor', pose: 'talking' },
      { character: 'juror', pose: 'idle' },
      { character: 'defense', pose: 'laughing' },
    ],
    steps: ['A reviewed public question is docketed', 'Spectators crowdfund it (sponsor slot optional)', 'Seven jurors swear in', 'The crowd calls it, hidden until the reveal', 'Four matching votes decide it'],
    whoPays: 'Spectators crowdfund from 0.10 test USDC; a sponsor can fund the rest.',
    revenue: 'Protocol and AI fees on a verdict, plus a sponsor slot at launch. Spectating is free.',
    refunds: 'Pro-rata refund to every funder if the trial fails or ends in NO VERDICT.',
    accent: 'highlight',
  },
};

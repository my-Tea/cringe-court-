import type { IconName } from '@/ds';

/** The six beats of a trial, shared by the how-to-play page. */
export const TRIAL_STEPS: ReadonlyArray<{ icon: IconName; title: string; body: string }> = [
  { icon: 'document', title: 'File the case', body: 'Write it, pick a category, approve the public version. Nothing goes live without your OK.' },
  { icon: 'lock', title: 'Jury swears in', body: 'Random World-verified humans accept a seat and lock a refundable bond. No friends on the jury.' },
  { icon: 'megaphone', title: 'The AI performs', body: 'Miss Ratio prosecutes, Counsel Chaos defends. The transcript is frozen and fingerprinted.' },
  { icon: 'shield', title: 'Secret Verdict Scroll', body: 'Each juror seals a hidden vote. Nobody, not even the court, sees a tally.' },
  { icon: 'eye', title: 'Open Your Scroll', body: 'Jurors reveal what they sealed. Only revealed votes count; a majority decides.' },
  { icon: 'refresh', title: 'Verdict & receipts', body: 'Gavel. Bonds back, rewards paid or refunds sent, each with a receipt you can check.' },
];

export const PILLARS: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Real, verified humans', body: 'Every juror passes World ID screening. One person, one seat, never on their own case.' },
  { title: 'Sealed ballots', body: 'Commit, then reveal. Votes stay hidden until the reveal window, so nobody follows the crowd.' },
  { title: 'Fixed deadlines', body: 'Every fee, bond and deadline is written into the case when it opens and can never change.' },
  { title: 'Honest money', body: 'Testnet only. No pricing needs no-shows, and failures refund. Every movement gets a receipt.' },
];

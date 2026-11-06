import type { IconName } from '@/ds';
import type { MessageKey } from '@/i18n';

/** The six beats of a trial, shared by the how-to-play page. Copy lives in the `shell` catalog. */
export const TRIAL_STEPS: ReadonlyArray<{ icon: IconName; title: MessageKey; body: MessageKey }> = [
  { icon: 'document', title: 'shell.trial.step.file.title', body: 'shell.trial.step.file.body' },
  { icon: 'lock', title: 'shell.trial.step.jury.title', body: 'shell.trial.step.jury.body' },
  { icon: 'megaphone', title: 'shell.trial.step.performs.title', body: 'shell.trial.step.performs.body' },
  { icon: 'shield', title: 'shell.trial.step.seal.title', body: 'shell.trial.step.seal.body' },
  { icon: 'eye', title: 'shell.trial.step.reveal.title', body: 'shell.trial.step.reveal.body' },
  { icon: 'refresh', title: 'shell.trial.step.verdict.title', body: 'shell.trial.step.verdict.body' },
];

export const PILLARS: ReadonlyArray<{ title: MessageKey; body: MessageKey }> = [
  { title: 'shell.pillar.humans.title', body: 'shell.pillar.humans.body' },
  { title: 'shell.pillar.sealed.title', body: 'shell.pillar.sealed.body' },
  { title: 'shell.pillar.deadlines.title', body: 'shell.pillar.deadlines.body' },
  { title: 'shell.pillar.money.title', body: 'shell.pillar.money.body' },
];

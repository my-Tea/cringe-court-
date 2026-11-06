import type { ModeId } from '@cringe-court/core';
import type { StagePose } from '@/art/stagePoses';
import type { MessageKey } from '@/i18n';

/** Presentation for each mode. Numbers come from @cringe-court/core, never from here; copy is catalog keys (`shell` namespace). */
export interface ModePresentation {
  id: ModeId;
  eyebrow: MessageKey;
  headline: MessageKey;
  pitch: MessageKey;
  /** Who stands on the mode card, left to right. */
  cast: ReadonlyArray<{ character: StagePose[0]; pose: StagePose[1] }>;
  steps: readonly MessageKey[];
  whoPays: MessageKey;
  revenue: MessageKey;
  refunds: MessageKey;
  accent: 'accent' | 'side' | 'highlight';
}

export const MODE_PRESENTATION: Readonly<Record<ModeId, ModePresentation>> = {
  solo: {
    id: 'solo',
    eyebrow: 'shell.mode.solo.eyebrow',
    headline: 'shell.mode.solo.headline',
    pitch: 'shell.mode.solo.pitch',
    cast: [
      { character: 'defense', pose: 'idle_a' },
      { character: 'judge', pose: 'idle' },
      { character: 'prosecutor', pose: 'objection' },
    ],
    steps: ['shell.mode.solo.step1', 'shell.mode.solo.step2', 'shell.mode.solo.step3', 'shell.mode.solo.step4', 'shell.mode.solo.step5'],
    whoPays: 'shell.mode.solo.whoPays',
    revenue: 'shell.mode.solo.revenue',
    refunds: 'shell.mode.solo.refunds',
    accent: 'accent',
  },
  versus: {
    id: 'versus',
    eyebrow: 'shell.mode.versus.eyebrow',
    headline: 'shell.mode.versus.headline',
    pitch: 'shell.mode.versus.pitch',
    cast: [
      { character: 'side-a', pose: 'talking' },
      { character: 'judge', pose: 'idle_b' },
      { character: 'side-b', pose: 'angry' },
    ],
    steps: ['shell.mode.versus.step1', 'shell.mode.versus.step2', 'shell.mode.versus.step3', 'shell.mode.versus.step4', 'shell.mode.versus.step5'],
    whoPays: 'shell.mode.versus.whoPays',
    revenue: 'shell.mode.versus.revenue',
    refunds: 'shell.mode.versus.refunds',
    accent: 'side',
  },
  'grand-jury': {
    id: 'grand-jury',
    eyebrow: 'shell.mode.grandJury.eyebrow',
    headline: 'shell.mode.grandJury.headline',
    pitch: 'shell.mode.grandJury.pitch',
    cast: [
      { character: 'prosecutor', pose: 'talking' },
      { character: 'juror', pose: 'idle' },
      { character: 'defense', pose: 'laughing' },
    ],
    steps: ['shell.mode.grandJury.step1', 'shell.mode.grandJury.step2', 'shell.mode.grandJury.step3', 'shell.mode.grandJury.step4', 'shell.mode.grandJury.step5'],
    whoPays: 'shell.mode.grandJury.whoPays',
    revenue: 'shell.mode.grandJury.revenue',
    refunds: 'shell.mode.grandJury.refunds',
    accent: 'highlight',
  },
};

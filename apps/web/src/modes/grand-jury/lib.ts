import type { CaseAudioEvent, VerdictOutcome } from '@cringe-court/audio';
import { caseCue } from '@/platform/audio';
import type { CharacterId as CoreCharacterId, CourtLine } from '@cringe-court/core';
import type { CharacterId } from '@/art/art';
import type { CaseDetail, DocketEntry, DocketStatus, SharePalette } from '@cringe-court/modes-grand-jury';
import type { BadgeTone } from '@/ds';
import { t, type MessageKey } from '@/i18n';

export const paths = { docket: '/grand-jury/docket', duty: '/grand-jury/duty', pricing: '/grand-jury/pricing', case: (n: number) => `/grand-jury/case/${n}` } as const;

/** Statuses where the case is over and nothing more can happen except claims. */
export function isClosed(status: DocketStatus): boolean {
  return status === 'verdict' || status === 'mistrial' || status === 'cancelled';
}

/** Badge tone and live dot per docket status. */
export const STATUS_TONE: Readonly<Record<DocketStatus, { tone: BadgeTone; dot?: boolean | 'pulse' }>> = {
  summoning: { tone: 'highlight', dot: true },
  seating: { tone: 'info', dot: 'pulse' },
  'in-session': { tone: 'accent', dot: 'pulse' },
  'opening-scrolls': { tone: 'accent', dot: 'pulse' },
  'settle-ready': { tone: 'highlight', dot: true },
  verdict: { tone: 'success' },
  mistrial: { tone: 'neutral' },
  cancelled: { tone: 'neutral' },
};

/** Stepper index per status (Summon → Seat → Argue & seal → Reveal → Verdict). */
const STEP_KEYS: readonly MessageKey[] = ['grandJury.steps.summon', 'grandJury.steps.seat', 'grandJury.steps.argue', 'grandJury.steps.open', 'grandJury.steps.verdict'];
/** The five step labels, translated at call time. */
export function steps(): string[] {
  return STEP_KEYS.map((k) => t(k));
}
export function stepOf(status: DocketStatus): number {
  switch (status) {
    case 'summoning':
      return 0;
    case 'seating':
      return 1;
    case 'in-session':
      return 2;
    case 'opening-scrolls':
    case 'settle-ready':
      return 3;
    default:
      return 4;
  }
}

/**
 * Grand Jury topics. The core `category` is Solo's crime table (a display label only), so public cases are
 * grouped by their own topic, derived from the case file's tags; the data and pricing are untouched.
 */
export const GRAND_JURY_TOPICS = ['food', 'etiquette', 'tech', 'style', 'life'] as const;
export type GrandJuryTopic = (typeof GRAND_JURY_TOPICS)[number];

const TOPIC_BY_TAG: Readonly<Record<string, GrandJuryTopic>> = { food: 'food', etiquette: 'etiquette', code: 'tech', internet: 'tech', fashion: 'style' };
const TOPIC_TAG_PRIORITY = ['food', 'etiquette', 'code', 'internet', 'fashion'] as const;

export function topicOf(file: { tags: readonly string[] }): GrandJuryTopic {
  const tag = TOPIC_TAG_PRIORITY.find((x) => file.tags.includes(x));
  return tag ? TOPIC_BY_TAG[tag]! : 'life';
}

export const isTopic = (v: string | null): v is GrandJuryTopic => v !== null && (GRAND_JURY_TOPICS as readonly string[]).includes(v);

/** Display name of a Grand Jury topic (from the catalog). */
export function topicLabel(topic: GrandJuryTopic): string {
  return t(`grandJury.topic.${topic}` as MessageKey);
}

/** Docket status badge text (the package table is English-only). */
export function statusLabel(s: DocketStatus): string {
  return t(STATUS_KEYS[s]);
}

const STATUS_KEYS: Record<DocketStatus, MessageKey> = {
  summoning: 'grandJury.status.summoning',
  seating: 'grandJury.status.seating',
  'in-session': 'grandJury.status.inSession',
  'opening-scrolls': 'grandJury.status.openingScrolls',
  'settle-ready': 'grandJury.status.settleReady',
  verdict: 'grandJury.status.verdict',
  mistrial: 'grandJury.status.mistrial',
  cancelled: 'grandJury.status.cancelled',
};

/** The four funding promises (package copy is English-only; the catalog carries the words). */
export function fundingPromise(k: 'refund' | 'summoner' | 'odds' | 'sponsor'): string {
  return t(`grandJury.promise.${k}`);
}

/** What the current countdown is counting down to. */
export function deadlineLabel(e: Pick<DocketEntry, 'status'>): string {
  switch (e.status) {
    case 'summoning':
      return t('grandJury.deadline.summoning');
    case 'seating':
      return t('grandJury.deadline.seating');
    case 'in-session':
      return t('grandJury.deadline.inSession');
    case 'opening-scrolls':
      return t('grandJury.deadline.openingScrolls');
    default:
      return t('grandJury.deadline.default');
  }
}

/** "3 min ago", "just now". */
export function ago(seconds: number): string {
  if (seconds < 20) return t('grandJury.ago.now');
  if (seconds < 3600) return t('grandJury.ago.minutes', { n: Math.max(1, Math.round(seconds / 60)) });
  if (seconds < 86400) return t('grandJury.ago.hours', { n: Math.round(seconds / 3600) });
  return t('grandJury.ago.days', { n: Math.round(seconds / 86400) });
}

/** Read the share-card colours from the live design tokens (never hard-coded). */
export function sharePalette(el: Element = document.documentElement): SharePalette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    parchment: v('--cc-neutral-100'),
    parchmentDeep: v('--cc-neutral-300'),
    ink: v('--cc-neutral-900'),
    muted: v('--cc-neutral-700'),
    maroon: v('--cc-royal-900'),
    maroonDeep: v('--cc-royal-700'),
    gold: v('--cc-gold-500'),
    goldLight: v('--cc-gold-100'),
    teal: v('--cc-teal-900'),
    green: v('--cc-green-900'),
  };
}

/* ── Sound: the app-wide shared engine (platform/audio.ts) ───────────────── */

/** Fire-and-forget courtroom sound. Silent where Web Audio is missing; the engine honours mute and Reduce sound. */
export function sound(event: CaseAudioEvent): void {
  caseCue(event);
}

/** Verdict stinger for a Grand Jury outcome (bench 0 / bench 1 / none). */
export function verdictSound(kind: 'ballot-0' | 'ballot-1' | 'no-verdict'): void {
  sound({ type: 'verdict.read', outcome: verdictOutcome(kind) });
}

/** Grand Jury verdict kind → the audio package's outcome. */
export function verdictOutcome(kind: 'ballot-0' | 'ballot-1' | 'no-verdict'): VerdictOutcome {
  return kind === 'no-verdict' ? 'no-verdict' : kind === 'ballot-0' ? 'side-a' : 'side-b';
}

/** Portrait for a transcript speaker. Grand Jury has no player, so `player` falls back to a plain Side A cut-out. */
export function portraitOf(c: CoreCharacterId): CharacterId {
  return c === 'player' ? 'side-a' : c;
}

/** The beats a hearing plays, in order: the frozen transcript, then the judge's sentence once there is a verdict. */
export function hearingLines(detail: Pick<CaseDetail, 'transcript' | 'sentence'>): readonly CourtLine[] {
  return detail.sentence ? [...detail.transcript, detail.sentence] : detail.transcript;
}

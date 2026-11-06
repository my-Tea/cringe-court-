import type { CaseAudioEvent } from '@cringe-court/audio';
import type { CharacterId as CoreCharacterId, CourtLine } from '@cringe-court/core';
import type { CharacterId } from '@/art/art';
import type { CaseDetail, DocketEntry, DocketStatus, SharePalette } from '@cringe-court/modes-grand-jury';
import type { BadgeTone } from '@/ds';

export const paths = {
  docket: '/grand-jury/docket',
  duty: '/grand-jury/duty',
  pricing: '/grand-jury/pricing',
  case: (n: number) => `/grand-jury/case/${n}`,
} as const;

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
export const STEPS = ['Summon', 'Seat the jury', 'Argue & seal', 'Open scrolls', 'Verdict'] as const;
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

/** What the current countdown is counting down to. */
export function deadlineLabel(e: Pick<DocketEntry, 'status'>): string {
  switch (e.status) {
    case 'summoning':
      return 'Funding closes';
    case 'seating':
      return 'Jury selection closes';
    case 'in-session':
      return 'Ballots seal';
    case 'opening-scrolls':
      return 'Scrolls must be opened';
    default:
      return 'Deadline';
  }
}

/** "3 min ago", "just now". */
export function ago(seconds: number): string {
  if (seconds < 20) return 'just now';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
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

/* ── Sound: the procedural @cringe-court/audio engine, created lazily ───── */

type Engine = { handle(e: CaseAudioEvent): unknown; attachUnlock(): () => void };
let engine: Engine | null = null;
let loading: Promise<Engine | null> | null = null;

function getEngine(): Promise<Engine | null> {
  if (engine) return Promise.resolve(engine);
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return Promise.resolve(null);
  loading ??= import('@cringe-court/audio')
    .then(({ createAudioEngine }) => {
      const e = createAudioEngine();
      e.attachUnlock();
      engine = e;
      return e;
    })
    .catch(() => null);
  return loading;
}

/** Fire-and-forget courtroom sound. Silent where Web Audio is missing; the engine honours mute and Reduce sound. */
export function sound(event: CaseAudioEvent): void {
  void getEngine().then((e) => e?.handle(event));
}

/** Verdict stinger for a Grand Jury outcome (bench 0 / bench 1 / none). */
export function verdictSound(kind: 'ballot-0' | 'ballot-1' | 'no-verdict'): void {
  sound({ type: 'verdict.read', outcome: kind === 'no-verdict' ? 'no-verdict' : kind === 'ballot-0' ? 'side-a' : 'side-b' });
}

/** Portrait for a transcript speaker. Grand Jury has no player, so `player` falls back to a plain Side A cut-out. */
export function portraitOf(c: CoreCharacterId): CharacterId {
  return c === 'player' ? 'side-a' : c;
}

/** The beats a hearing plays, in order: the frozen transcript, then the judge's sentence once there is a verdict. */
export function hearingLines(detail: Pick<CaseDetail, 'transcript' | 'sentence'>): readonly CourtLine[] {
  return detail.sentence ? [...detail.transcript, detail.sentence] : detail.transcript;
}

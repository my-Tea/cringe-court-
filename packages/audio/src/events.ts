/**
 * Case events → sound. The app reports what happened in the case; this module
 * decides what it sounds like. `cuesForEvent` is pure so the mapping can be
 * tested and documented without a browser.
 *
 * `CourtPhase` mirrors `CasePhase` from `@cringe-court/core` (v3/p3-app-shell)
 * as a structural copy, so this package does not depend on core. The two are
 * assignable to each other; `test/events.test.ts` pins the list.
 */
import type { AmbiencePreset } from './ambience.ts';
import type { CueId } from './cues.ts';

export type CourtPhase =
  | 'draft'
  | 'pre-trial'
  | 'recruiting'
  | 'preparing'
  | 'commit'
  | 'reveal'
  | 'finalizing'
  | 'settled'
  | 'cancelled';

/** Who is speaking; used for stereo placement (prosecution left, defense right). */
export type Bench = 'prosecution' | 'defense' | 'side-a' | 'side-b' | 'judge' | 'gallery';

/** Verdict outcomes as the player sees them, across all three modes. */
export type VerdictOutcome = 'guilty' | 'not-cooked' | 'side-a' | 'side-b' | 'no-verdict';

export type CrowdReaction = 'murmur' | 'laugh' | 'gasp' | 'applause';

export type CaseAudioEvent =
  /** The case moved to a new phase (drives the ambience bed). */
  | { type: 'phase.entered'; phase: CourtPhase }
  /** The player walks into the courtroom view. */
  | { type: 'court.entered' }
  /** CHARGES FILED / case accepted / any official stamp. */
  | { type: 'case.stamped' }
  /** The judge opens the hearing. */
  | { type: 'hearing.opened' }
  /** The judge calls for order. */
  | { type: 'order' }
  /** An opening statement or argument begins. */
  | { type: 'statement.started'; by: Bench }
  | { type: 'objection'; by: Bench }
  | { type: 'crowd'; reaction: CrowdReaction; intensity?: number }
  /** Free teaser ends: "THE JURY IS OUT" (D3). */
  | { type: 'teaser.jury-out' }
  /** A juror took seat `index` (0-based). */
  | { type: 'juror.seated'; index: number }
  /** A bond or case fee was posted on-chain. */
  | { type: 'bond.posted' }
  /** The local juror sealed their ballot (commit). Carries no vote information. */
  | { type: 'ballot.committed' }
  /** The local juror opened their scroll (reveal). */
  | { type: 'ballot.revealed' }
  /** Vote `index` (0-based) was counted during the tally animation. */
  | { type: 'vote.counted'; index: number }
  /** Once per second while a deadline is visible. */
  | { type: 'deadline.tick'; secondsLeft: number; warnAt?: number }
  | { type: 'verdict.read'; outcome: VerdictOutcome }
  | { type: 'settlement'; kind: 'payout' | 'refund' | 'forfeit' }
  | { type: 'tx.confirmed' }
  | { type: 'tx.failed' };

export interface ScheduledCue {
  cue: CueId;
  /** Seconds after the event. */
  delay?: number;
  pan?: number;
  step?: number;
  intensity?: number;
}

export interface EventSound {
  cues: ScheduledCue[];
  /** Ambience to crossfade to, if the event changes the room. */
  ambience?: AmbiencePreset;
}

/** Where each bench sits in the stereo field, matching the courtroom layout. */
export const BENCH_PAN: Readonly<Record<Bench, number>> = {
  prosecution: -0.45,
  'side-a': -0.45,
  defense: 0.45,
  'side-b': 0.45,
  judge: 0,
  gallery: 0,
};

export const PHASE_AMBIENCE: Readonly<Record<CourtPhase, AmbiencePreset>> = {
  draft: 'off',
  'pre-trial': 'session',
  recruiting: 'lobby',
  preparing: 'lobby',
  commit: 'deliberation',
  reveal: 'deliberation',
  finalizing: 'verdict',
  settled: 'lobby',
  cancelled: 'off',
};

export const VERDICT_CUE: Readonly<Record<VerdictOutcome, CueId>> = {
  guilty: 'verdict_guilty',
  'not-cooked': 'verdict_not_cooked',
  'side-a': 'verdict_decided',
  'side-b': 'verdict_decided',
  'no-verdict': 'verdict_none',
};

/** The gallery's reaction after each verdict card lands. */
const VERDICT_REACTION: Readonly<Record<VerdictOutcome, ScheduledCue>> = {
  guilty: { cue: 'crowd_gasp', delay: 0.95 },
  'not-cooked': { cue: 'crowd_applause', delay: 1.1 },
  'side-a': { cue: 'crowd_applause', delay: 1.4, intensity: 0.7 },
  'side-b': { cue: 'crowd_applause', delay: 1.4, intensity: 0.7 },
  'no-verdict': { cue: 'crowd_murmur', delay: 1.6, intensity: 0.7 },
};

const CROWD_CUE: Readonly<Record<CrowdReaction, CueId>> = {
  murmur: 'crowd_murmur',
  laugh: 'crowd_laugh',
  gasp: 'crowd_gasp',
  applause: 'crowd_applause',
};

const DEFAULT_WARN_AT = 30;
const FINAL_SECONDS = 10;

export function cuesForEvent(event: CaseAudioEvent): EventSound {
  switch (event.type) {
    case 'phase.entered': {
      const ambience = PHASE_AMBIENCE[event.phase];
      const cues: ScheduledCue[] =
        event.phase === 'pre-trial' ? [{ cue: 'gavel_strike' }]
        : event.phase === 'commit' ? [{ cue: 'paper', intensity: 0.6 }]
        : event.phase === 'cancelled' ? [{ cue: 'stamp', intensity: 0.6 }]
        : [];
      return { cues, ambience };
    }
    case 'court.entered':
      return { cues: [{ cue: 'door_creak' }] };
    case 'case.stamped':
      return { cues: [{ cue: 'stamp' }] };
    case 'hearing.opened':
      return { cues: [{ cue: 'gavel_strike' }], ambience: 'session' };
    case 'order':
      return { cues: [{ cue: 'gavel_triple' }] };
    case 'statement.started':
      return { cues: [{ cue: 'paper', pan: BENCH_PAN[event.by], intensity: 0.7 }] };
    case 'objection':
      return { cues: [{ cue: 'objection', pan: BENCH_PAN[event.by] * 0.6 }, { cue: 'crowd_murmur', delay: 0.7, intensity: 0.5 }] };
    case 'crowd':
      return { cues: [{ cue: CROWD_CUE[event.reaction], intensity: event.intensity ?? 1 }] };
    case 'teaser.jury-out':
      return { cues: [{ cue: 'gavel_strike' }, { cue: 'crowd_murmur', delay: 0.4 }], ambience: 'lobby' };
    case 'juror.seated':
      return { cues: [{ cue: 'vote_tick', step: Math.max(0, event.index) * 2, intensity: 0.8 }] };
    case 'bond.posted':
      return { cues: [{ cue: 'coin' }] };
    case 'ballot.committed':
      return { cues: [{ cue: 'ballot_seal' }] };
    case 'ballot.revealed':
      return { cues: [{ cue: 'ballot_unlock' }] };
    case 'vote.counted':
      return { cues: [{ cue: 'vote_tick', step: Math.max(0, event.index) }] };
    case 'deadline.tick': {
      const s = Math.floor(event.secondsLeft);
      const warnAt = event.warnAt ?? DEFAULT_WARN_AT;
      if (s === 0) return { cues: [{ cue: 'timer_expired' }] };
      if (s > 0 && s <= FINAL_SECONDS) {
        return { cues: [{ cue: 'timer_tick', intensity: 1 - (s - 1) / FINAL_SECONDS }] };
      }
      if (s === warnAt) return { cues: [{ cue: 'timer_warning' }] };
      return { cues: [] };
    }
    case 'verdict.read':
      return { cues: [{ cue: VERDICT_CUE[event.outcome] }, VERDICT_REACTION[event.outcome]], ambience: 'lobby' };
    case 'settlement':
      return event.kind === 'forfeit' ? { cues: [{ cue: 'ui_error' }] } : { cues: [{ cue: 'coin' }, { cue: 'coin', delay: 0.16, intensity: 0.7 }] };
    case 'tx.confirmed':
      return { cues: [{ cue: 'ui_confirm' }] };
    case 'tx.failed':
      return { cues: [{ cue: 'ui_error' }] };
  }
}

/**
 * `sound` labels used in `cc-art/dist/animation/animations.json`. Play
 * `cueForAnimationSound(label)` when a timeline step with that label fires.
 */
export const ANIMATION_SOUND_CUES = {
  door_creak: 'door_creak',
  stamp: 'stamp',
  coin: 'coin',
  paper: 'paper',
  unlock: 'ballot_unlock',
  gavel: 'gavel_strike',
} as const satisfies Record<string, CueId>;

export type AnimationSoundLabel = keyof typeof ANIMATION_SOUND_CUES;

/**
 * Verdict animations open on a `gavel` step. The verdict sting already starts
 * with that gavel, so for these animations the step plays the whole sting
 * instead (otherwise the gavel would sound twice).
 */
const ANIMATION_STING: Readonly<Record<string, CueId>> = {
  verdict_guilty: 'verdict_guilty',
  verdict_not_cooked: 'verdict_not_cooked',
};

export function cueForAnimationSound(label: string, animation?: string): CueId | null {
  if (label === 'gavel' && animation && ANIMATION_STING[animation]) return ANIMATION_STING[animation];
  return (ANIMATION_SOUND_CUES as Record<string, CueId>)[label] ?? null;
}

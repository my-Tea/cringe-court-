/**
 * The cue catalogue. Every sound the app can trigger has a typed id here and a
 * spec that tells the engine how to mix it. The recipes that synthesise each cue
 * live in `recipes/`; `test/cues.test.ts` checks the two stay in step.
 *
 * Ids are snake_case to match the art pipeline (`cc-art/dist/animation/animations.json`
 * uses `verdict_guilty`, `door_creak`, …).
 */

export const CUE_IDS = [
  // Gavel
  'gavel_strike',
  'gavel_triple',
  // Courtroom drama
  'objection',
  // Crowd
  'crowd_murmur',
  'crowd_laugh',
  'crowd_gasp',
  'crowd_applause',
  // Verdict stings
  'verdict_guilty',
  'verdict_not_cooked',
  'verdict_decided',
  'verdict_none',
  // Jury and ballots
  'vote_tick',
  'ballot_seal',
  'ballot_unlock',
  // Timer
  'timer_warning',
  'timer_tick',
  'timer_expired',
  // Foley (also the `sound` labels in animations.json)
  'stamp',
  'paper',
  'coin',
  'door_creak',
  // Interface
  'ui_click',
  'ui_hover',
  'ui_toggle',
  'ui_toast',
  'ui_confirm',
  'ui_error',
  // Character babble under dialogue
  'voice_judge',
  'voice_prosecutor',
  'voice_defense',
  'voice_side_a',
  'voice_side_b',
  'voice_narrator',
  'voice_clerk',
] as const;

export type CueId = (typeof CUE_IDS)[number];

export type CueCategory = 'gavel' | 'drama' | 'crowd' | 'verdict' | 'jury' | 'timer' | 'foley' | 'ui' | 'voice';

/**
 * What a cue does when the player asks for less sound (the "Reduce sound"
 * setting, which follows `prefers-reduced-motion` by default):
 * - `play`   unchanged (short, informative sounds)
 * - `soften` plays quieter and with its intensity capped
 * - `skip`   not played at all (decorative or startling sounds)
 */
export type ReducedBehavior = 'play' | 'soften' | 'skip';

export interface CueSpec {
  readonly id: CueId;
  readonly category: CueCategory;
  /** Short name for menus and the demo. */
  readonly label: string;
  /** What it sounds like and when to use it. */
  readonly description: string;
  /** Mix trim in dB applied on top of the sfx bus. */
  readonly gainDb: number;
  /** Reverb send, 0..1. */
  readonly wet: number;
  /** Dry length in seconds, before the reverb tail (`test/recipes.test.ts` holds recipes to it). */
  readonly duration: number;
  /** Polyphony limit for this cue; the oldest voice is faded out when exceeded. */
  readonly maxVoices: number;
  /** Repeats closer together than this are dropped (hover spam, double clicks). */
  readonly minIntervalMs: number;
  readonly reduced: ReducedBehavior;
  /** Duck the ambience bed while this cue plays. */
  readonly duck?: { readonly depthDb: number; readonly seconds: number };
}

type SpecInput = Omit<CueSpec, 'id'>;

const spec = <T extends Record<CueId, SpecInput>>(table: T): { readonly [K in CueId]: CueSpec } =>
  Object.fromEntries(Object.entries(table).map(([id, s]) => [id, { id, ...s }])) as {
    readonly [K in CueId]: CueSpec;
  };

export const CUES = spec({
  gavel_strike: {
    category: 'gavel',
    label: 'Gavel',
    description: 'One wooden strike on the sound block, with the hall answering. Calls the court to order.',
    gainDb: -7,
    wet: 0.32,
    duration: 0.25,
    maxVoices: 3,
    minIntervalMs: 90,
    reduced: 'soften',
  },
  gavel_triple: {
    category: 'gavel',
    label: 'Order! Order!',
    description: 'Three strikes, the last one hardest. For "ORDER!" and for silencing a rowdy gallery.',
    gainDb: -7,
    wet: 0.32,
    duration: 0.95,
    maxVoices: 1,
    minIntervalMs: 400,
    reduced: 'soften',
    duck: { depthDb: -6, seconds: 1.4 },
  },
  objection: {
    category: 'drama',
    label: 'Objection!',
    description: 'A whoosh into a brass stab and a body hit. Plays under the OBJECTION! callout.',
    gainDb: -5,
    wet: 0.2,
    duration: 0.85,
    maxVoices: 1,
    minIntervalMs: 400,
    reduced: 'soften',
    duck: { depthDb: -10, seconds: 1.1 },
  },
  crowd_murmur: {
    category: 'crowd',
    label: 'Murmur',
    description: 'The gallery whispers among itself, swells and settles. Reactions to a reveal or a weak argument.',
    gainDb: 6,
    wet: 0.45,
    duration: 2.75,
    maxVoices: 2,
    minIntervalMs: 600,
    reduced: 'skip',
  },
  crowd_laugh: {
    category: 'crowd',
    label: 'Laugh',
    description: 'A ripple of laughter from a dozen voices that dies out. For a line that lands.',
    gainDb: 5,
    wet: 0.42,
    duration: 3.15,
    maxVoices: 2,
    minIntervalMs: 600,
    reduced: 'skip',
  },
  crowd_gasp: {
    category: 'crowd',
    label: 'Gasp',
    description: 'A sharp collective inhale and a stunned murmur. For a shocking exhibit or a GUILTY card.',
    gainDb: 3,
    wet: 0.4,
    duration: 1.7,
    maxVoices: 1,
    minIntervalMs: 600,
    reduced: 'skip',
  },
  crowd_applause: {
    category: 'crowd',
    label: 'Applause',
    description: 'A short burst of clapping that thins out. For NOT COOKED and for Grand Jury results.',
    gainDb: 5,
    wet: 0.38,
    duration: 3.0,
    maxVoices: 1,
    minIntervalMs: 1000,
    reduced: 'skip',
  },
  verdict_guilty: {
    category: 'verdict',
    label: 'Verdict: GUILTY',
    description: 'Gavel, a timpani hit and a short-short-long brass phrase that ends on a dark chord. Matches the 2.2 s verdict_guilty animation.',
    gainDb: -8,
    wet: 0.3,
    duration: 2.8,
    maxVoices: 1,
    minIntervalMs: 1500,
    reduced: 'soften',
    duck: { depthDb: -14, seconds: 3.0 },
  },
  verdict_not_cooked: {
    category: 'verdict',
    label: 'Verdict: NOT COOKED',
    description: 'Gavel, then a rising bell arpeggio over a warm major chord and a cymbal swell. Matches verdict_not_cooked.',
    gainDb: -6,
    wet: 0.34,
    duration: 2.8,
    maxVoices: 1,
    minIntervalMs: 1500,
    reduced: 'soften',
    duck: { depthDb: -14, seconds: 3.0 },
  },
  verdict_decided: {
    category: 'verdict',
    label: 'Verdict: decided',
    description: 'Gavel and a stately two-chord fanfare that does not take sides. For Versus verdicts, which have a winner and a loser listening.',
    gainDb: -7,
    wet: 0.34,
    duration: 2.8,
    maxVoices: 1,
    minIntervalMs: 1500,
    reduced: 'soften',
    duck: { depthDb: -14, seconds: 2.8 },
  },
  verdict_none: {
    category: 'verdict',
    label: 'No verdict',
    description: 'A muted brass line that sags downward: the jury could not agree. Pairs with the NO VERDICT / MISTRIAL card and its refund.',
    gainDb: -5,
    wet: 0.3,
    duration: 2.25,
    maxVoices: 1,
    minIntervalMs: 1500,
    reduced: 'soften',
    duck: { depthDb: -12, seconds: 2.4 },
  },
  vote_tick: {
    category: 'jury',
    label: 'Vote tick',
    description: 'A wooden marimba tick. Pass `step` to climb a pentatonic scale as votes are counted.',
    gainDb: -6,
    wet: 0.18,
    duration: 0.43,
    maxVoices: 4,
    minIntervalMs: 40,
    reduced: 'play',
  },
  ballot_seal: {
    category: 'jury',
    label: 'Ballot sealed',
    description: 'Paper slides into the box, the lid drops and the latch clicks. Commit step; reveals nothing about the vote.',
    gainDb: -3,
    wet: 0.2,
    duration: 0.57,
    maxVoices: 1,
    minIntervalMs: 300,
    reduced: 'play',
  },
  ballot_unlock: {
    category: 'jury',
    label: 'Ballot unlocked',
    description: 'A key turns, the seal gives and a soft chime opens the scroll. Reveal step; also the `unlock` animation sound.',
    gainDb: -4,
    wet: 0.22,
    duration: 1.15,
    maxVoices: 1,
    minIntervalMs: 300,
    reduced: 'play',
  },
  timer_warning: {
    category: 'timer',
    label: 'Timer warning',
    description: 'Two soft rising pulses when a deadline enters its warning window (30 s by default).',
    gainDb: -5,
    wet: 0.15,
    duration: 0.47,
    maxVoices: 1,
    minIntervalMs: 500,
    reduced: 'play',
  },
  timer_tick: {
    category: 'timer',
    label: 'Clock tick',
    description: 'One clock tick for the final seconds. `intensity` 0..1 makes it brighter and more urgent.',
    gainDb: -8,
    wet: 0.12,
    duration: 0.07,
    maxVoices: 2,
    minIntervalMs: 120,
    reduced: 'soften',
  },
  timer_expired: {
    category: 'timer',
    label: "Time's up",
    description: 'A low buzzer under a bell: the deadline passed.',
    gainDb: -8,
    wet: 0.22,
    duration: 1.16,
    maxVoices: 1,
    minIntervalMs: 800,
    reduced: 'soften',
  },
  stamp: {
    category: 'foley',
    label: 'Stamp',
    description: 'A rubber stamp thumps onto paper. CHARGES FILED, case accepted, receipts.',
    gainDb: -5,
    wet: 0.18,
    duration: 0.18,
    maxVoices: 2,
    minIntervalMs: 120,
    reduced: 'play',
  },
  paper: {
    category: 'foley',
    label: 'Paper',
    description: 'A short rustle of papers. Statements, exhibits, ballots rising.',
    gainDb: 0,
    wet: 0.15,
    duration: 0.5,
    maxVoices: 2,
    minIntervalMs: 120,
    reduced: 'play',
  },
  coin: {
    category: 'foley',
    label: 'Coin',
    description: 'A bright coin drops and bounces. Bond posted, payout, refund.',
    gainDb: -7,
    wet: 0.2,
    duration: 0.99,
    maxVoices: 3,
    minIntervalMs: 60,
    reduced: 'play',
  },
  door_creak: {
    category: 'foley',
    label: 'Door creak',
    description: 'The heavy courtroom door creaks open and settles. Entering court.',
    gainDb: -9,
    wet: 0.35,
    duration: 1.54,
    maxVoices: 1,
    minIntervalMs: 800,
    reduced: 'skip',
  },
  ui_click: {
    category: 'ui',
    label: 'Click',
    description: 'A soft, short tick for buttons and taps.',
    gainDb: -10,
    wet: 0.04,
    duration: 0.04,
    maxVoices: 3,
    minIntervalMs: 30,
    reduced: 'play',
  },
  ui_hover: {
    category: 'ui',
    label: 'Hover',
    description: 'A barely-there tick on pointer hover. Pointer devices only; skipped under Reduce sound.',
    gainDb: -22,
    wet: 0,
    duration: 0.03,
    maxVoices: 1,
    minIntervalMs: 60,
    reduced: 'skip',
  },
  ui_toggle: {
    category: 'ui',
    label: 'Toggle',
    description: 'Two quick ticks for switches. Pass `step` 1 for on (rises) or 0 for off (falls).',
    gainDb: -8,
    wet: 0.04,
    duration: 0.09,
    maxVoices: 2,
    minIntervalMs: 40,
    reduced: 'play',
  },
  ui_toast: {
    category: 'ui',
    label: 'Toast',
    description: 'A two-note glass chime for neutral notifications.',
    gainDb: -7,
    wet: 0.2,
    duration: 0.7,
    maxVoices: 2,
    minIntervalMs: 200,
    reduced: 'play',
  },
  ui_confirm: {
    category: 'ui',
    label: 'Confirm',
    description: 'Three rising marimba notes: a transaction landed, a step is done.',
    gainDb: -9,
    wet: 0.16,
    duration: 0.57,
    maxVoices: 1,
    minIntervalMs: 200,
    reduced: 'play',
  },
  ui_error: {
    category: 'ui',
    label: 'Error',
    description: 'Two falling, muffled notes. Something failed; never harsh.',
    gainDb: -6,
    wet: 0.1,
    duration: 0.31,
    maxVoices: 1,
    minIntervalMs: 250,
    reduced: 'play',
  },
  voice_judge: {
    category: 'voice',
    label: 'Judge babble',
    description: 'Low wordless syllables under Judge Gavel.exe dialogue.',
    gainDb: -1,
    wet: 0.14,
    duration: 1.35,
    maxVoices: 1,
    minIntervalMs: 900,
    reduced: 'soften',
  },
  voice_prosecutor: {
    category: 'voice',
    label: 'Miss Ratio babble',
    description: 'Sharp higher babble under Miss Ratio dialogue.',
    gainDb: -1,
    wet: 0.12,
    duration: 1.2,
    maxVoices: 1,
    minIntervalMs: 850,
    reduced: 'soften',
  },
  voice_defense: {
    category: 'voice',
    label: 'Counsel Chaos babble',
    description: 'Warm mid babble under Counsel Chaos dialogue.',
    gainDb: -1,
    wet: 0.13,
    duration: 1.25,
    maxVoices: 1,
    minIntervalMs: 850,
    reduced: 'soften',
  },
  voice_side_a: {
    category: 'voice',
    label: 'Side A babble',
    description: 'Wordless babble for Side A counsel.',
    gainDb: -1,
    wet: 0.12,
    duration: 1.15,
    maxVoices: 1,
    minIntervalMs: 850,
    reduced: 'soften',
  },
  voice_side_b: {
    category: 'voice',
    label: 'Side B babble',
    description: 'Wordless babble for Side B counsel.',
    gainDb: -1,
    wet: 0.12,
    duration: 1.15,
    maxVoices: 1,
    minIntervalMs: 850,
    reduced: 'soften',
  },
  voice_narrator: {
    category: 'voice',
    label: 'Narrator babble',
    description: 'Soft babble under narrator / clerk-style lines.',
    gainDb: -2,
    wet: 0.12,
    duration: 1.1,
    maxVoices: 1,
    minIntervalMs: 900,
    reduced: 'soften',
  },
  voice_clerk: {
    category: 'voice',
    label: 'Clerk babble',
    description: 'Calm dusty-blue clerk syllables.',
    gainDb: -1,
    wet: 0.12,
    duration: 1.05,
    maxVoices: 1,
    minIntervalMs: 900,
    reduced: 'soften',
  },
});

export const CUE_CATEGORIES: readonly { id: CueCategory; label: string }[] = [
  { id: 'gavel', label: 'Gavel' },
  { id: 'drama', label: 'Drama' },
  { id: 'crowd', label: 'Gallery' },
  { id: 'verdict', label: 'Verdicts' },
  { id: 'jury', label: 'Jury & ballots' },
  { id: 'timer', label: 'Deadlines' },
  { id: 'foley', label: 'Foley' },
  { id: 'ui', label: 'Interface' },
  { id: 'voice', label: 'Voices' },
];

export function isCueId(value: unknown): value is CueId {
  return typeof value === 'string' && (CUE_IDS as readonly string[]).includes(value);
}

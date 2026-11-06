/**
 * The Director turns a frozen transcript into a Show: an ordered list of cues
 * (camera, character animation, sound, dialogue, lighting) that the ShowPlayer
 * performs through ScenePort and AudioPort. Pure and deterministic: the same
 * transcript always gives the same show, so a replay looks like the original.
 *
 * The show never encodes a verdict before the human one (D3, V4 §15): the AI
 * transcript ends at "THE JURY IS OUT"; verdict ceremonies are separate shows
 * built from the recorded Verdict.
 */
import type {
  AudioCueId,
  Beat,
  CameraShot,
  CastMember,
  CourtLine,
  LightingMood,
  PropState,
  Speaker,
  SystemAnimationId,
  Verdict,
} from '@cringe-court/core';

export type Cue =
  | { kind: 'camera'; shot: CameraShot; seconds: number }
  | { kind: 'animate'; actor: string; animation: string; wait?: boolean }
  | { kind: 'system'; animation: SystemAnimationId; wait: boolean }
  | { kind: 'sound'; cue: AudioCueId; pan?: number }
  | { kind: 'music'; cue: AudioCueId | null }
  | { kind: 'lighting'; mood: LightingMood; seconds: number }
  | { kind: 'prop'; state: PropState }
  | { kind: 'fx'; effect: 'shake' | 'flash' | 'impact' | 'sweat' | 'tears'; actor?: string }
  | { kind: 'say'; actor: string; line: CourtLine; seconds: number }
  | { kind: 'card'; card: 'case-number' | 'charges-filed' | 'jury-out' | 'verdict' | 'mistrial' | 'receipt'; text?: string }
  | { kind: 'wait'; seconds: number };

export interface Show {
  id: string;
  cues: readonly Cue[];
  /** Total scripted seconds at speed 1 (dialogue + waits; animations run in parallel). */
  seconds: number;
  /** Index of the first cue of each line, by line id (for skip / scrub). */
  lineStarts: Readonly<Record<string, number>>;
}

export interface DirectorOptions {
  /** Reading pace for dialogue boxes. */
  msPerChar?: number;
  minLineSeconds?: number;
  maxLineSeconds?: number;
}

const ACTOR_FOR: Readonly<Record<Speaker, string>> = {
  judge: 'judge',
  prosecutor: 'prosecutor',
  defense: 'defense',
  'side-a': 'side-a',
  'side-b': 'side-b',
  narrator: 'narrator',
  clerk: 'clerk',
};

const VOICE: Readonly<Record<Speaker, AudioCueId>> = {
  judge: 'voice.judge',
  prosecutor: 'voice.prosecutor',
  defense: 'voice.defense',
  'side-a': 'voice.side-a',
  'side-b': 'voice.side-b',
  narrator: 'voice.narrator',
  // No dedicated clerk voice cue yet; the clerk borrows the narrator blip.
  clerk: 'voice.narrator',
};

/**
 * The actor that performs a speaker's line in this cast. A clerk line falls back
 * to the narrator, then the judge, so casts staged before the clerk existed still play.
 */
function actorIn(speaker: Speaker, present: ReadonlySet<string>): string | null {
  const preferred = ACTOR_FOR[speaker];
  if (present.has(preferred)) return preferred;
  if (speaker === 'clerk') return ['narrator', 'judge'].find((a) => present.has(a)) ?? null;
  return null;
}

/**
 * Shot by who speaks: prosecution bench is camera-left, defense camera-right (SCENE-GUIDE sightlines).
 * A line's own `camera` preset (validated court-ai output) wins.
 */
function shotFor(line: CourtLine): CameraShot {
  if (line.camera) return line.camera;
  if (line.speaker === 'judge') return 'close_judge';
  if (line.speaker === 'narrator' || line.speaker === 'clerk') return 'close_witness';
  return line.bench === 1 ? 'close_defense' : 'close_prosecution';
}

const PAN: Readonly<Record<string, number>> = { prosecutor: -0.6, 'side-a': -0.6, defense: 0.6, 'side-b': 0.6, judge: 0, narrator: -0.3, clerk: -0.3 };

const CROWD: Readonly<Record<NonNullable<CourtLine['crowd']>, AudioCueId>> = {
  gasp: 'sfx.crowd-gasp',
  laugh: 'sfx.crowd-laugh',
  murmur: 'sfx.crowd-murmur',
};

interface BeatPlan {
  animation?: string;
  sound?: AudioCueId;
  fx?: 'shake' | 'flash' | 'impact' | 'sweat' | 'tears';
  /** How the other bench reacts. */
  reaction?: string;
  crowd?: AudioCueId;
}

const BEATS: Readonly<Record<Beat, BeatPlan>> = {
  'desk-slam': { animation: 'react_angry', sound: 'sfx.desk-slam', fx: 'impact', reaction: 'react_shocked' },
  objection: { animation: 'objection', sound: 'stinger.objection', reaction: 'react_shocked', crowd: 'sfx.crowd-gasp' },
  point: { animation: 'talk' },
  gasp: { animation: 'react_shocked', crowd: 'sfx.crowd-gasp' },
  laugh: { animation: 'react_happy', crowd: 'sfx.crowd-laugh' },
  smug: { animation: 'react_happy' },
  sweat: { animation: 'react_shocked', fx: 'sweat' },
  cry: { animation: 'defeated', fx: 'tears', crowd: 'sfx.crowd-murmur' },
  gavel: { animation: 'react_angry', sound: 'sfx.gavel', fx: 'shake' },
  'present-evidence': { animation: 'talk', sound: 'sfx.paper' },
  'dramatic-pause': {},
};

export function lineSeconds(text: string, options: DirectorOptions = {}): number {
  const { msPerChar = 75, minLineSeconds = 3, maxLineSeconds = 12 } = options;
  return Math.min(maxLineSeconds, Math.max(minLineSeconds, (text.length * msPerChar) / 1000));
}

function opposing(actor: string, cast: readonly CastMember[]): string | null {
  const benches = cast.filter((c) => c.mark === 'prosecution' || c.mark === 'defense');
  const me = benches.find((c) => c.actor === actor);
  if (!me) return null;
  return benches.find((c) => c.mark !== me.mark)?.actor ?? null;
}

/** Compile a transcript (teaser or full) into a show for one cast. */
export function directTrial(id: string, lines: readonly CourtLine[], cast: readonly CastMember[], options: DirectorOptions = {}): Show {
  const present = new Set(cast.map((c) => c.actor));
  const cues: Cue[] = [];
  const lineStarts: Record<string, number> = {};
  let seconds = 0;
  let lastShot: CameraShot | null = null;
  let segment: CourtLine['segment'] | null = null;

  cues.push({ kind: 'music', cue: 'music.trial' }, { kind: 'lighting', mood: 'spotlight', seconds: 1.2 });

  for (const line of lines) {
    const actor = actorIn(line.speaker, present);
    if (actor === null) throw new Error(`Line ${line.id}: speaker ${line.speaker} is not in the cast`);
    lineStarts[line.id] = cues.length;

    if (line.segment !== segment) {
      if (line.segment === 'call-to-order') {
        cues.push({ kind: 'system', animation: 'enter_court', wait: true });
        seconds += 2.4;
      }
      if (line.segment === 'jury-out') cues.push({ kind: 'lighting', mood: 'tense', seconds: 0.8 }, { kind: 'music', cue: 'music.tension' });
      if (line.segment === 'exhibit') cues.push({ kind: 'camera', shot: 'pov_corner', seconds: 1 });
      segment = line.segment;
    }

    const shot = line.segment === 'jury-out' ? 'close_jury' : line.segment === 'exhibit' ? 'pov_corner' : shotFor(line);
    if (shot !== lastShot) {
      cues.push({ kind: 'camera', shot, seconds: lastShot === null ? 0 : 0.9 });
      lastShot = shot;
    }
    if (line.exhibitId) cues.push({ kind: 'prop', state: { prop: 'evidence_screen', state: 'on', exhibitId: line.exhibitId } });

    const plan = line.beat ? BEATS[line.beat] : {};
    if (plan.animation && plan.animation !== 'talk') cues.push({ kind: 'animate', actor, animation: plan.animation });
    if (plan.sound) cues.push({ kind: 'sound', cue: plan.sound, pan: PAN[actor] ?? 0 });
    if (plan.fx) cues.push({ kind: 'fx', effect: plan.fx, actor });
    const crowd = plan.crowd ?? (line.crowd ? CROWD[line.crowd] : undefined);
    if (crowd) cues.push({ kind: 'sound', cue: crowd });
    if (line.beat === 'dramatic-pause') {
      cues.push({ kind: 'wait', seconds: 0.8 });
      seconds += 0.8;
    }

    const say = lineSeconds(line.text, options);
    cues.push({ kind: 'sound', cue: VOICE[line.speaker], pan: PAN[actor] ?? 0 }, { kind: 'say', actor, line, seconds: say });
    seconds += say;

    if (plan.reaction) {
      const other = opposing(actor, cast);
      if (other) cues.push({ kind: 'animate', actor: other, animation: plan.reaction });
    }
    if (line.exhibitId) cues.push({ kind: 'prop', state: { prop: 'evidence_screen', state: 'off' } });
    if (line.segment === 'jury-out') {
      cues.push({ kind: 'sound', cue: 'stinger.jury-out' }, { kind: 'card', card: 'jury-out', text: 'THE JURY IS OUT' });
    }
  }
  return { id, cues, seconds, lineStarts };
}

/* ── Ceremonies: scripted moments around the human process ─────────────── */

export function directCaseOpened(caseLabel: string): Show {
  const cues: Cue[] = [
    { kind: 'music', cue: 'music.lobby' },
    { kind: 'lighting', mood: 'house', seconds: 0 },
    { kind: 'system', animation: 'enter_court', wait: true },
    { kind: 'card', card: 'case-number', text: caseLabel },
    { kind: 'sound', cue: 'stinger.case-open' },
    { kind: 'system', animation: 'case_accepted', wait: true },
    { kind: 'card', card: 'charges-filed' },
  ];
  return { id: 'case-opened', cues, seconds: 4, lineStarts: {} };
}

export function directJurySeated(jurors: number): Show {
  const cues: Cue[] = [{ kind: 'camera', shot: 'close_jury', seconds: 1 }, { kind: 'system', animation: 'jury_seated', wait: true }];
  for (let i = 4; i <= jurors; i++) cues.push({ kind: 'animate', actor: `juror-${i}`, animation: 'react_happy' });
  return { id: 'jury-seated', cues, seconds: 3, lineStarts: {} };
}

/**
 * Ballot committed. Privacy-critical (ANIMATION-GUIDE §6): the ballot enters the
 * box and NO tally or choice is shown. This show takes no choice argument on purpose.
 */
export function directBallotCommitted(): Show {
  return {
    id: 'ballot-committed',
    cues: [
      { kind: 'camera', shot: 'pov_corner', seconds: 0.8 },
      { kind: 'system', animation: 'bond_committed', wait: false },
      { kind: 'system', animation: 'ballot_commit', wait: true },
      { kind: 'sound', cue: 'sfx.box-shut' },
    ],
    seconds: 2,
    lineStarts: {},
  };
}

export function directReveal(): Show {
  return {
    id: 'reveal',
    cues: [
      { kind: 'lighting', mood: 'tense', seconds: 0.6 },
      { kind: 'music', cue: 'music.deliberation' },
      { kind: 'sound', cue: 'sfx.seal-break' },
      { kind: 'system', animation: 'ballot_reveal', wait: true },
      { kind: 'sound', cue: 'stinger.reveal' },
    ],
    seconds: 2,
    lineStarts: {},
  };
}

/** The verdict moment, from the recorded human verdict. Ballot 0 = prosecution bench (GUILTY / SIDE A / FOR). */
export function directVerdict(verdict: Verdict, cast: readonly CastMember[], sentence: CourtLine | null, options: DirectorOptions = {}): Show {
  const cues: Cue[] = [
    { kind: 'music', cue: null },
    { kind: 'camera', shot: 'close_judge', seconds: 1 },
    { kind: 'lighting', mood: 'spotlight', seconds: 0.5 },
    { kind: 'wait', seconds: 0.6 },
  ];
  const winner = verdict.kind === 'ballot-0' ? 'prosecution' : verdict.kind === 'ballot-1' ? 'defense' : null;
  const bench = (mark: 'prosecution' | 'defense') => cast.find((c) => c.mark === mark)?.actor;
  if (winner === null) {
    cues.push(
      { kind: 'system', animation: 'verdict_none', wait: true },
      { kind: 'sound', cue: 'stinger.mistrial' },
      { kind: 'card', card: 'mistrial', text: 'MISTRIAL' },
    );
  } else {
    const guiltyStyle = verdict.label === 'GUILTY';
    cues.push(
      { kind: 'system', animation: winner === 'prosecution' ? 'verdict_guilty' : 'verdict_not_cooked', wait: true },
      { kind: 'sound', cue: guiltyStyle ? 'stinger.verdict-guilty' : verdict.label === 'NOT COOKED' ? 'stinger.verdict-not-cooked' : 'stinger.verdict-side' },
      { kind: 'card', card: 'verdict', text: verdict.label },
    );
    const won = bench(winner);
    const lost = bench(winner === 'prosecution' ? 'defense' : 'prosecution');
    if (won) cues.push({ kind: 'animate', actor: won, animation: 'react_happy' });
    if (lost) cues.push({ kind: 'animate', actor: lost, animation: 'defeated' });
    if (cast.some((c) => c.actor === 'creator')) cues.push({ kind: 'animate', actor: 'creator', animation: winner === 'prosecution' ? 'defeated' : 'react_happy' });
  }
  let seconds = 3.4;
  if (sentence) {
    const say = lineSeconds(sentence.text, options);
    cues.push({ kind: 'camera', shot: 'close_judge', seconds: 0.6 }, { kind: 'sound', cue: 'voice.judge' }, { kind: 'say', actor: 'judge', line: sentence, seconds: say });
    seconds += say;
  }
  cues.push({ kind: 'music', cue: 'music.verdict' }, { kind: 'camera', shot: 'pov_well', seconds: 2 });
  return { id: 'verdict', cues, seconds, lineStarts: sentence ? { [sentence.id]: cues.findIndex((c) => c.kind === 'say') } : {} };
}

export function directSettlement(): Show {
  return {
    id: 'settlement',
    cues: [{ kind: 'system', animation: 'settlement', wait: true }, { kind: 'sound', cue: 'sfx.coin' }, { kind: 'card', card: 'receipt' }],
    seconds: 1.2,
    lineStarts: {},
  };
}

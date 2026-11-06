/**
 * The Solo director: turns a frozen transcript line into a shot (camera, who
 * stands in which pose, a comic callout, screen fx and a sound cue). Pure and
 * deterministic, so the courtroom replays the same show for everyone who
 * watches the case, and tests can pin it.
 */
import type { AudioCueId, Beat, CalloutStyle, CameraShot, CourtLine, LightingMood } from '@cringe-court/core';

/** Who is on the Solo stage. `defendant` is the user's anonymous stand-in (V4 §5, §12). */
export type StageActor = 'judge' | 'prosecutor' | 'defense' | 'defendant';

/** Every pose the Solo stage uses. The web app must ship a cutout for each (tested). */
export const STAGE_POSE_SET = {
  judge: ['idle', 'talking', 'angry', 'shocked'],
  prosecutor: ['idle', 'talking', 'objection', 'angry', 'laughing', 'shocked', 'confused'],
  defense: ['idle_a', 'talking', 'objection', 'laughing', 'shocked', 'confused', 'happy'],
  defendant: ['idle', 'shocked', 'crying', 'happy', 'defeated'],
} as const satisfies Readonly<Record<StageActor, readonly string[]>>;

export type PoseOf<A extends StageActor> = (typeof STAGE_POSE_SET)[A][number];
export type StagePoses = { [A in StageActor]: PoseOf<A> };

/** Portrait expression for the dialogue box. */
export type Mood = 'neutral' | 'smug' | 'shocked' | 'defeated';

export interface Shot {
  line: CourtLine;
  speaker: StageActor;
  camera: CameraShot;
  lighting: LightingMood;
  poses: StagePoses;
  mood: Mood;
  callout: { text: string; style: CalloutStyle } | null;
  fx: 'shake' | 'flash' | 'impact' | null;
  cues: readonly AudioCueId[];
  /** Exhibit on the evidence screen. */
  exhibitId: string | null;
  /** How long the line stays up in auto-play once fully typed (ms). */
  holdMs: number;
}

export const REST_POSES: StagePoses = { judge: 'idle', prosecutor: 'idle', defense: 'idle_a', defendant: 'idle' };

function speakerOf(line: CourtLine): StageActor {
  switch (line.speaker) {
    case 'prosecutor':
      return 'prosecutor';
    case 'defense':
      return 'defense';
    case 'judge':
    case 'narrator':
      return 'judge';
    default:
      // Versus counsel never appear in Solo; treat a stray line as the bench it sits at.
      return line.bench === 0 ? 'prosecutor' : 'defense';
  }
}

const has = (text: string, re: RegExp) => re.test(text);

export function holdFor(text: string): number {
  return Math.min(5200, 1400 + text.length * 28);
}

export function direct(line: CourtLine): Shot {
  const speaker = speakerOf(line);
  const beat: Beat | undefined = line.beat as Beat | undefined;
  const poses: StagePoses = { ...REST_POSES };
  let camera: CameraShot = speaker === 'judge' ? 'close_judge' : speaker === 'prosecutor' ? 'close_prosecution' : 'close_defense';
  let lighting: LightingMood = 'house';
  let mood: Mood = 'neutral';
  let callout: Shot['callout'] = null;
  let fx: Shot['fx'] = null;
  const cues: AudioCueId[] = [];
  const other: 'prosecutor' | 'defense' | null = speaker === 'prosecutor' ? 'defense' : speaker === 'defense' ? 'prosecutor' : null;

  // The speaker talks by default.
  if (speaker !== 'defendant') (poses as Record<StageActor, string>)[speaker] = 'talking';

  switch (beat) {
    case 'gavel':
      cues.push('sfx.gavel');
      fx = 'impact';
      if (has(line.text, /\border\b/i)) callout = { text: 'ORDER!', style: 'order' };
      break;
    case 'desk-slam':
      cues.push('sfx.desk-slam');
      fx = 'shake';
      if (speaker === 'prosecutor') poses.prosecutor = 'angry';
      if (speaker === 'judge') poses.judge = 'angry';
      if (other === 'defense') poses.defense = 'shocked';
      poses.defendant = 'shocked';
      mood = 'shocked';
      break;
    case 'objection':
      cues.push('stinger.objection');
      fx = 'flash';
      callout = { text: 'OBJECTION!', style: 'objection' };
      if (speaker === 'prosecutor') poses.prosecutor = 'objection';
      if (speaker === 'defense') poses.defense = 'objection';
      if (other) (poses as Record<StageActor, string>)[other] = 'shocked';
      lighting = 'spotlight';
      mood = 'smug';
      break;
    case 'point':
      if (speaker === 'prosecutor') poses.prosecutor = 'objection';
      if (speaker === 'defense') poses.defense = 'objection';
      if (has(line.text, /^counter\b/i)) {
        callout = { text: 'COUNTER!', style: 'counter' };
        cues.push('stinger.objection');
        fx = 'flash';
        if (other) (poses as Record<StageActor, string>)[other] = 'shocked';
      }
      break;
    case 'gasp':
      cues.push('sfx.crowd-gasp');
      poses.defendant = 'shocked';
      if (other) (poses as Record<StageActor, string>)[other] = 'shocked';
      mood = 'shocked';
      break;
    case 'laugh':
      cues.push('sfx.crowd-laugh');
      if (speaker === 'prosecutor') poses.prosecutor = 'laughing';
      if (speaker === 'defense') poses.defense = 'laughing';
      if (speaker === 'defense') poses.defendant = 'happy';
      mood = 'smug';
      break;
    case 'smug':
      mood = 'smug';
      if (speaker === 'defense') poses.defense = 'happy';
      break;
    case 'sweat':
      if (speaker === 'prosecutor') poses.prosecutor = 'confused';
      if (speaker === 'defense') poses.defense = 'confused';
      mood = 'shocked';
      break;
    case 'cry':
      poses.defendant = 'crying';
      mood = 'defeated';
      break;
    case 'present-evidence':
      cues.push('sfx.paper');
      break;
    case 'dramatic-pause':
      lighting = 'tense';
      break;
    default:
      break;
  }

  // "Let bro cook" is the defense's catchphrase, whatever the beat.
  if (speaker === 'defense' && !callout && has(line.text, /let (?:bro|him|her|them) cook/i)) {
    callout = { text: 'LET BRO COOK', style: 'let-bro-cook' };
    poses.defendant = 'happy';
  }

  switch (line.segment) {
    case 'call-to-order':
      camera = 'pov_well';
      cues.unshift('stinger.case-open');
      break;
    case 'exhibit':
      camera = 'pov_corner';
      break;
    case 'jury-out':
      camera = 'pov_well';
      lighting = 'tense';
      callout = { text: 'THE JURY IS OUT', style: 'jury-out' };
      cues.push('stinger.jury-out');
      poses.defendant = 'shocked';
      break;
    case 'sentence':
      camera = 'close_judge';
      lighting = 'spotlight';
      break;
    default:
      break;
  }

  return {
    line,
    speaker,
    camera,
    lighting,
    poses,
    mood,
    callout,
    fx,
    cues,
    exhibitId: line.exhibitId ?? null,
    holdMs: holdFor(line.text),
  };
}

/** The whole show, shot by shot. */
export function directAll(lines: readonly CourtLine[]): readonly Shot[] {
  return lines.map(direct);
}

/** Segment titles for the transcript and the chapter rail. */
export const SEGMENT_TITLES: Readonly<Record<CourtLine['segment'], string>> = {
  'call-to-order': 'Call to order',
  opening: 'Opening statements',
  exhibit: 'Evidence',
  rebuttal: 'Rebuttals',
  closing: 'Closing arguments',
  'jury-out': 'The jury is out',
  sentence: 'Sentence',
};

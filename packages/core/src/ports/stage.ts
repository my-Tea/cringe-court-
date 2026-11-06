/**
 * AudioPort and ScenePort: how the engine performs a trial. The engine never
 * touches Web Audio or three.js; it sends cue ids and scene commands. The real
 * adapters are @cringe-court/audio (procedural Web Audio, v3/audio) and
 * @cringe-court/scene (react-three-fiber voxel courtroom). Recording twins live
 * in core/testing.
 */
import type { CharacterId } from '../cast';
import type { Unsubscribe } from './chain';

/* ── Audio ─────────────────────────────────────────────────────────────── */

/**
 * Cue ids. `sfx.*` are one-shots, `stinger.*` are short musical hits on story
 * beats, `music.*` and `amb.*` loop, `ui.*` are interface feedback, `voice.*`
 * are the wordless character babble that plays under dialogue.
 */
export const AUDIO_CUES = [
  'sfx.gavel',
  'sfx.stamp',
  'sfx.coin',
  'sfx.paper',
  'sfx.unlock',
  'sfx.door-creak',
  'sfx.desk-slam',
  'sfx.whoosh',
  'sfx.impact',
  'sfx.crowd-gasp',
  'sfx.crowd-laugh',
  'sfx.crowd-murmur',
  'sfx.ballot-drop',
  'sfx.box-shut',
  'sfx.seal-break',
  'sfx.spotlight',
  'sfx.typewriter',
  'stinger.objection',
  'stinger.case-open',
  'stinger.jury-out',
  'stinger.verdict-guilty',
  'stinger.verdict-not-cooked',
  'stinger.verdict-side',
  'stinger.mistrial',
  'stinger.reveal',
  'music.lobby',
  'music.trial',
  'music.tension',
  'music.deliberation',
  'music.verdict',
  'amb.courtroom',
  'ui.click',
  'ui.hover',
  'ui.toggle',
  'ui.success',
  'ui.error',
  'ui.notify',
  'voice.judge',
  'voice.prosecutor',
  'voice.defense',
  'voice.side-a',
  'voice.side-b',
  'voice.narrator',
] as const;

export type AudioCueId = (typeof AUDIO_CUES)[number];

export type AudioBus = 'master' | 'music' | 'sfx' | 'ui' | 'voice' | 'ambience';

/** animations.json `sound` labels → cue ids. */
export const ANIMATION_SOUND_CUES: Readonly<Record<string, AudioCueId>> = {
  door_creak: 'sfx.door-creak',
  stamp: 'sfx.stamp',
  coin: 'sfx.coin',
  paper: 'sfx.paper',
  unlock: 'sfx.unlock',
  gavel: 'sfx.gavel',
};

export interface PlayOptions {
  /** 0..1, multiplied with the bus volume. */
  volume?: number;
  /** Seconds from now. */
  delay?: number;
  /** -1 (left) .. 1 (right), e.g. the prosecution desk is left. */
  pan?: number;
  /** Small pitch variation so repeats don't sound mechanical. */
  detune?: number;
}

export interface AudioHandle {
  stop(fadeSeconds?: number): void;
}

export interface AudioPort {
  readonly id: 'web-audio' | 'silent' | 'recording';
  /** Resume the audio context (must follow a user gesture in browsers). */
  unlock(): Promise<void>;
  play(cue: AudioCueId, options?: PlayOptions): AudioHandle;
  /** Start (or keep) a loop; starting another loop on the same bus crossfades. */
  loop(cue: AudioCueId, options?: PlayOptions & { fadeSeconds?: number }): AudioHandle;
  setVolume(bus: AudioBus, volume: number): void;
  setMuted(muted: boolean): void;
  stopAll(fadeSeconds?: number): void;
}

/* ── Scene ─────────────────────────────────────────────────────────────── */

/** Camera presets from cc-art/dist/scene/courtroom.layout.json, plus engine close-ups. */
export type CameraShot =
  | 'pov_entrance'
  | 'pov_well'
  | 'pov_corner'
  | 'pov_corner_r'
  | 'pov_bench'
  | 'pov_gallery'
  | 'close_judge'
  | 'close_prosecution'
  | 'close_defense'
  | 'close_jury'
  | 'close_witness';

/** Where an actor stands (ANIMATION-GUIDE §7 positions). */
export type StageMark =
  | 'bench'
  | 'prosecution'
  | 'defense'
  | 'witness'
  | 'jury-1'
  | 'jury-2'
  | 'jury-3'
  | 'jury-4'
  | 'jury-5'
  | 'jury-6'
  | 'jury-7'
  | 'bailiff'
  | 'clerk'
  | 'gallery-1'
  | 'gallery-2'
  | 'gallery-3'
  | 'gallery-4';

export interface CastMember {
  /** Unique per scene: "judge", "juror-3". */
  actor: string;
  character: CharacterId;
  mark: StageMark;
}

/** animations.json system animation ids. */
export type SystemAnimationId =
  | 'enter_court'
  | 'case_accepted'
  | 'jury_seated'
  | 'bond_committed'
  | 'ballot_commit'
  | 'ballot_reveal'
  | 'verdict_guilty'
  | 'verdict_not_cooked'
  | 'verdict_none'
  | 'settlement';

export type LightingMood = 'house' | 'spotlight' | 'tense' | 'guilty' | 'acquitted' | 'mistrial' | 'blackout';

export type CalloutStyle = 'objection' | 'order' | 'counter' | 'let-bro-cook' | 'jury-out' | 'verdict';

export type PropState = { prop: 'ballot_box'; state: 'sealed' | 'open' } | { prop: 'evidence_screen'; state: 'off' | 'on'; exhibitId?: string };

/** Scene-level signals the renderer sends back (system animation `action`s, end of a one-shot). */
export type SceneSignal =
  | { type: 'ready' }
  | { type: 'action'; animation: SystemAnimationId; action: string; sound?: string }
  | { type: 'animation-end'; actor: string; animation: string }
  /** A callout to draw over the scene (from ScenePort.callout or an animation's `callout`). */
  | { type: 'callout'; text: string; style: CalloutStyle; actor?: string }
  /** Screen-space effects the UI overlay draws (flash). */
  | { type: 'overlay'; effect: 'flash' | 'impact'; color?: string }
  | { type: 'error'; message: string };

export interface ScenePort {
  readonly id: 'three' | 'recording' | 'headless';
  ready(): Promise<void>;
  setCast(cast: readonly CastMember[]): void;
  /** Cut (0) or move the camera over `seconds`. */
  camera(shot: CameraShot, seconds?: number): void;
  /** Play an animations.json character animation; resolves when a one-shot ends (loops resolve at once). */
  animate(actor: string, animation: string): Promise<void>;
  /** Play a system animation; resolves at its end. */
  system(animation: SystemAnimationId): Promise<void>;
  lighting(mood: LightingMood, seconds?: number): void;
  /** Comic-burst callout text, rendered by the UI layer over the scene. */
  callout(text: string, style: CalloutStyle): void;
  prop(state: PropState): void;
  /** Screen shake / flash etc. (animations.json fx names). */
  fx(effect: 'shake' | 'flash' | 'impact' | 'sweat' | 'tears', actor?: string): void;
  subscribe(listener: (signal: SceneSignal) => void): Unsubscribe;
}

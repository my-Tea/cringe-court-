/**
 * Roam: the first-person, walkable voxel courtroom. Everything in this file is
 * renderer-free data; the three.js renderer and the React HUD only read it.
 *
 * Units are courtroom world units (a cast member is ~63 tall). +Y is up, the
 * judge's bench is at −Z, the gallery and the lobby are at +Z.
 */
import type { AudioCueId, CalloutStyle, LightingMood } from '@cringe-court/core';
import type { Box } from '../courtroom/geometry';
import type { HearingPace } from './pace';

export type Vec3 = readonly [number, number, number];

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

/* ── World ──────────────────────────────────────────────────────────────── */

export type ZoneId = 'lobby' | 'gallery' | 'aisle' | 'well' | 'dais' | 'defendant-table' | 'prosecution-table' | 'witness-stand' | 'doorway' | 'jury-box';

export interface Zone {
  id: ZoneId;
  label: string;
  /** XZ rectangles (y ignored). The first zone that contains the player wins. */
  rects: ReadonlyArray<{ x0: number; z0: number; x1: number; z1: number }>;
}

export type SeatId = 'defendant' | 'prosecution' | 'witness' | 'jury-box' | 'gallery-left' | 'gallery-right' | 'lobby-bench';

export interface Seat {
  id: SeatId;
  label: string;
  /** Feet position while seated. */
  pos: Vec3;
  /** Eye height above `pos[1]` while seated. */
  eye: number;
  yaw: number;
  /** Where the player stands when getting up. */
  exit: Vec3;
  /** Standing spots (the witness stand) keep standing eye height. */
  standing?: boolean;
  /** Camera pitch on sitting down (default level). */
  pitch?: number;
}

export type SpawnId = 'lobby' | 'doorway' | 'aisle' | 'well' | 'defendant' | 'prosecution' | 'witness' | 'jury-box' | 'jury-view' | 'bench-front';

export interface Spawn {
  pos: Vec3;
  yaw: number;
  pitch: number;
}

export type InteractionKind = 'seat' | 'talk' | 'exhibit' | 'inspect' | 'door';

export interface InteractableSpec {
  id: string;
  /** Verb phrase after "E: ", e.g. "Take the stand". */
  prompt: string;
  kind: InteractionKind;
  /** Focus point (eye-level target) and the solid it outlines. */
  at: Vec3;
  hull: Aabb;
  /** Max distance from the eye to `at`. */
  range: number;
  seat?: SeatId;
  npc?: string;
  exhibit?: string;
  /** Bark pool for talk/inspect/door. */
  lines?: string;
}

export type NpcPose = 'stand' | 'sit' | 'talk' | 'gavel' | 'point' | 'cheer' | 'shock' | 'facepalm';

export type NpcRole = 'judge' | 'prosecutor' | 'defense' | 'bailiff' | 'clerk' | 'juror' | 'gallery' | 'guard';

export interface NpcSpec {
  id: string;
  name: string;
  role: NpcRole;
  /** Model id in cast.json. */
  model: string;
  pos: Vec3;
  yaw: number;
  seated: boolean;
  /** Collision radius; 0 for NPCs the player can't reach anyway. */
  radius: number;
  /** Bark pool id (dialogue.ts). */
  lines: string;
  /** Jurors: seat in the jury box, 0–2 front row (filled first), 3–6 raised back row. */
  jurySlot?: number;
}

export interface RoamWorld {
  /** Visual boxes (palette colours), courtroom + lobby. */
  boxes: readonly Box[];
  /** Collision boxes: the solid subset of `boxes` plus invisible barriers. */
  solids: readonly Aabb[];
  /** Hard outer limits per room (the player can never leave their union). */
  rooms: ReadonlyArray<{ id: 'courtroom' | 'lobby' | 'doorway'; bounds: Aabb }>;
  zones: readonly Zone[];
  seats: Readonly<Record<SeatId, Seat>>;
  spawns: Readonly<Record<SpawnId, Spawn>>;
  interactables: readonly InteractableSpec[];
  npcs: readonly NpcSpec[];
  /** Named look targets for cinematics. */
  marks: Readonly<Record<string, Vec3>>;
  /** Light positions (sconces, windows) for the renderer. */
  lights: ReadonlyArray<{ pos: Vec3; kind: 'sconce' | 'window' | 'spot' }>;
}

/* ── Player ─────────────────────────────────────────────────────────────── */

/** A voxel avatar: a cast.json model id plus a display name. */
export interface AvatarSpec {
  model: string;
  name: string;
}

export type PlayerRole = 'defendant' | 'side-a' | 'side-b' | 'juror' | 'spectator';

/**
 * The networkable player state. Mode 2 (two people) and Mode 3 (public gallery)
 * send exactly this per player; everything else is derived.
 */
export interface PlayerState {
  id: string;
  avatar: AvatarSpec;
  role: PlayerRole;
  /** Feet position. */
  pos: Vec3;
  /** Radians; 0 looks toward −Z (the bench). */
  yaw: number;
  pitch: number;
  seat: SeatId | null;
  /** Horizontal speed (world units/s), drives the walk cycle. */
  speed: number;
  /** ms timestamp of the sample (for interpolation). */
  t: number;
}

/* ── Control & beats ────────────────────────────────────────────────────── */

/** free: walk + look · look: look only (seated / verdict) · cinematic: camera owned by a beat. */
export type ControlMode = 'free' | 'look' | 'cinematic';

export type BeatId = 'all-rise' | 'opening' | 'counsel-arguing' | 'jury-deliberating' | 'verdict';

export const BEAT_IDS: readonly BeatId[] = ['all-rise', 'opening', 'counsel-arguing', 'jury-deliberating', 'verdict'];

export type VerdictKind = 'guilty' | 'not-cooked' | 'side-a' | 'side-b' | 'mistrial';

export interface DialogueLine {
  /** NPC id, or 'player'. */
  speaker: string;
  text: string;
}

export type BeatStep =
  | { kind: 'seat'; seat: SeatId }
  | { kind: 'stand' }
  | { kind: 'control'; mode: ControlMode }
  | { kind: 'look'; at: string | Vec3; seconds?: number }
  | { kind: 'say'; speaker: string; text: string; seconds?: number; pose?: NpcPose }
  | { kind: 'pose'; npc: string | 'jury' | 'gallery' | 'all'; pose: NpcPose }
  | { kind: 'gavel' }
  | { kind: 'cue'; cue: AudioCueId }
  | { kind: 'mood'; mood: LightingMood }
  | { kind: 'callout'; text: string; style: CalloutStyle }
  | { kind: 'wait'; seconds: number };

export interface BeatOptions {
  /** Replace the built-in dialogue (modes feed AI counsel lines here). */
  lines?: readonly DialogueLine[];
  /** Where the player sits for the beat. The controller fills it from the player's role. */
  seat?: SeatId;
  /** True when the player is a party (defendant, Side A, Side B): parties rise for the verdict. Default true. */
  party?: boolean;
  /** Hearing pace (pace.ts). The controller fills it from its current pace. */
  pace?: HearingPace;
  verdict?: VerdictKind;
  /** Verdict headline override, e.g. "SIDE A WINS". */
  verdictText?: string;
}

/* ── Snapshots & events ─────────────────────────────────────────────────── */

export interface DialogueState {
  speaker: string;
  name: string;
  text: string;
  /** Characters revealed so far (typewriter; equals text.length with reduced motion). */
  shown: number;
  /** Seconds the line stays up after it is fully shown. */
  hold: number;
}

export interface NpcState {
  id: string;
  pose: NpcPose;
  /** Head yaw/pitch relative to the body, radians (clamped). */
  headYaw: number;
  headPitch: number;
  /** Body yaw (NPCs turn their whole body only in cinematics). */
  yaw: number;
  talking: boolean;
  /** Not in this hearing (an empty jury seat, or the seat the player took). The renderer hides it. */
  hidden?: boolean;
}

export interface RoamSnapshot {
  player: PlayerState;
  eye: Vec3;
  control: ControlMode;
  paused: boolean;
  zone: ZoneId | null;
  focus: { id: string; prompt: string } | null;
  dialogue: DialogueState | null;
  beat: { id: BeatId; step: number; steps: number } | null;
  exhibit: string | null;
  callout: { text: string; style: CalloutStyle; age: number } | null;
  mood: LightingMood;
  /** 0..1 screen-shake amount (always 0 with reduced motion). */
  shake: number;
  /** Head-bob offset in world units (always 0 with reduced motion). */
  bob: number;
  npcs: readonly NpcState[];
  remotes: readonly PlayerState[];
  reducedMotion: boolean;
  pace: HearingPace;
  /** Beats and dialogue play FAST_FORWARD× faster. */
  fastForward: boolean;
  /** Monotonic counter; bumps whenever the snapshot changes. */
  version: number;
}

export type RoamEvent =
  | { type: 'focus'; id: string | null }
  | { type: 'interact'; id: string }
  | { type: 'zone'; zone: ZoneId | null }
  | { type: 'seat'; seat: SeatId | null }
  | { type: 'dialogue'; line: DialogueLine | null }
  | { type: 'exhibit'; id: string | null }
  | { type: 'beat-start'; beat: BeatId }
  | { type: 'beat-end'; beat: BeatId; skipped: boolean }
  | { type: 'gavel' }
  | { type: 'cue'; cue: AudioCueId }
  | { type: 'mood'; mood: LightingMood }
  | { type: 'callout'; text: string; style: CalloutStyle }
  | { type: 'pause'; paused: boolean };

export type Unsubscribe = () => void;

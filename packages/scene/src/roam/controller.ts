/**
 * RoamController: the headless first-person courtroom. Owns the player body,
 * input, focus, seats, dialogue, exhibits, trial beats, NPC attention and
 * remote players. No DOM, no three.js: the renderer reads `view()` each frame
 * and the HUD reads `snapshot()` when `onChange` fires.
 */
import type { AudioCueId, CalloutStyle, LightingMood } from '@cringe-court/core';
import { detectAudio, type RoamAudio } from './audio';
import { BeatRunner, beatScript, type BeatHost } from './beats';
import { BarkBook } from './dialogue';
import { clampPitch, KeyState, mergeIntents, type RoamAction } from './input';
import { lookDir, selectFocus } from './interact';
import { initialNpcState, updateNpcHead } from './npc';
import { DEFAULT_PACE, FAST_FORWARD, HEARING_PACE, holdSeconds, type HearingPace, type PaceSpec } from './pace';
import { BODY, FixedStepper, NO_MOVE, SolidIndex, stepBody, type BodyState, type MoveIntent } from './physics';
import { RemoteInterpolator, type RemotePlayerFeed } from './remote';
import type {
  AvatarSpec,
  BeatId,
  BeatOptions,
  BeatStep,
  ControlMode,
  DialogueLine,
  DialogueState,
  GateId,
  InteractableSpec,
  NpcPose,
  NpcSpec,
  NpcState,
  PanelId,
  PlayerRole,
  PlayerState,
  RoamEvent,
  RoamSnapshot,
  RoamWorld,
  Seat,
  SeatId,
  Spawn,
  SpawnId,
  Unsubscribe,
  Vec3,
  ZoneId,
} from './types';
import type { PerspectiveChoice } from './perspective';
import { PLAYER_JURY_SLOT, zoneAt } from './world';

export interface RoamControllerOptions {
  reducedMotion?: boolean;
  /** Anything with play(cue): core AudioPort, or the @cringe-court/audio engine. */
  audio?: unknown;
  id?: string;
  avatar?: AvatarSpec;
  role?: PlayerRole;
  spawn?: SpawnId | Spawn;
  remotes?: RemotePlayerFeed;
  /** Clock for PlayerState.t (ms). Defaults to the controller's own simulated clock. */
  now?: () => number;
  /** Hearing pace (pace.ts). Default 'standard'. */
  pace?: HearingPace;
  /** Jurors in this hearing, the player included when they are one (Solo and Versus 3, Grand Jury 7). Default 7: a full box. */
  jurors?: number;
  /** Arrival-run seals already open. Default all: a world entered past the run has none in the way. */
  openGates?: readonly GateId[] | 'all';
  /**
   * Something draws the arrival-run panels. Default false: a room with no such
   * host (the sandbox, a hearing) ignores stations, or E would open a panel
   * nobody shows and hold the player still.
   */
  stations?: boolean;
}

/** Where each role sits during the hearing. */
export const ROLE_SEAT: Readonly<Record<PlayerRole, SeatId>> = {
  defendant: 'defendant',
  'side-a': 'prosecution',
  'side-b': 'defendant',
  juror: 'jury-box',
  spectator: 'gallery-left',
};

/** Parties rise for the verdict; jurors and spectators watch. */
export function isParty(role: PlayerRole): boolean {
  return role === 'defendant' || role === 'side-a' || role === 'side-b';
}



/** Characters per second for the dialogue typewriter at full pace (see pace.ts for the others). */
export const TYPE_SPEED = HEARING_PACE.full.typeSpeed;
export const CALLOUT_SECONDS = 2.4;
/** Punchier lifetimes for counsel / bench callouts. */
const CALLOUT_LIFE: Readonly<Partial<Record<CalloutStyle, number>>> = {
  objection: 2.6,
  counter: 2.2,
  order: 2.2,
  verdict: CALLOUT_SECONDS * 2.5,
  'jury-out': 2.8,
  'let-bro-cook': 2.2,
};
const CAMERA_EASE = 5;

/** Babble cue per dialogue speaker (jurors stay quiet). */
const VOICE_CUE: Readonly<Record<string, AudioCueId>> = {
  judge: 'voice.judge',
  prosecutor: 'voice.prosecutor',
  defense: 'voice.defense',
  clerk: 'voice.clerk',
  'side-a': 'voice.side-a',
  'side-b': 'voice.side-b',
  narrator: 'voice.narrator',
  bailiff: 'voice.narrator',
};

const VOICE_PAN: Readonly<Record<string, number>> = {
  prosecutor: -0.55,
  defense: 0.55,
  'side-a': -0.5,
  'side-b': 0.5,
  clerk: 0.2,
  bailiff: -0.25,
  judge: 0,
  narrator: -0.1,
};

const SPEAKER_ROLE: Readonly<Record<string, string>> = {
  judge: 'The Bench',
  prosecutor: 'Prosecution',
  defense: 'Defense',
  clerk: 'Court Clerk',
  bailiff: 'Bailiff',
  narrator: 'Narrator',
  player: 'You',
};

export interface CameraView {
  eye: Vec3;
  yaw: number;
  pitch: number;
  /** Screen-shake offsets in radians (0 with reduced motion). */
  shakeYaw: number;
  shakePitch: number;
  /**
   * Head the beat is framing, or null when the player owns the camera.
   * The renderer dollies in on this point so every speaker reads the same size.
   */
  subject: Vec3 | null;
}

interface ExternalInput {
  intent: MoveIntent;
  turn: number;
  tilt: number;
}

export class RoamController implements BeatHost {
  readonly world: RoamWorld;
  readonly keys = new KeyState();
  #index: SolidIndex;
  readonly #bounds;
  readonly #stepper = new FixedStepper();
  readonly #barks = new BarkBook();
  readonly #listeners = new Set<(e: RoamEvent) => void>();
  readonly #change = new Set<() => void>();
  readonly #npcs: NpcState[];
  readonly #npcHeads: Map<string, Vec3>;
  readonly #interp = new RemoteInterpolator();
  readonly #unsubs: Unsubscribe[] = [];
  readonly #external = new Map<string, ExternalInput>();
  readonly #audio: RoamAudio | null;
  readonly #remoteFeed: RemotePlayerFeed | undefined;
  readonly #now: (() => number) | undefined;

  #body: BodyState;
  #prev: [number, number, number];
  #alpha = 0;
  #yaw: number;
  #pitch: number;
  #seat: Seat | null = null;
  #control: ControlMode = 'free';
  #paused = false;
  #reduced: boolean;
  #zone: ZoneId | null = null;
  #focus: InteractableSpec | null = null;
  #dialogue: (DialogueState & { npc: string | null }) | null = null;
  #exhibit: string | null = null;
  #callout: { text: string; style: CalloutStyle; age: number; id: number } | null = null;
  #calloutSeq = 0;
  /** Seconds until the next babble while a line is still typing out. */
  #voiceCool = 0;
  #mood: LightingMood = 'house';
  #shake = 0;
  #bobPhase = 0;
  #bob = 0;
  #time = 0;
  #version = 0;
  #look: { target: Vec3 } | null = null;
  #beat: { runner: BeatRunner; resolve: () => void } | null = null;
  /** Street doors open once the hearing has finished. */
  #adjourned = false;
  /** First person until the view asks for auto, which is third person. */
  #perspective: PerspectiveChoice = 'first';
  #remotes: PlayerState[] = [];
  #jumpQueued = false;
  #speed = 0;
  #pace: HearingPace;
  #fast = false;
  readonly #specs: ReadonlyMap<string, NpcSpec>;
  readonly #jurors: number;

  readonly id: string;
  #avatar: AvatarSpec;
  readonly role: PlayerRole;
  /** Arrival-run panel open (host-drawn); movement and look are held meanwhile. */
  #panel: PanelId | null = null;
  readonly #openGates: Set<GateId>;
  readonly #stations: boolean;

  constructor(world: RoamWorld, options: RoamControllerOptions = {}) {
    this.world = world;
    this.#stations = options.stations ?? false;
    const gateIds = (world.gates ?? []).map((g) => g.id);
    this.#openGates = new Set(options.openGates === undefined || options.openGates === 'all' ? gateIds : options.openGates);
    this.#index = this.#buildIndex();
    this.#bounds = world.rooms.map((r) => r.bounds);
    this.#reduced = options.reducedMotion ?? false;
    this.#audio = detectAudio(options.audio);
    this.id = options.id ?? 'local';
    this.#avatar = options.avatar ?? { model: 'defendant', name: 'You' };
    this.role = options.role ?? 'defendant';
    this.#now = options.now;
    const spawn = typeof options.spawn === 'object' ? options.spawn : world.spawns[options.spawn ?? 'lobby'];
    this.#body = { pos: [...spawn.pos], vel: [0, 0, 0], onGround: true };
    this.#prev = [...spawn.pos];
    this.#yaw = spawn.yaw;
    this.#pitch = spawn.pitch;
    this.#pace = options.pace ?? DEFAULT_PACE;
    this.#jurors = Math.max(0, Math.min(options.jurors ?? 7, world.npcs.filter((n) => n.role === 'juror').length + (this.role === 'juror' ? 1 : 0)));
    this.#specs = new Map(world.npcs.map((n) => [n.id, n]));
    this.#npcs = world.npcs.map((n) => ({ ...initialNpcState(n), ...(this.#absent(n) ? { hidden: true } : {}) }));
    this.#npcHeads = new Map(world.npcs.map((n) => [n.id, world.marks[n.id] ?? [n.pos[0], n.pos[1] + 50, n.pos[2]]]));
    this.#remoteFeed = options.remotes;
    if (options.remotes) {
      this.#unsubs.push(options.remotes.subscribe((s) => this.#interp.push(s.filter((p) => p.id !== this.id))));
      if (options.remotes.onLeave) this.#unsubs.push(options.remotes.onLeave((id) => this.#interp.remove(id)));
    }
    this.#zone = zoneAt(world, spawn.pos[0], spawn.pos[2])?.id ?? null;
  }

  /** Static solids plus every seal that is still closed. */
  #buildIndex(): SolidIndex {
    const closed = (this.world.gates ?? []).filter((g) => !this.#openGates.has(g.id)).map((g) => g.solid);
    return new SolidIndex(closed.length ? [...this.world.solids, ...closed] : this.world.solids);
  }

  /* ── Arrival run ───────────────────────────────────────────────────── */

  get avatar(): AvatarSpec {
    return this.#avatar;
  }

  /** Change how the player looks (the wardrobe previews every click). */
  setAvatar(avatar: AvatarSpec): void {
    this.#avatar = avatar;
    this.#emit({ type: 'avatar', avatar });
    this.#changed();
  }

  get panel(): PanelId | null {
    return this.#panel;
  }

  /** Close the station panel the host was showing and give the player back control. */
  closePanel(): void {
    if (!this.#panel) return;
    this.#panel = null;
    this.keys.clear();
    this.#emit({ type: 'panel', panel: null });
    this.#changed();
  }

  isGateOpen(id: GateId): boolean {
    return this.#openGates.has(id);
  }

  get openGates(): readonly GateId[] {
    return [...this.#openGates];
  }

  /** Lift a seal: its bridge becomes walkable and its glow goes out. */
  openGate(id: GateId): void {
    if (this.#openGates.has(id) || !this.world.gates?.some((g) => g.id === id)) return;
    this.#openGates.add(id);
    this.#index = this.#buildIndex();
    this.#cue('sfx.unlock');
    this.#emit({ type: 'gate', gate: id });
    this.#changed();
  }

  /** Jurors past the hearing's jury size, and the seat a player juror takes, stay empty. */
  #absent(n: NpcSpec): boolean {
    if (n.role !== 'juror' || n.jurySlot === undefined) return false;
    // Slots fill front row first (0–2), then the raised back row (3–6).
    return n.jurySlot >= this.#jurors || (this.role === 'juror' && n.jurySlot === PLAYER_JURY_SLOT);
  }

  /** Whoever sits in the jury box's player seat takes it from the NPC juror there. */
  #syncJuryBox(): void {
    const inBox = this.#seat?.id === 'jury-box';
    for (const s of this.#npcs) {
      const spec = this.#specs.get(s.id)!;
      if (spec.jurySlot === PLAYER_JURY_SLOT) s.hidden = inBox || this.#absent(spec) || undefined;
    }
  }

  /* ── Pace ──────────────────────────────────────────────────────────── */

  get pace(): HearingPace {
    return this.#pace;
  }

  /** Change the pace; line selection applies from the next beat, timing at once. */
  setPace(pace: HearingPace): void {
    if (pace === this.#pace) return;
    this.#pace = pace;
    this.#changed();
  }

  get fastForward(): boolean {
    return this.#fast;
  }

  /** Play beats and dialogue FAST_FORWARD× faster (walking and looking are unaffected). */
  setFastForward(on: boolean): void {
    if (on === this.#fast) return;
    this.#fast = on;
    this.#changed();
  }

  /** BeatHost */
  paceSpec(): PaceSpec {
    return HEARING_PACE[this.#pace];
  }

  /** Where this player sits during the hearing. */
  get homeSeat(): SeatId {
    return ROLE_SEAT[this.role];
  }

  /* ── Events ────────────────────────────────────────────────────────── */

  subscribe(listener: (e: RoamEvent) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Fires when anything the HUD shows changes (not every frame). */
  onChange(listener: () => void): Unsubscribe {
    this.#change.add(listener);
    return () => this.#change.delete(listener);
  }

  #emit(e: RoamEvent): void {
    for (const l of this.#listeners) l(e);
  }

  #changed(): void {
    this.#version++;
    for (const l of this.#change) l();
  }

  #cue(cue: AudioCueId, pan?: number): void {
    this.#emit({ type: 'cue', cue });
    try {
      this.#audio?.play(cue, pan === undefined ? undefined : { pan });
    } catch {
      /* sound is decoration: never break the room over it */
    }
  }

  /* ── Input ─────────────────────────────────────────────────────────── */

  /** Returns true when the key is bound (so the host can preventDefault). */
  keyDown(code: string, repeat = false): boolean {
    const action = this.keys.down(code, repeat);
    if (!action) return false;
    this.#onAction(action);
    return true;
  }

  keyUp(code: string): void {
    this.keys.up(code);
  }

  /** Touch/gamepad sources set their own intent; strongest axis wins. Pass null to release. */
  setExternalInput(source: string, input: Partial<ExternalInput> | null): void {
    if (!input) this.#external.delete(source);
    else this.#external.set(source, { intent: input.intent ?? NO_MOVE, turn: input.turn ?? 0, tilt: input.tilt ?? 0 });
  }

  /** Relative look (radians): mouse, touch drag. */
  look(dYaw: number, dPitch: number): void {
    if (this.#paused || this.#control === 'cinematic' || this.#exhibit || this.#panel) return;
    this.#yaw += dYaw;
    this.#pitch = clampPitch(this.#pitch + dPitch);
  }

  #onAction(a: RoamAction): void {
    switch (a) {
      case 'interact':
        this.interact();
        break;
      case 'pause':
        if (this.#exhibit) this.closeExhibit();
        else if (this.#panel) this.closePanel();
        else this.setPaused(!this.#paused);
        break;
      case 'jump':
        this.jump();
        break;
      case 'skip':
        if (this.#dialogue) this.advanceDialogue();
        break;
      default:
        if (this.#seat && !this.#beat && (a === 'forward' || a === 'back' || a === 'left' || a === 'right')) this.stand();
    }
  }

  jump(): void {
    if (this.#paused || this.#control !== 'free' || this.#seat) return;
    this.#jumpQueued = true;
  }

  setPaused(paused: boolean): void {
    if (this.#paused === paused) return;
    this.#paused = paused;
    if (paused) this.keys.clear();
    this.#emit({ type: 'pause', paused });
    this.#changed();
  }

  get paused(): boolean {
    return this.#paused;
  }

  setReducedMotion(reduced: boolean): void {
    this.#reduced = reduced;
    if (reduced) {
      this.#shake = 0;
      this.#bob = 0;
    }
    this.#changed();
  }

  /** E / tap: the focused thing, else (seated) stand up, else advance dialogue. */
  interact(): string | null {
    if (this.#paused || this.#panel) return null;
    if (this.#exhibit) {
      this.closeExhibit();
      return null;
    }
    if (this.#dialogue && (this.#beat || this.#dialogue.shown < this.#dialogue.text.length)) {
      this.advanceDialogue();
      return null;
    }
    if (this.#control === 'cinematic') return null;
    if (this.#seat && !this.#beat) {
      this.stand();
      return 'stand';
    }
    const f = this.#focus;
    if (!f) {
      if (this.#dialogue) this.#setDialogue(null);
      return null;
    }
    this.#emit({ type: 'interact', id: f.id });
    switch (f.kind) {
      case 'seat':
        if (f.seat) this.sit(f.seat);
        break;
      case 'exhibit':
        this.#exhibit = f.exhibit ?? f.id;
        this.keys.clear();
        this.#cue('sfx.paper');
        this.#emit({ type: 'exhibit', id: this.#exhibit });
        break;
      case 'talk': {
        const line = this.#barks.next(f.lines ?? f.npc ?? '');
        if (line) this.#setDialogue({ speaker: f.npc ?? 'judge', text: line });
        if (f.npc === 'judge' && line) this.#gavel(0.35);
        break;
      }
      case 'door':
        this.#cue('sfx.door-creak');
        this.#shakeBy(0.2);
        if (f.id === 'street-doors' && this.#adjourned) {
          this.#setDialogue(null);
          this.teleport('outside');
          break;
        }
        if (f.gate && !this.#openGates.has(f.gate)) {
          const line = this.#barks.next(f.lines ?? '');
          if (line) this.#setDialogue({ speaker: 'narrator', text: line });
          break;
        }
        if (f.id === 'return-inside') {
          this.#setDialogue(null);
          this.teleport('lobby');
          break;
        }
        {
          const line = this.#barks.next(f.lines ?? '');
          if (line) this.#setDialogue({ speaker: 'narrator', text: line });
        }
        break;
      case 'station': {
        const station = f.station;
        if (!station) break;
        this.#panel = station === 'verify' ? 'verify' : station === 'wardrobe' ? 'wardrobe' : 'trials';
        this.keys.clear();
        this.#setDialogue(null);
        this.#cue('ui.notify');
        this.#emit({ type: 'station', station });
        this.#emit({ type: 'panel', panel: this.#panel });
        break;
      }
      case 'inspect': {
        const line = this.#barks.next(f.lines ?? f.id);
        if (line) this.#setDialogue({ speaker: 'narrator', text: line });
        if (f.id === 'desk-bell') this.#cue('ui.notify');
        break;
      }
    }
    this.#changed();
    return f.id;
  }

  closeExhibit(): void {
    if (!this.#exhibit) return;
    this.#exhibit = null;
    this.#emit({ type: 'exhibit', id: null });
    this.#changed();
  }

  /** Finish the typewriter, or (fully shown) dismiss the line. */
  advanceDialogue(): void {
    const d = this.#dialogue;
    if (!d) return;
    if (d.shown < d.text.length) d.shown = d.text.length;
    else d.hold = 0;
    if (!this.#beat && d.shown >= d.text.length && d.hold <= 0) this.#setDialogue(null);
    this.#changed();
  }

  /* ── Seats & movement ──────────────────────────────────────────────── */

  sit(id: SeatId): void {
    const seat = this.world.seats[id];
    if (!seat) return;
    this.#seat = seat;
    this.#body.pos = [...seat.pos];
    this.#body.vel = [0, 0, 0];
    this.#body.onGround = true;
    this.#prev = [...seat.pos];
    this.#yaw = seat.yaw;
    this.#pitch = seat.pitch ?? 0;
    if (this.#control === 'free') this.#control = 'look';
    this.keys.clear();
    this.#syncJuryBox();
    this.#emit({ type: 'seat', seat: id });
    this.#updateZone();
    this.#changed();
  }

  stand(): void {
    if (!this.#seat) return;
    const exit = this.#seat.exit;
    this.#seat = null;
    this.#syncJuryBox();
    this.#body.pos = [...exit];
    this.#prev = [...exit];
    this.#body.vel = [0, 0, 0];
    if (this.#control === 'look' && !this.#beat) this.#control = 'free';
    this.#emit({ type: 'seat', seat: null });
    this.#updateZone();
    this.#changed();
  }

  /** Set the lighting mood directly (beats also set it). */
  setMood(mood: LightingMood): void {
    if (mood === this.#mood) return;
    this.#mood = mood;
    this.#emit({ type: 'mood', mood });
    this.#changed();
  }

  teleport(to: SpawnId | Spawn): void {
    const s = typeof to === 'string' ? this.world.spawns[to] : to;
    // Moving rooms drops whatever was on screen.
    this.#callout = null;
    if (!this.#beat) this.#setDialogue(null);
    if (this.#seat) {
      this.#seat = null;
      this.#syncJuryBox();
      this.#emit({ type: 'seat', seat: null });
    }
    this.#body = { pos: [...s.pos], vel: [0, 0, 0], onGround: true };
    this.#prev = [...s.pos];
    this.#yaw = s.yaw;
    this.#pitch = s.pitch;
    if (!this.#beat) this.#control = 'free';
    this.#updateZone();
    this.#changed();
  }

  /* ── Beats ─────────────────────────────────────────────────────────── */

  /** Play a scripted trial beat. Resolves when it ends (or is skipped / replaced). */
  runBeat(id: BeatId, options: BeatOptions = {}): Promise<void> {
    this.skipBeat();
    this.closeExhibit();
    return new Promise<void>((resolve) => {
      const runner = new BeatRunner(id, beatScript(id, { seat: this.homeSeat, party: isParty(this.role), pace: this.#pace, ...options }), this);
      this.#beat = { runner, resolve };
      this.#emit({ type: 'beat-start', beat: id });
      runner.start();
      this.#changed();
    });
  }

  skipBeat(): void {
    const b = this.#beat;
    if (!b) return;
    b.runner.skip();
    this.#endBeat(true);
  }

  #endBeat(skipped: boolean): void {
    const b = this.#beat;
    if (!b) return;
    this.#beat = null;
    this.#look = null;
    for (const n of this.#npcs) n.talking = false;
    // A line that has finished its hold leaves with its beat, so it never opens the next one.
    if (this.#dialogue && !this.dialogueBusy()) this.#setDialogue(null);
    if (this.#control === 'cinematic') this.#control = this.#seat ? 'look' : 'free';
    const beatId = b.runner.id;
    this.#emit({ type: 'beat-end', beat: beatId, skipped });
    if (beatId === 'verdict') this.adjourn();
    b.resolve();
    this.#changed();
  }

  /** The hearing is over: the street doors open onto the steps. */
  adjourn(): void {
    if (this.#adjourned) return;
    this.#adjourned = true;
    this.#changed();
  }

  /** A replay starts the hearing again and bars the street doors. */
  reconvene(): void {
    if (!this.#adjourned) return;
    this.#adjourned = false;
    if (this.#zone === 'outside') this.teleport('lobby');
    this.#changed();
  }

  /** BeatHost */
  apply(step: BeatStep): void {
    switch (step.kind) {
      case 'seat':
        this.sit(step.seat);
        break;
      case 'stand': {
        // Rise in place at the defendant's table: standing eye, no walking away.
        if (this.#seat) {
          const s = this.#seat;
          this.#seat = { ...s, eye: BODY.eye, standing: true, id: s.id };
          this.#changed();
        }
        break;
      }
      case 'control':
        this.#control = step.mode;
        if (step.mode !== 'cinematic') this.#look = null;
        this.#changed();
        break;
      case 'look':
        this.#look = { target: this.#resolveTarget(step.at) };
        break;
      case 'say':
        this.#setDialogue({ speaker: step.speaker, text: step.text });
        if (step.pose) {
          this.#pose(step.speaker, step.pose);
          if (step.pose === 'objection') this.#shakeBy(0.7);
        }
        if (step.speaker !== 'player' && this.#control === 'cinematic') this.#look = { target: this.#resolveTarget(step.speaker) };
        break;
      case 'pose':
        this.#pose(step.npc, step.pose);
        if (step.pose === 'objection') this.#shakeBy(0.55);
        if (step.pose === 'shock' || step.pose === 'panic') this.#shakeBy(0.2);
        break;
      case 'gavel':
        this.#gavel(1);
        break;
      case 'cue':
        this.#cue(step.cue);
        break;
      case 'mood':
        this.#mood = step.mood;
        this.#emit({ type: 'mood', mood: step.mood });
        this.#changed();
        break;
      case 'callout':
        this.#calloutSeq += 1;
        this.#callout = { text: step.text, style: step.style, age: 0, id: this.#calloutSeq };
        // Desk-slam feel under every drama card — objection / jury-out hit hardest.
        if (step.style === 'objection' || step.style === 'jury-out') this.#shakeBy(0.55);
        else if (step.style === 'order' || step.style === 'verdict') this.#shakeBy(0.45);
        else if (step.style === 'counter' || step.style === 'let-bro-cook') this.#shakeBy(0.35);
        this.#emit({ type: 'callout', text: step.text, style: step.style });
        this.#changed();
        break;
      case 'wait':
        break;
    }
  }

  dialogueBusy(): boolean {
    const d = this.#dialogue;
    return !!d && (d.shown < d.text.length || d.hold > 0);
  }

  clearDialogue(): void {
    this.#setDialogue(null);
  }

  #resolveTarget(at: string | Vec3): Vec3 {
    if (typeof at !== 'string') return at;
    // Seated in the box, "look at the jury" would stare into a neighbour's face: watch the bench instead.
    if (at === 'jury' && this.#seat?.id === 'jury-box') at = 'judge';
    return this.world.marks[at] ?? this.world.marks.judge ?? [0, 50, -60];
  }

  #pose(who: string, pose: NpcPose): void {
    const role = who === 'jury' ? 'juror' : who === 'gallery' ? 'gallery' : null;
    for (const n of this.#npcs) {
      const spec = this.#specs.get(n.id)!;
      if (who === 'all' || n.id === who || (role && spec.role === role)) {
        if (pose === 'talk') n.talking = true;
        else n.pose = pose === 'stand' && spec.seated ? 'sit' : pose;
      }
    }
  }

  #gavel(strength: number): void {
    const judge = this.#npcs.find((n) => n.id === 'judge');
    if (judge) judge.pose = 'gavel';
    this.#shakeBy(strength);
    // Soft tap = single strike; full ORDER slam = triple hit.
    this.#cue(strength >= 0.9 ? 'sfx.desk-slam' : 'sfx.gavel');
    this.#emit({ type: 'gavel' });
  }

  #shakeBy(k: number): void {
    if (!this.#reduced) this.#shake = Math.min(1, this.#shake + k);
  }

  #setDialogue(line: DialogueLine | null): void {
    for (const n of this.#npcs) n.talking = false;
    if (!line) {
      this.#voiceCool = 0;
      if (this.#dialogue) {
        this.#dialogue = null;
        this.#emit({ type: 'dialogue', line: null });
        this.#changed();
      }
      return;
    }
    const npc = this.#specs.get(line.speaker) ?? null;
    const name = npc?.name ?? (line.speaker === 'player' ? this.avatar.name : line.speaker === 'narrator' ? '' : line.speaker);
    const role = SPEAKER_ROLE[line.speaker] ?? (line.speaker.startsWith('juror') ? 'Jury' : npc?.role ? String(npc.role) : '');
    const shown = this.#reduced ? line.text.length : 0;
    this.#dialogue = {
      speaker: line.speaker,
      name,
      role,
      text: line.text,
      shown,
      hold: holdSeconds(line.text, this.paceSpec()),
      npc: npc?.id ?? null,
    };
    const st = npc && this.#npcs.find((n) => n.id === npc.id);
    if (st) st.talking = true;
    this.#babble(line.speaker);
    // Match cue duration so maxVoices:1 does not chop mid-syllable.
    this.#voiceCool = 1.2;
    this.#emit({ type: 'dialogue', line });
    this.#changed();
  }

  #babble(speaker: string): void {
    const voice = VOICE_CUE[speaker] ?? (speaker.startsWith('juror') ? undefined : 'voice.narrator');
    if (!voice) return;
    const pan = VOICE_PAN[speaker] ?? 0;
    this.#emit({ type: 'cue', cue: voice });
    try {
      this.#audio?.play(voice, { pan, volume: 1 });
    } catch {
      /* sound is decoration */
    }
  }

  /* ── Simulation ────────────────────────────────────────────────────── */

  update(dt: number): void {
    const frame = Math.min(Math.max(dt, 0), 0.25);
    if (this.#paused) return;
    // Physics and the camera cap long frames (no tunnelling, no lurch); the hearing's clock
    // keeps real time up to 1 s a frame, so a slow device doesn't stretch the trial.
    const real = Math.min(Math.max(dt, 0), 1);
    this.#time += frame;
    const held = this.keys.read();
    const ext = [...this.#external.values()];
    const intent = mergeIntents(held.intent, ...ext.map((e) => e.intent));
    const turn = held.turn + ext.reduce((s, e) => s + e.turn, 0);
    const tilt = held.tilt + ext.reduce((s, e) => s + e.tilt, 0);
    const canLook = this.#control !== 'cinematic' && !this.#exhibit && !this.#panel;
    if (canLook) {
      this.#yaw -= turn * frame;
      this.#pitch = clampPitch(this.#pitch + tilt * frame);
    }
    if (this.#seat && !this.#beat && (intent.forward !== 0 || intent.strafe !== 0) && ext.some((e) => e.intent.forward !== 0 || e.intent.strafe !== 0)) this.stand();

    const walking = this.#control === 'free' && !this.#seat && !this.#exhibit && !this.#panel;
    const move: MoveIntent = walking ? { ...intent, jump: intent.jump || this.#jumpQueued } : NO_MOVE;
    this.#jumpQueued = false;
    let moved = false;
    this.#alpha = this.#stepper.advance(frame, (h) => {
      this.#prev = [...this.#body.pos];
      if (this.#seat) return;
      stepBody(this.#body, move, this.#yaw, this.#index, this.#bounds, h);
      moved = true;
    });
    this.#speed = Math.hypot(this.#body.vel[0], this.#body.vel[2]);
    if (moved) this.#updateZone();

    // Cinematic look: ease the view toward the speaker.
    if (this.#look) {
      const eye = this.eye();
      const dx = this.#look.target[0] - eye[0];
      const dz = this.#look.target[2] - eye[2];
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(this.#look.target[1] - eye[1], Math.hypot(dx, dz));
      const k = this.#reduced ? 1 : 1 - Math.exp(-CAMERA_EASE * frame);
      this.#yaw += Math.atan2(Math.sin(yaw - this.#yaw), Math.cos(yaw - this.#yaw)) * k;
      this.#pitch += (pitch - this.#pitch) * k;
    }

    // Head bob and shake.
    if (!this.#reduced && walking && this.#body.onGround && this.#speed > 4) {
      this.#bobPhase += frame * this.#speed * 0.16;
      this.#bob = Math.sin(this.#bobPhase) * 0.55 * Math.min(1, this.#speed / BODY.walk);
    } else this.#bob *= 0.85;
    if (this.#reduced) this.#bob = 0;
    this.#shake = Math.max(0, this.#shake - frame * 2.6);

    // Dialogue typewriter, callout lifetime. Fast-forward speeds up hearing time only.
    const story = this.#fast && this.#beat ? real * FAST_FORWARD : real;
    const d = this.#dialogue;
    if (d) {
      if (d.shown < d.text.length) {
        const before = Math.floor(d.shown);
        d.shown = Math.min(d.text.length, d.shown + story * this.paceSpec().typeSpeed);
        if (Math.floor(d.shown) !== before && Math.floor(d.shown) % 6 === 0) this.#changed();
        if (d.shown >= d.text.length) this.#changed();
        // Keep babble alive for the whole typewriter; interval ≥ cue length so speech isn't chopped.
        this.#voiceCool -= story;
        if (this.#voiceCool <= 0) {
          this.#babble(d.speaker);
          this.#voiceCool = 1.15;
        }
      } else if (d.hold > 0) {
        d.hold -= story;
        // Barks outside beats fade on their own; beat lines wait for the runner.
        if (d.hold <= 0 && !this.#beat) this.#setDialogue(null);
      }
    }
    if (this.#callout) {
      this.#callout.age += real;
      if (this.#callout.age > (CALLOUT_LIFE[this.#callout.style] ?? CALLOUT_SECONDS)) {
        this.#callout = null;
        this.#changed();
      }
    }

    // Remotes, NPC attention, judge settles back after a gavel.
    this.#remoteFeed?.tick?.(frame, this.#clock());
    this.#remotes = this.#interp.sample(this.#clock());
    const watch: Vec3[] = [this.eye(), ...this.#remotes.map<Vec3>((r) => [r.pos[0], r.pos[1] + BODY.eye, r.pos[2]])];
    const speaker = this.#dialogue?.npc;
    for (const s of this.#npcs) {
      if (s.hidden) continue;
      const spec = this.#specs.get(s.id)!;
      const head = this.#npcHeads.get(s.id)!;
      // During a line, everyone else looks at the speaker; the speaker looks at the player.
      const override = speaker && speaker !== s.id ? (this.world.marks[speaker] ?? null) : null;
      updateNpcHead(s, spec, head, watch, frame, override);
      if (s.pose === 'gavel' && this.#shake < 0.05) s.pose = spec.seated ? 'sit' : 'stand';
    }

    if (this.#beat && this.#beat.runner.advance(story)) this.#endBeat(false);
    this.#refreshFocus();
  }

  #clock(): number {
    return this.#now ? this.#now() : this.#time * 1000;
  }

  #updateZone(): void {
    const z = zoneAt(this.world, this.#body.pos[0], this.#body.pos[2])?.id ?? null;
    if (z !== this.#zone) {
      this.#zone = z;
      this.#emit({ type: 'zone', zone: z });
      this.#changed();
    }
  }

  #refreshFocus(): void {
    let next: InteractableSpec | null = null;
    if (this.#control !== 'cinematic' && !this.#exhibit && !this.#seat && !this.#panel) {
      const live = this.world.interactables.filter((i) => (!i.gate || !this.#openGates.has(i.gate)) && (this.#stations || i.kind !== 'station'));
      const r = selectFocus(this.eye(), lookDir(this.#yaw, this.#pitch), live);
      next = r ? (this.world.interactables.find((i) => i.id === r.id) ?? null) : null;
    }
    if (next?.id !== this.#focus?.id) {
      this.#focus = next;
      this.#emit({ type: 'focus', id: next?.id ?? null });
      this.#changed();
    }
  }

  /* ── Reads ─────────────────────────────────────────────────────────── */

  eye(): Vec3 {
    const p = this.#body.pos;
    const a = this.#alpha;
    const x = this.#prev[0] + (p[0] - this.#prev[0]) * a;
    const y = this.#prev[1] + (p[1] - this.#prev[1]) * a;
    const z = this.#prev[2] + (p[2] - this.#prev[2]) * a;
    const h = this.#seat ? this.#seat.eye : BODY.eye;
    return [x, y + h + this.#bob, z];
  }

  view(): CameraView {
    const s = this.#reduced ? 0 : this.#shake;
    const t = this.#time;
    return {
      eye: this.eye(),
      yaw: this.#yaw,
      pitch: this.#pitch,
      shakeYaw: s * s * 0.03 * Math.sin(t * 71),
      shakePitch: s * s * 0.035 * Math.sin(t * 53 + 1.3),
      subject: this.#look?.target ?? null,
    };
  }

  get npcStates(): readonly NpcState[] {
    return this.#npcs;
  }

  get remotes(): readonly PlayerState[] {
    return this.#remotes;
  }

  get reducedMotion(): boolean {
    return this.#reduced;
  }

  get focusId(): string | null {
    return this.#seat || this.#control === 'cinematic' ? null : (this.#focus?.id ?? null);
  }

  get mood(): LightingMood {
    return this.#mood;
  }

  get zone(): ZoneId | null {
    return this.#zone;
  }

  get perspective(): PerspectiveChoice {
    return this.#perspective;
  }

  /** `auto` is the trailing third-person camera; look and movement are the same in both. */
  setPerspective(choice: PerspectiveChoice): void {
    if (choice === this.#perspective) return;
    this.#perspective = choice;
    this.#changed();
  }

  get control(): ControlMode {
    return this.#control;
  }

  get seat(): SeatId | null {
    return this.#seat?.id ?? null;
  }

  get beatId(): BeatId | null {
    return this.#beat?.runner.id ?? null;
  }

  playerState(): PlayerState {
    return {
      id: this.id,
      avatar: this.#avatar,
      role: this.role,
      pos: [...this.#body.pos],
      yaw: this.#yaw,
      pitch: this.#pitch,
      seat: this.#seat?.id ?? null,
      speed: this.#speed,
      t: this.#clock(),
    };
  }

  snapshot(): RoamSnapshot {
    const d = this.#dialogue;
    const b = this.#beat;
    const focused = this.#focus;
    const doorPrompt = focused?.id === 'street-doors' ? (this.#adjourned ? 'Step outside' : focused.prompt) : focused?.prompt;
    const focus = this.#seat && !this.#beat && this.#control !== 'cinematic' ? { id: 'stand', prompt: 'Stand up' } : focused ? { id: focused.id, prompt: doorPrompt ?? focused.prompt } : null;
    return {
      player: this.playerState(),
      eye: this.eye(),
      control: this.#control,
      paused: this.#paused,
      zone: this.#zone,
      focus,
      dialogue: d ? { speaker: d.speaker, name: d.name, role: d.role, text: d.text, shown: Math.floor(d.shown), hold: d.hold } : null,
      beat: b ? { id: b.runner.id, step: Math.min(b.runner.index, b.runner.steps.length), steps: b.runner.steps.length } : null,
      exhibit: this.#exhibit,
      panel: this.#panel,
      gates: [...this.#openGates],
      callout: this.#callout ? { ...this.#callout } : null,
      mood: this.#mood,
      shake: this.#reduced ? 0 : this.#shake,
      bob: this.#bob,
      npcs: this.#npcs.map((n) => ({ ...n })),
      remotes: this.#remotes,
      reducedMotion: this.#reduced,
      pace: this.#pace,
      fastForward: this.#fast,
      version: this.#version,
    };
  }

  get version(): number {
    return this.#version;
  }

  dispose(): void {
    this.skipBeat();
    for (const u of this.#unsubs) u();
    this.#listeners.clear();
    this.#change.clear();
  }
}

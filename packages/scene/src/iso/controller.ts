/**
 * IsoController: the town's headless state machine.
 *
 * Everything that can be reasoned about without a browser lives here — movement,
 * collision resolution, focus, portals, dialogue, the camera target, the HUD
 * snapshot — so it is tested in node. The three.js renderer only reads from it,
 * and the React layer only calls into it.
 *
 * Fixed-step movement with a catch-up cap, exactly like the first-person
 * controller, so the same input gives the same path at 30, 60 or 144 fps.
 */
import { BODY, FixedStepper, NO_MOVE, SolidIndex, clampToMap, intentToward, stepBody, type BodyState, type MoveIntent } from './physics';
import { IsoCamera } from './camera';
import { DialogueRunner, type DialogueNode, type DialogueView } from './dialogue';
import type { DialogueTree } from './dialogue';
import { buildTownMap, CELL, worldToTile, type MapId, type TownMapSpec, type TownWorld, type TownBox } from './world';

export type ControlMode = 'free' | 'dialogue' | 'paused';

export interface IsoSnapshot {
  map: MapId;
  mapName: string;
  /** Player feet position. */
  pos: readonly [number, number, number];
  /** Facing in radians, for the avatar's yaw. */
  yaw: number;
  /** Horizontal speed, drives the walk cycle. */
  speed: number;
  moving: boolean;
  /** Focused interactable, if any. */
  focus: { id: string; prompt: string } | null;
  /** Active conversation. */
  dialogue: DialogueView | null;
  /** Speaker display name for the current line. */
  speakerName: string | null;
  control: ControlMode;
  /** Set once the player has visited each map, for the map screen. */
  visited: readonly MapId[];
  /** Bumped on every visible change, so React can skip frames. */
  version: number;
}

export type IsoEvent =
  | { type: 'focus'; id: string | null }
  | { type: 'enter-map'; map: MapId }
  | { type: 'portal'; from: MapId; to: MapId; portalId: string }
  | { type: 'dialogue-start'; npc: string }
  | { type: 'dialogue-end'; npc: string }
  | { type: 'inspect'; id: string; lines?: string }
  | { type: 'action'; id: string };

export interface IsoControllerOptions {
  /** Maps to load, keyed by id. The outdoor town is one map; interiors are the rest. */
  maps: Readonly<Partial<Record<MapId, TownMapSpec>>>;
  /** Prop geometry. */
  library: Readonly<Record<string, readonly TownBox[]>>;
  /** Conversation trees, keyed by dialogue id. */
  dialogue?: Readonly<Record<string, DialogueTree>>;
  /** Which map to start on. */
  start?: MapId;
  /** Spawn id on the start map; defaults to the map's own default. */
  spawn?: string;
  /** Display names for speakers that are not map NPCs. */
  speakerNames?: Readonly<Record<string, string>>;
  /** NPC display names, gathered across maps. */
  npcNames?: Readonly<Record<string, string>>;
  /** Inspect / exhibit cards, keyed by the prop's `lines` id or its interact id. */
  notes?: Readonly<Record<string, { title: string; text: string }>>;
  /** Reduced motion: no camera easing. */
  reducedMotion?: boolean;
}

/** How close the player must be before a focus prompt appears. */
const FOCUS_RANGE = 46;
/** How far the focus cone reaches sideways, as a dot-product floor. */
const FOCUS_CONE = 0.35;

export class IsoController {
  readonly maps: Readonly<Partial<Record<MapId, TownMapSpec>>>;
  readonly #library: Readonly<Record<string, readonly TownBox[]>>;
  readonly #dialogueTrees: Readonly<Record<string, DialogueTree>>;
  readonly #speakerNames: Readonly<Record<string, string>>;
  readonly #npcNames: Readonly<Record<string, string>>;
  readonly #worlds = new Map<MapId, TownWorld>();
  readonly #indexes = new Map<MapId, SolidIndex>();
  readonly camera = new IsoCamera();

  #world: TownWorld;
  #index: SolidIndex;
  #body: BodyState;
  #yaw = 0;
  #stepper = new FixedStepper();
  #focusId: string | null = null;
  #runner: DialogueRunner | null = null;
  #dialogueNpc: string | null = null;
  #paused = false;
  #version = 0;
  #visited = new Set<MapId>();
  #goal: { x: number; z: number; interact: boolean } | null = null;
  #notes: Readonly<Record<string, { title: string; text: string }>>;
  #subs = new Set<(e: IsoEvent) => void>();
  #onChange: (() => void) | null = null;
  reducedMotion: boolean;

  constructor(options: IsoControllerOptions) {
    this.maps = options.maps;
    this.#library = options.library;
    this.#dialogueTrees = options.dialogue ?? {};
    this.#speakerNames = options.speakerNames ?? {};
    this.#npcNames = options.npcNames ?? {};
    this.#notes = options.notes ?? {};
    this.reducedMotion = options.reducedMotion ?? false;

    const startId = options.start ?? (Object.keys(options.maps)[0] as MapId);
    this.#world = this.#worldFor(startId);
    this.#index = this.#indexFor(startId);

    const spawnId = options.spawn ?? this.#world.spec.defaultSpawn;
    const spawn = this.#world.spawns[spawnId];
    if (!spawn) throw new Error(`iso: spawn "${spawnId}" does not exist on map "${startId}"`);
    this.#body = { pos: [spawn.pos[0], spawn.pos[1], spawn.pos[2]], vel: [0, 0, 0] };
    this.#yaw = spawn.yaw;
    this.#visited.add(startId);
    this.camera.bind(this.#world, this.#body.pos, true);
  }

  /* ── Reads ────────────────────────────────────────────────────────────── */

  get world(): TownWorld {
    return this.#world;
  }

  get index(): SolidIndex {
    return this.#index;
  }

  get mapId(): MapId {
    return this.#world.spec.id;
  }

  get body(): Readonly<BodyState> {
    return this.#body;
  }

  get focus(): { id: string; prompt: string } | null {
    if (!this.#focusId) return null;
    const spec = this.#world.interactables.find((i) => i.id === this.#focusId);
    return spec ? { id: spec.id, prompt: spec.prompt } : null;
  }

  get control(): ControlMode {
    if (this.#paused) return 'paused';
    if (this.#runner && !this.#runner.done) return 'dialogue';
    return 'free';
  }

  snapshot(): IsoSnapshot {
    const speed = Math.hypot(this.#body.vel[0], this.#body.vel[2]);
    const view = this.#runner?.view() ?? null;
    const speaker = view?.node?.speaker ?? null;
    return {
      map: this.mapId,
      mapName: this.#placeName(),
      pos: [this.#body.pos[0], this.#body.pos[1], this.#body.pos[2]],
      yaw: this.#yaw,
      speed,
      moving: speed > 4,
      focus: this.focus,
      dialogue: view ? { ...view } : null,
      speakerName: view?.node?.name ?? (speaker ? this.#nameOf(speaker) : null),
      control: this.control,
      visited: [...this.#visited],
      version: this.#version,
    };
  }

  /* ── Subscriptions ────────────────────────────────────────────────────── */

  /** Typed events, for audio and renderer effects. */
  subscribe(fn: (e: IsoEvent) => void): () => void {
    this.#subs.add(fn);
    return () => this.#subs.delete(fn);
  }

  /** Called whenever the snapshot changes (never per frame). */
  onChange(fn: (() => void) | null): void {
    this.#onChange = fn;
  }

  /* ── Frame ────────────────────────────────────────────────────────────── */

  /**
   * Advance the world. `intent` is screen-relative, which is the whole point of
   * an isometric camera: W walks toward the top of the screen.
   */
  update(dt: number, intent: MoveIntent = NO_MOVE): void {
    if (this.control === 'paused') {
      this.camera.update(dt);
      return;
    }

    if (this.control === 'free') {
      const keyed = Math.abs(intent.forward) + Math.abs(intent.strafe) > 0.01;
      if (keyed) this.#goal = null;
      const move = keyed || !this.#goal ? intent : intentToward(this.#goal.x - this.#body.pos[0], this.#goal.z - this.#body.pos[2]);
      this.#stepper.advance(dt, (step) => {
        stepBody(this.#body, move, this.#index, this.#world, step);
        this.#body.pos = [...clampToMap(this.#world, this.#body.pos)] as [number, number, number];
      });
      // Face travel: the avatar turns toward where it is going, not where the
      // camera points, so walking left visibly turns the sprite left.
      const speed = Math.hypot(this.#body.vel[0], this.#body.vel[2]);
      if (speed > 6) {
        const want = Math.atan2(this.#body.vel[0], this.#body.vel[2]);
        this.#yaw = turnToward(this.#yaw, want, dt * 9);
      }
      this.#refreshFocus();
      this.#arriveGoal();
    } else {
      // Standing still while talking.
      this.#body.vel[0] = 0;
      this.#body.vel[2] = 0;
      this.#stepper.reset();
    }

    this.camera.follow(this.#body.pos[0], this.#body.pos[2]);
    this.camera.update(this.reducedMotion ? 1 : dt);
    this.#bump();
  }

  /* ── Input ────────────────────────────────────────────────────────────── */

  /**
   * Walk toward a ground point. `interact` presses E on arrival, which is how a
   * click on an NPC becomes a conversation without a second button.
   */
  setMoveGoal(x: number, z: number, interact = false): void {
    if (this.control !== 'free') return;
    this.#goal = { x, z, interact };
  }

  /** The single interaction verb: talk, inspect, open a door, read an exhibit. */
  interact(): IsoEvent | null {
    if (this.control === 'paused') return null;

    // In a conversation, the same key advances it.
    if (this.control === 'dialogue') {
      const runner = this.#runner!;
      const view = runner.view();
      if (view.choices.length === 0) {
        const left = view.node;
        runner.advance();
        this.#finishIfDone(left);
        return null;
      }
      // A node with choices needs an explicit pick; do nothing here.
      return null;
    }

    const id = this.#focusId;
    if (!id) return null;
    const spec = this.#world.interactables.find((i) => i.id === id);
    if (!spec) return null;

    if (spec.kind === 'talk' && spec.npc) {
      this.#startDialogue(spec.npc);
      return { type: 'dialogue-start', npc: spec.npc };
    }

    if (spec.kind === 'door') {
      const portal = this.#world.portals.find((p) => p.id === id);
      if (!portal) return null;
      if (portal.locked) {
        this.#emit({ type: 'inspect', id, lines: spec.lines });
        return { type: 'inspect', id, lines: spec.lines };
      }
      return this.#travel(portal.to, portal.spawn, portal.id);
    }

    // Exhibit / inspect: a one-line card, using the same dialogue panel as talk.
    const note = this.#notes[spec.lines ?? ''] ?? this.#notes[spec.id];
    if (note) {
      this.#runner = new DialogueRunner({
        start: 'note',
        nodes: { note: { speaker: 'player', name: note.title, text: note.text } },
      });
      this.#dialogueNpc = spec.id;
      this.#body.vel[0] = 0;
      this.#body.vel[2] = 0;
    }
    const event: IsoEvent = { type: 'inspect', id, ...(spec.lines ? { lines: spec.lines } : {}) };
    this.#emit(event);
    this.#bump();
    return event;
  }

  /** Pick a dialogue choice by index. Returns false when there is nothing to pick. */
  choose(index: number): boolean {
    const runner = this.#runner;
    if (!runner || this.control !== 'dialogue') return false;
    const ok = runner.choose(index);
    if (!ok) return false;
    // A choice that ends the talk does not fire the node's action: the action
    // belongs to the line you continue past, not the menu you picked from.
    this.#finishIfDone(null);
    return true;
  }

  /** Step back one dialogue node. Conversations here are forward-only by design. */
  advanceDialogue(): boolean {
    const runner = this.#runner;
    if (!runner || this.control !== 'dialogue') return false;
    const left = runner.view().node;
    const ok = runner.advance();
    if (!ok) return false;
    this.#finishIfDone(left);
    return true;
  }

  endDialogue(): void {
    if (this.#runner) this.#closeDialogue();
  }

  setPaused(paused: boolean): void {
    if (this.#paused === paused) return;
    this.#paused = paused;
    this.#bump();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /** Teleport without a portal (debug, screenshots, spawns). */
  teleport(map: MapId, spawnId: string): void {
    this.#travel(map, spawnId, 'teleport');
  }

  /**
   * Resolve a focus target for a ray/cone from the player, exactly like the
   * first-person controller: nearest-along-view wins, else best aligned.
   */
  focusTargetFor(eye: readonly [number, number, number], dir: readonly [number, number, number]): string | null {
    return this.#pickFocus([eye[0], eye[1], eye[2]], [dir[0], dir[1], dir[2]]);
  }

  /* ── Internals ────────────────────────────────────────────────────────── */

  #worldFor(id: MapId): TownWorld {
    const hit = this.#worlds.get(id);
    if (hit) return hit;
    const spec = this.maps[id];
    if (!spec) throw new Error(`iso: unknown map "${id}"`);
    const world = buildTownMap({ spec, library: this.#library });
    this.#worlds.set(id, world);
    return world;
  }

  #indexFor(id: MapId): SolidIndex {
    const hit = this.#indexes.get(id);
    if (hit) return hit;
    const index = new SolidIndex(this.#worldFor(id).solids);
    this.#indexes.set(id, index);
    return index;
  }

  #travel(to: MapId, spawnId: string, via: string): IsoEvent {
    const world = this.#worldFor(to);
    const spawn = world.spawns[spawnId];
    if (!spawn) throw new Error(`iso: spawn "${spawnId}" does not exist on map "${to}"`);
    const from = this.mapId;

    this.#closeDialogue();
    this.#goal = null;
    this.#world = world;
    this.#index = this.#indexFor(to);
    this.#body = { pos: [spawn.pos[0], spawn.pos[1], spawn.pos[2]], vel: [0, 0, 0] };
    this.#yaw = spawn.yaw;
    this.#focusId = null;
    this.#stepper.reset();
    this.#visited.add(to);
    // Snap: easing across a map change reads as sliding through a wall.
    this.camera.bind(world, this.#body.pos, true);

    const event: IsoEvent = { type: 'portal', from, to, portalId: via };
    this.#emit(event);
    this.#emit({ type: 'enter-map', map: to });
    this.#bump();
    return event;
  }

  #startDialogue(dialogueId: string): void {
    const tree = this.#dialogueTrees[dialogueId];
    this.#dialogueNpc = dialogueId;
    if (!tree) {
      // An NPC with no tree still says something; the town must never be mute.
      this.#runner = null;
      this.#dialogueNpc = null;
      return;
    }
    this.#runner = new DialogueRunner(tree);
    this.#body.vel[0] = 0;
    this.#body.vel[2] = 0;
    this.#bump();
  }

  #closeDialogue(): void {
    const npc = this.#dialogueNpc;
    this.#runner = null;
    this.#dialogueNpc = null;
    if (npc) this.#emit({ type: 'dialogue-end', npc });
    this.#bump();
  }

  /** Close the conversation when the runner has finished, and fire a node action. */
  #finishIfDone(left: DialogueNode | null): void {
    if (!this.#runner?.done) {
      this.#bump();
      return;
    }
    const action = left?.action;
    this.#closeDialogue();
    if (action) this.#emit({ type: 'action', id: action });
  }

  #placeName(): string {
    const [c, r] = worldToTile(this.#body.pos[0], this.#body.pos[2]);
    let name = this.#world.spec.name;
    for (const region of this.#world.spec.regions ?? []) {
      if (c >= region.c0 && c <= region.c1 && r >= region.r0 && r <= region.r1) name = region.name;
    }
    return name;
  }

  #arriveGoal(): void {
    const goal = this.#goal;
    if (!goal) return;
    const dist = Math.hypot(goal.x - this.#body.pos[0], goal.z - this.#body.pos[2]);
    if (dist > 14) return;
    const interact = goal.interact;
    this.#goal = null;
    if (!interact) return;
    if (!this.#focusId) this.#focusId = this.#nearest(22);
    this.interact();
  }

  #nearest(range: number): string | null {
    let best: { id: string; d: number } | null = null;
    const x = this.#body.pos[0];
    const z = this.#body.pos[2];
    for (const item of this.#world.interactables) {
      const d = Math.hypot(item.at[0] - x, item.at[2] - z);
      if (d > range) continue;
      if (!best || d < best.d) best = { id: item.id, d };
    }
    return best?.id ?? null;
  }

  #nameOf(speaker: string): string {
    if (speaker === 'player') return 'You';
    return this.#npcNames[speaker] ?? this.#speakerNames[speaker] ?? speaker;
  }

  /** Eye position and forward direction for focus picking. */
  #eye(): { eye: [number, number, number]; dir: [number, number, number] } {
    const eye: [number, number, number] = [this.#body.pos[0], this.#body.pos[1] + BODY.height * 0.62, this.#body.pos[2]];
    // Look where the body faces; on a fixed iso camera that is the best proxy
    // for "what the player is walking toward".
    const dir: [number, number, number] = [Math.sin(this.#yaw), 0, Math.cos(this.#yaw)];
    return { eye, dir };
  }

  #refreshFocus(): void {
    const { eye, dir } = this.#eye();
    const next = this.#pickFocus(eye, dir);
    if (next === this.#focusId) return;
    this.#focusId = next;
    this.#emit({ type: 'focus', id: next });
    this.#bump();
  }

  #pickFocus(eye: [number, number, number], dir: [number, number, number]): string | null {
    let best: { id: string; score: number } | null = null;
    for (const item of this.#world.interactables) {
      const dx = item.at[0] - eye[0];
      const dy = item.at[1] - eye[1];
      const dz = item.at[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist > Math.min(item.range ?? FOCUS_RANGE, FOCUS_RANGE)) continue;
      if (dist < 1e-3) {
        if (!best || FOCUS_CONE < best.score) best = { id: item.id, score: FOCUS_CONE };
        continue;
      }
      const dot = (dx * dir[0] + dz * dir[2]) / Math.hypot(dx, dz || 1e-6);
      if (dot < FOCUS_CONE) continue;
      // Prefer the best-aligned, then the nearest: two stalls side by side must
      // not fight over the prompt.
      const score = dot - dist / (FOCUS_RANGE * 8);
      if (!best || score > best.score) best = { id: item.id, score };
    }
    return best?.id ?? null;
  }

  #emit(e: IsoEvent): void {
    for (const fn of this.#subs) fn(e);
  }

  #bump(): void {
    this.#version++;
    this.#onChange?.();
  }
}

/** Turn `from` toward `to` by at most `max` radians, taking the short way round. */
export function turnToward(from: number, to: number, max: number): number {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= max) return to;
  return from + Math.sign(delta) * max;
}

export { CELL };

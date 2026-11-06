/**
 * CourtroomRuntime: the three.js ScenePort. Owns the scene graph (room, lights,
 * actors, props), drives every actor's CharacterAnimator and the system
 * timelines, and moves the camera between presets. Rendering is somebody else's
 * job (the R3F <Courtroom/> component, or a test): call `update(dt)` each frame.
 */
import type {
  CalloutStyle,
  CameraShot,
  CastMember,
  LightingMood,
  PropState,
  ScenePort,
  SceneSignal,
  SystemAnimationId,
  Unsubscribe,
} from '@cringe-court/core';
import * as THREE from 'three';
import { CharacterAnimator } from '../anim/animator';
import { SystemTimeline } from '../anim/system';
import { worldPerPixel } from '../atlas';
import { STAGE_MARKS, cameraFor, type CameraPreset } from '../courtroom/layout';
import type { CourtroomData } from '../load';
import { DropletBurst, SpriteActor } from './actor';
import { LightingRig } from './lighting';
import { buildRoom } from './room';

export interface RuntimeOptions {
  data: CourtroomData;
  /** Atlas texture per character id (see ATLAS_IMAGE_URLS). */
  textures: Readonly<Record<string, THREE.Texture>>;
  /** Cut instead of moving the camera; no shake, drift or particles. */
  reducedMotion?: boolean;
  random?: () => number;
  /** Fallback timer for animation promises when no frames run (hidden tab, tests). */
  setTimer?: (fn: () => void, ms: number) => unknown;
}

interface Actor {
  member: CastMember;
  sprite: SpriteActor;
  animator: CharacterAnimator;
}

interface CameraMove {
  from: CameraPreset;
  to: CameraPreset;
  t: number;
  seconds: number;
}

interface RunningSystem {
  timeline: SystemTimeline;
  resolve: () => void;
}

const SEATED_MARKS = new Set(['jury-1', 'jury-2', 'jury-3']);
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export class CourtroomRuntime implements Omit<ScenePort, 'camera' | 'lighting' | 'id'> {
  readonly id = 'three' as const;
  readonly scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  readonly lighting: LightingRig;
  readonly drawCalls: number;
  readonly #data: CourtroomData;
  readonly #textures: Readonly<Record<string, THREE.Texture>>;
  readonly #random: () => number;
  readonly #setTimer: (fn: () => void, ms: number) => unknown;
  readonly #actors = new Map<string, Actor>();
  readonly #cast = new THREE.Group();
  readonly #fx = new THREE.Group();
  readonly #listeners = new Set<(s: SceneSignal) => void>();
  readonly #waiting = new Map<string, Array<{ animation: string; resolve: () => void }>>();
  readonly #systems: RunningSystem[] = [];
  readonly #bursts: DropletBurst[] = [];
  readonly #ballotLid: THREE.Mesh;
  readonly #screenGlow: THREE.Mesh;
  readonly #unitsPerPixel: number;
  #reduced: boolean;
  #move: CameraMove | null = null;
  #view: CameraPreset;
  #shake = 0;
  #time = 0;
  #shot: CameraShot = 'pov_entrance';

  constructor(options: RuntimeOptions) {
    this.#data = options.data;
    this.#textures = options.textures;
    this.#random = options.random ?? Math.random;
    this.#reduced = options.reducedMotion ?? false;
    this.#setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.#unitsPerPixel = worldPerPixel(options.data.atlas);

    const room = buildRoom(options.data.boxes);
    this.drawCalls = room.drawCalls;
    this.lighting = new LightingRig(options.data.layout.props);
    this.scene.name = 'cringe-court';
    this.scene.background = new THREE.Color('#120c16');
    this.scene.fog = this.lighting.fog;
    this.#cast.name = 'cast';
    this.#fx.name = 'fx';
    this.scene.add(room.group, this.lighting.object, this.#cast, this.#fx);

    // Ballot box lid (sealed ↔ open on the commit → reveal beat, SCENE-GUIDE next step 3).
    const ballot = options.data.layout.props.find((p) => p.prop === 'sealed_ballot_box');
    this.#ballotLid = new THREE.Mesh(new THREE.BoxGeometry(15, 1.6, 15), new THREE.MeshStandardMaterial({ color: '#D9A046', roughness: 0.4, flatShading: true }));
    this.#ballotLid.name = 'ballot-lid';
    this.#ballotLid.position.set(ballot?.pos[0] ?? -62, 16.5, ballot?.pos[2] ?? -8);
    this.#ballotLid.rotation.y = THREE.MathUtils.degToRad(ballot?.rot ?? 0);
    // Evidence screen glow, lit when an exhibit is on screen.
    const screen = options.data.layout.props.find((p) => p.prop === 'evidence_screen');
    this.#screenGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 18),
      new THREE.MeshBasicMaterial({ color: '#BDF5FF', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.#screenGlow.name = 'evidence-glow';
    this.#screenGlow.position.set((screen?.pos[0] ?? -88) + 3, (screen?.pos[1] ?? 34) + 9, screen?.pos[2] ?? -46);
    this.#screenGlow.rotation.y = Math.PI / 2;
    this.scene.add(this.#ballotLid, this.#screenGlow);

    this.#view = cameraFor(options.data.layout, 'pov_entrance');
    this.camera = new THREE.PerspectiveCamera(this.#view.fov, 16 / 9, 1, 900);
    this.#applyView(this.#view);
  }

  /* ScenePort */

  async ready(): Promise<void> {
    this.#emit({ type: 'ready' });
  }

  setCast(cast: readonly CastMember[]): void {
    for (const a of this.#actors.values()) {
      this.#cast.remove(a.sprite.object);
      a.sprite.dispose();
    }
    this.#actors.clear();
    for (const member of cast) {
      const atlas = this.#data.atlas.characters[member.character];
      const texture = this.#textures[member.character];
      if (!atlas || !texture || !this.#data.animations.characters.has(member.character)) {
        this.#emit({ type: 'error', message: `No sprites or animations for ${member.character}` });
        continue;
      }
      const sprite = new SpriteActor(member.actor, member.character, atlas, texture, this.#unitsPerPixel);
      const mark = STAGE_MARKS[member.mark];
      sprite.object.position.set(...mark.pos);
      sprite.object.rotation.y = mark.yaw;
      const seated = member.character === 'juror' && SEATED_MARKS.has(member.mark);
      const animator = new CharacterAnimator(this.#data.animations, member.character, { random: this.#random, ...(seated ? { baseIdle: 'seated_idle' } : {}) });
      this.#actors.set(member.actor, { member, sprite, animator });
      this.#cast.add(sprite.object);
      sprite.apply(animator.update(0), 0);
      animator.drainEvents();
    }
  }

  /** ScenePort.camera (named apart from the `camera` property; see asScenePort). */
  cameraTo(shot: CameraShot, seconds = 1.2): void {
    const to = cameraFor(this.#data.layout, shot);
    this.#shot = shot;
    if (this.#reduced || seconds <= 0) {
      this.#move = null;
      this.#view = to;
      this.#applyView(to);
      return;
    }
    this.#move = { from: { ...this.#view }, to, t: 0, seconds };
  }

  get shot(): CameraShot {
    return this.#shot;
  }

  animate(actor: string, animation: string): Promise<void> {
    const a = this.#actors.get(actor);
    if (!a || !a.animator.has(animation)) {
      this.#emit({ type: 'error', message: `${actor} cannot play "${animation}"` });
      return Promise.resolve();
    }
    // Dialogue on/off: "talk" starts the talk ↔ idle alternation, "idle" ends it.
    if (animation === 'talk' || animation === 'idle') {
      a.animator.setTalking(animation === 'talk');
      return Promise.resolve();
    }
    const anim = this.#data.animations.characters.get(a.member.character)!.animations.get(animation)!;
    const result = a.animator.trigger(animation);
    if (anim.loop || result === 'unknown') return Promise.resolve();
    return new Promise((resolve) => {
      const list = this.#waiting.get(actor) ?? [];
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      list.push({ animation, resolve: finish });
      this.#waiting.set(actor, list);
      const duration = anim.kind === 'tracks' ? anim.duration : 1;
      this.#setTimer(finish, (duration + (result === 'queued' ? 3 : 0.75)) * 1000);
    });
  }

  /** Dialogue streaming on/off for one actor (talk ↔ idle alternation). */
  setTalking(actor: string, on: boolean): void {
    this.#actors.get(actor)?.animator.setTalking(on);
    for (const [id, a] of this.#actors) a.sprite.setTint(on && id !== actor && this.#shot.startsWith('close_') ? 0.72 : 1);
  }

  system(animation: SystemAnimationId): Promise<void> {
    if (!this.#data.animations.system.has(animation)) {
      this.#emit({ type: 'error', message: `No system animation "${animation}"` });
      return Promise.resolve();
    }
    const timeline = new SystemTimeline(this.#data.animations, animation);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      this.#systems.push({ timeline, resolve: finish });
      this.#setTimer(finish, (timeline.duration + 1) * 1000);
    });
  }

  lighting_(mood: LightingMood, seconds?: number): void {
    this.lighting.set(mood, this.#reduced ? 0 : seconds);
  }

  callout(text: string, style: CalloutStyle): void {
    this.#emit({ type: 'callout', text, style });
  }

  prop(state: PropState): void {
    if (state.prop === 'ballot_box') {
      this.#ballotLid.position.y = state.state === 'open' ? 22 : 16.5;
      this.#ballotLid.rotation.z = state.state === 'open' ? 0.5 : 0;
    } else {
      (this.#screenGlow.material as THREE.MeshBasicMaterial).opacity = state.state === 'on' ? 0.35 : 0;
    }
  }

  fx(effect: 'shake' | 'flash' | 'impact' | 'sweat' | 'tears', actor?: string): void {
    const a = actor ? this.#actors.get(actor) : undefined;
    switch (effect) {
      case 'shake':
        if (!this.#reduced) this.#shake = 1;
        break;
      case 'flash':
        this.lighting.flash();
        this.#emit({ type: 'overlay', effect: 'flash' });
        break;
      case 'impact':
        a?.sprite.punch();
        if (!this.#reduced) this.#shake = Math.max(this.#shake, 0.5);
        this.#emit({ type: 'overlay', effect: 'impact' });
        break;
      case 'sweat':
      case 'tears':
        if (a && !this.#reduced) {
          const origin = a.sprite.object.position.clone().add(new THREE.Vector3(0, 50, 2));
          const burst = new DropletBurst(origin, effect === 'sweat' ? '#BDF5FF' : '#7FA9E6', effect === 'sweat' ? 4 : 6, this.#random);
          this.#bursts.push(burst);
          this.#fx.add(burst.object);
        }
        break;
    }
  }

  subscribe(listener: (signal: SceneSignal) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /* Runtime */

  setViewport(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  setReducedMotion(reduced: boolean): void {
    this.#reduced = reduced;
    if (reduced && this.#move) {
      this.#view = this.#move.to;
      this.#move = null;
    }
  }

  actor(id: string): { sprite: SpriteActor; animator: CharacterAnimator } | undefined {
    return this.#actors.get(id);
  }

  get actors(): readonly string[] {
    return [...this.#actors.keys()];
  }

  /** Advance everything by dt seconds (clamped so a background tab doesn't jump). */
  update(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    this.#time += dt;
    this.lighting.update(dt);

    for (const [id, a] of this.#actors) {
      const frame = a.animator.update(dt);
      a.sprite.apply(frame, dt);
      a.sprite.face(this.camera);
      for (const e of a.animator.drainEvents()) {
        if (e.type === 'fx') this.fx(e.fx, id);
        else if (e.type === 'start' && e.callout) this.#emit({ type: 'callout', text: e.callout, style: styleFor(e.animation, a.member.character), actor: id });
        else if (e.type === 'end') {
          this.#emit({ type: 'animation-end', actor: id, animation: e.animation });
          const list = this.#waiting.get(id);
          const i = list?.findIndex((w) => w.animation === e.animation) ?? -1;
          if (list && i >= 0) list.splice(i, 1)[0]!.resolve();
        }
      }
    }

    for (let i = this.#systems.length - 1; i >= 0; i--) {
      const run = this.#systems[i]!;
      const tick = run.timeline.update(dt);
      for (const step of tick.steps) this.#bindAction(run.timeline.id as SystemAnimationId, step.action, step.sound);
      if (tick.done) {
        this.#systems.splice(i, 1);
        run.resolve();
      }
    }

    for (let i = this.#bursts.length - 1; i >= 0; i--) {
      if (!this.#bursts[i]!.update(dt)) {
        this.#fx.remove(this.#bursts[i]!.object);
        this.#bursts.splice(i, 1);
      }
    }

    if (this.#move) {
      const m = this.#move;
      m.t = Math.min(1, m.t + dt / m.seconds);
      const k = ease(m.t);
      const lerp3 = (a: readonly number[], b: readonly number[]) => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * k) as unknown as CameraPreset['pos'];
      this.#view = { pos: lerp3(m.from.pos, m.to.pos), target: lerp3(m.from.target, m.to.target), fov: m.from.fov + (m.to.fov - m.from.fov) * k };
      if (m.t >= 1) this.#move = null;
    }
    this.#applyView(this.#view);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
    this.#listeners.clear();
  }

  #applyView(view: CameraPreset): void {
    const drift = this.#reduced ? 0 : 1;
    const shake = this.#shake;
    this.#shake = Math.max(0, this.#shake - 0.05);
    const jitter = () => (this.#random() - 0.5) * 2.4 * shake;
    this.camera.position.set(
      view.pos[0] + Math.sin(this.#time * 0.35) * 0.6 * drift + jitter(),
      view.pos[1] + Math.sin(this.#time * 0.5) * 0.35 * drift + jitter(),
      view.pos[2] + jitter(),
    );
    if (this.camera.fov !== view.fov) {
      this.camera.fov = view.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(view.target[0], view.target[1], view.target[2]);
  }

  #bindAction(animation: SystemAnimationId, action: string, sound?: string): void {
    const signal: SceneSignal = sound ? { type: 'action', animation, action, sound } : { type: 'action', animation, action };
    this.#emit(signal);
    const juror = /^seat_(\d+)$/.exec(action);
    if (juror) {
      void this.animate(`juror-${juror[1]}`, 'react_happy');
      return;
    }
    switch (action) {
      case 'doors_open':
        this.cameraTo('pov_entrance', 0);
        this.cameraTo('pov_well', 2.2);
        break;
      case 'spotlight_on':
        this.lighting_('spotlight', 0.6);
        break;
      case 'ballot_rise':
        this.prop({ prop: 'ballot_box', state: 'open' });
        break;
      case 'sealed_box_shut':
        this.prop({ prop: 'ballot_box', state: 'sealed' });
        this.fx('shake');
        break;
      case 'seals_unlock':
        this.prop({ prop: 'ballot_box', state: 'open' });
        break;
      case 'gavel_strike':
        this.fx('shake');
        this.fx('flash');
        if (this.#actors.has('judge')) this.#actors.get('judge')!.animator.trigger('react_angry');
        break;
      case 'lighting_shift_red':
        this.lighting_('guilty', 0.4);
        break;
      case 'lighting_shift_green':
        this.lighting_('acquitted', 0.4);
        break;
      case 'card_no_verdict':
        this.lighting_('mistrial', 0.6);
        break;
      default:
        break;
    }
  }

  #emit(signal: SceneSignal): void {
    for (const fn of [...this.#listeners]) fn(signal);
  }
}

function styleFor(animation: string, character: string): CalloutStyle {
  if (animation !== 'objection') return 'verdict';
  if (character === 'judge' || character === 'bailiff') return 'order';
  if (character === 'defense') return 'counter';
  return 'objection';
}

/**
 * The ScenePort view of a runtime. The port's `camera()` / `lighting()` method
 * names collide with the runtime's `camera` / `lighting` properties, so the
 * runtime implements them as `cameraTo` / `lighting_` and this adapter exposes
 * the port shape.
 */
export function asScenePort(runtime: CourtroomRuntime): ScenePort {
  return {
    id: 'three',
    ready: () => runtime.ready(),
    setCast: (cast) => runtime.setCast(cast),
    camera: (shot, seconds) => runtime.cameraTo(shot, seconds),
    animate: (actor, animation) => runtime.animate(actor, animation),
    system: (animation) => runtime.system(animation),
    lighting: (mood, seconds) => runtime.lighting_(mood, seconds),
    callout: (text, style) => runtime.callout(text, style),
    prop: (state) => runtime.prop(state),
    fx: (effect, actor) => runtime.fx(effect, actor),
    subscribe: (listener) => runtime.subscribe(listener),
  };
}

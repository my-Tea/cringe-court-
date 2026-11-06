/**
 * RoamRenderer: three.js scene for the first-person courtroom. Reads the
 * controller every frame (camera, NPC heads/poses, remote avatars, focus,
 * mood) and never writes back. Quality presets switch shadows, lights and the
 * far plane; the pixel-art downscale itself is the canvas resolution (see
 * RoamCourtroom). Post-processing runs at that low resolution, so it is cheap:
 * medium adds bloom on lamps and glass, high adds ambient occlusion in the
 * corners. Every level tone-maps (neutral, so palette hues hold).
 */
import type { LightingMood } from '@cringe-court/core';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { CastFile } from '../cast';
import type { RoamController } from '../controller';
import { THIRD_RIG, cameraMode, type PerspectiveChoice } from '../perspective';
import { QUALITY, type QualityLevel, type QualityPreset } from '../quality';
import { ROOM_SCALE } from '../scale';
import { castWithLook, lookKey } from '../look';
import type { AvatarSpec, GateId, PlayerState } from '../types';
import type { RoamBox } from '../world';
import { VoxelAvatar } from './avatar';
import { buildPlazaSky } from './sky';
import { buildWorldMeshes, type WorldMeshes } from './worldMesh';
import { C } from '../palette';

interface Mood {
  ambient: number;
  ambientColor: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  key: number;
  keyColor: string;
  point: number;
  fog: string;
}

/** In-world light colours come from the palette (STYLE-GUIDE §1). */
export const ROAM_MOODS: Readonly<Record<LightingMood, Mood>> = {
  house: { ambient: 0.55, ambientColor: C.gold100, hemiSky: C.gold100, hemiGround: C.neutral700, hemi: 0.9, key: 1.25, keyColor: C.royal100, point: 1, fog: C.neutral900 },
  spotlight: { ambient: 0.32, ambientColor: C.royal100, hemiSky: C.royal100, hemiGround: C.neutral900, hemi: 0.55, key: 1.6, keyColor: C.gold100, point: 0.7, fog: C.neutral900 },
  tense: { ambient: 0.3, ambientColor: C.blue300, hemiSky: C.blue300, hemiGround: C.teal900, hemi: 0.5, key: 0.9, keyColor: C.blue300, point: 0.5, fog: C.teal900 },
  guilty: { ambient: 0.46, ambientColor: C.royal100, hemiSky: C.royal300, hemiGround: C.royal900, hemi: 0.7, key: 1.25, keyColor: C.royal500, point: 0.8, fog: C.royal900 },
  acquitted: { ambient: 0.5, ambientColor: C.gold100, hemiSky: C.green300, hemiGround: C.green700, hemi: 0.7, key: 1.35, keyColor: C.green100, point: 0.9, fog: C.green900 },
  mistrial: { ambient: 0.42, ambientColor: C.neutral300, hemiSky: C.neutral300, hemiGround: C.neutral900, hemi: 0.6, key: 0.8, keyColor: C.neutral300, point: 0.6, fog: C.neutral900 },
  blackout: { ambient: 0.05, ambientColor: C.neutral900, hemiSky: C.neutral900, hemiGround: C.neutral900, hemi: 0.08, key: 0, keyColor: C.neutral900, point: 0.1, fog: C.neutral900 },
};

export interface RoamRendererOptions {
  boxes: readonly RoamBox[];
  cast: CastFile;
  controller: RoamController;
  quality?: QualityLevel;
}

export class RoamRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.6, 1400);
  /** Third-person boom length after wall pull-in, eased back out. */
  #boom: number = THIRD_RIG.distance;
  readonly #controller: RoamController;
  readonly #cast: CastFile;
  readonly #world: WorldMeshes;
  readonly #npcs = new Map<string, VoxelAvatar>();
  readonly #remotes = new Map<string, VoxelAvatar>();
  readonly #ambient = new THREE.AmbientLight(C.gold100, 0.5);
  readonly #hemi = new THREE.HemisphereLight(C.gold100, C.neutral700, 0.9);
  readonly #key = new THREE.DirectionalLight(C.royal100, 1.2);
  readonly #points: THREE.PointLight[] = [];
  readonly #focus: THREE.LineSegments;
  readonly #fog = new THREE.Fog(C.neutral900, 200, 420);
  /** Outdoor aerial perspective: the far islands fade into the sky. */
  readonly #haze = new THREE.Fog(C.blue300, 900, 3000);
  #mood: Mood = ROAM_MOODS.house;
  #moodName: LightingMood = 'house';
  #flash = 0;
  /** Seconds of mood blending left (the blend is ~95% there after 1 s, exact after this). */
  #blendLeft = MOOD_BLEND_SECONDS;
  #flashOn = false;
  #lastFocus: string | null = null;
  #frame = 0;
  #openSky = false;
  #perspective: PerspectiveChoice = 'first';
  readonly #sky = buildPlazaSky();
  #player: VoxelAvatar | null = null;
  #playerSeated: VoxelAvatar | null = null;
  /** The avatar spec the player's meshes were built from (rebuilt when the wardrobe changes it). */
  #playerSpec: AvatarSpec | null = null;
  readonly #gates = new Map<GateId, THREE.Group>();
  readonly #gateMeshes: WorldMeshes[] = [];
  readonly #unsub: () => void;
  #post: Post | null = null;
  preset: QualityPreset;

  constructor(options: RoamRendererOptions) {
    this.#controller = options.controller;
    this.#cast = options.cast;
    this.preset = QUALITY[options.quality ?? 'medium'];
    this.scene.name = 'roam';
    this.scene.background = new THREE.Color(C.neutral900);
    this.scene.fog = this.#fog;
    this.scene.add(this.#sky);
    this.#buildPlayer(options.controller.avatar);
    this.#world = buildWorldMeshes(options.boxes);
    this.scene.add(this.#world.group);
    for (const g of options.controller.world.gates ?? []) {
      const meshes = buildWorldMeshes(g.boxes);
      meshes.group.name = `gate:${g.id}`;
      meshes.group.visible = !options.controller.isGateOpen(g.id);
      for (const m of meshes.group.children) (m as THREE.Mesh).castShadow = false;
      this.#gates.set(g.id, meshes.group);
      this.#gateMeshes.push(meshes);
      this.scene.add(meshes.group);
    }

    // Key light: sunlight through the stained glass behind the bench, raking down the room.
    this.#key.position.set(-40 * ROOM_SCALE, 170, -110 * ROOM_SCALE);
    this.#key.target.position.set(10 * ROOM_SCALE, 0, 30 * ROOM_SCALE);
    const sc = this.#key.shadow.camera;
    sc.left = -110 * ROOM_SCALE;
    sc.right = 110 * ROOM_SCALE;
    sc.top = 150 * ROOM_SCALE;
    sc.bottom = -110 * ROOM_SCALE;
    sc.near = 20;
    sc.far = 420 * ROOM_SCALE;
    this.#key.shadow.bias = -0.0008;
    this.#key.shadow.normalBias = 0.6;
    this.scene.add(this.#ambient, this.#hemi, this.#key, this.#key.target);
    const world = options.controller.world;
    for (const l of world.lights) {
      if (l.kind === 'spot') continue;
      const p = new THREE.PointLight(l.kind === 'window' ? C.blue300 : C.royal100, l.kind === 'window' ? 260 : 420, (l.kind === 'window' ? 90 : 110) * ROOM_SCALE, 1.6);
      p.position.set(...l.pos);
      p.userData.base = p.intensity;
      this.#points.push(p);
      this.scene.add(p);
    }

    for (const n of world.npcs) {
      if (!this.#cast.models[n.model]) continue;
      const a = new VoxelAvatar(this.#cast, n.model, n.seated, n.id);
      a.place(n.pos[0], n.pos[1], n.pos[2], n.yaw);
      this.#npcs.set(n.id, a);
      this.scene.add(a.object);
    }

    // Focus outline: a gold pixel frame around the focused interactable's hull.
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.#focus = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: C.gold300, depthTest: false, transparent: true, opacity: 0.9, fog: false }));
    this.#focus.renderOrder = 10;
    this.#focus.visible = false;
    this.scene.add(this.#focus);

    this.setQuality(this.preset.level);
    this.#unsub = options.controller.subscribe((e) => {
      if (e.type === 'gavel' && !options.controller.reducedMotion) this.flash();
    });
  }

  get drawCalls(): number {
    return this.#world.drawCalls;
  }

  get npcCount(): number {
    return this.#npcs.size;
  }

  setQuality(level: QualityLevel): void {
    this.preset = QUALITY[level];
    const p = this.preset;
    this.#key.castShadow = p.shadowMap > 0;
    if (p.shadowMap > 0 && this.#key.shadow.mapSize.x !== p.shadowMap) {
      this.#key.shadow.mapSize.set(p.shadowMap, p.shadowMap);
      this.#key.shadow.map?.dispose();
      this.#key.shadow.map = null;
    }
    this.#points.forEach((l, i) => (l.visible = i < p.pointLights));
    this.camera.far = this.#openSky ? Math.max(p.far, SUN.far) : p.far;
    this.#fog.far = p.fogFar;
    this.#fog.near = p.fogFar * 0.45;
    this.camera.updateProjectionMatrix();
  }

  /** `auto` is the trailing third person. First person keeps the eye camera. */
  setPerspective(choice: PerspectiveChoice): void {
    this.#perspective = choice;
  }

  /** The camera render() will use (one perspective camera for both views). */
  get viewCamera(): THREE.Camera {
    return this.camera;
  }

  setViewport(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const c = this.#controller;
    this.#frame++;
    const view = c.view();
    const third = cameraMode(this.#perspective) === 'third';
    const pitch = view.pitch + view.shakePitch;
    const yaw = view.yaw + view.shakeYaw;
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (c.avatar !== this.#playerSpec) this.#buildPlayer(c.avatar);
    const showcase = c.panel === 'wardrobe';
    if (this.#attract) this.#placeAttract(dt);
    else if (showcase) this.#placeShowcase(dt);
    else if (third) this.#placeThird(view.eye, view.yaw, view.pitch, c.control === 'cinematic', dt);
    else this.camera.position.set(...view.eye);
    if (!this.#attract) this.#easeFromAttract(dt);
    this.#showPlayer(!this.#attract && (showcase || (third && this.#boom > THIRD_RIG.hideBelow)), dt);
    for (const [id, g] of this.#gates) {
      g.visible = !c.isGateOpen(id);
      if (g.visible && !c.reducedMotion) g.position.y = Math.sin(performance.now() / 500) * 0.6;
    }

    // Mood blend and the gavel flash: only while something is changing (a settled room
    // re-applied nine colours and allocated sixteen THREE.Colors every frame).
    if (c.mood !== this.#moodName) {
      this.#moodName = c.mood;
      this.#blendLeft = MOOD_BLEND_SECONDS;
    }
    if (this.#blendLeft > 0 || this.#flash > 0 || this.#flashOn) {
      const target = ROAM_MOODS[this.#moodName];
      this.#blendLeft = Math.max(0, this.#blendLeft - dt);
      this.#mood = this.#blendLeft > 0 ? blendMood(this.#mood, target, 1 - Math.exp(-dt * 3)) : target;
      this.#flashOn = this.#flash > 0;
      this.#flash = Math.max(0, this.#flash - dt * 3.5);
      this.#applyMood();
    }

    const animate = this.preset.fullRateAnimation || this.#frame % 2 === 0;
    const step = this.preset.fullRateAnimation ? dt : dt * 2;
    const reducedMotion = c.reducedMotion;
    if (animate) {
      for (const s of c.npcStates) {
        const a = this.#npcs.get(s.id);
        if (!a) continue;
        a.object.visible = !s.hidden;
        if (s.hidden) continue;
        a.update(step, s, reducedMotion);
        a.object.rotation.y = s.yaw;
      }
      this.#syncRemotes(c.remotes, step, reducedMotion);
    }

    // Focus outline.
    const focusId = c.focusId;
    if (focusId !== this.#lastFocus) {
      this.#lastFocus = focusId;
      const spec = focusId ? c.world.interactables.find((i) => i.id === focusId) : null;
      this.#focus.visible = !!spec;
      if (spec) {
        const h = spec.hull;
        this.#focus.position.set((h.min[0] + h.max[0]) / 2, (h.min[1] + h.max[1]) / 2, (h.min[2] + h.max[2]) / 2);
        this.#focus.scale.set(h.max[0] - h.min[0] + 0.6, h.max[1] - h.min[1] + 0.6, h.max[2] - h.min[2] + 0.6);
      }
    }
    if (this.#focus.visible) (this.#focus.material as THREE.LineBasicMaterial).opacity = reducedMotion ? 0.9 : 0.65 + Math.sin(performance.now() / 260) * 0.25;

    this.#applyOutside(this.#attract ? 'outside' : c.zone);
    if (this.#sky.visible) this.#sky.position.copy(this.viewCamera.position);
  }

  /**
   * Minecraft's third person: the camera hangs `distance` behind the head along
   * the look direction. A ray from the head finds the first wall in the way and
   * the boom snaps in to it; once clear, the boom eases back out.
   */
  #placeThird(eye: readonly [number, number, number], yaw: number, pitch: number, cinematic: boolean, dt: number): void {
    const px = eye[0];
    const py = eye[1] + THIRD_RIG.lift;
    const pz = eye[2];
    // Backward along the view: lookDir is (-sin·cos, sin, -cos·cos).
    const dx = Math.sin(yaw) * Math.cos(pitch);
    const dy = -Math.sin(pitch);
    const dz = Math.cos(yaw) * Math.cos(pitch);
    const want = cinematic ? THIRD_RIG.cinematic : THIRD_RIG.distance;
    const hit = this.#rayToBoxes(px, py, pz, dx, dy, dz, want);
    const reach = Math.max(0, Math.min(want, hit - THIRD_RIG.margin));
    this.#boom = reach < this.#boom ? reach : this.#boom + (reach - this.#boom) * (1 - Math.exp(-THIRD_RIG.easeOut * dt));
    this.camera.position.set(px + dx * this.#boom, py + dy * this.#boom, pz + dz * this.#boom);
  }

  /** Distance along the ray to the nearest visible box (slab test), or `max`. */
  #rayToBoxes(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number {
    let best = max;
    const inv = [1 / dx, 1 / dy, 1 / dz];
    const o = [ox, oy, oz];
    for (const b of this.#controller.world.boxes) {
      let t0 = 0;
      let t1 = best;
      for (let k = 0; k < 3; k++) {
        let near = (b.f[k]! - o[k]!) * inv[k]!;
        let far = (b.t[k]! - o[k]!) * inv[k]!;
        if (near > far) [near, far] = [far, near];
        if (near > t0) t0 = near;
        if (far < t1) t1 = far;
        if (t0 > t1) break;
      }
      // Ignore boxes the head is already inside (a seat back, a hat brim).
      if (t0 <= t1 && t0 > 0.01) best = t0;
    }
    return best;
  }

  /**
   * The wardrobe mirror shot: the camera swings round in front of the player
   * and looks back at them, so every change shows on the body itself. It aims
   * past the player's left shoulder, which puts them on the left of the frame,
   * clear of the wardrobe panel on the right.
   */
  #placeShowcase(dt: number): void {
    const p = this.#controller.playerState();
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    // The player's own left (yaw 0 faces −Z with the right hand at +X, so left is −X).
    const lx = -Math.cos(p.yaw);
    const lz = Math.sin(p.yaw);
    const want = new THREE.Vector3(p.pos[0] + fx * SHOWCASE.distance, p.pos[1] + SHOWCASE.height, p.pos[2] + fz * SHOWCASE.distance);
    const k = this.#controller.reducedMotion ? 1 : 1 - Math.exp(-4 * dt);
    this.#showcaseAt = this.#showcaseAt ? this.#showcaseAt.lerp(want, k) : want;
    this.camera.position.copy(this.#showcaseAt);
    this.camera.lookAt(p.pos[0] + lx * SHOWCASE.aside, p.pos[1] + SHOWCASE.look, p.pos[2] + lz * SHOWCASE.aside);
    this.#boom = THIRD_RIG.hideBelow;
  }

  #showcaseAt: THREE.Vector3 | null = null;

  /* ── Attract (title screen) ───────────────────────────────────── */

  #attract = false;
  #attractT = 0;
  /** Camera pose when the attract orbit ended, eased away from over ATTRACT.blend seconds. */
  #leave: { pos: THREE.Vector3; quat: THREE.Quaternion; t: number } | null = null;

  /**
   * Title-screen mode: the camera circles the courthouse slowly and the player
   * is hidden. Turning it off glides the camera from the orbit into the
   * player's own view instead of cutting.
   */
  setAttract(on: boolean): void {
    if (on === this.#attract) return;
    this.#attract = on;
    this.#leave = on ? null : { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), t: 0 };
  }

  get attract(): boolean {
    return this.#attract;
  }

  #placeAttract(dt: number): void {
    this.#attractT += this.#controller.reducedMotion ? 0 : dt;
    const a = ATTRACT.start + this.#attractT * ATTRACT.speed;
    const [cx, cy, cz] = ATTRACT.center;
    this.camera.position.set(cx + Math.sin(a) * ATTRACT.radius, cy + ATTRACT.height, cz + Math.cos(a) * ATTRACT.radius);
    this.camera.lookAt(cx, cy, cz);
  }

  #easeFromAttract(dt: number): void {
    const l = this.#leave;
    if (!l) return;
    l.t += dt / ATTRACT.blend;
    if (l.t >= 1 || this.#controller.reducedMotion) {
      this.#leave = null;
      return;
    }
    const k = l.t * l.t * (3 - 2 * l.t);
    this.camera.position.lerpVectors(l.pos, this.camera.position, k);
    this.camera.quaternion.slerpQuaternions(l.quat, this.camera.quaternion, k);
  }

  /** (Re)build the player's standing and seated avatars from a cast model or a wardrobe look. */
  #buildPlayer(spec: AvatarSpec): void {
    for (const a of [this.#player, this.#playerSeated]) {
      if (!a) continue;
      this.scene.remove(a.object);
      a.dispose();
    }
    this.#playerSpec = spec;
    const { cast, model, effect } = avatarSource(this.#cast, spec);
    this.#player = cast.models[model] ? new VoxelAvatar(cast, model, false, 'you', effect) : null;
    this.#playerSeated = cast.models[model]?.sit ? new VoxelAvatar(cast, model, true, 'you-seated') : null;
    for (const a of [this.#player, this.#playerSeated]) {
      if (!a) continue;
      a.object.visible = false;
      this.scene.add(a.object);
    }
  }

  /** The player's own body: standing or seated, hidden in first person or with the camera in their face. */
  #showPlayer(show: boolean, dt: number): void {
    const c = this.#controller;
    const seated = !!c.seat && !!this.#playerSeated;
    const standing = this.#player;
    if (standing) standing.object.visible = show && !seated;
    if (this.#playerSeated) this.#playerSeated.object.visible = show && seated;
    if (!show) return;
    const a = seated ? this.#playerSeated! : standing;
    if (!a) return;
    const p = c.playerState();
    a.place(p.pos[0], p.pos[1], p.pos[2], p.yaw);
    a.update(dt, { pose: seated ? 'sit' : 'stand', headYaw: 0, headPitch: -p.pitch * 0.6, talking: false, speed: p.speed }, c.reducedMotion);
  }

  /** The gavel's white pop. */
  flash(): void {
    this.#flash = 1;
  }

  #applyMood(): void {
    const m = this.#mood;
    this.#ambient.color.set(m.ambientColor);
    this.#ambient.intensity = m.ambient + this.#flash * 1.6;
    this.#hemi.color.set(m.hemiSky);
    this.#hemi.groundColor.set(m.hemiGround);
    this.#hemi.intensity = m.hemi;
    this.#key.color.set(m.keyColor);
    this.#key.intensity = m.key;
    for (const p of this.#points) p.intensity = (p.userData.base as number) * m.point;
    this.#fog.color.set(m.fog);
    if (!this.#openSky) (this.scene.background as THREE.Color).set(m.fog);
  }

  /**
   * Outdoors the indoor fog colour is a flat brown. The grounds keep a blue
   * skydome, a warm afternoon sun from the south-west (so the facade is lit),
   * a pale haze toward the far islands, and a shadow frustum that follows the
   * player instead of the courtroom's fixed one.
   */
  #applyOutside(zone: string | null): void {
    const open = isOutdoor(zone);
    this.#sky.visible = open;
    if (open) {
      if (!this.#openSky) this.#sunMode(true);
      this.scene.fog = this.#haze;
      this.#ambient.color.set(C.blue100);
      this.#ambient.intensity = 0.62 + this.#flash * 1.6;
      this.#hemi.color.set(C.blue100);
      this.#hemi.groundColor.set(C.green700);
      this.#hemi.intensity = 0.95;
      this.#key.color.set(C.gold100);
      this.#key.intensity = 2.1;
      (this.scene.background as THREE.Color).set(C.blue700);
      this.#followSun();
    } else if (this.#openSky) {
      this.#openSky = false;
      this.#sunMode(false);
      this.scene.fog = this.#fog;
      this.#applyMood();
      return;
    }
    this.#openSky = open;
  }

  /** Swap the key light between the courtroom rake and the outdoor sun. */
  #sunMode(outdoor: boolean): void {
    const sc = this.#key.shadow.camera;
    const r = outdoor ? SUN.reach : 1;
    if (outdoor) {
      sc.left = -r;
      sc.right = r;
      sc.top = r;
      sc.bottom = -r;
      sc.near = 10;
      sc.far = SUN.distance * 2.2;
      this.camera.far = Math.max(this.preset.far, SUN.far);
    } else {
      sc.left = -110 * ROOM_SCALE;
      sc.right = 110 * ROOM_SCALE;
      sc.top = 150 * ROOM_SCALE;
      sc.bottom = -110 * ROOM_SCALE;
      sc.near = 20;
      sc.far = 420 * ROOM_SCALE;
      this.#key.position.set(-40 * ROOM_SCALE, 170, -110 * ROOM_SCALE);
      this.#key.target.position.set(10 * ROOM_SCALE, 0, 30 * ROOM_SCALE);
      this.camera.far = this.preset.far;
    }
    sc.updateProjectionMatrix();
    this.camera.updateProjectionMatrix();
  }

  /** Centre the sun's shadow box on the player, snapped to a grid so shadows do not crawl. */
  #followSun(): void {
    const p = this.#attract ? ATTRACT.center : this.#controller.playerState().pos;
    const g = SUN.snap;
    const tx = Math.round(p[0] / g) * g;
    const tz = Math.round(p[2] / g) * g;
    this.#key.target.position.set(tx, p[1], tz);
    this.#key.position.set(tx + SUN.dir[0] * SUN.distance, p[1] + SUN.dir[1] * SUN.distance, tz + SUN.dir[2] * SUN.distance);
  }

  #syncRemotes(list: readonly PlayerState[], dt: number, reduced: boolean): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let a = this.#remotes.get(p.id);
      const key = p.avatar.look ? `look:${lookKey(p.avatar.look)}:${p.avatar.look.effect}` : p.avatar.model;
      if (!a || a.object.userData.key !== key) {
        if (a) {
          this.scene.remove(a.object);
          a.dispose();
        }
        const src = avatarSource(this.#cast, p.avatar);
        const model = src.cast.models[src.model] ? src.model : 'creator';
        a = new VoxelAvatar(src.cast, model, false, p.id, src.effect);
        a.object.userData.key = key;
        this.#remotes.set(p.id, a);
        this.scene.add(a.object);
      }
      a.place(p.pos[0], p.pos[1], p.pos[2], p.yaw);
      a.update(dt, { pose: 'stand', headYaw: 0, headPitch: -p.pitch * 0.5, talking: false, speed: p.speed }, reduced);
    }
    for (const [id, a] of this.#remotes) {
      if (seen.has(id)) continue;
      this.scene.remove(a.object);
      this.#remotes.delete(id);
    }
  }

  render(gl: THREE.WebGLRenderer): void {
    // The shadow map stays enabled on the renderer: toggling it at runtime would
    // need every material recompiled. Quality only toggles the light's castShadow,
    // which three.js tracks in its light state and recompiles for.
    if (!gl.shadowMap.enabled) {
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = TONE_EXPOSURE;
    const level = this.preset.level;
    if (level === 'low') {
      gl.render(this.scene, this.viewCamera);
      return;
    }
    const post = this.#postFor(gl, level);
    post.composer.render();
  }

  /** Build (or resize) the post chain for this level and the canvas's current pixel size. */
  #postFor(gl: THREE.WebGLRenderer, level: QualityLevel): Post {
    const size = gl.getSize(new THREE.Vector2());
    const ratio = gl.getPixelRatio();
    let post = this.#post;
    if (!post || post.gl !== gl || post.level !== level) {
      post?.composer.dispose();
      const composer = new EffectComposer(gl);
      composer.addPass(new RenderPass(this.scene, this.camera));
      if (level === 'high') {
        const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
        ao.updateGtaoMaterial({ radius: 9, distanceExponent: 1.4, thickness: 6, scale: 1.1, samples: 12 });
        ao.blendIntensity = 0.85;
        composer.addPass(ao);
      }
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
      composer.addPass(new OutputPass());
      post = this.#post = { gl, level, composer, w: 0, h: 0, ratio: 0 };
    }
    if (post.w !== size.x || post.h !== size.y || post.ratio !== ratio) {
      post.composer.setPixelRatio(ratio);
      post.composer.setSize(size.x, size.y);
      post.w = size.x;
      post.h = size.y;
      post.ratio = ratio;
    }
    return post;
  }

  dispose(): void {
    this.#unsub();
    for (const g of this.#gateMeshes) g.dispose();
    for (const a of [this.#player, this.#playerSeated, ...this.#remotes.values()]) a?.dispose();
    this.#post?.composer.dispose();
    this.#post = null;
    this.#world.dispose();
    this.#focus.geometry.dispose();
    (this.#focus.material as THREE.Material).dispose();
    this.#sky.geometry.dispose();
    const skyMat = this.#sky.material as THREE.MeshBasicMaterial;
    skyMat.map?.dispose();
    skyMat.dispose();
  }
}

/** Where an avatar's meshes come from: a cast model, or a wardrobe look built into a cast copy. */
function avatarSource(cast: CastFile, spec: AvatarSpec): { cast: CastFile; model: string; effect: string } {
  if (!spec.look) return { cast, model: spec.model, effect: 'none' };
  const key = `${lookKey(spec.look)}`;
  let built = lookCasts.get(cast)?.get(key);
  if (!built) {
    built = castWithLook(cast, spec.look);
    let per = lookCasts.get(cast);
    if (!per) lookCasts.set(cast, (per = new Map()));
    per.set(key, built);
  }
  return { cast: built, model: 'player', effect: spec.look.effect };
}
const lookCasts = new WeakMap<CastFile, Map<string, CastFile>>();

/** The title-screen orbit: around the plaza, the courthouse front in view. World units. */
const ATTRACT = { center: [0, 20, 640] as [number, number, number], radius: 760, height: 250, speed: 0.045, start: 0.55, blend: 1.4 } as const;

/** Wardrobe framing: distance in front of the player, camera height, look height, and how far aside to aim. */
const SHOWCASE = { distance: 92, height: 34, look: 27, aside: 26 } as const;

/** Outdoor zones get the sky, the sun and the haze. */
const OUTDOOR = new Set(['outside', 'arrival', 'wardrobe', 'trials']);
export function isOutdoor(zone: string | null): boolean {
  return zone != null && OUTDOOR.has(zone);
}

/** The afternoon sun: direction toward it (unit-ish), distance, shadow reach, far plane. */
const SUN = { dir: [-0.42, 0.78, 0.46] as const, distance: 900, reach: 520, snap: 48, far: 3400 } as const;

interface Post {
  gl: THREE.WebGLRenderer;
  level: QualityLevel;
  composer: EffectComposer;
  w: number;
  h: number;
  ratio: number;
}

/** Neutral tone mapping darkens mid-tones a little; this brings the swatches back. */
const TONE_EXPOSURE = 1.12;
/** Above sunlit white: only glow materials (lamps, stained glass, screens) pass the threshold. */
const BLOOM = { strength: 0.5, radius: 0.3, threshold: 1.08 } as const;

/** How long a mood change blends before snapping to the target. */
const MOOD_BLEND_SECONDS = 2.5;

function blendMood(a: Mood, b: Mood, k: number): Mood {
  if (k >= 1) return b;
  const n = (x: number, y: number) => x + (y - x) * k;
  const c = (x: string, y: string) => `#${new THREE.Color(x).lerp(new THREE.Color(y), k).getHexString()}`;
  return {
    ambient: n(a.ambient, b.ambient),
    ambientColor: c(a.ambientColor, b.ambientColor),
    hemiSky: c(a.hemiSky, b.hemiSky),
    hemiGround: c(a.hemiGround, b.hemiGround),
    hemi: n(a.hemi, b.hemi),
    key: n(a.key, b.key),
    keyColor: c(a.keyColor, b.keyColor),
    point: n(a.point, b.point),
    fog: c(a.fog, b.fog),
  };
}

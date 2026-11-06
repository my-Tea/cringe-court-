/**
 * RoamRenderer: three.js scene for the first-person courtroom. Reads the
 * controller every frame (camera, NPC heads/poses, remote avatars, focus,
 * mood) and never writes back. Quality presets switch shadows, lights and the
 * far plane; the pixel-art downscale itself is the canvas resolution (see
 * RoamCourtroom), so there is no extra full-screen pass.
 */
import type { LightingMood } from '@cringe-court/core';
import * as THREE from 'three';
import type { CastFile } from '../cast';
import type { RoamController } from '../controller';
import { ISO_RAKE, cameraMode, isoRig, type PerspectiveChoice } from '../perspective';
import { BODY } from '../physics';
import { QUALITY, type QualityLevel, type QualityPreset } from '../quality';
import { ROOM_SCALE } from '../scale';
import type { PlayerState } from '../types';
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
  readonly #isoCam = new THREE.OrthographicCamera(-120, 120, 120, -120, 0.6, 4000);
  /** Cuts the roof off in the indoor isometric view. Constant is the clip height. */
  readonly #clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  #cutY: number | null = null;
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
  #viewW = 16;
  #viewH = 9;
  readonly #sky = buildPlazaSky();
  readonly #player: VoxelAvatar | null;
  readonly #unsub: () => void;
  preset: QualityPreset;

  constructor(options: RoamRendererOptions) {
    this.#controller = options.controller;
    this.#cast = options.cast;
    this.preset = QUALITY[options.quality ?? 'medium'];
    this.scene.name = 'roam';
    this.scene.background = new THREE.Color(C.neutral900);
    this.scene.fog = this.#fog;
    this.scene.add(this.#sky);
    const model = options.controller.avatar.model;
    this.#player = options.cast.models[model] ? new VoxelAvatar(options.cast, model, false, 'you') : null;
    if (this.#player) {
      this.#player.object.visible = false;
      this.scene.add(this.#player.object);
    }
    this.#world = buildWorldMeshes(options.boxes);
    this.scene.add(this.#world.group);

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
      const p = new THREE.PointLight(l.kind === 'window' ? '#BFD7F5' : '#FFD79A', l.kind === 'window' ? 260 : 420, (l.kind === 'window' ? 90 : 110) * ROOM_SCALE, 1.6);
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
    this.camera.far = p.far;
    this.#fog.far = p.fogFar;
    this.#fog.near = p.fogFar * 0.45;
    this.camera.updateProjectionMatrix();
  }

  /** `auto` is the isometric third person. First person keeps the eye camera. */
  setPerspective(choice: PerspectiveChoice): void {
    this.#perspective = choice;
    this.#fitIso();
  }

  /** The camera render() will use. */
  get viewCamera(): THREE.Camera {
    return cameraMode(this.#perspective) === 'iso' ? this.#isoCam : this.camera;
  }

  setViewport(width: number, height: number): void {
    this.#viewW = width;
    this.#viewH = height;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.#fitIso();
  }

  #fitIso(): void {
    const aspect = this.#viewW / Math.max(1, this.#viewH);
    const outside = this.#controller.zone === 'outside';
    const f = isoRig(outside).frustum;
    this.#isoCam.left = -f * aspect;
    this.#isoCam.right = f * aspect;
    this.#isoCam.top = f;
    this.#isoCam.bottom = -f;
    this.#isoCam.updateProjectionMatrix();
  }

  update(dt: number): void {
    const c = this.#controller;
    this.#frame++;
    const view = c.view();
    const iso = cameraMode(this.#perspective) === 'iso';
    if (iso) this.#placeIso(view.eye, c.zone === 'outside');
    else {
      this.#setCutaway(null);
      this.camera.position.set(...view.eye);
      this.camera.rotation.set(view.pitch + view.shakePitch, view.yaw + view.shakeYaw, 0, 'YXZ');
    }
    if (this.#player) {
      const show = iso && !c.seat;
      this.#player.object.visible = show;
      if (show) {
        this.#player.place(view.eye[0], view.eye[1] - BODY.eye, view.eye[2], view.yaw);
        this.#player.update(dt, { pose: 'stand', headYaw: 0, headPitch: 0, talking: false, speed: c.playerState().speed }, c.reducedMotion);
      }
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

    this.#applyOutside(c.zone);
    if (this.#sky.visible) this.#sky.position.copy(this.viewCamera.position);
  }

  /**
   * Fixed rake behind the player. Indoors the roof slab is clipped off and the
   * camera sits above the room. Collision solids are extruded to the ceiling
   * and would pin the camera on every lamp, so only a point that actually sits
   * inside a visible box is walked forward.
   */
  #placeIso(eye: readonly [number, number, number], outside: boolean): void {
    const rig = isoRig(outside);
    const tx = eye[0];
    const ty = eye[1] - BODY.eye + rig.lookY;
    const tz = eye[2];
    const dist = rig.distance;
    let cx = tx + Math.sin(ISO_RAKE.yaw) * Math.cos(ISO_RAKE.pitch) * dist;
    let cy = ty + Math.sin(ISO_RAKE.pitch) * dist;
    let cz = tz + Math.cos(ISO_RAKE.yaw) * Math.cos(ISO_RAKE.pitch) * dist;
    cy = Math.min(cy, rig.ceiling);
    const room = this.#roomAt(tx, tz);
    if (room) {
      const b = room.bounds;
      const m = 14;
      if (b.min[0] + m < b.max[0] - m) cx = Math.min(Math.max(cx, b.min[0] + m), b.max[0] - m);
      if (b.min[2] + m < b.max[2] - m) cz = Math.min(Math.max(cz, b.min[2] + m), b.max[2] - m);
      this.#setCutaway(room.id === 'outside' ? null : b.max[1] - 8);
    } else this.#setCutaway(null);
    const cleared = this.#clearOfBoxes(tx, ty, tz, cx, cy, cz);
    this.#isoCam.position.set(cleared[0], cleared[1], cleared[2]);
    this.#isoCam.lookAt(tx, ty, tz);
    this.#fitIso();
  }

  /** Hide the roof slab so the isometric view looks into the room. */
  #setCutaway(y: number | null): void {
    if (y === this.#cutY) return;
    this.#cutY = y;
    if (y != null) this.#clip.constant = y;
    const planes = y == null ? null : [this.#clip];
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || mesh === this.#sky) return;
      const mats = mesh.material;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) m.clippingPlanes = planes;
    });
  }

  #roomAt(x: number, z: number) {
    return this.#controller.world.rooms.find((r) => x >= r.bounds.min[0] && x <= r.bounds.max[0] && z >= r.bounds.min[2] && z <= r.bounds.max[2]);
  }

  /** Step the camera toward the player until it is not buried in a visible box. */
  #clearOfBoxes(ox: number, oy: number, oz: number, cx: number, cy: number, cz: number): [number, number, number] {
    const boxes = this.#controller.world.boxes;
    const pad = 2;
    const inside = (x: number, y: number, z: number) => {
      for (const b of boxes) {
        if (y < b.f[1] - pad || y > b.t[1] + pad) continue;
        if (x < b.f[0] - pad || x > b.t[0] + pad) continue;
        if (z < b.f[2] - pad || z > b.t[2] + pad) continue;
        return true;
      }
      return false;
    };
    if (!inside(cx, cy, cz)) return [cx, cy, cz];
    for (let i = 1; i <= 16; i++) {
      const k = i / 16;
      const x = cx + (ox - cx) * k;
      const y = cy + (oy - cy) * k;
      const z = cz + (oz - cz) * k;
      if (!inside(x, y, z)) return [x, y, z];
    }
    return [ox + (cx - ox) * 0.2, oy + (cy - oy) * 0.2, oz + (cz - oz) * 0.2];
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
   * Outdoors the indoor fog colour is a flat brown. The plaza keeps a blue
   * skydome and daylight, and drops distance fog so the facade stays readable.
   */
  #applyOutside(zone: string | null): void {
    const open = zone === 'outside';
    this.#sky.visible = open;
    if (open) {
      this.scene.fog = null;
      this.#ambient.color.set(C.blue100);
      this.#ambient.intensity = 0.75 + this.#flash * 1.6;
      this.#hemi.color.set(C.blue300);
      this.#hemi.groundColor.set(C.neutral300);
      this.#hemi.intensity = 1.1;
      this.#key.color.set(C.gold100);
      this.#key.intensity = 1.5;
      (this.scene.background as THREE.Color).set(C.blue700);
    } else if (this.#openSky) {
      this.#openSky = false;
      this.scene.fog = this.#fog;
      this.#applyMood();
      return;
    }
    this.#openSky = open;
  }

  #syncRemotes(list: readonly PlayerState[], dt: number, reduced: boolean): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let a = this.#remotes.get(p.id);
      if (!a || a.model !== p.avatar.model) {
        if (a) this.scene.remove(a.object);
        const model = this.#cast.models[p.avatar.model] ? p.avatar.model : 'creator';
        a = new VoxelAvatar(this.#cast, model, false, p.id);
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
      gl.shadowMap.type = THREE.PCFShadowMap;
    }
    const clip = this.#cutY != null;
    if (gl.localClippingEnabled !== clip) gl.localClippingEnabled = clip;
    gl.render(this.scene, this.viewCamera);
  }

  dispose(): void {
    this.#unsub();
    this.#world.dispose();
    this.#focus.geometry.dispose();
    (this.#focus.material as THREE.Material).dispose();
    this.#sky.geometry.dispose();
    const skyMat = this.#sky.material as THREE.MeshBasicMaterial;
    skyMat.map?.dispose();
    skyMat.dispose();
  }
}

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

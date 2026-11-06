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
import { QUALITY, type QualityLevel, type QualityPreset } from '../quality';
import type { PlayerState } from '../types';
import type { RoamBox } from '../world';
import { VoxelAvatar } from './avatar';
import { buildWorldMeshes, type WorldMeshes } from './worldMesh';

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
  house: { ambient: 0.55, ambientColor: '#FFF2C7', hemiSky: '#FFF2C7', hemiGround: '#7B645A', hemi: 0.9, key: 1.25, keyColor: '#FFD79A', point: 1, fog: '#4A3A32' },
  spotlight: { ambient: 0.32, ambientColor: '#FFD79A', hemiSky: '#FFD79A', hemiGround: '#4A3A32', hemi: 0.55, key: 1.6, keyColor: '#FFF2C7', point: 0.7, fog: '#4A3A32' },
  tense: { ambient: 0.3, ambientColor: '#BFD7F5', hemiSky: '#BFD7F5', hemiGround: '#2E5F73', hemi: 0.5, key: 0.9, keyColor: '#BFD7F5', point: 0.5, fog: '#2E5F73' },
  guilty: { ambient: 0.46, ambientColor: '#FFD79A', hemiSky: '#E07A3F', hemiGround: '#7A1C2E', hemi: 0.7, key: 1.25, keyColor: '#CE4A44', point: 0.8, fog: '#7A1C2E' },
  acquitted: { ambient: 0.5, ambientColor: '#FFF2C7', hemiSky: '#A9D98F', hemiGround: '#3E7F50', hemi: 0.7, key: 1.35, keyColor: '#DFF3D6', point: 0.9, fog: '#1F5B3A' },
  mistrial: { ambient: 0.42, ambientColor: '#DCC8B0', hemiSky: '#DCC8B0', hemiGround: '#4A3A32', hemi: 0.6, key: 0.8, keyColor: '#DCC8B0', point: 0.6, fog: '#4A3A32' },
  blackout: { ambient: 0.05, ambientColor: '#4A3A32', hemiSky: '#4A3A32', hemiGround: '#4A3A32', hemi: 0.08, key: 0, keyColor: '#4A3A32', point: 0.1, fog: '#4A3A32' },
};

export interface RoamRendererOptions {
  boxes: readonly RoamBox[];
  cast: CastFile;
  controller: RoamController;
  quality?: QualityLevel;
}

export class RoamRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.6, 560);
  readonly #controller: RoamController;
  readonly #cast: CastFile;
  readonly #world: WorldMeshes;
  readonly #npcs = new Map<string, VoxelAvatar>();
  readonly #remotes = new Map<string, VoxelAvatar>();
  readonly #ambient = new THREE.AmbientLight('#FFF2C7', 0.5);
  readonly #hemi = new THREE.HemisphereLight('#FFF2C7', '#7B645A', 0.9);
  readonly #key = new THREE.DirectionalLight('#FFD79A', 1.2);
  readonly #points: THREE.PointLight[] = [];
  readonly #focus: THREE.LineSegments;
  readonly #fog = new THREE.Fog('#4A3A32', 200, 420);
  #mood: Mood = ROAM_MOODS.house;
  #moodName: LightingMood = 'house';
  #flash = 0;
  #lastFocus: string | null = null;
  #frame = 0;
  readonly #unsub: () => void;
  preset: QualityPreset;

  constructor(options: RoamRendererOptions) {
    this.#controller = options.controller;
    this.#cast = options.cast;
    this.preset = QUALITY[options.quality ?? 'medium'];
    this.scene.name = 'roam';
    this.scene.background = new THREE.Color('#4A3A32');
    this.scene.fog = this.#fog;
    this.#world = buildWorldMeshes(options.boxes);
    this.scene.add(this.#world.group);

    // Key light: sunlight through the stained glass behind the bench, raking down the room.
    this.#key.position.set(-40, 170, -110);
    this.#key.target.position.set(10, 0, 30);
    const sc = this.#key.shadow.camera;
    sc.left = -110;
    sc.right = 110;
    sc.top = 150;
    sc.bottom = -110;
    sc.near = 20;
    sc.far = 420;
    this.#key.shadow.bias = -0.0008;
    this.#key.shadow.normalBias = 0.6;
    this.scene.add(this.#ambient, this.#hemi, this.#key, this.#key.target);
    const world = options.controller.world;
    for (const l of world.lights) {
      if (l.kind === 'spot') continue;
      const p = new THREE.PointLight(l.kind === 'window' ? '#BFD7F5' : '#FFD79A', l.kind === 'window' ? 260 : 420, l.kind === 'window' ? 90 : 110, 1.6);
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
    this.#focus = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#F6C75B', depthTest: false, transparent: true, opacity: 0.9, fog: false }));
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

  setViewport(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const c = this.#controller;
    this.#frame++;
    const view = c.view();
    this.camera.position.set(...view.eye);
    this.camera.rotation.set(view.pitch + view.shakePitch, view.yaw + view.shakeYaw, 0, 'YXZ');

    // Mood blend and the gavel flash.
    if (c.mood !== this.#moodName) this.#moodName = c.mood;
    const target = ROAM_MOODS[this.#moodName];
    const k = 1 - Math.exp(-dt * 3);
    this.#mood = blendMood(this.#mood, target, k);
    this.#flash = Math.max(0, this.#flash - dt * 3.5);
    this.#applyMood();

    const animate = this.preset.fullRateAnimation || this.#frame % 2 === 0;
    const step = this.preset.fullRateAnimation ? dt : dt * 2;
    const reducedMotion = c.reducedMotion;
    if (animate) {
      for (const s of c.npcStates) {
        this.#npcs.get(s.id)?.update(step, s, reducedMotion);
        const a = this.#npcs.get(s.id);
        if (a) a.object.rotation.y = s.yaw;
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
    (this.scene.background as THREE.Color).set(m.fog);
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
    gl.render(this.scene, this.camera);
  }

  dispose(): void {
    this.#unsub();
    this.#world.dispose();
    this.#focus.geometry.dispose();
    (this.#focus.material as THREE.Material).dispose();
  }
}

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

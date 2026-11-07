/**
 * Drop-in hero from assets/roam/heroes/{id}/hero.glb.
 * Uses AnimationMixer when clips exist; falls back to null so procedural HeroAvatar stays.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAST_SCALE } from '../cast';
import type { NpcPose } from '../types';
import type { AvatarPoseInput, RoamAvatar } from './avatar';
import type { HeroModel } from './heroAvatar';

const POSE_CLIP: Partial<Record<NpcPose, string>> = {
  stand: 'idle',
  sit: 'idle',
  talk: 'talk',
  point: 'point',
  objection: 'objection',
  smug: 'idle',
  lean: 'idle',
  explain: 'talk',
  cross_arms: 'idle',
  thinking: 'idle',
  shock: 'idle',
  panic: 'idle',
  cheer: 'idle',
  victory: 'idle',
  defeat: 'idle',
  facepalm: 'idle',
  gavel: 'gavel',
};

function clipKey(name: string): string {
  const bare = name.replace(/^animation\./, '');
  const parts = bare.split('_');
  return parts[parts.length - 1] ?? bare;
}

export class GlbHeroAvatar implements RoamAvatar {
  readonly object = new THREE.Group();
  readonly #mixer: THREE.AnimationMixer;
  readonly #actions = new Map<string, THREE.AnimationAction>();
  readonly #root: THREE.Object3D;
  #current: string | null = null;

  constructor(
    readonly model: HeroModel,
    scene: THREE.Object3D,
    clips: THREE.AnimationClip[],
    name?: string,
  ) {
    const label = name ?? model;
    this.#root = scene;
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetH = 100 * CAST_SCALE;
    const s = size.y > 0.01 ? targetH / size.y : CAST_SCALE;
    scene.scale.setScalar(s);
    box.setFromObject(scene);
    scene.position.y -= box.min.y;
    // Match procedural heroes: face −Z in world space.
    scene.rotation.y = Math.PI;
    this.object.add(scene);
    this.object.name = `avatar:${label}`;

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(7 * CAST_SCALE, 16),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05;
    this.object.add(shadow);

    this.#mixer = new THREE.AnimationMixer(scene);
    for (const clip of clips) {
      const action = this.#mixer.clipAction(clip);
      this.#actions.set(clip.name, action);
      this.#actions.set(clipKey(clip.name), action);
    }
    this.#play('idle', true);
  }

  place(x: number, y: number, z: number, yaw: number): void {
    this.object.position.set(x, y, z);
    this.object.rotation.y = yaw;
  }

  update(dt: number, s: AvatarPoseInput, _reducedMotion: boolean): void {
    this.#mixer.update(dt);
    // Seated cast (jurors): tuck the mesh slightly so standing GLBs read as sitting.
    this.#root.position.y = s.pose === 'sit' ? -4.5 : 0;
    this.#root.rotation.x = s.pose === 'sit' ? 0.35 : 0;
    let want = POSE_CLIP[s.pose] ?? 'idle';
    if (s.talking && (want === 'idle' || s.pose === 'talk' || s.pose === 'stand' || s.pose === 'sit')) want = 'talk';
    if (want === 'gavel' && !this.#actions.has('gavel')) want = 'objection';
    if (want !== this.#current) this.#play(want, want === 'idle' || want === 'talk');
  }

  #play(key: string, loop: boolean): void {
    const next = this.#actions.get(key) ?? this.#actions.get('idle');
    if (!next) return;
    const prev = this.#current ? this.#actions.get(this.#current) : null;
    if (prev && prev !== next) prev.fadeOut(0.12);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.fadeIn(0.12).play();
    this.#current = key;
    // One-shots fall back to idle when finished.
    if (!loop) {
      const onDone = () => {
        this.#mixer.removeEventListener('finished', onDone);
        if (this.#current === key) this.#play('idle', true);
      };
      this.#mixer.addEventListener('finished', onDone);
    }
  }

  dispose(): void {
    this.#mixer.stopAllAction();
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }
}

/** Load hero GLB when it has usable clips; otherwise null (keep procedural). */
export async function loadGlbHero(model: HeroModel, name?: string): Promise<GlbHeroAvatar | null> {
  try {
    const url = new URL(`../../../assets/roam/heroes/${model}/hero.glb`, import.meta.url).href;
    const gltf = await new GLTFLoader().loadAsync(url);
    if (!gltf.animations.length) return null;
    return new GlbHeroAvatar(model, gltf.scene, gltf.animations, name ?? model);
  } catch {
    return null;
  }
}

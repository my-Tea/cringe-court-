/**
 * Chunky voxel characters from cast.json, rigged at the head and shoulders.
 * NPCs and remote players use the same rig; poses are procedural (the cast is
 * exported unposed) and respect reduced motion (no idle sway).
 */
import * as THREE from 'three';
import { buildCastMeshes, CAST_SCALE, PIVOTS, type CastFile, type GroupMesh, type RigGroup } from '../cast';
import { C } from '../palette';
import type { NpcPose } from '../types';

const geometryCache = new WeakMap<CastFile, Map<string, Record<RigGroup, THREE.BufferGeometry>>>();
let sharedMaterial: THREE.MeshLambertMaterial | null = null;

function material(): THREE.MeshLambertMaterial {
  return (sharedMaterial ??= new THREE.MeshLambertMaterial({ vertexColors: true, name: 'roam:cast' }));
}

function toGeometry(m: GroupMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
}

function geometries(cast: CastFile, model: string, posture: 'stand' | 'sit'): Record<RigGroup, THREE.BufferGeometry> {
  let perCast = geometryCache.get(cast);
  if (!perCast) geometryCache.set(cast, (perCast = new Map()));
  const key = `${model}:${posture}`;
  let hit = perCast.get(key);
  if (!hit) {
    const meshes = buildCastMeshes(cast, model, posture);
    hit = {
      body: toGeometry(meshes.body),
      head: toGeometry(meshes.head),
      armR: toGeometry(meshes.armR),
      armL: toGeometry(meshes.armL),
      legR: toGeometry(meshes.legR),
      legL: toGeometry(meshes.legL),
    };
    perCast.set(key, hit);
  }
  return hit;
}

export interface AvatarPoseInput {
  pose: NpcPose;
  headYaw: number;
  headPitch: number;
  talking: boolean;
  /** Horizontal speed: drives the walk cycle. */
  speed?: number;
}

/** Shared surface for voxel and stylized hero avatars. */
export interface RoamAvatar {
  readonly object: THREE.Object3D;
  readonly model: string;
  place(x: number, y: number, z: number, yaw: number): void;
  update(dt: number, s: AvatarPoseInput, reducedMotion: boolean): void;
  dispose(): void;
}

export class VoxelAvatar implements RoamAvatar {
  readonly object = new THREE.Group();
  readonly #rig = new THREE.Group();
  readonly #head = new THREE.Group();
  readonly #armR = new THREE.Group();
  readonly #armL = new THREE.Group();
  readonly #legR = new THREE.Group();
  readonly #legL = new THREE.Group();
  readonly #fx: AvatarFx | null;
  readonly #seated: boolean;
  #walk = 0;
  #t = Math.random() * 10;
  #poseAge = 0;
  #lastPose: NpcPose = 'stand';

  constructor(
    cast: CastFile,
    readonly model: string,
    seated: boolean,
    name = model,
    effect: string = 'none',
  ) {
    this.#seated = seated && !!cast.models[model]?.sit;
    const posture = this.#seated ? 'sit' : 'stand';
    const g = geometries(cast, model, posture);
    const pivots = PIVOTS[posture];
    const mesh = (geo: THREE.BufferGeometry, label: string) => {
      const m = new THREE.Mesh(geo, material());
      m.name = label;
      m.castShadow = true;
      return m;
    };
    this.#rig.scale.setScalar(CAST_SCALE);
    this.#rig.add(mesh(g.body, 'body'));
    this.#head.position.set(...pivots.head);
    this.#head.add(mesh(g.head, 'head'));
    this.#armR.position.set(...pivots.armR);
    this.#armR.add(mesh(g.armR, 'armR'));
    this.#armL.position.set(...pivots.armL);
    this.#armL.add(mesh(g.armL, 'armL'));
    this.#legR.position.set(...pivots.legR);
    this.#legR.add(mesh(g.legR, 'legR'));
    this.#legL.position.set(...pivots.legL);
    this.#legL.add(mesh(g.legL, 'legL'));
    this.#rig.add(this.#head, this.#armR, this.#armL, this.#legR, this.#legL);
    this.object.add(this.#rig);
    this.#fx = effect !== 'none' ? new AvatarFx(effect) : null;
    if (this.#fx) this.object.add(this.#fx.group);
    this.object.name = `avatar:${name}`;
  }

  /** Feet position and body yaw. */
  place(x: number, y: number, z: number, yaw: number): void {
    this.object.position.set(x, y, z);
    this.object.rotation.y = yaw;
  }

  update(dt: number, s: AvatarPoseInput, reducedMotion: boolean): void {
    this.#t += dt;
    if (s.pose !== this.#lastPose) {
      this.#lastPose = s.pose;
      this.#poseAge = 0;
    }
    this.#poseAge += dt;
    const t = this.#t;
    const calm = reducedMotion ? 0 : 1;
    this.#head.rotation.set(s.headPitch * -1, s.headYaw, 0, 'YXZ');
    let rx = 0;
    let lx = 0;
    let rz = 0;
    let lz = 0;
    let bodyY = 0;
    const speed = s.speed ?? 0;
    let legs = 0;
    if (speed > 1 && !this.#seated) {
      // Minecraft gait: legs and the opposite arms swing together, harder when running.
      this.#walk += dt * speed * 0.12;
      const reach = Math.min(1, speed / 60) * 0.85;
      const sw = Math.sin(this.#walk) * reach * calm;
      rx = sw;
      lx = -sw;
      legs = sw;
      bodyY = Math.abs(Math.cos(this.#walk)) * 1.2 * calm;
    } else {
      // Idle: breathe.
      bodyY = Math.sin(t * 1.7) * 0.4 * calm;
      rz = 0.04;
      lz = -0.04;
    }
    switch (s.pose) {
      case 'gavel': {
        // Raise, then slam (first 0.45 s), then rest raised a touch.
        const k = Math.min(1, this.#poseAge / 0.18);
        const slam = this.#poseAge < 0.18 ? k : Math.max(0, 1 - (this.#poseAge - 0.18) / 0.15);
        rx = 1.2 + 1.4 * slam;
        break;
      }
      case 'point':
        rx = 1.5;
        break;
      case 'objection': {
        const k = Math.min(1, this.#poseAge / 0.18);
        rx = 1.7 * k;
        lx = 0.55 * k;
        rz = -0.4 * k;
        bodyY += Math.abs(Math.sin(Math.min(1, this.#poseAge * 7) * Math.PI)) * 1.6 * calm;
        break;
      }
      case 'cross_arms':
        rx = 1.1;
        lx = 1.1;
        rz = 0.45;
        lz = -0.45;
        break;
      case 'lean':
        rx = 0.55;
        lx = 0.4;
        break;
      case 'explain':
        rx = 0.65 + Math.sin(t * 3) * 0.3 * calm;
        lx = 0.5 + Math.sin(t * 2.6 + 1) * 0.25 * calm;
        break;
      case 'thinking':
        rx = 2.2;
        rz = 0.35;
        break;
      case 'smug':
        rx = 0.35;
        this.#head.rotation.x -= 0.1;
        break;
      case 'cheer':
      case 'victory':
        rx = Math.PI - 0.2 + Math.sin(t * 9) * 0.25 * calm;
        lx = Math.PI - 0.2 - Math.sin(t * 9) * 0.25 * calm;
        bodyY += Math.abs(Math.sin(t * 6)) * 2 * calm;
        break;
      case 'shock':
      case 'panic':
        rx = 0.75;
        lx = 0.75;
        rz = -0.55;
        lz = 0.55;
        bodyY += (1.2 + Math.sin(Math.min(1, this.#poseAge * 9) * Math.PI) * 1.1) * calm;
        this.#head.rotation.x -= 0.2;
        break;
      case 'facepalm':
      case 'defeat':
        rx = s.pose === 'facepalm' ? 2.5 : 0.35;
        rz = 0.35;
        this.#head.rotation.x += 0.35;
        break;
      default:
        break;
    }
    if (s.talking && s.pose !== 'gavel' && s.pose !== 'cheer' && s.pose !== 'victory') {
      rx += (0.5 + Math.sin(t * 5.3) * 0.3) * (reducedMotion ? 0.6 : 1);
      this.#head.rotation.x += Math.sin(t * 11) * 0.05 * calm;
    }
    this.#armR.rotation.set(rx, 0, rz);
    this.#armL.rotation.set(lx, 0, lz);
    this.#legR.rotation.set(-legs, 0, 0);
    this.#legL.rotation.set(legs, 0, 0);
    this.#rig.position.y = bodyY;
    this.#fx?.update(dt, reducedMotion);
  }

  dispose(): void {
    this.#fx?.dispose();
  }
}

/**
 * Wardrobe effects: small glowing voxels around the avatar, bright enough to
 * catch the bloom. World units (the avatar group is unscaled; the rig is not).
 */
class AvatarFx {
  readonly group = new THREE.Group();
  readonly #bits: THREE.Mesh[] = [];
  readonly #geo = new THREE.BoxGeometry(1, 1, 1);
  readonly #mat: THREE.MeshBasicMaterial;
  #t = 0;

  constructor(readonly kind: string) {
    const color = new THREE.Color(kind === 'embers' ? C.royal500 : kind === 'sparkles' ? C.gold100 : C.gold300).multiplyScalar(1.8);
    this.#mat = new THREE.MeshBasicMaterial({ color, transparent: kind === 'embers' || kind === 'sparkles', depthWrite: false });
    const count = kind === 'aura' ? 14 : kind === 'halo' ? 12 : kind === 'sparkles' ? 7 : 9;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.#geo, this.#mat);
      const s = kind === 'aura' ? 2.2 : kind === 'halo' ? 1.5 : 1.3;
      m.scale.setScalar(s);
      this.#bits.push(m);
      this.group.add(m);
    }
    this.group.name = `fx:${kind}`;
    this.update(0, false);
  }

  update(dt: number, reduced: boolean): void {
    this.#t += reduced ? 0 : dt;
    const t = this.#t;
    const n = this.#bits.length;
    this.#bits.forEach((m, i) => {
      const a = (i / n) * Math.PI * 2;
      switch (this.kind) {
        case 'aura':
          m.position.set(Math.cos(a + t * 0.8) * 15, 1 + Math.sin(t * 3 + i) * 0.6, Math.sin(a + t * 0.8) * 15);
          break;
        case 'halo':
          m.position.set(Math.cos(a + t) * 7, 57 + Math.sin(t * 2) * 0.8, Math.sin(a + t) * 7);
          break;
        case 'sparkles': {
          const h = (i * 0.37 + t * 0.12) % 1;
          m.position.set(Math.cos(a + t * 1.4) * (13 + i), 8 + h * 48, Math.sin(a + t * 1.4) * (13 + i));
          m.scale.setScalar(0.6 + Math.abs(Math.sin(t * 5 + i)) * 1.1);
          break;
        }
        default: {
          const h = (i / n + t * 0.35) % 1;
          m.position.set(Math.cos(a * 3) * 9, h * 44, Math.sin(a * 3) * 9 - 2);
          m.scale.setScalar(1.4 * (1 - h) + 0.3);
        }
      }
    });
    if (this.kind === 'embers' || this.kind === 'sparkles') this.#mat.opacity = 0.85;
  }

  dispose(): void {
    this.#geo.dispose();
    this.#mat.dispose();
  }
}

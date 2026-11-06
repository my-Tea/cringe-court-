/**
 * Chunky voxel characters from cast.json, rigged at the head and shoulders.
 * NPCs and remote players use the same rig; poses are procedural (the cast is
 * exported unposed) and respect reduced motion (no idle sway).
 */
import * as THREE from 'three';
import { buildCastMeshes, CAST_SCALE, PIVOTS, type CastFile, type GroupMesh, type RigGroup } from '../cast';
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
    hit = { body: toGeometry(meshes.body), head: toGeometry(meshes.head), armR: toGeometry(meshes.armR), armL: toGeometry(meshes.armL) };
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

export class VoxelAvatar {
  readonly object = new THREE.Group();
  readonly #rig = new THREE.Group();
  readonly #head = new THREE.Group();
  readonly #armR = new THREE.Group();
  readonly #armL = new THREE.Group();
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
    this.#rig.add(this.#head, this.#armR, this.#armL);
    this.object.add(this.#rig);
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
    if (speed > 1 && !this.#seated) {
      this.#walk += dt * speed * 0.18;
      const sw = Math.sin(this.#walk) * 0.7 * calm;
      rx = sw;
      lx = -sw;
      bodyY = Math.abs(Math.cos(this.#walk)) * 1.6 * calm;
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
      case 'cheer':
        rx = Math.PI - 0.2 + Math.sin(t * 9) * 0.25 * calm;
        lx = Math.PI - 0.2 - Math.sin(t * 9) * 0.25 * calm;
        bodyY += Math.abs(Math.sin(t * 6)) * 2 * calm;
        break;
      case 'shock':
        rx = 0.6;
        lx = 0.6;
        rz = -0.5;
        lz = 0.5;
        break;
      case 'facepalm':
        rx = 2.5;
        rz = 0.35;
        break;
      default:
        break;
    }
    if (s.talking && s.pose !== 'gavel' && s.pose !== 'cheer') {
      rx += (0.5 + Math.sin(t * 5.3) * 0.3) * (reducedMotion ? 0.6 : 1);
      this.#head.rotation.x += Math.sin(t * 11) * 0.05 * calm;
    }
    this.#armR.rotation.set(rx, 0, rz);
    this.#armL.rotation.set(lx, 0, lz);
    this.#rig.position.y = bodyY;
  }
}

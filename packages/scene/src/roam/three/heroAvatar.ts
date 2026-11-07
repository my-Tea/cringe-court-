/**
 * Stylized low-poly hero cast (Miss Ratio, Counsel Chaos, Judge, Clerk).
 * Matte materials, readable silhouettes, face acting + multi-phase signature
 * poses (crash-out objection, gavel slam, reactions). Optional GLB via tryLoadHeroGlb.
 */
import * as THREE from 'three';
import { CAST_SCALE } from '../cast';
import type { NpcPose } from '../types';
import type { AvatarPoseInput, RoamAvatar } from './avatar';

export const HERO_MODELS = [
  'prosecutor',
  'defense',
  'judge',
  'clerk',
  'bailiff',
  'defendant',
  'creator',
  'juror',
  'juror-a',
  'juror-b',
  'juror-c',
  'juror-d',
  'juror-e',
  'juror-f',
] as const;
export type HeroModel = (typeof HERO_MODELS)[number];

/** Approximate mesh height in local units before CAST_SCALE matching. */
const HERO_MESH_HEIGHT = 40;

export function isHeroModel(model: string): model is HeroModel {
  return (HERO_MODELS as readonly string[]).includes(model);
}

/** Relative asset path for an optional Tripo/Blender drop-in. */
export function heroGlbUrl(model: HeroModel): string {
  return `assets/roam/heroes/${model}/hero.glb`;
}

interface HeroPalette {
  skin: string;
  primary: string;
  secondary: string;
  accent: string;
  hair: string;
  trim: string;
}

/** Design-bible colours + supporting cast. */
const PALETTE: Readonly<Record<HeroModel, HeroPalette>> = {
  prosecutor: { skin: '#D4A574', primary: '#6B1C2E', secondary: '#2A2430', accent: '#F3EDE2', hair: '#1A1214', trim: '#C9A227' },
  defense: { skin: '#C9956A', primary: '#1F4D3A', secondary: '#1C2430', accent: '#F0E6D2', hair: '#2B1F14', trim: '#B08D57' },
  judge: { skin: '#C9A882', primary: '#121826', secondary: '#2C3344', accent: '#F4F0E8', hair: '#D8D4CC', trim: '#C9A227' },
  clerk: { skin: '#D2A98C', primary: '#5B7A8C', secondary: '#3D5160', accent: '#F0EADF', hair: '#3A2E28', trim: '#8FA5B3' },
  bailiff: { skin: '#C9A882', primary: '#1C2430', secondary: '#121820', accent: '#F0EADF', hair: '#2B1F14', trim: '#C9A227' },
  defendant: { skin: '#D4A574', primary: '#2C3344', secondary: '#1C1820', accent: '#F3EDE2', hair: '#1A1410', trim: '#5B7A8C' },
  creator: { skin: '#D4A574', primary: '#2C3344', secondary: '#1C1820', accent: '#F3EDE2', hair: '#1A1410', trim: '#5B7A8C' },
  juror: { skin: '#D2A98C', primary: '#6B4F3A', secondary: '#2A2430', accent: '#F3EDE2', hair: '#1A1210', trim: '#C9A227' },
  'juror-a': { skin: '#D2A98C', primary: '#6B4F3A', secondary: '#2A2430', accent: '#F3EDE2', hair: '#1A1210', trim: '#C9A227' },
  'juror-b': { skin: '#D4A574', primary: '#3D5160', secondary: '#2A2430', accent: '#F0EADF', hair: '#3A2E28', trim: '#8FA5B3' },
  'juror-c': { skin: '#C9A882', primary: '#4A3A55', secondary: '#2A2430', accent: '#F4F0E8', hair: '#D8D0C4', trim: '#B08D57' },
  'juror-d': { skin: '#D2A98C', primary: '#6B4F3A', secondary: '#2A2430', accent: '#F3EDE2', hair: '#1A1210', trim: '#C9A227' },
  'juror-e': { skin: '#D4A574', primary: '#3D5160', secondary: '#2A2430', accent: '#F0EADF', hair: '#3A2E28', trim: '#8FA5B3' },
  'juror-f': { skin: '#C9A882', primary: '#4A3A55', secondary: '#2A2430', accent: '#F4F0E8', hair: '#D8D0C4', trim: '#B08D57' },
};

type FaceMood = 'neutral' | 'talk' | 'angry' | 'shock' | 'smug' | 'think' | 'panic' | 'sad' | 'cheer';

const mat = (color: string, rough = 0.82) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, flatShading: false });

export class HeroAvatar {
  readonly object = new THREE.Group();
  readonly #rig = new THREE.Group();
  /** Twist / crash lean lives here so facing (−Z) stays on `#rig`. */
  readonly #body = new THREE.Group();
  readonly #head = new THREE.Group();
  readonly #armR = new THREE.Group();
  readonly #armL = new THREE.Group();
  readonly #legR = new THREE.Group();
  readonly #legL = new THREE.Group();
  readonly #torso: THREE.Group;
  readonly #prop: THREE.Object3D | null;
  readonly #browL: THREE.Mesh;
  readonly #browR: THREE.Mesh;
  readonly #eyeL: THREE.Mesh;
  readonly #eyeR: THREE.Mesh;
  readonly #mouth: THREE.Mesh;
  readonly #mats: THREE.Material[] = [];
  #walk = 0;
  #t = Math.random() * 8;
  #poseAge = 0;
  #lastPose: NpcPose = 'stand';
  #browBase = 0.05;

  constructor(
    readonly model: HeroModel,
    name?: string,
  ) {
    const label = name ?? model;
    const p = PALETTE[model];
    const track = (m: THREE.Material) => {
      this.#mats.push(m);
      return m;
    };
    const skinMat = track(mat(p.skin, 0.65));
    const primMat = track(mat(p.primary));
    const secMat = track(mat(p.secondary));
    const hairMat = track(mat(p.hair, 0.75));
    const accentMat = track(mat(p.accent, 0.7));
    const trimMat = track(mat(p.trim, 0.45)) as THREE.MeshStandardMaterial;
    trimMat.metalness = 0.35;
    const darkMat = track(mat('#1A1214', 0.4));
    const mouthMat = track(mat('#5A2A2A', 0.55));

    const legLen = 14;
    const legR = new THREE.Mesh(new THREE.CapsuleGeometry(2.1, legLen - 4.2, 4, 8), secMat);
    const legL = legR.clone();
    legR.castShadow = legL.castShadow = true;
    this.#legR.position.set(3.2, legLen / 2, 0);
    this.#legL.position.set(-3.2, legLen / 2, 0);
    this.#legR.add(legR);
    this.#legL.add(legL);
    const shoe = () => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 6.2), secMat);
      s.position.set(0, -legLen / 2 + 0.4, 1.2);
      s.castShadow = true;
      return s;
    };
    this.#legR.add(shoe());
    this.#legL.add(shoe());

    this.#torso = new THREE.Group();
    this.#torso.position.y = legLen;
    const torsoH = model === 'judge' ? 16 : 14;
    const torsoW = model === 'judge' ? 14 : model === 'defense' ? 11.5 : 10;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(torsoW / 2.4, torsoH - torsoW / 2, 6, 10), primMat);
    body.castShadow = true;
    body.position.y = torsoH / 2;
    this.#torso.add(body);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 2.2, 10), accentMat);
    collar.position.y = torsoH - 1;
    this.#torso.add(collar);
    if (model === 'defense') {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6, 0.6), trimMat);
      tie.position.set(0, torsoH / 2 - 1, 3.2);
      this.#torso.add(tie);
    }
    if (model === 'judge') {
      const fur = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1.4, 6, 16), accentMat);
      fur.rotation.x = Math.PI / 2;
      fur.position.y = torsoH - 2;
      this.#torso.add(fur);
    }

    const armLen = 12;
    const armMesh = () => {
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, armLen - 3.4, 4, 8), primMat);
      a.castShadow = true;
      a.position.y = -armLen / 2;
      return a;
    };
    this.#armR.position.set(torsoW / 2 + 0.6, torsoH - 2, 0);
    this.#armL.position.set(-(torsoW / 2 + 0.6), torsoH - 2, 0);
    this.#armR.add(armMesh());
    this.#armL.add(armMesh());
    this.#torso.add(this.#armR, this.#armL);

    const headY = torsoH + 4.5;
    this.#head.position.y = headY;
    const head = new THREE.Mesh(new THREE.SphereGeometry(5.2, 14, 12), skinMat);
    head.castShadow = true;
    this.#head.add(head);

    // Face: whites + pupils + brows + mouth (animated in #applyFace).
    const mkEye = (x: number) => {
      const white = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), track(mat('#F5F0E8', 0.55)));
      white.position.set(x, 0.55, 4.35);
      white.scale.set(1, 1.05, 0.55);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), darkMat);
      pupil.position.set(0, 0.05, 0.55);
      white.add(pupil);
      return white;
    };
    this.#eyeL = mkEye(1.7);
    this.#eyeR = mkEye(-1.7);
    this.#head.add(this.#eyeL, this.#eyeR);

    this.#browBase = model === 'prosecutor' ? 0.28 : model === 'defense' ? -0.08 : model === 'judge' ? 0.12 : 0.02;
    const mkBrow = (x: number, rot: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.45), hairMat);
      b.position.set(x, 2.35, 4.55);
      b.rotation.z = rot;
      return b;
    };
    this.#browL = mkBrow(1.7, -this.#browBase);
    this.#browR = mkBrow(-1.7, this.#browBase);
    this.#head.add(this.#browL, this.#browR);

    this.#mouth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.5), mouthMat);
    this.#mouth.position.set(0, -1.6, 4.55);
    this.#head.add(this.#mouth);

    if (model === 'prosecutor') {
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 8, 4, 6), hairMat);
      lock.position.set(3.8, 1, 2);
      lock.rotation.z = -0.55;
      lock.castShadow = true;
      this.#head.add(lock);
      const mane = new THREE.Mesh(new THREE.SphereGeometry(5.6, 12, 10), hairMat);
      mane.scale.set(1.05, 0.85, 0.95);
      mane.position.set(0, 1.5, -1.2);
      this.#head.add(mane);
    } else if (model === 'defense') {
      const quiff = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 10), hairMat);
      quiff.scale.set(0.95, 1.35, 0.85);
      quiff.position.set(0, 5.2, 0.5);
      quiff.castShadow = true;
      this.#head.add(quiff);
    } else if (model === 'judge') {
      const silver = new THREE.Mesh(new THREE.SphereGeometry(5.5, 12, 10), hairMat);
      silver.scale.set(1.05, 0.7, 1);
      silver.position.set(0, 2.8, -0.8);
      this.#head.add(silver);
      const beard = new THREE.Mesh(new THREE.SphereGeometry(3.6, 10, 8), accentMat);
      beard.scale.set(0.9, 1.1, 0.7);
      beard.position.set(0, -3.5, 2.5);
      this.#head.add(beard);
    } else {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), hairMat);
      bun.position.set(0, 5.5, -1.5);
      this.#head.add(bun);
      const top = new THREE.Mesh(new THREE.SphereGeometry(5.3, 12, 10), hairMat);
      top.scale.set(1, 0.55, 1);
      top.position.set(0, 2.5, -0.5);
      this.#head.add(top);
    }

    this.#torso.add(this.#head);
    this.#body.add(this.#torso);
    this.#rig.add(this.#legR, this.#legL, this.#body);

    this.#prop = this.#buildProp(model, primMat, trimMat, accentMat, secMat);
    if (this.#prop) this.#armR.add(this.#prop);

    // Match voxel cast height; face −Z.
    this.#rig.scale.setScalar((100 * CAST_SCALE) / HERO_MESH_HEIGHT);
    this.#rig.rotation.y = Math.PI;
    this.object.add(this.#rig);
    this.object.name = `avatar:${label}`;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(7 * CAST_SCALE, 16),
      track(new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false })),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05;
    this.object.add(shadow);
  }

  #buildProp(model: HeroModel, prim: THREE.Material, trim: THREE.Material, accent: THREE.Material, sec: THREE.Material): THREE.Object3D | null {
    if (model === 'judge') {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 10, 8), trim);
      handle.castShadow = true;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 10), trim);
      head.position.y = 6;
      head.castShadow = true;
      g.add(handle, head);
      g.position.set(0, -10, 2);
      g.rotation.z = 0.3;
      return g;
    }
    if (model === 'prosecutor') {
      const folder = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 1.2), accent);
      folder.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.1, 1, 1.3), prim);
      stripe.position.y = 2;
      const g = new THREE.Group();
      g.add(folder, stripe);
      g.position.set(0, -11, 2.5);
      return g;
    }
    if (model === 'defense') {
      const caseBox = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 2.2), sec);
      caseBox.castShadow = true;
      const latch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.4), trim);
      latch.position.set(0, 0.5, 1.2);
      const g = new THREE.Group();
      g.add(caseBox, latch);
      g.position.set(0, -12, 2);
      return g;
    }
    if (model === 'clerk') {
      const board = new THREE.Mesh(new THREE.BoxGeometry(5.5, 7.5, 0.6), accent);
      board.castShadow = true;
      const clip = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.8), trim);
      clip.position.y = 3.5;
      const g = new THREE.Group();
      g.add(board, clip);
      g.position.set(0, -11, 2.2);
      return g;
    }
    return null;
  }

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
    const age = this.#poseAge;
    const calm = reducedMotion ? 0 : 1;
    this.#head.rotation.set(s.headPitch * -1, s.headYaw, 0, 'YXZ');

    let rx = 0.15;
    let lx = 0.15;
    let rz = 0.08;
    let lz = -0.08;
    let bodyLean = 0;
    let bodyTwist = 0;
    let bodyY = Math.sin(t * 1.6) * 0.35 * calm;
    let chin = 0;
    let legs = 0;
    let mood: FaceMood = 'neutral';
    const speed = s.speed ?? 0;

    if (speed > 1) {
      this.#walk += dt * speed * 0.12;
      const reach = Math.min(1, speed / 60) * 0.9;
      const sw = Math.sin(this.#walk) * reach * calm;
      rx = sw;
      lx = -sw;
      legs = sw;
      bodyY = Math.abs(Math.cos(this.#walk)) * 1.4 * calm;
    }

    switch (s.pose) {
      case 'gavel': {
        const raise = Math.min(1, age / 0.28);
        const slam = age < 0.32 ? raise : Math.max(0, 1 - (age - 0.32) / 0.14);
        rx = 0.4 + 2.2 * slam;
        bodyLean = -0.12 * slam;
        bodyY += 0.8 * slam * calm;
        mood = 'angry';
        break;
      }
      case 'point':
        rx = 1.75;
        rz = -0.35;
        bodyLean = 0.1;
        chin = 0.1;
        this.#head.rotation.x -= 0.1;
        mood = this.model === 'prosecutor' ? 'angry' : 'talk';
        break;
      case 'objection': {
        // Miss Ratio: crash-out. Chaos: open-palm twist. Others: sharp raise.
        if (this.model === 'prosecutor') {
          const wind = Math.min(1, age / 0.11);
          const crash = age < 0.12 ? 0 : Math.min(1, (age - 0.12) / 0.18);
          const hold = age < 0.3 ? crash : 1;
          bodyLean = -0.22 * wind + 0.38 * hold;
          bodyTwist = -0.12 * wind + 0.08 * hold;
          bodyY += (1.2 * crash + Math.sin(Math.min(1, age * 8) * Math.PI) * 1.8) * calm;
          rx = 0.35 + 1.85 * hold;
          lx = 0.2 + 0.85 * hold;
          rz = -0.55 * hold;
          lz = 0.35 * hold;
          chin = 0.18 * hold;
          this.#head.rotation.x -= 0.22 * hold;
          this.#head.rotation.z = -0.12 * hold;
          mood = 'angry';
        } else if (this.model === 'defense') {
          const k = Math.min(1, age / 0.2);
          bodyTwist = Math.sin(k * Math.PI) * 0.55;
          bodyLean = -0.22 * k;
          bodyY += Math.abs(Math.sin(k * Math.PI)) * 1.6 * calm;
          rx = 1.15 + 0.35 * k;
          lx = 1.05 + 0.4 * k;
          rz = 0.75 * k;
          lz = -0.65 * k;
          chin = 0.08;
          mood = 'angry';
        } else {
          const k = Math.min(1, age / 0.16);
          rx = 1.7 * k;
          lx = 0.55 * k;
          bodyLean = 0.16 * k;
          mood = 'angry';
        }
        break;
      }
      case 'cross_arms':
        rx = 1.15;
        lx = 1.15;
        rz = 0.55;
        lz = -0.55;
        mood = this.model === 'prosecutor' ? 'smug' : 'think';
        break;
      case 'lean':
        bodyLean = 0.28;
        rx = 0.65;
        lx = 0.45;
        mood = 'talk';
        break;
      case 'explain':
        rx = 0.7 + Math.sin(t * 3.2) * 0.4 * calm;
        lx = 0.55 + Math.sin(t * 2.7 + 1) * 0.35 * calm;
        bodyTwist = Math.sin(t * 1.4) * 0.08 * calm;
        mood = 'talk';
        break;
      case 'thinking':
        rx = 2.1;
        rz = 0.4;
        this.#head.rotation.z = 0.14;
        chin = -0.06;
        mood = 'think';
        break;
      case 'smug':
        bodyLean = -0.08;
        rx = 0.35;
        chin = 0.16;
        this.#head.rotation.x = -0.14;
        this.#head.rotation.y += 0.1;
        mood = 'smug';
        break;
      case 'shock':
        rx = 0.95;
        lx = 0.95;
        rz = -0.65;
        lz = 0.65;
        bodyY += (1.8 + Math.sin(Math.min(1, age * 10) * Math.PI) * 1.2) * calm;
        bodyLean = -0.12;
        this.#head.rotation.x = -0.28;
        mood = 'shock';
        break;
      case 'panic':
        rx = 0.7 + Math.sin(t * 14) * 0.35 * calm;
        lx = 0.7 - Math.sin(t * 14) * 0.35 * calm;
        rz = -0.55;
        lz = 0.55;
        bodyY += 1.4 * calm;
        bodyTwist = Math.sin(t * 9) * 0.15 * calm;
        mood = 'panic';
        break;
      case 'cheer':
      case 'victory':
        rx = Math.PI - 0.25 + Math.sin(t * 8) * 0.2 * calm;
        lx = Math.PI - 0.25 - Math.sin(t * 8) * 0.2 * calm;
        bodyY += Math.abs(Math.sin(t * 6)) * 2.2 * calm;
        chin = 0.12;
        mood = 'cheer';
        break;
      case 'defeat':
        rx = 0.35;
        lx = 0.25;
        bodyLean = 0.32;
        chin = -0.12;
        this.#head.rotation.x = 0.4;
        mood = 'sad';
        break;
      case 'facepalm':
        rx = 2.45;
        lx = 0.35;
        bodyLean = 0.3;
        this.#head.rotation.x = 0.5;
        mood = 'sad';
        break;
      case 'talk':
        mood = 'talk';
        break;
      default:
        break;
    }

    if (s.talking && s.pose !== 'gavel' && s.pose !== 'cheer' && s.pose !== 'victory' && s.pose !== 'objection') {
      rx += (0.45 + Math.sin(t * 5.5) * 0.28) * (reducedMotion ? 0.55 : 1);
      this.#head.rotation.x += Math.sin(t * 10) * 0.04 * calm;
      if (mood === 'neutral') mood = 'talk';
    } else if (s.talking && s.pose === 'objection') {
      // Crash-out lines: keep shouting mouth, light arm pulse after the hit.
      if (age > 0.35) rx += Math.sin(t * 7) * 0.08 * calm;
    }

    this.#armR.rotation.set(rx, 0, rz);
    this.#armL.rotation.set(lx, 0, lz);
    this.#legR.rotation.set(-legs, 0, 0);
    this.#legL.rotation.set(legs, 0, 0);
    this.#torso.rotation.x = bodyLean;
    this.#body.rotation.y = bodyTwist;
    this.#body.position.y = bodyY;
    this.#head.rotation.x += chin;
    this.#applyFace(mood, s.talking || s.pose === 'talk' || s.pose === 'objection', t, calm);
  }

  #applyFace(mood: FaceMood, talking: boolean, t: number, calm: number): void {
    let brow = this.#browBase;
    let browSkew = 0;
    let eye = 1;
    let mouthH = 0.55;
    let mouthW = 1.8;
    let mouthY = -1.6;

    switch (mood) {
      case 'angry':
        brow = this.#browBase + 0.45;
        browSkew = 0.22;
        eye = 0.85;
        mouthH = 0.35;
        mouthW = 2.1;
        mouthY = -1.45;
        break;
      case 'shock':
        brow = this.#browBase - 0.35;
        eye = 1.45;
        mouthH = 1.35;
        mouthW = 1.5;
        mouthY = -1.75;
        break;
      case 'smug':
        brow = this.#browBase + 0.08;
        browSkew = -0.1;
        eye = 0.9;
        mouthH = 0.4;
        mouthW = 2.0;
        mouthY = -1.35;
        break;
      case 'think':
        brow = this.#browBase + 0.18;
        browSkew = 0.15;
        eye = 0.92;
        mouthH = 0.3;
        mouthW = 1.4;
        break;
      case 'panic':
        brow = this.#browBase - 0.25;
        eye = 1.35;
        mouthH = 1.1 + Math.sin(t * 16) * 0.15 * calm;
        mouthW = 1.7;
        break;
      case 'sad':
        brow = this.#browBase - 0.2;
        browSkew = -0.2;
        eye = 0.8;
        mouthH = 0.35;
        mouthW = 1.5;
        mouthY = -1.75;
        break;
      case 'cheer':
        brow = this.#browBase - 0.15;
        eye = 1.1;
        mouthH = 1.0;
        mouthW = 2.2;
        mouthY = -1.4;
        break;
      case 'talk':
        brow = this.#browBase + 0.05;
        mouthH = 0.55 + Math.abs(Math.sin(t * 11)) * 0.75 * (calm || 0.5);
        mouthW = 1.7;
        break;
      default:
        if (talking) {
          mouthH = 0.45 + Math.abs(Math.sin(t * 10)) * 0.65 * (calm || 0.5);
        }
        break;
    }

    this.#browL.rotation.z = -brow - browSkew;
    this.#browR.rotation.z = brow - browSkew;
    this.#browL.position.y = 2.35 + (mood === 'angry' ? -0.15 : mood === 'shock' ? 0.2 : 0);
    this.#browR.position.y = this.#browL.position.y;
    this.#eyeL.scale.set(1, eye, 0.55);
    this.#eyeR.scale.set(1, eye, 0.55);
    this.#mouth.scale.set(mouthW / 1.8, mouthH / 0.55, 1);
    this.#mouth.position.y = mouthY;
  }

  dispose(): void {
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.#mats) m.dispose();
  }
}

/** Optional: load a ready GLB with clips. Prefer `loadGlbHero` from `./glbHero`. */
export async function tryLoadHeroGlb(
  model: HeroModel,
  _url?: string,
  _loader?: { loadAsync: (url: string) => Promise<THREE.Group> },
): Promise<RoamAvatar | null> {
  const { loadGlbHero } = await import('./glbHero');
  return loadGlbHero(model);
}

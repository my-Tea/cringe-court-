/**
 * A character as a camera-facing billboard (ANIMATION-GUIDE §7): one quad per
 * actor, UVs swapped to the current atlas frame, the animator's transform applied
 * in sprite pixels. Cylindrical billboarding (yaw only) keeps feet planted.
 */
import * as THREE from 'three';
import { frameUv, type AtlasFrame, type CharacterAtlas } from '../atlas';
import type { AnimatorFrame } from '../anim/animator';

export class SpriteActor {
  readonly object = new THREE.Group();
  readonly #mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly #shadow: THREE.Mesh;
  readonly #uv: THREE.BufferAttribute;
  #frame: string | null = null;
  #punch = 0;
  #tint = 1;
  #opacity = 1;
  #targetOpacity = 1;

  constructor(
    readonly actor: string,
    readonly character: string,
    readonly atlas: CharacterAtlas,
    texture: THREE.Texture,
    readonly unitsPerPixel: number,
  ) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.translate(0, 0.5, 0); // origin at the bottom centre
    this.#uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
    this.#mesh = new THREE.Mesh(geometry, material);
    this.#mesh.name = `actor:${actor}`;
    this.#mesh.renderOrder = 2;
    this.#shadow = new THREE.Mesh(
      new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color: 0x0b0710, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.#shadow.rotation.x = -Math.PI / 2;
    this.#shadow.position.y = 0.15;
    this.#shadow.scale.set(1, 0.55, 1);
    this.object.name = `actor-root:${actor}`;
    this.object.add(this.#shadow, this.#mesh);
  }

  get frame(): string | null {
    return this.#frame;
  }

  /** Scale punch for the `impact` fx. */
  punch(): void {
    this.#punch = 1;
  }

  /** 0..1 brightness (dim actors who aren't speaking in close-ups). */
  setTint(value: number): void {
    this.#tint = value;
  }

  /** Fade toward an opacity (camera occlusion). */
  fadeTo(opacity: number): void {
    this.#targetOpacity = opacity;
  }

  get opacity(): number {
    return this.#opacity;
  }

  apply(frame: AnimatorFrame, dt: number): void {
    this.#opacity += (this.#targetOpacity - this.#opacity) * Math.min(1, dt * 8);
    const faded = this.#opacity < 0.99;
    this.#mesh.material.opacity = this.#opacity;
    this.#mesh.material.alphaTest = faded ? 0.01 : 0.5;
    this.#mesh.material.depthWrite = !faded;
    this.#shadow.visible = this.#opacity > 0.5;
    const pose = this.atlas.frames[frame.pose] ? frame.pose : 'idle';
    const f = this.atlas.frames[pose]!;
    if (pose !== this.#frame) this.#setFrame(pose, f);
    const k = this.unitsPerPixel;
    const s = frame.transform.scale * (1 + 0.08 * this.#punch);
    this.#punch = Math.max(0, this.#punch - dt * 5);
    // Place the trimmed frame where it sits inside the source canvas, feet on the baseline.
    const centreX = (f.ox + f.w / 2 - this.atlas.canvas.w / 2) * k;
    const bottom = (this.atlas.baseline - (f.oy + f.h)) * k;
    this.#mesh.scale.set(f.w * k * s, f.h * k * s, 1);
    this.#mesh.position.set(centreX * s + frame.transform.x * k, bottom * s - frame.transform.y * k, 0);
    this.#mesh.rotation.z = THREE.MathUtils.degToRad(-frame.transform.rot);
    this.#mesh.material.color.setScalar(this.#tint);
  }

  /** Yaw the billboard toward the camera. */
  face(camera: THREE.Camera): void {
    const p = this.object.getWorldPosition(new THREE.Vector3());
    const c = camera.getWorldPosition(new THREE.Vector3());
    this.#mesh.rotation.y = Math.atan2(c.x - p.x, c.z - p.z) - this.object.rotation.y;
  }

  #setFrame(pose: string, f: AtlasFrame): void {
    const { u0, v0, u1, v1 } = frameUv(this.atlas, f);
    // PlaneGeometry uv order: (0,1) (1,1) (0,0) (1,0).
    this.#uv.setXY(0, u0, v1);
    this.#uv.setXY(1, u1, v1);
    this.#uv.setXY(2, u0, v0);
    this.#uv.setXY(3, u1, v0);
    this.#uv.needsUpdate = true;
    this.#frame = pose;
  }

  dispose(): void {
    this.#mesh.geometry.dispose();
    this.#mesh.material.dispose();
    this.#shadow.geometry.dispose();
    (this.#shadow.material as THREE.Material).dispose();
  }
}

/** Sweat drops / tears: a few falling voxels, removed when done. */
export class DropletBurst {
  readonly object = new THREE.Group();
  #life = 0.9;
  readonly #drops: { mesh: THREE.Mesh; vx: number; vy: number }[] = [];

  constructor(origin: THREE.Vector3, color: THREE.ColorRepresentation, count: number, random: () => number) {
    const geometry = new THREE.BoxGeometry(1.2, 1.6, 1.2);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(origin).add(new THREE.Vector3((random() - 0.5) * 8, random() * 3, (random() - 0.5) * 2));
      this.#drops.push({ mesh, vx: (random() - 0.5) * 18, vy: 10 + random() * 10 });
      this.object.add(mesh);
    }
  }

  /** Returns false when finished. */
  update(dt: number): boolean {
    this.#life -= dt;
    for (const d of this.#drops) {
      d.vy -= 60 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
    }
    const m = this.#drops[0]?.mesh.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = Math.max(0, Math.min(1, this.#life * 2));
    return this.#life > 0;
  }
}

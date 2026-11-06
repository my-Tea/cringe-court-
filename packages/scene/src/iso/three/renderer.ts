/**
 * The isometric town renderer.
 *
 * Reads the controller and the world every frame and never writes back. The
 * static world is merged into one mesh per material (the same strategy the
 * first-person courtroom uses: thousands of boxes, a few dozen draw calls), and
 * everything that moves — the player, NPCs, the focus frame — is a separate
 * object placed by projected depth each frame.
 *
 * Depth on an isometric camera is the interesting part. A z-buffer resolves
 * opaque geometry correctly, but the painter's order still matters for anything
 * that is not purely depth-tested (the focus outline, the hover tint) and for
 * deciding *which* tall prop to draw against a character. So every movable draws
 * with an explicit `renderOrder` derived from its world depth key, and the
 * static batches are broken up by their own extents rather than being one
 * undifferentiated lump.
 */
import * as THREE from 'three';
import { ISO } from '../camera';
import type { IsoController } from '../controller';
import { CELL, depthKey, type TownBox } from '../world';
import { FACE_SHADE } from '../../roam/cast';
import { surfaceFor, surfaceTexture } from '../../roam/three/textures';
import { VoxelAvatar } from '../../roam/three/avatar';
import type { CastFile } from '../../roam/cast';

interface Mood {
  sky: string;
  ambient: number;
  ambientColor: string;
  key: number;
  keyColor: string;
  fill: number;
  fillColor: string;
  fog: string;
  fogNear: number;
  fogFar: number;
}

/** Town moods. Warmer than the courtroom set: this is daylight, not a trial. */
export const TOWN_MOODS: Readonly<Record<'day' | 'dusk' | 'interior', Mood>> = {
  day: {
    sky: '#EAF4FF',
    ambient: 0.72,
    ambientColor: '#FFF9ED',
    key: 1.45,
    keyColor: '#FFF2C7',
    fill: 0.5,
    fillColor: '#BFD7F5',
    fog: '#EAF4FF',
    fogNear: 760,
    fogFar: 1700,
  },
  dusk: {
    sky: '#E07A3F',
    ambient: 0.55,
    ambientColor: '#FFD79A',
    key: 1.15,
    keyColor: '#E07A3F',
    fill: 0.42,
    fillColor: '#2E5F73',
    fog: '#CE4A44',
    fogNear: 700,
    fogFar: 1600,
  },
  interior: {
    sky: '#7B645A',
    ambient: 0.85,
    ambientColor: '#FFF9ED',
    key: 1.3,
    keyColor: '#FFF2C7',
    fill: 0.55,
    fillColor: '#DCC8B0',
    fog: '#7B645A',
    fogNear: 900,
    fogFar: 1900,
  },
};

/** Faces of a box, wound counter-clockwise from outside, with a baked shade. */
/**
 * Half-width of the shadow frustum, in world units.
 *
 * ~7 cells: wide enough to cover the screen, tight enough that 2048 shadow texels
 * give ~0.1 units each. The light rig is re-centred on the player every frame so
 * shadows stay crisp across a map much bigger than the frustum.
 */
const SHADOW_SPAN = 210;

/** World units per texture texel, matched to the roam renderer. */
const UV_SCALE = 1 / (2 * 16);

const FACES = [
  { n: [1, 0, 0], c: [1, 3, 7, 5], shade: FACE_SHADE.px, u: 2, v: 1 },
  { n: [-1, 0, 0], c: [4, 6, 2, 0], shade: FACE_SHADE.nx, u: 2, v: 1 },
  { n: [0, 1, 0], c: [2, 6, 7, 3], shade: FACE_SHADE.py, u: 0, v: 2 },
  { n: [0, -1, 0], c: [0, 1, 5, 4], shade: FACE_SHADE.ny, u: 0, v: 2 },
  { n: [0, 0, 1], c: [4, 5, 7, 6], shade: FACE_SHADE.pz, u: 0, v: 1 },
  { n: [0, 0, -1], c: [1, 0, 2, 3], shade: FACE_SHADE.nz, u: 0, v: 1 },
] as const;

export interface WorldBatch {
  color: string;
  glow: number;
  boxes: number;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/**
 * Merge boxes into one batch per (colour, glow). Pure, so the batching is tested
 * without a GPU: the renderer's asset cost is exactly this function's output.
 */
export function batchWorld(boxes: readonly TownBox[]): WorldBatch[] {
  const groups = new Map<string, TownBox[]>();
  for (const b of boxes) {
    const key = `${b.m}|${b.glow ?? 0}`;
    const list = groups.get(key);
    if (list) list.push(b);
    else groups.set(key, [b]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, list]) => {
      const [color, glow] = key.split('|') as [string, string];
      const verts = list.length * 24;
      const positions = new Float32Array(verts * 3);
      const normals = new Float32Array(verts * 3);
      const colors = new Float32Array(verts * 3);
      const uvs = new Float32Array(verts * 2);
      const indices = new Uint32Array(list.length * 36);
      let v = 0;
      let ix = 0;
      for (const b of list) {
        for (const face of FACES) {
          const base = v;
          for (const corner of face.c) {
            positions[v * 3] = corner & 1 ? b.t[0] : b.f[0];
            positions[v * 3 + 1] = corner & 2 ? b.t[1] : b.f[1];
            positions[v * 3 + 2] = corner & 4 ? b.t[2] : b.f[2];
            normals.set(face.n, v * 3);
            colors.set([face.shade, face.shade, face.shade], v * 3);
            // World-space planar UVs: a face samples its own extent, so a tile
            // is the same size on a 1-cell kerb and a 6-cell wall.
            uvs[v * 2] = positions[v * 3 + face.u]! * UV_SCALE;
            uvs[v * 2 + 1] = positions[v * 3 + face.v]! * UV_SCALE;
            v++;
          }
          indices.set([base, base + 1, base + 2, base, base + 2, base + 3], ix);
          ix += 6;
        }
      }
      return { color, glow: Number(glow), boxes: list.length, positions, normals, colors, uvs, indices };
    });
}

export interface IsoRendererOptions {
  controller: IsoController;
  cast: CastFile;
  /** Render at a fixed internal height for crisp pixels. */
  pixelated?: boolean;
}

export class IsoRenderer {
  readonly scene = new THREE.Scene();
  /** Orthographic: parallel edges stay parallel, which is what makes it read as iso. */
  readonly camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 4000);
  #controller: IsoController;
  #cast: CastFile;
  #world: THREE.Group | null = null;
  #worldMeshes: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = [];
  #player: VoxelAvatar | null = null;
  #npcs = new Map<string, VoxelAvatar>();
  #focus: THREE.LineSegments;
  #ambient = new THREE.AmbientLight('#FFF9ED', 0.7);
  #key = new THREE.DirectionalLight('#FFF2C7', 1.4);
  #fill = new THREE.DirectionalLight('#BFD7F5', 0.5);
  #points: THREE.PointLight[] = [];
  #fog = new THREE.Fog('#EAF4FF', 520, 1100);
  #mood: Mood = TOWN_MOODS.day;
  #moodName: keyof typeof TOWN_MOODS = 'day';
  #frustum = 300;
  #lastMap = '';
  #elapsed = 0;

  constructor(options: IsoRendererOptions) {
    this.#controller = options.controller;
    this.#cast = options.cast;
    this.scene.name = 'iso-town';
    this.scene.background = new THREE.Color('#EAF4FF');
    this.scene.fog = this.#fog;
    this.camera.near = 1;
    this.camera.far = 4000;

    // Key light from the iso camera's own direction, so every visible face is
    // lit and the shading matches the baked face shades in the batches.
    // Light from up-and-camera-right at ~45°: steep enough to light the top
    // faces brightly, shallow enough that shadows fall across the ground toward
    // the viewer instead of hiding directly under each prop.
    this.#key.position.set(240, 420, 520);
    this.#key.target.position.set(0, 0, 0);
    this.#key.castShadow = true;
    this.#key.shadow.mapSize.set(2048, 2048);
    // An orthographic shadow camera wide enough to cover a whole town map.
    const sc = this.#key.shadow.camera;
    sc.left = -SHADOW_SPAN;
    sc.right = SHADOW_SPAN;
    sc.top = SHADOW_SPAN;
    sc.bottom = -SHADOW_SPAN;
    sc.near = 60;
    sc.far = 1800;
    this.#key.shadow.bias = -0.0006;
    this.#key.shadow.normalBias = 0.8;
    this.#fill.position.set(-450, 320, -420);
    this.#fill.target.position.set(0, 0, 0);
    this.scene.add(this.#ambient, this.#key, this.#key.target, this.#fill, this.#fill.target);

    // The focus ring: a gold pixel frame around the focused hull.
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.#focus = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: '#F6C75B', depthTest: false, transparent: true, opacity: 0.9, fog: false }),
    );
    this.#focus.renderOrder = 1000;
    this.#focus.visible = false;
    this.scene.add(this.#focus);

    this.#rebuildWorld();
  }

  get drawCalls(): number {
    return this.#worldMeshes.length + this.#npcs.size + (this.#player ? 1 : 0) + 1;
  }

  /** Half-height of the orthographic frustum, in world units. */
  get frustumHeight(): number {
    return this.#frustum;
  }

  /**
   * Match the camera to the viewport.
   *
   * The vertical extent is fixed in world units so a prop is the same size on
   * screen at any window size — the pixel-art convention, and what stops the
   * town from "zooming" on a wide monitor.
   */
  setViewport(width: number, height: number, pixelHeight = 0): void {
    const aspect = width / Math.max(1, height);
    // Same world-units-per-screen indoors and out. A tighter interior frustum
    // made the hall fill the view and read as a small room.
    this.#frustum = height < 480 ? 190 : height < 760 ? 250 : 300;
    this.camera.left = -this.#frustum * aspect;
    this.camera.right = this.#frustum * aspect;
    this.camera.top = this.#frustum;
    this.camera.bottom = -this.#frustum;
    this.camera.updateProjectionMatrix();
    void pixelHeight;
  }

  /** Rebuild when the map changes. Called from update(); cheap because no-op otherwise. */
  #rebuildWorld(): void {
    const mapId = this.#controller.mapId;
    if (mapId === this.#lastMap && this.#world) return;
    this.#lastMap = mapId;

    if (this.#world) {
      this.scene.remove(this.#world);
      for (const m of this.#worldMeshes) {
        m.geometry.dispose();
        m.material.dispose();
      }
      this.#worldMeshes = [];
    }
    for (const avatar of this.#npcs.values()) {
      this.scene.remove(avatar.object);
      disposeAvatar(avatar);
    }
    this.#npcs.clear();
    for (const p of this.#points) this.scene.remove(p);
    this.#points = [];

    const world = this.#controller.world;
    const group = new THREE.Group();
    group.name = `iso:${mapId}`;
    for (const batch of batchWorld(world.boxes)) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(batch.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(batch.normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(batch.colors, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(batch.uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(batch.indices, 1));
      geometry.computeBoundingSphere();
      const color = new THREE.Color(batch.color);
      const map = surfaceTexture(surfaceFor(batch.color, batch.glow));
      const material =
        batch.glow > 0
          ? new THREE.MeshBasicMaterial({ color, map, vertexColors: true, fog: true })
          : new THREE.MeshLambertMaterial({ color, map, vertexColors: true });
      material.name = `iso:${batch.color}`;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = material.name;
      mesh.castShadow = batch.glow === 0;
      mesh.receiveShadow = batch.glow === 0;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      // Static batches are drawn before every movable; the movables sort
      // themselves against each other by depth.
      mesh.renderOrder = -1;
      group.add(mesh);
      this.#worldMeshes.push({ geometry, material });
    }
    this.#world = group;
    this.scene.add(group);

    // The player: a real cast avatar, so the town has a body, not a camera.
    this.#spawnPlayer();

    // NPCs for this map.
    for (const npc of world.npcs) {
      if (!this.#cast.models[npc.model]) continue;
      const avatar = new VoxelAvatar(this.#cast, npc.model, false, npc.id);
      avatar.place(npc.pos[0], npc.pos[1], npc.pos[2], npc.yaw);
      this.#npcs.set(npc.id, avatar);
      this.scene.add(avatar.object);
    }

    // Map lights.
    for (const l of world.lights) {
      const light = new THREE.PointLight(
        l.kind === 'warm' ? '#FFD79A' : '#BFD7F5',
        900 * l.intensity,
        420,
        1.7,
      );
      light.position.set(l.pos[0], l.pos[1], l.pos[2]);
      this.#points.push(light);
      this.scene.add(light);
    }

    this.#moodName = world.spec.mood ?? 'day';
    this.#mood = TOWN_MOODS[this.#moodName];
    this.#applyMood();
  }

  #spawnPlayer(): void {
    if (this.#player) {
      this.scene.remove(this.#player.object);
      disposeAvatar(this.#player);
      this.#player = null;
    }
    const snap = this.#controller.snapshot();
    const model = this.#pickPlayerModel();
    if (!this.#cast.models[model]) return;
    this.#player = new VoxelAvatar(this.#cast, model, false, 'player');
    this.#player.place(snap.pos[0], snap.pos[1], snap.pos[2], snap.yaw);
    this.#player.object.renderOrder = 1;
    this.scene.add(this.#player.object);
  }

  /** The defendant avatar is the player in the town, matching the trial. */
  #pickPlayerModel(): string {
    const available = Object.keys(this.#cast.models);
    for (const preferred of ['defendant', 'creator', 'side-a', 'judge']) {
      if (available.includes(preferred)) return preferred;
    }
    return available[0] ?? '';
  }

  update(dt: number): void {
    this.#elapsed += dt;
    this.#rebuildWorld();

    const c = this.#controller;
    const snap = c.snapshot();

    // Camera: position from the rig, looking down the fixed iso rake.
    const [cx, cy, cz] = c.camera.position();
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(c.camera.target.x, c.camera.target.y, c.camera.target.z);

    // Mood.
    if (c.world.spec.mood && c.world.spec.mood !== this.#moodName) {
      this.#moodName = c.world.spec.mood;
      this.#mood = TOWN_MOODS[this.#moodName];
      this.#applyMood();
    }

    // Keep the shadow frustum over the player. Moving the light and its target
    // together slides the frustum without changing the light direction, so the
    // shading never shifts as you walk.
    const keyTarget = this.#key.target;
    keyTarget.position.set(snap.pos[0], 0, snap.pos[2]);
    // Same direction as the initial rig, slid to follow the player.
    this.#key.position.set(snap.pos[0] + 240, 420, snap.pos[2] + 520);

    // Player: a walking body that faces where it travels.
    if (this.#player) {
      this.#player.place(snap.pos[0], snap.pos[1], snap.pos[2], snap.yaw);
      this.#player.object.renderOrder = drawOrderOf(snap.pos[0], snap.pos[1], snap.pos[2]);
      // The cast's walk cycle reads `speed` in body units; the town moves at a
      // different scale, so normalise so the legs do not spin.
      const speaker = snap.dialogue?.node?.speaker ?? null;
      this.#player.update(dt, { pose: 'stand', speed: snap.speed / 52, talking: speaker === 'player', headYaw: 0, headPitch: 0 }, false);
    }

    // NPCs: idle, with a head turn toward the player when close.
    for (const [id, avatar] of this.#npcs) {
      const npc = c.world.npcs.find((n) => n.id === id);
      if (!npc) continue;
      const dx = snap.pos[0] - npc.pos[0];
      const dz = snap.pos[2] - npc.pos[2];
      const dist = Math.hypot(dx, dz);
      const headYaw = dist < 140 ? clamp(Math.atan2(dx, dz) - npc.yaw, -0.9, 0.9) : 0;
      const speaker = snap.dialogue?.node?.speaker ?? null;
      avatar.place(npc.pos[0], npc.pos[1], npc.pos[2], npc.yaw);
      avatar.object.renderOrder = drawOrderOf(npc.pos[0], npc.pos[1], npc.pos[2]);
      avatar.update(dt, { pose: 'stand', speed: 0, talking: speaker === id || speaker === npc.id, headYaw, headPitch: 0 }, false);
    }

    // Focus ring.
    const focus = snap.focus;
    if (focus) {
      const spec = c.world.interactables.find((i) => i.id === focus.id);
      if (spec) {
        const h = spec.hull;
        this.#focus.visible = true;
        this.#focus.position.set((h.min[0] + h.max[0]) / 2, (h.min[1] + h.max[1]) / 2, (h.min[2] + h.max[2]) / 2);
        this.#focus.scale.set(h.max[0] - h.min[0] + 1.2, h.max[1] - h.min[1] + 1.2, h.max[2] - h.min[2] + 1.2);
        this.#focus.renderOrder = 1000;
      }
    } else {
      this.#focus.visible = false;
    }
    if (this.#focus.visible) {
      (this.#focus.material as THREE.LineBasicMaterial).opacity = 0.65 + Math.sin(this.#elapsed * 4) * 0.25;
    }
  }

  #applyMood(): void {
    const m = this.#mood;
    this.scene.background = new THREE.Color(m.sky);
    this.#fog.color = new THREE.Color(m.fog);
    this.#fog.near = m.fogNear;
    this.#fog.far = m.fogFar;
    this.#ambient.intensity = m.ambient;
    this.#ambient.color = new THREE.Color(m.ambientColor);
    this.#key.intensity = m.key;
    this.#key.color = new THREE.Color(m.keyColor);
    this.#fill.intensity = m.fill;
    this.#fill.color = new THREE.Color(m.fillColor);
  }

  /** Total static geometry, for the HUD / tests. */
  get stats(): { drawCalls: number; boxes: number; npcs: number; map: string } {
    const boxes = this.#worldMeshes.reduce((n, m) => n + ((m.geometry.getAttribute('position')?.count ?? 0) / 24), 0);
    return { drawCalls: this.#worldMeshes.length, boxes, npcs: this.#npcs.size, map: this.#lastMap };
  }

  dispose(): void {
    for (const m of this.#worldMeshes) {
      m.geometry.dispose();
      m.material.dispose();
    }
    this.#worldMeshes = [];
    for (const a of this.#npcs.values()) disposeAvatar(a);
    this.#npcs.clear();
    if (this.#player) disposeAvatar(this.#player);
    this.#player = null;
    (this.#focus.material as THREE.Material).dispose();
    this.#focus.geometry.dispose();
    // Forget the cached map so a renderer that is disposed and then reused
    // rebuilds instead of short-circuiting on a stale `#lastMap`. React's
    // StrictMode mounts, disposes and remounts the same memoised instance in
    // development, so this path is hit on every page load there.
    this.#lastMap = '';
    this.#world = null;
  }
}

/**
 * Painter's order from a world position.
 *
 * Mapped into a band above the static world (-1) and below overlays (1000). The
 * offset keeps the player and an NPC on the same tile from flickering: whichever
 * is deeper stays in front.
 */
export function drawOrderOf(x: number, y: number, z: number): number {
  const d = depthKey(x, y, z);
  // depthKey spans roughly ±(cols+rows)*CELL; fold it into 0..900.
  const folded = ((d % 900) + 900) % 900;
  return Math.floor(folded);
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Release an avatar's GPU resources.
 *
 * `VoxelAvatar` owns no textures — every part shares one cached material — so the
 * geometries are the only things worth freeing, and they live under the group.
 */
function disposeAvatar(avatar: VoxelAvatar): void {
  avatar.object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry?.dispose();
  });
}

export { CELL, ISO };

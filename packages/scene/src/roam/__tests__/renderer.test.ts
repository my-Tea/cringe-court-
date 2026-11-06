import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { RoamController } from '../controller';
import type { RoamData } from '../load';
import { ROOM_SCALE } from '../scale';
import { RoamRenderer } from '../three/renderer';
import { surfaceFor, surfaceTexture, tilePixels, TILE } from '../three/textures';
import { batchWorld } from '../three/worldMesh';
import { roamData } from './fixtures';

let data: RoamData;
beforeAll(async () => {
  data = await roamData();
});

describe('roam renderer (no GL needed)', () => {
  it('merges ~2,400 static boxes into a few dozen batches with world-space pixel UVs', () => {
    const batches = batchWorld(data.world.boxes);
    expect(data.world.boxes.length).toBeGreaterThan(2000);
    expect(batches.length).toBeLessThan(45);
    expect(batches.reduce((n, b) => n + b.boxes, 0)).toBe(data.world.boxes.length);
    const b = batches[0]!;
    expect(b.uvs.length / 2).toBe(b.positions.length / 3);
    expect(b.indices.length).toBe(b.boxes * 36);
  });

  it('pixel textures are nearest-neighbour only, 16×16, deterministic', () => {
    const t = surfaceTexture('wood');
    expect(t.magFilter).toBe(THREE.NearestFilter);
    expect(t.minFilter).toBe(THREE.NearestFilter);
    expect(t.generateMipmaps).toBe(false);
    expect(t.image.width).toBe(TILE);
    expect([...tilePixels('stone')]).toEqual([...tilePixels('stone')]);
    expect(new Set(tilePixels('wood')).size).toBeGreaterThan(3);
    expect(surfaceFor('#8B5E2A')).toBe('wood');
    expect(surfaceFor('#A32D3F')).toBe('fabric');
    expect(surfaceFor('#4D7CC5', 0.7)).toBe('glass');
  });

  it('builds the scene: world meshes, every NPC as a rigged voxel avatar, remote avatars from the feed', () => {
    const controller = new RoamController(data.world, { spawn: 'aisle' });
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller, quality: 'medium' });
    expect(r.drawCalls).toBeLessThan(45);
    expect(r.npcCount).toBe(data.world.npcs.length);
    controller.update(1 / 60);
    r.update(1 / 60);
    expect(r.camera.position.toArray()).toEqual([...controller.view().eye]);
    r.dispose();
  });

  it('quality presets switch the shadow budget, lights and far plane', () => {
    const controller = new RoamController(data.world);
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller, quality: 'high' });
    const key = r.scene.children.find((o): o is THREE.DirectionalLight => o instanceof THREE.DirectionalLight)!;
    expect(key.castShadow).toBe(true);
    expect(key.shadow.mapSize.x).toBe(2048);
    r.setQuality('low');
    expect(key.castShadow).toBe(false);
    expect(r.camera.far).toBe(900);
    const lit = r.scene.children.filter((o) => o instanceof THREE.PointLight && o.visible).length;
    expect(lit).toBe(2);
    r.dispose();
  });

  it('the focus outline follows the focused interactable', () => {
    const b = data.world.interactables.find((i) => i.id === 'exhibit-b')!.at;
    const controller = new RoamController(data.world, { spawn: { pos: [0, 0, 20 * ROOM_SCALE], yaw: 0, pitch: Math.atan2(b[1] - 44, 20 * ROOM_SCALE - b[2]) } });
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller });
    controller.update(1 / 60);
    r.update(1 / 60);
    const outline = r.scene.children.find((o) => o instanceof THREE.LineSegments)!;
    expect(controller.focusId).toBe('exhibit-b');
    expect(outline.visible).toBe(true);
    expect(outline.position.x).toBeCloseTo(b[0], 0);
    r.dispose();
  });
});

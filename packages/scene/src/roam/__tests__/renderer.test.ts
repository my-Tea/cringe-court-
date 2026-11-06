import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { RoamController } from '../controller';
import type { RoamData } from '../load';
import { ROOM_SCALE } from '../scale';
import { THIRD_RIG } from '../perspective';
import { RoamRenderer } from '../three/renderer';
import { surfaceFor, surfaceGain, surfaceTexture, tilePixels, TILE } from '../three/textures';
import { batchWorld } from '../three/worldMesh';
import { roamData } from './fixtures';
import { C } from '../palette';

let data: RoamData;
beforeAll(async () => {
  data = await roamData();
});

describe('roam renderer (no GL needed)', () => {
  it('merges ~2,400 static boxes into a few dozen batches with world-space pixel UVs', () => {
    const batches = batchWorld(data.world.boxes);
    expect(data.world.boxes.length).toBeGreaterThan(2000);
    // Palette colour × glow × (side | top): the grounds and the arrival islands add the greens, roofs and water.
    expect(batches.length).toBeLessThan(70);
    // Every box lands in exactly one side batch; colours with a top tile add a tops-only batch.
    expect(batches.filter((b) => b.face === 'side').reduce((n, b) => n + b.boxes, 0)).toBe(data.world.boxes.length);
    for (const b of batches) {
      expect(b.uvs.length / 2).toBe(b.positions.length / 3);
      const top = batches.some((o) => o.face === 'top' && o.color === b.color && o.glow === b.glow);
      expect(b.indices.length).toBe(b.boxes * 6 * (b.face === 'top' ? 1 : top ? 5 : 6));
    }
    expect(batches.some((b) => b.face === 'top' && surfaceFor(b.color, b.glow, 'top') === 'marble')).toBe(true);
  });

  it('pixel textures are nearest-neighbour only, 16×16, deterministic', () => {
    const t = surfaceTexture('wood');
    expect(t.magFilter).toBe(THREE.NearestFilter);
    expect(t.minFilter).toBe(THREE.NearestFilter);
    expect(t.generateMipmaps).toBe(false);
    expect(t.image.width).toBe(TILE);
    expect([...tilePixels('stone')]).toEqual([...tilePixels('stone')]);
    expect(new Set(tilePixels('wood')).size).toBeGreaterThan(3);
    expect(surfaceFor(C.gold900)).toBe('wood');
    expect(surfaceFor(C.royal700)).toBe('fabric');
    expect(surfaceFor(C.blue700, 0.7)).toBe('glass');
    expect(surfaceFor(C.neutral100, 0, 'top')).toBe('marble');
    expect(surfaceFor(C.green700, 0, 'top')).toBe('grass');
    // The gain brings a tile's average back to the flat swatch.
    const px = tilePixels('stone');
    const mean = px.reduce((n, v) => n + v, 0) / px.length;
    expect((mean * surfaceGain('stone')) / 255).toBeCloseTo(1, 5);
  });

  it('builds the scene: world meshes, every NPC as a rigged voxel avatar, remote avatars from the feed', () => {
    const controller = new RoamController(data.world, { spawn: 'aisle' });
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller, quality: 'medium' });
    expect(r.drawCalls).toBeLessThan(70);
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

  it('opens a blue cloud sky on the plaza and keeps the indoor fog inside', () => {
    const controller = new RoamController(data.world, { spawn: 'aisle' });
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller, quality: 'high' });
    controller.update(1 / 60);
    r.update(1 / 60);
    const sky = r.scene.getObjectByName('plaza-sky')!;
    expect(sky.visible).toBe(false);
    expect(r.scene.fog).toBeTruthy();
    controller.teleport('outside');
    controller.update(1 / 60);
    r.update(1 / 60);
    expect(controller.zone).toBe('outside');
    expect(sky.visible).toBe(true);
    // Outdoors the indoor fog gives way to a pale sky haze far out (the islands fade into it).
    expect(r.scene.fog).toBeTruthy();
    expect((r.scene.fog as THREE.Fog).color.getHexString()).toBe(C.blue300.slice(1).toLowerCase());
    expect((r.scene.fog as THREE.Fog).near).toBeGreaterThan(600);
    expect((r.scene.background as THREE.Color).getHexString()).toBe(C.blue700.slice(1).toLowerCase());
    controller.teleport('lobby');
    r.update(1 / 60);
    expect(sky.visible).toBe(false);
    expect(r.scene.fog).toBeTruthy();
    r.dispose();
  });

  it('auto perspective trails the camera behind the player, Minecraft style', () => {
    const controller = new RoamController(data.world, { spawn: 'aisle' });
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller, quality: 'high' });
    r.setPerspective('auto');
    r.setViewport(1600, 900);
    controller.setPerspective('auto');
    for (let i = 0; i < 90; i++) {
      controller.update(1 / 60);
      r.update(1 / 60);
    }
    const { eye, yaw } = controller.view();
    const cam = r.viewCamera;
    expect(cam).toBe(r.camera);
    // Behind the head: the offset points against the look direction (yaw 0 looks toward -Z).
    const back = (cam.position.x - eye[0]) * Math.sin(yaw) + (cam.position.z - eye[2]) * Math.cos(yaw);
    expect(back).toBeGreaterThan(THIRD_RIG.hideBelow);
    expect(Math.hypot(cam.position.x - eye[0], cam.position.y - eye[1], cam.position.z - eye[2])).toBeLessThanOrEqual(THIRD_RIG.distance + THIRD_RIG.lift + 1);
    expect(r.scene.getObjectByName('avatar:you')?.visible).toBe(true);
    r.setPerspective('first');
    r.update(1 / 60);
    expect(r.camera.position.toArray()).toEqual([...controller.view().eye]);
    expect(r.scene.getObjectByName('avatar:you')?.visible).toBe(false);
    r.dispose();
  });

  it('a hearing close-up frames every speaker, not only the defence lawyer beside the chair', () => {
    const controller = new RoamController(data.world, { spawn: 'lobby' });
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller });
    r.setPerspective('first');
    void controller.runBeat('opening');
    const forward = new THREE.Vector3();
    const to = new THREE.Vector3();
    const framing = (id: string) => {
      for (let i = 0; i < 500 && controller.snapshot().dialogue?.speaker !== id; i++) {
        controller.advanceDialogue();
        controller.advanceDialogue();
        controller.update(1 / 30);
        r.update(1 / 30);
      }
      for (let i = 0; i < 90; i++) {
        controller.update(1 / 60);
        r.update(1 / 60);
      }
      const mark = data.world.marks[id]!;
      const cam = r.camera.position.distanceTo(new THREE.Vector3(mark[0], mark[1], mark[2]));
      const eye = controller.view().eye;
      const fromEye = Math.hypot(eye[0] - mark[0], eye[1] - mark[1], eye[2] - mark[2]);
      r.camera.getWorldDirection(forward);
      to.set(mark[0], mark[1], mark[2]).sub(r.camera.position).normalize();
      return { cam, fromEye, aim: forward.dot(to) };
    };
    // The judge and the prosecutor stand across the room. A seated look leaves
    // them small; the close-up has to travel to them. The defence lawyer is
    // already beside the chair, so he was filling the frame without one.
    for (const id of ['judge', 'prosecutor', 'defense'] as const) {
      const shot = framing(id);
      expect(controller.snapshot().dialogue?.speaker, id).toBe(id);
      expect(shot.aim, id).toBeGreaterThan(0.9);
      expect(shot.cam, id).toBeLessThan(THIRD_RIG.closeup + 28);
      if (id !== 'defense') expect(shot.cam, id).toBeLessThan(shot.fromEye * 0.72);
    }
    r.dispose();
  });

  it('a wall behind the player pulls the third-person camera in', () => {
    // Stand a step in front of the lobby's back wall, facing into the room.
    const lobby = data.world.rooms.find((room) => room.id === 'lobby')!.bounds;
    const controller = new RoamController(data.world, { spawn: { pos: [0, 0.8, lobby.max[2] - 20], yaw: 0, pitch: 0 } });
    const r = new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller });
    r.setPerspective('auto');
    controller.update(1 / 60);
    r.update(1 / 60);
    const eye = controller.view().eye;
    expect(r.camera.position.z - eye[2]).toBeLessThan(THIRD_RIG.distance / 2);
    expect(r.camera.position.z).toBeLessThan(lobby.max[2]);
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

import { describe, expect, it } from 'vitest';
import { BASE_MODES } from '@cringe-court/core';
import { CLOSE_UPS, STAGE_MARKS, boundsOf, cameraFor, mergeByMaterial, parseBoxes, worldPerPixel, frameUv } from '../index';
import { realData } from './fixtures';

describe('courtroom geometry (real courtroom.boxes.json)', () => {
  it('merges 1606 boxes into 16 material batches', async () => {
    const { boxes } = await realData();
    expect(boxes).toHaveLength(1606);
    const batches = mergeByMaterial(boxes);
    expect(batches).toHaveLength(16);
    expect(batches.reduce((n, b) => n + b.boxes, 0)).toBe(1606);
    for (const b of batches) {
      expect(b.positions.length).toBe(b.boxes * 72);
      expect(b.indices.length).toBe(b.boxes * 36);
    }
  });

  it('winds every triangle so its geometric normal matches the face normal', () => {
    const [batch] = mergeByMaterial(parseBoxes([{ f: [0, 0, 0], t: [2, 3, 4], m: '#ffffff' }]));
    const p = batch!.positions;
    const n = batch!.normals;
    for (let i = 0; i < batch!.indices.length; i += 3) {
      const [a, b, c] = [batch!.indices[i]!, batch!.indices[i + 1]!, batch!.indices[i + 2]!];
      const v = (k: number) => [p[k * 3]!, p[k * 3 + 1]!, p[k * 3 + 2]!];
      const [A, B, C] = [v(a), v(b), v(c)];
      const e1 = B.map((x, j) => x - A[j]!);
      const e2 = C.map((x, j) => x - A[j]!);
      const cross = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const dot = cross[0]! * n[a * 3]! + cross[1]! * n[a * 3 + 1]! + cross[2]! * n[a * 3 + 2]!;
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('room bounds match SCENE-GUIDE (inner walls at ±90, floor at 0)', async () => {
    const { boxes, layout } = await realData();
    const b = boxes.length ? boundsOf(boxes) : null;
    expect(b!.min[0]).toBeLessThanOrEqual(-90);
    expect(b!.max[0]).toBeGreaterThanOrEqual(90);
    expect(layout.room).toMatchObject({ w: 190, d: 152, h: 104 });
    expect(() => parseBoxes([{ f: [0, 0], t: [1, 1, 1], m: '#fff' }])).toThrow();
  });
});

describe('layout, marks and cameras', () => {
  it('has every camera preset and close-up, and every mark sits inside the room', async () => {
    const { layout } = await realData();
    for (const shot of ['pov_entrance', 'pov_well', 'pov_corner', 'pov_corner_r', 'pov_bench', 'pov_gallery'] as const) {
      expect(cameraFor(layout, shot).fov).toBeGreaterThan(30);
    }
    for (const c of Object.values(CLOSE_UPS)) expect(c.pos[1]).toBeGreaterThanOrEqual(48);
    for (const m of Object.values(STAGE_MARKS)) {
      expect(Math.abs(m.pos[0])).toBeLessThan(90);
      expect(Math.abs(m.pos[2])).toBeLessThan(71);
    }
    expect(layout.props.filter((p) => p.prop === 'spotlight_rig')).toHaveLength(3);
  });

  it('every base mode stages characters that have atlases', async () => {
    const { atlas } = await realData();
    for (const def of Object.values(BASE_MODES)) {
      for (const member of def.staging(def.terms())) expect(atlas.characters[member.character], member.character).toBeDefined();
    }
  });
});

describe('atlas manifest', () => {
  it('scales the cast to the 63-unit character the room was built for', async () => {
    const { atlas } = await realData();
    const k = worldPerPixel(atlas);
    expect(atlas.characters.judge!.contentHeight * k).toBeGreaterThan(55);
    expect(atlas.characters.judge!.contentHeight * k).toBeLessThan(72);
    const uv = frameUv(atlas.characters.judge!, atlas.characters.judge!.frames.idle!);
    expect(uv.u0).toBeGreaterThanOrEqual(0);
    expect(uv.v1).toBeLessThanOrEqual(1);
  });
});

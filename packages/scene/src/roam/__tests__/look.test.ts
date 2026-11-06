import { describe, expect, it } from 'vitest';
import { buildCastMeshes } from '../cast';
import { ACCESSORIES, castWithLook, DEFAULT_LOOK, EFFECTS, HAIRS, lookKey, normalizeLook, OUTFITS, randomLook } from '../look';
import { isPaletteColor } from '../palette';
import { roamData } from './fixtures';

describe('wardrobe looks', () => {
  it('a seed always rolls the same look, and different seeds differ', () => {
    expect(randomLook(7)).toEqual(randomLook(7));
    const keys = new Set(Array.from({ length: 20 }, (_, i) => lookKey(randomLook(i + 1))));
    expect(keys.size).toBeGreaterThan(10);
  });

  it('clamps stored looks to real options', () => {
    expect(normalizeLook(null)).toEqual(DEFAULT_LOOK);
    expect(normalizeLook({ hair: 'spiky-blue', skin: 99, outfit: 'robe', outfitColor: -1 } as never)).toEqual({ ...DEFAULT_LOOK, outfit: 'robe' });
  });

  it('every part builds into a rigged model with walking legs, in palette colours only', async () => {
    const { cast } = await roamData();
    for (const outfit of OUTFITS) {
      for (const hair of HAIRS) {
        const look = { ...DEFAULT_LOOK, outfit, hair, accessory: ACCESSORIES[(outfit.length + hair.length) % ACCESSORIES.length]!, effect: EFFECTS[1]! };
        const built = castWithLook(cast, look);
        const model = built.models.player!;
        expect(model.height).toBeGreaterThan(95);
        expect(model.height).toBeLessThan(112);
        const meshes = buildCastMeshes(built, 'player');
        expect(meshes.legR.positions.length).toBeGreaterThan(0);
        expect(meshes.legL.positions.length).toBeGreaterThan(0);
        expect(meshes.head.positions.length).toBeGreaterThan(0);
        expect(buildCastMeshes(built, 'player', 'sit').body.positions.length).toBeGreaterThan(0);
        expect(built.colors.every((c) => isPaletteColor(c))).toBe(true);
      }
    }
    // The base cast is untouched: looks are built into a copy.
    expect(cast.models.player).toBeUndefined();
  });
});

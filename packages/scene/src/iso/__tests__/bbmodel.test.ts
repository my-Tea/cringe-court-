import { describe, expect, it } from 'vitest';
import { bbmodelToBoxes, BbModelError, colourOf, groupMap, placeBoxes, rotatedBounds, type RawModel } from '../bbmodel';

const model = (over: Partial<RawModel> = {}): RawModel => ({
  meta: { format_version: '5.0', model_format: 'free' },
  name: 'test',
  resolution: { width: 16, height: 16 },
  elements: [],
  outliner: [],
  ...over,
});

describe('bbmodelToBoxes', () => {
  it('scales Blockbench units into world units', () => {
    // One 16-unit Blockbench block is one 16-unit town cell, so 1:1 at defaults.
    const r = bbmodelToBoxes(model({ elements: [{ name: 'a', from: [0, 0, 0], to: [16, 16, 16], color: '#7A1C2E' }] }));
    expect(r.boxes).toEqual([{ f: [0, 0, 0], t: [16, 16, 16], m: '#7A1C2E' }]);
    expect(r.elements).toBe(1);
  });

  it('honours cell and resolution', () => {
    const r = bbmodelToBoxes(
      model({ resolution: { width: 32 }, elements: [{ name: 'a', from: [0, 0, 0], to: [32, 32, 32], color: '#D9A046' }] }),
      { cell: 24, resolution: 32 },
    );
    expect(r.boxes[0]).toEqual({ f: [0, 0, 0], t: [24, 24, 24], m: '#D9A046' });
  });

  it('applies origin and extra scale', () => {
    const r = bbmodelToBoxes(model({ elements: [{ name: 'a', from: [0, 0, 0], to: [8, 8, 8], color: '#FFF9ED' }] }), {
      scale: 2,
      origin: [100, 0, -50],
    });
    expect(r.boxes[0]).toEqual({ f: [100, 0, -50], t: [116, 16, -34], m: '#FFF9ED' });
  });

  it('normalises reversed corners and inflate', () => {
    const r = bbmodelToBoxes(model({ elements: [{ name: 'a', from: [16, 16, 16], to: [0, 0, 0], inflate: 1, color: '#A32D3F' }] }));
    expect(r.boxes[0]).toEqual({ f: [-1, -1, -1], t: [17, 17, 17], m: '#A32D3F' });
  });

  it('resolves colour precedence: materials > group > material > cube color', () => {
    const raw = model({
      elements: [
        { name: 'wall', from: [0, 0, 0], to: [1, 1, 1], color: '#111111' },
        { name: 'trim', from: [0, 0, 0], to: [1, 1, 1], color: '#222222' },
        { name: 'door', from: [0, 0, 0], to: [1, 1, 1], color: '#333333' },
      ],
      outliner: [{ name: 'shell', children: ['wall', 'trim'] }],
    });
    const r = bbmodelToBoxes(raw, {
      material: '#4A3A32',
      materials: { wall: '#FFF9ED', shell: '#D9A046' },
    });
    expect(r.boxes.map((b) => b.m)).toEqual(['#FFF9ED', '#D9A046', '#4A3A32']);
  });

  it('falls back to the Blockbench palette for numeric colours', () => {
    const r = bbmodelToBoxes(model({ elements: [{ name: 'a', from: [0, 0, 0], to: [1, 1, 1], color: 6 }] }));
    expect(r.boxes[0]!.m).toBe('#EC1C24');
  });

  it('drops non-cube, empty and unbakeable rotations into skipped', () => {
    const r = bbmodelToBoxes(
      model({
        elements: [
          { name: 'mesh', from: [0, 0, 0], to: [1, 1, 1], type: 'mesh' },
          { name: 'flat', from: [0, 0, 0], to: [0, 0, 0] },
          { name: 'tilted', from: [0, 0, 0], to: [4, 4, 4], rotation: [0, 45, 0] },
          { name: 'good', from: [0, 0, 0], to: [2, 2, 2], color: '#DCC8B0' },
          { name: 'nofrom' },
        ],
      }),
    );
    expect(r.boxes).toHaveLength(1);
    expect(r.boxes[0]!.m).toBe('#DCC8B0');
    expect(r.skipped.map((s) => s.name)).toEqual(['mesh', 'flat', 'tilted', 'nofrom']);
    expect(r.skipped.find((s) => s.name === 'tilted')!.reason).toMatch(/not bakeable/);
  });

  it('skips by element name and by group name', () => {
    const raw = model({
      elements: [
        { name: 'hide_me', from: [0, 0, 0], to: [1, 1, 1] },
        { name: 'brace', from: [0, 0, 0], to: [1, 1, 1] },
        { name: 'keep', from: [0, 0, 0], to: [1, 1, 1] },
      ],
      outliner: [{ name: 'scaffold', children: ['brace'] }],
    });
    const r = bbmodelToBoxes(raw, { skip: ['hide_me', 'scaffold'] });
    expect(r.boxes).toHaveLength(1);
    expect(r.skipped.map((s) => s.name).sort()).toEqual(['brace', 'hide_me']);
  });

  it('reports bounds across all boxes', () => {
    const r = bbmodelToBoxes(
      model({
        elements: [
          { name: 'a', from: [0, 0, 0], to: [4, 4, 4] },
          { name: 'b', from: [-8, 0, -2], to: [2, 12, 2] },
        ],
      }),
    );
    expect(r.bounds).toEqual({ min: [-8, 0, -2], max: [4, 12, 4] });
  });

  it('rejects structurally unusable input', () => {
    expect(() => bbmodelToBoxes({} as RawModel)).toThrow(BbModelError);
    expect(() => bbmodelToBoxes(null as unknown as RawModel)).toThrow(BbModelError);
    expect(() => bbmodelToBoxes(model({ elements: [{ name: 'x', from: [0, 0, 0], to: [1, 1, 1] }] }), { cell: 0 })).toThrow(BbModelError);
    // A bad explicit colour is a configuration error, not a per-element skip.
    expect(() =>
      bbmodelToBoxes(model({ elements: [{ name: 'x', from: [0, 0, 0], to: [1, 1, 1] }] }), { materials: { x: 'not-a-colour' } }),
    ).toThrow(BbModelError);
  });

  it('is deterministic', () => {
    const raw = model({ elements: [{ name: 'a', from: [0.1234, 0, 0], to: [1.9876, 2, 2], color: '#7A1C2E' }] });
    expect(bbmodelToBoxes(raw)).toEqual(bbmodelToBoxes(raw));
  });
});

describe('rotatedBounds', () => {
  it('returns the same box for no rotation', () => {
    expect(rotatedBounds([0, 0, 0], [2, 4, 6], [0, 0, 0], [0, 0, 0])).toEqual({ min: [0, 0, 0], max: [2, 4, 6] });
  });

  it('bakes a 90° Y turn into swapped X/Z extents', () => {
    // A 2×4×6 box about its own centre: turning it 90° about Y swaps X and Z.
    const r = rotatedBounds([-1, 0, -3], [1, 4, 3], [0, 0, 0], [0, 90, 0]);
    expect(r).toEqual({ min: [-3, 0, -1], max: [3, 4, 1] });
  });

  it('returns to the original after four quarter turns', () => {
    const r = rotatedBounds([-1, 0, -3], [1, 4, 3], [0, 0, 0], [0, 360, 0]);
    expect(r).toEqual({ min: [-1, 0, -3], max: [1, 4, 3] });
  });

  it('respects the pivot', () => {
    // Pivot at the box's own min corner: a quarter turn swings the box to −Z
    // and leaves it hinged at x = 10, so the pivot really is the rotation centre.
    const r = rotatedBounds([10, 0, 0], [12, 2, 2], [10, 0, 0], [0, 90, 0]);
    expect(r).toEqual({ min: [10, 0, -2], max: [12, 2, 0] });
  });

  it('refuses non-multiples of 90', () => {
    expect(rotatedBounds([0, 0, 0], [1, 1, 1], [0, 0, 0], [0, 45, 0])).toBeNull();
    expect(rotatedBounds([0, 0, 0], [1, 1, 1], [0, 0, 0], [10, 0, 0])).toBeNull();
  });
});

describe('placeBoxes', () => {
  const one = [{ f: [0, 0, 0] as [number, number, number], t: [4, 8, 2] as [number, number, number], m: '#7A1C2E' }];

  it('translates only', () => {
    expect(placeBoxes(one, [10, 0, 20])[0]).toEqual({ f: [10, 0, 20], t: [14, 8, 22], m: '#7A1C2E' });
  });

  it('rotates 90° about Y with the repo convention (x, z) → (z, −x)', () => {
    // 4 wide × 2 deep becomes 2 wide × 4 deep. Same handedness as roam's rotY90.
    expect(placeBoxes(one, [0, 0, 0], { rotY: 90 })[0]).toEqual({ f: [0, 0, -4], t: [2, 8, 0], m: '#7A1C2E' });
  });

  it('turns 180° into a point reflection about the base centre', () => {
    expect(placeBoxes(one, [0, 0, 0], { rotY: 180 })[0]).toEqual({ f: [-4, 0, -2], t: [0, 8, 0], m: '#7A1C2E' });
  });

  it('returns to the original after 360°', () => {
    expect(placeBoxes(one, [0, 0, 0], { rotY: 0 })[0]).toEqual(one[0]);
  });

  it('mirrors across X', () => {
    expect(placeBoxes(one, [0, 0, 0], { mirrorX: true })[0]).toEqual({ f: [-4, 0, 0], t: [0, 8, 2], m: '#7A1C2E' });
  });

  it('keeps a multi-box model together under transform', () => {
    const two = [
      { f: [-4, 0, -2] as [number, number, number], t: [-2, 4, 2] as [number, number, number], m: '#D9A046' },
      { f: [2, 0, -2] as [number, number, number], t: [4, 4, 2] as [number, number, number], m: '#D9A046' },
    ];
    const moved = placeBoxes(two, [100, 0, 0], { rotY: 90 });
    // Symmetric about x = 0, so a quarter turn stays symmetric and centred on the origin.
    const xs = moved.flatMap((b) => [b.f[0], b.t[0]]);
    expect(Math.min(...xs)).toBe(98);
    expect(Math.max(...xs)).toBe(102);
  });
});

describe('colourOf', () => {
  it('accepts 6- and 8-digit hex, strips alpha, uppercases', () => {
    expect(colourOf('#7a1c2e')).toBe('#7A1C2E');
    expect(colourOf('#7A1C2EFF')).toBe('#7A1C2E');
  });

  it('accepts numeric palette indices and numeric strings', () => {
    expect(colourOf(0)).toBe('#FFFFFF');
    expect(colourOf('9')).toBe('#39B54A');
  });

  it('rejects junk', () => {
    expect(colourOf('red')).toBeNull();
    expect(colourOf('#12345')).toBeNull();
    expect(colourOf(undefined)).toBeNull();
    expect(colourOf(999)).toBeNull();
  });
});

describe('groupMap', () => {
  it('maps nested element names to their nearest group', () => {
    const m = groupMap([{ name: 'shell', children: [{ name: 'roof', children: ['tile_a'] }, 'wall'] }, 'loose']);
    expect(m.get('tile_a')).toBe('roof');
    expect(m.get('wall')).toBe('shell');
    expect(m.has('loose')).toBe(false);
  });

  it('tolerates junk', () => {
    expect(groupMap(undefined).size).toBe(0);
    expect(groupMap([1, null, 'x']).size).toBe(0);
  });
});

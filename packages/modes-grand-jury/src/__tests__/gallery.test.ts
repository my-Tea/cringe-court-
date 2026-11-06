import { describe, expect, it } from 'vitest';
import { caseNumber, type Hex } from '@cringe-court/core';
import { GalleryVoteError, MemoryGalleryStore, galleryPercents } from '../index';

const n = caseNumber(7);
const a = ('0x' + 'aa'.repeat(20)) as Hex;

describe('MemoryGalleryStore', () => {
  it('allows one vote per account, case-insensitively', async () => {
    const g = new MemoryGalleryStore();
    await g.cast(n, a, 0);
    await expect(g.cast(n, a.toUpperCase().replace('0X', '0x') as Hex, 1)).rejects.toMatchObject({ code: 'already-voted' });
    await expect(g.cast(n, a, 1)).rejects.toBeInstanceOf(GalleryVoteError);
    expect(await g.voteOf(n, a)).toBe(0);
  });
  it('tallies per case', async () => {
    const g = new MemoryGalleryStore();
    await g.cast(n, a, 0);
    await g.cast(n, ('0x' + 'bb'.repeat(20)) as Hex, 1);
    await g.cast(n, ('0x' + 'cc'.repeat(20)) as Hex, 1);
    expect(await g.tally(n)).toEqual({ votes: [1, 2], total: 3 });
    expect(await g.tally(caseNumber(8))).toEqual({ votes: [0, 0], total: 0 });
    expect(await g.voteOf(caseNumber(8), a)).toBeNull();
  });
});

describe('galleryPercents', () => {
  it('adds to 100', () => {
    for (const v of [[1, 2], [1, 1], [57, 43], [1, 6]] as const) {
      const [x, y] = galleryPercents({ votes: v, total: v[0] + v[1] });
      expect(x + y).toBe(100);
    }
    expect(galleryPercents({ votes: [1, 2], total: 3 })).toEqual([33, 67]);
  });
  it('handles an empty gallery', () => {
    expect(galleryPercents({ votes: [0, 0], total: 0 })).toEqual([0, 0]);
  });
});

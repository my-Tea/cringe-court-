import { describe, expect, it } from 'vitest';
import { caseNumber, keccak256, type Hex, type SealedBallot } from '@cringe-court/core';
import { MemoryStorage, ScrollError, StorageSaltVault, decodeScroll, encodeScroll } from '../index';

const juror = ('0x' + 'ab'.repeat(20)) as Hex;
const n = caseNumber(101);
const salt = keccak256('salt');
const commitment = keccak256('commitment');
const ballot: SealedBallot = { caseNumber: n, juror, choice: 1, salt, commitment, savedAt: 5 };

describe('StorageSaltVault', () => {
  it('saves, loads and removes a ballot', async () => {
    const v = new StorageSaltVault(new MemoryStorage());
    expect(await v.load(n, juror)).toBeNull();
    await v.save(ballot);
    expect(await v.load(n, juror)).toEqual(ballot);
    expect(await v.load(n, juror.toUpperCase().replace('0X', '0x') as Hex)).toEqual(ballot);
    await v.remove(n, juror);
    expect(await v.load(n, juror)).toBeNull();
  });
  it('returns null for corrupted JSON', async () => {
    const s = new MemoryStorage();
    const v = new StorageSaltVault(s);
    await v.save(ballot);
    s.setItem(`cc:gj:ballot:${n}:${juror}`, '{not json');
    expect(await v.load(n, juror)).toBeNull();
  });
  it('returns null when the stored salt is not 32-byte hex', async () => {
    const s = new MemoryStorage();
    const v = new StorageSaltVault(s);
    s.setItem(`cc:gj:ballot:${n}:${juror}`, JSON.stringify({ ...ballot, salt: '0x12' }));
    expect(await v.load(n, juror)).toBeNull();
  });
  it('makes 32-byte hex salts that differ', () => {
    const v = new StorageSaltVault(new MemoryStorage());
    const a = v.newSalt();
    const b = v.newSalt();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('scrolls', () => {
  it('round trips', () => {
    const text = encodeScroll(ballot);
    expect(text.startsWith('ccgj1.')).toBe(true);
    expect(decodeScroll(`  ${text}\n`)).toEqual({ caseNumber: n, juror, choice: 1, salt, commitment });
  });
  it.each([
    ['wrong prefix', (t: string) => t.replace('ccgj1', 'zzz')],
    ['missing parts', (t: string) => t.split('.').slice(0, 4).join('.')],
    ['bad hex', (t: string) => t.replace(salt.slice(2, 6), 'zzzz')],
    ['bad choice', (t: string) => t.split('.').map((p, i) => (i === 3 ? '2' : p)).join('.')],
    ['bad case number', (t: string) => t.split('.').map((p, i) => (i === 1 ? 'x' : p)).join('.')],
  ])('throws ScrollError on %s', (_n, mutate) => {
    expect(() => decodeScroll(mutate(encodeScroll(ballot)))).toThrow(ScrollError);
  });
});

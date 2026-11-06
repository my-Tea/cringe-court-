import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { bytesToHex, canonicalJson, hexToBytes, keccak256, seededRandom, sha3_256Bytes, uint256Word } from '../index';

describe('keccak256', () => {
  it('matches the Ethereum test vectors', () => {
    expect(keccak256('')).toBe('0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    expect(keccak256('abc')).toBe('0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
    expect(keccak256('The quick brown fox jumps over the lazy dog')).toBe(
      '0x4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15',
    );
  });

  it('runs the same permutation as node:crypto SHA3-256 across block boundaries', () => {
    for (const len of [0, 1, 135, 136, 137, 271, 272, 1000]) {
      const input = randomBytes(len);
      const expected = createHash('sha3-256').update(input).digest('hex');
      expect(bytesToHex(sha3_256Bytes(new Uint8Array(input)))).toBe(`0x${expected}`);
    }
  });
});

describe('byte helpers', () => {
  it('round-trips hex and pads uint256 words', () => {
    expect(bytesToHex(hexToBytes('0x00ff10'))).toBe('0x00ff10');
    expect(bytesToHex(uint256Word(69))).toBe(`0x${'0'.repeat(62)}45`);
    expect(() => hexToBytes('0x123' as `0x${string}`)).toThrow(SyntaxError);
  });

  it('serialises canonically regardless of key order', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'] })).toBe(canonicalJson({ a: [true, null, 'x'], b: 1 }));
    expect(canonicalJson({ big: 5n })).toBe('{"big":"5"}');
  });

  it('seeded random is deterministic per seed', () => {
    const a = seededRandom('seed');
    const b = seededRandom('seed');
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

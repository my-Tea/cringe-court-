import { describe, expect, it } from 'vitest';
import { deriveHumanId } from '../src/index.js';

const P = 'pepper-pepper-pepper-1';
describe('deriveHumanId', () => {
  it('is deterministic 32-byte hex', () => {
    const a = deriveHumanId('12345', P);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(deriveHumanId('12345', P)).toBe(a);
  });
  it('canonicalizes decimal, hex, bigint, nil_', () => {
    const a = deriveHumanId('255', P);
    expect(deriveHumanId(255n, P)).toBe(a);
    expect(deriveHumanId('0xff', P)).toBe(a);
    expect(deriveHumanId('0x00ff', P)).toBe(a);
    expect(deriveHumanId('0xFF', P)).toBe(a);
    expect(deriveHumanId('nil_' + 'ff'.padStart(64, '0'), P)).toBe(a);
  });
  it('depends on pepper and nullifier, and is not the raw nullifier', () => {
    expect(deriveHumanId('1', P)).not.toBe(deriveHumanId('1', P + 'x'));
    expect(deriveHumanId('1', P)).not.toBe(deriveHumanId('2', P));
    expect(deriveHumanId('1', new TextEncoder().encode(P))).toBe(deriveHumanId('1', P));
  });
  it('rejects bad input', () => {
    expect(() => deriveHumanId('abc', P)).toThrow();
    expect(() => deriveHumanId(-1n, P)).toThrow();
    expect(() => deriveHumanId('1', 'short')).toThrow();
  });
});

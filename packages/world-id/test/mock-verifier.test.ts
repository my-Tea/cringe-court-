import { describe, expect, it } from 'vitest';
import { IdentityLevel, MockVerifier, mockProof } from '../src/index.js';

const W1 = '0x0000000000000000000000000000000000000001' as const;
const W2 = '0x0000000000000000000000000000000000000002' as const;
const r = (v: MockVerifier, proof: unknown, wallet: `0x${string}` = W1, action = 'a') => v.verify({ proof, action, wallet });

describe('MockVerifier', () => {
  it('succeeds deterministically; same persona on two wallets => same humanId', async () => {
    const v = new MockVerifier();
    const a = await r(v, mockProof('alice-orb'), W1);
    const b = await r(v, mockProof('alice-orb'), W2);
    expect(a).toMatchObject({ ok: true, level: IdentityLevel.ORB });
    expect(a.ok && b.ok && a.humanId === b.humanId).toBe(true);
    const c = await r(v, mockProof('carol-orb'));
    expect(c.ok && a.ok && c.humanId !== a.humanId).toBe(true);
  });
  it('device persona is ineligible for a juror-level verifier', async () => {
    const v = new MockVerifier({ minLevel: IdentityLevel.ORB });
    expect(await r(v, mockProof('bob-device'))).toMatchObject({ ok: false, reason: 'ineligible_level' });
    expect(await r(new MockVerifier(), mockProof('bob-device'))).toMatchObject({ ok: true, level: IdentityLevel.DEVICE });
  });
  it('covers every outcome', async () => {
    const v = new MockVerifier();
    const cases = [
      ['ineligible', 'ineligible_level', false],
      ['invalid', 'invalid_proof', false],
      ['cancelled', 'cancelled', false],
      ['expired', 'expired', false],
      ['network', 'network', true],
    ] as const;
    for (const [outcome, reason, retryable] of cases) {
      expect(await r(v, mockProof('alice-orb', { outcome }))).toMatchObject({ ok: false, reason, retryable });
    }
    expect(await r(v, mockProof('mallory-ineligible'))).toMatchObject({ ok: false, reason: 'ineligible_level' });
  });
  it('malformed and wrong action', async () => {
    const v = new MockVerifier({ action: 'a' });
    expect(await r(v, { x: 1 })).toMatchObject({ reason: 'malformed' });
    expect(await r(v, mockProof('alice-orb'), W1, 'b')).toMatchObject({ reason: 'wrong_action' });
  });
  it('oncePerAction blocks a second wallet only', async () => {
    const v = new MockVerifier({ oncePerAction: true });
    expect((await r(v, mockProof('alice-orb'), W1)).ok).toBe(true);
    expect((await r(v, mockProof('alice-orb'), W1)).ok).toBe(true);
    expect(await r(v, mockProof('alice-orb'), W2)).toMatchObject({ ok: false, reason: 'already_verified' });
    expect((await r(v, mockProof('alice-orb'), W2, 'other-action')).ok).toBe(true);
  });
  it('exposes personas', () => {
    expect(MockVerifier.personas).toEqual(expect.arrayContaining(['alice-orb', 'bob-device', 'mallory-ineligible']));
  });
});

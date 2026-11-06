import { describe, expect, it } from 'vitest';
import {
  IdentityLevel, JUROR_SCREENING_COPY, MockVerifier, checkJurorEligibility, mockProof, toAttestation,
  type VerificationResult,
} from '../src/index.js';

const W = '0x00000000000000000000000000000000000000aa' as const;
const verify = (p: string) => new MockVerifier().verify({ proof: mockProof(p), action: 'a', wallet: W });
const none = { partyHumanIds: [], seatedHumanIds: [] };

describe('eligibility', () => {
  it('orb is eligible', async () => {
    expect(checkJurorEligibility(await verify('alice-orb'), none)).toEqual({ eligible: true });
  });
  it('failed verification, device level', async () => {
    const bad: VerificationResult = { ok: false, reason: 'cancelled', message: 'x', retryable: false };
    expect(checkJurorEligibility(bad, none)).toEqual({ eligible: false, reason: 'not_verified' });
    expect(checkJurorEligibility(await verify('bob-device'), none)).toEqual({ eligible: false, reason: 'ineligible_level' });
  });
  it('excludes parties (even via another wallet) and seated jurors, case-insensitive', async () => {
    const res = await verify('alice-orb');
    if (!res.ok) throw new Error('x');
    expect(checkJurorEligibility(res, { partyHumanIds: [res.humanId.toUpperCase().replace('0X', '0x')], seatedHumanIds: [] }))
      .toEqual({ eligible: false, reason: 'is_party' });
    expect(checkJurorEligibility(res, { partyHumanIds: [], seatedHumanIds: [res.humanId] }))
      .toEqual({ eligible: false, reason: 'already_seated' });
  });
  it('toAttestation matches attest(wallet, humanId, level, expiresAt)', async () => {
    const res = await verify('alice-orb');
    if (!res.ok) throw new Error('x');
    const a = toAttestation(W, res, { ttlSeconds: 3600, now: () => 1_000_000 });
    expect(Object.keys(a)).toEqual(['wallet', 'humanId', 'level', 'expiresAt']);
    expect(a).toEqual({ wallet: W, humanId: res.humanId, level: IdentityLevel.ORB, expiresAt: 4600n });
    expect(() => toAttestation(W, { ok: false, reason: 'network', message: '', retryable: true }, { ttlSeconds: 1 })).toThrow();
  });
  it('has copy for every failure path', () => {
    for (const k of ['not_verified', 'ineligible_level', 'is_party', 'already_seated', 'cancelled', 'network'] as const) {
      expect(JUROR_SCREENING_COPY[k].length).toBeGreaterThan(10);
    }
  });
});

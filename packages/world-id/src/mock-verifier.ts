import { createHash } from 'node:crypto';
import { deriveHumanId } from './human-id.js';
import {
  IdentityLevel,
  type FailureReason,
  type IdentityVerifier,
  type VerificationRequest,
  type VerificationResult,
} from './types.js';

export type MockOutcome = 'ok' | 'ineligible' | 'invalid' | 'cancelled' | 'expired' | 'network';

export interface MockProof {
  mock: true;
  persona: string;
  level?: IdentityLevel;
  outcome?: MockOutcome;
}

/** Fixed, public, test-only pepper. Never use outside tests/demo. */
export const MOCK_PEPPER = 'cringe-court-mock-pepper-not-secret';

export interface MockVerifierOptions {
  action?: string;
  minLevel?: IdentityLevel;
  /** Second verification of the same persona+action from a different wallet => already_verified. */
  oncePerAction?: boolean;
  now?: () => number;
}

const PERSONAS: Record<string, { level: IdentityLevel; outcome?: MockOutcome }> = {
  'alice-orb': { level: IdentityLevel.ORB },
  'carol-orb': { level: IdentityLevel.ORB },
  'bob-device': { level: IdentityLevel.DEVICE },
  'dave-document': { level: IdentityLevel.DOCUMENT },
  'mallory-ineligible': { level: IdentityLevel.NONE, outcome: 'ineligible' },
};

export function mockProof(persona: string, opts: { level?: IdentityLevel; outcome?: MockOutcome } = {}): MockProof {
  const preset = PERSONAS[persona];
  return {
    mock: true,
    persona,
    level: opts.level ?? preset?.level ?? IdentityLevel.ORB,
    outcome: opts.outcome ?? preset?.outcome ?? 'ok',
  };
}

function isMockProof(p: unknown): p is MockProof {
  return typeof p === 'object' && p !== null && (p as MockProof).mock === true && typeof (p as MockProof).persona === 'string';
}

function personaHumanId(persona: string): `0x${string}` {
  const n = BigInt('0x' + createHash('sha256').update(persona).digest('hex'));
  return deriveHumanId(n, MOCK_PEPPER);
}

const FAILS: Record<Exclude<MockOutcome, 'ok' | 'ineligible'>, [FailureReason, string, boolean]> = {
  invalid: ['invalid_proof', 'The proof was rejected.', false],
  cancelled: ['cancelled', 'Verification was cancelled.', false],
  expired: ['expired', 'The verification request expired.', false],
  network: ['network', 'Could not reach the verification service. Please try again.', true],
};

export class MockVerifier implements IdentityVerifier {
  readonly kind = 'mock' as const;
  static readonly personas = Object.freeze(Object.keys(PERSONAS));
  private readonly seen = new Map<string, string>();

  constructor(private readonly opts: MockVerifierOptions = {}) {}

  async verify(req: VerificationRequest): Promise<VerificationResult> {
    const { action: expected, minLevel = IdentityLevel.NONE, oncePerAction = false } = this.opts;
    if (expected !== undefined && req.action !== expected) {
      return { ok: false, reason: 'wrong_action', message: 'Wrong action.', retryable: false };
    }
    if (!isMockProof(req.proof)) {
      return { ok: false, reason: 'malformed', message: 'Not a mock proof.', retryable: false };
    }
    const { persona, level = IdentityLevel.ORB, outcome = 'ok' } = req.proof;
    if (outcome === 'ineligible' || level < minLevel) {
      return { ok: false, reason: 'ineligible_level', message: 'This credential is not strong enough for this role.', retryable: false };
    }
    if (outcome !== 'ok') {
      const [reason, message, retryable] = FAILS[outcome];
      return { ok: false, reason, message, retryable };
    }
    const humanId = personaHumanId(persona);
    if (oncePerAction) {
      const key = `${humanId}|${req.action}`;
      const prev = this.seen.get(key);
      if (prev !== undefined && prev !== req.wallet.toLowerCase()) {
        return { ok: false, reason: 'already_verified', message: 'This person has already verified for this action.', retryable: false };
      }
      this.seen.set(key, req.wallet.toLowerCase());
    }
    return { ok: true, humanId, level, action: req.action, verifiedAt: Math.floor((this.opts.now ?? Date.now)() / 1000) };
  }
}

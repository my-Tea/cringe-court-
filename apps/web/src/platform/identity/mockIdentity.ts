import type { IdentityAction, IdentityPort, ProofRequest, ProofResult, ScreeningResult, VerificationLevel, VerifyContext, WorldIdProof } from '@cringe-court/core';
import { MockIdentity } from '@cringe-court/core/testing';
import {
  IdentityLevel,
  JUROR_MIN_LEVEL,
  PARTY_MIN_LEVEL,
  checkJurorEligibility,
  type IneligibleReason,
  type VerificationResult,
} from '@cringe-court/world-id/client';
import { JUROR_SCREENING_COPY } from './screeningCopy';

export const MOCK_APP_ID = 'app_staging_cringecourt_demo';

const LEVEL_OF: Record<VerificationLevel, IdentityLevel> = {
  orb: IdentityLevel.ORB,
  'secure-document': IdentityLevel.DOCUMENT,
  document: IdentityLevel.DOCUMENT,
  device: IdentityLevel.DEVICE,
};

const VERIFICATION_LEVEL: Record<IdentityLevel, VerificationLevel> = {
  [IdentityLevel.NONE]: 'device',
  [IdentityLevel.DEVICE]: 'device',
  [IdentityLevel.DOCUMENT]: 'document',
  [IdentityLevel.ORB]: 'orb',
};

/** Actions that put someone on a jury: they need the juror level and one seat per human. */
const JUROR_ACTIONS: ReadonlySet<IdentityAction> = new Set(['join-jury-pool', 'accept-jury-seat', 'gallery-vote']);

/**
 * Demo personas: a human whose id carries a credential word gets that level
 * ("device-sam" is device-only, "document-dee" holds a passport check). Every
 * other human is an Orb-verified person.
 */
export function mockLevelFor(human: string): IdentityLevel {
  if (/(^|[-:_])device($|[-:_])/i.test(human)) return IdentityLevel.DEVICE;
  if (/(^|[-:_])(document|passport)($|[-:_])/i.test(human)) return IdentityLevel.DOCUMENT;
  return IdentityLevel.ORB;
}

const REASON_TO_RESULT: Record<IneligibleReason, { reason: Extract<ScreeningResult, { ok: false }>['reason']; copy: keyof typeof JUROR_SCREENING_COPY }> = {
  not_verified: { reason: 'not-verified', copy: 'not_verified' },
  ineligible_level: { reason: 'not-verified', copy: 'ineligible_level' },
  is_party: { reason: 'conflicted', copy: 'is_party' },
  already_seated: { reason: 'already-used', copy: 'already_seated' },
};

export interface MockIdentityOptions {
  /** Override the credential level the persona holds. Default: derived from the human's name. */
  level?: IdentityLevel;
  /** What the next requestProof does (forwarded to the core mock). */
  behaviour?: 'verified' | 'cancelled' | 'not-verified' | 'error';
  appId?: string;
}

/**
 * Core's MockIdentity for proofs, with the production eligibility policy on
 * top: `verify` runs world-id's `checkJurorEligibility`, so the demo refuses
 * a device-only human a jury seat with the same copy the real flow shows.
 */
export class PolicyMockIdentity extends MockIdentity {
  readonly level: IdentityLevel;
  readonly #seated = new Set<string>();

  constructor(human: string, options: MockIdentityOptions = {}) {
    super({ human, appId: options.appId ?? MOCK_APP_ID, ...(options.behaviour ? { behaviour: options.behaviour } : {}) });
    this.level = options.level ?? mockLevelFor(human);
  }

  override async requestProof(request: ProofRequest, signal?: AbortSignal): Promise<ProofResult> {
    const r = await super.requestProof(request, signal);
    if (!r.ok) return r;
    return { ok: true, proof: { ...r.proof, verificationLevel: VERIFICATION_LEVEL[this.level] } };
  }

  override async verify(proof: WorldIdProof, request: ProofRequest, context: VerifyContext = {}): Promise<ScreeningResult> {
    const juror = JUROR_ACTIONS.has(request.action);
    const level = LEVEL_OF[proof.verificationLevel];
    if (!juror) {
      // Filing or joining a case needs only the party level (unless the request asks for more).
      const floor = request.minLevel === 'orb' ? JUROR_MIN_LEVEL : PARTY_MIN_LEVEL;
      if (level < floor) return { ok: false, reason: 'not-verified', message: JUROR_SCREENING_COPY.not_verified };
      return super.verify(proof, request, context);
    }
    const scope = `${request.action}:${request.signal}:${proof.nullifierHash.toLowerCase()}`;
    const result: VerificationResult = { ok: true, humanId: proof.nullifierHash, level, action: request.action, verifiedAt: 0 };
    const verdict = checkJurorEligibility(result, {
      partyHumanIds: [...(context.exclude ?? [])],
      seatedHumanIds: this.#seated.has(scope) ? [proof.nullifierHash] : [],
    });
    if (!verdict.eligible) {
      const m = REASON_TO_RESULT[verdict.reason];
      return { ok: false, reason: m.reason, message: JUROR_SCREENING_COPY[m.copy] };
    }
    this.#seated.add(scope);
    return { ok: true, nullifier: proof.nullifierHash };
  }
}

/** The demo identity for one human. */
export function createMockIdentity(human: string, options: MockIdentityOptions = {}): IdentityPort {
  return new PolicyMockIdentity(human, options);
}

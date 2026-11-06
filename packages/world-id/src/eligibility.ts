import { IdentityLevel, type VerificationResult } from './types.js';

export const JUROR_MIN_LEVEL = IdentityLevel.ORB;
export const PARTY_MIN_LEVEL = IdentityLevel.DEVICE;

export type IneligibleReason = 'not_verified' | 'ineligible_level' | 'is_party' | 'already_seated';
export type JurorEligibility = { eligible: true } | { eligible: false; reason: IneligibleReason };

export function checkJurorEligibility(
  result: VerificationResult,
  ctx: { partyHumanIds: string[]; seatedHumanIds: string[] },
): JurorEligibility {
  if (!result.ok) return { eligible: false, reason: 'not_verified' };
  if (result.level < JUROR_MIN_LEVEL) return { eligible: false, reason: 'ineligible_level' };
  const id = result.humanId.toLowerCase();
  if (ctx.partyHumanIds.some((p) => p.toLowerCase() === id)) return { eligible: false, reason: 'is_party' };
  if (ctx.seatedHumanIds.some((p) => p.toLowerCase() === id)) return { eligible: false, reason: 'already_seated' };
  return { eligible: true };
}

/** Argument order matches HumanRegistry.attest(wallet, humanId, level, expiresAt). */
export interface Attestation {
  wallet: `0x${string}`;
  humanId: `0x${string}`;
  level: IdentityLevel;
  expiresAt: bigint;
}

/** `now` is in milliseconds (Date.now style); expiresAt is unix seconds. */
export function toAttestation(
  wallet: `0x${string}`,
  result: VerificationResult,
  opts: { ttlSeconds: number; now?: () => number },
): Attestation {
  if (!result.ok) throw new Error('cannot attest a failed verification');
  const nowSec = Math.floor((opts.now ?? Date.now)() / 1000);
  return { wallet, humanId: result.humanId, level: result.level, expiresAt: BigInt(nowSec + opts.ttlSeconds) };
}

/** Honest UX copy. A proof of human establishes eligibility, not impartiality. */
export const JUROR_SCREENING_COPY = {
  title: 'Juror Screening',
  intro:
    'Before you take a seat, the court checks that you are a real, unique person. We never learn who you are, and nothing about your real identity is shown to anyone.',
  honesty:
    'This check confirms you are one human. It does not prove you are impartial. That part is on you, the bailiff, and a lot of random draws.',
  success: 'Screening passed. The bench has a seat with your name on it. Well, a pseudonym.',
  not_verified: 'The court could not confirm you are human this time. No harm done, you can try again.',
  ineligible_level: 'A paid seat needs Proof of Human. You can still watch and vote.',
  is_party: 'You cannot judge your own case.',
  already_seated: 'You already hold a seat on this case. One person, one ballot.',
  cancelled: 'Screening cancelled. Your seat stays open whenever you are ready.',
  expired: 'That screening request timed out. Start a fresh one.',
  already_verified: 'This person has already been screened for this court. One human, one identity.',
  invalid_proof: 'The proof did not check out, so no seat was granted.',
  wrong_action: 'That proof was made for a different court session. Please start again from here.',
  network: 'The screening desk is unreachable right now. Try again in a moment.',
  malformed: 'Something odd came back from the screening. Please try again.',
} as const;

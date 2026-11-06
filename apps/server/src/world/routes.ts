/**
 * World ID routes. The signing key never leaves this process.
 * The signal is the session wallet, not whatever the client claims.
 */
import { signRequest } from '@worldcoin/idkit-core/signing';
import { IdkitVerifier, IdentityLevel, checkJurorEligibility, type IdentityVerifier, type VerificationResult } from '@cringe-court/world-id';
import type { WorldServerConfig } from '../config';
import type { Session } from '../sessions';
import { HumanStore } from './humans';

const rec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface WorldService {
  humans: HumanStore;
  rpContext(session: Session, kind?: 'uniqueness' | 'session'): {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
    signal: string;
  };
  verify(session: Session, body: unknown): Promise<VerificationResult>;
}

/** A paid seat reads the stored person. Unbound, the wrong person, or too weak a check is refused. */
export function seatGate(
  humans: HumanStore,
  wallet: string,
  action: string,
  ctx: { partyHumanIds: readonly string[]; seatedHumanIds: readonly string[] },
): { ok: true } | { ok: false; message: string } {
  const human = humans.byWallet(wallet);
  if (!human) return { ok: false, message: 'Verify you are human before taking this seat.' };
  const gate = checkJurorEligibility(
    { ok: true, humanId: human.humanId as `0x${string}`, level: human.level as IdentityLevel, action, verifiedAt: human.verifiedAt },
    { partyHumanIds: [...ctx.partyHumanIds], seatedHumanIds: [...ctx.seatedHumanIds] },
  );
  if (gate.eligible) return { ok: true };
  if (gate.reason === 'is_party') return { ok: false, message: 'You cannot judge your own case.' };
  if (gate.reason === 'already_seated') return { ok: false, message: 'You already hold a seat on this case.' };
  if (gate.reason === 'ineligible_level') return { ok: false, message: 'A paid seat needs Proof of Human. You can still watch and vote.' };
  return { ok: false, message: 'Verify you are human before taking this seat.' };
}

export function createWorldService(o: { config: WorldServerConfig; humans: HumanStore; verifier?: IdentityVerifier }): WorldService {
  const verifier =
    o.verifier ??
    new IdkitVerifier({
      rpId: o.config.rpId,
      appId: o.config.appId,
      action: o.config.action,
      pepper: o.config.pepper,
      environment: o.config.environment,
    });
  return {
    humans: o.humans,
    rpContext(session, kind = 'uniqueness') {
      // Session proofs have no action, so their request is signed without one.
      const signed = signRequest(kind === 'session' ? { signingKeyHex: o.config.signingKey } : { signingKeyHex: o.config.signingKey, action: o.config.action });
      return {
        rp_id: o.config.rpId,
        nonce: signed.nonce,
        created_at: signed.createdAt,
        expires_at: signed.expiresAt,
        signature: signed.sig,
        signal: `wallet:${session.persona.account}`,
      };
    },
    async verify(session, body) {
      const wallet = session.persona.account;
      const signal = `wallet:${wallet}`;
      const result = await verifier.verify({
        proof: rec(body) ? body.proof : undefined,
        action: o.config.action,
        wallet,
        signal,
      });
      if (!result.ok) return result;
      const bound = o.humans.bind({ humanId: result.humanId, wallet, level: result.level });
      if (bound.ok) return result;
      return {
        ok: false,
        reason: 'already_verified',
        message: bound.reason === 'other-wallet' ? 'This person is already bound to another wallet.' : 'This wallet is already bound to another person.',
        retryable: false,
      };
    },
  };
}

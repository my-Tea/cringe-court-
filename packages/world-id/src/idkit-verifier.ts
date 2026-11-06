import { deriveHumanId } from './human-id.js';
import {
  IdentityLevel,
  type FailureReason,
  type IdentityVerifier,
  type VerificationRequest,
  type VerificationResult,
} from './types.js';

export interface IdkitVerifierOptions {
  rpId: string;
  appId?: string;
  action: string;
  pepper: Uint8Array | string;
  /** Minimum level to accept. Default NONE (any verified credential). Jurors: ORB. */
  minLevel?: IdentityLevel;
  fetch?: typeof fetch;
  /** Default https://developer.worldcoin.org/api/v4/verify */
  endpoint?: string;
  timeoutMs?: number;
  /** ms clock, default Date.now */
  now?: () => number;
}

export const DEFAULT_VERIFY_ENDPOINT = 'https://developer.worldcoin.org/api/v4/verify';

/** Map an IDKit response `identifier` to a level. Unknown identifiers -> NONE. */
export function levelFromCredential(identifier: string): IdentityLevel {
  const id = identifier.toLowerCase().replace(/[\s-]+/g, '_');
  if (id === 'proof_of_human' || id === 'orb') return IdentityLevel.ORB;
  if (['passport', 'mnc', 'eid', 'document', 'secure_document'].includes(id)) return IdentityLevel.DOCUMENT;
  if (id === 'selfie' || id === 'device') return IdentityLevel.DEVICE;
  return IdentityLevel.NONE;
}

const CODE_MAP: Array<[RegExp, FailureReason]> = [
  [/max_verifications|nullifier_replayed|already_verified|already_exists|duplicate_nonce/, 'already_verified'],
  [/user_rejected|cancel|verification_rejected/, 'cancelled'],
  [/expired|timestamp_too_old|timestamp_too_far|invalid_timestamp/, 'expired'],
  [/credential_unavailable|identity_attributes_not_matched/, 'ineligible_level'],
  [/action/, 'wrong_action'],
];

function reasonFromCode(code: string): FailureReason {
  const c = code.toLowerCase();
  for (const [re, r] of CODE_MAP) if (re.test(c)) return r;
  return 'invalid_proof';
}

const RETRYABLE: ReadonlySet<FailureReason> = new Set(['network']);

function fail(reason: FailureReason, message: string): VerificationResult {
  return { ok: false, reason, message, retryable: RETRYABLE.has(reason) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface Extracted {
  nullifier: string;
  level: IdentityLevel;
}

/** Pick the highest-level response carrying a string nullifier. Defensive: shape is untrusted. */
function extract(proof: unknown): Extracted | undefined {
  if (!isRecord(proof) || !Array.isArray(proof.responses)) return undefined;
  let best: Extracted | undefined;
  for (const r of proof.responses) {
    if (!isRecord(r) || typeof r.nullifier !== 'string' || typeof r.identifier !== 'string') continue;
    const level = levelFromCredential(r.identifier);
    if (!best || level > best.level) best = { nullifier: r.nullifier, level };
  }
  return best;
}

export class IdkitVerifier implements IdentityVerifier {
  readonly kind = 'idkit' as const;
  private readonly o: Required<Pick<IdkitVerifierOptions, 'rpId' | 'action' | 'pepper' | 'minLevel' | 'timeoutMs' | 'endpoint'>> &
    IdkitVerifierOptions;

  constructor(opts: IdkitVerifierOptions) {
    if (!opts.rpId) throw new TypeError('rpId is required');
    this.o = {
      ...opts,
      minLevel: opts.minLevel ?? IdentityLevel.NONE,
      timeoutMs: opts.timeoutMs ?? 10_000,
      endpoint: (opts.endpoint ?? DEFAULT_VERIFY_ENDPOINT).replace(/\/+$/, ''),
    };
  }

  async verify(req: VerificationRequest): Promise<VerificationResult> {
    if (req.action !== this.o.action) return fail('wrong_action', 'This proof was requested for a different action.');
    const proof = req.proof;
    if (!isRecord(proof)) return fail('malformed', 'Verification payload is not an object.');
    // The client may forward an IDKit failure instead of a result.
    if (typeof proof.error === 'string' && !('responses' in proof)) {
      const r = reasonFromCode(proof.error);
      return fail(r === 'invalid_proof' ? 'cancelled' : r, 'Verification was not completed.');
    }
    if (typeof proof.action === 'string' && proof.action !== this.o.action) {
      return fail('wrong_action', 'Proof action does not match this app.');
    }
    const found = extract(proof);
    if (!found) return fail('malformed', 'Proof has no usable credential response.');

    const doFetch = this.o.fetch ?? globalThis.fetch;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs);
    let res: Response;
    let bodyText: string;
    try {
      res = await doFetch(`${this.o.endpoint}/${this.o.rpId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(proof),
        signal: ctl.signal,
      });
      bodyText = await res.text();
    } catch {
      return fail('network', 'Could not reach the verification service. Please try again.');
    } finally {
      clearTimeout(timer);
    }

    let body: unknown;
    try {
      body = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      body = undefined;
    }

    if (res.status >= 500) return fail('network', 'Verification service is having trouble. Please try again.');

    if (!res.ok || !isRecord(body) || body.success !== true) {
      if (res.ok && !isRecord(body)) return fail('malformed', 'Verification service returned an unreadable response.');
      const code = isRecord(body) ? [body.code, body.error, body.attribute].find((x) => typeof x === 'string') : undefined;
      const reason = typeof code === 'string' ? reasonFromCode(code) : 'invalid_proof';
      const msg = reason === 'already_verified' ? 'This person has already verified for this action.' : 'The proof was rejected.';
      return fail(reason, msg);
    }

    // Defensive: if the response echoes an action, it must match.
    if (typeof body.action === 'string' && body.action !== this.o.action) {
      return fail('wrong_action', 'Verified action does not match this app.');
    }

    if (found.level < this.o.minLevel) {
      return fail('ineligible_level', 'This credential is not strong enough for this role.');
    }

    let humanId: `0x${string}`;
    try {
      humanId = deriveHumanId(found.nullifier, this.o.pepper);
    } catch {
      return fail('malformed', 'Proof nullifier is not in a recognised format.');
    }
    return {
      ok: true,
      humanId,
      level: found.level,
      action: this.o.action,
      verifiedAt: Math.floor((this.o.now ?? Date.now)() / 1000),
    };
  }
}

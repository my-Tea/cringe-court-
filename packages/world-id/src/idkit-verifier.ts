import { hashSignal } from '@worldcoin/idkit-core/hashing';
import { deriveHumanId, deriveSessionHumanId } from './human-id.js';
import { levelFromCredential } from './level.js';
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
  /** Default https://developer.world.org/api/v4/verify */
  endpoint?: string;
  /** Sent with the proof. Staging for the simulator, production for World App. */
  environment?: 'staging' | 'production';
  timeoutMs?: number;
  /** ms clock, default Date.now */
  now?: () => number;
}

export { levelFromCredential };

export const DEFAULT_VERIFY_ENDPOINT = 'https://developer.world.org/api/v4/verify';

const CODE_MAP: Array<[RegExp, FailureReason]> = [
  [/max_verifications|nullifier_replayed|already_verified|already_exists|duplicate_nonce/, 'already_verified'],
  [/user_rejected|cancel|verification_rejected/, 'cancelled'],
  [/expired|timestamp_too_old|timestamp_too_far|invalid_timestamp/, 'expired'],
  [/credential_unavailable|identity_attributes_not_matched|world_id_4_not_available/, 'ineligible_level'],
  [/all_verifications_failed|app_not_migrated/, 'invalid_proof'],
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
    if (!isRecord(r) || typeof r.identifier !== 'string') continue;
    // A session proof carries [session nullifier, generated action] instead of one nullifier.
    const nullifier = typeof r.nullifier === 'string' ? r.nullifier : Array.isArray(r.session_nullifier) ? r.session_nullifier[0] : undefined;
    if (typeof nullifier !== 'string') continue;
    const level = levelFromCredential(r.identifier);
    if (!best || level > best.level) best = { nullifier, level };
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
        body: JSON.stringify(this.o.environment ? { ...proof, environment: this.o.environment } : proof),
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
      const code = isRecord(body) ? failureCode(body) : undefined;
      const reason = typeof code === 'string' ? reasonFromCode(code) : 'invalid_proof';
      const msg = reason === 'already_verified' ? 'This person has already verified for this action.' : 'The proof was rejected.';
      return fail(reason, msg);
    }

    // Defensive: if the response echoes an action, it must match.
    if (typeof body.action === 'string' && body.action !== this.o.action) {
      return fail('wrong_action', 'Verified action does not match this app.');
    }
    if (req.signal && !signalMatches(req.signal, proof, body)) {
      return fail('invalid_proof', 'This proof was made for a different wallet.');
    }

    const sessionId = typeof proof.session_id === 'string' && !('action' in proof) ? proof.session_id : null;
    const portalNullifier = nullifierFromPortal(body);
    if (!sessionId && portalNullifier && portalNullifier !== found.nullifier) {
      return fail('invalid_proof', 'The verification service reported a different person.');
    }
    const nullifier = portalNullifier ?? found.nullifier;

    if (found.level < this.o.minLevel) {
      return fail('ineligible_level', 'This credential is not strong enough for this role.');
    }

    let humanId: `0x${string}`;
    try {
      humanId = sessionId ? deriveSessionHumanId(sessionId, this.o.pepper) : deriveHumanId(nullifier, this.o.pepper);
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

function failureCode(body: Record<string, unknown>): string | undefined {
  const direct = [body.code, body.error, body.attribute].find((x) => typeof x === 'string');
  if (typeof direct === 'string') return direct;
  if (!Array.isArray(body.results)) return undefined;
  for (const row of body.results) {
    if (!isRecord(row)) continue;
    const code = [row.code, row.error, row.attribute].find((x) => typeof x === 'string');
    if (typeof code === 'string') return code;
  }
  return undefined;
}

function nullifierFromPortal(body: Record<string, unknown>): string | undefined {
  if (typeof body.nullifier === 'string') return body.nullifier;
  if (!Array.isArray(body.results)) return undefined;
  for (const row of body.results) {
    if (isRecord(row) && typeof row.nullifier === 'string') return row.nullifier;
  }
  return undefined;
}

/** Every signal hash in the proof and the portal reply must be this wallet's. */
function signalMatches(signal: string, proof: Record<string, unknown>, body: Record<string, unknown>): boolean {
  const want = hashSignal(signal).toLowerCase();
  const hashes: string[] = [];
  const collect = (node: unknown) => {
    if (!isRecord(node)) return;
    if (typeof node.signal_hash === 'string') hashes.push(node.signal_hash);
    if (Array.isArray(node.responses)) node.responses.forEach(collect);
    if (Array.isArray(node.results)) node.results.forEach(collect);
  };
  collect(proof);
  collect(body);
  return hashes.length > 0 && hashes.every((h) => h.toLowerCase() === want);
}

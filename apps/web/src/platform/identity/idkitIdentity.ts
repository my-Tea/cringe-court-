import type { Hex, IdentityAction, IdentityPort, ProofRequest, ProofResult, ScreeningResult, VerificationLevel, VerifyContext, WorldIdProof } from '@cringe-court/core';
import { IdentityLevel, JUROR_SCREENING_COPY, levelFromCredential, type FailureReason, type VerificationResult } from '@cringe-court/world-id/client';

/** The slice of `@worldcoin/idkit-core` this adapter uses (injectable for tests). */
export interface IdkitRequestLike {
  readonly connectorURI: string;
  pollUntilCompletion(options?: { signal?: AbortSignal; pollInterval?: number; timeout?: number }): Promise<{ success: true; result: unknown } | { success: false; error: string }>;
}
export interface IdkitRuntime {
  IDKit: {
    request(config: { app_id: `app_${string}`; action: string; rp_context: unknown; allow_legacy_proofs: boolean }): {
      preset(preset: unknown, options?: { signal?: AbortSignal }): Promise<IdkitRequestLike>;
    };
  };
  orbLegacy(opts?: { signal?: string }): unknown;
  deviceLegacy(opts?: { signal?: string }): unknown;
}

export type ConnectHandler = (connectorURI: string, cancel: () => void) => void | (() => void);

export interface IdkitIdentityOptions {
  appId: `app_${string}`;
  backendUrl: string;
  /** Called with the World App link as soon as the request exists. May return a cleanup run when the request settles. */
  onConnect?: ConnectHandler;
  /** Wallet forwarded to the verifier backend (for attestation). */
  wallet?: () => string | undefined;
  fetch?: typeof fetch;
  /** Default: lazy `import('@worldcoin/idkit-core')`, so IDKit stays out of the main bundle. */
  idkit?: IdkitRuntime | (() => Promise<IdkitRuntime>);
}

const JUROR_ACTIONS: ReadonlySet<IdentityAction> = new Set(['join-jury-pool', 'accept-jury-seat', 'gallery-vote']);

const CANCEL_CODES = new Set(['user_rejected', 'verification_rejected', 'cancelled']);
const NOT_VERIFIED_CODES = new Set(['credential_unavailable', 'identity_attributes_not_matched']);

/** Map an IDKit error code to a core ProofResult failure. */
export function mapIdkitError(code: string): Extract<ProofResult, { ok: false }> {
  if (CANCEL_CODES.has(code)) return { ok: false, reason: 'cancelled', message: JUROR_SCREENING_COPY.cancelled };
  if (NOT_VERIFIED_CODES.has(code)) return { ok: false, reason: 'not-verified', message: JUROR_SCREENING_COPY.ineligible_level };
  if (code === 'timeout' || /expired|timestamp/.test(code)) return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.expired };
  if (code === 'connection_failed') return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.network };
  return { ok: false, reason: 'error', message: `World ID could not finish (${code}). Please try again.` };
}

const rec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function toHex32(v: string): Hex {
  if (/^0x[0-9a-fA-F]+$/.test(v)) return v as Hex;
  try {
    return `0x${BigInt(v).toString(16).padStart(64, '0')}` as Hex;
  } catch {
    return `0x${Array.from(new TextEncoder().encode(v), (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
  }
}

const VERIFICATION: Record<IdentityLevel, VerificationLevel> = {
  [IdentityLevel.NONE]: 'device',
  [IdentityLevel.DEVICE]: 'device',
  [IdentityLevel.DOCUMENT]: 'document',
  [IdentityLevel.ORB]: 'orb',
};

/** Best-level response of an IDKit result, shaped as core's WorldIdProof. */
function toWorldIdProof(result: unknown): WorldIdProof | null {
  if (!rec(result) || !Array.isArray(result.responses)) return null;
  let best: { level: IdentityLevel; item: Record<string, unknown> } | null = null;
  for (const item of result.responses) {
    if (!rec(item) || typeof item.nullifier !== 'string') continue;
    const level = levelFromCredential(typeof item.identifier === 'string' ? item.identifier : '');
    if (!best || level > best.level) best = { level, item };
  }
  if (!best) return null;
  const p = best.item.proof;
  const merkle = best.item.merkle_root;
  return {
    nullifierHash: toHex32(best.item.nullifier as string),
    merkleRoot: toHex32(typeof merkle === 'string' ? merkle : '0'),
    proof: toHex32(typeof p === 'string' ? p : '0'),
    verificationLevel: VERIFICATION[best.level],
  };
}

const COPY_FOR: Record<FailureReason, keyof typeof JUROR_SCREENING_COPY> = {
  invalid_proof: 'invalid_proof',
  ineligible_level: 'ineligible_level',
  already_verified: 'already_verified',
  cancelled: 'cancelled',
  expired: 'expired',
  wrong_action: 'wrong_action',
  network: 'network',
  malformed: 'malformed',
};

/** Map world-id's VerificationResult (+ the caller's party exclusions) to core's ScreeningResult. */
export function screeningFromVerification(res: VerificationResult, nullifier: Hex, juror: boolean, exclude: readonly Hex[] = []): ScreeningResult {
  if (!res.ok) {
    const reason = res.reason === 'cancelled' ? 'cancelled' : res.reason === 'network' || res.reason === 'malformed' ? 'error' : res.reason === 'already_verified' ? 'already-used' : 'not-verified';
    return { ok: false, reason, message: JUROR_SCREENING_COPY[COPY_FOR[res.reason]] };
  }
  if (juror && res.level < IdentityLevel.ORB) return { ok: false, reason: 'not-verified', message: JUROR_SCREENING_COPY.ineligible_level };
  const id = res.humanId.toLowerCase();
  if (juror && exclude.some((x) => x.toLowerCase() === id || x.toLowerCase() === nullifier.toLowerCase())) {
    return { ok: false, reason: 'conflicted', message: JUROR_SCREENING_COPY.is_party };
  }
  return { ok: true, nullifier: res.humanId };
}

function isVerificationResult(v: unknown): v is VerificationResult {
  return rec(v) && typeof v.ok === 'boolean' && (v.ok ? typeof v.humanId === 'string' && typeof v.level === 'number' : typeof v.reason === 'string');
}

export class IdkitIdentityPort implements IdentityPort {
  readonly id = 'world-idkit' as const;
  readonly appId: string;
  readonly #o: IdkitIdentityOptions;
  readonly #raw = new Map<string, unknown>();
  #runtime: Promise<IdkitRuntime> | null = null;

  constructor(options: IdkitIdentityOptions) {
    this.#o = { ...options, backendUrl: options.backendUrl.replace(/\/+$/, '') };
    this.appId = options.appId;
  }

  #loadRuntime(): Promise<IdkitRuntime> {
    const inj = this.#o.idkit;
    if (inj && typeof inj !== 'function') return Promise.resolve(inj);
    this.#runtime ??= inj ? inj() : (import('@worldcoin/idkit-core') as unknown as Promise<IdkitRuntime>);
    return this.#runtime;
  }

  #fetch(): typeof fetch {
    return this.#o.fetch ?? ((...a) => globalThis.fetch(...a));
  }

  async requestProof(request: ProofRequest, signal?: AbortSignal): Promise<ProofResult> {
    if (signal?.aborted) return mapIdkitError('cancelled');
    const own = new AbortController();
    const abort = () => own.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let cleanup: void | (() => void) = undefined;
    try {
      let rpContext: unknown;
      try {
        const q = new URLSearchParams({ action: request.action, signal: request.signal });
        const res = await this.#fetch()(`${this.#o.backendUrl}/rp-context?${q}`, { signal: own.signal });
        if (!res.ok) return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.network };
        rpContext = await res.json();
      } catch {
        return own.signal.aborted ? mapIdkitError('cancelled') : { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.network };
      }
      if (!rec(rpContext)) return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.malformed };

      const runtime = await this.#loadRuntime();
      const juror = JUROR_ACTIONS.has(request.action);
      const preset = juror || request.minLevel === 'orb' ? runtime.orbLegacy({ signal: request.signal }) : runtime.deviceLegacy({ signal: request.signal });
      const req = await runtime.IDKit.request({ app_id: this.#o.appId, action: request.action, rp_context: rpContext, allow_legacy_proofs: true }).preset(preset, { signal: own.signal });
      cleanup = this.#o.onConnect?.(req.connectorURI, abort);
      const done = await req.pollUntilCompletion({ signal: own.signal });
      if (!done.success) return mapIdkitError(own.signal.aborted ? 'cancelled' : done.error);
      const proof = toWorldIdProof(done.result);
      if (!proof) return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.malformed };
      this.#raw.set(`${request.action}:${request.signal}:${proof.nullifierHash.toLowerCase()}`, done.result);
      return { ok: true, proof };
    } catch (err) {
      if (own.signal.aborted) return mapIdkitError('cancelled');
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : JUROR_SCREENING_COPY.malformed };
    } finally {
      signal?.removeEventListener('abort', abort);
      if (typeof cleanup === 'function') cleanup();
    }
  }

  async verify(proof: WorldIdProof, request: ProofRequest, context: VerifyContext = {}): Promise<ScreeningResult> {
    const raw = this.#raw.get(`${request.action}:${request.signal}:${proof.nullifierHash.toLowerCase()}`);
    if (raw === undefined) return { ok: false, reason: 'not-verified', message: JUROR_SCREENING_COPY.not_verified };
    let body: unknown;
    try {
      const wallet = this.#o.wallet?.();
      const res = await this.#fetch()(`${this.#o.backendUrl}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proof: raw, action: request.action, signal: request.signal, ...(wallet ? { wallet } : {}) }),
      });
      body = await res.json().catch(() => undefined);
      if (res.status >= 500 && !isVerificationResult(body)) return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.network };
    } catch {
      return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.network };
    }
    if (!isVerificationResult(body)) return { ok: false, reason: 'error', message: JUROR_SCREENING_COPY.malformed };
    return screeningFromVerification(body, proof.nullifierHash, JUROR_ACTIONS.has(request.action), context.exclude);
  }
}

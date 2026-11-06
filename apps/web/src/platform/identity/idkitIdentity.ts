import type { Hex, IdentityAction, IdentityPort, ProofRequest, ProofResult, ScreeningResult, VerificationLevel, VerifyContext, WorldIdProof } from '@cringe-court/core';
import { IdentityLevel, levelFromCredential, type FailureReason, type VerificationResult } from '@cringe-court/world-id/client';
import { t } from '@/i18n';
import { screeningCopy, type ScreeningCopyKey } from '@/i18n/domain';

/** The slice of `@worldcoin/idkit-core` this adapter uses (injectable for tests). */
export interface IdkitRequestLike {
  readonly connectorURI: string;
  pollUntilCompletion(options?: { signal?: AbortSignal; pollInterval?: number; timeout?: number }): Promise<{ success: true; result: unknown } | { success: false; error: string }>;
}
interface IdkitBuilderLike {
  preset(preset: unknown, options?: { signal?: AbortSignal }): Promise<IdkitRequestLike>;
}
interface IdkitSessionConfig {
  app_id: `app_${string}`;
  rp_context: unknown;
  environment?: 'staging' | 'production';
}

export interface IdkitRuntime {
  IDKit: {
    request(config: {
      app_id: `app_${string}`;
      action: string;
      rp_context: unknown;
      allow_legacy_proofs: boolean;
      environment?: 'staging' | 'production';
    }): IdkitBuilderLike;
    createSession?(config: IdkitSessionConfig): IdkitBuilderLike;
    proveSession?(sessionId: `session_${string}`, config: IdkitSessionConfig): IdkitBuilderLike;
  };
  proofOfHuman(opts?: { signal?: string }): unknown;
  orbLegacy(opts?: { signal?: string }): unknown;
  deviceLegacy(opts?: { signal?: string }): unknown;
}

/** One app-wide World action. Nullifiers are scoped to it, so every seat uses the same one. */
export const WORLD_ACTION = 'cringecourt-juror';

export type ConnectHandler = (connectorURI: string, cancel: () => void) => void | (() => void);

export interface IdkitIdentityOptions {
  appId: `app_${string}`;
  backendUrl: string;
  /** World action signed into rp_context. Default `cringecourt-juror`. The caller's purpose stays app-side. */
  action?: string;
  /** Staging for the simulator, production for World App. */
  environment?: 'staging' | 'production';
  /** Called with the World App link as soon as the request exists. May return a cleanup run when the request settles. */
  onConnect?: ConnectHandler;
  /** Wallet forwarded to the verifier backend (for attestation). */
  wallet?: () => string | undefined;
  /** Court-server session. The proof is bound to this device, not to a wallet the page invents. */
  token?: () => string | null | undefined;
  fetch?: typeof fetch;
  /** Default: lazy `import('@worldcoin/idkit-core')`, so IDKit stays out of the main bundle. */
  idkit?: IdkitRuntime | (() => Promise<IdkitRuntime>);
}

const JUROR_ACTIONS: ReadonlySet<IdentityAction> = new Set(['join-jury-pool', 'accept-jury-seat', 'gallery-vote']);

const CANCEL_CODES = new Set(['user_rejected', 'verification_rejected', 'cancelled']);
const NOT_VERIFIED_CODES = new Set(['credential_unavailable', 'identity_attributes_not_matched', 'world_id_4_not_available']);

const REPLAY_CODES = new Set(['nullifier_replayed', 'max_verifications_reached']);
/** World's id for this person's returning session. It outlives a new game. */
const SESSION_KEY = 'cc:world:session';

function storedSession(): `session_${string}` | null {
  try {
    const v = window.localStorage.getItem(SESSION_KEY);
    return v?.startsWith('session_') ? (v as `session_${string}`) : null;
  } catch {
    return null;
  }
}

function storeSession(id: unknown): void {
  try {
    if (typeof id === 'string') window.localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* private mode: they will scan again next time */
  }
}

/** Map an IDKit error code to a core ProofResult failure. */
export function mapIdkitError(code: string): Extract<ProofResult, { ok: false }> {
  if (CANCEL_CODES.has(code)) return { ok: false, reason: 'cancelled', message: screeningCopy('cancelled') };
  // World allows one proof per person per action, and World App refuses to make a second.
  if (code === 'nullifier_replayed' || code === 'max_verifications_reached') return { ok: false, reason: 'error', message: t('shell.identity.error.replayed') };
  if (NOT_VERIFIED_CODES.has(code)) return { ok: false, reason: 'not-verified', message: screeningCopy('ineligible_level') };
  if (code === 'timeout' || /expired|timestamp/.test(code)) return { ok: false, reason: 'error', message: screeningCopy('expired') };
  if (code === 'connection_failed' || code === 'inclusion_proof_pending') return { ok: false, reason: 'error', message: screeningCopy('network') };
  return { ok: false, reason: 'error', message: t('shell.identity.error.generic', { code }) };
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
    if (!rec(item) || (typeof item.nullifier !== 'string' && !Array.isArray(item.session_nullifier))) continue;
    const level = levelFromCredential(typeof item.identifier === 'string' ? item.identifier : '');
    if (!best || level > best.level) best = { level, item };
  }
  if (!best) return null;
  const p = best.item.proof;
  const merkle = best.item.merkle_root;
  return {
    nullifierHash: toHex32((best.item.nullifier ?? (best.item.session_nullifier as string[])[0]) as string),
    merkleRoot: toHex32(typeof merkle === 'string' ? merkle : '0'),
    proof: toHex32(typeof p === 'string' ? p : '0'),
    verificationLevel: VERIFICATION[best.level],
  };
}

const COPY_FOR: Record<FailureReason, ScreeningCopyKey> = {
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
    const reason =
      res.reason === 'cancelled'
        ? 'cancelled'
        : res.reason === 'network' || res.reason === 'malformed'
          ? 'error'
          : res.reason === 'already_verified'
            ? 'already-used'
            : 'not-verified';
    return { ok: false, reason, message: screeningCopy(COPY_FOR[res.reason]) };
  }
  if (juror && res.level < IdentityLevel.ORB) return { ok: false, reason: 'not-verified', message: screeningCopy('ineligible_level') };
  const id = res.humanId.toLowerCase();
  if (juror && exclude.some((x) => x.toLowerCase() === id || x.toLowerCase() === nullifier.toLowerCase())) {
    return { ok: false, reason: 'conflicted', message: screeningCopy('is_party') };
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
    const base = this.#o.fetch ?? ((...a) => globalThis.fetch(...a));
    return (input, init) => {
      const headers = new Headers(init?.headers);
      const token = this.#o.token?.();
      if (token) headers.set('authorization', `Bearer ${token}`);
      return base(input, { ...init, headers });
    };
  }

  /**
   * World gives one uniqueness proof per person per action, ever. A person World
   * already knows proves a session instead, so a new browser is not a dead end.
   */
  async requestProof(request: ProofRequest, signal?: AbortSignal): Promise<ProofResult> {
    const first = await this.#prove(request, signal, storedSession() ? 'session' : 'uniqueness');
    return first === 'replayed' ? this.#prove(request, signal, 'session').then((r) => (r === 'replayed' ? mapIdkitError('nullifier_replayed') : r)) : first;
  }

  async #prove(request: ProofRequest, signal: AbortSignal | undefined, kind: 'uniqueness' | 'session'): Promise<ProofResult | 'replayed'> {
    if (signal?.aborted) return mapIdkitError('cancelled');
    const own = new AbortController();
    const abort = () => own.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let cleanup: void | (() => void) = undefined;
    try {
      let rawContext: Record<string, unknown>;
      try {
        const res = await this.#fetch()(`${this.#o.backendUrl}/rp-context${kind === 'session' ? '?kind=session' : ''}`, { signal: own.signal });
        if (!res.ok) return { ok: false, reason: 'error', message: screeningCopy('network') };
        const parsed: unknown = await res.json();
        if (!rec(parsed)) return { ok: false, reason: 'error', message: screeningCopy('malformed') };
        rawContext = parsed;
      } catch {
        return own.signal.aborted ? mapIdkitError('cancelled') : { ok: false, reason: 'error', message: screeningCopy('network') };
      }
      const { signal: serverSignal, ...rpContext } = rawContext;
      const signal = typeof serverSignal === 'string' ? serverSignal : request.signal;

      const runtime = await this.#loadRuntime();
      const preset = runtime.proofOfHuman({ signal });
      const environment = this.#o.environment ?? 'staging';
      const session = { app_id: this.#o.appId, rp_context: rpContext, environment };
      const saved = storedSession();
      const { createSession, proveSession } = runtime.IDKit;
      if (kind === 'session' && !createSession) return mapIdkitError('nullifier_replayed');
      const builder =
        kind === 'uniqueness'
          ? runtime.IDKit.request({ app_id: this.#o.appId, action: this.#o.action ?? WORLD_ACTION, rp_context: rpContext, allow_legacy_proofs: false, environment })
          : saved && proveSession
            ? proveSession.call(runtime.IDKit, saved, session)
            : createSession!.call(runtime.IDKit, session);
      const req = await builder.preset(preset, { signal: own.signal });
      cleanup = this.#o.onConnect?.(req.connectorURI, abort);
      const done = await req.pollUntilCompletion({ signal: own.signal });
      if (!done.success && REPLAY_CODES.has(done.error) && kind === 'uniqueness') return 'replayed';
      if (!done.success) return mapIdkitError(own.signal.aborted ? 'cancelled' : done.error);
      if (rec(done.result)) storeSession(done.result.session_id);
      const proof = toWorldIdProof(done.result);
      if (!proof) return { ok: false, reason: 'error', message: screeningCopy('malformed') };
      this.#raw.set(`${request.action}:${request.signal}:${proof.nullifierHash.toLowerCase()}`, done.result);
      return { ok: true, proof };
    } catch (err) {
      if (own.signal.aborted) return mapIdkitError('cancelled');
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : screeningCopy('malformed') };
    } finally {
      signal?.removeEventListener('abort', abort);
      if (typeof cleanup === 'function') cleanup();
    }
  }

  async verify(proof: WorldIdProof, request: ProofRequest, context: VerifyContext = {}): Promise<ScreeningResult> {
    const raw = this.#raw.get(`${request.action}:${request.signal}:${proof.nullifierHash.toLowerCase()}`);
    if (raw === undefined) return { ok: false, reason: 'not-verified', message: screeningCopy('not_verified') };
    let body: unknown;
    try {
      const wallet = this.#o.wallet?.();
      const res = await this.#fetch()(`${this.#o.backendUrl}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proof: raw, action: request.action, signal: request.signal, ...(wallet ? { wallet } : {}) }),
      });
      body = await res.json().catch(() => undefined);
      if (res.status >= 500 && !isVerificationResult(body)) return { ok: false, reason: 'error', message: screeningCopy('network') };
    } catch {
      return { ok: false, reason: 'error', message: screeningCopy('network') };
    }
    if (!isVerificationResult(body)) return { ok: false, reason: 'error', message: screeningCopy('malformed') };
    return screeningFromVerification(body, proof.nullifierHash, JUROR_ACTIONS.has(request.action), context.exclude);
  }
}

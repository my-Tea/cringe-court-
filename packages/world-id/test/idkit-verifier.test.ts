import { hashSignal } from '@worldcoin/idkit-core/hashing';
import { describe, expect, it } from 'vitest';
import { IdentityLevel, IdkitVerifier, deriveHumanId } from '../src/index.js';

const PEPPER = 'test-pepper-test-pepper';
const WALLET = '0x00000000000000000000000000000000000000aa' as const;
const proofOf = (identifier = 'proof_of_human', nullifier = '987654321', action = 'cc-human') => ({
  protocol_version: '4.0',
  nonce: 'n',
  action,
  environment: 'staging',
  responses: [{ identifier, proof: ['1', '2', '3', '4', '5'], nullifier, issuer_schema_id: 1, expires_at_min: 1 }],
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function make(handler: (url: string, init: RequestInit) => Promise<Response> | Response, extra = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  const v = new IdkitVerifier({ rpId: 'rp_test', action: 'cc-human', pepper: PEPPER, fetch: f, now: () => 5_000_000, ...extra });
  return { v, calls };
}
const req = (proof: unknown, action = 'cc-human') => ({ proof, action, wallet: WALLET });

describe('IdkitVerifier', () => {
  it('accepts an orb proof and posts the proof JSON to endpoint/rpId', async () => {
    const { v, calls } = make(() => json(200, { success: true }), { minLevel: IdentityLevel.ORB });
    const p = proofOf();
    const r = await v.verify(req(p));
    expect(r).toEqual({
      ok: true,
      humanId: deriveHumanId('987654321', PEPPER),
      level: IdentityLevel.ORB,
      action: 'cc-human',
      verifiedAt: 5000,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://developer.world.org/api/v4/verify/rp_test');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(p);
    expect(JSON.stringify(r)).not.toContain('987654321');
  });
  it('rejects device level when ORB is required', async () => {
    const { v } = make(() => json(200, { success: true }), { minLevel: IdentityLevel.ORB });
    const r = await v.verify(req(proofOf('selfie')));
    expect(r).toMatchObject({ ok: false, reason: 'ineligible_level', retryable: false });
  });
  it('maps credentials to levels', async () => {
    const { v } = make(() => json(200, { success: true }));
    for (const [id, lvl] of [['passport', 2], ['mnc', 2], ['selfie', 1], ['proof_of_human', 3]] as const) {
      const r = await v.verify(req(proofOf(id)));
      expect(r).toMatchObject({ ok: true, level: lvl });
    }
  });
  it('rejects wrong action without calling network', async () => {
    const { v, calls } = make(() => json(200, { success: true }));
    expect(await v.verify(req(proofOf(), 'other'))).toMatchObject({ ok: false, reason: 'wrong_action' });
    expect(await v.verify(req(proofOf(undefined, undefined, 'other')))).toMatchObject({ ok: false, reason: 'wrong_action' });
    expect(calls).toHaveLength(0);
  });
  it('maps already-verified code', async () => {
    const { v } = make(() => json(400, { success: false, code: 'max_verifications_reached', detail: 'x' }));
    expect(await v.verify(req(proofOf()))).toMatchObject({ ok: false, reason: 'already_verified', retryable: false });
  });
  it('maps 400 invalid to invalid_proof', async () => {
    const { v } = make(() => json(400, { success: false, code: 'invalid_proof' }));
    expect(await v.verify(req(proofOf()))).toMatchObject({ ok: false, reason: 'invalid_proof', retryable: false });
  });
  it('treats success:false with 200 as invalid_proof', async () => {
    const { v } = make(() => json(200, { success: false }));
    expect(await v.verify(req(proofOf()))).toMatchObject({ ok: false, reason: 'invalid_proof' });
  });
  it('maps 500 to retryable network', async () => {
    const { v } = make(() => json(500, { error: 'boom' }));
    expect(await v.verify(req(proofOf()))).toMatchObject({ ok: false, reason: 'network', retryable: true });
  });
  it('maps fetch rejection and timeout abort to retryable network', async () => {
    const a = make(() => Promise.reject(new Error('down')));
    expect(await a.v.verify(req(proofOf()))).toMatchObject({ reason: 'network', retryable: true });
    const b = make(
      (_u, init) =>
        new Promise((_res, rej) => {
          init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
        }),
      { timeoutMs: 20 },
    );
    expect(await b.v.verify(req(proofOf()))).toMatchObject({ reason: 'network', retryable: true });
  });
  it('flags malformed payloads and bodies', async () => {
    const { v } = make(() => new Response('<html>', { status: 200 }));
    expect(await v.verify(req('nope'))).toMatchObject({ reason: 'malformed' });
    expect(await v.verify(req({ responses: [] }))).toMatchObject({ reason: 'malformed' });
    expect(await v.verify(req(proofOf()))).toMatchObject({ reason: 'malformed' });
  });
  it('maps client-forwarded cancellation', async () => {
    const { v } = make(() => json(200, { success: true }));
    expect(await v.verify(req({ error: 'user_rejected' }))).toMatchObject({ reason: 'cancelled' });
  });
  it('forwards the environment and keeps a matching wallet signal', async () => {
    const signal = `wallet:${WALLET}`;
    const p = { ...proofOf(), responses: [{ ...proofOf().responses[0], signal_hash: hashSignal(signal) }] };
    const { v, calls } = make(() => json(200, { success: true, nullifier: '987654321' }), { environment: 'staging' });
    const r = await v.verify({ ...req(p), signal });
    expect(r).toMatchObject({ ok: true, humanId: deriveHumanId('987654321', PEPPER) });
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ environment: 'staging' });
  });
  it('rejects a proof bound to a different wallet', async () => {
    const p = { ...proofOf(), responses: [{ ...proofOf().responses[0], signal_hash: hashSignal('wallet:0xother') }] };
    const { v } = make(() => json(200, { success: true }));
    const r = await v.verify({ ...req(p), signal: `wallet:${WALLET}` });
    expect(r).toMatchObject({ ok: false, reason: 'invalid_proof' });
  });
  it('rejects a portal nullifier that disagrees with the client proof', async () => {
    const { v } = make(() => json(200, { success: true, nullifier: '111' }));
    expect(await v.verify(req(proofOf()))).toMatchObject({ ok: false, reason: 'invalid_proof' });
  });
  it('reads a failure code from results[]', async () => {
    const { v } = make(() => json(200, { success: false, results: [{ code: 'all_verifications_failed' }] }));
    expect(await v.verify(req(proofOf()))).toMatchObject({ ok: false, reason: 'invalid_proof' });
  });
});

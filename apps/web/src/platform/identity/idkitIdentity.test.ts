import { describe, expect, it, vi } from 'vitest';
import { IdkitIdentityPort, mapIdkitError, type IdkitRuntime } from './idkitIdentity';
import { JUROR_SCREENING_COPY } from './screeningCopy';

const RP = { rp_id: 'rp_1', nonce: 'n', created_at: 1, expires_at: 2, signature: 's' };
const RESULT = { protocol_version: '3.0', nonce: 'n', responses: [{ identifier: 'orb', nullifier: '0x' + 'ab'.repeat(32), proof: '0x01', merkle_root: '0x02' }] };
const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(opts: { completion?: unknown; verifyBody?: unknown; verifyStatus?: number; rpStatus?: number } = {}) {
  const calls: string[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push(`${init?.method ?? 'GET'} ${u}`);
    if (u.includes('/rp-context')) return opts.rpStatus ? jsonRes({}, opts.rpStatus) : jsonRes(RP);
    return jsonRes(opts.verifyBody ?? { ok: true, humanId: '0x' + 'cd'.repeat(32), level: 3, action: 'a', verifiedAt: 1 }, opts.verifyStatus ?? 200);
  });
  const presets: unknown[] = [];
  const configs: unknown[] = [];
  const idkit: IdkitRuntime = {
    IDKit: {
      request: (config) => {
        configs.push(config);
        return {
          preset: async (p, options) => {
            presets.push(p);
            return {
              connectorURI: 'https://world.org/verify?t=abc',
              pollUntilCompletion: async () => {
                if (options?.signal?.aborted) return { success: false as const, error: 'cancelled' };
                return (opts.completion ?? { success: true, result: RESULT }) as { success: true; result: unknown };
              },
            };
          },
        };
      },
    },
    orbLegacy: (o) => ({ kind: 'orb', ...o }),
    deviceLegacy: (o) => ({ kind: 'device', ...o }),
  };
  const onConnect = vi.fn(() => vi.fn());
  const port = new IdkitIdentityPort({ appId: 'app_x', backendUrl: 'https://api.test/', fetch: fetchFn as unknown as typeof fetch, idkit, onConnect, wallet: () => '0xabc' });
  return { port, calls, presets, configs, onConnect, fetchFn };
}

const seat = { action: 'accept-jury-seat', signal: 'case:1:seat' } as const;

describe('IdkitIdentityPort', () => {
  it('fetches rp-context, surfaces the link, and returns a proof', async () => {
    const t = setup();
    const r = await t.port.requestProof(seat);
    expect(r.ok).toBe(true);
    expect(t.calls[0]).toBe('GET https://api.test/rp-context?action=accept-jury-seat&signal=case%3A1%3Aseat');
    expect(t.presets[0]).toMatchObject({ kind: 'orb', signal: 'case:1:seat' });
    expect(t.configs[0]).toMatchObject({ app_id: 'app_x', action: 'accept-jury-seat', rp_context: RP, allow_legacy_proofs: true });
    expect(t.onConnect).toHaveBeenCalledWith('https://world.org/verify?t=abc', expect.any(Function));
    const cleanup = t.onConnect.mock.results[0]!.value as ReturnType<typeof vi.fn>;
    expect(cleanup).toHaveBeenCalled();
  });

  it('uses the device preset for case-party', async () => {
    const t = setup();
    await t.port.requestProof({ action: 'case-party', signal: 's' });
    expect(t.presets[0]).toMatchObject({ kind: 'device' });
  });

  it('maps IDKit errors', async () => {
    expect(await setup({ completion: { success: false, error: 'user_rejected' } }).port.requestProof(seat)).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(await setup({ completion: { success: false, error: 'credential_unavailable' } }).port.requestProof(seat)).toMatchObject({ ok: false, reason: 'not-verified' });
    expect(await setup({ completion: { success: false, error: 'generic_error' } }).port.requestProof(seat)).toMatchObject({ ok: false, reason: 'error' });
    expect(mapIdkitError('timeout')).toMatchObject({ reason: 'error', message: JUROR_SCREENING_COPY.expired });
  });

  it('reports a backend failure without touching IDKit', async () => {
    const t = setup({ rpStatus: 500 });
    expect(await t.port.requestProof(seat)).toMatchObject({ ok: false, reason: 'error', message: JUROR_SCREENING_COPY.network });
    expect(t.onConnect).not.toHaveBeenCalled();
  });

  it('is cancelled by an already aborted signal', async () => {
    const t = setup();
    const ac = new AbortController();
    ac.abort();
    expect(await t.port.requestProof(seat, ac.signal)).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(t.calls).toHaveLength(0);
  });

  it('verifies via POST /verify with the raw IDKit result and maps success', async () => {
    const t = setup();
    const r = await t.port.requestProof(seat);
    if (!r.ok) throw new Error('x');
    const s = await t.port.verify(r.proof, seat);
    expect(s).toEqual({ ok: true, nullifier: '0x' + 'cd'.repeat(32) });
    const call = t.fetchFn.mock.calls.at(-1)!;
    expect(String(call[0])).toBe('https://api.test/verify');
    expect(JSON.parse(String(call[1]?.body))).toEqual({ proof: RESULT, action: 'accept-jury-seat', signal: 'case:1:seat', wallet: '0xabc' });
  });

  it('maps verifier failures to screening copy', async () => {
    const bad = { ok: false, reason: 'ineligible_level', message: 'x', retryable: false };
    const t = setup({ verifyBody: bad });
    const r = await t.port.requestProof(seat);
    if (!r.ok) throw new Error('x');
    expect(await t.port.verify(r.proof, seat)).toEqual({ ok: false, reason: 'not-verified', message: JUROR_SCREENING_COPY.ineligible_level });
  });

  it('refuses a device-level verification for a jury seat and flags party conflicts', async () => {
    const dev = { ok: true, humanId: '0x' + 'cd'.repeat(32), level: 1, action: 'a', verifiedAt: 1 };
    const t = setup({ verifyBody: dev });
    const r = await t.port.requestProof(seat);
    if (!r.ok) throw new Error('x');
    expect(await t.port.verify(r.proof, seat)).toMatchObject({ ok: false, message: JUROR_SCREENING_COPY.ineligible_level });
    const t2 = setup();
    const r2 = await t2.port.requestProof(seat);
    if (!r2.ok) throw new Error('x');
    expect(await t2.port.verify(r2.proof, seat, { exclude: ['0x' + 'cd'.repeat(32) as `0x${string}`] })).toMatchObject({ ok: false, reason: 'conflicted' });
  });

  it('handles unreachable and unreadable verifier responses', async () => {
    const t = setup({ verifyBody: 'nope' });
    const r = await t.port.requestProof(seat);
    if (!r.ok) throw new Error('x');
    expect(await t.port.verify(r.proof, seat)).toMatchObject({ ok: false, reason: 'error', message: JUROR_SCREENING_COPY.malformed });
  });

  it('rejects a proof it did not issue', async () => {
    const t = setup();
    const fake = { merkleRoot: '0x00', nullifierHash: '0x11', proof: '0x00', verificationLevel: 'orb' } as const;
    expect(await t.port.verify(fake, seat)).toMatchObject({ ok: false, reason: 'not-verified' });
  });
});

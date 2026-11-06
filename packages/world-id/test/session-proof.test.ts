import { describe, expect, it, vi } from 'vitest';
import { hashSignal } from '@worldcoin/idkit-core/hashing';
import { IdkitVerifier } from '../src/idkit-verifier.js';

const SIGNAL = 'wallet:0xabc';
const session = (id: string, nullifier: string) => ({
  protocol_version: '4.0',
  session_id: id,
  responses: [{ identifier: 'proof_of_human', session_nullifier: [nullifier, '0x2'], signal_hash: hashSignal(SIGNAL) }],
});

function verifier(reply: unknown = { success: true }, status = 200) {
  const fetchFn = vi.fn(async () => new Response(JSON.stringify(reply), { status }));
  return new IdkitVerifier({ rpId: 'rp_1', action: 'cringecourt-juror', pepper: 'pepper', fetch: fetchFn as unknown as typeof fetch });
}
const ask = (v: IdkitVerifier, proof: unknown) => v.verify({ proof, action: 'cringecourt-juror', wallet: '0xabc', signal: SIGNAL } as never);

describe('session proofs', () => {
  it('accepts a returning person, keeping one identity across visits', async () => {
    const first = await ask(verifier(), session('session_aa', '0x10'));
    const second = await ask(verifier(), session('session_aa', '0x20'));
    expect(first).toMatchObject({ ok: true });
    expect(first.ok && second.ok && first.humanId === second.humanId).toBe(true);
  });

  it('gives a different session a different identity', async () => {
    const a = await ask(verifier(), session('session_aa', '0x10'));
    const b = await ask(verifier(), session('session_bb', '0x10'));
    expect(a.ok && b.ok && a.humanId !== b.humanId).toBe(true);
  });

  it('still rejects a session proof World refuses', async () => {
    expect(await ask(verifier({ success: false, code: 'invalid_proof' }, 400), session('session_aa', '0x10'))).toMatchObject({ ok: false });
  });

  it('still rejects a session proof made for another wallet', async () => {
    const stolen = { ...session('session_aa', '0x10'), responses: [{ identifier: 'proof_of_human', session_nullifier: ['0x10', '0x2'], signal_hash: hashSignal('wallet:0xother') }] };
    expect(await ask(verifier(), stolen)).toMatchObject({ ok: false, reason: 'invalid_proof' });
  });
});

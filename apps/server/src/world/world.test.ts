import { MockVerifier, mockProof } from '@cringe-court/world-id';
import { decodeWire, encodeWire } from '@cringe-court/net';
import { afterEach, describe, expect, it } from 'vitest';
import { device, startServer, type Running } from '../__tests__/harness';
import type { WorldServerConfig } from '../config';
import { MemoryStorage } from '../store';
import { HumanStore } from './humans';
import { seatGate } from './routes';

const SIGNING_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const world: WorldServerConfig = {
  rpId: 'rp_test',
  appId: 'app_test',
  action: 'cringecourt-juror',
  environment: 'staging',
  signingKey: SIGNING_KEY,
  pepper: 'test-pepper-at-least-16',
  signerAddress: '0x0000000000000000000000000000000000000001',
};

async function read<T>(res: Response): Promise<T> {
  return decodeWire<T>(await res.text());
}

describe('seat gate', () => {
  it('refuses an unbound wallet and a person who is already a party', () => {
    const humans = new HumanStore(new MemoryStorage().log('humans'), () => 1_000);
    const humanId = `0x${'ab'.repeat(32)}`;
    const wallet = `0x${'11'.repeat(20)}`;
    expect(humans.bind({ humanId, wallet, level: 3 }).ok).toBe(true);
    expect(seatGate(humans, wallet, 'cringecourt-juror', { partyHumanIds: [humanId], seatedHumanIds: [] })).toEqual({
      ok: false,
      message: 'You cannot judge your own case.',
    });
    expect(seatGate(humans, `0x${'22'.repeat(20)}`, 'cringecourt-juror', { partyHumanIds: [], seatedHumanIds: [] })).toEqual({
      ok: false,
      message: 'Verify you are human before taking this seat.',
    });
    expect(seatGate(humans, wallet, 'cringecourt-juror', { partyHumanIds: [], seatedHumanIds: [] })).toEqual({ ok: true });
  });
});

describe('world id routes', () => {
  let running: Running | undefined;
  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  it('signs rp-context for the session wallet and binds a human once', async () => {
    running = await startServer({ config: { world }, worldVerifier: new MockVerifier({ action: 'cringecourt-juror' }) });
    const a = await device(running.url);
    const ctx = await fetch(`${running.url}/api/v1/world/rp-context`, { headers: { authorization: `Bearer ${a.token}` } });
    expect(ctx.status).toBe(200);
    const signed = await read<{ rp_id: string; nonce: string; signature: string; signal: string; created_at: number; expires_at: number }>(ctx);
    expect(signed.rp_id).toBe('rp_test');
    expect(signed.signal).toBe(`wallet:${a.persona.account}`);
    expect(signed.signature.startsWith('0x')).toBe(true);
    expect(signed.expires_at).toBeGreaterThan(signed.created_at);
    expect(JSON.stringify(signed)).not.toContain(SIGNING_KEY.slice(2));

    const proof = mockProof('alice-orb');
    const first = await fetch(`${running.url}/api/v1/world/verify`, {
      method: 'POST',
      headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' },
      body: encodeWire({ proof, action: 'accept-jury-seat' }),
    });
    const ok = await read<{ ok: boolean; humanId?: string }>(first);
    expect(ok.ok).toBe(true);
    expect(JSON.stringify(ok)).not.toContain('alice');

    const again = await fetch(`${running.url}/api/v1/world/verify`, {
      method: 'POST',
      headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' },
      body: encodeWire({ proof }),
    });
    expect((await read<{ ok: boolean }>(again)).ok).toBe(true);

    const b = await device(running.url);
    const other = await fetch(`${running.url}/api/v1/world/verify`, {
      method: 'POST',
      headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
      body: encodeWire({ proof }),
    });
    expect(await read(other)).toMatchObject({ ok: false, reason: 'already_verified' });
    a.close();
    b.close();
  });

  it('stays off when World ID is not configured', async () => {
    running = await startServer();
    const a = await device(running.url);
    const res = await fetch(`${running.url}/api/v1/world/rp-context`, { headers: { authorization: `Bearer ${a.token}` } });
    expect(res.status).toBe(503);
    a.close();
  });
});

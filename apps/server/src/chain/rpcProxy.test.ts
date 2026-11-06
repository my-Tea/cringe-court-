import { describe, expect, it, vi } from 'vitest';
import { createRpcProxy } from './rpcProxy';

const reply = (status: number, body: unknown = { jsonrpc: '2.0', id: 1, result: '0x1' }) => new Response(JSON.stringify(body), { status });
const proxy = (fetchFn: unknown, now: () => number = () => 0) => createRpcProxy({ url: 'https://rpc.test', fetch: fetchFn as typeof fetch, now, sleep: async () => undefined });
const CALL = { id: 9, method: 'eth_call', params: [{ to: '0x1' }] };

describe('rpc proxy', () => {
  it('waits out rate limiting, and answers with the caller\'s id', async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(429)).mockResolvedValue(reply(200));
    expect(await proxy(f).forward(CALL)).toEqual({ status: 200, body: { jsonrpc: '2.0', id: 9, result: '0x1' } });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('says busy, rather than hanging, when Arc never recovers', async () => {
    const r = await proxy(vi.fn(async () => reply(429))).forward(CALL);
    expect(r.status).toBe(503);
  });

  it('answers a repeat read from cache, then asks again once it is stale', async () => {
    let t = 0;
    const f = vi.fn(async () => reply(200));
    const p = proxy(f, () => t);
    await p.forward(CALL);
    await p.forward(CALL);
    expect(f).toHaveBeenCalledTimes(1);
    t = 5000;
    await p.forward(CALL);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('serves the last good answer when Arc stays busy', async () => {
    let t = 0;
    const f = vi.fn().mockResolvedValueOnce(reply(200)).mockResolvedValue(reply(429));
    const p = proxy(f, () => t);
    await p.forward(CALL);
    t = 60_000;
    expect(await p.forward(CALL)).toEqual({ status: 200, body: { jsonrpc: '2.0', id: 9, result: '0x1' } });
  });

  it('never caches a receipt: a stake must be seen as soon as it lands', async () => {
    const f = vi.fn(async () => reply(200, { result: null }));
    const p = proxy(f);
    const ask = { id: 1, method: 'eth_getTransactionReceipt', params: ['0xabc'] };
    await p.forward(ask);
    await p.forward(ask);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('shares one upstream call between tabs asking at once', async () => {
    const f = vi.fn(async () => reply(200));
    const p = proxy(f);
    await Promise.all([p.forward(CALL), p.forward({ ...CALL, id: 10 })]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('refuses anything that is not a read', async () => {
    const f = vi.fn();
    for (const method of ['eth_sendRawTransaction', 'eth_sendTransaction', 'personal_sign', 'debug_traceCall', undefined]) {
      expect((await proxy(f).forward({ id: 1, method })).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });
});

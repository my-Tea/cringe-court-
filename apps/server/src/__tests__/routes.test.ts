/**
 * The HTTP surface: health, sessions, auth, CORS, size limits, input
 * validation, authorization, rate limits and signed invite tokens.
 */
import { usdc } from '@cringe-court/core';
import { makeInviteCode, prepareBriefing, versusTerms } from '@cringe-court/modes-versus';
import { TIME_HEADER, encodeWire } from '@cringe-court/net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InviteSigner } from '../sessions';
import { device, startServer, type Device, type Running } from './harness';

const brief = prepareBriefing({ happened: 'They took the last slice without asking anyone at the table.', why: 'Shared food has rules.', privateNotes: 'n', angle: '', nickname: '' });

async function post(server: Running, path: string, body: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${server.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: typeof body === 'string' ? body : encodeWire(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null, res };
}

const fact = (d: Device, extra: Record<string, unknown>) => ({ seq: 0, at: 0, by: '', account: d.persona.account, ...extra });

describe('court server routes', () => {
  let server: Running;
  let a: Device;
  beforeAll(async () => {
    server = await startServer({ config: { demoClock: false } });
    a = await device(server.url);
  });
  afterAll(async () => {
    a.close();
    await server.close();
  });

  it('health reports the server, its features and its clock', async () => {
    const res = await fetch(`${server.url}/api/v1/health`);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, name: 'cringe-court-server', features: { demoClock: false } });
    expect(Math.abs(Number(res.headers.get(TIME_HEADER)) - Date.now())).toBeLessThan(5000);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('every game route needs a session; an unknown token is told to start over', async () => {
    expect((await fetch(`${server.url}/api/v1/versus/log`)).status).toBe(401);
    const r = await fetch(`${server.url}/api/v1/gj/state`, { headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe('unauthorized');
  });

  it('CORS: allowed origins are echoed, others refused, preflight answered', async () => {
    const ok = await fetch(`${server.url}/api/v1/health`, { headers: { Origin: 'http://app.test' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://app.test');
    expect(ok.headers.get('access-control-expose-headers')).toContain(TIME_HEADER);
    expect((await fetch(`${server.url}/api/v1/health`, { headers: { Origin: 'http://evil.test' } })).status).toBe(403);
    const pre = await fetch(`${server.url}/api/v1/versus/facts`, { method: 'OPTIONS', headers: { Origin: 'http://app.test', 'Access-Control-Request-Method': 'POST' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toContain('Authorization');
  });

  it('rejects oversized, non-JSON and malformed bodies', async () => {
    expect((await post(server, '/api/v1/versus/facts', { facts: [], pad: 'x'.repeat(70_000) }, a.token)).status).toBe(413);
    expect((await post(server, '/api/v1/versus/facts', '{nope', a.token)).status).toBe(400);
    expect((await post(server, '/api/v1/versus/facts', 'x', a.token, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await post(server, '/api/v1/versus/facts', { facts: [], base: 0 }, a.token)).status).toBe(400);
  });

  it('checks every fact’s shape, and keeps the court’s own facts to the court', async () => {
    const base = a.store.read().length;
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ type: 'drafted', trialId: 'vs-0000000000' }, /Only the court writes that/],
      [{ type: 'sentence', trialId: 'vs-0000000000' }, /Only the court writes that/],
      [{ type: 'bogus' }, /Unknown fact/],
      [{ type: 'faucet', amount: usdc('500.00') }, /out of range/],
      [{ type: 'brief', trialId: 'vs-0000000000', side: 'a', patch: { story: 's', evil: 1 } }, /unexpected field/],
      [{ type: 'brief', trialId: 'vs-0000000000', side: 'a', patch: { story: 'x'.repeat(1300) } }, /longer than 1200/],
      [{ type: 'open', trialId: 'vs-0000000001', code: 'K7QM-2XPA', nullifier: `0x${'1'.repeat(64)}`, category: 'npc-behavior', title: 'x', terms: versusTerms({ demo: true }) }, /invite code/],
      [{ type: 'open', trialId: 'vs-0000000001', code: 'ZZZZ-ZZZZ', nullifier: `0x${'1'.repeat(64)}`, category: 'npc-behavior', title: 'x', terms: { ...versusTerms({ demo: true }), bondPerJuror: 1n } }, /invite code|terms/],
    ];
    cases.push([{ type: 'clock', seconds: 60, account: undefined }, /switched off/]);
    for (const [extra, message] of cases) {
      const r = await post(server, '/api/v1/versus/facts', { facts: [fact(a, extra)], base }, a.token);
      expect(r.status, encodeWire(extra).slice(0, 60)).toBeGreaterThanOrEqual(400);
      expect(r.body?.error?.message, encodeWire(extra).slice(0, 60)).toMatch(message);
    }
  });

  it('a device can only act for its own wallet', async () => {
    const other = await device(server.url);
    const r = await post(server, '/api/v1/versus/facts', { facts: [fact(other, { type: 'faucet', amount: usdc('1.00') })], base: a.store.read().length }, a.token);
    expect(r.status).toBe(403);
    other.close();
  });

  it('the court’s rules refuse what the shape check lets through (with the court’s words)', async () => {
    await a.store.pull();
    const r = await post(server, '/api/v1/versus/facts', { facts: [fact(a, { type: 'fund', trialId: 'vs-0000000000' })], base: a.store.read().length }, a.token);
    expect(r.status).toBe(422);
    expect(r.body?.error).toMatchObject({ code: 'rejected', message: 'No such case' });
  });

  it('invite codes: signed links open the case; guessing is rationed', async () => {
    const { trialId, code } = await a.desk.fileCase({ title: 'The Last Slice', category: 'npc-behavior', patch: brief.patch });
    const { token } = await a.store.invite(trialId);
    const b = await device(server.url);
    expect(await b.store.openInvite(code, token)).toBe(trialId);

    const guesser = await device(server.url);
    const statuses: number[] = [];
    let seed = 0.123;
    const wrong = () => makeInviteCode(() => (seed = (seed * 9.73) % 1));
    for (let i = 0; i < 10; i++) statuses.push((await post(server, '/api/v1/versus/access', { code: wrong() }, guesser.token)).status);
    expect(statuses.slice(0, 8).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
    // A forged token is no shortcut: it counts as a guess.
    const forged = `${trialId}.9999999999.${'A'.repeat(32)}`;
    expect((await post(server, '/api/v1/versus/access', { code, token: forged }, guesser.token)).status).toBe(429);
    // Only Side A can mint the link.
    expect((await fetch(`${server.url}/api/v1/versus/invite/${trialId}`, { headers: { Authorization: `Bearer ${b.token}` } })).status).toBe(404);
    b.close();
    guesser.close();
  });

  it('invite signatures bind the case, the code and the expiry', () => {
    const s = new InviteSigner('k');
    const t = s.sign('vs-abcdefghij', 'K7QM-2XPA', 2000);
    expect(s.verify(t, 'K7QM-2XPA', 1000)).toBe('vs-abcdefghij');
    expect(s.verify(t, 'K7QM-2XPB', 1000)).toBeNull();
    expect(s.verify(t, 'K7QM-2XPA', 3000)).toBeNull();
    expect(new InviteSigner('other').verify(t, 'K7QM-2XPA', 1000)).toBeNull();
    expect(s.verify(t.replace('2000', '9000'), 'K7QM-2XPA', 1000)).toBeNull();
  });

  it('the Grand Jury demo skip is refused when the server turns the demo clock off', async () => {
    const r = await post(server, '/api/v1/gj/cases/101/skip', {}, a.token);
    expect(r.status).toBe(403);
    expect(r.body?.error?.code).toBe('disabled');
  });

  it('caps the faucet and rate-limits writes', async () => {
    expect((await post(server, '/api/v1/gj/faucet', { amount: usdc('11.00') }, a.token)).status).toBe(400);
    const d = await device(server.url);
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) codes.push((await post(server, '/api/v1/gj/cases/101/gallery', { choice: 0 }, d.token)).status);
    expect(codes).toContain(429);
    d.close();
  });
});

describe('session cap', () => {
  it('refuses new devices beyond the cap, politely', async () => {
    const server = await startServer({ config: { maxSessions: 1 } });
    const first = await post(server, '/api/v1/sessions', {});
    const second = await post(server, '/api/v1/sessions', {});
    expect(first.status).toBe(201);
    expect(second.status).toBe(503);
    expect(second.body?.error?.code).toBe('full');
    await server.close();
  });
});

/**
 * Clock skew, live reconnect and server restart.
 * - A device whose clock is wrong still follows the court's clock.
 * - The live stream drops and comes back; devices resync without a reload.
 * - The server restarts from its JSON-lines store: same sessions, same Versus
 *   world, same Grand Jury court.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { usdc } from '@cringe-court/core';
import { prepareBriefing } from '@cringe-court/modes-versus';
import { afterAll, describe, expect, it } from 'vitest';
import { FileStorage } from '../store';
import { device, startServer, until, type Running } from './harness';

const brief = prepareBriefing({ happened: 'They replied “k” to a four-paragraph apology and then went to sleep.', why: 'Tone matters.', privateNotes: 'p', angle: '', nickname: '' });

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => resolve(p));
    });
  });
}

describe('clock skew', () => {
  let server: Running;
  afterAll(() => server.close());

  it('devices ten minutes fast or an hour slow still act on court time', async () => {
    server = await startServer();
    const fast = await device(server.url, { skewMs: 10 * 60_000 });
    const slow = await device(server.url, { skewMs: -60 * 60_000 });
    for (const d of [fast, slow]) {
      expect(Math.abs(d.connection.serverNowMs() - Date.now())).toBeLessThan(2000);
    }
    const { trialId } = await fast.desk.fileCase({ title: 'The k Affair', category: 'internet-crimes', patch: brief.patch });
    const opened = fast.store.read().find((f) => f.type === 'open')!;
    // The court stamps its own time on every fact.
    expect(Math.abs(opened.at - Date.now() / 1000)).toBeLessThan(5);
    // The consent countdown is the same on both devices, and right by the server's clock.
    await slow.store.pull();
    const endsFast = (await fast.desk.world()).case(trialId)!.state;
    const endsSlow = (await slow.desk.world()).case(trialId)!.state;
    expect(endsFast.stage === 'filing' && endsFast.consentEndsAt).toBe(endsSlow.stage === 'filing' && endsSlow.consentEndsAt);
    // A device with a wrong clock does not expire the invite early (or late) in its own world.
    expect(endsSlow.stage).toBe('filing');
    // Grand Jury: court time on a skewed device matches the server.
    await slow.gj.list();
    expect(Math.abs(slow.gj.now() - server.court.hall.now())).toBeLessThanOrEqual(2);
    fast.close();
    slow.close();
  });
});

describe('reconnect and restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'court-server-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('keeps sessions, cases and the Grand Jury court across a restart, and live devices resync', async () => {
    const port = await freePort();
    const config = { port, store: 'file' as const, dataDir: dir };
    let server = await startServer({ config, storage: new FileStorage(dir) });
    const a = await device(server.url, { live: true });
    const b = await device(server.url);
    await until(() => a.connection.status === 'live', 5000, 'live stream');

    const { trialId, code } = await a.desk.fileCase({ title: 'The k Affair', category: 'internet-crimes', patch: brief.patch });
    await b.desk.findByCode(code);
    await b.desk.acceptInvite(trialId);
    // A hears B's acceptance over the live stream, without asking.
    await until(async () => (await a.desk.world()).case(trialId)?.parties.b !== undefined, 5000, 'B to appear on A’s device');

    const n = (await a.gj.list()).find((e) => e.file.slug === 'cereal-is-soup')!.caseNumber;
    expect(await a.gj.contribute(n, usdc('0.50'))).toMatchObject({ ok: true });
    const beforeGj = await a.gj.detail(n);
    const beforeLen = a.store.read().length;

    await server.close();
    await until(() => a.connection.status !== 'live', 5000, 'the stream to drop');
    // While the court is down, an action fails honestly instead of pretending.
    await expect(a.store.append([], 0)).rejects.toMatchObject({ code: 'unreachable' });

    server = await startServer({ config, storage: new FileStorage(dir) });
    // Same token, same device: the session survived.
    expect(server.court.sessions.resolve(a.token)?.persona.id).toBe(a.persona.id);
    await until(() => a.connection.status === 'live', 15_000, 'the stream to come back');

    // B writes while A is reconnected: A hears it.
    await b.store.pull();
    await b.desk.saveBrief(trialId, 'b', { story: 'I was asleep. “k” means okay.' });
    await until(() => a.store.read().length > beforeLen, 5000, 'A to resync');
    expect((await a.desk.world()).rejected.size).toBe(0);

    const afterGj = await a.gj.detail(n);
    expect(afterGj!.raised).toBe(beforeGj!.raised);
    expect(afterGj!.viewer.contributed).toBe(usdc('0.50'));
    expect(afterGj!.log.map((l) => l.kind)).toEqual(beforeGj!.log.map((l) => l.kind));

    // The store on disk is JSON lines (one record per line).
    const lines = readFileSync(join(dir, 'versus.jsonl'), 'utf8').trim().split('\n');
    expect(lines.length).toBe(server.court.room.length);
    a.close();
    b.close();
    await server.close();
  });
});

describe('a reset server', () => {
  it('tells a live device its token is unknown, instead of retrying forever', async () => {
    const port = await freePort();
    let server = await startServer({ config: { port } });
    const d = await device(server.url, { live: true });
    await until(() => d.connection.status === 'live', 5000, 'live');
    let told = 0;
    d.connection.onUnauthorized(() => told++);
    await server.close();
    server = await startServer({ config: { port } });
    await until(() => told > 0, 20_000, 'the unauthorized signal');
    d.close();
    await server.close();
  });
});


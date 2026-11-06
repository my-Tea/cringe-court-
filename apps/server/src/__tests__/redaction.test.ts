/**
 * Redaction across the wire: the bytes each device receives, not just what the
 * UI shows. A secret written by Side A must never appear in any response or
 * live event that reaches Side B, an invitee, a juror or a stranger.
 */
import { usdc } from '@cringe-court/core';
import { prepareBriefing, visibleBrief } from '@cringe-court/modes-versus';
import { decodeWire, type VersusLogResponse } from '@cringe-court/net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { device, raw, startServer, type Device, type Running } from './harness';

const SECRET_A = 'ZEBRA-NOTES-ONLY-FOR-A';
const ANGLE_A = 'ZEBRA angle only A sees';
const SECRET_B = 'OKAPI-NOTES-ONLY-FOR-B';
const STORY_A = 'We agreed to split the last dumpling, then QUOKKA-STORY happened while I fetched napkins.';

const briefA = prepareBriefing({ happened: STORY_A, why: 'A split is a contract.', privateNotes: SECRET_A, angle: ANGLE_A, nickname: 'Napkin Knight' });
const briefB = prepareBriefing({ happened: 'It was going cold, so I ate it. Hot food waits for no one.', why: 'Saved it from a lukewarm fate.', privateNotes: SECRET_B, angle: 'Hot food waits', nickname: '' });

/** Everything a device can read about the log, as raw text. */
async function everything(server: Running, d: Device): Promise<string> {
  return raw(server.url, '/api/v1/versus/log?since=0', d.token);
}

/** Collect a device's live-event stream for `ms`. */
async function listen(server: Running, d: Device, ms: number): Promise<string> {
  const controller = new AbortController();
  const res = await fetch(`${server.url}/api/v1/events`, { headers: { Authorization: `Bearer ${d.token}` }, signal: controller.signal });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let text = '';
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += value;
    }
  } catch {
    /* aborted */
  }
  clearTimeout(timer);
  return text;
}

describe('redaction across the wire', () => {
  let server: Running;
  let a: Device, b: Device, stranger: Device, juror: Device;
  let trialId: string;
  let code: string;

  beforeAll(async () => {
    server = await startServer();
    [a, b, stranger, juror] = await Promise.all([device(server.url), device(server.url), device(server.url), device(server.url)]);
    ({ trialId, code } = await a.desk.fileCase({ title: 'The Last Dumpling', category: 'dating-crimes', patch: briefA.patch }));
  });
  afterAll(async () => {
    [a, b, stranger, juror].forEach((d) => d.close());
    await server.close();
  });

  it('a stranger sees a sealed placeholder: no title, no code, no story', async () => {
    const text = await everything(server, stranger);
    expect(text).not.toContain(SECRET_A);
    expect(text).not.toContain('QUOKKA');
    expect(text).not.toContain('The Last Dumpling');
    expect(text).not.toContain(code);
    await stranger.store.pull();
    const c = (await stranger.desk.world()).case(trialId)!;
    // The replay still works: the case exists, sealed.
    expect(c.state.filing.title).toBe('[sealed]');
    expect((await stranger.desk.world()).rejected.size).toBe(0);
  });

  it('an invitee reads the summons (title, terms) but neither story before accepting', async () => {
    expect((await b.desk.findByCode(code as never))?.trialId).toBe(trialId);
    const text = await everything(server, b);
    expect(text).toContain('The Last Dumpling');
    expect(text).not.toContain('QUOKKA');
    expect(text).not.toContain(SECRET_A);
    expect(text).not.toContain(ANGLE_A);
  });

  it('a stranger who guesses a trial id still cannot answer the invite', async () => {
    await stranger.store.pull();
    await expect(stranger.desk.acceptInvite(trialId)).rejects.toThrow(/Open the invite/);
    await expect(stranger.desk.declineInvite(trialId)).rejects.toThrow(/Open the invite/);
  });

  it('after accepting, Side B sees A’s public story, never A’s notes or angle; A never sees B’s', async () => {
    await b.desk.acceptInvite(trialId);
    await b.store.pull();
    await b.desk.saveBrief(trialId, 'b', briefB.patch);
    await a.store.pull();
    const toB = await everything(server, b);
    expect(toB).toContain('QUOKKA');
    expect(toB).not.toContain(SECRET_A);
    expect(toB).not.toContain(ANGLE_A);
    const toA = await everything(server, a);
    expect(toA).toContain(SECRET_A);
    expect(toA).toContain(ANGLE_A);
    expect(toA).not.toContain(SECRET_B);
    // And the views the UI renders agree.
    const wb = await b.desk.world();
    const seenByB = visibleBrief(wb.case(trialId)!, 'a', 'b');
    expect(JSON.stringify(seenByB)).not.toContain(SECRET_A);
    expect(wb.case(trialId)!.state.filing.sides.a?.privateNotes).toBe('');
    expect(wb.rejected.size).toBe(0);
  });

  it('live events never carry case content', async () => {
    const stream = listen(server, b, 600);
    await new Promise((r) => setTimeout(r, 100));
    await a.store.pull();
    await a.desk.saveBrief(trialId, 'a', { privateNotes: `${SECRET_A} (edited)` });
    const text = await stream;
    expect(text).toContain('event: versus');
    expect(text).not.toContain(SECRET_A);
  });

  it('the append response is redacted for its writer too (B writing does not echo A’s notes)', async () => {
    await b.store.pull();
    const res = await fetch(`${server.url}/api/v1/versus/facts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ facts: [{ type: 'brief', trialId, side: 'b', account: b.persona.account, patch: { nickname: 'Cold Cut' }, seq: 0, at: 0, by: '' }], base: b.store.read().length }),
    });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain(SECRET_A);
  });

  it('once the case is on the ledger, a juror sees the public record and no private notes', async () => {
    await a.store.pull();
    await b.store.pull();
    await a.desk.approveBrief(trialId, 'a');
    await b.store.pull();
    await b.desk.approveBrief(trialId, 'b');
    await server.court.tick();
    await a.desk.runCounsel(trialId);
    await a.store.pull();
    await a.desk.approveDraft(trialId, 'a');
    await b.store.pull();
    await b.desk.approveDraft(trialId, 'b');
    for (const d of [a, b]) {
      await d.store.pull();
      await d.desk.faucet(usdc('5.00'));
      await d.store.pull();
      await d.desk.fund(trialId);
    }
    await juror.store.pull();
    const c = (await juror.desk.world()).case(trialId)!;
    expect(c.state.stage).toBe('jury');
    const text = await everything(server, juror);
    expect(text).toContain('QUOKKA');
    expect(text).not.toContain(SECRET_A);
    expect(text).not.toContain(SECRET_B);
    // The angle steers Agent A in the public trial (it may be argued out loud), but the
    // briefs themselves reach the juror with every angle and note blanked.
    const briefs = decodeWire<VersusLogResponse>(text).facts.filter((f) => f.type === 'brief');
    expect(briefs.length).toBeGreaterThan(0);
    for (const f of briefs) {
      if (f.type !== 'brief') continue;
      if ('angle' in f.patch) expect(f.patch.angle).toBeNull();
      if ('privateNotes' in f.patch) expect(f.patch.privateNotes).toBe('');
    }
  });

  it('a sealed ballot is only a commitment until the reveal: the server never holds the vote', async () => {
    await juror.store.pull();
    await juror.desk.faucet(usdc('5.00'));
    await juror.store.pull();
    await juror.desk.takeSeat(trialId);
    await juror.store.pull();
    await juror.desk.seatDemoJurors(trialId, 'reliable');
    await juror.store.pull();
    await juror.desk.commitBallot(trialId, 1);
    const sealed = await juror.salts.load((await juror.desk.world()).case(trialId)!.caseNumber!, juror.persona.account);
    const log = await everything(server, a);
    expect(sealed).not.toBeNull();
    expect(log).not.toContain(sealed!.salt);
    expect(log).toContain(sealed!.commitment);
  });
});

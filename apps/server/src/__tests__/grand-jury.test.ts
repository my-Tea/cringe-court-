/**
 * Grand Jury on the court server.
 * 1. Contract: the remote court answers like the offline demo court for the same
 *    seeded docket and the same visitor actions.
 * 2. Seven jurors on seven devices: fund, screen, seat, seal, reveal, settle,
 *    claim; nobody sees another juror's unrevealed vote.
 */
import { formatUsdc, subUsdc, usdc, type BallotChoice, type CaseNumber } from '@cringe-court/core';
import { MemoryStorage as KvMemory, createDemoCourt, type DocketEntry } from '@cringe-court/modes-grand-jury';
import { MockIdentity } from '@cringe-court/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { device, raw, startServer, type Device, type Running } from './harness';

const T = 1_790_000_000;

/** Entries minus the parts that legitimately differ (none should). */
const shape = (es: readonly DocketEntry[]) => es.map((e) => ({ n: e.caseNumber, slug: e.file.slug, status: e.status, raised: e.raised, seats: e.seats, verdict: e.verdict?.kind ?? null, ends: e.phaseEndsAt }));

describe('Grand Jury contract: offline demo court ≡ court server', () => {
  let server: Running;
  let d: Device;
  beforeAll(async () => {
    server = await startServer({ clockMs: () => T * 1000, config: { npcJurors: 'fill' } });
    d = await device(server.url, { skewMs: T * 1000 - Date.now() });
  });
  afterAll(async () => {
    d.close();
    await server.close();
  });

  it('seeds the same docket and answers the same visitor actions the same way', async () => {
    const local = await createDemoCourt({ realNow: () => T, storage: new KvMemory(), identity: () => new MockIdentity({ human: 'local-visitor' }) });
    const remote = d.gj;
    expect(shape(await remote.list())).toEqual(shape(await local.court.list()));
    // (Balances differ by design: the offline visitor has a seeded history; a server device starts fresh.)

    const cereal = (await local.court.list()).find((e) => e.file.slug === 'cereal-is-soup')!.caseNumber;
    const pineapple = (await local.court.list()).find((e) => e.file.slug === 'pineapple-pizza')!.caseNumber;
    const steps: [string, () => Promise<unknown>, () => Promise<unknown>][] = [
      ['contribute', () => local.court.contribute(cereal, usdc('0.50')), () => remote.contribute(cereal, usdc('0.50'))],
      ['contribute too little', () => local.court.contribute(cereal, usdc('0.01')), () => remote.contribute(cereal, usdc('0.01'))],
      ['gallery vote', () => local.court.galleryVote(cereal, 1), () => remote.galleryVote(cereal, 1)],
      ['seat before screening', () => local.court.requestSeat(pineapple), () => remote.requestSeat(pineapple)],
      ['screen', () => local.court.screen(pineapple), () => remote.screen(pineapple)],
      ['request a seat', () => local.court.requestSeat(pineapple), () => remote.requestSeat(pineapple)],
      ['accept the seat', () => local.court.acceptSeat(pineapple), () => remote.acceptSeat(pineapple)],
      ['seal while seating', () => local.court.seal(pineapple, 0), () => remote.seal(pineapple, 0)],
    ];
    const norm = (r: unknown) => {
      const x = r as { ok: boolean; code?: string; message?: string; value?: unknown };
      // Nullifiers and offer ids are per-visitor by design; outcomes and messages must match.
      return x.ok ? { ok: true } : { ok: false, code: x.code, message: x.message };
    };
    for (const [what, l, r] of steps) expect(norm(await r()), what).toEqual(norm(await l()));

    const [ld, rd] = [await local.court.detail(cereal), await remote.detail(cereal)];
    expect(rd!.viewer.contributed).toBe(ld!.viewer.contributed);
    expect(rd!.viewer.galleryVote).toBe(ld!.viewer.galleryVote);
    expect(rd!.raised).toBe(ld!.raised);
    const [lp, rp] = [await local.court.detail(pineapple), await remote.detail(pineapple)];
    expect(rp!.viewer.seat).toBe(lp!.viewer.seat);
    expect(rp!.seats).toEqual(lp!.seats);
    local.dispose();
  });
});

describe('Seven jurors on seven devices', () => {
  let server: Running;
  const jurors: Device[] = [];
  beforeAll(async () => {
    server = await startServer({ config: { npcJurors: 'off' } });
    for (let i = 0; i < 7; i++) jurors.push(await device(server.url));
  });
  afterAll(async () => {
    jurors.forEach((d) => d.close());
    await server.close();
  });

  it('runs a public case to a 4–3 verdict with every juror on their own device', async () => {
    const [first] = jurors as [Device];
    const list = await first.gj.list();
    const n: CaseNumber = list.find((e) => e.file.slug === 'cereal-is-soup')!.caseNumber;
    let detail = (await first.gj.detail(n))!;
    expect(detail.status).toBe('summoning');

    // One summoner tops the case up; the jury opens to verified humans.
    expect(await first.gj.contribute(n, subUsdc(detail.target, detail.raised))).toMatchObject({ ok: true });
    detail = (await first.gj.detail(n))!;
    expect(detail.status).toBe('seating');
    expect(detail.seats.filled).toBe(0);

    const seat = async (j: Device) => {
      expect(await j.gj.screen(n)).toMatchObject({ ok: true });
      expect(await j.gj.requestSeat(n)).toMatchObject({ ok: true });
      expect(await j.gj.acceptSeat(n)).toMatchObject({ ok: true });
    };
    for (const j of jurors.slice(0, 6)) await seat(j);

    // One human, one seat: a second device presenting the same World ID is refused.
    const twin = await device(server.url);
    const sameHuman = new MockIdentity({ human: `human-${jurors[0]!.persona.id}` });
    const proof = await sameHuman.requestProof({ action: 'accept-jury-seat', signal: `case:${n}:seat`, minLevel: 'orb' });
    const res = await fetch(`${server.url}/api/v1/gj/cases/${n}/screen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${twin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof: proof.ok ? proof.proof : null }),
    });
    expect((await res.json()).result).toMatchObject({ ok: false, code: 'already-used' });
    twin.close();

    await seat(jurors[6]!);
    detail = (await first.gj.detail(n))!;
    expect(detail.seats.filled).toBe(7);
    expect(detail.status).toBe('in-session');
    expect(detail.transcriptTeaser).toBe(false);

    const votes: BallotChoice[] = [0, 1, 0, 1, 0, 1, 0];
    const scrolls: string[] = [];
    for (const [i, j] of jurors.entries()) {
      const r = await j.gj.seal(n, votes[i]!);
      expect(r.ok).toBe(true);
      if (r.ok) scrolls.push(r.value.scroll);
    }
    // Isolation: before the reveal, nothing another device can read holds a vote or a salt.
    const mine = (await jurors[0]!.salts.load(n, jurors[0]!.persona.account))!;
    for (const other of jurors.slice(1)) {
      const text = await raw(server.url, `/api/v1/gj/cases/${n}`, other.token);
      expect(text).not.toContain(mine.salt);
      const seen = (await other.gj.detail(n))!;
      expect(seen.seats.sealed).toBe(7);
      expect(seen.viewer.sealedChoice).toBe(votes[jurors.indexOf(other)]);
    }

    expect(await first.gj.skip(n)).toMatchObject({ ok: true });
    expect((await first.gj.detail(n))!.status).toBe('opening-scrolls');
    // The last juror's browser storage is wiped: the Secret Verdict Scroll restores the ballot.
    const last = jurors[6]!;
    await last.salts.remove(n, last.persona.account);
    expect(await last.gj.reveal(n)).toMatchObject({ ok: false, code: 'salt-missing' });
    for (const j of jurors.slice(0, 6)) expect(await j.gj.reveal(n)).toMatchObject({ ok: true });
    expect(await last.gj.reveal(n, scrolls[6])).toMatchObject({ ok: true, value: 0 });
    expect((await first.gj.detail(n))!.seats.opened).toBe(7);

    const status = (await first.gj.detail(n))!.status;
    if (status !== 'settle-ready') expect(await first.gj.skip(n)).toMatchObject({ ok: true });
    expect(await jurors[3]!.gj.settle(n)).toMatchObject({ ok: true });
    detail = (await first.gj.detail(n))!;
    expect(detail.status).toBe('verdict');
    expect(detail.verdict).toMatchObject({ kind: 'ballot-0', tally: [4, 3] });

    // Every device sees the same verdict, and every juror is paid.
    for (const j of jurors) {
      const d = (await j.gj.detail(n))!;
      expect(d.verdict?.kind).toBe('ballot-0');
      const before = (await j.gj.balance())!;
      expect(await j.gj.claim(n)).toMatchObject({ ok: true });
      const after = (await j.gj.balance())!;
      expect(after > before, `${j.name} was paid (${formatUsdc(before)} → ${formatUsdc(after)})`).toBe(true);
      expect(await j.salts.load(n, j.persona.account)).toBeNull();
    }
  });
});

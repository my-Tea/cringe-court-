/**
 * The Versus contract suite: the same behaviour through the in-memory store
 * (one device, the existing demo) and through the court server (three devices).
 * 1. FactStore semantics both adapters share.
 * 2. A whole case, invite to verdict to claims, with identical outcomes.
 */
import { formatUsdc, usdc } from '@cringe-court/core';
import { ManualClock, MemorySaltVault, MockIdentity, testAddress } from '@cringe-court/core/testing';
import { MemoryFactStore, VersusCounsel, VersusDesk, prepareBriefing, type Fact, type FactStore, type VersusCase } from '@cringe-court/modes-versus';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { device, startServer, type Device, type Running } from './harness';

const briefA = prepareBriefing({
  happened: 'We agreed to split the last dumpling. I went for napkins and came back to an empty plate.',
  why: 'A split is a contract. Napkin duty is a public service, not abandonment.',
  privateNotes: 'SECRET-A: this is the third dumpling incident this year.',
  angle: 'A deal is a deal.',
  nickname: 'Napkin Knight',
});
const briefB = prepareBriefing({
  happened: 'The dumpling was going cold. Leaving food unattended is a forfeit, everyone knows that.',
  why: 'Hot food waits for no one. I saved it from a tragic, lukewarm fate.',
  privateNotes: 'SECRET-B: I had already eaten four.',
  angle: 'Hot food waits for no one.',
  nickname: '',
});

interface Players {
  a: VersusDesk;
  b: VersusDesk;
  j: VersusDesk;
  /** Let everyone's copy catch up (remote) — a no-op on one device. */
  sync(): Promise<void>;
  /** The court's housekeeping round. */
  clerk(): Promise<void>;
  /** Counsel drafts the case (a device locally; the court's clerk on a server). */
  draft(trialId: string): Promise<void>;
  /** Move court time forward by `seconds`. */
  advance(seconds: number): Promise<void>;
}

/** Invite → briefs → counsel → funding → jury (1 human + 2 demo) → verdict → claims. */
async function playCase(p: Players): Promise<{ trialId: string; final: VersusCase; balances: Record<string, string> }> {
  const { a, b, j, sync } = p;
  await a.faucet(usdc('5.00'));
  await b.faucet(usdc('5.00'));
  await j.faucet(usdc('5.00'));
  const { trialId, code } = await a.fileCase({ title: 'The Last Dumpling', category: 'dating-crimes', patch: briefA.patch });
  await sync();
  expect((await b.findByCode(code))?.trialId).toBe(trialId);
  await b.acceptInvite(trialId);
  await sync();
  await b.saveBrief(trialId, 'b', briefB.patch);
  await a.addExhibit(trialId, 'a', { title: 'Group chat', body: 'me: splitting it 50/50 ok? them: deal' });
  await sync();
  await b.addExhibit(trialId, 'b', { title: 'Thermometer', body: 'Dumpling at 31°C, well below serving temperature.' });
  await sync();
  await a.approveBrief(trialId, 'a');
  await sync();
  await b.approveBrief(trialId, 'b');
  await sync();
  await p.draft(trialId);
  await sync();
  await a.approveDraft(trialId, 'a');
  await sync();
  await b.approveDraft(trialId, 'b');
  await sync();
  await a.fund(trialId);
  await sync();
  await b.fund(trialId);
  await sync();
  await j.takeSeat(trialId);
  await sync();
  await a.seatDemoJurors(trialId, 'reliable');
  await sync();
  await j.commitBallot(trialId, 1);
  await p.advance(30);
  await p.clerk();
  await sync();
  await a.skipAhead(trialId);
  await sync();
  await j.revealBallot(trialId);
  await p.advance(30);
  await p.clerk();
  await sync();
  await a.skipAhead(trialId);
  await p.clerk();
  await sync();
  await p.clerk();
  await sync();
  await j.claim(trialId);
  await sync();
  const w = await a.world();
  const balances: Record<string, string> = {};
  for (const [who, d] of Object.entries({ a, b, j })) balances[who] = formatUsdc(await w.chain.usdcBalance(d.account));
  return { trialId, final: w.case(trialId)!, balances };
}

/** What both adapters must agree on (ids, times and accounts differ by design). */
function outcome(r: Awaited<ReturnType<typeof playCase>>) {
  const s = r.final.state;
  return {
    stage: s.stage,
    verdict: 'verdict' in s && s.verdict ? { kind: s.verdict.kind, label: s.verdict.label, tally: s.verdict.tally } : null,
    sentence: 'sentence' in s ? s.sentence !== null : false,
    caseNumber: r.final.caseNumber,
    claims: r.final.claims.length,
    activity: r.final.activity.map((x) => x.text),
    balances: r.balances,
  };
}

function localPlayers(): Players {
  const clock = new ManualClock(1_767_225_600);
  const store = new MemoryFactStore();
  const counsel = new VersusCounsel();
  let r = 0;
  const random = () => ((r = (r * 9301 + 49297) % 233280), r / 233280);
  const desk = (name: string) =>
    new VersusDesk({ store, persona: { id: `p-${name}`, name, account: testAddress(name) }, counsel, identity: new MockIdentity({ human: `human-${name}` }), salts: new MemorySaltVault(name), clock: clock.now, random });
  const a = desk('alice');
  return {
    a,
    b: desk('bob'),
    j: desk('juror'),
    sync: async () => undefined,
    clerk: async () => {
      await a.tick();
    },
    draft: (trialId) => a.runCounsel(trialId),
    advance: async (s) => {
      clock.advance(s);
    },
  };
}

/** The demo clock control, as a raw fact (the desk only offers "skip to the deadline"). */
async function advanceRemote(d: Device, seconds: number): Promise<void> {
  const fact = { type: 'clock', seconds, seq: 0, at: 0, by: d.persona.id } as Fact;
  for (let i = 0; i < 5; i++) {
    await d.store.pull();
    if (await d.store.append([fact], d.store.read().length)) return;
  }
  throw new Error('could not move the clock');
}

describe('FactStore contract', () => {
  let server: Running;
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(() => server.close());

  const adapters: [string, () => Promise<{ store: FactStore; make: (n: number) => Fact }>][] = [
    [
      'memory',
      async () => {
        const store = new MemoryFactStore();
        return { store, make: (i) => ({ type: 'faucet', account: testAddress(`x${i}`), amount: usdc('1.00'), seq: i + 1, at: 1, by: 'p-x' }) as Fact };
      },
    ],
    [
      'remote',
      async () => {
        const d = await device(server.url);
        return { store: d.store, make: () => ({ type: 'faucet', account: d.persona.account, amount: usdc('1.00'), seq: 0, at: 0, by: '' }) as Fact };
      },
    ],
  ];

  for (const [name, setup] of adapters) {
    describe(name, () => {
      it('appends at the current length, notifies subscribers, and reads back in order', async () => {
        const { store, make } = await setup();
        const start = store.read().length;
        let heard = 0;
        const off = store.subscribe(() => heard++);
        expect(await store.append([make(start)], start)).toBe(true);
        expect(await store.append([make(start + 1)], start + 1)).toBe(true);
        expect(store.read().length).toBe(start + 2);
        expect(store.read()[start]!.type).toBe('faucet');
        expect(heard).toBeGreaterThanOrEqual(2);
        off();
      });

      it('refuses a stale write that touches the same case (the desk then rebuilds and retries)', async () => {
        const { store } = await setup();
        if (name === 'memory') {
          const f = (i: number) => ({ type: 'decline', trialId: 'vs-0000000000', seq: i + 1, at: 1, by: 'x' }) as Fact;
          expect(await store.append([f(0)], 0)).toBe(true);
          expect(await store.append([f(1)], 0)).toBe(false);
          expect(store.read()).toHaveLength(1);
          return;
        }
        // Remote: a real case, then a second write built on the old length.
        const d = await device(server.url);
        const { trialId } = await d.desk.fileCase({ title: 'Stale write', category: 'npc-behavior', patch: briefA.patch });
        const before = d.store.read().length;
        const withdraw = { type: 'withdraw', trialId, side: 'a', account: d.persona.account, seq: 0, at: 0, by: '' } as Fact;
        expect(await d.store.append([withdraw], before)).toBe(true);
        expect(await d.store.append([withdraw], before)).toBe(false);
        expect(d.store.read().length).toBe(before + 1);
      });
    });
  }
});

describe('Versus: one device (memory) and three devices (court server) agree', () => {
  let server: Running;
  const devices: Device[] = [];
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(async () => {
    devices.forEach((d) => d.close());
    await server.close();
  });

  it('plays the same case to the same verdict, money and record', async () => {
    const local = outcome(await playCase(localPlayers()));

    // Same random source as the local desks, so the trial id (and the seeded demo jurors' votes) match.
    let seed = 0;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
    const [a, b, j] = await Promise.all([device(server.url, { random }), device(server.url), device(server.url)]);
    devices.push(a!, b!, j!);
    const remote = await playCase({
      a: a!.desk,
      b: b!.desk,
      j: j!.desk,
      sync: async () => {
        await Promise.all([a!.store.pull(), b!.store.pull(), j!.store.pull()]);
      },
      clerk: () => server.court.tick(),
      draft: async (trialId) => {
        await server.court.tick();
        await a!.desk.runCounsel(trialId);
      },
      advance: (s) => advanceRemote(a!, s),
    });
    const r = outcome(remote);

    expect(local.stage).toMatch(/verdict|share/);
    expect(r).toEqual(local);
    // Every device rebuilds the same world from its own (redacted) copy of the log.
    const views = await Promise.all([a!, b!, j!].map(async (d) => (await d.desk.world()).case(remote.trialId)!.state.stage));
    expect(new Set(views).size).toBe(1);
  });
});



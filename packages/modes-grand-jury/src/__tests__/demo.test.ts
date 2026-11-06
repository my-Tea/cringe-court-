import { describe, expect, it } from 'vitest';
import { usdc } from '@cringe-court/core';
import { DemoClock, createDemoCourt, type DocketEntry } from '../index';

const T0 = 1_800_000_000;

async function demo() {
  let now = T0;
  const d = await createDemoCourt({ realNow: () => now });
  return {
    d,
    advance: (s: number) => {
      now += s;
    },
    entries: async () => d.court.list(),
    bySlug: async (slug: string): Promise<DocketEntry> => (await d.court.list()).find((e) => e.file.slug === slug)!,
  };
}

describe('seeded docket', () => {
  it('seeds the 8 cases in the documented states', async () => {
    const { d, bySlug, entries } = await demo();
    expect(await entries()).toHaveLength(8);
    const status = async (s: string) => (await bySlug(s)).status;
    expect(await status('hot-dog-sandwich')).toBe('verdict');
    expect(await status('airplane-recline')).toBe('mistrial');
    expect(await status('gif-pronunciation')).toBe('verdict');
    expect(await status('socks-sandals')).toBe('cancelled');
    expect(await status('tabs-vs-spaces')).toBe('summoning');
    expect(await status('cereal-is-soup')).toBe('summoning');
    expect(await status('pineapple-pizza')).toBe('seating');
    expect(await status('k-reply')).toBe('in-session');
    d.dispose();
  });

  it('hot dog: IT IS A SANDWICH, 5 of 7', async () => {
    const { bySlug } = await demo();
    const e = await bySlug('hot-dog-sandwich');
    expect(e.verdict?.label).toBe('IT IS A SANDWICH');
    expect(e.verdict?.tally).toEqual([5, 2]);
    expect(e.gallery.total).toBe(57);
    expect(e.gallery.tally).not.toBeNull();
  });

  it('airplane recline is a mistrial with a refund', async () => {
    const { d, bySlug } = await demo();
    const e = await bySlug('airplane-recline');
    expect(e.verdict?.kind).toBe('no-verdict');
    const detail = (await d.court.detail(e.caseNumber))!;
    expect(detail.disclosure?.outcome).toBe('no-verdict');
    expect(detail.viewer.seat).toBeNull();
  });

  it('gif pronunciation: HARD G with an unclaimed 2.10 that the viewer can claim', async () => {
    const { d, bySlug } = await demo();
    const e = await bySlug('gif-pronunciation');
    expect(e.verdict?.label).toBe('HARD G');
    const detail = (await d.court.detail(e.caseNumber))!;
    expect(detail.viewer.seat).not.toBeNull();
    expect(detail.viewer.claim).toMatchObject({ amount: usdc('2.10'), claimed: false });
    expect(detail.disclosure?.completed).toBe(6);
    expect(detail.disclosure?.forfeits).toBe(usdc('1.20'));
    const before = (await d.court.balance())!;
    expect(await d.court.claim(e.caseNumber)).toMatchObject({ ok: true });
    expect((await d.court.balance())!).toBe(before + usdc('2.10'));
    expect((await d.court.detail(e.caseNumber))!.viewer.claim?.claimed).toBe(true);
  });

  it('socks and sandals is cancelled with a 0.50 refund for the viewer', async () => {
    const { d, bySlug } = await demo();
    const e = await bySlug('socks-sandals');
    const detail = (await d.court.detail(e.caseNumber))!;
    expect(detail.disclosure?.outcome).toBe('cancelled');
    expect(detail.viewer.contributed).toBe(usdc('0.50'));
    expect(detail.viewer.claim).toMatchObject({ amount: usdc('0.50'), claimed: false });
    const before = (await d.court.balance())!;
    expect(await d.court.claim(e.caseNumber)).toMatchObject({ ok: true });
    expect((await d.court.balance())!).toBe(before + usdc('0.50'));
  });

  it('tabs vs spaces is summoning and unsponsored; cereal is summoning and sponsored', async () => {
    const { bySlug } = await demo();
    const tabs = await bySlug('tabs-vs-spaces');
    const cereal = await bySlug('cereal-is-soup');
    expect(tabs.sponsor).toBeNull();
    expect(tabs.progress).toBeLessThan(0.2);
    expect(cereal.sponsor?.name).toBe('Testnet Toast Co.');
    expect(cereal.progress).toBeGreaterThan(tabs.progress);
    expect(cereal.demoTiming).toBe(true);
  });

  it('pineapple pizza is seating with an open seat for the viewer', async () => {
    const { d, bySlug } = await demo();
    const e = await bySlug('pineapple-pizza');
    expect(e.seats.filled).toBeLessThan(e.seats.total);
    expect(e.sponsor?.name).toBe('Gavel & Grain Bakery');
    expect((await d.court.detail(e.caseNumber))!.viewer.seat).toBeNull();
  });

  it('k-reply is in session with the full transcript up', async () => {
    const { d, bySlug } = await demo();
    const e = await bySlug('k-reply');
    expect(e.seats.filled).toBe(7);
    const detail = (await d.court.detail(e.caseNumber))!;
    expect(detail.transcriptTeaser).toBe(false);
    expect(detail.phaseEndsAt).toBeGreaterThan(d.clock.now());
  });

  it('starts the viewer with a funded wallet and the faucet mints more', async () => {
    const { d } = await demo();
    const start = (await d.court.balance())!;
    expect(start).toBeGreaterThan(0n);
    d.faucet();
    expect((await d.court.balance())!).toBe(start + usdc('10.00'));
    d.faucet(usdc('2.50'));
    expect((await d.court.balance())!).toBe(start + usdc('12.50'));
  });
});

describe('simulation', () => {
  it('drives k-reply to a verdict within 10 minutes of 5 s ticks', async () => {
    const { d, advance, bySlug } = await demo();
    let final: DocketEntry | undefined;
    for (let t = 0; t < 600; t += 5) {
      advance(5);
      await d.sim.tick();
      const e = await bySlug('k-reply');
      if (e.status === 'verdict' || e.status === 'mistrial') {
        final = e;
        break;
      }
    }
    expect(final).toBeDefined();
    expect(final!.verdict).not.toBeNull();
    expect(final!.verdict!.appointed).toBe(7);
    const detail = (await d.court.detail(final!.caseNumber))!;
    expect(detail.sentence).not.toBeNull();
    expect(detail.log.some((l) => l.kind === 'verdict')).toBe(true);
  });

  it('never fills the last seat while the viewer is not seated', async () => {
    const { d, advance, bySlug } = await demo();
    for (let t = 0; t < 600; t += 5) {
      advance(5);
      await d.sim.tick();
      const p = await bySlug('pineapple-pizza');
      if (p.status === 'seating') expect(p.seats.filled).toBeLessThanOrEqual(6);
    }
    const p = await bySlug('pineapple-pizza');
    expect(p.seats.filled).toBeLessThanOrEqual(6);
  });

  it('lets the viewer take the last seat', async () => {
    const { d, advance, bySlug } = await demo();
    for (let t = 0; t < 300; t += 5) {
      advance(5);
      await d.sim.tick();
    }
    const n = (await bySlug('pineapple-pizza')).caseNumber;
    expect((await bySlug('pineapple-pizza')).seats.filled).toBe(6);
    expect((await d.court.screen(n)).ok).toBe(true);
    expect((await d.court.requestSeat(n)).ok).toBe(true);
    expect((await d.court.acceptSeat(n)).ok).toBe(true);
    const e = await bySlug('pineapple-pizza');
    expect(e.seats.filled).toBe(7);
    expect(e.status).toBe('in-session');
  });

  it('catchUp before a skip: the crowd seals and opens on time, so skipping never changes the outcome', async () => {
    const { d, advance, bySlug } = await demo();
    for (let t = 0; t < 300; t += 5) {
      advance(5);
      await d.sim.tick();
    }
    const n = (await bySlug('pineapple-pizza')).caseNumber;
    await d.court.screen(n);
    await d.court.requestSeat(n);
    expect((await d.court.acceptSeat(n)).ok).toBe(true);
    expect((await d.court.seal(n, 0)).ok).toBe(true);
    const skipToDeadline = async () => {
      const e = await bySlug('pineapple-pizza');
      await d.sim.catchUp(n);
      d.clock.skip(e.phaseEndsAt! - d.court.now() + 1);
      await d.sim.tick();
    };
    await skipToDeadline();
    expect((await bySlug('pineapple-pizza')).status).toBe('opening-scrolls');
    expect((await bySlug('pineapple-pizza')).seats.sealed).toBe(7);
    expect((await d.court.reveal(n)).ok).toBe(true);
    await skipToDeadline();
    expect((await d.court.settle(n)).ok).toBe(true);
    const e = await bySlug('pineapple-pizza');
    expect(e.seats.opened).toBe(7);
    expect(e.status).toBe('verdict');
    expect(e.verdict!.tally[0] + e.verdict!.tally[1]).toBe(7);
    const v = (await d.court.detail(n))!.viewer;
    expect(v.claim!.amount).toBe(usdc('2.10'));
  });

  it('is deterministic: two courts give the same verdicts and gallery totals', async () => {
    const a = await demo();
    const b = await demo();
    const snap = async (x: typeof a) => (await x.entries()).map((e) => [e.file.slug, e.status, e.verdict?.label ?? null, e.verdict?.tally ?? null, e.gallery.total, e.raised, e.seats.filled]);
    expect(await snap(a)).toEqual(await snap(b));
    for (let t = 0; t < 300; t += 5) {
      a.advance(5);
      b.advance(5);
      await a.d.sim.tick();
      await b.d.sim.tick();
    }
    expect(await snap(a)).toEqual(await snap(b));
  });
});

describe('DemoClock', () => {
  it('follows the real clock, floored to whole seconds', () => {
    let t = 100.9;
    const c = new DemoClock(() => t);
    expect(c.now()).toBe(100);
    t = 105.2;
    expect(c.now()).toBe(105);
  });
  it('pins, refuses to go backwards, and unpins', () => {
    const t = 1000;
    const c = new DemoClock(() => t);
    c.pin(500);
    expect(c.now()).toBe(500);
    c.pin(500);
    c.pin(600);
    expect(() => c.pin(599)).toThrow(/only moves forward/);
    expect(c.now()).toBe(600);
    c.unpin();
    expect(c.now()).toBe(1000);
  });
  it('skips forward but never back', () => {
    const c = new DemoClock(() => 1000);
    c.skip(30);
    expect(c.now()).toBe(1030);
    expect(c.offset).toBe(30);
    expect(() => c.skip(-1)).toThrow(/only moves forward/);
    expect(c.now()).toBe(1030);
  });
});


describe('simulated crowd funding', () => {
  it('never throws when the remainder is below the minimum contribution (B9)', async () => {
    const { d, advance, bySlug } = await demo();
    const e = await bySlug('cereal-is-soup');
    const n = e.caseNumber;
    const c = (await d.chain.getCase(n))!;
    const left = c.terms.target - c.raised;
    const dust = usdc('0.05');
    const res = await d.court.contribute(n, (left - dust) as typeof dust);
    expect(res.ok).toBe(true);
    advance(120);
    await expect(d.sim.tick()).resolves.toBeUndefined();
    const after = (await d.chain.getCase(n))!;
    expect(after.phase).not.toBe('pre-trial');
    d.dispose();
  });
});

describe('DemoClock and wall-clock jumps (B19)', () => {
  it('does not jump when the device clock does', () => {
    const realNow = Date.now;
    const clock = new DemoClock();
    const before = clock.now();
    try {
      Date.now = () => realNow() + 3_549_000;
      expect(clock.now() - before).toBeLessThan(5);
    } finally {
      Date.now = realNow;
    }
    clock.skip(60);
    expect(clock.now() - before).toBeGreaterThanOrEqual(60);
  });
});

describe('demo commit window vs the hearing (B2)', () => {
  it('outlasts a ~174 s first-person hearing plus two minutes to decide', async () => {
    const { DEMO_DEADLINES } = await import('../demo');
    expect(DEMO_DEADLINES.commit).toBeGreaterThanOrEqual(174 + 120);
  });
});

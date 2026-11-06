import { describe, expect, it } from 'vitest';
import { caseNumber, keccak256, usdc, type BallotChoice, type CaseNumber, type Hex, type Usdc } from '@cringe-court/core';
import { ManualClock, MemoryChain, MockIdentity, MockJury, testAddress } from '@cringe-court/core/testing';
import {
  CaseCatalog,
  DEMO_CASE_FILES,
  Docket,
  GrandJuryCourt,
  MemoryGalleryStore,
  MemoryStorage,
  PublishError,
  ScriptedCounsel,
  StorageSaltVault,
  publishCase,
  type CaseFile,
} from '../index';

const SLUG = 'hot-dog-sandwich';
const MIN = 60;

async function world() {
  const clock = new ManualClock();
  const root = new MemoryChain({ clock: clock.now, firstCase: 101 });
  const docket = new Docket(clock.now);
  docket.attach(root);
  const catalog = new CaseCatalog(DEMO_CASE_FILES);
  const counsel = new ScriptedCounsel(catalog);
  const gallery = new MemoryGalleryStore();
  const identity = new MockIdentity({ human: 'viewer-human' });
  const salts = new StorageSaltVault(new MemoryStorage());
  const jury = new MockJury(clock.now);
  const editor = testAddress('editor');
  const viewer = testAddress('viewer');
  root.mint(viewer, usdc('20.00'));

  const courtFor = (account: Hex) =>
    new GrandJuryCourt({ docket, ports: { chain: root.as(account), identity, salts, jury, counsel }, gallery, clock: clock.now });
  const court = courtFor(viewer);
  const file = (slug = SLUG): CaseFile => catalog.get(slug)!;

  const publish = async (slug = SLUG, extra: Partial<Parameters<typeof publishCase>[0]> = {}): Promise<CaseNumber> =>
    (await publishCase({ docket, chain: root.as(editor), counsel, file: file(slug), ...extra })).published.caseNumber;

  const funders: { account: Hex; amount: Usdc }[] = [];
  /** Raise the rest of the target from fresh accounts. Returns the funders. */
  const fundRest = async (n: CaseNumber, parts: readonly string[] = ['3.65', '3.65']) => {
    for (const p of parts) {
      const account = testAddress(`funder-${n}-${funders.length}`);
      root.mint(account, usdc('10.00'));
      await root.as(account).fund(n, usdc(p));
      funders.push({ account, amount: usdc(p) });
    }
    return funders.slice(-parts.length);
  };

  const others: Hex[] = Array.from({ length: 6 }, (_, i) => testAddress(`other-juror-${i}`));
  const saltOf = (a: Hex) => keccak256(`salt:${a}`);
  const seatOther = async (n: CaseNumber, i: number) => {
    const a = others[i]!;
    root.mint(a, usdc('5.00'));
    await root.as(a).acceptSeat(n, keccak256(`human:${a}`));
  };
  const commitOther = async (n: CaseNumber, i: number, choice: BallotChoice) => {
    const a = others[i]!;
    await root.as(a).commit(n, root.commitmentFor(n, a, choice, saltOf(a)));
  };
  const revealOther = async (n: CaseNumber, i: number, choice: BallotChoice) => root.as(others[i]!).reveal(n, choice, saltOf(others[i]!));

  /** Viewer sits through screening, offer and bond. */
  const viewerSeats = async (n: CaseNumber) => {
    expect((await court.screen(n)).ok).toBe(true);
    expect((await court.requestSeat(n)).ok).toBe(true);
    const r = await court.acceptSeat(n);
    expect(r).toMatchObject({ ok: true });
  };

  /** Funded, viewer seated first, six others fill the jury: case is in the commit phase. */
  const toCommit = async (slug = SLUG) => {
    const n = await publish(slug);
    await fundRest(n);
    await viewerSeats(n);
    for (let i = 0; i < 6; i++) await seatOther(n, i);
    return n;
  };

  /**
   * Play a full trial. `choices[i]` is other juror i's vote; `absent` others never commit.
   * Ends with the clock inside the reveal window (everyone who sealed has revealed).
   */
  const playToReveal = async (n: CaseNumber, viewerChoice: BallotChoice, choices: readonly BallotChoice[], absent: readonly number[] = []) => {
    expect((await court.seal(n, viewerChoice)).ok).toBe(true);
    for (const [i, c] of choices.entries()) if (!absent.includes(i)) await commitOther(n, i, c);
    clock.advance(20 * MIN + 1);
    expect((await court.reveal(n)).ok).toBe(true);
    for (const [i, c] of choices.entries()) if (!absent.includes(i)) await revealOther(n, i, c);
  };
  const pastReveal = () => clock.advance(10 * MIN + 1);

  return { clock, root, docket, catalog, counsel, gallery, identity, salts, jury, editor, viewer, court, courtFor, publish, fundRest, others, seatOther, commitOther, revealOther, viewerSeats, toCommit, playToReveal, pastReveal, file };
}

const bal = async (w: Awaited<ReturnType<typeof world>>, a: Hex = w.viewer) => w.root.usdcBalance(a);

describe('contribute', () => {
  it('rejects below the minimum, above the remaining, and non-positive amounts', async () => {
    const w = await world();
    const n = await w.publish();
    expect(await w.court.contribute(n, usdc('0.05'))).toMatchObject({ ok: false, code: 'bad-amount' });
    expect(await w.court.contribute(n, usdc('7.31'))).toMatchObject({ ok: false, code: 'bad-amount' });
    expect(await w.court.contribute(n, usdc('0'))).toMatchObject({ ok: false, code: 'bad-amount' });
    expect(await w.court.contribute(caseNumber(999), usdc('1.00'))).toMatchObject({ ok: false, code: 'not-found' });
    expect(await bal(w)).toBe(usdc('20.00'));
  });

  it('updates raised, progress and summoners', async () => {
    const w = await world();
    const n = await w.publish();
    expect(await w.court.contribute(n, usdc('0.50'))).toMatchObject({ ok: true });
    expect(await w.court.contribute(n, usdc('1.00'))).toMatchObject({ ok: true });
    const d = (await w.court.detail(n))!;
    expect(d.raised).toBe(usdc('1.50'));
    expect(d.target).toBe(usdc('7.30'));
    expect(d.progress).toBeCloseTo(1.5 / 7.3, 10);
    expect(d.summoners).toBe(1);
    expect(d.viewer.contributed).toBe(usdc('1.50'));
    expect(d.status).toBe('summoning');
    expect(await bal(w)).toBe(usdc('18.50'));
  });

  it('anonymises the summoner list and labels the viewer "You"', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n, ['0.40']);
    await w.court.contribute(n, usdc('0.60'));
    await w.fundRest(n, ['0.25']);
    const list = (await w.court.detail(n))!.summonerList;
    expect(list.map((s) => s.label)).toEqual(['Summoner 1', 'You', 'Summoner 3']);
    expect(list.map((s) => s.isViewer)).toEqual([false, true, false]);
    expect(list.map((s) => s.amount)).toEqual([usdc('0.40'), usdc('0.60'), usdc('0.25')]);
    expect(list.every((s) => Object.keys(s).sort().join() === 'amount,isViewer,label')).toBe(true);
  });

  it('accepts the exact remaining amount even when it is below the minimum', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n, ['3.65', '3.60']); // 7.25 raised, 0.05 left
    const r = await w.court.contribute(n, usdc('0.05'));
    // The court's own minimum check must let the exact remainder through (contract: CringeCourt.sol accepted < remaining).
    expect(r.ok === false ? r.message : '').not.toMatch(/start at/);
  });

  // The MemoryChain twin matches contracts/src/CringeCourt.sol (`accepted < min && accepted < remaining`).
  it('lets the ledger close the last sliver of funding (twin should match the contract)', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n, ['3.65', '3.60']);
    expect(await w.court.contribute(n, usdc('0.05'))).toMatchObject({ ok: true });
  });

  it('refuses contributions once the case is funded', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n);
    const d = (await w.court.detail(n))!;
    expect(d.phase).toBe('recruiting');
    expect(await w.court.contribute(n, usdc('0.50'))).toMatchObject({ ok: false, code: 'wrong-phase' });
  });
});

describe('transcript visibility', () => {
  it('is the teaser until the jury is seated, then the full show', async () => {
    const w = await world();
    const n = await w.publish();
    const teaser = (await w.court.detail(n))!;
    expect(teaser.transcriptTeaser).toBe(true);
    const segs = new Set(teaser.transcript.map((l) => l.segment));
    expect(segs.has('rebuttal')).toBe(false);
    expect(segs.has('closing')).toBe(false);
    expect([...segs].sort()).toEqual(['call-to-order', 'jury-out', 'opening']);

    await w.fundRest(n);
    expect((await w.court.detail(n))!.transcriptTeaser).toBe(true); // recruiting
    await w.viewerSeats(n);
    for (let i = 0; i < 6; i++) await w.seatOther(n, i);
    const full = (await w.court.detail(n))!;
    expect(full.phase).toBe('commit');
    expect(full.transcriptTeaser).toBe(false);
    expect(full.transcript.some((l) => l.segment === 'closing')).toBe(true);
    expect(full.transcript).toHaveLength(w.file().script.length);
    expect(full.transcriptHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('juror path', () => {
  it('screen fails with wrong-phase before recruiting', async () => {
    const w = await world();
    const n = await w.publish();
    expect(await w.court.screen(n)).toMatchObject({ ok: false, code: 'wrong-phase' });
  });

  it.each(['cancelled', 'not-verified'] as const)('surfaces a %s World ID result', async (behaviour) => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n);
    w.identity.behaviour = behaviour;
    expect(await w.court.screen(n)).toMatchObject({ ok: false, code: behaviour });
    expect(await w.court.requestSeat(n)).toMatchObject({ ok: false, code: 'not-screened' });
  });

  it('requires screening before a seat offer', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n);
    expect(await w.court.requestSeat(n)).toMatchObject({ ok: false, code: 'not-screened' });
  });

  it('screen, offer and accept debits the 1.20 bond', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n);
    const before = await bal(w);
    expect((await w.court.screen(n)).ok).toBe(true);
    const offer = await w.court.requestSeat(n);
    expect(offer).toMatchObject({ ok: true });
    expect((await w.court.detail(n))!.viewer.offer?.bond).toBe(usdc('1.20'));
    expect(await bal(w)).toBe(before);
    expect(await w.court.acceptSeat(n)).toMatchObject({ ok: true });
    expect(await bal(w)).toBe(before - usdc('1.20'));
    const d = (await w.court.detail(n))!;
    expect(d.viewer.seat).toBe(1);
    expect(d.seats.filled).toBe(1);
    expect(d.viewer.screened).toBe(true);
  });

  it('declining a seat costs nothing', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n);
    const before = await bal(w);
    await w.court.screen(n);
    await w.court.requestSeat(n);
    expect(await w.court.declineSeat(n)).toMatchObject({ ok: true });
    expect(await bal(w)).toBe(before);
    expect((await w.court.detail(n))!.viewer.offer).toBeNull();
    expect(await w.court.acceptSeat(n)).toMatchObject({ ok: false, code: 'no-offer' });
    expect((await w.court.detail(n))!.seats.filled).toBe(0);
  });

  it('an expired offer cannot be accepted', async () => {
    const w = await world();
    const n = await w.publish();
    await w.fundRest(n);
    await w.court.screen(n);
    await w.court.requestSeat(n);
    w.clock.advance(121);
    expect((await w.court.detail(n))!.viewer.offer).toBeNull();
    expect(await w.court.acceptSeat(n)).toMatchObject({ ok: false, code: 'offer-expired' });
    expect(await bal(w)).toBe(usdc('20.00'));
  });

  it('the sponsor cannot sit on the jury', async () => {
    const w = await world();
    const sponsor = testAddress('sponsor');
    w.root.mint(sponsor, usdc('2.00'));
    const n = await w.publish(SLUG, { sponsor: { account: sponsor, amount: usdc('2.00'), chain: w.root.as(sponsor) } });
    await w.fundRest(n);
    const d = (await w.courtFor(sponsor).detail(n))!;
    expect(d.viewer.isSponsor).toBe(true);
    expect(await w.courtFor(sponsor).screen(n)).toMatchObject({ ok: false, code: 'conflicted' });
  });
});

describe('sealing and revealing', () => {
  it('seal returns a ccgj1 scroll and records the sealed choice', async () => {
    const w = await world();
    const n = await w.toCommit();
    const r = await w.court.seal(n, 1);
    expect(r.ok && r.value.scroll.startsWith('ccgj1.')).toBe(true);
    const d = (await w.court.detail(n))!;
    expect(d.viewer.committed).toBe(true);
    expect(d.viewer.sealedChoice).toBe(1);
    expect(d.viewer.hasSalt).toBe(true);
    expect(d.viewer.scroll).toBe(r.ok ? r.value.scroll : null);
    expect(d.seats).toMatchObject({ filled: 7, total: 7, sealed: 1, opened: 0 });
  });

  it('reveals with the saved salt after the commit deadline', async () => {
    const w = await world();
    const n = await w.toCommit();
    await w.court.seal(n, 0);
    expect(await w.court.reveal(n)).toMatchObject({ ok: false }); // still the commit window
    w.clock.advance(20 * MIN + 1);
    expect(await w.court.reveal(n)).toMatchObject({ ok: true, value: 0 });
    const d = (await w.court.detail(n))!;
    expect(d.viewer.revealed).toBe(true);
    expect(d.viewer.scroll).toBeNull();
  });

  it('recovers a lost salt from the scroll', async () => {
    const w = await world();
    const n = await w.toCommit();
    const sealed = await w.court.seal(n, 1);
    const scroll = sealed.ok ? sealed.value.scroll : '';
    w.clock.advance(20 * MIN + 1);
    await w.salts.remove(n, w.viewer);
    expect((await w.court.detail(n))!.viewer.hasSalt).toBe(false);
    expect(await w.court.reveal(n)).toMatchObject({ ok: false, code: 'salt-missing' });
    expect(await w.court.reveal(n, scroll)).toMatchObject({ ok: true, value: 1 });
  });

  it('rejects a scroll for another case or another wallet', async () => {
    const w = await world();
    const n = await w.toCommit();
    const sealed = await w.court.seal(n, 0);
    const scroll = sealed.ok ? sealed.value.scroll : '';
    w.clock.advance(20 * MIN + 1);
    const wrongCase = scroll.replace(`.${n}.`, `.${n + 1}.`);
    expect(await w.court.reveal(n, wrongCase)).toMatchObject({ ok: false, code: 'bad-scroll' });
    const wrongWallet = scroll.replace(w.viewer.slice(2), w.others[0]!.slice(2));
    expect(await w.court.reveal(n, wrongWallet)).toMatchObject({ ok: false, code: 'bad-scroll' });
    expect(await w.court.reveal(n, 'garbage')).toMatchObject({ ok: false, code: 'bad-scroll' });
    expect(await w.court.reveal(n, scroll)).toMatchObject({ ok: true });
  });
});

describe('settlement, claims and disclosure (verdict)', () => {
  // Viewer 0, others [0,0,0,1,1] reveal, other #5 never shows: 4 of 7 for position 0.
  const run = async () => {
    const w = await world();
    const n = await w.toCommit();
    await w.playToReveal(n, 0, [0, 0, 0, 1, 1, 1], [5]);
    return { w, n };
  };

  it('settle fails before the reveal deadline and succeeds after', async () => {
    const { w, n } = await run();
    expect((await w.court.detail(n))!.status).toBe('opening-scrolls');
    expect(await w.court.settle(n)).toMatchObject({ ok: false, code: 'deadline' });
    w.pastReveal();
    expect((await w.court.detail(n))!.status).toBe('settle-ready');
    expect(await w.court.settle(n)).toMatchObject({ ok: true });
    const d = (await w.court.detail(n))!;
    expect(d.status).toBe('verdict');
    expect(d.verdict?.kind).toBe('ballot-0');
    expect(d.verdict?.label).toBe(w.file().positions[0].title);
    expect(d.sentence?.speaker).toBe('judge');
    expect(await w.court.settle(n)).toMatchObject({ ok: false });
  });

  it('pays bond plus reward (2.10) once to a revealed juror', async () => {
    const { w, n } = await run();
    w.pastReveal();
    await w.court.settle(n);
    const before = await bal(w);
    const pre = (await w.court.detail(n))!.viewer.claim!;
    expect(pre.claimed).toBe(false);
    expect(pre.amount).toBe(usdc('2.10'));
    const r = await w.court.claim(n);
    expect(r).toMatchObject({ ok: true });
    expect(await bal(w)).toBe(before + usdc('2.10'));
    const post = (await w.court.detail(n))!;
    expect(post.viewer.claim?.claimed).toBe(true);
    expect(post.viewer.hasSalt).toBe(false);
    expect(await w.court.claim(n)).toMatchObject({ ok: false, code: 'duplicate' });
    expect(await bal(w)).toBe(before + usdc('2.10'));
  });

  it('discloses attendance, forfeits and fees (D13)', async () => {
    const { w, n } = await run();
    w.pastReveal();
    await w.court.settle(n);
    const disc = (await w.court.detail(n))!.disclosure!;
    expect(disc.outcome).toBe('verdict');
    expect(disc.appointed).toBe(7);
    expect(disc.completed).toBe(6);
    expect(disc.forfeits).toBe(usdc('1.20')); // one no-show × 1.20 bond
    expect(disc.fees).toBe(usdc('1.00'));
    expect(disc.refundedToFunders).toBe(0n);
    expect(disc.paidToJurors).toBe(usdc('2.10') * 6n);
  });

  it('shows no disclosure while the case runs', async () => {
    const w = await world();
    const n = await w.publish();
    expect((await w.court.detail(n))!.disclosure).toBeNull();
    expect((await w.court.detail(n))!.sentence).toBeNull();
  });
});

describe('NO VERDICT', () => {
  it('refunds every summoner in full and discloses a mistrial', async () => {
    const w = await world();
    const n = await w.publish();
    const funders = await w.fundRest(n);
    await w.viewerSeats(n);
    for (let i = 0; i < 6; i++) await w.seatOther(n, i);
    // 3 vs 3 and one no-show: nobody reaches 4.
    await w.playToReveal(n, 0, [0, 0, 1, 1, 1, 1], [5]);
    w.pastReveal();
    expect(await w.court.settle(n)).toMatchObject({ ok: true });
    const d = (await w.court.detail(n))!;
    expect(d.status).toBe('mistrial');
    expect(d.verdict?.kind).toBe('no-verdict');
    expect(d.disclosure?.outcome).toBe('no-verdict');
    expect(d.disclosure?.refundedToFunders).toBe(usdc('7.30'));
    for (const f of funders) {
      const c = w.courtFor(f.account);
      const before = await bal(w, f.account);
      expect(await c.claim(n)).toMatchObject({ ok: true });
      expect(await bal(w, f.account)).toBe(before + f.amount);
    }
  });
});

describe('cancelled case', () => {
  it('refunds a summoner their exact contribution after the funding deadline', async () => {
    const w = await world();
    const n = await w.publish(SLUG, { demoDeadlines: { preTrial: 10 * MIN, recruitment: 5 * MIN, commit: 4 * MIN, reveal: 3 * MIN } });
    const start = await bal(w);
    await w.court.contribute(n, usdc('0.50'));
    expect(await bal(w)).toBe(start - usdc('0.50'));
    w.clock.advance(10 * MIN + 1);
    const d = (await w.court.detail(n))!;
    expect(d.status).toBe('cancelled');
    expect(d.transcriptTeaser).toBe(true);
    expect(d.viewer.claim).toMatchObject({ amount: usdc('0.50'), claimed: false });
    expect(d.disclosure?.outcome).toBe('cancelled');
    expect(await w.court.claim(n)).toMatchObject({ ok: true });
    expect(await bal(w)).toBe(start);
    expect((await w.court.detail(n))!.viewer.claim?.claimed).toBe(true);
  });

  it('cancels after 48 hours with the default terms', async () => {
    const w = await world();
    const n = await w.publish();
    await w.court.contribute(n, usdc('1.00'));
    w.clock.advance(48 * 3600 - 1);
    expect((await w.court.detail(n))!.status).toBe('summoning');
    w.clock.advance(1);
    expect((await w.court.detail(n))!.status).toBe('cancelled');
  });
});

describe('gallery vote (D11)', () => {
  it('allows one vote per account', async () => {
    const w = await world();
    const n = await w.publish();
    expect(await w.court.galleryVote(n, 1)).toMatchObject({ ok: true });
    expect(await w.court.galleryVote(n, 0)).toMatchObject({ ok: false, code: 'already-voted' });
    const d = (await w.court.detail(n))!;
    expect(d.viewer.galleryVote).toBe(1);
    expect(d.viewer.galleryOpen).toBe(true);
    expect(d.gallery.total).toBe(1);
  });

  it('blocks seated jurors', async () => {
    const w = await world();
    const n = await w.toCommit();
    expect((await w.court.detail(n))!.viewer.galleryBlocked).toMatch(/jury/);
    expect(await w.court.galleryVote(n, 0)).toMatchObject({ ok: false, code: 'juror' });
  });

  it('hides the tally until the reveal window closes, then closes voting', async () => {
    const w = await world();
    const n = await w.toCommit();
    const spectator = w.courtFor(testAddress('spectator'));
    const spectator2 = w.courtFor(testAddress('spectator-2'));
    expect(await spectator.galleryVote(n, 0)).toMatchObject({ ok: true });
    expect(await spectator2.galleryVote(n, 1)).toMatchObject({ ok: true });
    await w.playToReveal(n, 0, [0, 0, 0, 1, 1, 1]);
    let e = (await spectator.detail(n))!;
    expect(e.phase).toBe('reveal');
    expect(e.gallery).toEqual({ total: 2, tally: null });
    w.pastReveal();
    e = (await spectator.detail(n))!;
    expect(e.phase).toBe('finalizing');
    expect(e.gallery.tally).toEqual({ votes: [1, 1], total: 2 });
    expect(e.viewer.galleryOpen).toBe(false);
    expect(await w.courtFor(testAddress('late')).galleryVote(n, 0)).toMatchObject({ ok: false, code: 'closed' });
  });

  it('needs a connected account', async () => {
    const w = await world();
    const n = await w.publish();
    const anon = new GrandJuryCourt({
      docket: w.docket,
      ports: { chain: new MemoryChain({ clock: w.clock.now }), identity: w.identity, salts: w.salts, jury: w.jury, counsel: w.counsel },
      gallery: w.gallery,
      clock: w.clock.now,
    });
    expect(await anon.galleryVote(n, 0)).toMatchObject({ ok: false, code: 'no-account' });
  });
});

describe('publishCase', () => {
  it('rejects the 41st unsponsored case in the hackathon phase', async () => {
    const w = await world();
    for (let i = 0; i < 40; i++) await w.publish();
    expect(w.docket.marketingUsed).toBe(40);
    await expect(w.publish()).rejects.toMatchObject({ name: 'PublishError', code: 'marketing-cap-reached' });
    expect(w.docket.list()).toHaveLength(40);
  });

  it('still publishes a sponsored case past the cap', async () => {
    const w = await world();
    for (let i = 0; i < 40; i++) await w.publish();
    const sponsor = testAddress('sponsor');
    w.root.mint(sponsor, usdc('2.00'));
    const n = await w.publish('cereal-is-soup', { sponsor: { account: sponsor, amount: usdc('2.00'), chain: w.root.as(sponsor) } });
    const p = w.docket.get(n)!;
    expect(p.basis).toBe('sponsored');
    expect(p.sponsor?.amount).toBe(usdc('2.00'));
    expect(w.docket.marketingUsed).toBe(40);
  });

  it('rejects a sponsor below 2.00 without opening a case', async () => {
    const w = await world();
    const sponsor = testAddress('cheap-sponsor');
    w.root.mint(sponsor, usdc('2.00'));
    const attempt = w.publish(SLUG, { sponsor: { account: sponsor, amount: usdc('1.00'), chain: w.root.as(sponsor) } });
    await expect(attempt).rejects.toBeInstanceOf(PublishError);
    await expect(attempt).rejects.toMatchObject({ code: 'sponsor-below-floor' });
    expect(w.docket.list()).toHaveLength(0);
    expect(await w.root.listCases()).toHaveLength(0);
    expect(await w.root.usdcBalance(sponsor)).toBe(usdc('2.00'));
  });

  it('freezes the reviewed ballot titles and the transcript hash', async () => {
    const w = await world();
    const n = await w.publish();
    const chainCase = (await w.root.getCase(n))!;
    const p = w.docket.get(n)!;
    expect(chainCase.terms.ballot).toEqual([w.file().positions[0].title, w.file().positions[1].title]);
    expect(chainCase.transcriptHash).toBe(p.transcriptHash);
    expect(chainCase.terms.target).toBe(usdc('7.30'));
    expect(p.demoTiming).toBe(false);
    expect(w.docket.log(n)[0]?.kind).toBe('published');
  });

  it('keeps a public court record from ledger events', async () => {
    const w = await world();
    const n = await w.toCommit();
    const kinds = new Set(w.docket.log(n).map((l) => l.kind));
    for (const k of ['published', 'summoned', 'funded', 'seated', 'in-session']) expect(kinds.has(k as never)).toBe(true);
  });
});

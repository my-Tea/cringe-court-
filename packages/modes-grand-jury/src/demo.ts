/**
 * The offline demo court: a seeded public docket on the in-memory ledger twin,
 * plus a deterministic simulation of the rest of the world (summoners, other
 * jurors, the bailiff who settles) so a single visitor can live through every
 * phase. Everything is test money on a mock ledger; demo deadlines are shorter
 * than production and the UI labels them as demo settings (D14, V4 §8).
 *
 * Production swaps the mock ports for the Arc / World ID / 0G adapters and drops
 * the simulation; GrandJuryCourt does not change.
 */
import {
  caseNumber as toCaseNumber,
  keccak256,
  monotonicUnixClock,
  seededRandom,
  usdc,
  type BallotChoice,
  type CaseNumber,
  type ChainCase,
  type Hex,
  type IdentityPort,
  type Usdc,
} from '@cringe-court/core';
import { MemoryChain, MockIdentity, MockJury, testAddress } from '@cringe-court/core/testing';
import { CaseCatalog, type CaseFile } from './catalog';
import { ScriptedCounsel } from './counsel';
import { GrandJuryCourt } from './court';
import { Docket, publishCase } from './docket';
import { DEMO_CASE_FILES } from './fixtures/docket';
import { MemoryGalleryStore } from './gallery';
import { MemoryStorage, StorageSaltVault, type KeyValueStorage } from './salts';

/**
 * Shortened demo windows (seconds). Production: 48 h / 30 min / 20 min / 10 min.
 * The commit window opens with the hearing, so it must outlast it: the
 * first-person hearing runs about 3 min (174 s in the playtest) and a juror
 * then needs time to decide (UX evaluation B2, same rule as Versus).
 */
export const DEMO_DEADLINES = { preTrial: 45 * 60, recruitment: 15 * 60, commit: 6 * 60, reveal: 3 * 60 } as const;

/** A clock that can be pinned (while seeding history) and skipped forward (demo control). Unix seconds. */
export class DemoClock {
  #pinned: number | null = null;
  #offset = 0;
  /** Default: the wall clock once, then monotonic (B19), so a device clock jump does not expire windows. */
  constructor(private readonly realNow: () => number = monotonicUnixClock()) {}

  now = (): number => this.#pinned ?? Math.floor(this.realNow() + this.#offset);

  get offset(): number {
    return this.#offset;
  }

  pin(t: number): void {
    if (this.#pinned !== null && t < this.#pinned) throw new Error('Demo time only moves forward');
    this.#pinned = Math.floor(t);
  }

  unpin(): void {
    this.#pinned = null;
  }

  skip(seconds: number): void {
    if (seconds < 0) throw new Error('Demo time only moves forward');
    this.#offset += seconds;
  }
}

interface NpcBallot {
  choice: BallotChoice;
  salt: Hex;
  commitAt: number;
  revealAt: number | null;
}

/** How the simulated world treats one case after seeding. */
interface CasePlan {
  /** NPC summoners keep chipping in while the case raises money. */
  npcFunding: boolean;
  /** Probability an NPC juror votes for bench 0. */
  lean: number;
  /** NPC jurors who will miss the reveal (attendance < 100 %, D13). */
  absentees: number;
}

const PLANS: Record<string, CasePlan> = {
  'cereal-is-soup': { npcFunding: true, lean: 0.45, absentees: 0 },
  'pineapple-pizza': { npcFunding: true, lean: 0.55, absentees: 0 },
  'k-reply': { npcFunding: true, lean: 0.62, absentees: 0 },
  'tabs-vs-spaces': { npcFunding: false, lean: 0.5, absentees: 0 },
};
const DEFAULT_PLAN: CasePlan = { npcFunding: true, lean: 0.5, absentees: 0 };

export const DEMO_VIEWER: Hex = testAddress('grand-jury-demo-viewer');
export const DEMO_EDITOR: Hex = testAddress('clerk-of-court');
const NPC_COUNT = 48;

export interface DemoCourtOptions {
  viewer?: Hex;
  /** Real time source (seconds), for tests. */
  realNow?: () => number;
  /** Where the viewer's ballot salts live. The demo ledger is in memory, so the default is too. */
  storage?: KeyValueStorage;
  startingBalance?: Usdc;
  files?: readonly CaseFile[];
  /** The human player's identity (e.g. real World IDKit). Default: a mock keyed to the viewer. */
  identity?: (viewer: Hex) => IdentityPort;
}

export interface DemoCourt {
  court: GrandJuryCourt;
  sim: DemoSimulation;
  clock: DemoClock;
  chain: MemoryChain;
  viewer: Hex;
  identity: IdentityPort;
  /** Testnet faucet stand-in: mints test USDC to the viewer. */
  faucet(amount?: Usdc): void;
  dispose(): void;
}

/** Build and seed the demo court. Takes a few ms; safe to call on app start. */
export async function createDemoCourt(o: DemoCourtOptions = {}): Promise<DemoCourt> {
  const clock = new DemoClock(o.realNow);
  const T = clock.now();
  const viewer = (o.viewer ?? DEMO_VIEWER).toLowerCase() as Hex;
  const catalog = new CaseCatalog(o.files ?? DEMO_CASE_FILES);
  const root = new MemoryChain({ clock: clock.now, firstCase: 101 });
  const docket = new Docket(clock.now);
  const detach = docket.attach(root);
  const counsel = new ScriptedCounsel(catalog);
  const gallery = new MemoryGalleryStore();
  const identity = o.identity ? o.identity(viewer) : new MockIdentity({ human: `demo-human:${viewer}` });
  const salts = new StorageSaltVault(o.storage ?? new MemoryStorage());
  const jury = new MockJury(clock.now);
  const viewerChain = root.as(viewer);
  root.mint(viewer, o.startingBalance ?? usdc('25.00'));

  const sim = new DemoSimulation(root, docket, gallery, clock, viewer);
  sim.fundNpcs();

  const court = new GrandJuryCourt({ docket, ports: { chain: viewerChain, identity, salts, jury, counsel }, gallery, clock: clock.now, offerSeconds: 180 });

  // History is written with a pinned clock, oldest first, so the live clock never runs backwards.
  const seed = new Seeder(root, docket, counsel, catalog, clock, sim, viewer, salts);
  await seed.history(T);
  clock.unpin();

  return {
    court,
    sim,
    clock,
    chain: root,
    viewer,
    identity,
    faucet: (amount = usdc('10.00')) => root.mint(viewer, amount),
    dispose: () => {
      detach();
      court.dispose();
    },
  };
}

class Seeder {
  constructor(
    private readonly root: MemoryChain,
    private readonly docket: Docket,
    private readonly counsel: ScriptedCounsel,
    private readonly catalog: CaseCatalog,
    private readonly clock: DemoClock,
    private readonly sim: DemoSimulation,
    private readonly viewer: Hex,
    private readonly salts: StorageSaltVault,
  ) {}

  async publish(slug: string, at: number): Promise<CaseNumber> {
    this.clock.pin(at);
    const file = this.catalog.get(slug);
    if (!file) throw new Error(`Demo case ${slug} missing`);
    const sponsorAccount = file.sponsor ? testAddress(`sponsor:${file.sponsor.name}`) : null;
    if (sponsorAccount) this.root.mint(sponsorAccount, usdc('2.00'));
    const { published } = await publishCase({
      docket: this.docket,
      chain: this.root.as(DEMO_EDITOR),
      counsel: this.counsel,
      file,
      ...(sponsorAccount ? { sponsor: { account: sponsorAccount, amount: usdc('2.00'), chain: this.root.as(sponsorAccount) } } : {}),
      demoDeadlines: DEMO_DEADLINES,
    });
    return published.caseNumber;
  }

  /** NPC contributions of `amounts`, one per NPC, a few seconds apart. */
  async summon(n: CaseNumber, amounts: readonly string[], at: number): Promise<void> {
    let t = at;
    for (const a of amounts) {
      this.clock.pin(t);
      await this.root.as(this.sim.npc()).fund(n, usdc(a));
      t += 7;
    }
  }

  /** NPCs fund the rest of the target. Returns the time after the last contribution. */
  async fillFunding(n: CaseNumber, at: number): Promise<number> {
    this.clock.pin(at);
    const c = (await this.root.getCase(n))!;
    let left = c.terms.target - c.raised;
    const tickets = ['0.50', '1.00', '0.25', '0.50', '0.10', '0.75', '0.50', '1.00', '0.40', '0.50', '0.30', '0.50', '1.00', '0.20'];
    let t = at;
    for (let i = 0; left > 0n; i++) {
      const want = usdc(tickets[i % tickets.length]!);
      const amount = (want > left ? left : want) as Usdc;
      this.clock.pin(t);
      await this.root.as(this.sim.npc()).fund(n, amount);
      left -= amount;
      t += 5;
    }
    return t;
  }

  async seatNpcs(n: CaseNumber, count: number, at: number, step = 20): Promise<number> {
    let t = at;
    for (let i = 0; i < count; i++) {
      this.clock.pin(t);
      await this.sim.seatNpc(n);
      t += step;
    }
    return t;
  }

  async viewerSeat(n: CaseNumber, at: number): Promise<void> {
    this.clock.pin(at);
    await this.root.as(this.viewer).acceptSeat(n, keccak256(`demo-human:${this.viewer}:seat:${n}`));
  }

  async viewerSeal(n: CaseNumber, choice: BallotChoice, at: number): Promise<void> {
    this.clock.pin(at);
    const salt = this.salts.newSalt();
    const commitment = this.root.commitmentFor(n, this.viewer, choice, salt);
    await this.salts.save({ caseNumber: n, juror: this.viewer, choice, salt, commitment, savedAt: at });
    await this.root.as(this.viewer).commit(n, commitment);
  }

  async viewerReveal(n: CaseNumber): Promise<void> {
    const b = (await this.salts.load(n, this.viewer))!;
    await this.root.as(this.viewer).reveal(n, b.choice, b.salt);
  }

  async history(T: number): Promise<void> {
    // 1. A clear verdict, long settled.
    const hotDog = await this.publish('hot-dog-sandwich', T - 3 * 3600);
    await this.fillFunding(hotDog, T - 3 * 3600 + 60);
    let t = await this.seatNpcs(hotDog, 7, T - 3 * 3600 + 300);
    await this.sim.scriptVotes(hotDog, [0, 0, 1, 0, 0, 1, 0], [], t + 5);
    await this.sim.playOut(hotDog, t);
    this.sim.galleryCrowd(hotDog, 57, 0.64);

    // 2. A hung jury: 3–3 with one no-show → NO VERDICT, everyone refunded.
    const recline = await this.publish('airplane-recline', T - 2.5 * 3600);
    await this.fillFunding(recline, T - 2.5 * 3600 + 60);
    t = await this.seatNpcs(recline, 7, T - 2.5 * 3600 + 300);
    await this.sim.scriptVotes(recline, [0, 1, 0, 1, 1, 0, 0], [6], t + 5);
    await this.sim.playOut(recline, t);
    this.sim.galleryCrowd(recline, 41, 0.48);

    // 3. The viewer served on this one and has a payout waiting. One NPC no-show (disclosed forfeit).
    const gif = await this.publish('gif-pronunciation', T - 2 * 3600);
    await this.fillFunding(gif, T - 2 * 3600 + 60);
    t = await this.seatNpcs(gif, 6, T - 2 * 3600 + 300);
    await this.viewerSeat(gif, t);
    await this.viewerSeal(gif, 0, t + 20);
    await this.sim.scriptVotes(gif, [0, 0, 1, 0, 1, 0], [5], t + 30);
    await this.sim.playOut(gif, t + 30, () => this.viewerReveal(gif));
    this.sim.galleryCrowd(gif, 88, 0.71);

    // 4. Funding fell short: cancelled, and the viewer's 0.50 is refundable.
    const socks = await this.publish('socks-sandals', T - 1.5 * 3600);
    await this.summon(socks, ['0.50', '0.30', '1.00', '0.10'], T - 1.5 * 3600 + 120);
    this.clock.pin(T - 1.5 * 3600 + 400);
    await this.root.as(this.viewer).fund(socks, usdc('0.50'));
    this.clock.pin(T - 1.5 * 3600 + DEMO_DEADLINES.preTrial + 5);
    await this.root.getCase(socks); // the ledger notices the missed deadline here
    this.sim.galleryCrowd(socks, 12, 0.4);

    // 5. Raising money, deadline close: nobody else will fund it (the viewer could).
    const tabs = await this.publish('tabs-vs-spaces', T - 40 * 60);
    await this.summon(tabs, ['0.20', '0.30', '0.10'], T - 40 * 60 + 90);
    this.sim.galleryCrowd(tabs, 9, 0.55);

    // 6. Raising money, healthy, sponsored.
    const cereal = await this.publish('cereal-is-soup', T - 20 * 60);
    await this.summon(cereal, ['0.50', '1.00', '0.25', '0.50', '0.10', '0.50', '0.75', '0.20', '0.50', '0.10', '0.30'], T - 20 * 60 + 60);
    this.sim.galleryCrowd(cereal, 23, 0.52);

    // 7. Seating the jury, sponsored: seats left for the viewer.
    const pineapple = await this.publish('pineapple-pizza', T - 8 * 60);
    t = await this.fillFunding(pineapple, T - 8 * 60 + 20);
    await this.seatNpcs(pineapple, 4, t + 20, 30);
    this.sim.galleryCrowd(pineapple, 31, 0.47);

    // 8. In session: arguments up, ballots sealing; the simulation finishes it live.
    const k = await this.publish('k-reply', T - 4 * 60);
    t = await this.fillFunding(k, T - 4 * 60 + 5);
    t = await this.seatNpcs(k, 7, t + 2, 6);
    await this.sim.planVotes(k, t + 50);
    this.sim.galleryCrowd(k, 19, 0.58);
    await this.sim.tick(T - 20);
    this.clock.pin(T);
  }
}

/**
 * The rest of the world. Deterministic for a given seed: every NPC action is a
 * pure function of the case, the NPC index and time.
 */
export class DemoSimulation {
  readonly #rand = seededRandom('grand-jury-demo');
  readonly #npcs: Hex[] = Array.from({ length: NPC_COUNT }, (_, i) => testAddress(`npc-${i}`));
  #nextNpc = 0;
  readonly #ballots = new Map<string, NpcBallot>();
  readonly #lastAction = new Map<CaseNumber, number>();
  readonly #settleAt = new Map<CaseNumber, number>();
  #busy = false;

  constructor(
    private readonly root: MemoryChain,
    private readonly docket: Docket,
    private readonly gallery: MemoryGalleryStore,
    private readonly clock: DemoClock,
    private readonly viewer: Hex,
  ) {}

  fundNpcs(): void {
    for (const a of this.#npcs) this.root.mint(a, usdc('50.00'));
  }

  /** Next NPC wallet, round robin. */
  npc(): Hex {
    const a = this.#npcs[this.#nextNpc % this.#npcs.length]!;
    this.#nextNpc++;
    return a;
  }

  #plan(n: CaseNumber): CasePlan {
    return PLANS[this.docket.get(n)?.file.slug ?? ''] ?? DEFAULT_PLAN;
  }

  async seatNpc(n: CaseNumber): Promise<void> {
    const c = (await this.root.getCase(n))!;
    const taken = new Set(c.seats.map((s) => s.juror.toLowerCase()));
    const funders = new Set(c.deposits.filter((d) => d.kind === 'sponsor').map((d) => d.account.toLowerCase()));
    let juror = this.npc();
    while (taken.has(juror.toLowerCase()) || funders.has(juror.toLowerCase())) juror = this.npc();
    await this.root.as(juror).acceptSeat(n, keccak256(`npc-human:${juror}`));
  }

  /** Fix NPC votes in seat order (viewer seats skipped); `absent` are indexes into that list who never reveal. */
  async scriptVotes(n: CaseNumber, choices: readonly BallotChoice[], absent: readonly number[], commitAt: number): Promise<void> {
    const c = (await this.root.getCase(n))!;
    const npcs = c.seats.filter((s) => s.juror.toLowerCase() !== this.viewer);
    npcs.forEach((s, i) => {
      const salt = keccak256(`npc-salt:${n}:${s.juror}`);
      this.#ballots.set(`${n}:${s.juror.toLowerCase()}`, { choice: choices[i] ?? 0, salt, commitAt: commitAt + i * 9, revealAt: absent.includes(i) ? null : 0 });
    });
  }

  /** Random NPC votes and timings for a live case. */
  async planVotes(n: CaseNumber, from: number): Promise<void> {
    const plan = this.#plan(n);
    const c = await this.root.getCase(n);
    if (!c) return;
    {
      const npcs = c.seats.filter((s) => s.juror.toLowerCase() !== this.viewer);
      npcs.forEach((s, i) => {
        const k = `${n}:${s.juror.toLowerCase()}`;
        if (this.#ballots.has(k)) return;
        const choice: BallotChoice = this.#rand() < plan.lean ? 0 : 1;
        const commitAt = from + Math.floor(this.#rand() * 0.55 * DEMO_DEADLINES.commit);
        this.#ballots.set(k, { choice, salt: keccak256(`npc-salt:${n}:${s.juror}`), commitAt, revealAt: i < plan.absentees ? null : 0 });
      });
    }
  }

  /** Run a scripted case from seating to settlement on the pinned clock. `onReveal` runs as the reveal window opens. */
  async playOut(n: CaseNumber, seatedAt: number, onReveal?: () => Promise<void>): Promise<void> {
    const c = (await this.root.getCase(n))!;
    const commitEnds = c.deadlines.commit!;
    for (let t = seatedAt + 5; t < commitEnds; t += 15) {
      this.clock.pin(t);
      await this.#act(n);
    }
    this.clock.pin(commitEnds + 1);
    const revealEnds = (await this.root.getCase(n))!.deadlines.reveal!;
    if (onReveal) await onReveal();
    for (let t = commitEnds + 6; t < revealEnds; t += 15) {
      this.clock.pin(t);
      await this.#act(n);
    }
    this.clock.pin(revealEnds + 2);
    await this.root.as(this.npc()).finalize(n);
  }

  /** NPC gallery votes, offchain. */
  galleryCrowd(n: CaseNumber, count: number, share0: number): void {
    for (let i = 0; i < count; i++) {
      const account = testAddress(`gallery-${n}-${i}`);
      void this.gallery.cast(n, account, i < Math.round(count * share0) ? 0 : 1);
    }
  }

  /**
   * Before the demo clock jumps to a deadline: every simulated juror does what
   * they would have done inside the window (seal, or open their scroll), so a
   * skip shortens the wait without changing the outcome. Scripted absentees
   * still miss the reveal, and the viewer is never acted for.
   */
  async catchUp(n: CaseNumber): Promise<void> {
    const c = await this.root.getCase(n);
    if (!c) return;
    if (c.phase === 'commit') {
      if (!this.#hasPlan(c)) await this.planVotes(n, this.clock.now());
      for (const s of c.seats) {
        const b = this.#ballots.get(`${n}:${s.juror.toLowerCase()}`);
        if (b && !s.committed) await this.root.as(s.juror).commit(n, this.root.commitmentFor(n, s.juror, b.choice, b.salt));
      }
    } else if (c.phase === 'reveal') {
      for (const s of c.seats) {
        const b = this.#ballots.get(`${n}:${s.juror.toLowerCase()}`);
        if (b && s.committed && !s.revealed && b.revealAt !== null) await this.root.as(s.juror).reveal(n, b.choice, b.salt);
      }
    }
  }

  /** One step of the world. The app calls this every second; overlapping calls are dropped. */
  async tick(at?: number): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try {
      if (at !== undefined) this.clock.pin(at);
      for (const p of this.docket.list()) await this.#act(p.caseNumber);
    } finally {
      this.#busy = false;
    }
  }

  async #act(n: CaseNumber): Promise<void> {
    const now = this.clock.now();
    const c = await this.root.getCase(n);
    if (!c) return;
    const plan = this.#plan(n);
    const last = this.#lastAction.get(n) ?? 0;
    switch (c.phase) {
      case 'pre-trial': {
        if (!plan.npcFunding || now - last < 30) return;
        const left = c.terms.target - c.raised;
        const pick = (['0.10', '0.25', '0.50', '0.50', '1.00'] as const)[Math.floor(this.#rand() * 5)]!;
        const min = c.terms.funding.kind === 'crowdfund' ? c.terms.funding.minContribution : 0n;
        let amount = (usdc(pick) > left ? left : usdc(pick)) as Usdc;
        // Never leave a remainder smaller than the minimum (nobody could fill it but an exact top-up): close it instead.
        if (left - amount > 0n && left - amount < min) amount = left as Usdc;
        // Below the minimum only an exact final top-up is allowed (the contract's rule).
        if (amount <= 0n || (amount < min && amount !== left)) return;
        this.#lastAction.set(n, now);
        await this.root.as(this.npc()).fund(n, amount);
        return;
      }
      case 'recruiting': {
        const viewerSeated = c.seats.some((s) => s.juror.toLowerCase() === this.viewer);
        // Leave the last seat for a visitor unless they are already sworn in.
        const cap = c.terms.jurySize - (viewerSeated ? 0 : 1);
        if (c.seats.length >= cap || now - last < 25) return;
        this.#lastAction.set(n, now);
        await this.seatNpc(n);
        if (c.seats.length + 1 === c.terms.jurySize) await this.planVotes(n, now);
        return;
      }
      case 'commit':
        if (!this.#hasPlan(c)) await this.planVotes(n, now);
        for (const s of c.seats) {
          const b = this.#ballots.get(`${n}:${s.juror.toLowerCase()}`);
          if (!b || s.committed || now < b.commitAt) continue;
          await this.root.as(s.juror).commit(n, this.root.commitmentFor(n, s.juror, b.choice, b.salt));
        }
        return;
      case 'reveal': {
        const opened = c.deadlines.reveal! - c.terms.deadlines.reveal;
        for (const [i, s] of c.seats.entries()) {
          const b = this.#ballots.get(`${n}:${s.juror.toLowerCase()}`);
          if (!b || !s.committed || s.revealed || b.revealAt === null) continue;
          if (b.revealAt === 0) b.revealAt = opened + 4 + Math.floor((i / c.seats.length) * 0.5 * c.terms.deadlines.reveal);
          if (now < b.revealAt) continue;
          await this.root.as(s.juror).reveal(n, b.choice, b.salt);
        }
        return;
      }
      case 'finalizing': {
        // The bailiff settles a few seconds after the deadline if nobody else has (finalization is permissionless).
        const at = this.#settleAt.get(n) ?? now + 8;
        this.#settleAt.set(n, at);
        if (now >= at) await this.root.as(this.npc()).finalize(n);
        return;
      }
      default:
        return;
    }
  }

  #hasPlan(c: ChainCase): boolean {
    return c.seats.some((s) => this.#ballots.has(`${c.number}:${s.juror.toLowerCase()}`));
  }
}

/** Parse a `/grand-jury/case/:n` route param. */
export function parseCaseParam(raw: string | undefined): CaseNumber | null {
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? toCaseNumber(n) : null;
}

/**
 * The Grand Jury hall: one public court shared by every device.
 *
 * It is the very demo court the app runs offline (`createDemoCourt`: the seeded
 * docket on the ledger twin, the simulated crowd), built once on the server.
 * Each device gets its own `GrandJuryCourt` *view* over the shared ledger,
 * docket, jury pool and gallery, signing as that device's wallet. The rules are
 * the package's; the hall only routes requests and keeps the log.
 *
 * Durability by replay: the hall logs every command with the court time it ran
 * at (and every simulation tick that changed something, or that ran while a
 * case was in session), and runs each command with the clock pinned to that
 * time. Rebuilding is: seed from the genesis time, replay the commands.
 *
 * Secrets: the server never sees a juror's salt before the reveal. A seal
 * arrives as a commitment only; the reveal brings the choice and salt, which
 * the ledger checks against the commitment.
 */
import {
  ChainError,
  usdc,
  type BallotChoice,
  type CaseNumber,
  type Hex,
  type IdentityPort,
  type ProofRequest,
  type ProofResult,
  type ScreeningResult,
  type Usdc,
  type VerifyContext,
  type WorldIdProof,
} from '@cringe-court/core';
import { MemorySaltVault } from '@cringe-court/core/testing';
import {
  createDemoCourt,
  encodeScroll,
  GrandJuryCourt,
  windowOf,
  type ActionResult,
  type DemoCourt,
  type NpcJurorPolicy,
} from '@cringe-court/modes-grand-jury';
import type { DurableLog } from '../store';

export type GjCommand =
  | { type: 'genesis'; at: number; npcJurors: NpcJurorPolicy }
  | { type: 'welcome'; account: Hex; at: number }
  | { type: 'faucet'; account: Hex; amount: Usdc; at: number }
  | { type: 'contribute'; account: Hex; n: CaseNumber; amount: Usdc; at: number }
  | { type: 'screen'; account: Hex; n: CaseNumber; proof: WorldIdProof; at: number }
  | { type: 'seat-request' | 'seat-decline' | 'seat-accept' | 'settle' | 'claim'; account: Hex; n: CaseNumber; at: number }
  | { type: 'commit'; account: Hex; n: CaseNumber; commitment: Hex; at: number }
  | { type: 'reveal'; account: Hex; n: CaseNumber; choice: BallotChoice; salt: Hex; at: number }
  | { type: 'gallery'; account: Hex; n: CaseNumber; choice: BallotChoice; at: number }
  | { type: 'skip'; n: CaseNumber; at: number }
  | { type: 'tick'; at: number };

type Command = Exclude<GjCommand, { type: 'genesis' | 'tick' }>;
/** A command as a route builds it; the hall stamps the time. */
export type CommandInput = Command extends infer C ? (C extends unknown ? Omit<C, 'at'> : never) : never;

export const STARTING_BALANCE = usdc('25.00');
export const FAUCET_MAX = usdc('10.00');

const ok = <T>(value: T, explorerUrl?: string): ActionResult<T> => (explorerUrl ? { ok: true, value, explorerUrl } : { ok: true, value });
const fail = (code: string, message: string): ActionResult<never> => ({ ok: false, code, message });

/* ── World ID on the server ─────────────────────────────────────────────── */

const LEVELS = ['device', 'document', 'secure-document', 'orb'] as const;
const WORD = /^0x[0-9a-fA-F]{64}$/;

/**
 * Verifies the proofs devices present. The demo proofs are mock (as in the
 * offline app): their shape is checked, juror actions need Orb level, and one
 * human (nullifier) holds one seat per case across every device.
 */
export class ProofVerifier {
  readonly #used = new Map<string, string>();

  verify(account: Hex, proof: WorldIdProof, request: ProofRequest, context: VerifyContext = {}): ScreeningResult {
    if (!WORD.test(proof.nullifierHash) || !LEVELS.includes(proof.verificationLevel)) {
      return { ok: false, reason: 'not-verified', message: 'That World ID proof is malformed.' };
    }
    if (request.minLevel === 'orb' && proof.verificationLevel !== 'orb') {
      return { ok: false, reason: 'not-verified', message: 'A jury seat needs an Orb-verified World ID.' };
    }
    const n = proof.nullifierHash.toLowerCase();
    if (context.exclude?.some((x) => x.toLowerCase() === n)) {
      return { ok: false, reason: 'conflicted', message: 'You are a party to this case, so you cannot sit on its jury.' };
    }
    const scope = `${request.action}:${request.signal}:${n}`;
    const holder = this.#used.get(scope);
    if (holder && holder !== account.toLowerCase()) return { ok: false, reason: 'already-used', message: 'This World ID was already used for this seat.' };
    this.#used.set(scope, account.toLowerCase());
    return { ok: true, nullifier: proof.nullifierHash };
  }
}

/** The identity port a device's court view uses on the server: it hands over the proof the device presented. */
class PresentedIdentity implements IdentityPort {
  readonly id = 'mock' as const;
  readonly appId = 'app_staging_cringecourt_server';
  proof: WorldIdProof | null = null;

  constructor(
    private readonly account: Hex,
    private readonly verifier: ProofVerifier,
  ) {}

  async requestProof(): Promise<ProofResult> {
    if (!this.proof) return { ok: false, reason: 'cancelled', message: 'No World ID proof was presented.' };
    return { ok: true, proof: this.proof };
  }

  async verify(proof: WorldIdProof, request: ProofRequest, context?: VerifyContext): Promise<ScreeningResult> {
    return this.verifier.verify(this.account, proof, request, context);
  }
}

interface View {
  court: GrandJuryCourt;
  identity: PresentedIdentity;
}

export interface HallOptions {
  log: DurableLog<GjCommand>;
  npcJurors: NpcJurorPolicy;
  demoClock: boolean;
  /** Wall clock, unix seconds (fractional ok). */
  realNow?: () => number;
  onChange?: () => void;
}

export class GrandJuryHall {
  readonly #o: HallOptions;
  #demo!: DemoCourt;
  readonly #views = new Map<string, View>();
  readonly #verifier = new ProofVerifier();
  readonly #welcomed = new Set<string>();
  #queue: Promise<unknown> = Promise.resolve();
  #version = 0;
  #events = 0;
  #replaying = false;
  #lastAt = 0;

  private constructor(o: HallOptions) {
    this.#o = o;
  }

  /** Seed the court (from the logged genesis, or now), then replay every logged command. */
  static async open(o: HallOptions): Promise<GrandJuryHall> {
    const hall = new GrandJuryHall(o);
    const records = o.log.readAll();
    let genesis = records[0];
    const real = o.realNow ?? (() => Date.now() / 1000);
    let last = 0;
    const monotonic = () => (last = Math.max(last, real()));
    if (!genesis || genesis.type !== 'genesis') {
      genesis = { type: 'genesis', at: Math.floor(monotonic()), npcJurors: o.npcJurors };
      o.log.append(genesis);
    }
    let seeding = true;
    const g = genesis;
    hall.#demo = await createDemoCourt({ realNow: () => (seeding ? g.at : monotonic()), npcJurors: g.npcJurors });
    seeding = false;
    hall.#demo.chain.subscribe('*', () => {
      hall.#events++;
      hall.#version++;
    });
    hall.#demo.docket.onChange(() => hall.#version++);
    hall.#replaying = true;
    try {
      for (const r of records.slice(1)) {
        if (r.type === 'genesis') continue;
        if (r.type === 'tick') await hall.#tickAt(r.at);
        else await hall.#run(r);
      }
    } finally {
      hall.#replaying = false;
      hall.#demo.clock.unpin();
    }
    return hall;
  }

  get version(): number {
    return this.#version;
  }

  /** Court time, unix seconds (demo skips included). */
  now(): number {
    return this.#demo.clock.now();
  }

  get demo(): DemoCourt {
    return this.#demo;
  }

  #serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(fn, fn);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  #stamp(): number {
    this.#lastAt = Math.max(this.#lastAt, this.#demo.clock.now());
    return this.#lastAt;
  }

  #view(account: Hex): View {
    const key = account.toLowerCase();
    let v = this.#views.get(key);
    if (!v) {
      const identity = new PresentedIdentity(key as Hex, this.#verifier);
      const court = new GrandJuryCourt({
        docket: this.#demo.docket,
        ports: { chain: this.#demo.chain.as(key as Hex), identity, salts: new MemorySaltVault(`server:${key}`), jury: this.#demo.jury, counsel: this.#demo.counsel },
        gallery: this.#demo.gallery,
        clock: this.#demo.clock.now,
        offerSeconds: 180,
      });
      v = { court, identity };
      this.#views.set(key, v);
    }
    return v;
  }

  /* ── reads ─────────────────────────────────────────────────────────── */

  /** A device's court view, with its starting test money on first sight. */
  async viewFor(account: Hex): Promise<GrandJuryCourt> {
    if (!this.#welcomed.has(account.toLowerCase())) await this.command({ type: 'welcome', account });
    return this.#view(account).court;
  }

  marketingUsed(): number {
    return this.#demo.docket.marketingUsed;
  }

  /* ── commands ──────────────────────────────────────────────────────── */

  /** Run a command now, log it, and tell the devices. */
  command<T = unknown>(c: CommandInput): Promise<ActionResult<T>> {
    return this.#serial(async () => {
      const full = { ...c, at: this.#stamp() } as Command;
      const result = await this.#run(full);
      this.#o.log.append(full);
      this.#version++;
      this.#o.onChange?.();
      return result as ActionResult<T>;
    });
  }

  async #run(c: Command): Promise<ActionResult<unknown>> {
    const clock = this.#demo.clock;
    this.#lastAt = Math.max(this.#lastAt, c.at);
    clock.pin(c.at);
    try {
      return await this.#exec(c);
    } catch (err) {
      return fail(err instanceof ChainError ? err.code : 'error', err instanceof Error ? err.message : String(err));
    } finally {
      clock.unpin();
    }
  }

  async #exec(c: Command): Promise<ActionResult<unknown>> {
    const root = this.#demo.chain;
    switch (c.type) {
      case 'welcome':
        if (!this.#welcomed.has(c.account.toLowerCase())) {
          this.#welcomed.add(c.account.toLowerCase());
          root.mint(c.account, STARTING_BALANCE);
        }
        return ok(undefined);
      case 'faucet':
        if (c.amount <= 0n || c.amount > FAUCET_MAX) return fail('bad-amount', 'The faucet gives up to 10.00 test USDC at a time.');
        root.mint(c.account, c.amount);
        return ok(undefined);
      case 'contribute':
        return this.#view(c.account).court.contribute(c.n, c.amount);
      case 'screen': {
        const v = this.#view(c.account);
        v.identity.proof = c.proof;
        try {
          return await v.court.screen(c.n);
        } finally {
          v.identity.proof = null;
        }
      }
      case 'seat-request':
        return this.#view(c.account).court.requestSeat(c.n);
      case 'seat-decline':
        return this.#view(c.account).court.declineSeat(c.n);
      case 'seat-accept':
        return this.#view(c.account).court.acceptSeat(c.n);
      case 'commit': {
        // Only the commitment arrives; the ledger enforces the phase and the seat.
        const receipt = await root.as(c.account).commit(c.n, c.commitment);
        return ok(undefined, receipt.explorerUrl);
      }
      case 'reveal': {
        // The device's ballot, presented as its Secret Verdict Scroll so the court's own reveal path runs.
        const commitment = root.commitmentFor(c.n, c.account, c.choice, c.salt);
        const scroll = encodeScroll({ caseNumber: c.n, juror: c.account, choice: c.choice, salt: c.salt, commitment });
        return this.#view(c.account).court.reveal(c.n, scroll);
      }
      case 'settle':
        return this.#view(c.account).court.settle(c.n);
      case 'claim':
        return this.#view(c.account).court.claim(c.n);
      case 'gallery':
        return this.#view(c.account).court.galleryVote(c.n, c.choice);
      case 'skip':
        return this.#skip(c.n, c.at);
    }
  }

  /** The demo control the app shows (DemoControls): let the crowd act, then jump past the deadline. */
  async #skip(n: CaseNumber, at: number): Promise<ActionResult<unknown>> {
    if (!this.#o.demoClock && !this.#replaying) return fail('disabled', 'Moving the court clock is switched off on this server.');
    const c = await this.#demo.chain.getCase(n);
    const p = this.#demo.docket.get(n);
    if (!c || !p) return fail('not-found', 'This case is not on the docket.');
    const window = windowOf(c);
    if (!p.demoTiming || !window) return fail('wrong-phase', 'Nothing to skip: this window has no demo deadline.');
    const left = window[1] - at;
    if (left <= 0) return ok(undefined);
    await this.#demo.sim.catchUp(n);
    this.#demo.clock.skip(left + 1);
    this.#demo.clock.pin(at + left + 1);
    this.#lastAt = Math.max(this.#lastAt, at + left + 1);
    await this.#demo.sim.tick();
    return ok(undefined);
  }

  /* ── the simulated world ───────────────────────────────────────────── */

  async #sensitive(): Promise<boolean> {
    for (const p of this.#demo.docket.list()) {
      const c = await this.#demo.chain.getCase(p.caseNumber);
      if (c && (c.phase === 'commit' || c.phase === 'reveal' || c.phase === 'finalizing')) return true;
    }
    return false;
  }

  /** One simulation step at `at`. Returns whether it changed (or tried to change) the world. */
  async #tickAt(at: number): Promise<{ changed: boolean; threw: boolean }> {
    const before = this.#events;
    let threw = false;
    this.#lastAt = Math.max(this.#lastAt, at);
    this.#demo.clock.pin(at);
    try {
      await this.#demo.sim.tick();
    } catch {
      // A simulated summoner's refused contribution is part of the world, not a server error,
      // but it moved the simulation's own state, so the tick is logged for an exact replay.
      threw = true;
    } finally {
      this.#demo.clock.unpin();
    }
    return { changed: this.#events !== before, threw };
  }

  /** The heartbeat: the simulated crowd acts. Logged when it mattered, so a replay sees the same world. */
  tick(): Promise<void> {
    return this.#serial(async () => {
      const at = this.#stamp();
      const sensitive = await this.#sensitive();
      const { changed, threw } = await this.#tickAt(at);
      if (changed || threw || sensitive) this.#o.log.append({ type: 'tick', at });
      if (changed) this.#o.onChange?.();
    });
  }

  dispose(): void {
    for (const v of this.#views.values()) v.court.dispose();
    this.#views.clear();
    this.#demo.dispose();
  }
}

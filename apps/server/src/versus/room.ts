/**
 * The Versus room on the server: the one fact log every device replays.
 *
 * - Authority: each write is shape-checked, authorized, re-stamped with the
 *   court's sequence number, time and author, then applied to the live World
 *   (the same `World` the clients run, from `@cringe-court/modes-versus`). A fact
 *   the court's rules refuse is never logged.
 * - Concurrency: a write names the log length it was built on. If anything
 *   touching the same case (or the shared clock) landed since, the write is a
 *   conflict and the device's desk rebuilds and retries; unrelated cases never
 *   block each other.
 * - The clerk: the court's own desk drafts counsel (it alone sees both sides'
 *   private notes), finalizes, reads the sentence and drives the labelled demo
 *   jurors. Devices on a shared court do not run a clerk.
 * - Views: every read is redacted for the reading device (./redact.ts).
 */
import { createHash } from 'node:crypto';
import type { AiCounselPort, Hex } from '@cringe-court/core';
import { MemorySaltVault, MockIdentity } from '@cringe-court/core/testing';
import { VersusDesk, World, type Fact, type FactBody, type FactStore, type VersusCase } from '@cringe-court/modes-versus';
import type { VersusLogResponse } from '@cringe-court/net';
import type { DurableLog } from '../store';
import { levelOf, redactFact, trialOf, type Viewer } from './redact';

export class Conflict extends Error {}
export class Rejected extends Error {}
export class RoomFull extends Error {}

const CLERK: Viewer = { account: '0x0000000000000000000000000000000000000000', grants: new Set() };

export interface RoomOptions {
  log: DurableLog<Fact>;
  /** Server wall clock, unix seconds. */
  clock: () => number;
  counsel: AiCounselPort;
  maxCases: number;
  maxFacts: number;
  onChange?: () => void;
}

export class VersusRoom {
  readonly #o: RoomOptions;
  #facts: Fact[] = [];
  #world = new World();
  #queue: Promise<unknown> = Promise.resolve();
  readonly clerk: VersusDesk;
  #ticking = false;

  private constructor(o: RoomOptions) {
    this.#o = o;
    const store: FactStore = {
      read: () => this.#facts,
      append: (facts, expectedLength) =>
        this.#write(facts, expectedLength, null).then(
          () => true,
          (err: unknown) => {
            if (err instanceof Conflict) return false;
            throw err;
          },
        ),
      subscribe: () => () => undefined,
    };
    this.clerk = new VersusDesk({
      store,
      persona: { id: 'clerk', name: 'Clerk of court', account: CLERK.account as Hex },
      counsel: o.counsel,
      identity: new MockIdentity({ human: 'clerk-of-court' }),
      salts: new MemorySaltVault('clerk'),
      clock: o.clock,
      demo: true,
    });
  }

  static async open(o: RoomOptions): Promise<VersusRoom> {
    const room = new VersusRoom(o);
    room.#facts = o.log.readAll();
    room.#world = await World.replay(room.#facts);
    if (room.#world.rejected.size > 0) {
      throw new Error(`The stored Versus log does not replay cleanly (${room.#world.rejected.size} rejected facts).`);
    }
    return room;
  }

  get length(): number {
    return this.#facts.length;
  }

  /** Court time: wall clock plus the demo skips everyone shares. */
  now(): number {
    return this.#o.clock() + this.#world.skew;
  }

  cases(): readonly VersusCase[] {
    return this.#world.cases();
  }

  case(trialId: string): VersusCase | undefined {
    return this.#world.case(trialId);
  }

  findByCode(code: string): VersusCase | undefined {
    return this.#world.cases().find((c) => c.code === code);
  }

  /** Serialize writes: World.apply is async and the log is single-writer. */
  #serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(fn, fn);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Append facts built on a log of `base` facts. `authors` gives each fact's
   * `by` (from authorization); null means the clerk wrote them.
   */
  append(bodies: readonly FactBody[], base: number, authors: readonly string[]): Promise<Fact[]> {
    return this.#write(bodies as readonly Fact[], base, authors);
  }

  #write(bodies: readonly (FactBody | Fact)[], base: number, authors: readonly string[] | null): Promise<Fact[]> {
    return this.#serial(async () => {
      if (bodies.length === 0) return [];
      if (!Number.isInteger(base) || base < 0 || base > this.#facts.length) throw new Conflict('Your copy of the log is out of date');
      const touched = new Set(bodies.map((b) => trialOf(b as Fact)).filter((x): x is string => x !== null));
      const movesClock = bodies.some((b) => b.type === 'clock');
      for (let i = base; i < this.#facts.length; i++) {
        const f = this.#facts[i]!;
        const t = trialOf(f);
        if (f.type === 'clock' || movesClock || (t !== null && touched.has(t))) throw new Conflict('Someone else updated this case first');
      }
      if (this.#facts.length + bodies.length > this.#o.maxFacts) throw new RoomFull('This court server’s Versus log is full.');
      if (bodies.some((b) => b.type === 'open') && this.#world.cases().length >= this.#o.maxCases) throw new RoomFull('This court server has as many Versus cases as it can hold.');

      const w = this.#world;
      const at = Math.max(w.lastAt, w.now, this.#o.clock() + w.skew);
      let seq = w.lastSeq;
      const facts: Fact[] = bodies.map((b, i) => {
        const { seq: _s, at: _a, by: _b, ...body } = b as Fact;
        return { ...body, seq: ++seq, at, by: authors ? authors[i]! : 'clerk' } as Fact;
      });
      for (const f of facts) {
        const r = await w.apply(f);
        if (!r.ok) {
          // The live world took part of the batch: rebuild it from the log, which is unchanged.
          this.#world = await World.replay(this.#facts);
          throw new Rejected(r.message);
        }
      }
      for (const f of facts) this.#o.log.append(f);
      this.#facts = [...this.#facts, ...facts];
      this.#o.onChange?.();
      return facts;
    });
  }

  /* ── views ─────────────────────────────────────────────────────────── */

  #levels(viewer: Viewer): Map<string, ReturnType<typeof levelOf>> {
    const m = new Map<string, ReturnType<typeof levelOf>>();
    for (const c of this.#world.cases()) m.set(c.trialId, levelOf(c, viewer));
    return m;
  }

  /** Fingerprint of what this viewer may see. */
  epoch(viewer: Viewer): string {
    const parts = [...this.#levels(viewer)].map(([t, l]) => `${t}:${l}`).sort();
    return createHash('sha256').update(parts.join('|')).digest('base64url').slice(0, 16);
  }

  /** Facts as this viewer may see them (e.g. the ones it just wrote). */
  redact(viewer: Viewer, facts: readonly Fact[]): Fact[] {
    const levels = this.#levels(viewer);
    return facts.map((f) => {
      const t = trialOf(f);
      return t === null ? f : redactFact(f, levels.get(t) ?? 'none');
    });
  }

  view(viewer: Viewer, since: number, epoch: string | null): VersusLogResponse {
    const levels = this.#levels(viewer);
    const current = this.epoch(viewer);
    const reset = epoch !== current || !Number.isInteger(since) || since < 0 || since > this.#facts.length;
    const from = reset ? 0 : since;
    const facts = this.#facts.slice(from).map((f) => {
      const t = trialOf(f);
      return t === null ? f : redactFact(f, levels.get(t) ?? 'none');
    });
    return { epoch: current, reset, from, facts, length: this.#facts.length };
  }

  /* ── the clerk ─────────────────────────────────────────────────────── */

  /** Does any case need the court's own hand right now? */
  #needsClerk(): boolean {
    for (const c of this.#world.cases()) {
      const s = c.state;
      if (s.stage === 'counsel' && s.step === 'drafting') return true;
      if (s.stage === 'jury' && s.step === 'finalizing') return true;
      if (s.stage === 'jury' && (s.step === 'commit' || s.step === 'reveal') && c.demoJurors.size > 0) return true;
      if ((s.stage === 'verdict' || s.stage === 'share') && s.sentence === null) return true;
    }
    return false;
  }

  /** One clerk round. Time-driven phases advance first, exactly as a replay would see them. */
  async tick(): Promise<void> {
    if (this.#ticking) return;
    this.#ticking = true;
    try {
      await this.#serial(() => this.#world.advanceTo(this.#o.clock() + this.#world.skew));
      if (this.#needsClerk()) await this.clerk.tick({ counsel: true });
    } finally {
      this.#ticking = false;
    }
  }

  /** Wait for any counsel draft the clerk started (tests). */
  async settle(): Promise<void> {
    await this.#queue;
  }

  static clerkViewer(): Viewer {
    return CLERK;
  }
}

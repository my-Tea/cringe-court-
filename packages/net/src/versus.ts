/**
 * RemoteFactStore: the Versus case room's FactStore over the court server.
 *
 * The server holds the one true fact log and validates every append by
 * replaying it through the same `World` rules the clients run. Each device gets
 * the log *as that viewer may see it*: the other side's private notes and angle
 * are stripped, and cases the viewer has no part in are sealed (docs/BACKEND.md,
 * "Redaction across the wire"). Redaction keeps every fact in place and every
 * rule satisfied, so the client replays its copy deterministically.
 *
 * `read()` stays synchronous (a local copy kept fresh by live events); `append`
 * is the async half of the FactStore port. A conflict on the same case resolves
 * to `false` after a fresh pull, so the desk's optimistic loop simply retries.
 */
import { VersusDesk, type Fact, type FactStore, type InviteCode, type Unsubscribe, type VersusCase, type VersusDeskOptions } from '@cringe-court/modes-versus';
import { API, type VersusAccessResponse, type VersusAppendResponse, type VersusInviteResponse, type VersusLogResponse } from './protocol';
import { BackendError, type CourtConnection } from './transport';

export class RemoteFactStore implements FactStore {
  readonly #c: CourtConnection;
  #facts: Fact[] = [];
  #epoch: string | null = null;
  readonly #listeners = new Set<() => void>();
  #pulling: Promise<void> | null = null;
  #again = false;
  readonly #off: (() => void)[];
  #ready: Promise<void> | null = null;

  constructor(connection: CourtConnection) {
    this.#c = connection;
    this.#off = [
      connection.on('versus', (e) => {
        if (e.length !== this.#facts.length || e.epoch !== this.#epoch) void this.pull().catch(() => undefined);
      }),
      connection.onResync(() => void this.pull().catch(() => undefined)),
    ];
  }

  /** Resolves after the first successful read of the log. Rejects with a BackendError. */
  ready(): Promise<void> {
    this.#ready ??= this.pull().catch((err: unknown) => {
      this.#ready = null;
      throw err;
    });
    return this.#ready;
  }

  read(): readonly Fact[] {
    return this.#facts;
  }

  get epoch(): string | null {
    return this.#epoch;
  }

  /** Fetch what changed since our copy. Concurrent calls coalesce into one follow-up. */
  pull(): Promise<void> {
    if (this.#pulling) {
      this.#again = true;
      return this.#pulling;
    }
    this.#pulling = (async () => {
      try {
        do {
          this.#again = false;
          await this.#pullOnce();
        } while (this.#again);
      } finally {
        this.#pulling = null;
      }
    })();
    return this.#pulling;
  }

  async #pullOnce(): Promise<void> {
    const since = this.#epoch === null ? 0 : this.#facts.length;
    const q = `since=${since}${this.#epoch ? `&epoch=${encodeURIComponent(this.#epoch)}` : ''}`;
    const res = await this.#c.get<VersusLogResponse>(`${API}/versus/log?${q}`);
    let changed = false;
    if (res.reset || this.#epoch === null) {
      changed = res.reset || res.facts.length > 0 || this.#facts.length > 0;
      this.#facts = res.facts;
    } else if (res.from === this.#facts.length) {
      if (res.facts.length) {
        this.#facts = [...this.#facts, ...res.facts];
        changed = true;
      }
    } else {
      // Our copy and the server's disagree on where we are: take the whole log again.
      this.#epoch = null;
      this.#again = true;
      return;
    }
    this.#epoch = res.epoch;
    if (changed) this.#emit();
  }

  async append(facts: readonly Fact[], expectedLength: number): Promise<boolean> {
    let res: VersusAppendResponse;
    try {
      res = await this.#c.post<VersusAppendResponse>(`${API}/versus/facts`, { facts, base: expectedLength });
    } catch (err) {
      if (err instanceof BackendError && err.code === 'conflict') {
        await this.pull();
        return false;
      }
      throw err;
    }
    if (res.epoch === this.#epoch && this.#facts.length === res.length - res.accepted.length) {
      this.#facts = [...this.#facts, ...res.accepted];
      this.#emit();
    } else {
      await this.pull();
    }
    return true;
  }

  subscribe(listener: () => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Open an invite on this device: the code (or a signed link token) grants
   * this session a view of the case. Resolves to the trial id, or null if no
   * case has that code.
   */
  async openInvite(code: string, token?: string): Promise<string | null> {
    try {
      const r = await this.#c.post<VersusAccessResponse>(`${API}/versus/access`, token ? { code, token } : { code });
      await this.pull();
      return r.trialId;
    } catch (err) {
      if (err instanceof BackendError && err.code === 'not-found') return null;
      throw err;
    }
  }

  /** Side A: the signed invite token to put in the link. */
  invite(trialId: string): Promise<VersusInviteResponse> {
    return this.#c.get<VersusInviteResponse>(`${API}/versus/invite/${encodeURIComponent(trialId)}`);
  }

  close(): void {
    for (const off of this.#off) off();
    this.#listeners.clear();
  }

  #emit(): void {
    for (const fn of [...this.#listeners]) fn();
  }
}

/**
 * The Versus desk on a device of a shared court. Same commands as `VersusDesk`;
 * two differ because the court, not the device, does that work:
 * - opening an invite asks the server for access first (the code is the key);
 * - drafting counsel and the rest of the clerk's housekeeping run on the server,
 *   the only place that sees both sides' private notes. `runCounsel` waits for
 *   the court's draft; `tick` does nothing.
 */
export class RemoteVersusDesk extends VersusDesk {
  readonly remote: RemoteFactStore;

  constructor(options: VersusDeskOptions & { store: RemoteFactStore }) {
    super(options);
    this.remote = options.store;
  }

  override async findByCode(code: InviteCode, token?: string): Promise<VersusCase | undefined> {
    await this.remote.openInvite(code, token);
    return super.findByCode(code);
  }

  /** Wait (up to `timeoutMs`) for the court's clerk to finish drafting this case. */
  override async runCounsel(trialId: string, signal?: AbortSignal, timeoutMs = 30_000): Promise<void> {
    const until = Date.now() + timeoutMs;
    for (;;) {
      const s = (await this.world()).case(trialId)?.state;
      if (s?.stage !== 'counsel' || s.step !== 'drafting') return;
      if (signal?.aborted || Date.now() > until) return;
      await new Promise((r) => setTimeout(r, 100));
      await this.remote.pull();
    }
  }

  override async tick(): Promise<boolean> {
    return false;
  }
}

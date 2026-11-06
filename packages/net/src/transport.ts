/**
 * CourtConnection: one device's link to the court server.
 *
 * - Requests: JSON over HTTP through the wire codec, with a per-device session
 *   token (`Authorization: Bearer …`) and a timeout. Failures become a typed
 *   `BackendError` the UI can explain; nothing is retried behind the user's back.
 * - Clock: every response carries the server's wall clock. The connection keeps
 *   a skew estimate (the sample with the shortest round trip in the last
 *   minute), so countdowns and deadlines follow the server, not this device.
 * - Live updates: Server-Sent Events read through `fetch` (so the token stays in
 *   a header, never in a URL). If the stream cannot be held open, the connection
 *   falls back to polling and keeps trying the stream in the background.
 */
import { decodeWire, encodeWire } from './codec';
import { API, TIME_HEADER, type ErrorBody, type ErrorCode, type ServerEvents } from './protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'polling' | 'offline';

export type BackendErrorCode = ErrorCode | 'unreachable' | 'timeout' | 'bad-response';

export class BackendError extends Error {
  constructor(
    readonly code: BackendErrorCode,
    message: string,
    readonly status = 0,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export interface ConnectionOptions {
  /** Server origin, e.g. `http://localhost:8787` (no trailing slash needed). */
  baseUrl: string;
  token?: string | null;
  fetch?: typeof fetch;
  /** Device wall clock in ms (tests skew it). */
  now?: () => number;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Poll interval when the live stream is unavailable. */
  pollMs?: number;
  /** Stream attempts that may fail in a row before falling back to polling. */
  streamAttempts?: number;
}

type Listener<T> = (payload: T) => void;

interface ClockSample {
  offset: number;
  rtt: number;
  at: number;
}

const SAMPLE_WINDOW_MS = 60_000;

export class CourtConnection {
  readonly baseUrl: string;
  #token: string | null;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  readonly #pollMs: number;
  readonly #streamAttempts: number;
  #samples: ClockSample[] = [];
  #offset = 0;
  #status: ConnectionStatus = 'idle';
  readonly #statusListeners = new Set<Listener<ConnectionStatus>>();
  readonly #events = new Map<keyof ServerEvents, Set<Listener<unknown>>>();
  readonly #resync = new Set<() => void>();
  #abort: AbortController | null = null;
  #pollTimer: ReturnType<typeof setInterval> | null = null;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #failures = 0;
  #running = false;

  constructor(o: ConnectionOptions) {
    this.baseUrl = o.baseUrl.replace(/\/+$/, '');
    this.#token = o.token ?? null;
    this.#fetch = o.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
    this.#now = o.now ?? (() => Date.now());
    this.#timeoutMs = o.timeoutMs ?? 10_000;
    this.#pollMs = o.pollMs ?? 2_000;
    this.#streamAttempts = o.streamAttempts ?? 3;
  }

  get token(): string | null {
    return this.#token;
  }

  setToken(token: string | null): void {
    this.#token = token;
  }

  /* ── clock ──────────────────────────────────────────────────────────── */

  /** Server wall clock estimate, ms. */
  serverNowMs(): number {
    return this.#now() + this.#offset;
  }

  /** Server wall clock estimate, unix seconds. */
  serverNow(): number {
    return Math.floor(this.serverNowMs() / 1000);
  }

  /** How far this device's clock is behind the server (ms; negative = ahead). */
  get skewMs(): number {
    return this.#offset;
  }

  #sample(serverMs: number, sentAt: number, receivedAt: number): void {
    if (!Number.isFinite(serverMs)) return;
    const rtt = Math.max(0, receivedAt - sentAt);
    const offset = serverMs - (sentAt + receivedAt) / 2;
    this.#samples = [...this.#samples.filter((s) => receivedAt - s.at < SAMPLE_WINDOW_MS), { offset, rtt, at: receivedAt }].slice(-16);
    let best = this.#samples[0]!;
    for (const s of this.#samples) if (s.rtt <= best.rtt) best = s;
    this.#offset = best.offset;
  }

  /* ── requests ───────────────────────────────────────────────────────── */

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', path, undefined, signal);
  }

  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('POST', path, body ?? {}, signal);
  }

  async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.#token) headers.Authorization = `Bearer ${this.#token}`;
    const sentAt = this.#now();
    let res: Response;
    try {
      res = await this.#fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: encodeWire(body) } : {}),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) throw new BackendError('timeout', 'Request cancelled');
      const timedOut = controller.signal.aborted;
      if (this.#status !== 'idle') this.#setStatus('offline');
      throw new BackendError(timedOut ? 'timeout' : 'unreachable', timedOut ? 'The court server took too long to answer.' : 'Could not reach the court server.', 0);
    }
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    this.#sample(Number(res.headers.get(TIME_HEADER)), sentAt, this.#now());
    if (this.#status === 'offline') this.#setStatus(this.#abort ? 'connecting' : 'polling');
    let text: string;
    try {
      text = await res.text();
    } catch {
      throw new BackendError('unreachable', 'The connection dropped mid-answer.', res.status);
    }
    if (!res.ok) {
      let parsed: ErrorBody | null = null;
      try {
        parsed = decodeWire<ErrorBody>(text);
      } catch {
        /* not JSON */
      }
      const e = parsed?.error;
      const fallback: ErrorCode = res.status === 401 ? 'unauthorized' : res.status === 404 ? 'not-found' : res.status === 429 ? 'rate-limited' : res.status === 409 ? 'conflict' : 'server';
      throw new BackendError(e?.code ?? fallback, e?.message ?? `The court server answered ${res.status}.`, res.status, e?.retryAfter);
    }
    try {
      return decodeWire<T>(text);
    } catch {
      throw new BackendError('bad-response', 'The court server sent something this app cannot read.', res.status);
    }
  }

  /* ── live events ────────────────────────────────────────────────────── */

  get status(): ConnectionStatus {
    return this.#status;
  }

  onStatus(fn: Listener<ConnectionStatus>): () => void {
    this.#statusListeners.add(fn);
    return () => this.#statusListeners.delete(fn);
  }

  on<K extends keyof ServerEvents>(event: K, fn: Listener<ServerEvents[K]>): () => void {
    let set = this.#events.get(event);
    if (!set) this.#events.set(event, (set = new Set()));
    set.add(fn as Listener<unknown>);
    return () => set.delete(fn as Listener<unknown>);
  }

  /**
   * Called whenever the client may have missed events: on every (re)connect of
   * the live stream and on every poll tick while polling. Adapters pull here.
   */
  onResync(fn: () => void): () => void {
    this.#resync.add(fn);
    return () => this.#resync.delete(fn);
  }

  /** Open the live stream (idempotent). */
  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#failures = 0;
    void this.#openStream();
  }

  stop(): void {
    this.#running = false;
    this.#abort?.abort();
    this.#abort = null;
    if (this.#pollTimer) clearInterval(this.#pollTimer);
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#pollTimer = null;
    this.#retryTimer = null;
    this.#setStatus('idle');
  }

  #setStatus(s: ConnectionStatus): void {
    if (s === this.#status) return;
    this.#status = s;
    for (const fn of [...this.#statusListeners]) fn(s);
  }

  #emit(event: string, data: unknown): void {
    const set = this.#events.get(event as keyof ServerEvents);
    if (set) for (const fn of [...set]) fn(data);
  }

  #resyncAll(): void {
    for (const fn of [...this.#resync]) fn();
  }

  #startPolling(): void {
    if (this.#pollTimer) return;
    this.#setStatus('polling');
    this.#pollTimer = setInterval(() => this.#resyncAll(), this.#pollMs);
    this.#resyncAll();
  }

  #stopPolling(): void {
    if (this.#pollTimer) clearInterval(this.#pollTimer);
    this.#pollTimer = null;
  }

  #scheduleRetry(): void {
    if (!this.#running) return;
    this.#failures++;
    if (this.#failures >= this.#streamAttempts) this.#startPolling();
    else if (this.#status !== 'polling') this.#setStatus('connecting');
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.#failures - 1, 5));
    this.#retryTimer = setTimeout(() => void this.#openStream(), delay);
  }

  async #openStream(): Promise<void> {
    if (!this.#running) return;
    const controller = new AbortController();
    this.#abort = controller;
    if (this.#status !== 'polling') this.#setStatus('connecting');
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (this.#token) headers.Authorization = `Bearer ${this.#token}`;
    let res: Response;
    try {
      res = await this.#fetch(`${this.baseUrl}${API}/events`, { headers, signal: controller.signal });
    } catch {
      if (controller.signal.aborted && !this.#running) return;
      this.#scheduleRetry();
      return;
    }
    if (!res.ok || !res.body) {
      this.#scheduleRetry();
      return;
    }
    this.#failures = 0;
    this.#stopPolling();
    this.#setStatus('live');
    this.#resyncAll();
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let cut: number;
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          this.#dispatchBlock(block);
        }
      }
    } catch {
      /* dropped: reconnect below */
    }
    if (!this.#running || controller.signal.aborted) return;
    this.#scheduleRetry();
  }

  #dispatchBlock(block: string): void {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    try {
      const payload = decodeWire<Record<string, unknown>>(data);
      if (event === 'hello' && typeof payload.serverTime === 'number') {
        const t = this.#now();
        // One-way: only trust it while there is no better (round-trip) sample.
        if (this.#samples.length === 0) this.#sample(payload.serverTime, t, t);
      }
      this.#emit(event, payload);
    } catch {
      /* ignore a malformed event */
    }
  }
}

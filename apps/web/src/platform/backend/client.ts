/**
 * The app's link to the shared court server (opt-in with VITE_BACKEND_URL).
 *
 * - Sessions: one per "person" on this device. Each is a random bearer token the
 *   server issued, kept in localStorage per server, so a refresh or a closed tab
 *   resumes where it was. Like the local demo, each tab can be a different
 *   person (the current one is remembered per tab in sessionStorage).
 * - Status: a tiny external store the UI subscribes to (connecting, ready,
 *   error; live, polling or offline once ready).
 * - Choosing the local demo is explicit and remembered on this device; nothing
 *   ever falls back to it silently.
 */
import type { Hex } from '@cringe-court/core';
import { BackendError, CourtConnection, RemoteFactStore, type ConnectionStatus, type Features, type MeResponse, type PersonaInfo, type SessionResponse } from '@cringe-court/net';
import type { BackendConfig } from '../config';

const SESSIONS = 'cc:backend:sessions';
const CURRENT = 'cc:backend:session';
const MODE = 'cc:backend:mode';

export interface StoredSession {
  token: string;
  persona: PersonaInfo;
}

export type BackendPhase =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'ready'; link: ConnectionStatus; features: Features; persona: PersonaInfo; notice: 'new-session' | null }
  | { phase: 'error'; error: BackendError };

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const validSession = (s: unknown): s is StoredSession => {
  const x = s as StoredSession | null;
  return !!x && typeof x.token === 'string' && !!x.persona && typeof x.persona.id === 'string' && /^0x[0-9a-f]{40}$/.test(x.persona.account);
};

export class BackendClient {
  readonly url: string;
  readonly connection: CourtConnection;
  #state: BackendPhase = { phase: 'idle' };
  readonly #listeners = new Set<() => void>();
  #session: StoredSession | null = null;
  #connecting: Promise<void> | null = null;
  #store: RemoteFactStore | null = null;
  readonly #local: Storage;
  readonly #tab: Storage;

  constructor(config: BackendConfig, o: { fetch?: typeof fetch; local?: Storage; tab?: Storage } = {}) {
    this.url = config.url;
    this.#local = o.local ?? window.localStorage;
    this.#tab = o.tab ?? window.sessionStorage;
    this.connection = new CourtConnection({ baseUrl: config.url, ...(o.fetch ? { fetch: o.fetch } : {}) });
    this.connection.onStatus((link) => {
      if (this.#state.phase === 'ready') this.#set({ ...this.#state, link });
    });
    // The server was reset and forgot this device: reconnect, which starts a fresh session and says so.
    this.connection.onUnauthorized(() => {
      if (this.#state.phase !== 'ready') return;
      this.connection.stop();
      this.#store?.close();
      this.#store = null;
      this.#state = { phase: 'idle' };
      void this.connect();
    });
  }

  /** The server's host, for copy ("court.example.org"). */
  get host(): string {
    try {
      return new URL(this.url).host;
    } catch {
      return this.url;
    }
  }

  /* ── status store (useSyncExternalStore) ──────────────────────────── */

  subscribe = (fn: () => void): (() => void) => {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  };

  getSnapshot = (): BackendPhase => this.#state;

  #set(s: BackendPhase): void {
    this.#state = s;
    for (const fn of [...this.#listeners]) fn();
  }

  dismissNotice(): void {
    if (this.#state.phase === 'ready' && this.#state.notice) this.#set({ ...this.#state, notice: null });
  }

  /* ── sessions ─────────────────────────────────────────────────────── */

  #key(): string {
    return `${SESSIONS}:${this.url}`;
  }

  /** Every person this device has been on this server, oldest first. */
  sessions(): StoredSession[] {
    const list = readJson<unknown[]>(this.#local, this.#key(), []);
    return Array.isArray(list) ? list.filter(validSession) : [];
  }

  #save(list: readonly StoredSession[]): void {
    try {
      this.#local.setItem(this.#key(), JSON.stringify(list));
    } catch {
      /* private mode: the session lasts as long as the tab */
    }
  }

  get session(): StoredSession | null {
    return this.#session;
  }

  async #create(): Promise<StoredSession> {
    const prev = this.connection.token;
    this.connection.setToken(null);
    try {
      const r = await this.connection.post<SessionResponse>('/api/v1/sessions');
      const s: StoredSession = { token: r.token, persona: r.persona };
      this.#save([...this.sessions(), s]);
      this.connection.setToken(r.token);
      return s;
    } catch (err) {
      this.connection.setToken(prev);
      throw err;
    }
  }

  #use(s: StoredSession): void {
    this.#session = s;
    this.connection.setToken(s.token);
    try {
      this.#tab.setItem(CURRENT, s.persona.id);
    } catch {
      /* ignore */
    }
  }

  /** Connect: resume this tab's (or the device's latest) session, or start one. Idempotent. */
  connect(): Promise<void> {
    if (this.#state.phase === 'ready') return Promise.resolve();
    this.#connecting ??= this.#connect().finally(() => {
      this.#connecting = null;
    });
    return this.#connecting;
  }

  async #connect(): Promise<void> {
    this.#set({ phase: 'connecting' });
    try {
      const list = this.sessions();
      const wanted = this.#tab.getItem(CURRENT);
      let s = list.find((x) => x.persona.id === wanted) ?? list[list.length - 1] ?? null;
      let notice: 'new-session' | null = null;
      let features: Features;
      if (s) {
        this.connection.setToken(s.token);
        try {
          features = (await this.connection.get<MeResponse>('/api/v1/sessions/me')).features;
        } catch (err) {
          if (!(err instanceof BackendError && err.code === 'unauthorized')) throw err;
          // The server no longer knows this token (it was reset): start fresh, and say so.
          this.#save(list.filter((x) => x.token !== s!.token));
          s = await this.#create();
          notice = 'new-session';
          features = (await this.connection.get<MeResponse>('/api/v1/sessions/me')).features;
        }
      } else {
        s = await this.#create();
        features = (await this.connection.get<MeResponse>('/api/v1/sessions/me')).features;
      }
      this.#use(s);
      this.connection.start();
      this.#set({ phase: 'ready', link: this.connection.status, features, persona: s.persona, notice });
    } catch (err) {
      this.connection.stop();
      this.#set({ phase: 'error', error: err instanceof BackendError ? err : new BackendError('unreachable', String(err)) });
    }
  }

  /** Switch this tab to another person on this device. */
  switchTo(personaId: string): PersonaInfo | null {
    const s = this.sessions().find((x) => x.persona.id === personaId);
    if (!s || this.#state.phase !== 'ready') return null;
    this.connection.stop();
    this.#use(s);
    this.connection.start();
    this.#store?.close();
    this.#store = null;
    this.#set({ ...this.#state, persona: s.persona, notice: null });
    return s.persona;
  }

  /** A new person on this device (a second phone, without the phone). */
  async newPerson(): Promise<PersonaInfo> {
    const s = await this.#create();
    return this.switchTo(s.persona.id) ?? s.persona;
  }

  /** The Versus log as this tab's person sees it. One store per person. */
  versusStore(): RemoteFactStore {
    this.#store ??= new RemoteFactStore(this.connection);
    return this.#store;
  }

  get account(): Hex | null {
    return this.#session?.persona.account ?? null;
  }
}

/* ── local-demo choice ─────────────────────────────────────────────────── */

/** Has this device chosen the local demo over the configured court server? */
export function prefersLocal(storage: Storage = window.localStorage): boolean {
  try {
    return storage.getItem(MODE) === 'local';
  } catch {
    return false;
  }
}

export function setPrefersLocal(local: boolean, storage: Storage = window.localStorage): void {
  try {
    if (local) storage.setItem(MODE, 'local');
    else storage.removeItem(MODE);
  } catch {
    /* ignore */
  }
}

let shared: BackendClient | null = null;

/** The app-wide client for a config (one connection per page). */
export function backendClient(config: BackendConfig): BackendClient {
  if (!shared || shared.url !== config.url) shared = new BackendClient(config);
  return shared;
}

/** Test hook. */
export function __resetBackendClient(): void {
  shared?.connection.stop();
  shared = null;
}

/**
 * Where the fact log lives. The room is a port: the app picks an adapter at
 * startup. This package ships the in-memory store (tests, single-tab demo) and
 * the JSON codec every adapter uses; the web app adds a localStorage +
 * BroadcastChannel store so two browser tabs can be the two sides.
 *
 * The networked adapter (`RemoteFactStore` in `@cringe-court/net`, served by
 * `apps/server`) implements the same three methods. Its `append` is async, and
 * the server keeps each side's private notes away from the other side's device
 * by redacting the log per viewer (docs/BACKEND.md).
 */
import type { Fact } from './world';

export type Unsubscribe = () => void;

export interface FactStore {
  read(): readonly Fact[];
  /**
   * Append facts if the log still has `expectedLength` entries (optimistic
   * concurrency). Returns false if someone else wrote first; the caller rebuilds
   * and retries. A networked store answers asynchronously, and throws when the
   * court refuses the facts (with the court's message).
   */
  append(facts: readonly Fact[], expectedLength: number): boolean | Promise<boolean>;
  subscribe(listener: () => void): Unsubscribe;
}

export class MemoryFactStore implements FactStore {
  #facts: Fact[] = [];
  readonly #listeners = new Set<() => void>();

  constructor(initial: readonly Fact[] = []) {
    this.#facts = [...initial];
  }

  read(): readonly Fact[] {
    return this.#facts;
  }

  append(facts: readonly Fact[], expectedLength: number): boolean {
    if (this.#facts.length !== expectedLength) return false;
    this.#facts = [...this.#facts, ...facts];
    this.#listeners.forEach((fn) => fn());
    return true;
  }

  subscribe(listener: () => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

/* ── JSON codec (bigint-safe) ─────────────────────────────────────────── */

const BIG = '$big';

export function encodeFacts(facts: readonly Fact[]): string {
  return JSON.stringify(facts, (_k, v: unknown) => (typeof v === 'bigint' ? { [BIG]: v.toString() } : v));
}

export function decodeFacts(json: string): Fact[] {
  const parsed: unknown = JSON.parse(json, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 1 && keys[0] === BIG && typeof o[BIG] === 'string') return BigInt(o[BIG] as string);
    }
    return v;
  });
  if (!Array.isArray(parsed)) throw new SyntaxError('Not a fact log');
  return parsed as Fact[];
}

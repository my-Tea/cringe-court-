/**
 * Where the fact log lives. The room is a port: the app picks an adapter at
 * startup. This package ships the in-memory store (tests, single-tab demo) and
 * the JSON codec every adapter uses; the web app adds a localStorage +
 * BroadcastChannel store so two browser tabs can be the two sides.
 *
 * A networked adapter (relay server, or a contract event log) implements the
 * same three methods. It must keep each side's private notes away from the other
 * side's device, which the browser-local demo store cannot (both sides share one
 * browser there); see docs in the PR.
 */
import type { Fact } from './world';

export type Unsubscribe = () => void;

export interface FactStore {
  read(): readonly Fact[];
  /**
   * Append facts if the log still has `expectedLength` entries (optimistic
   * concurrency). Returns false if someone else wrote first; the caller rebuilds
   * and retries.
   */
  append(facts: readonly Fact[], expectedLength: number): boolean;
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

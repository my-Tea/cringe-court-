/**
 * The demo case room: the fact log in localStorage, change notifications over
 * BroadcastChannel (and the `storage` event as a fallback). Every tab of this
 * browser shares one court, so two tabs can be Side A and Side B, and a third
 * can sit on the jury.
 *
 * Honest limits (stated in the UI): this is one device's court. Both sides'
 * private notes live in this browser's storage, which is fine for a same-device
 * demo and wrong for real use; a networked FactStore must keep them apart.
 */
import { decodeFacts, encodeFacts, type Fact, type FactStore } from '@cringe-court/modes-versus';

export const LOG_KEY = 'cc:versus:log';
const CHANNEL = 'cc-versus';

export class LocalFactStore implements FactStore {
  readonly #storage: Storage;
  readonly #listeners = new Set<() => void>();
  readonly #channel: BroadcastChannel | null;
  #cache: { raw: string | null; facts: Fact[] } = { raw: null, facts: [] };
  readonly #onStorage = (e: StorageEvent) => {
    if (e.key === LOG_KEY) this.#emit();
  };

  constructor(storage: Storage = window.localStorage) {
    this.#storage = storage;
    this.#channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
    if (this.#channel) this.#channel.onmessage = () => this.#emit();
    window.addEventListener('storage', this.#onStorage);
  }

  read(): readonly Fact[] {
    const raw = this.#storage.getItem(LOG_KEY);
    if (raw !== this.#cache.raw) {
      let facts: Fact[] = [];
      try {
        facts = raw ? decodeFacts(raw) : [];
      } catch {
        throw new Error('The demo court record on this device is damaged. Reset the demo court to start again.');
      }
      this.#cache = { raw, facts };
    }
    return this.#cache.facts;
  }

  append(facts: readonly Fact[], expectedLength: number): boolean {
    const current = this.read();
    if (current.length !== expectedLength) return false;
    const next = [...current, ...facts];
    try {
      this.#storage.setItem(LOG_KEY, encodeFacts(next));
    } catch {
      throw new Error('This browser is out of storage for the demo court. Reset the demo court to free space.');
    }
    this.#channel?.postMessage({ length: next.length });
    this.#emit();
    return true;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Wipe the demo court on this device (every tab). */
  reset(): void {
    this.#storage.removeItem(LOG_KEY);
    this.#channel?.postMessage({ length: 0 });
    this.#emit();
  }

  close(): void {
    this.#channel?.close();
    window.removeEventListener('storage', this.#onStorage);
  }

  #emit(): void {
    this.#listeners.forEach((fn) => fn());
  }
}

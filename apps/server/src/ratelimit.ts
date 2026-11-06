/**
 * Token buckets keyed by session or address. Small, in memory, per process
 * (the server is single-node by design; see docs/BACKEND.md, "Limits").
 */
export interface BucketSpec {
  /** Most requests in a burst. */
  capacity: number;
  /** Tokens added per second. */
  refill: number;
}

interface Bucket {
  tokens: number;
  at: number;
}

export class RateLimiter {
  readonly #buckets = new Map<string, Bucket>();

  constructor(
    readonly spec: BucketSpec,
    private readonly now: () => number = () => Date.now(),
    private readonly maxKeys = 20_000,
  ) {}

  /** Take `cost` tokens. Returns 0 if allowed, else the seconds to wait. */
  take(key: string, cost = 1): number {
    const t = this.now();
    let b = this.#buckets.get(key);
    if (!b) {
      if (this.#buckets.size >= this.maxKeys) this.#sweep(t);
      b = { tokens: this.spec.capacity, at: t };
      this.#buckets.set(key, b);
    }
    b.tokens = Math.min(this.spec.capacity, b.tokens + ((t - b.at) / 1000) * this.spec.refill);
    b.at = t;
    if (b.tokens >= cost) {
      b.tokens -= cost;
      return 0;
    }
    return Math.max(1, Math.ceil((cost - b.tokens) / this.spec.refill));
  }

  #sweep(t: number): void {
    for (const [k, b] of this.#buckets) {
      if (b.tokens + ((t - b.at) / 1000) * this.spec.refill >= this.spec.capacity) this.#buckets.delete(k);
    }
    // Still full of active keys: drop the oldest half rather than grow without bound.
    if (this.#buckets.size >= this.maxKeys) {
      const keys = [...this.#buckets.keys()];
      for (const k of keys.slice(0, keys.length / 2)) this.#buckets.delete(k);
    }
  }
}

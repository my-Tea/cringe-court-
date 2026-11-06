/**
 * D3 free teaser limits: 1 teaser a day per device without sign-in, 3 a day per
 * signed-in account. Enforced in the app layer (teasers never touch contracts).
 * Days are UTC.
 */
export interface QuotaStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const TEASERS_PER_DAY = { device: 1, account: 3 } as const;

export interface TeaserAllowance {
  limit: number;
  used: number;
  remaining: number;
  /** Unix seconds when the allowance resets (next UTC midnight). */
  resetsAt: number;
}

const dayOf = (now: number) => Math.floor(now / 86_400);

export class TeaserQuota {
  constructor(
    private readonly store: QuotaStore,
    private readonly now: () => number,
  ) {}

  #key(account: string | null): string {
    return `cc:solo:teasers:${account ? account.toLowerCase() : 'device'}`;
  }

  #read(account: string | null): { day: number; used: number } {
    try {
      const raw = this.store.get(this.#key(account));
      const parsed = raw ? (JSON.parse(raw) as { day?: unknown; used?: unknown }) : null;
      if (parsed && typeof parsed.day === 'number' && typeof parsed.used === 'number' && parsed.day === dayOf(this.now())) {
        return { day: parsed.day, used: parsed.used };
      }
    } catch {
      // Corrupt entry: treat as unused.
    }
    return { day: dayOf(this.now()), used: 0 };
  }

  allowance(account: string | null): TeaserAllowance {
    const limit = account ? TEASERS_PER_DAY.account : TEASERS_PER_DAY.device;
    const { day, used } = this.#read(account);
    return { limit, used, remaining: Math.max(0, limit - used), resetsAt: (day + 1) * 86_400 };
  }

  /** Spend one teaser. Returns false (and spends nothing) when none are left. */
  consume(account: string | null): boolean {
    const a = this.allowance(account);
    if (a.remaining <= 0) return false;
    const { day, used } = this.#read(account);
    this.store.set(this.#key(account), JSON.stringify({ day, used: used + 1 }));
    return true;
  }
}

/** In-memory store, for tests and private-mode browsers. */
export function memoryQuotaStore(): QuotaStore {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}

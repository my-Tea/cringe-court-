/**
 * JSON for snapshots. Money is bigint (exact micro-USDC), which JSON cannot
 * carry, so bigints round-trip as {"$big": "1200000"}.
 */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? { $big: v.toString() } : v));
}

export function fromJson<T>(text: string): T {
  return JSON.parse(text, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === '$big' && typeof (v as { $big: unknown }).$big === 'string') return BigInt((v as { $big: string }).$big);
    }
    return v;
  }) as T;
}

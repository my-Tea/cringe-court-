/**
 * The wire codec. Court state is full of bigints (USDC in micro-units) and a
 * few Maps, which plain JSON drops or throws on. Both ends of the wire use this
 * codec, so a value survives the trip exactly:
 *
 *   bigint      → { "$big": "1500000" }
 *   Map<K, V>   → { "$map": [[k, v], …] }
 *
 * Decoding is defensive: prototype-polluting keys are dropped, and a tagged
 * object only decodes when it has exactly its one tag key with the right type.
 */
const BIG = '$big';
const MAP = '$map';
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

export function encodeWire(value: unknown): string {
  return JSON.stringify(value, (_key: string, v: unknown) => {
    if (typeof v === 'bigint') return { [BIG]: v.toString() };
    if (v instanceof Map) return { [MAP]: [...v.entries()] };
    return v;
  });
}

export function decodeWire<T = unknown>(text: string): T {
  return JSON.parse(text, (key: string, v: unknown) => {
    if (FORBIDDEN.has(key)) return undefined;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 1) {
        if (keys[0] === BIG && typeof o[BIG] === 'string' && /^-?\d{1,78}$/.test(o[BIG] as string)) return BigInt(o[BIG] as string);
        if (keys[0] === MAP && Array.isArray(o[MAP])) {
          const entries = (o[MAP] as unknown[]).filter((e): e is [unknown, unknown] => Array.isArray(e) && e.length === 2);
          return new Map(entries);
        }
      }
    }
    return v;
  }) as T;
}

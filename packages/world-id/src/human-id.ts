import { createHmac } from 'node:crypto';

/** Field elements are < 2^256; reject anything larger. */
const MAX = (1n << 256n) - 1n;

/**
 * Canonical nullifier -> bigint. Accepts bigint, decimal ("123"), hex ("0x..."),
 * and the idkit-server canonical form "nil_" + 64 hex digits.
 * Same number => same result regardless of notation / leading zeros.
 */
export function canonicalNullifier(input: string | bigint): bigint {
  let n: bigint;
  if (typeof input === 'bigint') {
    n = input;
  } else {
    const s = input.trim();
    if (/^0x[0-9a-fA-F]+$/.test(s)) n = BigInt(s);
    else if (/^nil_[0-9a-fA-F]{64}$/.test(s)) n = BigInt('0x' + s.slice(4));
    else if (/^[0-9]+$/.test(s)) n = BigInt(s);
    else throw new TypeError('nullifier must be a decimal, 0x-hex or nil_ string, or a bigint');
  }
  if (n < 0n || n > MAX) throw new RangeError('nullifier out of range');
  return n;
}

function toPepperBytes(pepper: Uint8Array | string): Uint8Array {
  const bytes = typeof pepper === 'string' ? new TextEncoder().encode(pepper) : pepper;
  if (bytes.length < 16) throw new RangeError('pepper must be at least 16 bytes');
  return bytes;
}

/**
 * humanId = HMAC-SHA256(pepper, 32-byte big-endian nullifier), as 0x + 64 hex.
 * Node-only (node:crypto). The pepper is a backend secret; without it the id
 * cannot be linked back to a World ID nullifier.
 */
/** A returning person proves a World session rather than a one-time nullifier. The id stays stable across their visits. */
export function deriveSessionHumanId(sessionId: string, pepper: Uint8Array | string): `0x${string}` {
  return `0x${createHmac('sha256', toPepperBytes(pepper)).update(sessionId).digest('hex')}`;
}

export function deriveHumanId(nullifier: string | bigint, pepper: Uint8Array | string): `0x${string}` {
  const n = canonicalNullifier(nullifier);
  const msg = Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
  const mac = createHmac('sha256', toPepperBytes(pepper)).update(msg).digest('hex');
  return `0x${mac}`;
}

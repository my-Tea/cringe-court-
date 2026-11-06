/**
 * Keccak-256 (the Ethereum variant, not NIST SHA3-256) in plain TypeScript, so
 * core stays dependency-free and the in-memory chain twin computes exactly the
 * commitments and transcript fingerprints a Solidity contract would.
 * Not constant-time; fine for hashing public data and test salts.
 */
import type { Hex } from './case';

const RC: readonly bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROT: readonly number[] = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const MASK = (1n << 64n) - 1n;

function rotl(x: bigint, n: number): bigint {
  if (n === 0) return x;
  const s = BigInt(n);
  return ((x << s) | (x >> (64n - s))) & MASK;
}

function keccakF(state: bigint[]): void {
  const c = new Array<bigint>(5);
  const b = new Array<bigint>(25);
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) c[x] = state[x]! ^ state[x + 5]! ^ state[x + 10]! ^ state[x + 15]! ^ state[x + 20]!;
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5]! ^ rotl(c[(x + 1) % 5]!, 1);
      for (let y = 0; y < 25; y += 5) state[y + x] = state[y + x]! ^ d;
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + ((2 * x + 3 * y) % 5) * 5] = rotl(state[x + y * 5]!, ROT[x + y * 5]!);
      }
    }
    for (let i = 0; i < 25; i++) {
      const x = i % 5;
      const y = i - x;
      state[i] = b[i]! ^ (~b[y + ((x + 1) % 5)]! & MASK & b[y + ((x + 2) % 5)]!);
    }
    state[0] = state[0]! ^ RC[round]!;
  }
}

/** Keccak-256 of raw bytes. */
export function keccak256Bytes(input: Uint8Array): Uint8Array {
  return sponge256(input, 0x01);
}

/** NIST SHA3-256: same permutation, different domain padding. Exported so tests can cross-check against node:crypto. */
export function sha3_256Bytes(input: Uint8Array): Uint8Array {
  return sponge256(input, 0x06);
}

function sponge256(input: Uint8Array, pad: number): Uint8Array {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate);
  padded.set(input);
  padded[input.length] = pad;
  padded[padded.length - 1] = padded[padded.length - 1]! | 0x80;
  const state = new Array<bigint>(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let k = 7; k >= 0; k--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + k]!);
      state[i] = state[i]! ^ lane;
    }
    keccakF(state);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = state[i]!;
    for (let k = 0; k < 8; k++) {
      out[i * 8 + k] = Number(lane & 0xffn);
      lane >>= 8n;
    }
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): Hex {
  let s = '0x';
  for (const byte of bytes) s += byte.toString(16).padStart(2, '0');
  return s as Hex;
}

export function hexToBytes(hex: Hex): Uint8Array {
  const body = hex.slice(2);
  if (body.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(body)) throw new SyntaxError(`Not hex bytes: ${hex}`);
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function isHex(value: string, bytes?: number): value is Hex {
  if (!/^0x[0-9a-fA-F]*$/.test(value)) return false;
  return bytes === undefined || value.length === 2 + bytes * 2;
}

/** Keccak-256 of a UTF-8 string or hex bytes. */
export function keccak256(input: string | Uint8Array): Hex {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return bytesToHex(keccak256Bytes(bytes));
}

/** Left-pad an unsigned integer to a 32-byte word, as `abi.encode` does. */
export function uint256Word(value: bigint | number): Uint8Array {
  let v = BigInt(value);
  if (v < 0n) throw new RangeError('uint256 cannot be negative');
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new RangeError('Value does not fit in uint256');
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Canonical JSON: object keys sorted, no whitespace. Two equal values always
 * serialise identically, so their fingerprints match.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return JSON.stringify(value.toString());
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** Deterministic pseudo-random generator (mulberry32) for fixtures and seeded draws. */
export function seededRandom(seed: string | number): () => number {
  let a = typeof seed === 'number' ? seed >>> 0 : Number.parseInt(keccak256(seed).slice(2, 10), 16);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

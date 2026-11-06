/**
 * Minecraft-style pixel detail: small grayscale tiles (16×16) multiplied over
 * the palette colour, sampled with nearest-neighbour filtering only. Texel size
 * is fixed in world units (TEXEL), so a pew and a wall share one pixel grid.
 *
 * Tiles carry real contrast (bevelled stone bricks, plank seams, wool fuzz,
 * leaf holes) the way a block texture pack does. Pixels may go darker or
 * brighter than the flat colour: `surfaceGain` gives the multiplier a material
 * applies to its colour so the tile's average lands back on the palette swatch.
 * A surface can wear a different tile on its upward faces (marble floor on a
 * stone wall, grass on a hedge), the way a grass block has a top and a side.
 * Pure pixel generation is separate from three.js so it is testable.
 */
import * as THREE from 'three';
import { ART, C } from '../palette';

export type SurfaceKind =
  | 'plain'
  | 'wood'
  | 'stone'
  | 'marble'
  | 'cobble'
  | 'fabric'
  | 'metal'
  | 'glass'
  | 'grass'
  | 'leaves'
  | 'roof';

/** Which faces a tile is for: upward-facing tops, or everything else. */
export type FaceKind = 'side' | 'top';

/** World units per texel (a player stands ≈ 25 texels tall, like Minecraft's 29). */
export const TEXEL = 2;
export const TILE = 16;

/** The tile for a palette colour; `face` lets floors and lawns differ from their walls. */
export function surfaceFor(hex: string, glow = 0, face: FaceKind = 'side'): SurfaceKind {
  if (glow > 0) return 'glass';
  const top = face === 'top';
  switch (hex.toUpperCase()) {
    case C.gold900:
    case C.gold700:
    case C.gold500:
    case C.neutral900:
    case C.neutral700:
      return 'wood';
    case C.neutral100:
    case C.neutral300:
      return top ? 'marble' : 'stone';
    case C.neutral500:
      return top ? 'cobble' : 'stone';
    case C.gold100:
      return 'stone';
    case C.royal700:
    case C.royal900:
      return 'fabric';
    case C.royal500:
      return 'roof';
    case C.gold300:
      return 'metal';
    case C.green900:
    case C.green700:
    case C.green500:
      return top ? 'grass' : 'leaves';
    case C.blue100:
    case C.blue300:
    case C.blue500:
    case C.blue700:
    case ART.windowGlass:
      return 'glass';
    default:
      return 'plain';
  }
}

/** True when this colour wears a different tile on its tops (the batch then splits by face). */
export function hasTopTile(hex: string, glow = 0): boolean {
  return surfaceFor(hex, glow, 'top') !== surfaceFor(hex, glow, 'side');
}

/** Deterministic hash noise in 0..1. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Tileable smooth value noise in 0..1 with period TILE. */
function smooth(x: number, y: number, cell: number, seed: number): number {
  const p = TILE / cell;
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const at = (i: number, j: number) => hash(((i % p) + p) % p, ((j % p) + p) % p, seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

/**
 * Raw tile brightness before normalising (1 = the flat colour; may exceed 1).
 * Each case is one block-texture idea, kept to a few lines.
 */
function texel(kind: SurfaceKind, x: number, y: number): number {
  const seed = kind.length * 7 + kind.charCodeAt(0);
  const n = hash(x, y, seed);
  switch (kind) {
    case 'wood': {
      // Planks 4 texels tall, each its own tone; staggered butt joints, grain dashes, nail heads.
      const row = Math.floor(y / 4);
      const tone = 0.9 + hash(row, 0, seed + 1) * 0.16;
      if (y % 4 === 3) return 0.62;
      const jointAt = (row * 7 + 3) % 16;
      if (x === jointAt) return 0.66;
      if (y % 4 === 0 && (x === (jointAt + 1) % 16 || x === (jointAt + 15) % 16) && row % 2 === 0) return 0.78;
      const grain = Math.sin((x + row * 5) * 0.8 + hash(row, 1, seed) * 6) * 0.05;
      const streak = hash(Math.floor(x / 3), y, seed + 2) > 0.82 ? -0.08 : 0;
      return tone + grain + streak + (y % 4 === 0 ? 0.06 : 0);
    }
    case 'stone': {
      // Stone bricks: two courses of 8, half-offset; bevel lit from the top-left, mortar dark.
      const row = Math.floor(y / 8);
      const bx = (x + (row % 2) * 8) % 16;
      const by = y % 8;
      if (by === 7 || bx === 15) return 0.6;
      if (by === 0 || bx === 0) return 1.14;
      if (by === 6 || bx === 14) return 0.8;
      const blot = smooth(x, y, 4, seed) * 0.12;
      return 0.9 + blot + (n > 0.9 ? -0.08 : 0) + (n < 0.05 ? 0.07 : 0);
    }
    case 'marble': {
      // Polished floor slabs 8×8 with a hairline grout and soft grey veins.
      const g = x % 8 === 0 || y % 8 === 0;
      if (g) return 0.74;
      const check = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 1.02 : 0.95;
      const v = Math.abs(Math.sin((x * 0.7 + y * 1.1) * 0.9 + smooth(x, y, 4, seed) * 5));
      const vein = v < 0.12 ? -0.13 : v < 0.25 ? -0.05 : 0;
      const shine = (x % 8) + (y % 8) <= 3 ? 0.06 : 0;
      return check + vein + shine;
    }
    case 'cobble': {
      // Paving stones: nearest-seed cells, dark joints, each stone its own tone.
      const seeds: Array<[number, number]> = [];
      for (let i = 0; i < 9; i++) seeds.push([(i % 3) * 5.3 + hash(i, 0, seed) * 4, Math.floor(i / 3) * 5.3 + hash(i, 1, seed) * 4]);
      let d1 = 99;
      let d2 = 99;
      let id = 0;
      for (let i = 0; i < seeds.length; i++) {
        for (const [ox, oy] of [[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16]] as const) {
          const d = Math.hypot(x + 0.5 - seeds[i]![0] - ox, y + 0.5 - seeds[i]![1] - oy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            id = i;
          } else if (d < d2) d2 = d;
        }
      }
      if (d2 - d1 < 1.1) return 0.58;
      return 0.86 + hash(id, 2, seed) * 0.22 + (d2 - d1 < 2.2 ? -0.06 : 0) + (n - 0.5) * 0.06;
    }
    case 'fabric':
      // Wool: soft blotches with a fine weave.
      return 0.88 + smooth(x, y, 4, seed) * 0.16 + ((x + y) % 2 === 0 ? 0.03 : -0.03) + (n > 0.92 ? -0.07 : 0);
    case 'metal': {
      // Gold block: bright bevelled rim, a diagonal sheen, a few glints.
      if (x === 0 || y === 0) return 1.16;
      if (x === 15 || y === 15) return 0.7;
      if (x === 1 || y === 1) return 1.06;
      if (x === 14 || y === 14) return 0.82;
      const sheen = Math.abs(((x - y + 16) % 10) - 5) < 1.2 ? 0.1 : 0;
      return 0.92 + sheen + (n > 0.95 ? 0.12 : 0);
    }
    case 'glass': {
      if (x === 0 || y === 0 || x === 15 || y === 15) return 0.8;
      const streak = x - y === 4 || x - y === 5 || x - y === -6 ? 0.12 : 0;
      return 1 + streak;
    }
    case 'grass': {
      // Grass top: dense blades, darker clumps, the odd bright tip.
      const clump = smooth(x, y, 4, seed) * 0.2;
      return 0.82 + clump + (n > 0.86 ? 0.16 : 0) + (n < 0.1 ? -0.14 : 0);
    }
    case 'leaves': {
      // Leaves: high contrast with dark gaps, as in a leaf block.
      const s = smooth(x, y, 2, seed);
      if (n > 0.86) return 0.5;
      return 0.8 + s * 0.3 + (n < 0.08 ? 0.18 : 0);
    }
    case 'roof': {
      // Clay roof tiles: rows of 4, half-offset, a shadowed lip under each row.
      const row = Math.floor(y / 4);
      const tx = (x + (row % 2) * 2) % 4;
      if (y % 4 === 3) return 0.62;
      if (tx === 0) return 0.76;
      return 0.94 + (y % 4 === 0 ? 0.1 : 0) + (n - 0.5) * 0.08;
    }
    default:
      return 0.94 + (n - 0.5) * 0.1;
  }
}

/** Brightness per texel, 0..255 (multiplied over the material colour; 255 = the tile's brightest texel). */
export function tilePixels(kind: SurfaceKind): Uint8Array {
  const raw = rawTile(kind);
  const max = Math.max(...raw);
  const out = new Uint8Array(TILE * TILE);
  for (let i = 0; i < raw.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, raw[i]! / max)) * 255);
  return out;
}

function rawTile(kind: SurfaceKind): Float32Array {
  const raw = new Float32Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) raw[y * TILE + x] = texel(kind, x, y);
  return raw;
}

const gains = new Map<SurfaceKind, number>();

/** Colour multiplier for a material wearing this tile: the tile's average then shows the swatch itself. */
export function surfaceGain(kind: SurfaceKind): number {
  const hit = gains.get(kind);
  if (hit) return hit;
  const px = tilePixels(kind);
  let sum = 0;
  for (const v of px) sum += v;
  const g = 255 / Math.max(1, sum / px.length);
  gains.set(kind, g);
  return g;
}

const cache = new Map<SurfaceKind, THREE.DataTexture>();

export function surfaceTexture(kind: SurfaceKind): THREE.DataTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const lum = tilePixels(kind);
  const rgba = new Uint8Array(TILE * TILE * 4);
  for (let i = 0; i < lum.length; i++) rgba.set([lum[i]!, lum[i]!, lum[i]!, 255], i * 4);
  const tex = new THREE.DataTexture(rgba, TILE, TILE, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.name = `roam:${kind}`;
  cache.set(kind, tex);
  return tex;
}

/**
 * Minecraft-style pixel detail: tiny grayscale tiles (16×16) multiplied over
 * the palette colour, sampled with nearest-neighbour filtering only. One tile
 * per surface family; texel size is fixed in world units (TEXEL), so a pew and
 * a wall share one pixel grid. Pure pixel generation is separate from three.js
 * so it is testable.
 */
import * as THREE from 'three';
import { C } from '../palette';

export type SurfaceKind = 'plain' | 'wood' | 'stone' | 'fabric' | 'metal' | 'glass';

/** World units per texel (a player stands ≈ 26 texels tall, like Minecraft's 29). */
export const TEXEL = 2;
export const TILE = 16;

export function surfaceFor(hex: string, glow = 0): SurfaceKind {
  if (glow > 0) return 'glass';
  switch (hex.toUpperCase()) {
    case C.gold900:
    case C.gold700:
    case C.neutral900:
    case C.neutral700:
      return 'wood';
    case C.neutral100:
    case C.neutral300:
    case C.neutral500:
    case C.gold100:
      return 'stone';
    case C.royal700:
    case C.royal900:
    case C.royal500:
      return 'fabric';
    case C.gold500:
    case C.gold300:
      return 'metal';
    case '#7FA9E6':
    case '#BDF5FF':
    case '#4D7CC5':
      return 'glass';
    default:
      return 'plain';
  }
}

/** Deterministic hash noise in 0..1. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Brightness per texel, 0..255 (multiplied over the material colour; 255 = colour as-is). */
export function tilePixels(kind: SurfaceKind): Uint8Array {
  const out = new Uint8Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x, y, kind.length * 7 + 3);
      let v = 1;
      switch (kind) {
        case 'wood': {
          // Planks 4 texels tall, staggered butt joints, grain streaks.
          const row = Math.floor(y / 4);
          const seam = y % 4 === 3;
          const joint = (x + row * 5) % 16 === 0;
          v = seam || joint ? 0.74 : 0.93 + 0.07 * Math.sin(x * 0.9 + row * 2.1) - (n > 0.86 ? 0.07 : 0);
          break;
        }
        case 'stone': {
          // Ashlar blocks 8×4 with mortar lines, faint speckle.
          const row = Math.floor(y / 4);
          const mortar = y % 4 === 0 || (x + (row % 2) * 4) % 8 === 0;
          v = mortar ? 0.86 : 0.97 + (n - 0.5) * 0.06;
          break;
        }
        case 'fabric':
          v = (x + y) % 2 === 0 ? 0.96 : 0.88 + n * 0.04;
          break;
        case 'metal':
          v = n > 0.93 ? 1 : 0.9 + ((x + y) % 4 === 0 ? 0.06 : 0) + (n - 0.5) * 0.04;
          break;
        case 'glass':
          v = 1;
          break;
        default:
          v = 0.94 + (n - 0.5) * 0.08;
      }
      out[y * TILE + x] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
  }
  return out;
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

/**
 * Daytime sky for the courthouse plaza: a bright blue dome with hard-edged
 * pixel clouds and a few sparkles. It follows the camera and ignores fog, so
 * the indoor mood colour never tints the outdoors.
 */
import * as THREE from 'three';
import { C } from '../palette';

const W = 512;
const H = 256;

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BLUE = toRgb(C.blue700);
const HORIZON = toRgb(C.blue500);
const SHADE = toRgb(C.blue300);
const CLOUD = toRgb(C.blue100);
const HIGHLIGHT = toRgb(C.neutral100);
const SPARK = toRgb(C.gold100);

function put(data: Uint8Array, x: number, y: number, c: [number, number, number]): void {
  if (y < 0 || y >= H) return;
  const xx = ((x % W) + W) % W;
  const i = (y * W + xx) * 4;
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = 255;
}

/** A chunky ellipse. `s` is the pixel size, so the edge stays stepped. */
function puff(data: Uint8Array, cx: number, cy: number, rx: number, ry: number, c: [number, number, number], s = 3): void {
  const x0 = Math.floor((cx - rx) / s) * s;
  const x1 = Math.ceil((cx + rx) / s) * s;
  const y0 = Math.floor((cy - ry) / s) * s;
  const y1 = Math.ceil((cy + ry) / s) * s;
  for (let y = y0; y <= y1; y += s) {
    for (let x = x0; x <= x1; x += s) {
      const nx = (x + s / 2 - cx) / rx;
      const ny = (y + s / 2 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) put(data, x + xx, y + yy, c);
    }
  }
}

/**
 * A cumulus: a cluster of round puffs with a flat base. Drawn three times
 * (shadow, body, lit crown), each pass offset upward, so the cloud reads as
 * lit from above the way pixel-art skies shade them.
 */
function cloud(data: Uint8Array, cx: number, cy: number, scale: number, seed: number): void {
  const blobs: Array<[number, number, number]> = [];
  const n = 5 + Math.floor(rand(seed, 0) * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const r = (9 + rand(seed, i + 1) * 9) * (1 - Math.abs(t) * 0.9);
    blobs.push([t * 52 + (rand(seed, i + 20) - 0.5) * 6, r * 0.55, r]);
  }
  const at = (dx: number, dy: number) => [cx + dx * scale, cy + dy * scale] as const;
  // Base shadow band: the flat underside.
  for (const [dx, dy, r] of blobs) {
    const [x, y] = at(dx, dy);
    puff(data, x, y, r * scale, r * 0.62 * scale, SHADE, 2);
  }
  for (const [dx, dy, r] of blobs) {
    const [x, y] = at(dx, dy + r * 0.22);
    puff(data, x, y, r * 0.92 * scale, r * 0.6 * scale, CLOUD, 2);
  }
  for (const [dx, dy, r] of blobs) {
    const [x, y] = at(dx - r * 0.18, dy + r * 0.42);
    puff(data, x, y, r * 0.55 * scale, r * 0.34 * scale, HIGHLIGHT, 2);
  }
}

/** A thin streak of cirrus near the horizon. */
function streak(data: Uint8Array, cx: number, cy: number, len: number): void {
  puff(data, cx, cy, len, 2, CLOUD, 2);
  puff(data, cx + len * 0.3, cy + 2, len * 0.5, 1.5, HIGHLIGHT, 2);
}

function rand(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function spark(data: Uint8Array, x: number, y: number): void {
  put(data, x, y, SPARK);
  put(data, x - 1, y, HIGHLIGHT);
  put(data, x + 1, y, HIGHLIGHT);
  put(data, x, y - 1, HIGHLIGHT);
  put(data, x, y + 1, HIGHLIGHT);
}

function skyPixels(): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  // Row 0 is straight down; the horizon sits at mid-height (equator). Pale at the
  // horizon, deep royal blue toward the zenith, in hard pixel bands.
  for (let y = 0; y < H; y++) {
    const up = Math.max(0, (y - H / 2) / (H / 2));
    const t = Math.min(1, Math.floor(Math.pow(up, 0.7) * 10) / 8);
    const c: [number, number, number] = [HORIZON[0] + (BLUE[0] - HORIZON[0]) * t, HORIZON[1] + (BLUE[1] - HORIZON[1]) * t, HORIZON[2] + (BLUE[2] - HORIZON[2]) * t];
    for (let x = 0; x < W; x++) put(data, x, y, c);
  }
  // Big clouds in a band just above the horizon, smaller ones higher up.
  // Keep marks away from the pole (y near H): there they pinch into a ring.
  for (let i = 0; i < 14; i++) {
    const x = (i / 14) * W + rand(i, 3) * 24;
    const y = H / 2 + 14 + rand(i, 4) * 26;
    cloud(data, x, y, 0.55 + rand(i, 5) * 0.45, i + 1);
  }
  for (let i = 0; i < 10; i++) {
    const x = (i / 10) * W + rand(i, 6) * 40;
    const y = H / 2 + 52 + rand(i, 7) * 30;
    cloud(data, x, y, 0.28 + rand(i, 8) * 0.22, i + 40);
  }
  for (let i = 0; i < 8; i++) streak(data, rand(i, 9) * W, H / 2 + 6 + rand(i, 10) * 8, 10 + rand(i, 11) * 18);
  for (let i = 0; i < 9; i++) spark(data, Math.floor(rand(i, 12) * W), Math.floor(H / 2 + 70 + rand(i, 13) * 40));
  return data;
}

/** A skydome the renderer parents to the camera while the player is outside. */
export function buildPlazaSky(): THREE.Mesh {
  const tex = new THREE.DataTexture(skyPixels(), W, H);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(500, 96, 48),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }),
  );
  mesh.name = 'plaza-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.visible = false;
  return mesh;
}

/**
 * Daytime sky for the courthouse plaza: a bright blue dome with hard-edged
 * pixel clouds and a few sparkles. It follows the camera and ignores fog, so
 * the indoor mood colour never tints the outdoors.
 */
import * as THREE from 'three';
import { C } from '../palette';

const W = 256;
const H = 128;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BLUE = rgb(C.blue700);
const HORIZON = rgb(C.blue500);
const SHADE = rgb(C.blue300);
const CLOUD = rgb(C.blue100);
const HIGHLIGHT = rgb(C.neutral100);
const SPARK = rgb(C.gold100);

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

function cloud(data: Uint8Array, cx: number, cy: number, scale: number): void {
  const blobs: Array<[number, number, number, number]> = [
    [-10, -2, 16, 9],
    [6, 0, 18, 10],
    [20, -1, 12, 8],
    [-2, 6, 14, 7],
    [14, 5, 12, 6],
  ];
  for (const [dx, dy, rx, ry] of blobs) puff(data, cx + dx * scale, cy + dy * scale, rx * scale, ry * scale, SHADE, 3);
  for (const [dx, dy, rx, ry] of blobs) puff(data, cx + dx * scale, cy + (dy + 2) * scale, rx * scale * 0.82, ry * scale * 0.7, CLOUD, 3);
  puff(data, cx - 4 * scale, cy + 6 * scale, 8 * scale, 4 * scale, HIGHLIGHT, 3);
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
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / (H * 0.45));
    const c: [number, number, number] = [
      HORIZON[0] + (BLUE[0] - HORIZON[0]) * t,
      HORIZON[1] + (BLUE[1] - HORIZON[1]) * t,
      HORIZON[2] + (BLUE[2] - HORIZON[2]) * t,
    ];
    for (let x = 0; x < W; x++) put(data, x, y, c);
  }
  // Row 0 is the horizon. Keep clouds off the pole (y near H): a wide mark there
  // becomes a ring around the zenith. These sit in the band you see above the roof.
  cloud(data, 28, 78, 0.55);
  cloud(data, 52, 62, 0.32);
  cloud(data, 96, 84, 0.42);
  cloud(data, 124, 68, 0.28);
  cloud(data, 158, 80, 0.5);
  cloud(data, 188, 64, 0.3);
  cloud(data, 214, 86, 0.38);
  cloud(data, 240, 72, 0.26);
  cloud(data, 8, 90, 0.22);
  puff(data, 70, 74, 14, 2, CLOUD, 2);
  puff(data, 176, 70, 12, 2, CLOUD, 2);
  spark(data, 64, 92);
  spark(data, 110, 88);
  spark(data, 146, 96);
  spark(data, 200, 90);
  spark(data, 86, 66);
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
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  mesh.name = 'plaza-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.visible = false;
  return mesh;
}

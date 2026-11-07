/**
 * Miss Ratio v7 — polished.
 * Same funny silhouette (twin tails, glasses, ahoge, smug) but clean
 * proportions, aligned panels, controlled values, natural rest pose.
 *
 *   npx tsx tools/bbmcp/build-miss-ratio.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool, connect } from './client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const OUT = path.join(ROOT, 'packages/scene/assets/roam/heroes/prosecutor');
const SHOTS = path.join(ROOT, '.bbshots/heroes');

type V3 = [number, number, number];
type El = { name: string; from: V3; to: V3 };
interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string; data?: string }>;
}

function ok(r: ToolResult, what: string): ToolResult {
  if (r?.isError) throw new Error(`${what}: ${(r.content ?? []).map((c) => c.text ?? '').join(' ').slice(0, 400)}`);
  return r;
}
const call = (n: string, a: unknown) => callTool(n, a) as Promise<ToolResult>;

/** Tight palette — 3 values per material */
const C = {
  primary: '#6B1C2E',
  primaryDeep: '#45121F',
  primaryHi: '#843247',
  secondary: '#1C1820',
  skirt: '#26222C',
  skirtHi: '#32303A',
  accent: '#F3EDE2',
  accentWarm: '#FFF9F0',
  accentSh: '#D9CFC0',
  hair: '#121014',
  hairHi: '#2A2428',
  hairEdge: '#3C3438',
  skin: '#E2B294',
  skinSh: '#C08A6A',
  skinHi: '#EBC7AB',
  trim: '#C9A84E',
  trimHi: '#E8D078',
  eye: '#FFF8F2',
  iris: '#8E2040',
  irisDeep: '#5C122A',
  pupil: '#10080C',
  lip: '#A63A48',
  lipDeep: '#782832',
  blush: '#E49A92',
  brow: '#0C080A',
  glass: '#16141C',
  glassLens: '#243044',
  paper: '#FFF9F2',
  paperSh: '#E6DDD0',
  ink: '#2A2430',
  stamp: '#A81C2C',
} as const;

let n = 0;
const id = (p: string) => `${p}_${++n}`;
/** Axis-aligned box helper — always from < to on every axis */
function box(name: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): El {
  return {
    name,
    from: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
    to: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
  };
}
/** Centered slab */
function slab(name: string, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): El {
  return box(name, cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
}

async function tex(name: string, hex: string) {
  ok(await call('create_texture', { name, width: 16, height: 16, fill_color: hex }), `tex ${name}`);
}
async function group(name: string, origin: V3, parent = 'root') {
  ok(await call('add_group', { name, origin, parent }), `g ${name}`);
}
async function put(texture: string, groupName: string, elements: El[]) {
  for (let i = 0; i < elements.length; i += 36) {
    ok(
      await call('place_cube', { texture, group: groupName, elements: elements.slice(i, i + 36) }),
      `put ${groupName}/${texture}/${i}`,
    );
  }
}
async function spheres(
  texture: string,
  groupName: string,
  elements: { name: string; position: V3; diameter: number; sides?: number; vertical_sides?: number }[],
) {
  ok(await call('create_sphere', { texture, group: groupName, elements }), `sph ${groupName}`);
}
function kf(time: number, rotation?: V3, position?: V3) {
  return { time, ...(rotation ? { rotation } : {}), ...(position ? { position } : {}) };
}
async function anim(name: string, length: number, loop: boolean, bones: Record<string, ReturnType<typeof kf>[]>) {
  ok(await call('create_animation', { name, animation_length: length, loop, bones }), `anim ${name}`);
}
async function shot(tag: string, position: V3, target: V3, projection: 'perspective' | 'orthographic' = 'perspective') {
  ok(await call('set_camera_angle', { projection, position, target, fov: 26 }), `cam ${tag}`);
  const r = ok(await call('capture_screenshot', { antialias: true, width: 1280, height: 960 }), `shot ${tag}`);
  const b64 = r.content?.find((c) => c.data)?.data;
  if (!b64) throw new Error(`no img ${tag}`);
  fs.writeFileSync(path.join(SHOTS, `miss-ratio-${tag}.png`), Buffer.from(b64, 'base64'));
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const info = (await connect()) as { serverInfo?: { name?: string; version?: string } };
console.error(`# ${info.serverInfo?.name} ${info.serverInfo?.version} — Miss Ratio v7 polished`);
ok(await call('create_project', { name: 'CC_MissRatio_v7', format: 'free' }), 'create');
for (const [k, v] of Object.entries(C)) await tex(k, v);

// ── Skeleton (origins tuned for clean deformation) ────────────────────────
await group('hips', [0, 12.6, 0]);
await group('torso', [0, 12.6, 0], 'hips');
await group('head', [0, 27.2, 0], 'torso');
await group('glasses', [0, 35.2, 0.9], 'head');
await group('earR', [3.85, 31.0, 0], 'head');
await group('earL', [-3.85, 31.0, 0], 'head');
await group('lockR', [3.2, 32.8, 0.2], 'head');
await group('lockL', [-3.2, 32.8, 0.2], 'head');
await group('ahoge', [0.3, 36.6, -0.6], 'head');
await group('armR', [4.85, 26.1, 0], 'torso');
await group('forearmR', [4.85, 19.8, 0], 'armR');
await group('handR', [4.85, 14.2, 0], 'forearmR');
await group('armL', [-4.85, 26.1, 0], 'torso');
await group('forearmL', [-4.85, 19.8, 0], 'armL');
await group('handL', [-4.85, 14.2, 0], 'forearmL');
await group('legR', [1.8, 12.6, 0], 'hips');
await group('legL', [-1.8, 12.6, 0], 'hips');
await group('peplum', [0, 13.3, -0.2], 'torso');
await group('folder', [4.85, 13.2, 1.35], 'handR');
await group('papers', [4.85, 14.6, 1.7], 'folder');

// ── Legs — slim pencil + polished stilettos ───────────────────────────────
await put('skirt', 'legR', [
  box(id('thR'), 0.7, 8.9, -1.15, 3.0, 12.6, 1.25),
  box(id('knR'), 0.8, 7.95, -1.0, 2.9, 9.05, 1.15),
  box(id('cfR'), 0.9, 1.85, -0.95, 2.8, 8.05, 1.1),
]);
await put('skirtHi', 'legR', [
  box(id('plR1'), 0.6, 10.0, 1.05, 1.2, 12.45, 1.4),
  box(id('plR2'), 1.55, 9.9, 1.1, 2.15, 12.4, 1.4),
  box(id('plR3'), 2.45, 10.05, 1.05, 3.05, 12.45, 1.4),
]);
await put('secondary', 'legR', [
  box(id('ankR'), 0.85, 1.15, -0.85, 2.85, 1.95, 1.25),
  box(id('shoeR'), 0.7, 0.12, -0.15, 3.0, 0.95, 2.75),
  box(id('toeR'), 0.75, 0.22, 2.1, 2.95, 0.78, 3.05),
  box(id('platR'), 1.0, 0.0, -1.5, 2.7, 0.42, -0.1),
  box(id('heelR'), 1.45, -0.65, -1.3, 2.25, 0.12, -0.45),
  box(id('tipR'), 1.55, -0.88, -1.15, 2.15, -0.5, -0.6),
]);
await put('skirt', 'legL', [
  box(id('thL'), -3.0, 8.9, -1.15, -0.7, 12.6, 1.25),
  box(id('knL'), -2.9, 7.95, -1.0, -0.8, 9.05, 1.15),
  box(id('cfL'), -2.8, 1.85, -0.95, -0.9, 8.05, 1.1),
]);
await put('skirtHi', 'legL', [
  box(id('plL1'), -1.2, 10.0, 1.05, -0.6, 12.45, 1.4),
  box(id('plL2'), -2.15, 9.9, 1.1, -1.55, 12.4, 1.4),
  box(id('plL3'), -3.05, 10.05, 1.05, -2.45, 12.45, 1.4),
]);
await put('secondary', 'legL', [
  box(id('ankL'), -2.85, 1.15, -0.85, -0.85, 1.95, 1.25),
  box(id('shoeL'), -3.0, 0.12, -0.15, -0.7, 0.95, 2.75),
  box(id('toeL'), -2.95, 0.22, 2.1, -0.75, 0.78, 3.05),
  box(id('platL'), -2.7, 0.0, -1.5, -1.0, 0.42, -0.1),
  box(id('heelL'), -2.25, -0.65, -1.3, -1.45, 0.12, -0.45),
  box(id('tipL'), -2.15, -0.88, -1.15, -1.55, -0.5, -0.6),
]);

// ── Coat — sharp shoulders, cinched waist, clean panels ───────────────────
await put('primary', 'torso', [
  box(id('body'), -3.7, 13.3, -2.05, 3.7, 26.7, 2.05),
  box(id('chest'), -3.4, 21.6, 0.4, 3.4, 26.4, 2.45),
  box(id('waist'), -2.7, 13.6, -1.75, 2.7, 16.9, 1.85),
  box(id('shR'), 2.35, 24.55, -1.7, 5.15, 27.35, 1.8),
  box(id('shL'), -5.15, 24.55, -1.7, -2.35, 27.35, 1.8),
  box(id('padR'), 3.35, 25.55, -1.4, 5.4, 27.5, 1.55),
  box(id('padL'), -5.4, 25.55, -1.4, -3.35, 27.5, 1.55),
  box(id('hipR'), 1.35, 12.75, -1.8, 3.7, 14.7, 1.75),
  box(id('hipL'), -3.7, 12.75, -1.8, -1.35, 14.7, 1.75),
]);
await put('primaryHi', 'torso', [
  box(id('lapelR'), 0.35, 18.3, 2.05, 2.2, 26.35, 2.7),
  box(id('lapelL'), -2.2, 18.3, 2.05, -0.35, 26.35, 2.7),
  box(id('yoke'), -3.0, 25.3, -1.85, 3.0, 26.95, 0.7),
  box(id('flapR'), 1.7, 18.35, 2.25, 3.25, 19.05, 2.6),
  box(id('flapL'), -3.25, 18.35, 2.25, -1.7, 19.05, 2.6),
]);
await put('primaryDeep', 'torso', [
  box(id('under'), -3.35, 13.4, -2.3, 3.35, 21.5, -1.65),
  box(id('seam'), -0.22, 14.0, 1.95, 0.22, 26.2, 2.45),
  box(id('dartR'), 1.5, 16.0, -2.2, 2.05, 21.8, -1.85),
  box(id('dartL'), -2.05, 16.0, -2.2, -1.5, 21.8, -1.85),
  box(id('pocketR'), 1.7, 17.15, 2.05, 3.2, 18.45, 2.45),
  box(id('pocketL'), -3.2, 17.15, 2.05, -1.7, 18.45, 2.45),
  box(id('sideR'), 3.2, 14.2, -1.4, 3.95, 24.2, 1.35),
  box(id('sideL'), -3.95, 14.2, -1.4, -3.2, 24.2, 1.35),
]);
await put('accent', 'torso', [
  box(id('blouse'), -1.7, 24.4, 1.1, 1.7, 27.35, 2.55),
  box(id('colR'), 0.15, 26.2, 0.45, 2.7, 28.25, 2.75),
  box(id('colL'), -2.7, 26.2, 0.45, -0.15, 28.25, 2.75),
  box(id('colTipR'), 1.5, 26.45, 2.25, 2.95, 27.85, 3.05),
  box(id('colTipL'), -2.95, 26.45, 2.25, -1.5, 27.85, 3.05),
  box(id('placket'), -0.5, 17.3, 2.1, 0.5, 25.7, 2.6),
  // cream bow — hero neck accent
  box(id('bow'), -1.25, 25.55, 2.3, 1.25, 27.35, 3.25),
  box(id('bowR'), 0.4, 25.75, 2.55, 1.95, 27.15, 3.35),
  box(id('bowL'), -1.95, 25.75, 2.55, -0.4, 27.15, 3.35),
  box(id('knot'), -0.4, 25.95, 2.95, 0.4, 27.05, 3.5),
]);
await put('accentWarm', 'torso', [
  box(id('bowHi'), -0.7, 26.25, 3.1, 0.7, 26.85, 3.45),
  box(id('colHiR'), 1.8, 27.05, 2.55, 2.55, 27.9, 3.0),
  box(id('colHiL'), -2.55, 27.05, 2.55, -1.8, 27.9, 3.0),
]);
await put('accentSh', 'torso', [box(id('bowSh'), -1.05, 25.6, 2.4, 1.05, 26.05, 3.05)]);
await put('trim', 'torso', [
  box(id('btn1'), -0.26, 24.15, 2.45, 0.26, 24.7, 2.95),
  box(id('btn2'), -0.26, 21.7, 2.45, 0.26, 22.25, 2.95),
  box(id('btn3'), -0.26, 19.25, 2.45, 0.26, 19.8, 2.95),
  box(id('belt'), -2.75, 16.25, -1.9, 2.75, 17.1, 2.05),
  box(id('buckle'), -0.5, 16.15, 1.95, 0.5, 17.2, 2.45),
  box(id('pin'), 1.9, 23.35, 2.55, 2.6, 24.2, 3.1),
]);
await put('trimHi', 'torso', [
  box(id('buckleHi'), -0.3, 16.35, 2.3, 0.3, 17.05, 2.6),
  box(id('pinHi'), 2.05, 23.55, 2.9, 2.45, 24.05, 3.2),
  box(id('btnHi1'), -0.12, 24.3, 2.85, 0.12, 24.55, 3.1),
  box(id('btnHi2'), -0.12, 21.85, 2.85, 0.12, 22.1, 3.1),
]);

// Peplum — clean fan, even wedges
await put('primary', 'peplum', [
  box(id('pC'), -3.4, 12.1, -3.35, 3.4, 14.2, -1.9),
  box(id('pR1'), 0.3, 12.2, -2.35, 4.9, 14.55, 0.55),
  box(id('pR2'), 1.5, 11.7, -3.1, 5.4, 13.85, -0.55),
  box(id('pR3'), 2.6, 11.35, -1.85, 5.55, 13.4, 1.15),
  box(id('pL1'), -4.9, 12.2, -2.35, -0.3, 14.55, 0.55),
  box(id('pL2'), -5.4, 11.7, -3.1, -1.5, 13.85, -0.55),
  box(id('pL3'), -5.55, 11.35, -1.85, -2.6, 13.4, 1.15),
]);
await put('primaryDeep', 'peplum', [
  box(id('pShade'), -3.5, 11.85, -2.95, 3.5, 13.15, -2.2),
  box(id('pSplit'), -0.2, 11.4, -3.55, 0.2, 14.0, -2.25),
]);
await put('primaryHi', 'peplum', [
  box(id('pEdgeR'), 4.5, 11.4, -1.3, 5.7, 12.95, 0.7),
  box(id('pEdgeL'), -5.7, 11.4, -1.3, -4.5, 12.95, 0.7),
]);

// ── Arms — tapered sleeves ────────────────────────────────────────────────
await put('primary', 'armR', [
  box(id('uR'), 3.85, 20.0, -1.1, 5.95, 26.4, 1.15),
  box(id('uRs'), 3.75, 24.55, -1.2, 6.1, 26.3, 1.25),
]);
await put('primaryDeep', 'armR', [box(id('elR'), 4.0, 19.55, -1.05, 5.85, 20.4, 1.05)]);
await put('primary', 'forearmR', [
  box(id('lR'), 3.95, 14.55, -1.0, 5.85, 20.15, 1.0),
  box(id('cufR'), 3.8, 14.25, -1.1, 6.0, 15.15, 1.1),
]);
await put('accent', 'forearmR', [
  box(id('cufRi'), 3.95, 14.4, -0.85, 5.85, 14.95, 0.85),
]);
await put('skin', 'handR', [
  box(id('palmR'), 4.1, 12.95, -0.9, 5.75, 14.55, 0.9),
  box(id('thR'), 3.9, 13.1, 0.15, 4.55, 14.3, 1.3),
  box(id('iR'), 4.45, 11.45, 0.35, 4.9, 13.05, 2.15),
  box(id('iTip'), 4.5, 11.1, 1.6, 4.85, 11.55, 2.35),
  box(id('mR'), 4.9, 11.75, 0.15, 5.3, 13.05, 1.8),
  box(id('rR'), 5.25, 11.95, -0.05, 5.6, 13.05, 1.45),
  box(id('pR'), 5.5, 12.15, -0.25, 5.8, 13.05, 1.15),
]);
await put('skinHi', 'handR', [box(id('nail'), 4.55, 11.05, 2.2, 4.8, 11.3, 2.45)]);

await put('primary', 'armL', [
  box(id('uL'), -5.95, 20.0, -1.1, -3.85, 26.4, 1.15),
  box(id('uLs'), -6.1, 24.55, -1.2, -3.75, 26.3, 1.25),
]);
await put('primaryDeep', 'armL', [box(id('elL'), -5.85, 19.55, -1.05, -4.0, 20.4, 1.05)]);
await put('primary', 'forearmL', [
  box(id('lL'), -5.85, 14.55, -1.0, -3.95, 20.15, 1.0),
  box(id('cufL'), -6.0, 14.25, -1.1, -3.8, 15.15, 1.1),
]);
await put('accent', 'forearmL', [box(id('cufLi'), -5.85, 14.4, -0.85, -3.95, 14.95, 0.85)]);
await put('skin', 'handL', [
  box(id('palmL'), -5.75, 12.95, -0.9, -4.1, 14.55, 0.9),
  box(id('thL'), -4.55, 13.1, 0.15, -3.9, 14.3, 1.3),
  box(id('iL'), -4.9, 11.95, 0.2, -4.45, 13.05, 1.6),
  box(id('mL'), -5.3, 11.85, 0.05, -4.9, 13.05, 1.5),
  box(id('rL'), -5.6, 12.05, -0.1, -5.25, 13.05, 1.3),
]);

// ── Head — polished face grid ─────────────────────────────────────────────
await spheres('skin', 'head', [{ name: 'skull', position: [0, 31.45, 0.1], diameter: 8.2, sides: 24, vertical_sides: 16 }]);
await put('skin', 'head', [
  box(id('face'), -3.15, 29.5, 0.5, 3.15, 33.6, 3.45),
  box(id('browRidge'), -2.6, 33.0, 1.8, 2.6, 34.3, 3.2),
]);
await put('skinHi', 'head', [
  box(id('cheekHiR'), 1.7, 30.7, 2.7, 2.9, 31.9, 3.55),
  box(id('cheekHiL'), -2.9, 30.7, 2.7, -1.7, 31.9, 3.55),
]);
await put('skinSh', 'head', [
  box(id('jaw'), -2.6, 28.45, -1.1, 2.6, 30.1, 2.85),
  box(id('chin'), -1.2, 28.05, 1.5, 1.2, 29.0, 3.3),
  box(id('earR'), 3.35, 30.4, -0.55, 4.15, 32.25, 0.85),
  box(id('earL'), -4.15, 30.4, -0.55, -3.35, 32.25, 0.85),
]);

// Eyes — mirrored, even spacing
const eyeX = 1.45;
await put('eye', 'head', [
  box(id('ewR'), eyeX - 0.95, 31.45, 3.2, eyeX + 0.95, 32.75, 4.1),
  box(id('ewL'), -eyeX - 0.95, 31.45, 3.2, -eyeX + 0.95, 32.75, 4.1),
]);
await put('iris', 'head', [
  box(id('irR'), eyeX - 0.5, 31.55, 3.85, eyeX + 0.5, 32.5, 4.35),
  box(id('irL'), -eyeX - 0.5, 31.55, 3.85, -eyeX + 0.5, 32.5, 4.35),
]);
await put('irisDeep', 'head', [
  box(id('irDR'), eyeX - 0.35, 31.65, 4.1, eyeX + 0.35, 32.35, 4.45),
  box(id('irDL'), -eyeX - 0.35, 31.65, 4.1, -eyeX + 0.35, 32.35, 4.45),
]);
await put('pupil', 'head', [
  box(id('puR'), eyeX - 0.22, 31.75, 4.2, eyeX + 0.22, 32.2, 4.55),
  box(id('puL'), -eyeX - 0.22, 31.75, 4.2, -eyeX + 0.22, 32.2, 4.55),
]);
await put('accentWarm', 'head', [
  box(id('spR'), eyeX + 0.15, 32.2, 4.3, eyeX + 0.4, 32.45, 4.55),
  box(id('spL'), -eyeX - 0.4, 32.2, 4.3, -eyeX - 0.15, 32.45, 4.55),
]);
await put('skin', 'head', [
  box(id('lidR'), eyeX - 1.0, 32.5, 3.35, eyeX + 1.0, 32.95, 4.15),
  box(id('lidL'), -eyeX - 1.0, 32.5, 3.35, -eyeX + 1.0, 32.95, 4.15),
  box(id('nose'), -0.35, 30.85, 3.5, 0.35, 31.55, 4.2),
]);
await put('brow', 'head', [
  box(id('brR'), eyeX - 1.05, 32.95, 3.4, eyeX + 1.15, 33.45, 4.2),
  box(id('brL'), -eyeX - 1.15, 33.1, 3.4, -eyeX + 1.05, 33.6, 4.2), // raised smug
  box(id('brTipR'), eyeX + 0.9, 33.05, 3.5, eyeX + 1.4, 33.55, 4.05),
]);
await put('hair', 'head', [
  box(id('lashR1'), eyeX - 0.75, 32.75, 4.0, eyeX - 0.4, 33.05, 4.3),
  box(id('lashR2'), eyeX - 0.1, 32.85, 4.05, eyeX + 0.25, 33.1, 4.35),
  box(id('lashR3'), eyeX + 0.45, 32.75, 4.0, eyeX + 0.85, 33.05, 4.3),
  box(id('lashL1'), -eyeX + 0.4, 32.75, 4.0, -eyeX + 0.75, 33.05, 4.3),
  box(id('lashL2'), -eyeX - 0.25, 32.85, 4.05, -eyeX + 0.1, 33.1, 4.35),
  box(id('lashL3'), -eyeX - 0.85, 32.75, 4.0, -eyeX - 0.45, 33.05, 4.3),
]);
await put('blush', 'head', [
  box(id('blR'), 1.95, 30.55, 2.85, 3.05, 31.35, 3.65),
  box(id('blL'), -3.05, 30.55, 2.85, -1.95, 31.35, 3.65),
]);
await put('lip', 'head', [
  box(id('lipU'), -0.85, 30.05, 3.3, 0.85, 30.45, 3.95),
  box(id('lipD'), -0.65, 29.8, 3.2, 0.65, 30.15, 3.85),
  box(id('smirk'), 0.35, 30.1, 3.5, 1.15, 30.45, 4.0),
]);
await put('lipDeep', 'head', [box(id('lipLine'), -0.55, 30.0, 3.6, 0.55, 30.18, 3.95)]);

// Hair crown — smooth shell + even bangs
await put('hair', 'head', [
  box(id('crown'), -4.0, 33.5, -3.45, 4.0, 36.85, 1.9),
  box(id('top'), -3.3, 36.0, -2.65, 3.3, 37.5, 1.15),
  box(id('back'), -3.85, 29.5, -4.0, 3.85, 35.2, -1.5),
  box(id('nape'), -3.0, 28.35, -3.65, 3.0, 30.6, -1.7),
  box(id('sideR'), 2.9, 29.7, -1.9, 4.4, 34.7, 2.3),
  box(id('sideL'), -4.4, 29.7, -1.9, -2.9, 34.7, 2.3),
]);
await put('hairHi', 'head', [
  box(id('shine'), -1.2, 35.35, -0.55, 1.8, 37.1, 1.25),
]);
// 9 even bangs
{
  const bangs: El[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x0 = -3.4 + t * 6.8;
    const drop = Math.abs(t - 0.5) * 0.9;
    bangs.push(box(id(`bang${i}`), x0, 33.2 - drop, 1.5, x0 + 0.85, 35.7 - drop * 0.35, 3.9));
  }
  await put('hair', 'head', bangs);
}
await put('hairEdge', 'head', [
  box(id('bangHi1'), -1.5, 34.7, 2.5, 0.4, 35.75, 3.9),
  box(id('bangHi2'), 0.6, 34.55, 2.4, 2.3, 35.65, 3.8),
]);

// Twin tails — smooth taper ribbons (even steps)
function makeLock(sx: number): { hair: El[]; hi: El[]; edge: El[] } {
  const hair: El[] = [];
  const hi: El[] = [];
  const edge: El[] = [];
  const tag = sx > 0 ? 'R' : 'L';
  // shoulder puff
  hair.push(box(id(`lk${tag}puff`), sx * 2.9 - (sx > 0 ? 0 : 2.1), 30.4, -1.1, sx * 2.9 + (sx > 0 ? 2.1 : 0), 34.1, 2.45));
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const y = 32.0 - i * 2.25;
    const out = 3.85 + t * 4.6;
    const w = 1.35 - t * 0.55;
    const z0 = -0.7 + t * 0.9;
    const z1 = 2.2 - t * 0.35;
    const cx = sx * out;
    hair.push(box(id(`lk${tag}${i}`), cx - w, y, z0, cx + w, y + 2.6, z1));
    // thin polish strand
    const s = cx + sx * (w + 0.28);
    edge.push(box(id(`lk${tag}s${i}`), s - 0.18, y + 0.35, z0 + 0.25, s + 0.18, y + 2.25, z1 - 0.2));
  }
  hi.push(
    box(id(`lk${tag}hi`), sx * 4.0 - (sx > 0 ? 0 : 1.7), 27.4, 1.1, sx * 4.0 + (sx > 0 ? 1.7 : 0), 30.9, 2.2),
    box(id(`lk${tag}mid`), sx * 5.7 - (sx > 0 ? 0 : 1.4), 20.8, 0.65, sx * 5.7 + (sx > 0 ? 1.4 : 0), 24.0, 1.8),
    box(id(`lk${tag}lo`), sx * 7.0 - (sx > 0 ? 0 : 1.15), 14.2, 0.3, sx * 7.0 + (sx > 0 ? 1.15 : 0), 17.0, 1.4),
  );
  edge.push(
    box(id(`lk${tag}end`), sx * 7.5 - (sx > 0 ? 0 : 1.2), 11.5, 0.1, sx * 7.5 + (sx > 0 ? 1.2 : 0), 13.3, 1.25),
    box(id(`lk${tag}curl`), sx * 8.2 - (sx > 0 ? 0 : 0.9), 11.0, 0.4, sx * 8.2 + (sx > 0 ? 0.9 : 0), 12.15, 1.45),
  );
  return { hair, hi, edge };
}
const lr = makeLock(1);
const ll = makeLock(-1);
await put('hair', 'lockR', lr.hair);
await put('hairHi', 'lockR', lr.hi);
await put('hairEdge', 'lockR', lr.edge);
await put('hair', 'lockL', ll.hair);
await put('hairHi', 'lockL', ll.hi);
await put('hairEdge', 'lockL', ll.edge);

// Ahoge — clean hook
await put('hair', 'ahoge', [
  box(id('aho1'), -0.4, 36.2, -1.0, 0.65, 39.0, 0.5),
  box(id('aho2'), 0.2, 38.4, -0.75, 1.7, 40.15, 0.45),
  box(id('aho3'), 1.25, 39.6, -0.25, 2.55, 40.85, 0.65),
  box(id('aho4'), 2.05, 40.1, 0.05, 3.0, 40.95, 0.8),
]);
await put('hairHi', 'ahoge', [box(id('ahoHi'), 0.35, 37.2, -0.4, 1.25, 39.1, 0.35)]);

// Sunglasses — crisp frames
await put('glass', 'glasses', [
  box(id('frame'), -3.85, 34.7, 0.65, 3.85, 36.3, 2.45),
  box(id('bridge'), -0.5, 34.95, 2.05, 0.5, 35.95, 2.75),
  box(id('rimR'), 0.5, 34.8, 2.15, 3.55, 36.2, 2.7),
  box(id('rimL'), -3.55, 34.8, 2.15, -0.5, 36.2, 2.7),
  box(id('armR'), 3.45, 34.85, -0.7, 4.2, 36.05, 1.55),
  box(id('armL'), -4.2, 34.85, -0.7, -3.45, 36.05, 1.55),
]);
await put('glassLens', 'glasses', [
  box(id('lensR'), 0.7, 35.0, 2.35, 3.35, 36.05, 2.85),
  box(id('lensL'), -3.35, 35.0, 2.35, -0.7, 36.05, 2.85),
]);
await put('accentWarm', 'glasses', [
  box(id('glR'), 2.35, 35.45, 2.65, 3.1, 35.9, 2.95),
  box(id('glL'), -3.1, 35.45, 2.65, -2.35, 35.9, 2.95),
]);

// Scale earrings — tidy
await put('trim', 'earR', [
  box(id('hookR'), 3.65, 30.85, -0.25, 4.15, 31.95, 0.35),
  box(id('beamR'), 3.45, 29.5, -0.9, 4.35, 29.95, 1.0),
  box(id('panRa'), 3.3, 28.75, -1.0, 3.9, 29.35, -0.25),
  box(id('panRb'), 3.9, 28.75, 0.3, 4.5, 29.35, 1.05),
  box(id('chRa'), 3.5, 29.05, -0.75, 3.7, 29.55, -0.5),
  box(id('chRb'), 4.1, 29.05, 0.55, 4.3, 29.55, 0.8),
]);
await put('trimHi', 'earR', [box(id('gemR'), 3.8, 30.2, -0.05, 4.15, 30.7, 0.35)]);
await put('trim', 'earL', [
  box(id('hookL'), -4.15, 30.85, -0.25, -3.65, 31.95, 0.35),
  box(id('beamL'), -4.35, 29.5, -0.9, -3.45, 29.95, 1.0),
  box(id('panLa'), -3.9, 28.75, -1.0, -3.3, 29.35, -0.25),
  box(id('panLb'), -4.5, 28.75, 0.3, -3.9, 29.35, 1.05),
  box(id('chLa'), -3.7, 29.05, -0.75, -3.5, 29.55, -0.5),
  box(id('chLb'), -4.3, 29.05, 0.55, -4.1, 29.55, 0.8),
]);
await put('trimHi', 'earL', [box(id('gemL'), -4.15, 30.2, -0.05, -3.8, 30.7, 0.35)]);

// Folder — neat stack at hip
await put('accent', 'folder', [
  box(id('fBack'), 3.55, 11.7, 0.55, 7.05, 15.7, 1.1),
  box(id('fFront'), 3.65, 11.9, 1.4, 6.95, 15.5, 1.9),
]);
await put('accentSh', 'folder', [box(id('fInner'), 3.75, 12.15, 1.15, 6.85, 15.3, 1.45)]);
await put('primary', 'folder', [
  box(id('fStripe'), 3.5, 14.4, 0.5, 7.1, 15.2, 1.95),
  box(id('fTab'), 4.85, 15.4, 0.5, 5.85, 16.05, 2.0),
]);
await put('stamp', 'folder', [box(id('fRed'), 4.7, 12.9, 1.8, 6.15, 13.7, 2.1)]);
await put('paper', 'papers', [
  box(id('p1'), 3.85, 14.3, 1.7, 6.5, 16.9, 1.95),
  box(id('p2'), 4.1, 14.7, 1.85, 6.85, 17.4, 2.1),
  box(id('p3'), 3.95, 15.15, 2.0, 6.4, 17.9, 2.25),
]);
await put('paperSh', 'papers', [box(id('pSh'), 4.05, 14.5, 1.55, 6.4, 16.7, 1.8)]);
await put('ink', 'papers', [
  box(id('ln1'), 4.25, 15.7, 2.05, 6.15, 15.9, 2.2),
  box(id('ln2'), 4.25, 16.4, 2.15, 6.3, 16.6, 2.3),
]);
await put('stamp', 'papers', [box(id('st1'), 4.85, 16.7, 2.15, 5.8, 17.3, 2.35)]);

console.error('# info', ok(await call('get_project_info', {}), 'info').content?.find((c) => c.type === 'text')?.text?.slice(0, 260));

// Natural rest — folder at hip, soft smug lean
await anim('prosecutor_idle', 2.8, true, {
  hips: [kf(0, undefined, [0, 0, 0]), kf(1.4, undefined, [0, 0.2, 0]), kf(2.8, undefined, [0, 0, 0])],
  torso: [kf(0, [1, 5, 0]), kf(1.4, [-1, 7, 0]), kf(2.8, [1, 5, 0])],
  head: [kf(0, [0, 8, 0]), kf(1.0, [2, 11, 0]), kf(1.9, [-1, 5, 0]), kf(2.8, [0, 8, 0])],
  armR: [kf(0, [12, 0, 14]), kf(1.4, [14, 0, 16]), kf(2.8, [12, 0, 14])],
  forearmR: [kf(0, [-18, 0, 8]), kf(1.4, [-20, 0, 10]), kf(2.8, [-18, 0, 8])],
  armL: [kf(0, [10, 0, -12]), kf(1.4, [12, 0, -14]), kf(2.8, [10, 0, -12])],
  lockR: [kf(0, [2, 0, -3]), kf(1.4, [4, 0, -6]), kf(2.8, [2, 0, -3])],
  lockL: [kf(0, [-2, 0, 3]), kf(1.4, [-3, 0, 5]), kf(2.8, [-2, 0, 3])],
  ahoge: [kf(0), kf(1.4, [6, 8, 0]), kf(2.8)],
  peplum: [kf(0, [2, 0, 0]), kf(1.4, [4, 1, 0]), kf(2.8, [2, 0, 0])],
  papers: [kf(0), kf(1.4, [3, 0, 2]), kf(2.8)],
  earR: [kf(0), kf(1.4, [0, 0, 6]), kf(2.8)],
  earL: [kf(0), kf(1.4, [0, 0, -6]), kf(2.8)],
});
await anim('prosecutor_talk', 1.4, true, {
  head: [kf(0, [0, 8, 0]), kf(0.35, [3, 12, 0]), kf(0.7, [0, 4, 0]), kf(1.05, [3, 10, 0]), kf(1.4, [0, 8, 0])],
  torso: [kf(0, [1, 5, 0]), kf(0.5, [4, 7, 0]), kf(1.4, [1, 5, 0])],
  forearmR: [kf(0, [-18, 0, 8]), kf(0.35, [-32, 0, 12]), kf(0.7, [-20, 0, 8]), kf(1.05, [-34, 0, 10]), kf(1.4, [-18, 0, 8])],
  ahoge: [kf(0), kf(0.4, [10, 0, 0]), kf(0.9, [-4, 0, 0]), kf(1.4)],
  papers: [kf(0), kf(0.4, [5, 0, 3]), kf(1.4)],
});
await anim('prosecutor_point', 1.15, false, {
  torso: [kf(0, [1, 5, 0]), kf(0.2, [6, -6, 0]), kf(0.5, [9, -10, 0]), kf(0.9, [7, -8, 0]), kf(1.15, [1, 5, 0])],
  head: [kf(0, [0, 8, 0]), kf(0.2, [-3, -8, 0]), kf(0.5, [-5, -12, 0]), kf(0.9, [-3, -10, 0]), kf(1.15, [0, 8, 0])],
  armR: [kf(0, [12, 0, 14]), kf(0.2, [-30, 0, 12]), kf(0.45, [-82, 10, 8]), kf(0.9, [-85, 10, 8]), kf(1.15, [12, 0, 14])],
  forearmR: [kf(0, [-18, 0, 8]), kf(0.2, [-8, 0, 0]), kf(0.45), kf(1.15, [-18, 0, 8])],
  handR: [kf(0), kf(0.45, [0, 0, -16]), kf(0.9, [0, 0, -18]), kf(1.15)],
  armL: [kf(0, [10, 0, -12]), kf(0.5, [14, 0, -16]), kf(1.15, [10, 0, -12])],
  lockR: [kf(0, [2, 0, -3]), kf(0.5, [8, 0, -10]), kf(1.15, [2, 0, -3])],
  ahoge: [kf(0), kf(0.45, [16, 0, 0]), kf(1.15)],
  glasses: [kf(0), kf(0.45, [-3, 0, 0]), kf(1.15)],
});
await anim('prosecutor_objection', 1.3, false, {
  torso: [kf(0, [1, 5, 0]), kf(0.12, [-5, 0, 0]), kf(0.32, [12, -7, 0]), kf(0.7, [10, -9, 0]), kf(1.05, [5, -3, 0]), kf(1.3, [1, 5, 0])],
  head: [kf(0, [0, 8, 0]), kf(0.12, [5, 0, 0]), kf(0.32, [-10, -9, 0]), kf(0.7, [-8, -11, 0]), kf(1.3, [0, 8, 0])],
  armR: [kf(0, [12, 0, 14]), kf(0.12, [22, 0, 14]), kf(0.35, [-92, 14, 6]), kf(0.75, [-95, 14, 6]), kf(1.05, [-48, 6, 6]), kf(1.3, [12, 0, 14])],
  forearmR: [kf(0, [-18, 0, 8]), kf(0.12, [-10, 0, 0]), kf(0.35), kf(1.3, [-18, 0, 8])],
  handR: [kf(0), kf(0.35, [0, 0, -20]), kf(0.75, [0, 0, -22]), kf(1.3)],
  armL: [kf(0, [10, 0, -12]), kf(0.3, [-20, 0, -18]), kf(0.75, [-14, 0, -14]), kf(1.3, [10, 0, -12])],
  lockR: [kf(0, [2, 0, -3]), kf(0.35, [14, 0, -14]), kf(1.3, [2, 0, -3])],
  lockL: [kf(0, [-2, 0, 3]), kf(0.35, [-10, 0, 10]), kf(1.3, [-2, 0, 3])],
  ahoge: [kf(0), kf(0.35, [24, 16, 0]), kf(1.3)],
  peplum: [kf(0, [2, 0, 0]), kf(0.35, [12, -4, 0]), kf(1.3, [2, 0, 0])],
  papers: [kf(0), kf(0.35, [14, 6, 8]), kf(0.7, [8, 3, 4]), kf(1.3)],
  glasses: [kf(0), kf(0.35, [-6, 0, 0]), kf(1.3)],
  earR: [kf(0), kf(0.35, [0, 0, 14]), kf(1.3)],
  earL: [kf(0), kf(0.35, [0, 0, -14]), kf(1.3)],
});

// Capture bind-ish idle first (arms down-ish)
ok(await call('set_mode', { mode_id: 'animate' }), 'animate');
ok(await call('animation_timeline', { animation_id: 'animation.prosecutor_idle', action: 'set_time', time: 0 }), 'idle0');
await shot('front', [0, 21, 58], [0, 19.5, 0]);
await shot('side', [56, 21, 0], [0, 19.5, 0]);
await shot('threequarter', [40, 23, 40], [0, 19.5, 0]);
await shot('iso', [36, 32, 36], [0, 16.5, 0], 'orthographic');
for (const [a, t, tag] of [
  ['animation.prosecutor_idle', 0.7, 'anim-idle'],
  ['animation.prosecutor_talk', 0.5, 'anim-talk'],
  ['animation.prosecutor_point', 0.5, 'anim-point'],
  ['animation.prosecutor_objection', 0.4, 'anim-objection'],
] as const) {
  ok(await call('animation_timeline', { animation_id: a, action: 'set_time', time: t }), tag);
  await shot(tag, [40, 23, 42], [0, 19.5, 0]);
}

const glbPath = path.join(OUT, 'hero.glb');
const bbPath = path.join(OUT, 'hero.bbmodel');
ok(
  await call('export_model', {
    codec_id: 'gltf',
    path: glbPath,
    overwrite: true,
    options: { encoding: 'binary', embed_textures: true, animations: true, scale: 1 },
  }),
  'glb',
);
ok(await call('export_model', { codec_id: 'project', path: bbPath, overwrite: true }), 'bbmodel');

const counts = JSON.parse(
  ok(await call('get_project_info', {}), 'info2').content?.find((c) => c.type === 'text')?.text ?? '{}',
) as { project?: { counts?: { cubes?: number } }; counts?: { cubes?: number } };
fs.writeFileSync(
  path.join(OUT, 'manifest.json'),
  JSON.stringify(
    {
      id: 'prosecutor',
      name: 'Miss Ratio',
      revision: 'v7-polished',
      source: 'Blockbench MCP free-format',
      files: { glb: 'hero.glb', bbmodel: 'hero.bbmodel' },
      rebuild: 'npx tsx tools/bbmcp/build-miss-ratio.ts',
      validate: 'node tools/bbmcp/validate-hero-glb.mjs packages/scene/assets/roam/heroes/prosecutor/hero.glb',
      counts: counts.project?.counts ?? counts.counts ?? counts,
      palette: C,
      clips: [
        { id: 'prosecutor_idle', exportName: 'animation.prosecutor_idle', loop: true, seconds: 2.8 },
        { id: 'prosecutor_talk', exportName: 'animation.prosecutor_talk', loop: true, seconds: 1.4 },
        { id: 'prosecutor_point', exportName: 'animation.prosecutor_point', loop: false, seconds: 1.15 },
        { id: 'prosecutor_objection', exportName: 'animation.prosecutor_objection', loop: false, seconds: 1.3 },
      ],
      notes: [
        'Polished craft: aligned face grid, even twin-tail taper, clean coat panels,',
        'controlled gold accents, natural hip-folder rest pose, soft value hierarchy.',
      ],
    },
    null,
    2,
  ),
);
console.error(`# wrote ${glbPath}`);
console.error('# done v7 polished');

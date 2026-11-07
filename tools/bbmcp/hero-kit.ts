/**
 * Shared Blockbench MCP helpers for CringeCourt hero builds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { callTool, connect } from './client.mjs';

export type V3 = [number, number, number];
export type El = { name: string; from: V3; to: V3 };
export interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string; data?: string }>;
}

export function ok(r: ToolResult, what: string): ToolResult {
  if (r?.isError) throw new Error(`${what}: ${(r.content ?? []).map((c) => c.text ?? '').join(' ').slice(0, 400)}`);
  return r;
}

export const call = (n: string, a: unknown) => callTool(n, a) as Promise<ToolResult>;

let n = 0;
export const resetIds = () => {
  n = 0;
};
export const id = (p: string) => `${p}_${++n}`;

export function box(name: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): El {
  return {
    name,
    from: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
    to: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
  };
}

export async function tex(name: string, hex: string) {
  ok(await call('create_texture', { name, width: 16, height: 16, fill_color: hex }), `tex ${name}`);
}
export async function group(name: string, origin: V3, parent = 'root') {
  ok(await call('add_group', { name, origin, parent }), `g ${name}`);
}
export async function put(texture: string, groupName: string, elements: El[]) {
  for (let i = 0; i < elements.length; i += 36) {
    ok(await call('place_cube', { texture, group: groupName, elements: elements.slice(i, i + 36) }), `put ${groupName}/${texture}/${i}`);
  }
}
export async function spheres(
  texture: string,
  groupName: string,
  elements: { name: string; position: V3; diameter: number; sides?: number; vertical_sides?: number }[],
) {
  ok(await call('create_sphere', { texture, group: groupName, elements }), `sph ${groupName}`);
}
export function kf(time: number, rotation?: V3, position?: V3) {
  return { time, ...(rotation ? { rotation } : {}), ...(position ? { position } : {}) };
}
export async function anim(name: string, length: number, loop: boolean, bones: Record<string, ReturnType<typeof kf>[]>) {
  ok(await call('create_animation', { name, animation_length: length, loop, bones }), `anim ${name}`);
}

export async function shot(dir: string, tag: string, position: V3, target: V3, projection: 'perspective' | 'orthographic' = 'perspective') {
  ok(await call('set_camera_angle', { projection, position, target, fov: 26 }), `cam ${tag}`);
  const r = ok(await call('capture_screenshot', { antialias: true, width: 1100, height: 825 }), `shot ${tag}`);
  const b64 = r.content?.find((c) => c.data)?.data;
  if (!b64) throw new Error(`no img ${tag}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${tag}.png`), Buffer.from(b64, 'base64'));
}

let connected = false;
export async function ensureConnect() {
  if (connected) return;
  const info = (await connect()) as { serverInfo?: { name?: string; version?: string } };
  console.error(`# ${info.serverInfo?.name} ${info.serverInfo?.version}`);
  connected = true;
}

export async function boot(project: string, colours: Record<string, string>) {
  await ensureConnect();
  console.error(`# project ${project}`);
  ok(await call('create_project', { name: project, format: 'free' }), 'create');
  resetIds();
  for (const [k, v] of Object.entries(colours)) await tex(k, v);
}

export async function exportHero(outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const glbPath = path.join(outDir, 'hero.glb');
  const bbPath = path.join(outDir, 'hero.bbmodel');
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
  return glbPath;
}

/** Standard biped groups used by every cast hero. */
export async function bipedGroups(opts?: { wide?: boolean }) {
  const arm = opts?.wide ? 5.4 : 4.9;
  await group('hips', [0, 12.6, 0]);
  await group('torso', [0, 12.6, 0], 'hips');
  await group('head', [0, 27.2, 0], 'torso');
  await group('armR', [arm, 26.1, 0], 'torso');
  await group('forearmR', [arm, 19.8, 0], 'armR');
  await group('handR', [arm, 14.2, 0], 'forearmR');
  await group('armL', [-arm, 26.1, 0], 'torso');
  await group('forearmL', [-arm, 19.8, 0], 'armL');
  await group('handL', [-arm, 14.2, 0], 'forearmL');
  await group('legR', [1.85, 12.6, 0], 'hips');
  await group('legL', [-1.85, 12.6, 0], 'hips');
  await group('prop', [arm, 13.2, 1.4], 'handR');
}

export async function basicLegs(skirt = 'skirt', shoe = 'secondary') {
  await put(skirt, 'legR', [
    box(id('thR'), 0.7, 8.9, -1.1, 3.0, 12.6, 1.2),
    box(id('cfR'), 0.9, 1.7, -0.95, 2.8, 9.0, 1.1),
  ]);
  await put(shoe, 'legR', [
    box(id('shR'), 0.7, 0.1, -0.2, 3.0, 0.95, 2.7),
    box(id('heelR'), 1.1, 0.0, -1.35, 2.6, 0.45, -0.1),
  ]);
  await put(skirt, 'legL', [
    box(id('thL'), -3.0, 8.9, -1.1, -0.7, 12.6, 1.2),
    box(id('cfL'), -2.8, 1.7, -0.95, -0.9, 9.0, 1.1),
  ]);
  await put(shoe, 'legL', [
    box(id('shL'), -3.0, 0.1, -0.2, -0.7, 0.95, 2.7),
    box(id('heelL'), -2.6, 0.0, -1.35, -1.1, 0.45, -0.1),
  ]);
}

export async function basicArms(primary = 'primary', accent = 'accent', skin = 'skin', wide = false) {
  const a = wide ? 5.4 : 4.9;
  await put(primary, 'armR', [box(id('uR'), a - 1.0, 20.0, -1.1, a + 1.15, 26.4, 1.15)]);
  await put(primary, 'forearmR', [
    box(id('lR'), a - 0.95, 14.5, -1.0, a + 1.05, 20.2, 1.0),
    box(id('cufR'), a - 1.05, 14.25, -1.1, a + 1.15, 15.15, 1.1),
  ]);
  await put(accent, 'forearmR', [box(id('cufRi'), a - 0.9, 14.4, -0.85, a + 1.0, 14.95, 0.85)]);
  await put(skin, 'handR', [
    box(id('palmR'), a - 0.75, 12.95, -0.9, a + 0.9, 14.55, 0.9),
    box(id('iR'), a - 0.35, 11.5, 0.3, a + 0.1, 13.1, 2.0),
    box(id('mR'), a + 0.05, 11.7, 0.1, a + 0.45, 13.1, 1.7),
  ]);
  await put(primary, 'armL', [box(id('uL'), -a - 1.15, 20.0, -1.1, -a + 1.0, 26.4, 1.15)]);
  await put(primary, 'forearmL', [
    box(id('lL'), -a - 1.05, 14.5, -1.0, -a + 0.95, 20.2, 1.0),
    box(id('cufL'), -a - 1.15, 14.25, -1.1, -a + 1.05, 15.15, 1.1),
  ]);
  await put(accent, 'forearmL', [box(id('cufLi'), -a - 1.0, 14.4, -0.85, -a + 0.9, 14.95, 0.85)]);
  await put(skin, 'handL', [
    box(id('palmL'), -a - 0.9, 12.95, -0.9, -a + 0.75, 14.55, 0.9),
    box(id('iL'), -a - 0.1, 11.9, 0.2, -a + 0.35, 13.1, 1.55),
  ]);
}

export async function basicFace(opts?: { iris?: string; browRaise?: boolean }) {
  const iris = opts?.iris ?? 'iris';
  await spheres('skin', 'head', [{ name: 'skull', position: [0, 31.4, 0.1], diameter: 8.0, sides: 20, vertical_sides: 14 }]);
  await put('skin', 'head', [box(id('face'), -3.0, 29.4, 0.4, 3.0, 33.5, 3.4)]);
  await put('skinSh', 'head', [
    box(id('jaw'), -2.5, 28.4, -1.0, 2.5, 30.0, 2.8),
    box(id('chin'), -1.15, 28.05, 1.45, 1.15, 28.95, 3.2),
  ]);
  const eyeX = 1.4;
  await put('eye', 'head', [
    box(id('ewR'), eyeX - 0.9, 31.4, 3.15, eyeX + 0.9, 32.7, 4.05),
    box(id('ewL'), -eyeX - 0.9, 31.4, 3.15, -eyeX + 0.9, 32.7, 4.05),
  ]);
  await put(iris, 'head', [
    box(id('irR'), eyeX - 0.45, 31.5, 3.8, eyeX + 0.45, 32.45, 4.3),
    box(id('irL'), -eyeX - 0.45, 31.5, 3.8, -eyeX + 0.45, 32.45, 4.3),
  ]);
  await put('pupil', 'head', [
    box(id('puR'), eyeX - 0.2, 31.7, 4.15, eyeX + 0.2, 32.15, 4.5),
    box(id('puL'), -eyeX - 0.2, 31.7, 4.15, -eyeX + 0.2, 32.15, 4.5),
  ]);
  await put('accentWarm', 'head', [
    box(id('spR'), eyeX + 0.1, 32.15, 4.25, eyeX + 0.35, 32.4, 4.5),
    box(id('spL'), -eyeX - 0.35, 32.15, 4.25, -eyeX - 0.1, 32.4, 4.5),
  ]);
  await put('brow', 'head', [
    box(id('brR'), eyeX - 1.0, 32.9, 3.35, eyeX + 1.1, 33.4, 4.15),
    box(id('brL'), -eyeX - 1.1, opts?.browRaise ? 33.05 : 32.9, 3.35, -eyeX + 1.0, opts?.browRaise ? 33.55 : 33.4, 4.15),
  ]);
  await put('blush', 'head', [
    box(id('blR'), 1.85, 30.5, 2.8, 2.95, 31.3, 3.55),
    box(id('blL'), -2.95, 30.5, 2.8, -1.85, 31.3, 3.55),
  ]);
  await put('skin', 'head', [box(id('nose'), -0.35, 30.8, 3.45, 0.35, 31.5, 4.15)]);
  await put('lip', 'head', [
    box(id('lipU'), -0.8, 30.0, 3.25, 0.8, 30.4, 3.9),
    box(id('lipD'), -0.6, 29.75, 3.15, 0.6, 30.1, 3.8),
  ]);
}

export const SHARED_SKIN = {
  skin: '#E2B294',
  skinSh: '#C08A6A',
  skinHi: '#EBC7AB',
  eye: '#FFF8F2',
  pupil: '#10080C',
  brow: '#0C080A',
  blush: '#E49A92',
  lip: '#A63A48',
  accentWarm: '#FFF9F0',
  accent: '#F3EDE2',
  accentSh: '#D9CFC0',
  trim: '#C9A84E',
  trimHi: '#E8D078',
  secondary: '#1C1820',
  skirt: '#26222C',
  paper: '#FFF9F0',
  ink: '#2A2430',
} as const;

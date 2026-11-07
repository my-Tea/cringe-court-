/**
 * Build the four CringeCourt hero agents in Blockbench via MCP only.
 *
 *   npx tsx tools/bbmcp/build-heroes.ts
 *
 * Requires Blockbench desktop + MCP plugin at http://localhost:3000/bb-mcp.
 * Opens a new project tab per hero (never closes existing tabs).
 * Writes:
 *   packages/scene/assets/roam/heroes/{id}/hero.glb
 *   packages/scene/assets/roam/heroes/{id}/hero.bbmodel
 *   .bbshots/heroes/{id}-*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool, connect } from './client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const HEROES = path.join(ROOT, 'packages/scene/assets/roam/heroes');
const SHOTS = path.join(ROOT, '.bbshots/heroes');

type V3 = [number, number, number];
interface Cube {
  name: string;
  from: V3;
  to: V3;
  origin?: V3;
  texture: string;
  group: string;
}

interface HeroDef {
  id: 'prosecutor' | 'defense' | 'judge' | 'clerk';
  label: string;
  colours: Record<string, string>;
  cubes: () => Cube[];
  groups: { name: string; origin: V3; parent?: string }[];
}

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
}

function ok(result: ToolResult, what: string): ToolResult {
  if (result?.isError) {
    const detail = (result.content ?? []).map((c) => c.text ?? '').join(' ').slice(0, 500);
    throw new Error(`${what} failed: ${detail}`);
  }
  return result;
}

const call = (name: string, args: unknown) => callTool(name, args) as Promise<ToolResult>;

const box = (name: string, f: V3, t: V3, texture: string, group: string, origin?: V3): Cube => ({
  name,
  from: f,
  to: t,
  texture,
  group,
  origin: origin ?? [(f[0] + t[0]) / 2, f[1], (f[2] + t[2]) / 2],
});

/** Shared biped scaffold; each hero overrides silhouette accents. */
function biped(opts: {
  primary: string;
  secondary: string;
  accent: string;
  hair: string;
  skin: string;
  trim: string;
  torsoW: number;
  torsoH: number;
  hairCubes: Cube[];
  propCubes: Cube[];
  extras?: Cube[];
}): Cube[] {
  const { primary, secondary, accent, hair, skin, trim, torsoW, torsoH } = opts;
  const legH = 14;
  const hw = torsoW / 2;
  const out: Cube[] = [
    box('legR', [1.2, 0, -2], [5.2, legH, 2.2], secondary, 'legR'),
    box('legL', [-5.2, 0, -2], [-1.2, legH, 2.2], secondary, 'legL'),
    box('shoeR', [0.8, 0, -1.2], [5.6, 1.6, 3.4], secondary, 'legR'),
    box('shoeL', [-5.6, 0, -1.2], [-0.8, 1.6, 3.4], secondary, 'legL'),
    box('torso', [-hw, legH, -3], [hw, legH + torsoH, 3.2], primary, 'torso'),
    box('collar', [-3.4, legH + torsoH - 2.2, -2.2], [3.4, legH + torsoH + 0.4, 3.6], accent, 'torso'),
    // Arms hang down from the shoulder pivot (not raised T-pose).
    box('armR', [hw - 0.2, legH + torsoH - 3 - 12, -1.6], [hw + 3.4, legH + torsoH - 3, 1.6], primary, 'armR', [hw + 1.6, legH + torsoH - 3, 0]),
    box('armL', [-hw - 3.4, legH + torsoH - 3 - 12, -1.6], [-hw + 0.2, legH + torsoH - 3, 1.6], primary, 'armL', [-hw - 1.6, legH + torsoH - 3, 0]),
    box('handR', [hw + 0.2, legH + torsoH - 3 - 13.2, -1.4], [hw + 3.2, legH + torsoH - 3 - 11.2, 1.4], skin, 'armR'),
    box('handL', [-hw - 3.2, legH + torsoH - 3 - 13.2, -1.4], [-hw - 0.2, legH + torsoH - 3 - 11.2, 1.4], skin, 'armL'),
    box('head', [-5, legH + torsoH + 0.2, -4.5], [5, legH + torsoH + 10.4, 4.5], skin, 'head', [0, legH + torsoH + 0.2, 0]),
    box('eyeR', [1.1, legH + torsoH + 5.6, 4.1], [2.7, legH + torsoH + 7.0, 5.0], trim, 'head'),
    box('eyeL', [-2.7, legH + torsoH + 5.6, 4.1], [-1.1, legH + torsoH + 7.0, 5.0], trim, 'head'),
    box('pupilR', [1.5, legH + torsoH + 5.9, 4.7], [2.3, legH + torsoH + 6.7, 5.2], hair, 'head'),
    box('pupilL', [-2.3, legH + torsoH + 5.9, 4.7], [-1.5, legH + torsoH + 6.7, 5.2], hair, 'head'),
    box('browR', [0.9, legH + torsoH + 7.1, 4.3], [2.9, legH + torsoH + 7.6, 5.0], hair, 'head'),
    box('browL', [-2.9, legH + torsoH + 7.1, 4.3], [-0.9, legH + torsoH + 7.6, 5.0], hair, 'head'),
    box('mouth', [-1.4, legH + torsoH + 3.4, 4.3], [1.4, legH + torsoH + 4.0, 4.9], trim, 'head'),
    ...opts.hairCubes,
    ...opts.propCubes,
    ...(opts.extras ?? []),
  ];
  return out;
}

const HERO_DEFS: HeroDef[] = [
  {
    id: 'prosecutor',
    label: 'Miss Ratio',
    colours: {
      primary: '#6B1C2E',
      secondary: '#2A2430',
      accent: '#F3EDE2',
      hair: '#1A1214',
      skin: '#D4A574',
      trim: '#C9A227',
    },
    groups: [
      { name: 'root', origin: [0, 0, 0] },
      { name: 'legR', origin: [3.2, 0, 0], parent: 'root' },
      { name: 'legL', origin: [-3.2, 0, 0], parent: 'root' },
      { name: 'torso', origin: [0, 14, 0], parent: 'root' },
      { name: 'armR', origin: [6.2, 25, 0], parent: 'torso' },
      { name: 'armL', origin: [-6.2, 25, 0], parent: 'torso' },
      { name: 'head', origin: [0, 28.2, 0], parent: 'torso' },
    ],
    cubes: () => {
      const legH = 14;
      const torsoH = 14;
      return biped({
        primary: 'primary',
        secondary: 'secondary',
        accent: 'accent',
        hair: 'hair',
        skin: 'skin',
        trim: 'trim',
        torsoW: 10,
        torsoH,
        hairCubes: [
          box('mane', [-5.4, legH + torsoH + 6.5, -5.2], [5.4, legH + torsoH + 11.2, 2.5], 'hair', 'head'),
          box('lock', [3.2, legH + torsoH + 2.5, 0.5], [6.4, legH + torsoH + 11.5, 3.8], 'hair', 'head'),
          box('bangs', [-4, legH + torsoH + 8.5, 2.5], [2.5, legH + torsoH + 10.8, 5.0], 'hair', 'head'),
        ],
        propCubes: [
          box('folder', [5.5, 14 + 14 - 3 - 13.5, 1.5], [10.5, 14 + 14 - 3 - 6.5, 2.7], 'accent', 'armR'),
          box('stripe', [5.4, 14 + 14 - 3 - 8.5, 1.4], [10.6, 14 + 14 - 3 - 7.5, 2.8], 'primary', 'armR'),
        ],
        extras: [box('lapel', [-1.2, 18, 3.0], [1.2, 24, 3.6], 'trim', 'torso')],
      });
    },
  },
  {
    id: 'defense',
    label: 'Counsel Chaos',
    colours: {
      primary: '#1F4D3A',
      secondary: '#1C2430',
      accent: '#F0E6D2',
      hair: '#2B1F14',
      skin: '#C9956A',
      trim: '#B08D57',
    },
    groups: [
      { name: 'root', origin: [0, 0, 0] },
      { name: 'legR', origin: [3.2, 0, 0], parent: 'root' },
      { name: 'legL', origin: [-3.2, 0, 0], parent: 'root' },
      { name: 'torso', origin: [0, 14, 0], parent: 'root' },
      { name: 'armR', origin: [7, 25, 0], parent: 'torso' },
      { name: 'armL', origin: [-7, 25, 0], parent: 'torso' },
      { name: 'head', origin: [0, 28.2, 0], parent: 'torso' },
    ],
    cubes: () => {
      const legH = 14;
      const torsoH = 14;
      return biped({
        primary: 'primary',
        secondary: 'secondary',
        accent: 'accent',
        hair: 'hair',
        skin: 'skin',
        trim: 'trim',
        torsoW: 11.5,
        torsoH,
        hairCubes: [
          box('quiff', [-3.8, legH + torsoH + 8.5, -3], [3.8, legH + torsoH + 14.5, 3.5], 'hair', 'head'),
          box('sides', [-5.6, legH + torsoH + 5, -4.8], [5.6, legH + torsoH + 9.5, 3], 'hair', 'head'),
        ],
        propCubes: [
          box('case', [5.8, 14 + 14 - 3 - 13.2, 0.8], [12.2, 14 + 14 - 3 - 8.6, 3.2], 'secondary', 'armR'),
          box('latch', [8.4, 14 + 14 - 3 - 11.2, 3.0], [9.6, 14 + 14 - 3 - 10.6, 3.6], 'trim', 'armR'),
        ],
        extras: [box('tie', [-0.7, 20, 3.0], [0.7, 26, 3.7], 'trim', 'torso')],
      });
    },
  },
  {
    id: 'judge',
    label: 'Judge Gavel.exe',
    colours: {
      primary: '#121826',
      secondary: '#2C3344',
      accent: '#F4F0E8',
      hair: '#D8D4CC',
      skin: '#C9A882',
      trim: '#C9A227',
    },
    groups: [
      { name: 'root', origin: [0, 0, 0] },
      { name: 'legR', origin: [3.2, 0, 0], parent: 'root' },
      { name: 'legL', origin: [-3.2, 0, 0], parent: 'root' },
      { name: 'torso', origin: [0, 14, 0], parent: 'root' },
      { name: 'armR', origin: [8, 26, 0], parent: 'torso' },
      { name: 'armL', origin: [-8, 26, 0], parent: 'torso' },
      { name: 'head', origin: [0, 30.2, 0], parent: 'torso' },
    ],
    cubes: () => {
      const legH = 14;
      const torsoH = 16;
      return biped({
        primary: 'primary',
        secondary: 'secondary',
        accent: 'accent',
        hair: 'hair',
        skin: 'skin',
        trim: 'trim',
        torsoW: 14,
        torsoH,
        hairCubes: [
          box('silver', [-5.6, legH + torsoH + 6.8, -5], [5.6, legH + torsoH + 11, 2.8], 'hair', 'head'),
          box('beard', [-3.4, legH + torsoH + 0.5, 1.5], [3.4, legH + torsoH + 4.2, 5.2], 'accent', 'head'),
        ],
        propCubes: [
          box('gavel_handle', [6.5, 14 + 16 - 3 - 14.5, 1.2], [8.0, 14 + 16 - 3 - 4.5, 2.6], 'trim', 'armR'),
          box('gavel_head', [5.2, 14 + 16 - 3 - 5.8, 0.2], [9.4, 14 + 16 - 3 - 2.8, 3.6], 'trim', 'armR'),
        ],
        extras: [
          box('fur', [-6.5, 14 + 16 - 2.5, -3.5], [6.5, 14 + 16 + 0.8, 4.0], 'accent', 'torso'),
          box('robe_flare', [-8, 14, -4], [8, 18, 4.2], 'primary', 'torso'),
        ],
      });
    },
  },
  {
    id: 'clerk',
    label: 'Clerk Ctrl+S',
    colours: {
      primary: '#5B7A8C',
      secondary: '#3D5160',
      accent: '#F0EADF',
      hair: '#3A2E28',
      skin: '#D2A98C',
      trim: '#8FA5B3',
    },
    groups: [
      { name: 'root', origin: [0, 0, 0] },
      { name: 'legR', origin: [3.2, 0, 0], parent: 'root' },
      { name: 'legL', origin: [-3.2, 0, 0], parent: 'root' },
      { name: 'torso', origin: [0, 14, 0], parent: 'root' },
      { name: 'armR', origin: [6.2, 25, 0], parent: 'torso' },
      { name: 'armL', origin: [-6.2, 25, 0], parent: 'torso' },
      { name: 'head', origin: [0, 28.2, 0], parent: 'torso' },
    ],
    cubes: () => {
      const legH = 14;
      const torsoH = 14;
      return biped({
        primary: 'primary',
        secondary: 'secondary',
        accent: 'accent',
        hair: 'hair',
        skin: 'skin',
        trim: 'trim',
        torsoW: 10,
        torsoH,
        hairCubes: [
          box('top', [-5.2, legH + torsoH + 7.5, -5], [5.2, legH + torsoH + 10.5, 3.5], 'hair', 'head'),
          box('bun', [-2.2, legH + torsoH + 9.8, -6.2], [2.2, legH + torsoH + 13.2, -2.2], 'hair', 'head'),
        ],
        propCubes: [
          box('board', [5.6, 14 + 14 - 3 - 13.8, 1.4], [11.2, 14 + 14 - 3 - 6.2, 2.0], 'accent', 'armR'),
          box('clip', [7.4, 14 + 14 - 3 - 7.0, 1.2], [9.4, 14 + 14 - 3 - 5.8, 2.2], 'trim', 'armR'),
        ],
      });
    },
  },
];

async function shot(id: string, tag: string, projection: 'perspective' | 'orthographic', position: V3, target: V3): Promise<void> {
  ok(await call('set_camera_angle', { projection, position, target, fov: 36 }), `camera ${id} ${tag}`);
  const r = ok(await call('capture_screenshot', { antialias: true, width: 960, height: 720 }), `shot ${id} ${tag}`);
  const img = r.content?.find((c) => c.type === 'image' || c.data);
  const b64 = img?.data;
  if (!b64) throw new Error(`no image data for ${id} ${tag}`);
  fs.writeFileSync(path.join(SHOTS, `${id}-${tag}.png`), Buffer.from(b64, 'base64'));
}

async function buildHero(hero: HeroDef): Promise<void> {
  const outDir = path.join(HEROES, hero.id);
  fs.mkdirSync(outDir, { recursive: true });
  console.error(`# building ${hero.label} (${hero.id})`);

  ok(await call('create_project', { name: `CC_${hero.id}`, format: 'free' }), `create ${hero.id}`);

  for (const [name, hex] of Object.entries(hero.colours)) {
    ok(await call('create_texture', { name, width: 16, height: 16, fill_color: hex }), `tex ${name}`);
  }

  for (const g of hero.groups) {
    ok(await call('add_group', { name: g.name, origin: g.origin, parent: g.parent ?? 'root' }), `group ${g.name}`);
  }

  const cubes = hero.cubes();
  // place_cube takes top-level texture + group; batch by both.
  const batches = new Map<string, Cube[]>();
  for (const c of cubes) {
    const key = `${c.group}::${c.texture}`;
    const list = batches.get(key) ?? [];
    list.push(c);
    batches.set(key, list);
  }
  for (const [key, list] of batches) {
    const [group, tex] = key.split('::') as [string, string];
    for (let i = 0; i < list.length; i += 40) {
      const chunk = list.slice(i, i + 40);
      ok(
        await call('place_cube', {
          texture: tex,
          group,
          elements: chunk.map((c) => ({ name: c.name, from: c.from, to: c.to, origin: c.origin })),
        }),
        `cubes ${hero.id} ${key}[${i}]`,
      );
    }
  }

  const info = ok(await call('get_project_info', {}), `info ${hero.id}`);
  console.error(`  cubes asked=${cubes.length} info=${info.content?.find((c) => c.type === 'text')?.text?.slice(0, 180)}`);

  const glbPath = path.join(outDir, 'hero.glb');
  const bbPath = path.join(outDir, 'hero.bbmodel');
  ok(
    await call('export_model', {
      codec_id: 'gltf',
      path: glbPath,
      overwrite: true,
      options: { encoding: 'binary', embed_textures: true, scale: 1 },
    }),
    `export glb ${hero.id}`,
  );
  ok(await call('export_model', { codec_id: 'project', path: bbPath, overwrite: true }), `export bbmodel ${hero.id}`);

  await shot(hero.id, 'front', 'perspective', [0, 28, 70], [0, 22, 0]);
  await shot(hero.id, 'threequarter', 'perspective', [48, 32, 52], [0, 22, 0]);
  console.error(`  wrote ${glbPath}`);
}

fs.mkdirSync(SHOTS, { recursive: true });
const info = (await connect()) as { serverInfo?: { name?: string; version?: string } };
console.error(`# ${info.serverInfo?.name} ${info.serverInfo?.version}`);

for (const hero of HERO_DEFS) {
  await buildHero(hero);
}
console.error('# done — heroes built via Blockbench MCP only');

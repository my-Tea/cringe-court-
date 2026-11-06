// Build the courthouse grounds and the arrival islands in Blockbench through
// MCP: the same boxes the roaming court draws (world/plaza.ts, courthouse.ts,
// approach.ts), in a fresh project tab, coloured with the style-guide palette,
// grouped by swatch so they can be edited, then photographed.
//
//   npx tsx tools/bbmcp/preview-grounds.ts     build + four shots
//
// The project (~3,100 cubes) is too large to return over MCP; save it from
// Blockbench itself (File → Save Project) if an editable .bbmodel is wanted.
//
// Requires Blockbench running with the MCP plugin loaded (http://localhost:3000/bb-mcp).
// Opens a new project tab; it never touches a project that is already open.
// Writes PNGs to .bbshots/grounds/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { C } from '../../packages/scene/src/roam/palette';
import { ROOM_SCALE } from '../../packages/scene/src/roam/scale';
import { approachBoxes, approachGates } from '../../packages/scene/src/roam/world/approach';
import { groundsBoxes } from '../../packages/scene/src/roam/world/plaza';
import { callTool, connect } from './client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const OUT = path.join(ROOT, '.bbshots', 'grounds');

interface Box {
  f: readonly number[];
  t: readonly number[];
  m: string;
}

interface ToolResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string; data?: string }>;
}

function ok(result: ToolResult, what: string): ToolResult {
  if (result?.isError) {
    const detail = (result.content ?? []).map((c) => c.text ?? '').join(' ').slice(0, 400);
    throw new Error(`${what} failed: ${detail}`);
  }
  return result;
}

const call = (name: string, args: unknown) => callTool(name, args) as Promise<ToolResult>;

/** Swatch name for a hex (`royal700`), so groups and textures read like the style guide. */
const SWATCH = new Map(Object.entries(C).map(([name, hex]) => [hex.toUpperCase(), name]));

// The world builder grows X and Z; do the same so Blockbench shows in-game proportions.
const scale = (b: Box): Box => ({ m: b.m.toUpperCase(), f: [b.f[0]! * ROOM_SCALE, b.f[1]!, b.f[2]! * ROOM_SCALE], t: [b.t[0]! * ROOM_SCALE, b.t[1]!, b.t[2]! * ROOM_SCALE] });
const boxes: Box[] = [...groundsBoxes(), ...approachBoxes(), ...approachGates().flatMap((g) => g.boxes)].map(scale);

const byColour = new Map<string, Box[]>();
for (const b of boxes) {
  const list = byColour.get(b.m) ?? [];
  list.push(b);
  byColour.set(b.m, list);
}

const info = (await connect()) as { serverInfo?: { name?: string; version?: string } };
console.error(`# ${info.serverInfo?.name} ${info.serverInfo?.version}: ${boxes.length} boxes in ${byColour.size} swatches`);
fs.mkdirSync(OUT, { recursive: true });

ok(await call('create_project', { name: 'CC_Grounds', format: 'free' }), 'create_project');
for (const [hex, list] of byColour) {
  const name = SWATCH.get(hex) ?? hex.slice(1);
  ok(await call('create_texture', { name, width: 16, height: 16, fill_color: hex }), `create_texture ${name}`);
  ok(await call('add_group', { name: `g_${name}` }), `add_group ${name}`);
  for (let i = 0; i < list.length; i += 200) {
    const elements = list.slice(i, i + 200).map((b, j) => ({ name: `${name}_${i + j}`, from: b.f, to: b.t, origin: [0, 0, 0] }));
    ok(await call('place_cube', { elements, texture: name, group: `g_${name}` }), `place_cube ${name}[${i}]`);
  }
}
const counts = JSON.parse(ok(await call('get_project_info', {}), 'get_project_info').content?.find((c) => c.type === 'text')?.text ?? '{}') as { counts?: { cubes?: number } };
if (counts.counts?.cubes !== boxes.length) throw new Error(`asked for ${boxes.length} cubes, Blockbench has ${counts.counts?.cubes}`);
console.log(`placed ${boxes.length} cubes`);

/** Shots: the whole run from above the arrival island, the courthouse front, the plaza, the hall of trials. */
const SHOTS: ReadonlyArray<{ file: string; position: number[]; target: number[]; projection: 'perspective' | 'orthographic' }> = [
  { file: 'overview', position: [-1900, 1500, 3900], target: [0, -60, 1150], projection: 'perspective' },
  { file: 'courthouse', position: [-260, 120, 700], target: [0, 60, 380], projection: 'perspective' },
  { file: 'plaza', position: [420, 260, 1050], target: [0, -20, 640], projection: 'perspective' },
  { file: 'arrival', position: [300, 160, 2350], target: [0, 0, 1980], projection: 'perspective' },
];
for (const s of SHOTS) {
  const res = ok(await call('set_camera_angle', { position: s.position, target: s.target, projection: s.projection, max_size: 1400, format: 'png' }), `set_camera_angle ${s.file}`);
  const img = res.content?.find((c) => c.type === 'image');
  if (!img?.data) throw new Error(`${s.file}: no image`);
  const file = path.join(OUT, `${s.file}.png`);
  fs.writeFileSync(file, Buffer.from(img.data, 'base64'));
  console.log(`shot → ${path.relative(ROOT, file)}`);
}

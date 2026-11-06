// Render the town's buildings in Blockbench through MCP so they can be looked
// at before they reach the browser.
//
//   node tools/bbmcp/preview-town.mjs                 every model, one capture each
//   node tools/bbmcp/preview-town.mjs courthouse      one model
//   node tools/bbmcp/preview-town.mjs --sheet         one wide sheet of all models
//
// Requires Blockbench running with the MCP plugin loaded (http://localhost:3000/bb-mcp).
// Reads cc-art/dist/town/buildings.json; writes PNGs to .bbshots/town/.
//
// Every call is checked: the MCP server reports validation failures as
// `isError` with HTTP 200, so a silent no-op is the easy failure here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool, connect } from './client.mjs';
import { contentBounds } from './measure.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const OUT = path.join(ROOT, '.bbshots', 'town');
const DATA = path.join(ROOT, 'cc-art/dist/town/buildings.json');
const MAX_SIZE = 900;

const args = process.argv.slice(2);
const sheet = args.includes('--sheet');
const only = args.filter((a) => !a.startsWith('--'));

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const models = Object.entries(data.props).filter(([name]) => !only.length || only.includes(name));
if (!models.length) {
  console.error(`no such model. available: ${Object.keys(data.props).join(', ')}`);
  process.exit(2);
}

/** Fail loudly instead of silently continuing with an empty project. */
function ok(result, what) {
  if (result?.isError) {
    const detail = (result.content ?? []).map((c) => c.text ?? '').join(' ').slice(0, 400);
    throw new Error(`${what} failed: ${detail}`);
  }
  return result;
}

/** Text payload of a tool result that returns JSON as text. */
function jsonPayload(result) {
  const text = (result?.content ?? []).find((c) => c.type === 'text')?.text ?? '{}';
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Frame a model by measuring, not by guessing.
 *
 * Blockbench's orthographic `zoom` is a multiplier on a viewport frustum (~30×20
 * world units at zoom 1) whose exact size depends on the host window, so a
 * formula from the model's size alone drifts and silently clips. Instead: take a
 * shot, measure how much of the frame the model actually fills, and correct the
 * zoom by that ratio. Three iterations converge; the loop is bounded so a
 * stubborn viewport cannot spin.
 */
async function frameAndCapture(boxes, maxSize, targetFill = 0.72) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.f[i]);
      max[i] = Math.max(max[i], b.t[i]);
    }
  }
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);

  const yaw = Math.PI / 4;
  const pitch = Math.PI / 6;
  const dist = span * 3 + 200;
  const position = [
    cx + Math.sin(yaw) * Math.cos(pitch) * dist,
    cy + Math.sin(pitch) * dist,
    cz + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];

  // Seed from the calibrated frustum (~20 world units tall at zoom 1).
  let zoom = Math.max(0.004, Math.min(40, (20 * targetFill) / Math.max(8, span)));
  let best = null;
  let bestErr = Infinity;

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await callTool('set_camera_angle', {
      position,
      target: [cx, cy, cz],
      projection: 'orthographic',
      zoom,
      max_size: maxSize,
      format: 'png',
    });
    ok(res, 'set_camera_angle');
    const img = res.content?.find((c) => c.type === 'image');
    if (!img) throw new Error('set_camera_angle returned no image');

    const buf = Buffer.from(img.data, 'base64');
    const tmp = path.join(OUT, '.frame.png');
    fs.writeFileSync(tmp, buf);
    const m = contentBounds(tmp);
    if (m.empty) throw new Error('frame is empty: the camera is not looking at the model');

    const err = Math.abs(m.coverage - targetFill);
    if (!m.touchesEdge && err < bestErr) {
      bestErr = err;
      best = { buf, m, zoom };
    }
    // Clipped means the model already overflows: shrink harder than the ratio.
    if (!m.touchesEdge && err <= 0.03) break;
    const ratio = m.touchesEdge ? 0.55 : targetFill / m.coverage;
    zoom = Math.max(0.004, Math.min(40, zoom * ratio));
  }

  if (!best) throw new Error('could not frame the model without clipping it');
  return best;
}

async function freshProject(name) {
  ok(await callTool('create_project', { name, format: 'free' }), `create_project ${name}`);
}

/**
 * Add cubes. `place_cube` accepts no colour, so geometry lands in one default
 * material; colour is only cosmetic for a silhouette check, and the real colours
 * come from the box JSON at runtime. A texture is applied so faces are not pure
 * white-on-white.
 */
async function addCubes(boxes, prefix) {
  const CHUNK = 200;
  let added = 0;
  for (let i = 0; i < boxes.length; i += CHUNK) {
    const elements = boxes.slice(i, i + CHUNK).map((b, j) => ({
      name: `${prefix}_${i + j}`,
      from: [b.f[0], b.f[1], b.f[2]],
      to: [b.t[0], b.t[1], b.t[2]],
      origin: [0, 0, 0],
    }));
    ok(await callTool('place_cube', { elements }), `place_cube ${prefix}[${i}]`);
    added += elements.length;
  }
  return added;
}

/** Give the model a visible material so white faces read as geometry. */
async function applyBlockTexture() {
  const tex = path.join(ROOT, 'cc-art/dist/textures/blocks/marble_floor.png');
  if (!fs.existsSync(tex)) return null;
  const r = await callTool('create_texture', { name: 'town_preview', width: 16, height: 16, data: tex });
  if (r?.isError) return null;
  return 'town_preview';
}

async function capture(projectName, boxes, maxSize = MAX_SIZE) {
  const { buf, m, zoom } = await frameAndCapture(boxes, maxSize);
  return { buf, m, zoom };
}

const info = await connect();
console.error(`# ${info.serverInfo?.name} ${info.serverInfo?.version}`);
fs.mkdirSync(OUT, { recursive: true });

for (const [name, boxes] of models) {
  await freshProject(`CC_${name}`);
  const added = await addCubes(boxes, name);
  const count = jsonPayload(ok(await callTool('get_project_info', {}), 'get_project_info')).counts?.cubes ?? 0;
  if (count !== added) throw new Error(`${name}: asked for ${added} cubes, Blockbench has ${count}`);
  await applyBlockTexture();
  const shot = await capture(name, boxes);
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, shot.buf);
  console.log(
    `${name.padEnd(14)} ${String(boxes.length).padStart(4)} boxes → ${path.relative(ROOT, file)}` +
      ` (fill ${(shot.m.coverage * 100).toFixed(0)}%, zoom ${shot.zoom.toFixed(3)})`,
  );
}

if (sheet) {
  await freshProject('CC_TownSheet');
  const all = [];
  let x = 0;
  for (const boxes of Object.values(data.props)) {
    const minX = Math.min(...boxes.map((b) => b.f[0]));
    const maxX = Math.max(...boxes.map((b) => b.t[0]));
    const dx = x - minX;
    all.push(...boxes.map((b) => ({ ...b, f: [b.f[0] + dx, b.f[1], b.f[2]], t: [b.t[0] + dx, b.t[1], b.t[2]] })));
    x += maxX - minX + 40;
  }
  await addCubes(all, 'sheet');
  await applyBlockTexture();
  const shot = await capture('_sheet', all, 1800);
  const file = path.join(OUT, '_sheet.png');
  fs.writeFileSync(file, shot.buf);
  console.log(`sheet → ${path.relative(ROOT, file)} (fill ${(shot.m.coverage * 100).toFixed(0)}%)`);
}

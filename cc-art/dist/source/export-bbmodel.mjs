// Regenerates dist/models/CringeCourt_Props.bbmodel from props.mjs (every prop,
// detail layer included). Deterministic: UUIDs are derived from names, texture
// order is first-use order, and nothing depends on time or randomness, so
// re-running produces a byte-identical file.
//
// Format matches the Blockbench "free" model (format_version 5.0) the earlier
// hand-built file used: one root group per prop, one cube per box named
// `<prop>__<n>` (n = running index across the file), one 16x16 solid-colour
// texture per hex material named `p_<HEX>`, every face UV [0,0,1,1].
//
//   node export-bbmodel.mjs            # writes dist/models/CringeCourt_Props.bbmodel
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { PROPS, PROP_NAMES } from './props.mjs';

const OUT = process.argv[2] || './dist/models/CringeCourt_Props.bbmodel';

/** Stable v4-shaped uuid from a string. */
const uuid = (s) => {
  const h = createHash('sha1').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const hashInt = (s) => parseInt(createHash('sha1').update(s).digest('hex').slice(0, 6), 16);

const solidPng = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const png = new PNG({ width: 16, height: 16 });
  for (let i = 0; i < 256; i++) png.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  return 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
};

const textures = [], texIndex = new Map();
const texFor = (hex) => {
  const key = hex.toUpperCase();
  if (!texIndex.has(key)) {
    const id = textures.length;
    texIndex.set(key, id);
    textures.push({
      name: `p_${key.slice(1)}`, path: '', folder: '', namespace: '', id: String(id), group: '', scope: 0,
      width: 16, height: 16, uv_width: 16, uv_height: 16, particle: false, use_as_default: false,
      layers_enabled: false, sync_to_project: '', file_format: 'png', render_mode: 'default',
      render_sides: 'auto', wrap_mode: 'limited', pbr_channel: 'color', fps: 7, frame_time: 1,
      frame_order_type: 'loop', frame_order: '', frame_interpolate: false, visible: true,
      internal: true, saved: false, uuid: uuid(`texture:${key}`), source: solidPng(key),
    });
  }
  return texIndex.get(key);
};

const elements = [], groups = [], outliner = [];
let n = 0;
for (const name of PROP_NAMES) {
  const gid = uuid(`group:${name}`);
  const children = [];
  for (const bx of PROPS[name].parts) {
    const tex = texFor(bx.m);
    const face = { uv: [0, 0, 1, 1], texture: tex };
    const ename = `${name}__${n}`;
    const eid = uuid(`element:${ename}`);
    elements.push({
      name: ename, box_uv: false, render_order: 'default', locked: false, export: true, scope: 0,
      allow_mirror_modeling: true, from: bx.f, to: bx.t, autouv: 0, color: hashInt(ename) % 10,
      origin: [0, 0, 0], faces: { north: face, east: { ...face }, south: { ...face }, west: { ...face }, up: { ...face }, down: { ...face } },
      type: 'cube', uuid: eid,
    });
    children.push(eid);
    n++;
  }
  groups.push({
    name, uuid: gid, export: true, locked: false, scope: 0, selected: false,
    _static: { properties: {}, temp_data: {} }, origin: [0, 0, 0], rotation: [0, 0, 0], color: 0,
    children: [], reset: false, shade: true, mirror_uv: false, visibility: true, autouv: 0,
    isOpen: false, primary_selected: false,
  });
  outliner.push({ uuid: gid, isOpen: false, children });
}

const model = {
  meta: { format_version: '5.0', model_format: 'free', box_uv: false },
  name: 'CringeCourt_Props_v2', model_identifier: '', visible_box: [1, 1, 0],
  variable_placeholders: '', multi_file_ruleset: '', variable_placeholder_buttons: [], timeline_setups: [],
  unhandled_root_fields: {}, ai_used: true, ai_agents: 'autoclaw', resolution: { width: 16, height: 16 },
  elements, groups, outliner, textures,
};
fs.mkdirSync(OUT.replace(/[^/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(model));
console.log(`bbmodel: ${groups.length} groups, ${elements.length} elements, ${textures.length} textures -> ${OUT}`);

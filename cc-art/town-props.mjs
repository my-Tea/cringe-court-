// Emit the existing prop library as plain game boxes, so the isometric town
// reuses the 53 props that are already modelled instead of re-authoring them.
//
//   node cc-art/town-props.mjs            write cc-art/dist/town/props.json
//   node cc-art/town-props.mjs --check    fail if the file is stale
//
// The town scales every prop by TOWN_SCALE so a person (50 units) is ~1.8 cells
// tall and a bench is ~1 cell — Minecraft proportions. cc-art authors props at
// 1 unit = 1 pixel, which is smaller than that, so the scale lives here rather
// than being baked into the source models.
import fs from 'node:fs';
import path from 'node:path';
import { PROPS } from './props.mjs';

/** World units per town cell. One cell is one Minecraft-ish block. */
export const TOWN_CELL = 28;
/**
 * Props are authored at 1 unit = 1 px and the architecture is authored on
 * Blockbench's 16-unit grid; both are scaled by the same factor so one town has
 * one scale. Without this a fountain is a 1-cell puddle beside a 3-cell house.
 */
export const TOWN_SCALE = 2.2;
/** Props whose base sits above the floor and should keep their authored height. */
const OUT = path.join(import.meta.dirname, 'dist', 'town', 'props.json');

const round = (n) => Math.round(n * 1000) / 1000;

/** A prop's parts → game boxes, scaled and rounded. */
function toBoxes(parts) {
  return parts.map((b) => ({
    f: [round(b.f[0] * TOWN_SCALE), round(b.f[1] * TOWN_SCALE), round(b.f[2] * TOWN_SCALE)],
    t: [round(b.t[0] * TOWN_SCALE), round(b.t[1] * TOWN_SCALE), round(b.t[2] * TOWN_SCALE)],
    m: String(b.m).toUpperCase(),
    ...(b.glow ? { glow: b.glow } : {}),
  }));
}

/** Bounds of a prop, so the map author knows its footprint before placing it. */
function bounds(boxes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.f[i]);
      max[i] = Math.max(max[i], b.t[i]);
    }
  }
  return { min, max };
}

const props = {};
const meta = {};
for (const [name, prop] of Object.entries(PROPS)) {
  const boxes = toBoxes(prop.parts);
  props[name] = boxes;
  const b = bounds(boxes);
  meta[name] = {
    label: prop.label ?? name,
    boxes: boxes.length,
    size: [round(b.max[0] - b.min[0]), round(b.max[1] - b.min[1]), round(b.max[2] - b.min[2])],
    /** Base at or above the floor: a hung sign, a wall sconce. */
    floating: b.min[1] > 0.5,
  };
}

const payload = {
  schemaVersion: 1,
  source: 'cc-art/props.mjs',
  cell: TOWN_CELL,
  scale: TOWN_SCALE,
  props,
  meta,
};
const text = `${JSON.stringify(payload, null, 0)}\n`;

if (process.argv.includes('--check')) {
  const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (existing !== text) {
    console.error(`cc-art/town-props.mjs: ${path.relative(process.cwd(), OUT)} is stale; run "node cc-art/town-props.mjs"`);
    process.exit(1);
  }
  console.log(`town props: up to date (${Object.keys(props).length} props)`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  const bytes = Buffer.byteLength(text);
  console.log(`town props: ${Object.keys(props).length} props, ${bytes} bytes → ${path.relative(process.cwd(), OUT)}`);
}

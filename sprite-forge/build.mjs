#!/usr/bin/env node
// build.mjs — one command, full asset set, then self-check.
import { buildTiles, TILES } from './scripts/tiles.mjs';
import { buildItems } from './scripts/items.mjs';
import { buildBreak } from './scripts/break.mjs';
import { contactSheet } from './scripts/contact.mjs';
import { packSheet } from './scripts/sheet.mjs';
import { runChecks } from './scripts/check.mjs';
import { Canvas } from './scripts/core.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || './out';
fs.rmSync(OUT, { recursive: true, force: true });

const tiles = buildTiles(OUT);
const items = buildItems(OUT);
const brk = buildBreak(OUT);

// Atlas: all blocks in one uniform grid + JSON metadata (engine-ready).
const frames = Object.entries(TILES).map(([name, fn]) => ({ name, canvas: fn() }));
const { sheet, cells, cols, rows, cell } = packSheet(frames, { cols: 4, padding: 0 });
sheet.save(`${OUT}/atlas/blocks_atlas.png`);
sheet.scale(4).save(`${OUT}/atlas/blocks_atlas@4x.png`);
fs.writeFileSync(`${OUT}/atlas/blocks_atlas.json`, JSON.stringify({
  image: 'blocks_atlas.png',
  cell: { w: cell[0], h: cell[1] },
  grid: { cols, rows },
  frames: Object.fromEntries(cells.map((c) => [c.name, { x: c.x, y: c.y, w: c.w, h: c.h }])),
}, null, 2));

// Break strip metadata
fs.writeFileSync(`${OUT}/break/break_strip.json`, JSON.stringify({
  image: 'break_strip.png',
  frames: brk.cells.length,
  cell: { w: brk.cells[0].w, h: brk.cells[0].h },
  order: 'single row, left to right, stage 0 (fresh) → 9 (about to break)',
}, null, 2));

// Review sheets
contactSheet(`${OUT}/preview/tiles-contact.png`, 5, 4);
const { problems, stats } = runChecks();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ generated: new Date().toISOString(), stats, problems }, null, 2));

const count = tiles.length + items.length + 1;
console.log(`tiles: ${tiles.length}  items: ${items.length}  break frames: ${brk.cells.length}`);
console.log(`preview: ${OUT}/preview/tiles-contact.png`);
if (problems.length) { console.log('CHECKS FAILED:'); problems.forEach((p) => console.log('  x ' + p)); process.exitCode = 1; }
else console.log('checks: all passed');

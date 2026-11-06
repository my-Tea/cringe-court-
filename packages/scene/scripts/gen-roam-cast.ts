// Voxel cast for the first-person courtroom: every cc-art voxel character
// (cc-art/vox-chars.mjs, the same models the sprite poses are rendered from)
// exported as compact box lists with their rig group, colours remapped onto
// the 30-swatch palette. Standing models are unposed (the roam renderer poses
// the head and arm groups live); jurors also ship their seated geometry.
//   npm run cast -w @cringe-court/scene            regenerate assets/roam/cast.json
//   npm run cast -w @cringe-court/scene -- --check exit 1 if it is stale
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARS, JUROR_VARIANTS, type VoxBox, type VoxCharacter } from '../../../cc-art/vox-chars.mjs';
import { toPalette } from '../src/roam/palette';
import { CAST_GROUPS, type CastFile, type CastModel } from '../src/roam/cast';

const OUT = fileURLToPath(new URL('../assets/roam/cast.json', import.meta.url));

const round = (n: number) => Math.round(n * 100) / 100;

function encode(boxes: readonly VoxBox[], colors: string[]): CastModel['stand'] {
  return boxes.map((b) => {
    const m = toPalette(b.m);
    let ci = colors.indexOf(m);
    if (ci < 0) ci = colors.push(m) - 1;
    const g = CAST_GROUPS.indexOf((b.g ?? 'body') as (typeof CAST_GROUPS)[number]);
    const row: number[] = [...b.f.map(round), ...b.t.map(round), ci, g < 0 ? 0 : g];
    if (b.M) row.push(...b.M.map((v) => Math.round(v * 1e4) / 1e4));
    return row;
  });
}

export function buildCast(): CastFile {
  const colors: string[] = [];
  const models: Record<string, CastModel> = {};
  const add = (id: string, c: VoxCharacter, seated: boolean) => {
    const stand = c.parts('idle', 'neutral');
    let height = 0;
    for (const b of stand) height = Math.max(height, b.t[1]);
    models[id] = { label: c.label, height: round(height), stand: encode(stand, colors), ...(seated ? { sit: encode(c.parts('seated', 'neutral'), colors) } : {}) };
  };
  for (const [id, c] of Object.entries(CHARS)) if (id !== 'ai-narrator') add(id, c, id === 'juror');
  for (const c of Object.values(JUROR_VARIANTS)) add(c.id, c, true);
  return { version: 1, source: 'cc-art/vox-chars.mjs', colors, models };
}

export function serializeCast(cast: CastFile): string {
  // One model row per line keeps diffs reviewable without bloating the file.
  const lines = ['{', `  "version": ${cast.version},`, `  "source": ${JSON.stringify(cast.source)},`, `  "colors": ${JSON.stringify(cast.colors)},`, '  "models": {'];
  const ids = Object.keys(cast.models);
  ids.forEach((id, i) => {
    const m = cast.models[id]!;
    const parts = [`"label": ${JSON.stringify(m.label)}`, `"height": ${m.height}`, `"stand": ${JSON.stringify(m.stand)}`];
    if (m.sit) parts.push(`"sit": ${JSON.stringify(m.sit)}`);
    lines.push(`    ${JSON.stringify(id)}: { ${parts.join(', ')} }${i < ids.length - 1 ? ',' : ''}`);
  });
  lines.push('  }', '}', '');
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const text = serializeCast(buildCast());
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUT, 'utf8');
    } catch {
      /* missing counts as stale */
    }
    if (current !== text) {
      console.error('assets/roam/cast.json is stale: run `npm run cast -w @cringe-court/scene`');
      process.exit(1);
    }
    console.log('roam cast up to date');
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT} (${(text.length / 1024).toFixed(1)} KB)`);
  }
}

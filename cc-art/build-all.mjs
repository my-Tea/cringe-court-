// Regenerate every generated asset in the repo, in dependency order.
// All generators are deterministic, so on a clean checkout this must leave
// `git status` empty; `--check` enforces that and exits 1 otherwise.
//
//   cd cc-art
//   npm install --no-save pngjs        # the only dependency; not vendored
//   node build-all.mjs                 # regenerate everything
//   node build-all.mjs --check         # regenerate, then fail on any diff
//   node build-all.mjs --skip-scene    # skip the slow courtroom renders (shot.mjs)
//   node build-all.mjs --only vox,portraits
//
// Retired 2D pipelines (export-all.mjs, export-chars.mjs) are deliberately NOT
// run: they overwrite the voxel sprites with old art.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ART = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(ART, '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const skipScene = args.includes('--skip-scene');
const onlyAt = args.findIndex((a) => a === '--only' || a.startsWith('--only='));
const only = onlyAt < 0 ? null : args[onlyAt].split('=')[1] ?? args[onlyAt + 1];
const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };

const node = (...a) => () => execFileSync(process.execPath, a, { cwd: ART, stdio: 'inherit', env });
const py = (...a) => () => execFileSync('python3', a, { cwd: ROOT, stdio: 'inherit', env });
const js = (code) => node('--input-type=module', '-e', code);
const copyDir = (from, to) => () => {
  fs.mkdirSync(path.join(ART, to), { recursive: true });
  for (const f of fs.readdirSync(path.join(ART, from))) fs.copyFileSync(path.join(ART, from, f), path.join(ART, to, f));
};

/** [id, what, run]. Order matters: props before the scene and the bbmodel,
 *  characters before portraits and the animation library (it checks PNGs exist). */
const STEPS = [
  ['blocks', 'block textures + preview', js("const [b, s] = await Promise.all([import('./blocks.mjs'), import('./sheet.mjs')]); b.buildBlocks('./dist'); s.blockSheet('./dist/preview_blocks.png', 3); s.blockSheet('./out/preview_blocks.png', 3);")],
  ['props', 'prop sprites + manifest', node('export.mjs')],
  ['props-dist', 'copy out/props -> dist/sprites/props', copyDir('out/props', 'dist/sprites/props')],
  ['props-sheet', 'props contact sheet', js("const m = await import('./render.mjs'); m.propSheet('./out/props_sheet.png', 4, 8); (await import('node:fs')).copyFileSync('./out/props_sheet@4x.png', './dist/preview_props@4x.png');")],
  ['bbmodel', 'props .bbmodel', node('export-bbmodel.mjs')],
  ['bbmodel-check', 'validate props .bbmodel', node('validate-bbmodel.mjs')],
  ['scene-render', 'courtroom renders (slow)', node('shot.mjs')],
  ['scene', 'scene layout + copy renders', node('exportscene.mjs')],
  ['vox', 'voxel characters, poses, idle variants, juror variants', node('export-vox.mjs')],
  ['gallery', 'gallery NPCs', node('export-gallery.mjs')],
  ['player', 'player parts', node('export-player-vox.mjs')],
  ['hands', 'first-person hands', node('export-fp-hands.mjs')],
  ['portraits', 'dialogue portraits', node('export-portraits.mjs')],
  ['defendant', 'anonymous defendant', node('export-defendant.mjs')],
  ['animations', 'animation library (validated)', js("const m = await import('./animations.mjs'); console.log(m.writeAnimationLibrary('./dist/animation/animations.json'));")],
  ['ui', 'UI kit', node('ui-kit.mjs')],
  ['fx', 'FX', node('fx-kit.mjs')],
  ['brand', 'brand kit', node('brand-kit.mjs')],
  ['mirror', 'sync dist/source mirror', () => {
    const dir = path.join(ART, 'dist/source');
    for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(ART, f), path.join(dir, f));
  }],
  ['judge-gavel', 'judge gavel bone (idempotent)', py('judge/tools/add-gavel.py', 'judge/dist/GavelExe.bbmodel')],
  ['judge-glb', 'judge GLB', py('judge/tools/bbmodel2glb.py')],
  ['judge-check', 'validate judge GLB', py('judge/tools/glbcheck.py', 'check', 'judge/dist/GavelExe.glb')],
  ['judge-preview', 'judge previews', () => {
    node('../judge/tools/preview.mjs', '../judge/dist/GavelExe.bbmodel', '../judge/dist/preview-rest.png')();
    py('judge/tools/glbcheck.py', 'preview', 'judge/dist/GavelExe.glb', 'judge/dist/preview-glb.png')();
  }],
  ['economics', 'economics calculator + CSVs', py('docs/economics/cringe_econ.py')],
];

const want = only ? new Set(only.split(',')) : null;
for (const [id, what, run] of STEPS) {
  if (want && !want.has(id)) continue;
  if (skipScene && id === 'scene-render') { console.log(`\n── ${id}: skipped (--skip-scene)`); continue; }
  console.log(`\n── ${id}: ${what}`);
  const t0 = Date.now();
  run();
  console.log(`   ${id} ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

if (check) {
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'cc-art', 'judge', 'docs'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) {
    console.error(`\nCHECK FAILED: regenerated outputs differ from the committed files:\n${dirty}`);
    process.exit(1);
  }
  console.log('\nCHECK OK: every regenerated output matches the committed file byte for byte.');
}

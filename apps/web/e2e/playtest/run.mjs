/* global process, console */
// `npm run playtest -w @cringe-court/web [-- solo versus grand-jury roam] [-- --variant=name,...]`
// Serves the existing production build with `vite preview` on a free port,
// plays each scenario in headless Chrome, and always stops the server.
// Output: ~/cringe-court-v3/screenshots/playtest/ (override with PLAYTEST_OUT).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_ROOT, chromePath, startPreview } from './lib.mjs';
import { runGrandJury } from './grand-jury.mjs';
import { runRoam } from './roam.mjs';
import { runSolo } from './solo.mjs';
import { runVersus } from './versus.mjs';

const SCENARIOS = { solo: runSolo, versus: runVersus, 'grand-jury': runGrandJury, roam: runRoam };
const args = process.argv.slice(2);
const variants = args.find((a) => a.startsWith('--variant='))?.slice(10).split(',') ?? null;
const picked = args.filter((a) => !a.startsWith('--'));
const names = picked.length ? picked : Object.keys(SCENARIOS);
for (const n of names) if (!SCENARIOS[n]) throw new Error(`Unknown scenario "${n}". Try: ${Object.keys(SCENARIOS).join(', ')}`);
if (!chromePath()) throw new Error('No Chrome found: set CHROME_PATH');

const srv = await startPreview();
const results = {};
try {
  console.log(`playtest against ${srv.base}; output in ${OUT_ROOT}`);
  for (const n of names) results[n] = await SCENARIOS[n](srv, variants);
} finally {
  await srv.stop();
}
writeFileSync(join(OUT_ROOT, `results-${Date.now()}.json`), JSON.stringify(results, null, 2));
const failed = Object.values(results).flat().filter((r) => !r.ok);
console.log(failed.length ? `${failed.length} variant(s) failed: ${failed.map((f) => f.variant).join(', ')}` : 'all variants completed');
process.exitCode = failed.length ? 1 : 0;

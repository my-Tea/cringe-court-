/** CLI for the hardcoded-copy scanner: npx tsx scripts/find-hardcoded.ts [dir-or-file ...] */
import { scanPaths } from '../src/i18n/scanHardcoded';

const targets = process.argv.slice(2);
const found = scanPaths(targets.length ? targets : ['src']);
for (const h of found) console.log(`${h.file}:${h.line}  [${h.kind}]  ${h.text}`);
console.log(`\n${found.length} hardcoded string(s)`);
process.exitCode = found.length ? 1 : 0;

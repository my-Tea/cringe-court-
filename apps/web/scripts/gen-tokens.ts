// Writes src/ds/tokens.css from src/ds/tokens.ts.
//   npm run tokens            regenerate
//   npm run tokens -- --check exit 1 if the committed file is stale
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toCss } from '../src/ds/tokens.ts';

const out = fileURLToPath(new URL('../src/ds/tokens.css', import.meta.url));
const css = toCss();

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(out, 'utf8');
  } catch {
    // missing counts as stale
  }
  if (current !== css) {
    console.error('src/ds/tokens.css is out of date. Run `npm run tokens`.');
    process.exit(1);
  }
  console.log('tokens.css is up to date.');
} else {
  writeFileSync(out, css);
  console.log(`Wrote ${out}`);
}

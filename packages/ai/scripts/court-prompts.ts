/**
 * Write or check the generated documentation:
 * - docs/ai/prompts/*.md (the exact prompts, from the prompt code)
 * - the example sections of docs/ai/02-04 (validated complete examples)
 *
 *   npm run court:prompts            write
 *   npm run court:prompts -- --check exit 1 if anything is stale
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modeExampleSections, promptDocs, withExampleSection } from '../src/court/eval/prompt-docs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const aiDocs = join(root, 'docs', 'ai');
const check = process.argv.includes('--check');
const norm = (s: string) => s.replace(/\r\n/g, '\n');
let stale = 0;

async function sync(rel: string, next: string, current: string | null): Promise<void> {
  if (current !== null && norm(current) === next) return;
  if (check) {
    stale++;
    console.error(`stale: docs/ai/${rel}`);
  } else {
    await writeFile(join(aiDocs, rel), next, 'utf8');
    console.log(`wrote docs/ai/${rel}`);
  }
}

await mkdir(join(aiDocs, 'prompts'), { recursive: true });
for (const { file, content } of promptDocs()) {
  const rel = `prompts/${file}`;
  await sync(rel, content, await readFile(join(aiDocs, rel), 'utf8').catch(() => null));
}
for (const { file, content } of modeExampleSections()) {
  const current = await readFile(join(aiDocs, file), 'utf8').catch(() => null);
  const next = current === null ? null : withExampleSection(norm(current), content);
  if (next === null) {
    console.error(`docs/ai/${file} is missing or has no generated-examples markers`);
    stale++;
    continue;
  }
  await sync(file, next, current);
}
if (stale) {
  if (check) console.error('Run: npm run court:prompts');
  process.exit(1);
}
if (check) console.log('generated docs are up to date');

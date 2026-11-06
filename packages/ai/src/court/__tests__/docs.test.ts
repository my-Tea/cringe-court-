/**
 * Docs stay aligned with the code:
 * - docs/ai/prompts/*.md are generated from the prompt code;
 * - the complete examples in docs/ai/02-04 are generated from validated fixtures.
 * Both fail here when the code changes without `npm run court:prompts`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkScript } from '../checks';
import { DOC_EXAMPLES } from '../eval/doc-examples';
import { EXAMPLES_BEGIN, EXAMPLES_END, modeExampleSections, promptDocs } from '../eval/prompt-docs';
import { parseModelScript } from '../parse';
import { PLANS } from '../plans';
import { prepareCase } from '../prepare';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'docs', 'ai');
const read = (rel: string) => readFileSync(join(docs, rel), 'utf8').replace(/\r\n/g, '\n');

describe('generated prompt docs', () => {
  it.each(promptDocs())('docs/ai/prompts/$file matches the code (run npm run court:prompts)', ({ file, content }) => {
    expect(read(`prompts/${file}`)).toBe(content);
  });
});

describe('mode doc examples', () => {
  it.each(modeExampleSections())('docs/ai/$file carries the current generated examples', ({ file, content }) => {
    const doc = read(file);
    const region = doc.slice(doc.indexOf(EXAMPLES_BEGIN), doc.indexOf(EXAMPLES_END) + EXAMPLES_END.length);
    expect(region).toBe(content);
  });

  it('has three complete examples per mode', () => {
    for (const { content } of modeExampleSections()) expect(content.match(/^### Example \d/gm)).toHaveLength(3);
  });

  it.each(DOC_EXAMPLES)('$key is valid output: parses with no coercions and passes the checker cleanly', ({ input, script }) => {
    const c = prepareCase(input);
    const p = parseModelScript(JSON.stringify(script), new Set(c.facts.map((f) => f.id)));
    expect(p.kind).toBe('script');
    if (p.kind !== 'script') return;
    expect(p.coercions).toEqual([]);
    const r = checkScript(c, PLANS[c.mode], p.script);
    expect(r.issues).toEqual([]);
  });
});

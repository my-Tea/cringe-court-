import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as client from '../src/client.js';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

function graph(entry: string, seen = new Set<string>()): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    out.set(file, text);
    for (const m of text.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)) {
      walk(resolve(dirname(file), m[1]!.replace(/\.js$/, '.ts')));
    }
  };
  walk(entry);
  return out;
}

describe('client entry', () => {
  it('import graph has no node: or bare package imports', () => {
    const files = graph(resolve(src, 'client.ts'));
    expect(files.size).toBeGreaterThan(2);
    for (const [file, text] of files) {
      const specs = [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
      for (const s of specs) expect(s.startsWith('.'), `${file} imports ${s}`).toBe(true);
    }
  });

  it('exports the browser-safe surface and not the server one', () => {
    expect(client.JUROR_SCREENING_COPY.title).toBe('Juror Screening');
    expect(client.levelFromCredential('proof_of_human')).toBe(client.IdentityLevel.ORB);
    expect(client.checkJurorEligibility).toBeTypeOf('function');
    expect('deriveHumanId' in client).toBe(false);
    expect('MockVerifier' in client).toBe(false);
  });
});

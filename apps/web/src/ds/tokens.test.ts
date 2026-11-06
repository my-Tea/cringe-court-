import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './lib/contrast';
import { colorRoles, contrastPairs, surfaces, toCss, type Surface } from './tokens';

const surfaceNames: Surface[] = ['night', 'parchment'];
const HEX = /^#[0-9a-f]{6}$/i;

describe('contrast pairs', () => {
  for (const surface of surfaceNames) {
    describe(surface, () => {
      for (const { fg, bg, min, use } of contrastPairs) {
        it(`${fg} on ${bg} >= ${min} (${use})`, () => {
          const fgValue = surfaces[surface][fg];
          const bgValue = surfaces[surface][bg];
          expect(fgValue, `${surface} ${fg} must be #RRGGBB`).toMatch(HEX);
          expect(bgValue, `${surface} ${bg} must be #RRGGBB`).toMatch(HEX);
          const ratio = contrastRatio(fgValue, bgValue);
          expect(ratio, `${surface} ${fg} on ${bg}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }
});

describe('colour roles', () => {
  for (const surface of surfaceNames) {
    it(`${surface} defines every role`, () => {
      for (const role of colorRoles) {
        expect(surfaces[surface][role], `${surface} is missing ${role}`).toBeTruthy();
      }
    });
  }
});

describe('toCss', () => {
  const css = toCss();

  it('emits the accent variable, the parchment block and the reduced-motion block', () => {
    expect(css).toContain('--cc-color-accent');
    expect(css).toContain("[data-surface='parchment']");
    const reduced = css.slice(css.indexOf(":root[data-reduced-motion='true']"));
    expect(reduced).toMatch(/--cc-duration-[a-z0-9-]+:\s*0ms/);
  });

  it('sets every duration to 0ms under reduced motion', () => {
    const start = css.indexOf(":root[data-reduced-motion='true']");
    const block = css.slice(start, css.indexOf('}', start));
    const decls = block.match(/--cc-duration-[\w-]+:\s*[^;]+;/g) ?? [];
    expect(decls.length).toBeGreaterThan(0);
    for (const d of decls) expect(d).toMatch(/:\s*0ms;/);
  });

  it('matches the committed tokens.css', () => {
    const file = resolve(__dirname, 'tokens.css');
    let committed: string;
    try {
      committed = readFileSync(file, 'utf8');
    } catch {
      throw new Error('apps/web/src/ds/tokens.css is missing: run `npm run tokens`');
    }
    expect(committed === css, 'tokens.css is out of date: run `npm run tokens`').toBe(true);
  });
});

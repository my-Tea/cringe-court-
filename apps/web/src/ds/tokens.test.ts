import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './lib/contrast';
import { colorRoles, contrastPairs, palette, surfaces, toCss, type Surface } from './tokens';

const surfaceNames: Surface[] = ['parchment', 'wood'];
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

const paletteHexes = new Set(Object.values(palette).flatMap((ramp) => Object.values(ramp).map((h) => h.toUpperCase())));
const paletteRgb = new Set(
  [...paletteHexes].map((h) => {
    const n = parseInt(h.slice(1), 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }),
);

describe('palette', () => {
  it('is exactly the 30 style-guide swatches', () => {
    expect(paletteHexes.size).toBe(30);
  });

  for (const surface of surfaceNames) {
    it(`${surface} roles use only palette colours`, () => {
      for (const role of colorRoles) {
        const v = surfaces[surface][role];
        const rgb = /^rgb\((\d+ \d+ \d+) \/ [\d.]+\)$/.exec(v);
        const ok = rgb ? paletteRgb.has(rgb[1]!) : paletteHexes.has(v.toUpperCase());
        expect(ok, `${surface} ${role} = ${v} is not a style-guide colour`).toBe(true);
      }
    });
  }

  it('every colour in tokens.css comes from the palette', () => {
    const css = toCss();
    for (const hex of css.match(/#[0-9a-f]{6}\b/gi) ?? []) expect(paletteHexes.has(hex.toUpperCase()), hex).toBe(true);
    for (const [, rgb] of css.matchAll(/rgb\((\d+ \d+ \d+) \//g)) expect(paletteRgb.has(rgb!), `rgb(${rgb})`).toBe(true);
  });
});

describe('no raw colours outside the token layer', () => {
  const src = resolve(__dirname, '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(css|tsx?)$/.test(name) && !/tokens\.(css|ts)$|\.test\.tsx?$/.test(name)) files.push(path);
    }
  };
  walk(src);

  it('finds the sources', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('components, pages and the shell use tokens only (no hex, rgb() or hsl() literals)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      // CSS comments may mention case numbers like `#0069`; in TS only 6/8-digit hexes count.
      const raw = readFileSync(file, 'utf8');
      const text = /\.css$/.test(file) ? raw.replace(/\/\*[\s\S]*?\*\//g, '') : raw;
      const hits = [
        ...(text.match(/#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/gi) ?? []),
        ...(/\.css$/.test(file) ? (text.match(/#[0-9a-f]{3,4}\b/gi) ?? []) : []),
        ...(text.match(/\b(?:rgba?|hsla?)\(/gi) ?? []),
      ];
      if (hits.length) offenders.push(`${relative(src, file)}: ${[...new Set(hits)].join(', ')}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('toCss', () => {
  const css = toCss();

  it('emits the accent variable, the parchment block and the reduced-motion block', () => {
    expect(css).toContain('--cc-color-accent');
    expect(css).toContain("[data-surface='parchment']");
    expect(css).toContain("[data-surface='wood']");
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

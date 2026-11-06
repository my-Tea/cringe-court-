import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { PALETTE as ROAM_PALETTE } from '@cringe-court/scene/roam';
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

describe('no raw colours in roam and the audio demo', () => {
  const repo = resolve(__dirname, '../../../..');
  const roamDir = resolve(repo, 'packages/scene/src/roam');
  const demoDir = resolve(repo, 'packages/audio/demo');
  const collect = (dir: string, pick: (path: string) => boolean): string[] => {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== '__tests__') out.push(...collect(path, pick));
      } else if (pick(path)) out.push(path);
    }
    return out;
  };
  const roamFiles = collect(roamDir, (p) => /\.tsx?$/.test(p) && !/[\\/]palette\.ts$/.test(p));
  const demoFiles = collect(demoDir, (p) => /\.(ts|css|html)$/.test(p));

  it('finds the sources', () => {
    expect(roamFiles.length).toBeGreaterThan(20);
    expect(demoFiles.length).toBe(3);
  });

  it('roam (except palette.ts) and the audio demo use tokens only', () => {
    const offenders: string[] = [];
    for (const file of [...roamFiles, ...demoFiles]) {
      const raw = readFileSync(file, 'utf8');
      const markup = /\.(css|html)$/.test(file);
      const text = markup ? raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '') : raw;
      const hits = [
        ...(text.match(/#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/gi) ?? []),
        ...(markup ? (text.match(/#[0-9a-f]{3,4}\b/gi) ?? []) : []),
        ...(text.match(/\b(?:rgba?|hsla?)\(/gi) ?? []),
      ];
      if (hits.length) offenders.push(`${relative(repo, file)}: ${[...new Set(hits)].join(', ')}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('the roam palette is the web palette: same 30 hexes, same family and order', () => {
    const order = ['royal', 'teal', 'gold', 'neutral', 'green', 'blue'] as const;
    const steps = ['900', '700', '500', '300', '100'] as const;
    const web = order.map((f) => steps.map((s) => (palette as Record<string, Record<string, string>>)[f]![s]!.toUpperCase()));
    const roam = order.map((f) => ROAM_PALETTE[f].map((h) => h.toUpperCase()));
    expect(Object.keys(ROAM_PALETTE)).toEqual([...order]);
    expect(roam).toEqual(web);
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

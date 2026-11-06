import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './lib/contrast';
import { palette, paperShadeHex } from './tokens';

/**
 * Papercraft guarantees (docs/STYLE-GUIDE.md §9): the paper pairings that are
 * hard-wired rather than role-based meet WCAG AA, every animation has a
 * reduced-motion path, and no colour from the retired night/neon palette is
 * left anywhere in the app or the docs.
 */

type Ink = `${keyof typeof palette}-${100 | 300 | 500 | 700 | 900}` | `paper-${keyof typeof paperShadeHex}`;

const hex = (name: Ink): string => {
  if (name.startsWith('paper-')) return paperShadeHex[name.slice(6) as keyof typeof paperShadeHex];
  const [family, step] = name.split('-') as [keyof typeof palette, string];
  return (palette[family] as Record<string, string>)[step]!;
};

/** Fixed paper pairings used by the primitives, the landing and the hero. */
const PAPER_PAIRS: ReadonlyArray<{ fg: Ink; bg: Ink; min: number; use: string }> = [
  { fg: 'neutral-900', bg: 'neutral-100', min: 4.5, use: 'cream ribbon and field text' },
  { fg: 'neutral-900', bg: 'paper-cream-shade', min: 4.5, use: 'ribbon tails, landing footer on the kraft board' },
  { fg: 'royal-900', bg: 'paper-cream-shade', min: 4.5, use: 'links on the kraft board' },
  { fg: 'royal-900', bg: 'gold-300', min: 4.5, use: 'gold paper button label, active tab' },
  { fg: 'royal-900', bg: 'neutral-100', min: 4.5, use: 'exhibit labels, headings on cream card' },
  { fg: 'gold-100', bg: 'royal-900', min: 4.5, use: 'maroon panel text, nav tabs, name tags' },
  { fg: 'gold-100', bg: 'paper-maroon-deep', min: 4.5, use: 'PLAY AS GUEST plate, HUD tags' },
  { fg: 'gold-100', bg: 'paper-maroon-fold', min: 4.5, use: 'lit fold of a maroon sheet' },
  { fg: 'gold-100', bg: 'royal-700', min: 4.5, use: 'tab hover plate, ribbon on maroon' },
  { fg: 'neutral-100', bg: 'royal-700', min: 4.5, use: 'tab hover text' },
  { fg: 'gold-300', bg: 'royal-900', min: 3, use: 'focus ring and icons on maroon' },
  { fg: 'teal-900', bg: 'neutral-100', min: 3, use: 'focus ring on cream' },
];

describe('papercraft contrast pairs', () => {
  for (const { fg, bg, min, use } of PAPER_PAIRS) {
    it(`${fg} on ${bg} >= ${min} (${use})`, () => {
      const ratio = contrastRatio(hex(fg), hex(bg));
      expect(ratio, `${fg} on ${bg}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    });
  }
});

const SRC = resolve(__dirname, '..');
const walk = (dir: string, test: RegExp, out: string[] = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, test, out);
    else if (test.test(name)) out.push(path);
  }
  return out;
};

describe('reduced motion', () => {
  const css = walk(SRC, /\.css$/).filter((f) => !/tokens\.css$/.test(f));

  it('every CSS file that animates has a reduced-motion path', () => {
    const offenders: string[] = [];
    for (const file of css) {
      const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const animations = [...text.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1]!.trim()).filter((v) => v !== 'none');
      if (!animations.length) continue;
      const hasBlock = /data-reduced-motion/.test(text) || /prefers-reduced-motion/.test(text);
      // Without a block, each animation must take its duration from a token (0ms under reduced motion).
      const unguarded = hasBlock ? [] : animations.filter((a) => !/var\(--cc-duration-/.test(a));
      if (unguarded.length) offenders.push(`${relative(SRC, file)}: ${unguarded.join(' | ')}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('the paper keyframes and the courtroom hero switch off explicitly', () => {
    for (const rel of ['ds/styles/paper.css', 'landing/hero/CourtroomScene.module.css']) {
      const text = readFileSync(join(SRC, rel), 'utf8');
      expect(text, rel).toMatch(/:root\[data-reduced-motion='true'\][^{]*\{[^}]*animation:\s*none/);
      expect(text, rel).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    }
  });
});

describe('retired palette', () => {
  // ~/cringe-court-v3/old-palette-hex.txt: the night/neon colours replaced by the 30-swatch palette.
  const OLD = ['#140E1A', '#2A1636', '#3A2A24', '#3FB8C9', '#6B4CA8', '#6E1B2A', '#C0392B', '#F08A3C', '#FF4FB8', '#FFF6E4', '#FFF8EC'];
  const files = [...walk(SRC, /\.(css|tsx?|svg)$/), resolve(SRC, '../index.html')].filter((f) => !/papercraft\.test\.ts$/.test(f));

  it('appears nowhere in the web app', () => {
    const offenders = files.flatMap((f) => {
      const text = readFileSync(f, 'utf8').toUpperCase();
      const hits = OLD.filter((h) => text.includes(h));
      return hits.length ? [`${relative(SRC, f)}: ${hits.join(', ')}`] : [];
    });
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

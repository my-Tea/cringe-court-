import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { duration, easing, loop, stagger, toCss } from '../tokens';


/**
 * One motion language (docs/STYLE-GUIDE.md "Motion"): every duration, delay and
 * easing in the app comes from a --cc-duration / --cc-loop / --cc-stagger /
 * --cc-ease token, so timing stays consistent and reduced motion reaches it all.
 */
const SRC = resolve(__dirname, '../..');
const SCENE = resolve(SRC, '../../../packages/scene/src');
const walk = (dir: string, out: string[] = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.css') && name !== 'tokens.css') out.push(path);
  }
  return out;
};

const MOTION_PROP = /^\s*(transition|animation)(-duration|-delay|-timing-function)?\s*:\s*([^;]+);/gm;
const RAW_TIME = /(?<![\w-])(\d*\.?\d+)(ms|s)\b/g;
const RAW_EASE = /\b(cubic-bezier|steps)\(|(?<![\w-])(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)(?![\w-])/;

export function motionOffenders(files: string[], root: string): string[] {
  const out: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(MOTION_PROP)) {
      const value = m[3]!;
      const times = [...value.matchAll(RAW_TIME)].filter((t) => Number(t[1]) !== 0);
      // Multipliers inside calc() (`calc(var(--cc-loop-sway) * 7 / 6)`) are unitless, so only units count.
      if (times.length || RAW_EASE.test(value)) out.push(`${relative(root, file)}: ${m[0].trim()}`);
    }
  }
  return out;
}

describe('motion tokens', () => {
  it('no CSS in the web app uses a literal duration, delay or easing', () => {
    const offenders = motionOffenders(walk(SRC), SRC);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('collapses every duration, loop and stagger to 0ms under reduced motion', () => {
    const css = toCss();
    const reducedBlock = css.slice(css.indexOf(":root[data-reduced-motion='true']"));
    for (const k of Object.keys(duration)) expect(reducedBlock).toContain(`--cc-duration-${k}: 0ms;`);
    for (const k of Object.keys(loop)) expect(reducedBlock).toContain(`--cc-loop-${k}: 0ms;`);
    for (const k of Object.keys(stagger)) expect(reducedBlock).toContain(`--cc-stagger-${k}: 0ms;`);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('defines an easing for every motion role the app uses', () => {
    for (const k of ['standard', 'enter', 'exit', 'emphasized', 'stamp', 'unfold', 'press', 'sway', 'linear', 'blink', 'frame', 'shake']) {
      expect(easing).toHaveProperty(k);
    }
  });

  it('the roaming courtroom HUD stylesheet takes its timing from the same tokens', () => {
    const hud = readFileSync(join(SCENE, 'roam/react/styles.ts'), 'utf8');
    for (const m of hud.matchAll(/(?:animation|transition):([^;}]+)/g)) {
      if (m[1]!.trim() === 'none') continue;
      expect(m[1], 'HUD motion must read --cc-duration-* / --cc-ease-* (fallbacks allowed)').toMatch(/var\(--cc-duration-[a-z]+,[^)]*\) var\(--cc-ease-[a-z]+,/);
    }
    expect(hud).toMatch(/data-reduced-motion="true"\] \.ccr-callout\{animation:none\}/);
  });

  it('the global stylesheet stops loops and delays under reduced motion', () => {
    const base = readFileSync(join(SRC, 'ds/styles/base.css'), 'utf8');
    expect(base).toMatch(/data-reduced-motion='true'\] \*[\s\S]*animation-iteration-count: 1 !important/);
    expect(base).toMatch(/\.cc-page-enter \{[^}]*var\(--cc-duration-slow\) var\(--cc-ease-enter\) backwards/);
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanPaths } from './scanHardcoded';
import { allKeys, en, lookup } from './catalog';
import { formatMessage, messageArgs } from './format';
import { pseudoLocalize, PSEUDO_CLOSE, PSEUDO_OPEN } from './pseudo';

const SRC = resolve(__dirname, '..');

describe('message catalog', () => {
  const keys = allKeys(en);

  it('has copy in every namespace', () => {
    for (const ns of Object.keys(en)) expect(Object.keys(en[ns as keyof typeof en]).length, ns).toBeGreaterThan(0);
    expect(keys.length).toBeGreaterThan(1500);
  });

  it('every message parses (ICU subset) and formats with its own arguments', () => {
    for (const key of keys) {
      const message = lookup(en, key)!;
      const params = Object.fromEntries(messageArgs(message).map((a) => [a, 2]));
      expect(() => formatMessage(message, params, 'en'), key).not.toThrow();
      expect(formatMessage(message, params, 'en'), key).not.toMatch(/\{\w+\}/);
    }
  });

  it('pseudo-localises every message without losing its arguments', () => {
    for (const key of keys) {
      const message = lookup(en, key)!;
      const pseudo = pseudoLocalize(message);
      expect(messageArgs(pseudo).sort(), key).toEqual(messageArgs(message).sort());
      expect(pseudo.startsWith(PSEUDO_OPEN) && pseudo.endsWith(PSEUDO_CLOSE)).toBe(true);
    }
  });

  it('every key is used somewhere in the app', () => {
    const files: string[] = [];
    const walk = (d: string) =>
      readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.tsx?$/.test(n) && !/i18n\/messages/.test(join(d, n)) && files.push(join(d, n))));
    walk(SRC);
    const code = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    // Keys built from a template (`grandJury.status.${s}`) count as used through their literal prefix.
    const prefixes = [...code.matchAll(/[`'"]((?:common|shell|ds|trial|solo|versus|grandJury|domain)\.[\w.]*)\$\{/g)].map((m) => m[1]!);
    const unused = keys.filter((k) => !code.includes(`'${k}'`) && !code.includes(`"${k}"`) && !code.includes(`\`${k}\``) && !prefixes.some((p) => k.startsWith(p)));
    expect(unused, unused.join('\n')).toEqual([]);
  });
});

describe('ICU subset', () => {
  it('interpolates, pluralises and selects', () => {
    expect(formatMessage('Hi {name}', { name: 'Bro' }, 'en')).toBe('Hi Bro');
    const votes = '{count, plural, =0 {no votes} one {# vote} other {# votes}}';
    expect(formatMessage(votes, { count: 0 }, 'en')).toBe('no votes');
    expect(formatMessage(votes, { count: 1 }, 'en')).toBe('1 vote');
    expect(formatMessage(votes, { count: 1200 }, 'en')).toBe('1,200 votes');
    expect(formatMessage('{side, select, a {Side A} other {Side B}}', { side: 'a' }, 'en')).toBe('Side A');
  });

  it('rejects malformed messages', () => {
    expect(() => formatMessage('{n, plural, one {x}}', { n: 1 }, 'en')).toThrow(/other/);
    expect(() => formatMessage('{n, date}', { n: 1 }, 'en')).toThrow(/Unsupported/);
  });
});

describe('no hardcoded UI copy', () => {
  it('every user-visible string in the web app TSX comes from the catalog', () => {
    const found = scanPaths([SRC], resolve(SRC, '..'));
    expect(found.map((h) => `${h.file}:${h.line} ${h.text}`)).toEqual([]);
  });
});

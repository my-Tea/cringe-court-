import { describe, expect, it } from 'vitest';
import { CounselError } from '@cringe-court/core';
import { MAX_LINE_CHARS, parseAngles, parseLines } from './parse';

const good = JSON.stringify({ lines: [{ segment: 'opening', beat: 'smug', text: 'Hello court.' }] });

describe('parseLines', () => {
  it('parses plain JSON', () => {
    expect(parseLines(good)).toEqual([{ segment: 'opening', beat: 'smug', text: 'Hello court.' }]);
  });

  it('tolerates code fences and surrounding prose', () => {
    expect(parseLines('```json\n' + good + '\n```')).toHaveLength(1);
    expect(parseLines('Sure! Here you go:\n' + good + '\nHope that helps {really}.')).toHaveLength(1);
    expect(parseLines('```\n' + good + '\n```')).toHaveLength(1);
  });

  it('handles braces inside strings', () => {
    const j = JSON.stringify({ lines: [{ segment: 'opening', text: 'a } b { c' }] });
    expect(parseLines(`prose { ${j}`)[0]?.text).toBe('a } b { c');
  });

  it('clamps long text to 280 chars', () => {
    const j = JSON.stringify({ lines: [{ segment: 'closing', text: 'w '.repeat(400) }] });
    expect(parseLines(j)[0]!.text.length).toBeLessThanOrEqual(MAX_LINE_CHARS);
  });

  const bad: [string, string][] = [
    ['no json', 'I refuse'],
    ['no lines', '{"x":1}'],
    ['empty lines', '{"lines":[]}'],
    ['bad segment', '{"lines":[{"segment":"verdict","text":"x"}]}'],
    ['bad beat', '{"lines":[{"segment":"opening","beat":"moonwalk","text":"x"}]}'],
    ['no text', '{"lines":[{"segment":"opening"}]}'],
    ['blank text', '{"lines":[{"segment":"opening","text":"   "}]}'],
    ['exhibit without id', '{"lines":[{"segment":"exhibit","text":"x"}]}'],
    ['non-object line', '{"lines":["x"]}'],
  ];
  it.each(bad)('rejects %s as retryable invalid-output', (_n, raw) => {
    try {
      parseLines(raw);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CounselError);
      expect((e as CounselError).code).toBe('invalid-output');
      expect((e as CounselError).retryable).toBe(true);
    }
  });

  it('enforces allowed segments and known exhibits', () => {
    expect(() => parseLines(good, { allowedSegments: ['closing'] })).toThrow(CounselError);
    const ex = '{"lines":[{"segment":"exhibit","exhibitId":"zz","text":"x"}]}';
    expect(() => parseLines(ex, { knownExhibitIds: ['x1'] })).toThrow(CounselError);
    expect(parseLines(ex, { knownExhibitIds: ['zz'] })).toHaveLength(1);
  });
});

describe('parseAngles', () => {
  it('accepts strings, objects and bare arrays, clamped and de-duplicated', () => {
    expect(parseAngles('{"angles":["a","a","b"]}')).toEqual(['a', 'b']);
    expect(parseAngles('[{"text":"a"},"b"]')).toEqual(['a', 'b']);
    expect(parseAngles(JSON.stringify({ angles: ['z'.repeat(300)] }))[0]!.length).toBe(140);
  });
  it('rejects garbage', () => {
    expect(() => parseAngles('nope')).toThrow(CounselError);
    expect(() => parseAngles('{"angles":[]}')).toThrow(CounselError);
  });
});

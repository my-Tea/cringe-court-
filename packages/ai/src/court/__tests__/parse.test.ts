import { describe, expect, it } from 'vitest';
import { extractJson, parseCommentary, parseModelScript } from '../parse';

const FACTS = new Set(['F1', 'F2']);
const analysis = { core: 'What the case is about.', tension: 'The contradiction.', benchA: 'Case against.', benchB: 'Best defense.', factRefs: ['F1'] };
const line = (over: Record<string, unknown> = {}) => ({ slot: 'L02', speaker: 'prosecutor', emotion: 'smug', animation: 'point', camera: 'auto', crowd: 'none', text: 'A line.', factRefs: ['F1'], ...over });
const script = (lines: unknown[]) => JSON.stringify({ analysis, lines });

describe('extractJson', () => {
  it('tolerates fences and prose', () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```\nEnjoy')).toEqual({ a: 1 });
    expect(extractJson('blah {"a":{"b":2}} trailing')).toEqual({ a: { b: 2 } });
  });
  it('rejects empty and non-JSON', () => {
    expect(() => extractJson('   ')).toThrow();
    expect(() => extractJson('no braces here')).toThrow();
  });
});

describe('parseModelScript', () => {
  it('parses a valid script', () => {
    const r = parseModelScript(script([line()]), FACTS);
    expect(r.kind).toBe('script');
    if (r.kind === 'script') expect(r.coercions).toEqual([]);
  });

  it('reports empty and invalid JSON responses', () => {
    expect(parseModelScript('', FACTS)).toMatchObject({ kind: 'error', code: 'empty' });
    expect(parseModelScript('{"analysis": {', FACTS)).toMatchObject({ kind: 'error', code: 'invalid-json' });
    expect(parseModelScript('{"lines": "nope"}', FACTS)).toMatchObject({ kind: 'error', code: 'schema' });
  });

  it('rejects unknown speakers', () => {
    const r = parseModelScript(script([line({ speaker: 'bailiff' })]), FACTS);
    expect(r).toMatchObject({ kind: 'error', code: 'schema' });
    if (r.kind === 'error') expect(r.message).toMatch(/Unknown speaker "bailiff"/);
  });

  it('coerces unknown performance values to documented safe defaults', () => {
    const r = parseModelScript(script([line({ emotion: 'furious', animation: 'backflip', camera: 'drone_shot', crowd: 'standing ovation', factRefs: ['F1', 'F9'] })]), FACTS);
    expect(r.kind).toBe('script');
    if (r.kind !== 'script') return;
    expect(r.script.lines[0]).toMatchObject({ emotion: 'neutral', animation: 'talk', camera: 'auto', crowd: 'none', factRefs: ['F1'] });
    expect(r.coercions).toHaveLength(5);
  });

  it('normalises friendly spellings', () => {
    const r = parseModelScript(script([line({ animation: 'Desk Slam', camera: 'prosecution closeup', emotion: 'SMUG' })]), FACTS);
    if (r.kind !== 'script') throw new Error('expected script');
    expect(r.script.lines[0]).toMatchObject({ animation: 'desk-slam', camera: 'prosecution_closeup', emotion: 'smug' });
  });

  it('keeps role-restricted animations with the right roles', () => {
    const r = parseModelScript(script([line({ animation: 'gavel' }), line({ slot: 'L06', speaker: 'judge', animation: 'objection' })]), FACTS);
    if (r.kind !== 'script') throw new Error('expected script');
    expect(r.script.lines.map((l) => l.animation)).toEqual(['point', 'talk']);
  });

  it('recognises refusals', () => {
    expect(parseModelScript('{"refusal":"unsuitable","reason":"harassment"}', FACTS)).toEqual({ kind: 'refusal', refusal: 'unsuitable', reason: 'harassment' });
  });

  it('never lets output carry extra executable fields', () => {
    const r = parseModelScript(script([line({ onPlay: 'alert(1)', asset: '../../etc/passwd' })]), FACTS);
    if (r.kind !== 'script') throw new Error('expected script');
    expect(Object.keys(r.script.lines[0] ?? {}).sort()).toEqual(['animation', 'camera', 'crowd', 'emotion', 'factRefs', 'slot', 'speaker', 'text']);
  });
});

describe('parseCommentary', () => {
  it('parses and validates shape', () => {
    expect(parseCommentary('{"announcement":"Order! GUILTY.","quip":"The dog had no license."}').kind).toBe('ok');
    expect(parseCommentary('{"quip":"x"}').kind).toBe('error');
  });
});

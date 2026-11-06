import { describe, expect, it } from 'vitest';
import { CaseCatalog, DEMO_CASE_FILES, ballotOf, scriptIsBalanced, validateCaseFile, type CaseFile } from '../index';

const base = DEMO_CASE_FILES[0]!;
const variant = (patch: Partial<CaseFile>): CaseFile => ({ ...base, ...patch });

describe('demo case files', () => {
  it('has 8 files with unique slugs', () => {
    expect(DEMO_CASE_FILES).toHaveLength(8);
    expect(new Set(DEMO_CASE_FILES.map((f) => f.slug)).size).toBe(8);
  });
  it.each(DEMO_CASE_FILES.map((f) => [f.slug, f] as const))('%s validates and is balanced', (_s, f) => {
    expect(() => validateCaseFile(f)).not.toThrow();
    expect(scriptIsBalanced(f)).toBe(true);
  });
});

describe('validateCaseFile', () => {
  it('rejects a non-question', () => {
    expect(() => validateCaseFile(variant({ question: 'Cereal is soup.' }))).toThrow(/must be a question/);
  });
  it('rejects a lowercase ballot title', () => {
    expect(() => validateCaseFile(variant({ positions: [{ ...base.positions[0], title: 'Team soup' }, base.positions[1]] }))).toThrow(/in caps/);
  });
  it('rejects identical titles', () => {
    expect(() => validateCaseFile(variant({ positions: [base.positions[0], { ...base.positions[1], title: base.positions[0].title }] }))).toThrow(/must differ/);
  });
  it('rejects a case with no sources', () => {
    expect(() => validateCaseFile(variant({ sources: [] }))).toThrow(/at least one source/);
  });
  it('rejects a script line citing an unknown exhibit', () => {
    const script = base.script.map((l, i) => (i === 1 ? { ...l, exhibitId: 'nope' } : l));
    expect(() => validateCaseFile(variant({ script }))).toThrow(/unknown source nope/);
  });
  it('rejects a script missing an opening for a bench', () => {
    const script = base.script.filter((l) => !(l.segment === 'opening' && l.bench === 1));
    expect(() => validateCaseFile(variant({ script }))).toThrow(/bench 1 needs an opening/);
  });
  it('rejects a non kebab-case slug', () => {
    expect(() => validateCaseFile(variant({ slug: 'Bad Slug' }))).toThrow(/kebab-case/);
  });
});

describe('CaseCatalog and ballotOf', () => {
  it('looks files up by slug and rejects duplicates', () => {
    const c = new CaseCatalog(DEMO_CASE_FILES);
    expect(c.get(base.slug)).toBe(base);
    expect(c.get('missing')).toBeUndefined();
    expect(c.list()).toHaveLength(8);
    expect(() => new CaseCatalog([base, base])).toThrow(/Duplicate case slug/);
  });
  it('ballotOf returns the two position titles', () => {
    expect(ballotOf(base)).toEqual([base.positions[0].title, base.positions[1].title]);
  });
});

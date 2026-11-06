import { describe, expect, it } from 'vitest';
import { ADVERSARIAL_CORPUS, FULL_CORPUS } from '../eval/corpus';
import { CaseRejectedError, assignAdvocates, prepareCase, sanitize, sentences } from '../prepare';

const reject = (input: unknown): CaseRejectedError => {
  try {
    prepareCase(input);
  } catch (e) {
    if (e instanceof CaseRejectedError) return e;
    throw e;
  }
  throw new Error('expected a rejection');
};

describe('prepareCase: mode routing and validation', () => {
  it('requires an explicit mode chosen by the application', () => {
    expect(reject({ caseTitle: 'No mode', confession: 'I bought a hat for my cat.' }).code).toBe('invalid-input');
    expect(reject({ mode: 'grand-jury', caseTitle: 'Old mode', confession: 'I bought a hat for my cat.' }).code).toBe('invalid-input');
  });

  it('validates each mode with its own schema', () => {
    expect(reject({ mode: 'solo', caseTitle: 'Hi', confession: 'short' }).details.join(' ')).toMatch(/confession|caseTitle/);
    expect(reject({ mode: 'versus', caseTitle: 'Half', sideA: { account: 'Only one side wrote an account here.' } }).code).toBe('invalid-input');
    expect(reject({ mode: 'viral', caseTitle: 'Unapproved', question: 'Is cereal soup?', summary: 'A debate nobody approved yet at all.', sideA: { label: 'Yes', position: 'Liquid plus solids.' }, sideB: { label: 'No', position: 'Breakfast is not soup.' } }).details.join(' ')).toMatch(/approved/);
  });

  it('builds mode-specific ballots and parties', () => {
    const solo = prepareCase({ mode: 'solo', caseTitle: 'Dog Coin', confession: 'I bought a memecoin because the dog looked trustworthy.' });
    expect(solo.ballot).toEqual(['GUILTY', 'NOT_COOKED']);
    expect(solo.parties.defendant).toBe('the defendant');
    expect(solo.advocates).toBeUndefined();
    const versus = prepareCase(FULL_CORPUS.find((c) => c.id === 'V02')?.input);
    expect(versus.ballot).toEqual(['SIDE_A', 'SIDE_B']);
    expect(versus.parties).toMatchObject({ sideA: 'Priya', sideB: 'Dev' });
    expect(new Set([versus.advocates?.A, versus.advocates?.B])).toEqual(new Set(['prosecutor', 'defense']));
  });

  it('numbers facts with statuses per mode', () => {
    const v = prepareCase(FULL_CORPUS.find((c) => c.id === 'V02')?.input);
    expect(v.facts.map((f) => f.status)).toEqual(['agreed', 'claimed-by-a', 'claimed-by-b']);
    expect(v.facts.map((f) => f.id)).toEqual(['F1', 'F2', 'F3']);
    const x = prepareCase(FULL_CORPUS.find((c) => c.id === 'X14')?.input);
    expect(x.facts.some((f) => f.status === 'sourced-fact' && f.sourceId === 'S1')).toBe(true);
    expect(x.viral?.sources[0]?.title).toBe('Kitchen interview');
  });

  it('keeps the viral question verbatim (typos included)', () => {
    const x = prepareCase(FULL_CORPUS.find((c) => c.id === 'X15')?.input);
    expect(x.viral?.question).toBe('Should socks be worn with sandels?');
  });

  it('assigns advocates deterministically from the case id, not the model', () => {
    expect(assignAdvocates('case-1')).toEqual(assignAdvocates('case-1'));
    const flips = new Set(Array.from({ length: 40 }, (_, i) => assignAdvocates(`c${i}`).A));
    expect(flips).toEqual(new Set(['prosecutor', 'defense']));
  });

  it('derives a stable case id when none is given', () => {
    const input = { mode: 'solo', caseTitle: 'Dog Coin', confession: 'I bought a memecoin because the dog looked trustworthy.' };
    expect(prepareCase(input).caseId).toBe(prepareCase(input).caseId);
    expect(prepareCase(input).caseId).toMatch(/^case_[0-9a-f]{10}$/);
  });
});

describe('prepareCase: safety, privacy and injection', () => {
  it('redacts personal data before anything reaches a prompt', () => {
    const c = prepareCase(ADVERSARIAL_CORPUS.find((x) => x.id === 'A10')?.input);
    const text = c.facts.map((f) => f.text).join(' ');
    expect(text).not.toMatch(/example\.com|555-123/);
    expect(text).toMatch(/\[email\]/);
    expect(c.flags).toEqual(expect.arrayContaining(['redacted:emailx1', 'redacted:phonex1']));
  });

  it('strips invisible and bidi characters', () => {
    expect(sanitize('a​b‮c  d')).toBe('abc d');
  });

  it('flags instruction-like text without obeying or dropping it', () => {
    for (const id of ['A01', 'A02', 'A03', 'A04']) {
      const c = prepareCase(ADVERSARIAL_CORPUS.find((x) => x.id === id)?.input);
      expect(c.flags, id).toContain('injection-like-text');
    }
    expect(prepareCase(FULL_CORPUS.find((c) => c.id === 'X16')?.input).flags).toContain('injection-like-text');
  });

  it.each(ADVERSARIAL_CORPUS.filter((c) => c.expect !== 'trial'))('$id rejects with $expect', (c) => {
    expect(reject(c.input).code).toBe(c.expect);
  });

  it('lowers the tone for sensitive or insulting cases instead of forcing jokes', () => {
    expect(prepareCase(FULL_CORPUS.find((c) => c.id === 'S19')?.input).tone).toBe('gentle');
    expect(prepareCase(ADVERSARIAL_CORPUS.find((c) => c.id === 'A05')?.input).tone).toBe('gentle');
    expect(prepareCase(FULL_CORPUS.find((c) => c.id === 'S01')?.input).tone).toBe('standard');
  });

  it('does not over-block ordinary words', () => {
    for (const confession of ['I had a minor disagreement with my toaster and lost.', 'My phone died so I abused the free trial of a streaming app for a week.', 'The job candidate brought their own chair to my interview, and I hired them.']) {
      expect(() => prepareCase({ mode: 'solo', caseTitle: 'Ordinary', confession })).not.toThrow();
    }
  });

  it('flags asymmetric and unconfirmed versus accounts for the prompt', () => {
    expect(prepareCase(FULL_CORPUS.find((c) => c.id === 'V14')?.input).flags).toEqual(expect.arrayContaining(['asymmetric-accounts', 'no-agreed-facts']));
  });
});

describe('prepareCase: corpus', () => {
  it.each(FULL_CORPUS)('$id prepares', (c) => {
    const p = prepareCase(c.input);
    expect(p.facts.length).toBeGreaterThan(0);
    if (c.tone) expect(p.tone).toBe(c.tone);
  });

  it('splits prose into sentence facts', () => {
    expect(sentences('I did it. Then I did it again! Why? Because.')).toEqual(['I did it.', 'Then I did it again! Why? Because.']);
  });
});

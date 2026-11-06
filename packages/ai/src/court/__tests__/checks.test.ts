import { describe, expect, it } from 'vitest';
import { checkCommentary, checkScript } from '../checks';
import { EXAMPLE_INPUTS, exampleScript } from '../eval/examples';
import { parseModelScript } from '../parse';
import { PLANS } from '../plans';
import { prepareCase } from '../prepare';
import type { CourtMode, ModelScript, PreparedCase } from '../schema';

function load(mode: CourtMode): { c: PreparedCase; script: ModelScript } {
  const c = prepareCase(EXAMPLE_INPUTS[mode]);
  const p = parseModelScript(exampleScript(mode), new Set(c.facts.map((f) => f.id)));
  if (p.kind !== 'script') throw new Error('example must parse');
  return { c, script: p.script };
}

/** Run the checker after editing one line of the reference script. */
function withLine(mode: CourtMode, slot: string, edit: Partial<ModelScript['lines'][number]>) {
  const { c, script } = load(mode);
  const lines = script.lines.map((l) => (l.slot === slot ? { ...l, ...edit } : l));
  return checkScript(c, PLANS[mode], { ...script, lines });
}

const codes = (r: ReturnType<typeof checkScript>, severity: 'hard' | 'soft' = 'hard') => r.issues.filter((i) => i.severity === severity).map((i) => i.code);

describe('checkScript: reference trials pass', () => {
  it.each(['solo', 'versus', 'viral'] as const)('%s reference has no hard issues and a high estimate', (mode) => {
    const { c, script } = load(mode);
    const r = checkScript(c, PLANS[mode], script);
    expect(codes(r)).toEqual([]);
    expect(r.overall).toBeGreaterThanOrEqual(4.5);
  });
});

describe('checkScript: structure', () => {
  it('requires every model slot exactly once', () => {
    const { c, script } = load('solo');
    const r = checkScript(c, PLANS.solo, { ...script, lines: script.lines.filter((l) => l.slot !== 'L05') });
    expect(codes(r)).toContain('missing-slot');
    const dup = checkScript(c, PLANS.solo, { ...script, lines: [...script.lines, script.lines[1] as ModelScript['lines'][number]] });
    expect(codes(dup)).toContain('duplicate-slot');
  });

  it('rejects slots outside the plan and ignores model text for court-written slots', () => {
    const { c, script } = load('solo');
    const extra = { ...(script.lines[0] as ModelScript['lines'][number]), slot: 'L42' };
    expect(codes(checkScript(c, PLANS.solo, { ...script, lines: [...script.lines, extra] }))).toContain('unknown-slot');
    const template = { ...(script.lines[5] as ModelScript['lines'][number]), slot: 'L09', text: 'GUILTY! The verdict is GUILTY.' };
    expect(codes(checkScript(c, PLANS.solo, { ...script, lines: [...script.lines, template] }))).toEqual([]);
  });

  it('enforces the speaker of each slot', () => {
    expect(codes(withLine('solo', 'L03', { speaker: 'prosecutor' }))).toContain('wrong-speaker');
  });

  it('bounds line and trial length', () => {
    expect(codes(withLine('solo', 'L02', { text: 'Your Honor, '.repeat(40) }))).toContain('too-long');
    expect(codes(withLine('solo', 'L02', { text: 'Dog bad.' }))).toContain('too-short');
  });
});

describe('checkScript: verdict and neutrality', () => {
  it('blocks verdict announcements from anyone', () => {
    expect(codes(withLine('solo', 'L05', { text: 'The verdict is clear and my client walks free, because the tie was the whole pitch and the dog never lied to anyone.' }))).toContain('verdict-leak');
  });
  it('keeps the judge and clerk neutral', () => {
    expect(codes(withLine('solo', 'L06', { text: 'The court finds this dog business deeply guilty-looking, frankly.' }))).toContain('neutrality');
    expect(codes(withLine('versus', 'L08', { text: 'The court thinks Side A wins this one, honestly, but carry on with the sneakers.' }))).toContain('neutrality');
  });
  it('lets counsel ask the jury for their side in closing', () => {
    expect(codes(withLine('solo', 'L07', { text: 'Members of the jury: the dog had a tie and the defendant had a wallet. Find this decision GUILTY.' }))).toEqual([]);
  });
});

describe('checkScript: grounding', () => {
  it('flags invented evidence', () => {
    expect(codes(withLine('solo', 'L04', { text: 'Exhibit A, Your Honor: the screenshot of the purchase, timestamped and shameful, proves the dog in the tiny tie was the only research done.' }))).toContain('fabricated-evidence');
  });
  it('flags invented numbers', () => {
    expect(codes(withLine('solo', 'L02', { text: 'Your Honor, the defendant spent 400 dollars because a dog on a logo looked financially responsible. That is not research.' }))).toContain('invented-number');
  });
  it('flags invented quotes but allows quoting the case and earlier lines', () => {
    expect(codes(withLine('solo', 'L04', { text: 'The defendant told a friend "this dog will make me rich by Friday" and that is the whole problem with the tiny tie.' }))).toContain('invented-quote');
    expect(codes(withLine('solo', 'L04', { text: 'Counsel says "Nobody wears a tie to lose your money" but the defendant wrote "the dog on the logo looked financially responsible" and nothing else.' }))).not.toContain('invented-quote');
  });
  it('flags lines that ignore the case', () => {
    const r = withLine('solo', 'L02', { text: 'Your Honor, some decisions are simply questionable, and this is one of them. The prosecution will explain why in great detail now.', factRefs: [] });
    expect(codes(r, 'soft')).toEqual(expect.arrayContaining(['generic-line', 'no-fact-ref']));
  });
  it('keeps viral trials away from betting language', () => {
    expect(codes(withLine('viral', 'L10', { text: 'For Team Pineapple: sweetness. For Team No Fruit: purity. Check the odds before you decide, the question stays open.' }))).toContain('viral-money-talk');
  });
  it('blocks personal data and code-like output', () => {
    expect(codes(withLine('solo', 'L02', { text: 'Your Honor, contact the defendant at dog@example.com to ask about the tiny tie and the logo that looked responsible.' }))).toContain('pii');
    expect(codes(withLine('solo', 'L02', { text: 'Your Honor, <script>alert(1)</script> the dog on the logo looked financially responsible and wore a tiny tie.' }))).toContain('code-like');
  });
});

describe('checkScript: rebuttal quality', () => {
  it('requires replies to engage the line they answer', () => {
    const r = withLine('solo', 'L03', { text: 'My client is a wonderful person who loves sunsets, long walks and spending time with friends on weekends.', answers: undefined });
    expect(codes(r)).toContain('non-responsive');
  });
  it('accepts a reply that engages without the quote field, with a soft note', () => {
    const r = withLine('solo', 'L03', { answers: undefined });
    expect(codes(r)).toEqual([]);
    expect(codes(r, 'soft')).toContain('missing-answer-quote');
  });
  it('keeps the two sides balanced in versus', () => {
    const { c, script } = load('versus');
    const bSlots = new Set(['L03', 'L04', 'L07', 'L10']);
    const lines = script.lines.map((l) => (bSlots.has(l.slot) ? { ...l, text: 'Dev says the bottle said deep cleaning and the sneakers were dirty.' } : l));
    expect(codes(checkScript(c, PLANS.versus, { ...script, lines }))).toContain('imbalance');
  });
});

describe('checkCommentary', () => {
  it('requires the exact external result and no other', () => {
    expect(checkCommentary({ announcement: 'Order! The jury has spoken: GUILTY.', quip: 'The tie could not save you.' }, 'GUILTY', undefined)).toEqual([]);
    expect(checkCommentary({ announcement: 'Order! NOT COOKED... no wait, GUILTY.', quip: 'x x x x x' }, 'NOT COOKED', undefined).map((i) => i.code)).toContain('conflicting-outcome');
    expect(checkCommentary({ announcement: 'Order! The jury loved it.', quip: 'x x x x x' }, 'SIDE A', undefined).map((i) => i.code)).toContain('missing-outcome');
  });
  it('never invents a winner for unresolved cases', () => {
    expect(checkCommentary({ announcement: 'NO VERDICT. Side A basically won though.', quip: 'Fine.' }, 'NO VERDICT', undefined).map((i) => i.code)).toContain('invented-winner');
  });
  it('blocks settlement claims unless the app confirmed them', () => {
    expect(checkCommentary({ announcement: 'Order! SIDE B.', quip: 'Payouts are on the way!' }, 'SIDE B', undefined).map((i) => i.code)).toContain('money-claim');
  });
});

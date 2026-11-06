import { describe, expect, it } from 'vitest';
import { BASE_MODES, briefsFor, formatUsdc, usdc, type CourtLine, type Filing } from '@cringe-court/core';
import {
  DemoCounsel,
  NPC_PERSONAS,
  PASS_ENABLED,
  REST_POSES,
  STAGE_POSE_SET,
  TeaserQuota,
  direct,
  directAll,
  fromJson,
  guiltyChance,
  isDemoTerms,
  memoryQuotaStore,
  npcChoice,
  outcomePreviews,
  pickQuote,
  redact,
  soloMode,
  soloQuote,
  soloTerms,
  toJson,
  validateAngle,
  validateDraft,
  EMPTY_DRAFT,
} from '../index';

describe('definition and pricing (DECISIONS Mode 1)', () => {
  it('extends the base Solo definition: Counsel Chaos is the user’s, Miss Ratio is the NPC (D1)', () => {
    expect(soloMode.id).toBe('solo');
    expect(soloMode.benches[1]).toMatchObject({ counsel: 'defense', client: 'a' });
    expect(soloMode.benches[0]).toMatchObject({ counsel: 'prosecutor', client: null });
    expect(soloMode.benchLabel(1, 'a')).toMatch(/your lawyer/);
  });

  it('quotes 1.20 = 0.90 + 0.10 + 0.20, and the Pass stays off (D12)', () => {
    const q = soloQuote(soloTerms());
    expect(q.lines.map((l) => formatUsdc(l.amount, { unit: false }))).toEqual(['0.90', '0.10', '0.20']);
    expect(formatUsdc(q.total)).toBe('1.20 USDC');
    expect(PASS_ENABLED).toBe(false);
    expect(soloTerms({ pass: true }).target).toBe(usdc('1.20'));
  });

  it('previews every outcome with the real settlement maths', () => {
    const [verdict, none, cancelled] = outcomePreviews(soloTerms());
    expect(formatUsdc(verdict!.filerRefund)).toBe('0.00 USDC');
    expect(formatUsdc(verdict!.courtKeeps)).toBe('0.30 USDC');
    expect(formatUsdc(verdict!.juryEarns)).toBe('0.90 USDC');
    expect(formatUsdc(none!.filerRefund)).toBe('1.20 USDC');
    expect(formatUsdc(none!.courtKeeps)).toBe('0.00 USDC');
    expect(formatUsdc(cancelled!.filerRefund)).toBe('1.20 USDC');
  });

  it('labels demo deadlines (D14)', () => {
    expect(isDemoTerms(soloTerms({ demo: true }))).toBe(true);
    expect(isDemoTerms(soloTerms())).toBe(false);
    expect(soloTerms().deadlines).toMatchObject({ recruitment: 1800, commit: 1200, reveal: 600 });
  });
});

describe('intake', () => {
  it('validates the confession', () => {
    expect(Object.keys(validateDraft(EMPTY_DRAFT)).sort()).toEqual(['category', 'story', 'title']);
    expect(validateAngle('')).toMatch(/angle/);
    expect(validateAngle('a'.repeat(140))).toBeNull();
    expect(validateAngle('a'.repeat(141))).toMatch(/140/);
  });

  it('redacts contacts, wallets, handles and listed names, idempotently', () => {
    const text = 'Mail me at bro@cook.io, call +1 (555) 010-9999, tip 0x52908400098527886E0F7030069857D2E4169EE7 or vitalik.eth, ping @sam_k, see https://x.com/a. Sam said hi to Samantha.';
    const r = redact(text, ['Sam']);
    expect(r.redactions.map((x) => x.kind)).toEqual(['email', 'phone', 'wallet', 'ens', 'handle', 'url', 'name']);
    expect(r.text).toContain('Samantha');
    expect(r.text).not.toMatch(/bro@|555|0x5290|vitalik|@sam_k|x\.com/);
    expect(redact(r.text, ['Sam']).text).toBe(r.text);
  });
});

describe('director', () => {
  const line = (over: Partial<CourtLine>): CourtLine => ({ id: 'L1', speaker: 'prosecutor', segment: 'rebuttal', text: 'x', bench: 0, ...over });

  it('objections get the callout, the stinger and the shocked opponent', () => {
    const s = direct(line({ beat: 'objection', text: 'OBJECTION!' }));
    expect(s).toMatchObject({ camera: 'close_prosecution', callout: { style: 'objection' }, fx: 'flash' });
    expect(s.poses).toMatchObject({ prosecutor: 'objection', defense: 'shocked' });
    expect(s.cues).toContain('stinger.objection');
  });

  it('the defense’s catchphrase and the jury-out card', () => {
    expect(direct(line({ speaker: 'defense', bench: 1, beat: 'laugh', text: 'Vote NOT COOKED. Let bro cook.' })).callout?.style).toBe('let-bro-cook');
    const out = direct(line({ speaker: 'judge', bench: undefined, segment: 'jury-out', beat: 'gavel', text: 'THE JURY IS OUT.' }));
    expect(out).toMatchObject({ camera: 'pov_well', lighting: 'tense', callout: { style: 'jury-out' } });
  });

  it('only ever asks for poses in the Solo pose set', async () => {
    const counsel = new DemoCounsel();
    const filing: Filing = { category: 'crypto-crimes', title: 'T', context: '', sides: { a: { account: null, story: 'I bought the top.', privateNotes: '', angle: 'Market conditions.', nickname: null } } };
    const draft = await counsel.draft({
      trialId: 't',
      mode: 'solo',
      category: 'crypto-crimes',
      title: 'T',
      ballot: ['GUILTY', 'NOT COOKED'],
      benches: BASE_MODES.solo.benches,
      briefs: briefsFor(BASE_MODES.solo.benches, filing),
      exhibits: [{ id: 'X1', submittedBy: 'a', kind: 'text', title: 'Chart', body: 'Line goes down.' }],
      scope: 'full',
      payer: ['platform', 'platform'],
      budget: { maxInputTokens: 1200, maxOutputTokens: 400 },
      attempt: 1,
    });
    for (const shot of [...directAll(draft.lines), { poses: REST_POSES }]) {
      for (const [actor, pose] of Object.entries(shot.poses)) expect(STAGE_POSE_SET[actor as keyof typeof STAGE_POSE_SET]).toContain(pose);
    }
    expect((await counsel.assessBalance(draft)).ok).toBe(true);
  });
});

describe('DemoCounsel keeps the port promises', () => {
  it('never puts private notes in any line, and the sentence follows the human verdict', async () => {
    const counsel = new DemoCounsel();
    const filing: Filing = { category: 'dating-crimes', title: 'Ghosted', context: '', sides: { a: { account: null, story: 'I ghosted after brunch.', privateNotes: 'SECRET-NOTE', angle: 'Emoji choice takes time.', nickname: null } } };
    const draft = await counsel.draft({
      trialId: 't2',
      mode: 'solo',
      category: 'dating-crimes',
      title: 'Ghosted',
      ballot: ['GUILTY', 'NOT COOKED'],
      benches: BASE_MODES.solo.benches,
      briefs: briefsFor(BASE_MODES.solo.benches, filing),
      exhibits: [],
      scope: 'teaser',
      payer: ['platform', 'platform'],
      budget: { maxInputTokens: 1200, maxOutputTokens: 400 },
      attempt: 1,
    });
    expect(JSON.stringify(draft)).not.toContain('SECRET-NOTE');
    expect(draft.lines.at(-1)!.text).toBe('THE JURY IS OUT.');
    const s = await counsel.sentence({ trialId: 't2', verdictLabel: 'NOT COOKED', transcriptHash: `0x${'1'.repeat(64)}`, category: 'dating-crimes', title: 'Ghosted' });
    expect(s.text).toMatch(/NOT COOKED/);
  });
});

describe('NPC jury', () => {
  it('has three labelled personas and bounded, deterministic votes', () => {
    expect(NPC_PERSONAS).toHaveLength(3);
    for (const p of NPC_PERSONAS) {
      expect(guiltyChance(p, { ok: true, scores: [1, 0], reasons: [] })).toBeLessThanOrEqual(0.9);
      expect(guiltyChance(p, { ok: true, scores: [0, 1], reasons: [] })).toBeGreaterThanOrEqual(0.1);
    }
    const h = `0x${'ab'.repeat(32)}` as const;
    expect(npcChoice(NPC_PERSONAS[0]!, h, 1, null)).toBe(npcChoice(NPC_PERSONAS[0]!, h, 1, null));
    // Across many cases both verdicts happen.
    const votes = new Set(Array.from({ length: 40 }, (_, i) => npcChoice(NPC_PERSONAS[2]!, `0x${i.toString(16).padStart(64, '0')}`, 3, null)));
    expect(votes).toEqual(new Set([0, 1]));
  });
});

describe('teaser quota (D3)', () => {
  it('1 a day per device, 3 per account, resets at UTC midnight', () => {
    let now = 86_400 * 20_000 + 100;
    const q = new TeaserQuota(memoryQuotaStore(), () => now);
    expect(q.consume(null)).toBe(true);
    expect(q.consume(null)).toBe(false);
    expect([q.consume('0xA'), q.consume('0xa'), q.consume('0xA'), q.consume('0xA')]).toEqual([true, true, true, false]);
    expect(q.allowance(null).resetsAt).toBe(86_400 * 20_001);
    now += 86_400;
    expect(q.allowance(null).remaining).toBe(1);
  });
});

describe('share + persistence', () => {
  it('quotes the winning bench’s closing line', () => {
    const lines: CourtLine[] = [
      { id: 'L1', speaker: 'prosecutor', bench: 0, segment: 'closing', text: 'Vote GUILTY.' },
      { id: 'L2', speaker: 'defense', bench: 1, segment: 'closing', text: 'Let bro cook.' },
    ];
    expect(pickQuote(lines, 'guilty')).toEqual({ text: 'Vote GUILTY.', by: 'Miss Ratio' });
    expect(pickQuote(lines, 'not-cooked')).toEqual({ text: 'Let bro cook.', by: 'Counsel Chaos' });
  });

  it('round-trips bigint money through JSON', () => {
    const v = { a: usdc('1.20'), b: [usdc('0.10')], c: 'x' };
    expect(fromJson(toJson(v))).toEqual(v);
  });
});

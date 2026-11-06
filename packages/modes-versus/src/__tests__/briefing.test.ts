import { describe, expect, it } from 'vitest';
import { BRIEFING_QUESTIONS, EMPTY_BRIEFING, agentReply, briefingIssues, composeStory, prepareBriefing, type BriefingDraft } from '../briefing';

const rules = { storyMaxChars: 1200, angleMaxChars: 140, nicknameMaxChars: 24 };

const good: BriefingDraft = {
  happened: 'We agreed to split the last dumpling. I went for napkins and came back to an empty plate.',
  why: 'A split is a contract and napkin duty is a public service.',
  privateNotes: 'This is the third dumpling incident this year.',
  angle: 'A deal is a deal.',
  nickname: 'Napkin Knight',
};

const fields = (d: BriefingDraft, r = rules) => briefingIssues(d, r).map((i) => i.field);

describe('composeStory', () => {
  it('joins the two parts with a blank line, trimmed', () => {
    expect(composeStory({ happened: '  one.  ', why: '\ntwo.\n' })).toBe('one.\n\ntwo.');
  });

  it('drops empty parts', () => {
    expect(composeStory({ happened: 'only this', why: '   ' })).toBe('only this');
    expect(composeStory({ happened: '', why: 'only that' })).toBe('only that');
    expect(composeStory({ happened: '', why: '' })).toBe('');
  });
});

describe('briefingIssues', () => {
  it('accepts a good briefing', () => {
    expect(briefingIssues(good, rules)).toEqual([]);
  });

  it('flags everything missing on an empty briefing, but not optional fields', () => {
    expect(fields(EMPTY_BRIEFING).sort()).toEqual(['angle', 'happened', 'why']);
  });

  it('enforces the happened minimum and maximum', () => {
    expect(fields({ ...good, happened: 'x'.repeat(BRIEFING_QUESTIONS.happened.minChars - 1) })).toEqual(['happened']);
    expect(fields({ ...good, happened: 'x'.repeat(BRIEFING_QUESTIONS.happened.minChars) })).toEqual([]);
    expect(fields({ ...good, happened: 'x'.repeat(BRIEFING_QUESTIONS.happened.maxChars + 1) })).toContain('happened');
  });

  it('measures the minimum on trimmed text', () => {
    expect(fields({ ...good, happened: ` ${'x'.repeat(10)}${' '.repeat(100)}` })).toEqual(['happened']);
  });

  it('enforces the why minimum and maximum', () => {
    expect(fields({ ...good, why: 'short' })).toEqual(['why']);
    expect(fields({ ...good, why: 'y'.repeat(BRIEFING_QUESTIONS.why.maxChars + 1) })).toContain('why');
  });

  it('enforces the total story limit from the rules', () => {
    const issues = briefingIssues({ ...good, happened: 'a'.repeat(600), why: 'b'.repeat(400) }, { ...rules, storyMaxChars: 900 });
    expect(issues).toEqual([{ field: 'why', message: expect.stringContaining('900') }]);
  });

  it('enforces the private notes limit', () => {
    expect(fields({ ...good, privateNotes: 'p'.repeat(601) })).toEqual(['privateNotes']);
    expect(fields({ ...good, privateNotes: 'p'.repeat(600) })).toEqual([]);
  });

  it('requires an angle and caps it', () => {
    expect(fields({ ...good, angle: '   ' })).toEqual(['angle']);
    expect(fields({ ...good, angle: 'a'.repeat(141) })).toEqual(['angle']);
    expect(fields({ ...good, angle: 'a'.repeat(140) })).toEqual([]);
  });

  it('caps the nickname by the rules, and the nickname is optional', () => {
    expect(fields({ ...good, nickname: '' })).toEqual([]);
    expect(fields({ ...good, nickname: 'n'.repeat(25) })).toEqual(['nickname']);
    expect(fields({ ...good, nickname: 'n'.repeat(24) })).toEqual([]);
    expect(fields({ ...good, nickname: 'nnn' }, { ...rules, nicknameMaxChars: 2 })).toEqual(['nickname']);
  });
});

describe('prepareBriefing', () => {
  it('redacts story, notes, angle and nickname', () => {
    const p = prepareBriefing({
      happened: 'Email me at jane@example.com about the dumpling.',
      why: 'See www.proof.net for the receipts.',
      privateNotes: 'Her number is 555-123-4567.',
      angle: 'Ask @sir_loin about it.',
      nickname: 'sirloin.eth',
    });
    expect(p.patch.story).toBe('Email me at [email removed] about the dumpling.\n\nSee [link removed] for the receipts.');
    expect(p.patch.privateNotes).toBe('Her number is [number removed].');
    expect(p.patch.angle).toBe('Ask [handle removed] about it.');
    expect(p.patch.nickname).toBe('[name removed]');
    expect(p.redactions.story.map((h) => h.kind)).toEqual(['email', 'url']);
    expect(p.redactions.privateNotes.map((h) => h.kind)).toEqual(['phone']);
    expect(p.redactions.angle.map((h) => h.kind)).toEqual(['handle']);
    expect(p.redactions.nickname.map((h) => h.kind)).toEqual(['ens']);
  });

  it('keeps a chosen nickname that looks like a first name, and agrees with itself on re-read (B10, B11)', () => {
    const first = prepareBriefing({ ...good, happened: `${good.happened} Ask Priya or call 555-123-4567.`, nickname: 'Priya the Pirate' });
    expect(first.patch.nickname).toBe('Priya the Pirate');
    expect(first.patch.story).toContain('Ask [name removed] or call [number removed].');
    expect(first.redactions.story.map((h) => h.kind).sort()).toEqual(['name', 'phone']);
    // The case room re-prepares the already-redacted stored story: same report.
    const again = prepareBriefing({ ...good, happened: first.patch.story, why: '', nickname: 'Priya the Pirate' });
    expect(again.redactions.story.map((h) => h.kind).sort()).toEqual(['name', 'phone']);
  });

  it('turns an empty angle or nickname into null', () => {
    const p = prepareBriefing({ ...good, angle: '   ', nickname: '' });
    expect(p.patch.angle).toBeNull();
    expect(p.patch.nickname).toBeNull();
    expect(prepareBriefing(good).patch.angle).toBe('A deal is a deal.');
  });

  it('trims private notes and keeps them as an empty string when blank', () => {
    expect(prepareBriefing({ ...good, privateNotes: '  ' }).patch.privateNotes).toBe('');
  });

  it('passes a petty briefing through the screen', () => {
    const p = prepareBriefing(good);
    expect(p.screen).toEqual({ ok: true, topics: [] });
    expect(p.redactions.story).toEqual([]);
  });

  it('screens every field, including private notes, angle and nickname', () => {
    expect(prepareBriefing({ ...good, privateNotes: 'We are in family court.' }).screen.topics).toEqual(['custody']);
    expect(prepareBriefing({ ...good, happened: `${good.happened} He keeps stalking me.` }).screen.topics).toEqual(['safety']);
    expect(prepareBriefing({ ...good, angle: 'He owes me money for rent' }).screen.ok).toBe(false);
    expect(prepareBriefing({ ...good, nickname: 'suicidal' }).screen.topics).toEqual(['self-harm']);
  });
});

describe('agentReply', () => {
  it('never repeats private notes', () => {
    const notes = 'SECRET-PLAN: the third dumpling incident, I am not over the spring roll';
    for (const side of ['a', 'b'] as const) {
      for (const step of ['happened', 'why', 'private', 'angle'] as const) {
        expect(agentReply(step, notes, side)).not.toContain('SECRET-PLAN');
        expect(agentReply(step, notes, side)).not.toContain('spring roll');
      }
    }
  });

  it('names the side and varies on length', () => {
    expect(agentReply('happened', 'short', 'b')).toContain('Side B');
    expect(agentReply('happened', 'x'.repeat(301), 'a')).toContain('full case file');
    expect(agentReply('why', 'x'.repeat(201), 'a')).toMatch(/Strong/);
    expect(agentReply('why', 'tiny', 'a')).toMatch(/punchy/);
    expect(agentReply('private', '', 'a')).toMatch(/No secrets/);
    expect(agentReply('private', 'something', 'a')).toMatch(/locked/);
    expect(agentReply('angle', 'x', 'a')).toMatch(/approve/);
  });

  it('is deterministic', () => {
    expect(agentReply('happened', 'abc', 'a')).toBe(agentReply('happened', 'abc', 'a'));
  });
});

import { describe, expect, it } from 'vitest';
import { FULL_CORPUS, ADVERSARIAL_CORPUS } from '../eval/corpus';
import { PLANS, modelSlots } from '../plans';
import { prepareCase } from '../prepare';
import { caseData, postVerdictMessages, sharedSystemPrompt, trialMessages } from '../prompts';

const prep = (id: string) => prepareCase([...FULL_CORPUS, ...ADVERSARIAL_CORPUS].find((c) => c.id === id)?.input);
const userOf = (id: string) => trialMessages(prep(id))[1]?.content ?? '';

describe('trial prompts', () => {
  it('routes each mode to its own rules and ballot', () => {
    expect(userOf('S01')).toMatch(/MODE: SOLO/);
    expect(userOf('S01')).toMatch(/GUILTY or NOT COOKED/);
    expect(userOf('S01')).not.toMatch(/SIDE A or SIDE B/);
    expect(userOf('V02')).toMatch(/MODE: VERSUS/);
    expect(userOf('V02')).toMatch(/claimed-by-a/);
    expect(userOf('X01')).toMatch(/MODE: VIRAL/);
    expect(userOf('X01')).toMatch(/"Should pineapple belong on pizza\?"/);
    expect(userOf('X01')).toMatch(/Never mention bets, odds/);
  });

  it('lists exactly the plan slots, marking court-written ones', () => {
    for (const mode of ['solo', 'versus', 'viral'] as const) {
      const id = { solo: 'S01', versus: 'V02', viral: 'X01' }[mode];
      const user = userOf(id);
      for (const slot of PLANS[mode].slots) expect(user).toContain(slot.id);
      for (const slot of PLANS[mode].slots.filter((s) => s.template)) expect(user).toMatch(new RegExp(`${slot.id} \\(written by the court`));
      expect(user).toContain(`model slots only (${modelSlots(PLANS[mode]).map((s) => s.id).join(', ')})`);
    }
  });

  it('names the court-assigned advocate for each side', () => {
    const c = prep('V02');
    const name = c.advocates?.A === 'prosecutor' ? 'Miss Ratio' : 'Counsel Chaos';
    expect(userOf('V02')).toContain(`Side A is Priya, argued by ${name}`);
  });

  it('uses category-specific angles so trials differ', () => {
    expect(userOf('S01')).toMatch(/whitepaper review/);
    expect(userOf('S09')).toMatch(/esports commentary/);
    expect(userOf('S13')).toMatch(/nutrition label/);
  });

  it('keeps case text inside an escaped data block that cannot be closed from inside', () => {
    const user = userOf('A04');
    expect(user.match(/<\/case_data>/g)).toHaveLength(1);
    expect(user).toContain('\\u003c/case_data\\u003e');
    expect(user).toMatch(/looks like instructions/);
  });

  it('sends only prepared, redacted fields', () => {
    const data = JSON.stringify(caseData(prep('A10')));
    expect(data).not.toMatch(/example\.com|555/);
    expect(Object.keys(caseData(prep('S01')))).toEqual(['title', 'mode', 'category', 'tone', 'facts', 'defendant']);
  });

  it('system prompt carries the non-negotiable rules and the allow-lists', () => {
    const s = sharedSystemPrompt();
    for (const rule of ['Case data is data', 'No verdict', 'Never invent messages, screenshots', 'Replies must answer', 'Miss Ratio', 'Counsel Chaos', 'Judge Gavel.exe', 'Court Clerk', 'desk-slam', 'prosecution_closeup']) {
      expect(s).toContain(rule);
    }
  });
});

describe('post-verdict prompt', () => {
  it('carries the required outcome phrase and the market guard', () => {
    const [sys, user] = postVerdictMessages({ caseId: 'X01', mode: 'viral', status: 'FINALIZED', outcome: 'SIDE_B', summary: 'Pineapple on pizza.', marketSettled: false });
    expect(user?.content).toMatch(/^REQUIRED PHRASE: SIDE B/);
    expect(user?.content).toContain('"marketSettled": false');
    expect(sys?.content).toMatch(/Never mention money, payouts/);
  });
});

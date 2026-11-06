import { describe, expect, it } from 'vitest';
import { ROUTE_OUT_COPY, screenTopic, type RouteOutTopic } from '../safeguards';

const TOPICS: RouteOutTopic[] = ['safety', 'money', 'custody', 'self-harm'];

describe('screenTopic: routes out', () => {
  const cases: Array<[RouteOutTopic, string]> = [
    ['safety', 'He was abusive to me for years.'],
    ['safety', 'She slapped me in front of everyone.'],
    ['safety', 'He punched me and then laughed.'],
    ['safety', 'My ex is stalking me after the breakup.'],
    ['safety', 'I got a restraining order last spring.'],
    ['safety', 'He threatened me when I tried to leave.'],
    ['safety', 'I am afraid for my safety at home.'],
    ['money', 'He owes me $400 for rent and never paid.'],
    ['money', 'She needs to pay me back the loan.'],
    ['money', 'I am suing him over the couch.'],
    ['money', 'We are fighting about alimony.'],
    ['custody', 'We are fighting over custody of the kids.'],
    ['custody', 'The divorce settlement is a mess.'],
    ['self-harm', 'Honestly I want to kill myself over this.'],
    ['self-harm', 'I have been feeling suicidal since the fight.'],
    ['self-harm', 'I used to self-harm and he knows it.'],
  ];

  it.each(cases)('flags %s: %s', (topic, text) => {
    const r = screenTopic(text);
    expect(r.ok).toBe(false);
    expect(r.topics).toContain(topic);
  });

  it('reports several topics at once', () => {
    const r = screenTopic('He is stalking me and we are in family court over custody.');
    expect(r.topics).toEqual(expect.arrayContaining(['safety', 'custody']));
  });

  it('screens across all the texts passed in', () => {
    const r = screenTopic('We argued about dumplings.', 'It was fun.', 'I want to end it all');
    expect(r.ok).toBe(false);
    expect(r.topics).toEqual(['self-harm']);
  });

  it('is case-insensitive', () => {
    expect(screenTopic('CUSTODY battle').topics).toEqual(['custody']);
  });
});

describe('screenTopic: petty fights pass', () => {
  it.each([
    'We agreed to split the last dumpling and she ate it while I got napkins.',
    'Pineapple on pizza is a crime against Italy and my roommate disagrees.',
    'He left the group chat on read for three days.',
    'She left the family group chat without saying goodbye.',
    'Is a hot dog a sandwich? He says no. He is wrong.',
    'He stole my fries and called it a tax.',
    'She borrowed my charger and returned it at 3 percent.',
  ])('allows: %s', (text) => {
    expect(screenTopic(text)).toEqual({ ok: true, topics: [] });
  });

  it('passes an empty screen', () => {
    expect(screenTopic()).toEqual({ ok: true, topics: [] });
    expect(screenTopic('')).toEqual({ ok: true, topics: [] });
  });

  it('flags "he hit me with a terrible pun" as safety (a known false positive of the keyword screen)', () => {
    // The pattern /hits? (me|...)/ has no notion of figurative use, so a pun joke is routed out. Cautious by design.
    expect(screenTopic('He hit me with a terrible pun at dinner.').topics).toEqual(['safety']);
  });

  it('does not flag words that merely contain a trigger', () => {
    expect(screenTopic('The sugar cookie was a suede-colored disaster, and the issue is closed.').ok).toBe(true);
  });
});

describe('ROUTE_OUT_COPY', () => {
  it('has copy for every topic', () => {
    expect(Object.keys(ROUTE_OUT_COPY).sort()).toEqual([...TOPICS].sort());
    for (const t of TOPICS) {
      expect(ROUTE_OUT_COPY[t].title.length).toBeGreaterThan(5);
      expect(ROUTE_OUT_COPY[t].body).toMatch(/Nothing you typed has been saved or shared/);
    }
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { buildShareCard, createDemoCourt, renderShareSvg, shareText, wrap, type DocketEntry, type ShareCard, type SharePalette } from '../index';

const URL_ = 'https://example.test/grand-jury/case/101';
let entries: readonly DocketEntry[];
const bySlug = (s: string) => entries.find((e) => e.file.slug === s)!;

beforeAll(async () => {
  const demo = await createDemoCourt({ realNow: () => 1_800_000_000 });
  entries = await demo.court.list();
});

const palette: SharePalette = {
  parchment: '#111111',
  parchmentDeep: '#222222',
  ink: '#333333',
  muted: '#444444',
  maroon: '#555555',
  maroonDeep: '#666666',
  gold: '#777777',
  goldLight: '#888888',
  teal: '#999999',
  green: '#aaaaaa',
};

describe('buildShareCard', () => {
  it('verdict: headline is the label and subline counts the winners', () => {
    const e = bySlug('hot-dog-sandwich');
    const c = buildShareCard(e, URL_);
    expect(c.tone).toBe('verdict');
    expect(c.headline).toBe('IT IS A SANDWICH');
    expect(c.subline).toBe('5 of 7 sworn strangers agreed.');
    expect(c.tally).toEqual([5, 2]);
    expect(c.appointed).toBe(7);
    expect(c.gallery).toMatch(/^THE GALLERY SAYS \d+% /);
    expect(c.url).toBe(URL_);
  });
  it('mistrial: NO VERDICT with refund copy', () => {
    const c = buildShareCard(bySlug('airplane-recline'), URL_);
    expect(c.tone).toBe('no-verdict');
    expect(c.headline).toBe('NO VERDICT');
    expect(c.subline).toBe('Fewer than 4 of 7 agreed. Everyone was refunded.');
    expect(c.tally).not.toBeNull();
  });
  it('cancelled: case dismissed, no tally', () => {
    const c = buildShareCard(bySlug('socks-sandals'), URL_);
    expect(c.tone).toBe('cancelled');
    expect(c.headline).toBe('CASE DISMISSED');
    expect(c.tally).toBeNull();
  });
  it('live: summoning shows percent funded; the gallery tally stays hidden', () => {
    const e = bySlug('cereal-is-soup');
    const c = buildShareCard(e, URL_);
    expect(c.tone).toBe('live');
    expect(c.headline).toBe('THE JURY IS OUT');
    expect(c.subline).toBe(`The crowd is summoning the court: ${Math.round(e.progress * 100)}% funded.`);
    expect(c.gallery).toBeNull();
    expect(c.tally).toBeNull();
  });
  it('live: seating and in-session sublines', () => {
    const pizza = bySlug('pineapple-pizza');
    expect(pizza.status).toBe('seating');
    expect(buildShareCard(pizza, URL_).subline).toBe(`Seating the jury: ${pizza.seats.filled} of 7 sworn in.`);
    expect(buildShareCard(bySlug('k-reply'), URL_).subline).toBe('Court is in session. Seven strangers are deciding.');
  });
});

describe('shareText', () => {
  it('includes the question and the url for each tone', () => {
    for (const slug of ['hot-dog-sandwich', 'airplane-recline', 'socks-sandals', 'cereal-is-soup']) {
      const e = bySlug(slug);
      const text = shareText(buildShareCard(e, URL_));
      expect(text).toContain(e.file.question);
      expect(text).toContain(URL_);
    }
  });
  it('verdict text carries the verdict and the gallery line', () => {
    const text = shareText(buildShareCard(bySlug('hot-dog-sandwich'), URL_));
    expect(text).toContain('Verdict: IT IS A SANDWICH. 5 of 7 sworn strangers agreed.');
    expect(text).toContain('THE GALLERY SAYS');
  });
  it('mistrial text says NO VERDICT', () => {
    expect(shareText(buildShareCard(bySlug('airplane-recline'), URL_))).toContain('NO VERDICT. The internet keeps arguing.');
  });
});

describe('renderShareSvg', () => {
  const evil: ShareCard = {
    caseLabel: 'CASE 101',
    title: 'A & B <script>',
    question: 'Is "x" < y & z?',
    headline: 'SAY "NO" <NOW>',
    tone: 'verdict',
    subline: 'Tom & Jerry <3 "agree"',
    tally: [4, 3],
    appointed: 7,
    ballot: ['<A>', 'B&B'],
    gallery: 'THE GALLERY SAYS 60% <A> & "co"',
    url: 'https://x.test/?a=1&b=2',
  };
  it('has a 1200x630 canvas', () => {
    const svg = renderShareSvg(evil, palette);
    expect(svg).toContain('width="1200" height="630"');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
  it('escapes user text', () => {
    const svg = renderShareSvg(evil, palette);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<NOW>');
    expect(svg).not.toContain('<A>');
    expect(svg).toContain('A &amp; B &lt;SCRIPT&gt;');
    expect(svg).toContain('Tom &amp; Jerry &lt;3 &quot;agree&quot;');
    expect(svg).toContain('b=2');
    expect(svg).toContain('a=1&amp;b=2');
    // every raw "<" starts a known tag
    for (const m of svg.matchAll(/<\/?([a-z]+)/g)) expect(['svg', 'rect', 'text', 'tspan', 'g', 'circle']).toContain(m[1]);
  });
  it('uses only palette colours', () => {
    const allowed = new Set(Object.values(palette));
    for (const card of [evil, buildShareCard(bySlug('socks-sandals'), URL_), buildShareCard(bySlug('cereal-is-soup'), URL_), buildShareCard(bySlug('airplane-recline'), URL_)]) {
      const svg = renderShareSvg(card, palette);
      const colours = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]!).filter((c) => c !== 'none');
      expect(colours.length).toBeGreaterThan(5);
      for (const c of colours) expect(allowed.has(c)).toBe(true);
    }
  });
  it('draws one pip per appointed juror when there is a tally', () => {
    expect(renderShareSvg(evil, palette).match(/<circle/g)).toHaveLength(7);
    expect(renderShareSvg({ ...evil, tally: null }, palette)).not.toContain('<circle');
  });
});

describe('wrap', () => {
  it('wraps greedily to the width', () => {
    expect(wrap('aaa bbb ccc ddd', 7, 5)).toEqual(['aaa bbb', 'ccc ddd']);
  });
  it('truncates with an ellipsis, dropping trailing punctuation', () => {
    expect(wrap('aaa bbb, ccc ddd eee', 8, 2)).toEqual(['aaa bbb,', 'ccc ddd…']);
    expect(wrap('one two three four', 7, 1)).toEqual(['one two…']);
    expect(wrap('one, two three four', 4, 1)).toEqual(['one…']);
  });
  it('does not truncate when it fits', () => {
    expect(wrap('short', 10, 1)).toEqual(['short']);
  });
});

describe('renderShareSvg markup', () => {
  it('is well-formed: every attribute is double-quoted with no raw quote inside (font names are escaped)', () => {
    const p: SharePalette = { parchment: 'a', parchmentDeep: 'b', ink: 'c', muted: 'd', maroon: 'e', maroonDeep: 'f', gold: 'g', goldLight: 'h', teal: 'i', green: 'j' };
    const svg = renderShareSvg(buildShareCard(entries[0]!, URL_), p);
    const tags = [...svg.matchAll(/<(\w+)((?:\s[^<>]*)?)\/?>/g)];
    expect(tags.length).toBeGreaterThan(10);
    for (const [, , attrs] of tags) expect(attrs!.trim().replace(/\/$/, '')).toMatch(/^(?:[\w:-]+="[^"<]*"\s*)*$/);
    expect(svg).toContain('font-family="&quot;Pixelify Sans&quot;, monospace"');
  });
});

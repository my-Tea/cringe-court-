import { describe, expect, it } from 'vitest';
import { ShareCardModelFixture, theme } from './share-fixtures';
import { shareCardModel, shareCardSvg, shareText, wrapText, type ShareCardModel } from '../share';
import { rig, toFunding, toVerdict } from './helpers';

describe('shareCardModel', () => {
  it('returns null before the case reaches a verdict', async () => {
    const t = rig();
    const { trialId } = await toFunding(t);
    expect(shareCardModel((await t.a.world()).case(trialId)!)).toBeNull();
  });

  it('describes a finished case without leaking private data', async () => {
    const t = rig();
    const trialId = await toVerdict(t);
    const c = (await t.a.world()).case(trialId)!;
    const m = shareCardModel(c)!;
    expect(m).not.toBeNull();
    expect(m.caseLabel).toBe('CASE #0069');
    expect(m.title).toBe('The Last Dumpling');
    expect(m.category).toBeTruthy();
    expect(['a', 'b', 'mistrial']).toContain(m.outcome);
    expect(m.appointed).toBe(3);
    expect(m.completed).toBe(3);
    expect(m.tally[0] + m.tally[1]).toBe(3);
    expect(m.fingerprint).toMatch(/^0x[0-9a-f]{8}$/);
    expect(m.sentence).toBeTruthy();
    expect(m.quote?.speaker).toMatch(/^(Agent A|Agent B|Judge Gavel\.exe)$/);
    if (m.outcome === 'mistrial') {
      expect(m.headline).toBe('MISTRIAL');
      expect(m.winner).toBeNull();
      expect(m.loser).toBeNull();
    } else {
      const side = m.outcome.toUpperCase();
      expect(m.headline).toBe(`SIDE ${side} WINS`);
      expect(m.winner).toMatch(new RegExp(`^SIDE ${side}`));
      expect(m.loser).toMatch(new RegExp(`^SIDE ${side === 'A' ? 'B' : 'A'}`));
      expect(Math.max(...m.tally)).toBeGreaterThanOrEqual(2);
    }
    expect(JSON.stringify(m)).not.toMatch(/SECRET|0x[0-9a-f]{40}/i);

    const text = shareText(m, 'https://example.test/c/69');
    expect(text).toContain('CASE #0069');
    expect(text).toContain('#CringeCourt');
    expect(text).toContain('https://example.test/c/69');
    expect(text).toContain('The Last Dumpling');
    expect(text).not.toMatch(/0x[0-9a-f]{40}/i);

    const svg = shareCardSvg(m, theme);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(m.headline);
    expect(svg).not.toMatch(/SECRET|0x[0-9a-f]{40}/i);
  });

  it('uses the nickname the side approved in the winner/loser labels', async () => {
    const t = rig();
    const trialId = await toVerdict(t);
    const m = shareCardModel((await t.a.world()).case(trialId)!)!;
    if (m.outcome === 'a') expect(m.winner).toBe('SIDE A “Napkin Knight”');
    if (m.outcome === 'b') expect(m.loser).toBe('SIDE A “Napkin Knight”');
  });
});

describe('shareText', () => {
  it('words a win and a mistrial', () => {
    const win: ShareCardModel = { ...ShareCardModelFixture, outcome: 'b', winner: 'SIDE B', loser: 'SIDE A', tally: [1, 2] };
    expect(shareText(win, 'u')).toBe('CASE #0007 · Versus Court: “Pizza & <Pineapple>”. SIDE B wins 2–1. A random verified jury decided. #CringeCourt (testnet) u');
    const mis: ShareCardModel = { ...ShareCardModelFixture, outcome: 'mistrial', winner: null, loser: null, tally: [1, 1] };
    expect(shareText(mis, 'u')).toContain('MISTRIAL (1–1). Everyone got their money back.');
  });
});

describe('shareCardSvg', () => {
  it('is a 1200x630 svg with the headline, case label and fingerprint', () => {
    const svg = shareCardSvg(ShareCardModelFixture, theme);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain('SIDE B WINS');
    expect(svg).toContain('CASE #0007');
    expect(svg).toContain('abcdef0123');
    expect(svg).toContain('Jury 1–2');
    expect(svg).toContain('— Agent B');
    expect(svg).toContain(theme.sideB);
  });

  it('escapes hostile text in title, quote and nickname', () => {
    const hostile: ShareCardModel = {
      ...ShareCardModelFixture,
      title: '<script>alert(1)</script> & "co"',
      quote: { speaker: 'Agent A', text: 'x < y && y > z' },
      winner: 'SIDE B “<b>”',
    };
    const svg = shareCardSvg(hostile, theme);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('x &lt; y &amp;&amp; y &gt; z');
    expect(svg).toContain('&quot;co&quot;');
  });

  it('shows the mistrial copy and colour', () => {
    const svg = shareCardSvg({ ...ShareCardModelFixture, outcome: 'mistrial', headline: 'MISTRIAL', winner: null, loser: null }, theme);
    expect(svg).toContain('MISTRIAL');
    expect(svg).toContain('No verdict · both sides refunded');
    expect(svg).toContain(theme.mistrial);
  });

  it('omits the quote block when there is no quote', () => {
    const svg = shareCardSvg({ ...ShareCardModelFixture, quote: null }, theme);
    expect(svg).not.toContain('font-style="italic"');
    expect(svg).not.toContain('— Agent');
  });
});

describe('wrapText', () => {
  it('wraps greedily within maxChars', () => {
    const lines = wrapText('the quick brown fox jumps over the lazy dog', 12, 10);
    expect(lines).toEqual(['the quick', 'brown fox', 'jumps over', 'the lazy dog']);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
  });

  it('collapses whitespace and returns one line when it fits', () => {
    expect(wrapText('  a \n  b   c ', 20, 3)).toEqual(['a b c']);
  });

  it('truncates to maxLines with an ellipsis', () => {
    const lines = wrapText('one two three four five six seven eight nine ten', 10, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('…')).toBe(true);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(10);
  });

  it('adds no ellipsis when the text fits in maxLines exactly', () => {
    const lines = wrapText('alpha beta gamma delta', 11, 2);
    expect(lines).toEqual(['alpha beta', 'gamma delta']);
  });

  it('never exceeds maxLines for long input', () => {
    const lines = wrapText('lorem ipsum dolor sit amet '.repeat(30), 20, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.at(-1)!.endsWith('…')).toBe(true);
  });
});

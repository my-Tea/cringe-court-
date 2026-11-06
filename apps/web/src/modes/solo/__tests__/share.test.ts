import type { ShareSummary } from '@cringe-court/modes-solo';
import { SHARE_SIZES, drawShareCard, wrap, type CardContext } from '../share/drawShareCard';

function recorder() {
  const calls: { op: string; args: unknown[] }[] = [];
  const styles: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 10 });
      return (...args: unknown[]) => calls.push({ op: prop, args });
    },
    set(target, prop: string, value) {
      target[prop] = value;
      if (prop === 'fillStyle' || prop === 'strokeStyle') styles.push(String(value));
      return true;
    },
  });
  return { ctx: ctx as unknown as CardContext, calls, styles };
}

const SUMMARY: ShareSummary = {
  caseLabel: 'CASE #0069',
  title: 'Reply-all to the whole company',
  category: 'NPC Behavior',
  verdictLabel: 'GUILTY',
  tone: 'guilty',
  headline: 'Your Honor, bro is cooked.',
  tally: [2, 1],
  ballot: ['GUILTY', 'NOT COOKED'],
  quote: { text: 'Members of the jury: vote GUILTY.', by: 'Miss Ratio' },
  sentence: null,
  fingerprint: '0x9b30…9d8b',
  shareText: 'CASE #0069 …',
};

describe('share card renderer', () => {
  it.each(Object.keys(SHARE_SIZES) as (keyof typeof SHARE_SIZES)[])('draws the %s card with the verdict, tally and quote', (format) => {
    const { ctx, calls, styles } = recorder();
    drawShareCard(ctx, SUMMARY, format);
    const texts = calls.filter((c) => c.op === 'fillText').map((c) => String(c.args[0]));
    expect(texts).toEqual(expect.arrayContaining(['GUILTY', '2 – 1', '— Miss Ratio', 'Your Honor, bro is cooked.']));
    expect(texts.some((t) => t.includes('TESTNET DEMO'))).toBe(true);
    // Palette colours only (tokens): hex from the palette or rgb() derived from it.
    for (const s of styles) expect(s).toMatch(/^(#[0-9A-F]{6}|rgb\(\d+ \d+ \d+ \/ [\d.]+\))$/);
    expect(calls.filter((c) => c.op === 'save').length).toBe(calls.filter((c) => c.op === 'restore').length);
  });

  it('wraps and ellipsises long text', () => {
    const { ctx } = recorder();
    const lines = wrap(ctx, 'one two three four five six seven eight nine ten', 100, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('…')).toBe(true);
    expect(wrap(ctx, 'short', 100, 2)).toEqual(['short']);
  });
});

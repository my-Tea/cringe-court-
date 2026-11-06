import { CounselError } from '@cringe-court/core';
import { describe, expect, it } from 'vitest';
import { VersusCounsel } from '../counsel';
import { request } from './helpers';

describe('VersusCounsel.draft', () => {
  it('is deterministic for the same request', async () => {
    const one = await new VersusCounsel().draft(request());
    const two = await new VersusCounsel().draft(request());
    expect(two).toEqual(one);
    expect(one.provider).toBe('fixture');
    expect(one.attempt).toBe(1);
  });

  it('changes with the attempt number', async () => {
    const c = new VersusCounsel();
    const one = await c.draft(request({ attempt: 1 }));
    const two = await c.draft(request({ attempt: 2 }));
    expect(two.attempt).toBe(2);
    expect(two.lines.map((l) => l.text)).not.toEqual(one.lines.map((l) => l.text));
  });

  it('never puts either side’s private notes in the transcript', async () => {
    const draft = await new VersusCounsel().draft(request());
    const text = draft.lines.map((l) => l.text).join('\n');
    expect(text).not.toContain('PRIVATE-NOTES');
    expect(text).not.toContain('third incident');
    expect(text).not.toContain('ate four');
    // ...but a hint that notes exist is allowed for the side that has them, and the story is quoted.
    expect(text).toContain('Agent A for Side A');
    expect(text).toContain('Napkin Knight');
  });

  it('records every request so tests can inspect the information wall', async () => {
    const c = new VersusCounsel();
    const req = request();
    await c.draft(req);
    expect(c.requests).toEqual([req]);
    expect(JSON.stringify(c.requests[0]!.briefs[0])).not.toContain('PRIVATE-NOTES-BRAVO');
    expect(JSON.stringify(c.requests[0]!.briefs[1])).not.toContain('PRIVATE-NOTES-ALPHA');
  });

  it('assigns bench 0 to side-a and bench 1 to side-b, with unique line ids', async () => {
    const { lines } = await new VersusCounsel().draft(request());
    expect(lines.filter((l) => l.bench === 0).every((l) => l.speaker === 'side-a')).toBe(true);
    expect(lines.filter((l) => l.bench === 1).every((l) => l.speaker === 'side-b')).toBe(true);
    expect(lines.filter((l) => l.speaker === 'side-a').every((l) => l.bench === 0)).toBe(true);
    expect(lines.filter((l) => l.speaker === 'side-b').every((l) => l.bench === 1)).toBe(true);
    expect(lines.filter((l) => l.speaker === 'judge').every((l) => l.bench === undefined)).toBe(true);
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
    expect(lines[0]).toMatchObject({ speaker: 'judge', segment: 'call-to-order' });
    expect(lines.at(-1)).toMatchObject({ speaker: 'judge', segment: 'jury-out' });
  });

  it('references exhibits by id, one per exhibit', async () => {
    const { lines } = await new VersusCounsel().draft(request());
    const ex = lines.filter((l) => l.segment === 'exhibit');
    expect(ex.map((l) => l.exhibitId).sort()).toEqual(['ex-a1', 'ex-b1']);
    expect(ex.find((l) => l.exhibitId === 'ex-a1')).toMatchObject({ bench: 0, speaker: 'side-a' });
    expect(ex.find((l) => l.exhibitId === 'ex-b1')).toMatchObject({ bench: 1, speaker: 'side-b' });
    expect(ex.find((l) => l.exhibitId === 'ex-a1')!.text).toContain('Exhibit A');
    expect(ex.find((l) => l.exhibitId === 'ex-b1')!.text).toContain('Exhibit B');
  });

  it('writes the whole trial for scope "full"', async () => {
    const { lines } = await new VersusCounsel().draft(request());
    const segments = new Set(lines.map((l) => l.segment));
    for (const s of ['call-to-order', 'opening', 'exhibit', 'rebuttal', 'closing', 'jury-out']) expect(segments).toContain(s);
  });

  it('ends a teaser with a jury-out line and skips exhibits and closings', async () => {
    const { lines } = await new VersusCounsel().draft(request({ scope: 'teaser' }));
    expect(lines.at(-1)).toMatchObject({ segment: 'jury-out', text: 'THE JURY IS OUT.' });
    expect(lines.some((l) => l.segment === 'exhibit' || l.segment === 'closing')).toBe(false);
    expect(lines.filter((l) => l.segment === 'opening')).toHaveLength(4);
  });

  it('uses each side’s ballot label in its closing', async () => {
    const { lines } = await new VersusCounsel().draft(request());
    expect(lines.find((l) => l.segment === 'closing' && l.bench === 0)!.text).toContain('SIDE A');
    expect(lines.find((l) => l.segment === 'closing' && l.bench === 1)!.text).toContain('SIDE B');
  });

  it('balances both benches in a normal draft and clamps usage to the budget', async () => {
    const c = new VersusCounsel();
    const draft = await c.draft(request({ budget: { maxInputTokens: 100, maxOutputTokens: 50 } }));
    expect((await c.assessBalance(draft)).ok).toBe(true);
    for (const u of draft.usage) {
      expect(u.inputTokens).toBeLessThanOrEqual(100);
      expect(u.outputTokens).toBeLessThanOrEqual(50);
      expect(u.requestIds).toHaveLength(1);
    }
  });

  it('keeps every bench-0 line identical when bench 1 is redrafted with carryOver', async () => {
    const c = new VersusCounsel();
    const first = await c.draft(request());
    const redraft = await c.draft(request({ attempt: 2, redraft: 1, carryOver: first.lines }));
    const bench0 = (d: typeof first) => d.lines.filter((l) => l.bench === 0);
    expect(bench0(redraft)).toEqual(bench0(first));
    expect(bench0(first).length).toBeGreaterThan(3);
    // Bench 1 did change, and judge lines are redrafted too.
    const bench1 = (d: typeof first) => d.lines.filter((l) => l.bench === 1).map((l) => l.text);
    expect(bench1(redraft)).not.toEqual(bench1(first));
  });

  it('keeps every bench-1 line identical when bench 0 is redrafted', async () => {
    const c = new VersusCounsel();
    const first = await c.draft(request());
    const redraft = await c.draft(request({ attempt: 2, redraft: 0, carryOver: first.lines }));
    expect(redraft.lines.filter((l) => l.bench === 1)).toEqual(first.lines.filter((l) => l.bench === 1));
    expect(redraft.lines.filter((l) => l.bench === 0).map((l) => l.text)).not.toEqual(first.lines.filter((l) => l.bench === 0).map((l) => l.text));
  });

  it('redrafts both benches when there is no carryOver', async () => {
    const c = new VersusCounsel();
    const plain = await c.draft(request({ attempt: 2 }));
    const withRedraftNoCarry = await c.draft(request({ attempt: 2, redraft: 1 }));
    expect(withRedraftNoCarry.lines).toEqual(plain.lines);
  });
});

describe('VersusCounsel options', () => {
  it('unbalancedDrafts makes assessBalance fail for that many drafts, then recovers', async () => {
    const c = new VersusCounsel({ unbalancedDrafts: 1 });
    const bad = await c.draft(request());
    const report = await c.assessBalance(bad);
    expect(report.ok).toBe(false);
    expect(report.reasons).toHaveLength(1);
    expect(report.scores[1]).toBeLessThan(0.6);
    const good = await c.draft(request({ attempt: 2 }));
    expect((await c.assessBalance(good)).ok).toBe(true);
  });

  it('fail makes draft throw a CounselError', async () => {
    const c = new VersusCounsel({ fail: true });
    await expect(c.draft(request())).rejects.toBeInstanceOf(CounselError);
    await expect(c.draft(request())).rejects.toMatchObject({ code: 'unavailable', retryable: true });
    expect(c.requests).toHaveLength(2);
  });

  it('rejects with an aborted CounselError when the signal is already aborted', async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(new VersusCounsel().draft(request(), ctl.signal)).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('VersusCounsel.suggestAngles', () => {
  it('returns three distinct angles of at most 140 chars, deterministically', async () => {
    const req = { trialId: 'vs-x', mode: 'versus' as const, category: 'dating-crimes' as const, story: 'We split a dumpling. It vanished.', role: 'prosecution' as const };
    const one = await new VersusCounsel().suggestAngles(req);
    expect(one).toHaveLength(3);
    expect(new Set(one.map((a) => a.text)).size).toBe(3);
    expect(one.map((a) => a.id)).toEqual(['angle-1', 'angle-2', 'angle-3']);
    for (const a of one) expect(a.text.length).toBeLessThanOrEqual(140);
    expect(await new VersusCounsel().suggestAngles(req)).toEqual(one);
  });
});

describe('VersusCounsel.sentence', () => {
  const base = { trialId: 'vs-x', transcriptHash: '0x00' as `0x${string}`, category: 'dating-crimes' as const, title: 'The Last Dumpling' };

  it('sentences the loser of SIDE A', async () => {
    const line = await new VersusCounsel().sentence({ ...base, verdictLabel: 'SIDE A' });
    expect(line).toMatchObject({ id: 'S01', speaker: 'judge', segment: 'sentence', beat: 'gavel' });
    expect(line.text).toContain('finds for SIDE A');
    expect(line.text).toContain('Side B is sentenced');
  });

  it('sentences the loser of SIDE B', async () => {
    const line = await new VersusCounsel().sentence({ ...base, verdictLabel: 'SIDE B' });
    expect(line.text).toContain('finds for SIDE B');
    expect(line.text).toContain('Side A is sentenced');
  });

  it('declares a mistrial on NO VERDICT', async () => {
    const line = await new VersusCounsel().sentence({ ...base, verdictLabel: 'NO VERDICT' });
    expect(line.text).toMatch(/^MISTRIAL/);
    expect(line.text).toMatch(/money back/);
  });
});

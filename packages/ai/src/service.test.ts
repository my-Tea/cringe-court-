import { describe, expect, it } from 'vitest';
import { CounselError } from '@cringe-court/core';
import type { CounselDraft, CourtLine } from '@cringe-court/core';
import { FixtureChatClient } from './fixture';
import { CounselService } from './service';
import { EXHIBITS, requestFor } from './testkit';

const make = (opts: ConstructorParameters<typeof FixtureChatClient>[0] = {}, retries?: number) => {
  const client = new FixtureChatClient(opts);
  return { client, service: new CounselService({ client, ...(retries === undefined ? {} : { retries }) }) };
};

const segs = (lines: readonly CourtLine[]) => lines.map((l) => `${l.segment}${l.bench ?? ''}`);

describe('draft shape', () => {
  it('teaser = call to order, openings, THE JURY IS OUT; no closing or verdict', async () => {
    const { service } = make();
    const d = await service.draft(requestFor('solo', { scope: 'teaser' }));
    expect(segs(d.lines)).toEqual(['call-to-order', 'opening0', 'opening1', 'jury-out']);
    expect(d.lines.at(-1)?.text).toBe('THE JURY IS OUT.');
    expect(d.lines.some((l) => ['closing', 'sentence', 'rebuttal'].includes(l.segment))).toBe(false);
    expect(d.lines.map((l) => l.text).join(' ')).not.toMatch(/verdict is|guilty verdict|you are found/i);
  });

  it('full has the expected order, ids L01.., and speakers from the briefs', async () => {
    const { service } = make();
    const req = requestFor('solo', { exhibits: EXHIBITS });
    const d = await service.draft(req);
    expect(segs(d.lines)).toEqual([
      'call-to-order', 'opening0', 'opening1', 'exhibit0', 'exhibit1', 'rebuttal0', 'rebuttal1', 'closing0', 'closing1', 'jury-out',
    ]);
    expect(d.lines.map((l) => l.id)).toEqual(d.lines.map((_, i) => `L${String(i + 1).padStart(2, '0')}`));
    expect(d.lines[1]?.speaker).toBe('prosecutor');
    expect(d.lines[2]?.speaker).toBe('defense');
    expect(d.lines[0]?.speaker).toBe('judge');
    expect(d.lines.find((l) => l.segment === 'exhibit')?.exhibitId).toBe('x1');
    expect(d.provider).toBe('fixture');
    expect(d.model).toBe('fixture-chat-v1');
  });

  it('versus speakers are side-a and side-b', async () => {
    const { service } = make();
    const d = await service.draft(requestFor('versus', { scope: 'teaser' }));
    expect(d.lines[1]?.speaker).toBe('side-a');
    expect(d.lines[2]?.speaker).toBe('side-b');
  });

  it('bench texts quote only what that bench saw', async () => {
    const { service } = make();
    const d = await service.draft(requestFor('versus', { scope: 'teaser' }));
    expect(d.lines[1]?.text).toContain('STORY-A');
    expect(d.lines[1]?.text).not.toContain('STORY-B');
    expect(d.lines[2]?.text).toContain('STORY-B');
    expect(d.lines[2]?.text).not.toContain('STORY-A');
  });

  it('records usage and request ids per bench', async () => {
    const { service } = make();
    const d = await service.draft(requestFor('solo'));
    expect(d.usage[0].requestIds).toEqual(['fixture-1']);
    expect(d.usage[1].requestIds).toEqual(['fixture-2']);
    expect(d.usage[0].inputTokens).toBeGreaterThan(0);
    expect(d.usage[1].outputTokens).toBeGreaterThan(0);
  });
});

describe('fairness', () => {
  it('calls once per bench with identical budget, temperature and format', async () => {
    const { service, client } = make();
    await service.draft(requestFor('versus', { budget: { maxInputTokens: 3000, maxOutputTokens: 321 } }));
    expect(client.requests).toHaveLength(2);
    const [a, b] = client.requests;
    expect(a!.tag).toBe('bench:0');
    expect(b!.tag).toBe('bench:1');
    expect(a!.maxTokens).toBe(321);
    expect(b!.maxTokens).toBe(321);
    expect(a!.temperature).toBe(b!.temperature);
    expect(a!.responseFormat).toBe('json');
    expect(b!.responseFormat).toBe('json');
  });

  it('passes each bench its own payer', async () => {
    const { service, client } = make();
    await service.draft(requestFor('versus', { payer: ['user-credits', 'platform'] }));
    expect(client.requests.map((r) => r.payer)).toEqual(['user-credits', 'platform']);
  });

  it('bench prompts sent to the client never contain the other side notes', async () => {
    const { service, client } = make();
    await service.draft(requestFor('versus'));
    const sent = client.requests.map((r) => r.messages.map((m) => m.content).join('\n'));
    expect(sent[0]).not.toContain('SECRET-B');
    expect(sent[1]).not.toContain('SECRET-A');
  });

  it('budget-exceeded is thrown and not retried', async () => {
    const { service, client } = make();
    await expect(service.draft(requestFor('solo', { budget: { maxInputTokens: 10, maxOutputTokens: 50 } }))).rejects.toMatchObject({ code: 'budget-exceeded' });
    expect(client.requests).toHaveLength(0);
  });
});

describe('redraft and carry-over', () => {
  it('redraft one bench keeps the other bench lines from carryOver', async () => {
    const first = make();
    const req = requestFor('versus', { exhibits: EXHIBITS });
    const d1 = await first.service.draft(req);
    const { service, client } = make();
    const d2 = await service.draft({ ...req, attempt: 2, redraft: 1, carryOver: d1.lines });
    expect(client.requests.map((r) => r.tag)).toEqual(['bench:1']);
    const bench0 = (d: CounselDraft) => d.lines.filter((l) => l.bench === 0).map((l) => l.text);
    expect(bench0(d2)).toEqual(bench0(d1));
    expect(d2.usage[0]).toEqual({ inputTokens: 0, outputTokens: 0, requestIds: [] });
    expect(d2.usage[1].requestIds).toEqual(['fixture-1']);
    expect(d2.attempt).toBe(2);
    expect(segs(d2.lines)).toEqual(segs(d1.lines));
  });

  it('redrafting bench 0 keeps bench 1', async () => {
    const req = requestFor('solo');
    const d1 = await make().service.draft(req);
    const { service, client } = make();
    const d2 = await service.draft({ ...req, redraft: 0, carryOver: d1.lines });
    expect(client.requests.map((r) => r.tag)).toEqual(['bench:0']);
    expect(d2.lines.filter((l) => l.bench === 1).map((l) => l.text)).toEqual(d1.lines.filter((l) => l.bench === 1).map((l) => l.text));
  });

  it('redraft without usable carryOver drafts both benches', async () => {
    const { service, client } = make();
    await service.draft({ ...requestFor('solo'), redraft: 1 });
    expect(client.requests).toHaveLength(2);
  });

  it('teaser openings carry into the full trial and are not rewritten', async () => {
    const teaser = await make().service.draft(requestFor('solo', { scope: 'teaser' }));
    const { service, client } = make();
    const full = await service.draft(requestFor('solo', { carryOver: teaser.lines }));
    const openings = (d: CounselDraft) => d.lines.filter((l) => l.segment === 'opening').map((l) => l.text);
    expect(openings(full)).toEqual(openings(teaser));
    expect(client.requests[0]!.messages[0]!.content).toContain('do not write another opening');
    expect(segs(full.lines)).toContain('closing1');
  });
});

describe('retries', () => {
  it('retries a retryable error then succeeds, summing usage', async () => {
    const { service, client } = make({ failFirst: 1 });
    const d = await service.draft(requestFor('solo', { scope: 'teaser' }));
    expect(client.requests).toHaveLength(3);
    expect(d.lines).toHaveLength(4);
  });

  it('retries invalid JSON then succeeds and records both request ids', async () => {
    const { service } = make({ invalidJsonFirst: 1 });
    const d = await service.draft(requestFor('solo', { scope: 'teaser' }));
    expect(d.usage[0].requestIds).toEqual(['fixture-1', 'fixture-2']);
  });

  it('invalid JSON on every attempt fails with invalid-output', async () => {
    const { service, client } = make({ invalidJsonFirst: 10 });
    await expect(service.draft(requestFor('solo', { scope: 'teaser' }))).rejects.toMatchObject({ code: 'invalid-output' });
    expect(client.requests).toHaveLength(2);
  });

  it('gives up after the configured retries on unavailable', async () => {
    const { service, client } = make({ failFirst: 10 }, 2);
    await expect(service.draft(requestFor('solo'))).rejects.toMatchObject({ code: 'unavailable' });
    expect(client.requests).toHaveLength(3);
  });

  it('does not retry non-retryable errors', async () => {
    const client = { provider: 'fixture' as const, calls: 0, async complete(): Promise<never> { this.calls++; throw new CounselError('unsafe-content', 'no'); } };
    await expect(new CounselService({ client }).draft(requestFor('solo'))).rejects.toMatchObject({ code: 'unsafe-content' });
    expect(client.calls).toBe(1);
  });

  it('wraps unknown errors as retryable unavailable', async () => {
    const client = { provider: 'fixture' as const, async complete(): Promise<never> { throw new Error('boom'); } };
    await expect(new CounselService({ client }).draft(requestFor('solo'))).rejects.toMatchObject({ code: 'unavailable', retryable: true });
  });

  it('aborts', async () => {
    const { service, client } = make();
    const c = new AbortController();
    c.abort();
    await expect(service.draft(requestFor('solo'), c.signal)).rejects.toMatchObject({ code: 'aborted' });
    expect(client.requests).toHaveLength(0);
  });

  it('rejects a bench that omits its closing', async () => {
    const client = {
      provider: 'fixture' as const,
      async complete() {
        return { content: '{"lines":[{"segment":"opening","text":"hi"}]}', requestId: 'r', model: 'm', usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    await expect(new CounselService({ client }).draft(requestFor('solo'))).rejects.toMatchObject({ code: 'invalid-output' });
  });
});

describe('assessBalance', () => {
  it('passes a balanced fixture draft', async () => {
    const { service } = make();
    const req = requestFor('solo');
    const r = await service.assessBalance(await service.draft(req), req);
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('fails when a bench is empty', async () => {
    const { service } = make();
    const req = requestFor('solo', { scope: 'teaser' });
    const d = await service.draft(req);
    const empty: CounselDraft = { ...d, lines: d.lines.filter((l) => l.bench !== 1) };
    const r = await service.assessBalance(empty, req);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toContain('Bench 1 has no opening');
    expect(r.scores[1]).toBe(0);
  });

  it('fails a full draft missing a closing', async () => {
    const { service } = make();
    const req = requestFor('solo');
    const d = await service.draft(req);
    const r = await service.assessBalance({ ...d, lines: d.lines.filter((l) => !(l.bench === 0 && l.segment === 'closing')) }, req);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toContain('Bench 0 has no closing');
  });

  it('fails a lopsided draft', async () => {
    const { service } = make();
    const req = requestFor('solo');
    const d = await service.draft(req);
    const lines = d.lines.map((l) => (l.bench === 1 ? { ...l, text: 'Ok.' } : l));
    const r = await service.assessBalance({ ...d, lines }, req);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toContain('Bench 1 argues at');
  });
});

describe('suggestAngles', () => {
  const areq = { trialId: 't', mode: 'solo' as const, category: 'internet-crimes' as const, story: 'I replied all. It was bad.', role: 'defense' as const };

  it('returns exactly 3 suggestions within 140 chars', async () => {
    const { service, client } = make();
    const a = await service.suggestAngles(areq);
    expect(a).toHaveLength(3);
    expect(a.every((s) => s.text.length > 0 && s.text.length <= 140)).toBe(true);
    expect(a.map((s) => s.id)).toEqual(['angle-1', 'angle-2', 'angle-3']);
    expect(client.requests).toHaveLength(1);
    expect(client.requests[0]!.tag).toBe('angles');
  });

  it('falls back to templates when parsing fails twice', async () => {
    const { service, client } = make({ invalidJsonFirst: 5 });
    const a = await service.suggestAngles(areq);
    expect(a).toHaveLength(3);
    expect(client.requests).toHaveLength(2);
  });

  it('pads and truncates model output to three', async () => {
    const client = {
      provider: 'fixture' as const,
      async complete() {
        return { content: `{"angles":["only one ${'x'.repeat(300)}"]}`, requestId: 'r', model: 'm', usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    const a = await new CounselService({ client }).suggestAngles(areq);
    expect(a).toHaveLength(3);
    expect(a[0]!.text).toHaveLength(140);
  });

  it('still propagates unavailable', async () => {
    const { service } = make({ failFirst: 5 });
    await expect(service.suggestAngles(areq)).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('sentence', () => {
  const sreq = { trialId: 't', verdictLabel: 'SIDE B', transcriptHash: '0x00' as const, category: 'dating-crimes' as const, title: 'T' };

  it('contains the verdict label and is spoken by the judge', async () => {
    const { service } = make();
    const l = await service.sentence(sreq);
    expect(l.speaker).toBe('judge');
    expect(l.segment).toBe('sentence');
    expect(l.text).toContain('SIDE B');
  });

  it('prefixes the label if the model forgot it', async () => {
    const client = {
      provider: 'fixture' as const,
      async complete() {
        return { content: '{"lines":[{"segment":"sentence","text":"Touch grass."}]}', requestId: 'r', model: 'm', usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    const l = await new CounselService({ client }).sentence(sreq);
    expect(l.text.startsWith('The jury says SIDE B.')).toBe(true);
  });

  it('falls back to a template on failure, including mistrial', async () => {
    const { service } = make({ failFirst: 10 });
    expect((await service.sentence(sreq)).text).toContain('SIDE B');
    expect((await service.sentence({ ...sreq, verdictLabel: 'NO VERDICT' })).text).toContain('MISTRIAL');
  });

  it('propagates abort', async () => {
    const { service } = make();
    const c = new AbortController();
    c.abort();
    await expect(service.sentence(sreq, c.signal)).rejects.toMatchObject({ code: 'aborted' });
  });
});

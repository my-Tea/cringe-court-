import { describe, expect, it } from 'vitest';
import { FixtureChatClient, createFixtureCounsel } from './fixture';

describe('FixtureChatClient', () => {
  it('records requests and honours abort', async () => {
    const c = new FixtureChatClient();
    const ctl = new AbortController();
    ctl.abort();
    await expect(c.complete({ messages: [], maxTokens: 1, temperature: 0, payer: 'platform', tag: 'angles', signal: ctl.signal })).rejects.toMatchObject({ code: 'aborted' });
    expect(c.requests).toHaveLength(1);
  });

  it('createFixtureCounsel yields a working fixture-provider service', async () => {
    const s = createFixtureCounsel();
    expect(s.id).toBe('fixture');
    const angles = await s.suggestAngles({ trialId: 't', mode: 'solo', category: 'internet-crimes', story: 'x', role: 'defense' });
    expect(angles).toHaveLength(3);
  });

  it('supports latency', async () => {
    const t = Date.now();
    await createFixtureCounsel({ latencyMs: 20 }).suggestAngles({ trialId: 't', mode: 'solo', category: 'internet-crimes', story: 'x', role: 'defense' });
    expect(Date.now() - t).toBeGreaterThanOrEqual(15);
  });
});

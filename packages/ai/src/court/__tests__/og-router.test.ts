/**
 * OgRouterClient against a fake transport. These tests prove request shape,
 * error classification, retry policy and metadata handling; they do NOT prove
 * that a live 0G call works (see the live smoke in docs/ai/10 §8).
 */
import { describe, expect, it } from 'vitest';
import { loadCourtAIConfig, type CourtConfigError } from '../config';
import { InferenceError, type InferenceRequest } from '../inference';
import { OgRouterClient, chatModels, type FetchLike, type FetchResponseLike } from '../og-router';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

function response(status: number, body: unknown, headers: Record<string, string> = {}): FetchResponseLike {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => h.get(n.toLowerCase()) ?? null, forEach: (cb) => h.forEach((v, k) => cb(v, k)) },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const CATALOG = {
  object: 'list',
  data: [
    { id: 'json-model', type: 'chatbot', supported_parameters: ['temperature', 'response_format'], context_length: 400000 },
    { id: 'plain-model', type: 'chatbot', supported_parameters: ['tools', 'stream'] },
    { id: 'image-model', type: 'text-to-image' },
  ],
};

const completion = (extra: Record<string, unknown> = {}) => ({
  id: 'chatcmpl-abc',
  model: 'json-model',
  choices: [{ message: { role: 'assistant', content: '{"ok":true}' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 120, completion_tokens: 40 },
  ...extra,
});

function fakeFetch(chat: Array<FetchResponseLike | Error>, catalog: FetchResponseLike | Error = response(200, CATALOG)) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, ...(init.body ? { body: JSON.parse(init.body) as Record<string, unknown> } : {}) });
    const next = url.endsWith('/models') ? catalog : chat.shift();
    if (!next) throw new Error('no more fake responses');
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

const REQ: InferenceRequest = { purpose: 'trial', caseId: 'c1', messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, temperature: 0.8, json: true };
const sleeps: number[] = [];
const client = (fetch: FetchLike, extra: Partial<ConstructorParameters<typeof OgRouterClient>[0]> = {}) =>
  new OgRouterClient({ apiKey: 'sk-test', model: 'json-model', fetch, sleep: async (ms) => void sleeps.push(ms), ...extra });

describe('OgRouterClient: requests', () => {
  it('posts an OpenAI-compatible request with bearer auth to the router', async () => {
    const { fetch, calls } = fakeFetch([response(200, completion({ request_id: 'rid-123' }))]);
    const r = await client(fetch).complete(REQ);
    const chat = calls.find((c) => c.url.endsWith('/chat/completions'));
    expect(chat?.url).toBe('https://router-api.0g.ai/v1/chat/completions');
    expect(chat?.headers.Authorization).toBe('Bearer sk-test');
    expect(chat?.headers['X-0G-Provider-Trust-Mode']).toBeUndefined();
    expect(chat?.body).toMatchObject({ model: 'json-model', max_tokens: 100, temperature: 0.8, response_format: { type: 'json_object' } });
    expect(r).toMatchObject({ content: '{"ok":true}', provider: '0g-router', requestId: 'rid-123', usage: { inputTokens: 120, outputTokens: 40 }, trustMode: 'standard' });
    expect(r.responseMeta).toMatchObject({ completionId: 'chatcmpl-abc', finishReason: 'stop', requestId: 'rid-123' });
  });

  it('only sends parameters the catalog says the model supports', async () => {
    const { fetch, calls } = fakeFetch([response(200, completion())]);
    await client(fetch, { model: 'plain-model' }).complete(REQ);
    const body = calls.find((c) => c.url.endsWith('/chat/completions'))?.body ?? {};
    expect(body.response_format).toBeUndefined();
    expect(body.temperature).toBeUndefined();
  });

  it('sends the trust-mode header for verified and private', async () => {
    for (const mode of ['verified', 'private'] as const) {
      const { fetch, calls } = fakeFetch([response(200, completion())]);
      const r = await client(fetch, { trustMode: mode }).complete(REQ);
      expect(calls.find((c) => c.url.endsWith('/chat/completions'))?.headers['X-0G-Provider-Trust-Mode']).toBe(mode);
      expect(r.trustMode).toBe(mode);
    }
  });

  it('keeps 0G evidence headers verbatim', async () => {
    const { fetch } = fakeFetch([response(200, completion(), { 'x-0g-provider': '0xabc', 'x-request-id': 'hdr-1', 'content-type': 'application/json' })]);
    const r = await client(fetch).complete(REQ);
    expect(r.responseMeta).toMatchObject({ 'header:x-0g-provider': '0xabc', 'header:x-request-id': 'hdr-1' });
    expect(r.responseMeta['header:content-type']).toBeUndefined();
    expect(r.requestId).toBe('hdr-1');
  });

  it('never invents a request id', async () => {
    const { fetch } = fakeFetch([response(200, { choices: [{ message: { content: 'x' } }] })]);
    expect((await client(fetch).complete(REQ)).requestId).toBeNull();
  });

  it('reads content given as parts', async () => {
    const { fetch } = fakeFetch([response(200, { choices: [{ message: { content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] } }] })]);
    expect((await client(fetch).complete(REQ)).content).toBe('{"a":1}');
  });

  it('fails clearly when OG_MODEL is not in the catalog', async () => {
    const { fetch } = fakeFetch([]);
    await expect(client(fetch, { model: 'made-up-model' }).complete(REQ)).rejects.toMatchObject({ code: 'model-not-found', retryable: false });
  });

  it('degrades to plain requests when the catalog is unreachable', async () => {
    const { fetch, calls } = fakeFetch([response(200, completion())], new Error('offline'));
    await client(fetch).complete(REQ);
    expect(calls.find((c) => c.url.endsWith('/chat/completions'))?.body?.response_format).toBeUndefined();
  });
});

describe('OgRouterClient: errors and retries', () => {
  it('honours Retry-After on 429, then succeeds', async () => {
    sleeps.length = 0;
    const { fetch } = fakeFetch([response(429, { error: { message: 'slow down' } }, { 'retry-after': '2' }), response(200, completion())]);
    const r = await client(fetch).complete(REQ);
    expect(r.attempts).toBe(2);
    expect(sleeps).toEqual([2000]);
  });

  it('retries 502 and network errors with backoff, within the limit', async () => {
    sleeps.length = 0;
    const { fetch } = fakeFetch([response(502, { error: { message: 'provider' } }), new Error('ECONNRESET'), response(200, completion())]);
    expect((await client(fetch).complete(REQ)).attempts).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('gives up after maxRetries', async () => {
    const { fetch, calls } = fakeFetch([response(502, {}), response(502, {}), response(502, {}), response(502, {})]);
    await expect(client(fetch, { maxRetries: 2 }).complete(REQ)).rejects.toMatchObject({ code: 'provider-error' });
    expect(calls.filter((c) => c.url.endsWith('/chat/completions'))).toHaveLength(3);
  });

  it.each([
    [400, 'bad-request'],
    [401, 'auth'],
    [402, 'insufficient-balance'],
    [403, 'forbidden'],
    [503, 'no-provider'],
  ] as const)('does not retry HTTP %i (%s) and keeps the request id', async (status, code) => {
    const { fetch, calls } = fakeFetch([response(status, { error: { message: 'nope', type: 't', code: 'c' }, request_id: 'err-rid' })]);
    const err = (await client(fetch).complete(REQ).catch((e: unknown) => e)) as InferenceError;
    expect(err).toBeInstanceOf(InferenceError);
    expect(err).toMatchObject({ code, retryable: false, status, requestId: 'err-rid' });
    expect(calls.filter((c) => c.url.endsWith('/chat/completions'))).toHaveLength(1);
  });

  it('times out slow requests and classifies them', async () => {
    const hang: FetchLike = (url, init) =>
      url.endsWith('/models')
        ? Promise.resolve(response(200, CATALOG))
        : new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    await expect(client(hang, { timeoutMs: 10, maxRetries: 0 }).complete(REQ)).rejects.toMatchObject({ code: 'timeout', retryable: true });
  });

  it('treats an empty completion as a retryable invalid response', async () => {
    const { fetch } = fakeFetch([response(200, { choices: [{ message: { content: '' } }] })]);
    await expect(client(fetch, { maxRetries: 0 }).complete(REQ)).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('refuses management keys and missing settings up front', () => {
    expect(() => client(fakeFetch([]).fetch, { apiKey: 'mk-admin' })).toThrow(/management key/);
    expect(() => client(fakeFetch([]).fetch, { model: '' })).toThrow(/OG_MODEL/);
  });
});

describe('catalog helpers and configuration', () => {
  it('lists chat models with JSON support flags', () => {
    expect(chatModels(CATALOG.data)).toEqual([
      { id: 'json-model', json: true, context: 400000 },
      { id: 'plain-model', json: false, context: null },
    ]);
  });

  it('defaults to mock and requires explicit settings for 0G', () => {
    expect(loadCourtAIConfig({})).toEqual({ provider: 'mock' });
    const err = (() => {
      try {
        loadCourtAIConfig({ COURT_AI_PROVIDER: '0g' });
      } catch (e) {
        return e as CourtConfigError;
      }
      return null;
    })();
    expect(err?.problems.join(' ')).toMatch(/OG_API_KEY.*OG_MODEL/);
  });

  it('loads a complete 0G configuration', () => {
    expect(loadCourtAIConfig({ COURT_AI_PROVIDER: '0g', OG_API_KEY: 'sk-x', OG_MODEL: 'json-model', OG_TRUST_MODE: 'verified' })).toEqual({
      provider: '0g',
      og: { apiKey: 'sk-x', model: 'json-model', baseUrl: 'https://router-api.0g.ai/v1', trustMode: 'verified', timeoutMs: 45000, maxRetries: 2, jsonMode: 'auto' },
    });
  });

  it('rejects browser-exposed secrets and bad values', () => {
    expect(() => loadCourtAIConfig({ VITE_OG_API_KEY: 'sk-oops' })).toThrow(/bundled into the browser/);
    expect(() => loadCourtAIConfig({ COURT_AI_PROVIDER: '0g', OG_API_KEY: 'sk-x', OG_MODEL: 'm', OG_BASE_URL: 'http://evil.example' })).toThrow(/https/);
    expect(() => loadCourtAIConfig({ COURT_AI_PROVIDER: '0g', OG_API_KEY: 'sk-x', OG_MODEL: 'm', OG_TRUST_MODE: 'paranoid' })).toThrow(/OG_TRUST_MODE/);
  });
});

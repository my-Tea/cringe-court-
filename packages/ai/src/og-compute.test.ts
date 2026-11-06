import { describe, expect, it, vi } from 'vitest';
import { CounselError } from '@cringe-court/core';
import { OgComputeChatClient, createOgBrokerFromSdk } from './og-compute';
import type { FetchLike, FetchResponseLike, OgBroker } from './og-compute';
import type { ChatRequest } from './chat';

const PROVIDER = '0xprovider';
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}): FetchResponseLike => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (n) => headers[n] ?? null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const okBody = { id: 'chat-123', model: 'qwen-x', choices: [{ message: { content: '{"lines":[]}' } }], usage: { prompt_tokens: 11, completion_tokens: 7 } };

function setup(fetchImpl?: FetchLike, verified: boolean | null = true) {
  const broker: OgBroker = {
    getServiceMetadata: vi.fn(async () => ({ endpoint: 'https://prov.example/v1/proxy/', model: 'qwen-x' })),
    getRequestHeaders: vi.fn(async () => ({ Authorization: 'Bearer sig' })),
    processResponse: vi.fn(async () => verified),
  };
  const fetch = vi.fn(fetchImpl ?? (async () => reply(okBody)));
  const client = new OgComputeChatClient({ broker, providerAddress: PROVIDER, fetch: fetch as unknown as FetchLike, timeoutMs: 200 });
  return { broker, fetch, client };
}

const req = (patch: Partial<ChatRequest> = {}): ChatRequest => ({
  messages: [
    { role: 'system', content: 'SYS' },
    { role: 'user', content: 'USER-1' },
  ],
  maxTokens: 300,
  temperature: 0.7,
  responseFormat: 'json',
  payer: 'platform',
  tag: 'bench:0',
  ...patch,
});

describe('OgComputeChatClient', () => {
  it('posts an OpenAI-compatible request with broker headers', async () => {
    const { client, fetch, broker } = setup();
    await client.complete(req());
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://prov.example/v1/proxy/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer sig' });
    expect(JSON.parse(init.body)).toEqual({
      model: 'qwen-x',
      messages: req().messages,
      max_tokens: 300,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    expect(broker.getRequestHeaders).toHaveBeenCalledWith(PROVIDER, 'USER-1');
  });

  it('omits response_format when not requested', async () => {
    const { client, fetch } = setup();
    const r = req();
    delete r.responseFormat;
    await client.complete(r);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).not.toHaveProperty('response_format');
  });

  it('maps content, id, model and usage, and verifies with the chat id', async () => {
    const { client, broker } = setup();
    const res = await client.complete(req());
    expect(res).toEqual({ content: '{"lines":[]}', requestId: 'chat-123', model: 'qwen-x', usage: { inputTokens: 11, outputTokens: 7 } });
    expect(broker.processResponse).toHaveBeenCalledWith(PROVIDER, '{"lines":[]}', 'chat-123');
  });

  it('estimates usage when the provider omits it', async () => {
    const { client } = setup(async () => reply({ id: 'c', choices: [{ message: { content: 'abcdefgh' } }] }));
    const res = await client.complete(req());
    expect(res.usage.outputTokens).toBe(2);
    expect(res.usage.inputTokens).toBeGreaterThan(0);
  });

  it('caches service metadata', async () => {
    const { client, broker } = setup();
    await client.complete(req());
    await client.complete(req());
    expect(broker.getServiceMetadata).toHaveBeenCalledTimes(1);
  });

  it('treats a null verification (unsupported) as acceptable', async () => {
    const { client } = setup(undefined, null);
    await expect(client.complete(req())).resolves.toBeDefined();
  });

  it('fails verification with invalid-output', async () => {
    const { client } = setup(undefined, false);
    await expect(client.complete(req())).rejects.toMatchObject({ code: 'invalid-output', message: 'response failed 0G verification' });
  });

  it('maps 429 to rate-limited (retryable)', async () => {
    const { client } = setup(async () => reply('slow down', 429));
    await expect(client.complete(req())).rejects.toMatchObject({ code: 'rate-limited', retryable: true });
  });

  it('maps 500 to unavailable (retryable)', async () => {
    const { client } = setup(async () => reply('oops', 500));
    await expect(client.complete(req())).rejects.toMatchObject({ code: 'unavailable', retryable: true });
  });

  it('maps other 4xx to non-retryable unavailable', async () => {
    const { client } = setup(async () => reply('nope', 401));
    await expect(client.complete(req())).rejects.toMatchObject({ code: 'unavailable', retryable: false });
  });

  it('maps network errors to unavailable', async () => {
    const { client } = setup(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(client.complete(req())).rejects.toMatchObject({ code: 'unavailable', retryable: true });
  });

  it('maps non-JSON and shapeless bodies to invalid-output', async () => {
    await expect(setup(async () => reply('<html>')).client.complete(req())).rejects.toMatchObject({ code: 'invalid-output' });
    await expect(setup(async () => reply({ choices: [] })).client.complete(req())).rejects.toMatchObject({ code: 'invalid-output' });
  });

  it('maps timeouts to unavailable', async () => {
    const { client } = setup((_u, init) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted')))));
    await expect(client.complete(req())).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('timed out') });
  });

  it('maps caller abort to aborted, before and during the call', async () => {
    const pre = new AbortController();
    pre.abort();
    await expect(setup().client.complete(req({ signal: pre.signal }))).rejects.toMatchObject({ code: 'aborted' });

    const mid = new AbortController();
    const { client } = setup((_u, init) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted')))));
    const p = client.complete(req({ signal: mid.signal }));
    setTimeout(() => mid.abort(), 5);
    await expect(p).rejects.toMatchObject({ code: 'aborted' });
  });

  it('refuses user-credits without a user broker (D12 gate)', async () => {
    const { client, fetch } = setup();
    const err = await client.complete(req({ payer: 'user-credits' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CounselError);
    expect(err).toMatchObject({ code: 'unavailable', message: 'Personal 0G credits are not enabled (D12 gate)' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the user broker for user-credits when provided', async () => {
    const { broker } = setup();
    const userBroker: OgBroker = { ...broker, getRequestHeaders: vi.fn(async () => ({ Authorization: 'Bearer user' })) };
    const fetch = vi.fn<FetchLike>(async () => reply(okBody));
    const client = new OgComputeChatClient({ broker, userBroker, providerAddress: PROVIDER, fetch });
    await client.complete(req({ payer: 'user-credits' }));
    expect(userBroker.getRequestHeaders).toHaveBeenCalled();
    expect(broker.getRequestHeaders).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0]![1].headers).toMatchObject({ Authorization: 'Bearer user' });
  });

  it('reads the chat id from the ZG-Res-Key header when present', async () => {
    const { client, broker } = setup(async () => reply(okBody, 200, { 'ZG-Res-Key': 'hdr-id' }));
    const res = await client.complete(req());
    expect(res.requestId).toBe('hdr-id');
    expect(broker.processResponse).toHaveBeenCalledWith(PROVIDER, expect.any(String), 'hdr-id');
  });
});

describe('createOgBrokerFromSdk', () => {
  it('maps broker.inference.* onto OgBroker', async () => {
    const inference = {
      getServiceMetadata: vi.fn(async () => ({ endpoint: 'e', model: 'm', extra: 1 })),
      getRequestHeaders: vi.fn(async () => ({ A: 'b', bad: 1 })),
      processResponse: vi.fn(async () => true),
    };
    const b = createOgBrokerFromSdk({ inference });
    expect(await b.getServiceMetadata('p')).toEqual({ endpoint: 'e', model: 'm' });
    expect(await b.getRequestHeaders('p', 'c')).toEqual({ A: 'b' });
    expect(await b.processResponse('p', 'c', 'id')).toBe(true);
    expect(inference.processResponse).toHaveBeenCalledWith('p', 'c', 'id');
  });

  it('rejects unexpected shapes', async () => {
    expect(() => createOgBrokerFromSdk(null)).toThrow(TypeError);
    expect(() => createOgBrokerFromSdk({ inference: {} })).toThrow(TypeError);
    const b = createOgBrokerFromSdk({ inference: { getServiceMetadata: async () => ({}), getRequestHeaders: async () => ({}), processResponse: async () => 'x' } });
    await expect(b.getServiceMetadata('p')).rejects.toThrow(TypeError);
    expect(await b.processResponse('p', 'c')).toBeNull();
  });
});

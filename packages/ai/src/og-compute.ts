/**
 * OgComputeChatClient: ChatClient over 0G Compute's OpenAI-compatible provider
 * endpoints. The 0G SDK is never imported here; the app injects a broker shaped
 * like the serving broker's inference API (see OgBroker) and, optionally, a
 * second broker funded by the user's own credits (D12, off by default).
 *
 * Flow: service metadata (cached) -> signed request headers for the user
 * content -> POST {endpoint}/chat/completions -> processResponse() to verify
 * the provider's answer. The method names mirror the public docs but are NOT
 * verified against the live SDK; see README.
 */
import { CounselError } from '@cringe-court/core';
import { estimateMessagesTokens, estimateTokens } from './chat';
import type { ChatClient, ChatRequest, ChatResponse } from './chat';

export interface OgServiceMetadata {
  endpoint: string;
  model: string;
}

/** The slice of the 0G serving broker's inference API this adapter needs. */
export interface OgBroker {
  getServiceMetadata(providerAddress: string): Promise<OgServiceMetadata>;
  getRequestHeaders(providerAddress: string, content: string): Promise<Record<string, string>>;
  /** true = verified, false = failed verification, null = provider does not support verification. */
  processResponse(providerAddress: string, content: string, chatId?: string): Promise<boolean | null>;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<FetchResponseLike>;

export interface OgComputeOptions {
  broker: OgBroker;
  /** Broker funded by the user's own 0G credits (D12 Pass). Without it, `user-credits` calls are refused. */
  userBroker?: OgBroker;
  providerAddress: string;
  timeoutMs?: number;
  fetch?: FetchLike;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export class OgComputeChatClient implements ChatClient {
  readonly provider = 'og-compute' as const;
  readonly #options: OgComputeOptions;
  readonly #metadata = new WeakMap<OgBroker, Promise<OgServiceMetadata>>();

  constructor(options: OgComputeOptions) {
    this.#options = options;
  }

  #pick(payer: ChatRequest['payer']): OgBroker {
    if (payer === 'platform') return this.#options.broker;
    if (!this.#options.userBroker) throw new CounselError('unavailable', 'Personal 0G credits are not enabled (D12 gate)');
    return this.#options.userBroker;
  }

  #metadataFor(broker: OgBroker): Promise<OgServiceMetadata> {
    let cached = this.#metadata.get(broker);
    if (!cached) {
      cached = broker.getServiceMetadata(this.#options.providerAddress);
      this.#metadata.set(broker, cached);
      cached.catch(() => this.#metadata.delete(broker));
    }
    return cached;
  }

  async complete(request: ChatRequest): Promise<ChatResponse> {
    const broker = this.#pick(request.payer);
    if (request.signal?.aborted) throw new CounselError('aborted', 'Aborted');
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const onAbort = (): void => controller.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      return await this.#run(broker, request, controller.signal);
    } catch (e) {
      if (e instanceof CounselError) throw e;
      if (request.signal?.aborted) throw new CounselError('aborted', 'Aborted');
      if (timedOut) throw new CounselError('unavailable', '0G Compute request timed out', true);
      throw new CounselError('unavailable', e instanceof Error ? e.message : '0G Compute request failed', true);
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }

  async #run(broker: OgBroker, request: ChatRequest, signal: AbortSignal): Promise<ChatResponse> {
    const { providerAddress } = this.#options;
    const meta = await this.#metadataFor(broker);
    const userContent = request.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');
    const headers = await broker.getRequestHeaders(providerAddress, userContent);
    const body: Record<string, unknown> = {
      model: meta.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    };
    if (request.responseFormat === 'json') body.response_format = { type: 'json_object' };

    const doFetch = this.#options.fetch ?? (globalThis.fetch as unknown as FetchLike);
    const res = await doFetch(`${meta.endpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
    if (res.status === 429) throw new CounselError('rate-limited', '0G provider rate limit', true);
    if (res.status >= 500) throw new CounselError('unavailable', `0G provider error ${res.status}`, true);
    if (!res.ok) throw new CounselError('unavailable', `0G provider rejected the request (${res.status})`);

    const parsed = parseCompletion(await res.text());
    const requestId = res.headers.get('ZG-Res-Key') ?? parsed.id ?? '';
    const verified = await broker.processResponse(providerAddress, parsed.content, requestId || undefined);
    if (verified === false) throw new CounselError('invalid-output', 'response failed 0G verification', true);
    return {
      content: parsed.content,
      requestId,
      model: parsed.model ?? meta.model,
      usage: parsed.usage ?? { inputTokens: estimateMessagesTokens(request.messages), outputTokens: estimateTokens(parsed.content) },
    };
  }
}

interface Completion {
  content: string;
  id?: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseCompletion(text: string): Completion {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CounselError('invalid-output', '0G provider returned non-JSON', true);
  }
  const choice = isRecord(json) && Array.isArray(json.choices) ? json.choices[0] : undefined;
  const message = isRecord(choice) ? choice.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== 'string') throw new CounselError('invalid-output', '0G response has no message content', true);
  const out: Completion = { content };
  if (isRecord(json)) {
    if (typeof json.id === 'string') out.id = json.id;
    if (typeof json.model === 'string') out.model = json.model;
    const u = json.usage;
    if (isRecord(u) && typeof u.prompt_tokens === 'number' && typeof u.completion_tokens === 'number') {
      out.usage = { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens };
    }
  }
  return out;
}

/**
 * Adapt the 0G SDK's broker (`broker.inference.*`) to OgBroker without importing
 * the SDK. Input is narrowed structurally; anything unexpected throws at wiring time.
 */
export function createOgBrokerFromSdk(sdkBroker: unknown): OgBroker {
  const inference = isRecord(sdkBroker) ? sdkBroker.inference : undefined;
  if (!isRecord(inference)) throw new TypeError('Expected a 0G broker with an `inference` API');
  const method = (name: string): ((...args: unknown[]) => unknown) => {
    const fn = inference[name];
    if (typeof fn !== 'function') throw new TypeError(`0G broker.inference.${name} is not a function`);
    return (...args) => (fn as (...a: unknown[]) => unknown).apply(inference, args);
  };
  const getServiceMetadata = method('getServiceMetadata');
  const getRequestHeaders = method('getRequestHeaders');
  const processResponse = method('processResponse');
  return {
    async getServiceMetadata(providerAddress) {
      const meta = await getServiceMetadata(providerAddress);
      if (!isRecord(meta) || typeof meta.endpoint !== 'string' || typeof meta.model !== 'string') {
        throw new TypeError('0G getServiceMetadata returned an unexpected shape');
      }
      return { endpoint: meta.endpoint, model: meta.model };
    },
    async getRequestHeaders(providerAddress, content) {
      const headers = await getRequestHeaders(providerAddress, content);
      if (!isRecord(headers)) throw new TypeError('0G getRequestHeaders returned an unexpected shape');
      return Object.fromEntries(Object.entries(headers).filter((e): e is [string, string] => typeof e[1] === 'string'));
    },
    async processResponse(providerAddress, content, chatId) {
      const result = await processResponse(providerAddress, content, chatId);
      return typeof result === 'boolean' ? result : null;
    },
  };
}

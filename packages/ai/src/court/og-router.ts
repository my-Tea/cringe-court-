/**
 * OgRouterClient: the real 0G Compute Router adapter (OpenAI-compatible).
 *
 * Verified against docs.0g.ai (Router: Overview, Authentication, Errors, Models)
 * and the live public catalog on 2026-11-06; see docs/ai/10 for sources:
 * - Base URL: https://router-api.0g.ai/v1 (mainnet). Testnet uses a separate URL and keys.
 * - Auth: `Authorization: Bearer sk-...` (an `mk-` management key cannot call inference).
 * - POST /chat/completions, OpenAI request/response shape.
 * - GET /models is public and lists `supported_parameters` per model; we use it to
 *   decide whether to send `response_format` and `temperature`.
 * - Errors: OpenAI-style `{error:{message,type,code}}` plus top-level `request_id` when
 *   available. 429 honours Retry-After; 502 retryable; 503 (no provider) is not.
 * - Trust: Standard sends no header; Verified/Private send `X-0G-Provider-Trust-Mode`.
 *   This client records the mode requested; it does NOT verify any TEE attestation.
 *
 * Server-side only: the API key must never reach a browser bundle.
 */
import { InferenceError, silentLogger, type CourtLogger, type InferenceClient, type InferenceRequest, type InferenceResult, type TrustMode } from './inference';

export const OG_ROUTER_MAINNET = 'https://router-api.0g.ai/v1';

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null; forEach?(cb: (value: string, key: string) => void): void };
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<FetchResponseLike>;

export interface OgRouterOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  trustMode?: TrustMode;
  /** Per HTTP attempt. */
  timeoutMs?: number;
  /** Extra attempts after the first, for retryable failures only. */
  maxRetries?: number;
  /** `auto` reads the public model catalog once; `on`/`off` skip it. */
  jsonMode?: 'auto' | 'on' | 'off';
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  logger?: CourtLogger;
}

interface ModelCapabilities {
  json: boolean;
  temperature: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class OgRouterClient implements InferenceClient {
  readonly provider = '0g-router' as const;
  readonly model: string;
  readonly trustMode: TrustMode;
  readonly #o: Required<Omit<OgRouterOptions, 'fetch' | 'sleep' | 'now' | 'logger'>> & { fetch: FetchLike; sleep: (ms: number) => Promise<void>; now: () => number; logger: CourtLogger };
  #caps: Promise<ModelCapabilities> | null = null;

  constructor(options: OgRouterOptions) {
    if (!options.apiKey) throw new InferenceError('config', 'OG_API_KEY is not set.', false);
    if (options.apiKey.startsWith('mk-')) throw new InferenceError('config', 'OG_API_KEY is a management key (mk-...); inference needs an API key (sk-...).', false);
    if (!options.model) throw new InferenceError('config', 'OG_MODEL is not set. Pick a chat model from the live catalog (npm run court:test -- --list-models).', false);
    this.model = options.model;
    this.trustMode = options.trustMode ?? 'standard';
    this.#o = {
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: (options.baseUrl ?? OG_ROUTER_MAINNET).replace(/\/+$/, ''),
      trustMode: this.trustMode,
      timeoutMs: options.timeoutMs ?? 45_000,
      maxRetries: options.maxRetries ?? 2,
      jsonMode: options.jsonMode ?? 'auto',
      fetch: options.fetch ?? (globalThis.fetch as unknown as FetchLike),
      sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      now: options.now ?? (() => Date.now()),
      logger: options.logger ?? silentLogger,
    };
  }

  /** Capabilities from the public catalog (cached). Unknown model = config error; catalog outage = conservative defaults. */
  capabilities(): Promise<ModelCapabilities> {
    if (this.#o.jsonMode !== 'auto') return Promise.resolve({ json: this.#o.jsonMode === 'on', temperature: true });
    this.#caps ??= this.#loadCaps().catch((e: unknown) => {
      this.#caps = null;
      throw e;
    });
    return this.#caps;
  }

  async #loadCaps(): Promise<ModelCapabilities> {
    let models: unknown[];
    try {
      models = await listOgModels({ baseUrl: this.#o.baseUrl, fetch: this.#o.fetch, timeoutMs: 10_000 });
    } catch (e) {
      this.#o.logger.warn('og.catalog.unavailable', { reason: e instanceof Error ? e.message : String(e) });
      return { json: false, temperature: true };
    }
    const entry = models.find((m) => isRecord(m) && m.id === this.#o.model);
    if (!isRecord(entry)) {
      throw new InferenceError('model-not-found', `OG_MODEL "${this.#o.model}" is not in the 0G Router catalog. Run: npm run court:test -- --list-models`, false);
    }
    const params = Array.isArray(entry.supported_parameters) ? entry.supported_parameters.filter((p): p is string => typeof p === 'string') : null;
    return { json: params?.includes('response_format') ?? false, temperature: params ? params.includes('temperature') : true };
  }

  async complete(request: InferenceRequest): Promise<InferenceResult> {
    const started = this.#o.now();
    const caps = await this.capabilities();
    const body: Record<string, unknown> = { model: this.#o.model, messages: request.messages, max_tokens: request.maxTokens };
    if (caps.temperature) body.temperature = request.temperature;
    if (request.json && caps.json) body.response_format = { type: 'json_object' };
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#o.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.trustMode !== 'standard') headers['X-0G-Provider-Trust-Mode'] = this.trustMode;
    const payload = JSON.stringify(body);

    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const result = await this.#once(request, headers, payload);
        const latencyMs = this.#o.now() - started;
        this.#o.logger.info('og.chat.ok', { purpose: request.purpose, caseId: request.caseId, model: this.#o.model, attempt, latencyMs, requestId: result.requestId, outputChars: result.content.length });
        return { ...result, latencyMs, attempts: attempt };
      } catch (e) {
        const err = e instanceof InferenceError ? e : new InferenceError('network', e instanceof Error ? e.message : 'Network error', true);
        const last = attempt > this.#o.maxRetries || !err.retryable || request.signal?.aborted;
        this.#o.logger[last ? 'error' : 'warn']('og.chat.fail', { purpose: request.purpose, caseId: request.caseId, attempt, code: err.code, status: err.status, requestId: err.requestId, retrying: !last });
        if (last) throw err;
        await this.#o.sleep(this.#backoff(err, attempt));
      }
    }
  }

  #retryAfter = new WeakMap<InferenceError, number>();

  #backoff(err: InferenceError, attempt: number): number {
    const hinted = this.#retryAfter.get(err);
    if (hinted !== undefined) return Math.min(hinted, 20_000);
    return Math.min(500 * 2 ** (attempt - 1), 8_000);
  }

  async #once(request: InferenceRequest, headers: Record<string, string>, payload: string): Promise<Omit<InferenceResult, 'latencyMs' | 'attempts'>> {
    if (request.signal?.aborted) throw new InferenceError('aborted', 'Request aborted', false);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#o.timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });
    let res: FetchResponseLike;
    let text: string;
    try {
      res = await this.#o.fetch(`${this.#o.baseUrl}/chat/completions`, { method: 'POST', headers, body: payload, signal: controller.signal });
      text = await res.text();
    } catch (e) {
      if (request.signal?.aborted) throw new InferenceError('aborted', 'Request aborted', false);
      if (timedOut) throw new InferenceError('timeout', `0G Router did not answer within ${this.#o.timeoutMs} ms`, true);
      throw new InferenceError('network', `Could not reach the 0G Router (${e instanceof Error ? e.message : 'network error'})`, true);
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }

    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const meta = collectMeta(res, json);
    const requestId = pickRequestId(res, json);
    if (!res.ok) throw this.#httpError(res, json, requestId);
    if (!isRecord(json)) throw new InferenceError('invalid-response', '0G Router returned a non-JSON body', true, res.status, requestId ?? undefined);

    const choice = Array.isArray(json.choices) ? json.choices[0] : undefined;
    const message = isRecord(choice) ? choice.message : undefined;
    const content = isRecord(message) ? messageText(message.content) : null;
    if (content === null || content.trim() === '') {
      throw new InferenceError('invalid-response', '0G Router response has no message content', true, res.status, requestId ?? undefined);
    }
    if (isRecord(choice) && typeof choice.finish_reason === 'string') meta.finishReason = choice.finish_reason;
    const u = json.usage;
    const usage = isRecord(u) && typeof u.prompt_tokens === 'number' && typeof u.completion_tokens === 'number' ? { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens } : undefined;
    return {
      content,
      provider: '0g-router',
      model: typeof json.model === 'string' ? json.model : this.#o.model,
      requestId,
      trustMode: this.trustMode,
      responseMeta: meta,
      ...(usage ? { usage } : {}),
    };
  }

  #httpError(res: FetchResponseLike, json: unknown, requestId: string | null): InferenceError {
    const err = isRecord(json) && isRecord(json.error) ? json.error : undefined;
    const detail = err && typeof err.message === 'string' ? `: ${err.message.slice(0, 200)}` : '';
    const id = requestId ?? undefined;
    const s = res.status;
    const make = (code: Parameters<typeof newError>[0], msg: string, retryable: boolean) => newError(code, `${msg} (HTTP ${s})${detail}`, retryable, s, id);
    switch (s) {
      case 400:
        return make('bad-request', '0G Router rejected the request', false);
      case 401:
        return make('auth', 'OG_API_KEY is missing or invalid', false);
      case 402:
        return make('insufficient-balance', 'The 0G account balance is too low; deposit 0G at pc.0g.ai', false);
      case 403:
        return make('forbidden', 'This API key is not allowed to do that', false);
      case 404:
        return make('not-found', '0G Router endpoint or model not found', false);
      case 429: {
        const e = make('rate-limited', '0G Router rate limit', true);
        const ra = Number(res.headers.get('retry-after'));
        if (Number.isFinite(ra) && ra >= 0) this.#retryAfter.set(e, ra * 1000);
        return e;
      }
      case 502:
        return make('provider-error', 'Every 0G provider failed for this model', true);
      case 503:
        return make('no-provider', 'No healthy 0G provider is serving this model right now; try another OG_MODEL or wait', false);
      default:
        return make('provider-error', '0G Router error', s >= 500);
    }
  }
}

function newError(code: ConstructorParameters<typeof InferenceError>[0], message: string, retryable: boolean, status: number, requestId?: string): InferenceError {
  return new InferenceError(code, message, retryable, status, requestId);
}

/** OpenAI content may be a string or a list of parts. */
function messageText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (isRecord(p) && typeof p.text === 'string' ? p.text : '')).join('');
  }
  return null;
}

/** The router's own id first (top-level `request_id` / `x-request-id`), then the completion id. Never invented. */
function pickRequestId(res: FetchResponseLike, json: unknown): string | null {
  if (isRecord(json) && typeof json.request_id === 'string' && json.request_id) return json.request_id;
  const header = res.headers.get('x-request-id');
  if (header) return header;
  if (isRecord(json) && typeof json.id === 'string' && json.id) return json.id;
  return null;
}

/** Keep 0G-specific evidence verbatim for audit: x-0g-* / zg-* headers, completion id, provider fields, x_0g_* body fields. */
function collectMeta(res: FetchResponseLike, json: unknown): Record<string, string> {
  const meta: Record<string, string> = {};
  res.headers.forEach?.((value, key) => {
    const k = key.toLowerCase();
    if (k.startsWith('x-0g') || k.startsWith('zg-') || k === 'x-request-id') meta[`header:${k}`] = value.slice(0, 500);
  });
  if (isRecord(json)) {
    if (typeof json.id === 'string') meta.completionId = json.id;
    if (typeof json.request_id === 'string') meta.requestId = json.request_id;
    for (const [k, v] of Object.entries(json)) {
      if (/^(x_0g|provider|x0g)/i.test(k) && v !== undefined) meta[`body:${k}`] = (typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 500);
    }
  }
  return meta;
}

/** GET {baseUrl}/models: public, no auth (per the Models docs). */
export async function listOgModels(options: { baseUrl?: string; fetch?: FetchLike; timeoutMs?: number } = {}): Promise<unknown[]> {
  const base = (options.baseUrl ?? OG_ROUTER_MAINNET).replace(/\/+$/, '');
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const res = await doFetch(`${base}/models`, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new InferenceError('provider-error', `0G model catalog returned HTTP ${res.status}`, true, res.status);
    const json: unknown = JSON.parse(await res.text());
    if (!isRecord(json) || !Array.isArray(json.data)) throw new InferenceError('invalid-response', '0G model catalog has an unexpected shape', false);
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

/** Chat models from the catalog, for the developer runner. */
export function chatModels(models: readonly unknown[]): { id: string; json: boolean; context: number | null }[] {
  return models
    .filter((m): m is Record<string, unknown> => isRecord(m) && typeof m.id === 'string' && (m.type === undefined || m.type === 'chatbot'))
    .map((m) => ({
      id: m.id as string,
      json: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('response_format'),
      context: typeof m.context_length === 'number' ? m.context_length : null,
    }));
}

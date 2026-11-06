/**
 * InferenceClient: the one seam between the court harness and a model provider.
 * Prompt building, parsing and validation never know which provider answered.
 * Implementations: OgRouterClient (real 0G Compute Router) and MockInferenceClient.
 */
import type { PromptMessage } from './prompts';

export type InferencePurpose = 'trial' | 'repair' | 'commentary';
export type TrustMode = 'standard' | 'verified' | 'private';

export interface InferenceRequest {
  purpose: InferencePurpose;
  caseId: string;
  messages: readonly PromptMessage[];
  maxTokens: number;
  temperature: number;
  /** Ask for a JSON object when the model supports `response_format`. */
  json: boolean;
  signal?: AbortSignal;
}

export interface InferenceResult {
  content: string;
  provider: '0g-router' | 'mock';
  model: string;
  /** The provider's request id, exactly as returned. `null` when there is none (always for mock). */
  requestId: string | null;
  trustMode: TrustMode | 'none';
  /** 0G-specific response headers/fields kept verbatim (x-0g-*, completion id, finish reason). */
  responseMeta: Record<string, string>;
  latencyMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  /** HTTP attempts made for this request (retries included). */
  attempts: number;
}

export interface InferenceClient {
  readonly provider: '0g-router' | 'mock';
  readonly model: string;
  readonly trustMode: TrustMode | 'none';
  complete(request: InferenceRequest): Promise<InferenceResult>;
}

export type InferenceErrorCode =
  | 'config'
  | 'model-not-found'
  | 'bad-request'
  | 'auth'
  | 'insufficient-balance'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'provider-error'
  | 'no-provider'
  | 'timeout'
  | 'network'
  | 'invalid-response'
  | 'aborted';

/** Classified provider failure. `retryable` follows the 0G Router error docs (docs/ai/10 §6). */
export class InferenceError extends Error {
  constructor(
    readonly code: InferenceErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'InferenceError';
  }
}

/** Structured logs. Never pass prompt or case text: only ids, sizes, timings and statuses. */
export interface CourtLogger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

export const silentLogger: CourtLogger = { info() {}, warn() {}, error() {} };

/** One JSON line per event on stderr (keeps stdout clean for CLI output). */
export function jsonLineLogger(write: (line: string) => void): CourtLogger {
  const emit = (level: string) => (event: string, data?: Record<string, unknown>) => write(JSON.stringify({ t: new Date().toISOString(), level, event, ...data }));
  return { info: emit('info'), warn: emit('warn'), error: emit('error') };
}

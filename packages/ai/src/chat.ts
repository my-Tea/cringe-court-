/**
 * ChatClient: the one seam between the counsel service and a model provider.
 * The service speaks OpenAI-style chat messages; adapters (0G Compute, fixture)
 * turn that into a real or deterministic completion. Nothing above this file
 * knows which provider answered.
 */
import type { InferencePayer } from '@cringe-court/core';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: readonly ChatMessage[];
  maxTokens: number;
  temperature: number;
  /** Ask the provider for a JSON object response when it supports it. */
  responseFormat?: 'json';
  signal?: AbortSignal;
  /** Who pays for this call (D12). */
  payer: InferencePayer;
  /** What the call is for: "bench:0", "bench:1", "angles", "sentence". */
  tag: string;
}

export interface ChatResponse {
  content: string;
  /** Provider request id, kept in the trial record. */
  requestId: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ChatClient {
  readonly provider: 'og-compute' | 'fixture';
  complete(request: ChatRequest): Promise<ChatResponse>;
}

/** Rough token estimate (about 4 characters per token); used for budgets and offline usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: readonly ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

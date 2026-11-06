/**
 * Configuration: environment -> validated provider settings -> CourtAI.
 * Takes the env as an argument (never reads process.env itself) so it is
 * testable and cannot pull secrets into a browser bundle.
 *
 * Variables (server-side only; never prefix them with VITE_):
 *   COURT_AI_PROVIDER  mock | 0g          (default mock: explicit opt-in to spend credits)
 *   OG_API_KEY         sk-...             (required for 0g)
 *   OG_MODEL           a chat model id from GET {OG_BASE_URL}/models (required for 0g; no default)
 *   OG_BASE_URL        default https://router-api.0g.ai/v1
 *   OG_TRUST_MODE      standard | verified | private (default standard)
 *   OG_TIMEOUT_MS      per HTTP attempt (default 45000)
 *   OG_MAX_RETRIES     retries for retryable failures (default 2)
 *   OG_JSON_MODE       auto | on | off   (default auto: read the model catalog)
 */
import { CourtAI, type TrialOptions } from './engine';
import { silentLogger, type CourtLogger, type InferenceClient, type TrustMode } from './inference';
import { MockInferenceClient } from './mock';
import { OG_ROUTER_MAINNET, OgRouterClient, type FetchLike } from './og-router';

export interface OgSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
  trustMode: TrustMode;
  timeoutMs: number;
  maxRetries: number;
  jsonMode: 'auto' | 'on' | 'off';
}

export type CourtAIConfig = { provider: 'mock' } | { provider: '0g'; og: OgSettings };

export class CourtConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Court AI configuration is incomplete:\n- ${problems.join('\n- ')}`);
    this.name = 'CourtConfigError';
  }
}

type Env = Readonly<Record<string, string | undefined>>;

const int = (v: string | undefined, fallback: number, name: string, problems: string[], min: number, max: number): number => {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    problems.push(`${name} must be an integer between ${min} and ${max}`);
    return fallback;
  }
  return n;
};

export function loadCourtAIConfig(env: Env, override: { provider?: 'mock' | '0g' } = {}): CourtAIConfig {
  const problems: string[] = [];
  const leaked = Object.keys(env).filter((k) => /^VITE_.*(OG|0G).*(KEY|SECRET)/i.test(k) && env[k]);
  if (leaked.length) problems.push(`${leaked.join(', ')} would be bundled into the browser. Rename to OG_API_KEY and keep it server-side.`);

  const provider = override.provider ?? (env.COURT_AI_PROVIDER?.trim().toLowerCase() || 'mock');
  if (provider !== 'mock' && provider !== '0g') problems.push(`COURT_AI_PROVIDER must be "mock" or "0g" (got "${provider}")`);
  if (provider !== '0g') {
    if (problems.length) throw new CourtConfigError(problems);
    return { provider: 'mock' };
  }

  const apiKey = env.OG_API_KEY?.trim() ?? '';
  if (!apiKey) problems.push('OG_API_KEY is not set. Create an API key (sk-...) at https://pc.0g.ai and fund the account.');
  else if (apiKey.startsWith('mk-')) problems.push('OG_API_KEY is a management key (mk-...). Inference needs an API key (sk-...).');
  const model = env.OG_MODEL?.trim() ?? '';
  if (!model) problems.push('OG_MODEL is not set. List live chat models with: npm run court:test -- --list-models');
  const baseUrl = (env.OG_BASE_URL?.trim() || OG_ROUTER_MAINNET).replace(/\/+$/, '');
  if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(`${baseUrl}/`)) problems.push('OG_BASE_URL must be an https URL');
  const trust = (env.OG_TRUST_MODE?.trim().toLowerCase() || 'standard') as TrustMode;
  if (!['standard', 'verified', 'private'].includes(trust)) problems.push('OG_TRUST_MODE must be standard, verified or private');
  const jsonMode = (env.OG_JSON_MODE?.trim().toLowerCase() || 'auto') as OgSettings['jsonMode'];
  if (!['auto', 'on', 'off'].includes(jsonMode)) problems.push('OG_JSON_MODE must be auto, on or off');
  const timeoutMs = int(env.OG_TIMEOUT_MS, 45_000, 'OG_TIMEOUT_MS', problems, 1_000, 300_000);
  const maxRetries = int(env.OG_MAX_RETRIES, 2, 'OG_MAX_RETRIES', problems, 0, 5);
  if (problems.length) throw new CourtConfigError(problems);
  return { provider: '0g', og: { apiKey, model, baseUrl, trustMode: trust, timeoutMs, maxRetries, jsonMode } };
}

export interface CreateOptions extends TrialOptions {
  fetch?: FetchLike;
  logger?: CourtLogger;
}

export function createInferenceClient(config: CourtAIConfig, options: CreateOptions = {}): InferenceClient {
  if (config.provider === 'mock') return new MockInferenceClient();
  return new OgRouterClient({ ...config.og, ...(options.fetch ? { fetch: options.fetch } : {}), logger: options.logger ?? silentLogger });
}

export function createCourtAI(config: CourtAIConfig, options: CreateOptions = {}): CourtAI {
  return new CourtAI(createInferenceClient(config, options), options);
}

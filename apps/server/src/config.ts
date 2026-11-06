/**
 * Server configuration from the environment. Every knob has a safe default for
 * a local demo; nothing here is a secret except CC_SECRET, which is generated
 * and kept in the data directory when not given (never committed).
 *
 *   PORT / HOST           where to listen (default 8787 on 127.0.0.1)
 *   CC_DATA_DIR           JSON-lines store (default .data/court-server); CC_STORE=memory keeps nothing
 *   CC_CORS_ORIGINS       comma-separated allowed origins; `*` allows any (default: local Vite ports)
 *   CC_SECRET             HMAC key for signed invite tokens
 *   CC_DEMO_CLOCK         on | off  (may visitors skip the court clock forward; default on)
 *   CC_GJ_NPC_JURORS      late | fill | off  (simulated Grand Jury jurors; default late = humans first)
 *   CC_MAX_SESSIONS       cap on devices (default 5000)
 *   CC_MAX_VERSUS_CASES   cap on Versus cases (default 500)
 *   CC_MAX_FACTS          cap on the Versus log (default 50000)
 *   CC_TRUST_PROXY        on | off  (use X-Forwarded-For for rate limits; default off)
 *
 * World ID (all required together, or the routes stay off and the app keeps the mock):
 *   WORLD_RP_ID / rp_id
 *   WORLD_APP_ID / app_id
 *   RP_SIGNING_KEY / signing_key_private     server only, never a VITE_ variable
 *   HUMAN_ID_PEPPER                          at least 16 bytes; created in the data dir if missing
 *   WORLD_ACTION                             default cringecourt-juror
 *   WORLD_ENVIRONMENT                        staging | production (default staging)
 *   WORLD_SIGNER_ADDRESS / signer_address / singner_address
 *                                        recorded for a later attestation, unused by verify
 */
import type { NpcJurorPolicy } from '@cringe-court/modes-grand-jury';

export interface ServerConfig {
  port: number;
  host: string;
  store: 'file' | 'memory';
  dataDir: string;
  corsOrigins: readonly string[] | '*';
  secret: string | null;
  demoClock: boolean;
  npcJurors: NpcJurorPolicy;
  maxSessions: number;
  maxVersusCases: number;
  maxFacts: number;
  trustProxy: boolean;
  /** Request body cap, bytes. */
  maxBody: number;
  /** Clerk / simulation heartbeat, ms. 0 disables (tests drive time). */
  tickMs: number;
  /** Versus AI counsel latency (fixture), ms. */
  counselLatencyMs: number;
  /** World ID verifier. Null keeps the routes off. */
  world: WorldServerConfig | null;
}

export interface WorldServerConfig {
  rpId: string;
  appId: string;
  action: string;
  environment: 'staging' | 'production';
  signingKey: string;
  pepper: string;
  signerAddress: string | null;
}

export const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];

const int = (v: string | undefined, fallback: number, min = 0) => {
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isInteger(n) && n >= min ? n : fallback;
};
const flag = (v: string | undefined, fallback: boolean) => (v === undefined || v === '' ? fallback : /^(1|on|true|yes)$/i.test(v.trim()));

export function readConfig(env: Readonly<Record<string, string | undefined>> = process.env): ServerConfig {
  const origins = (env.CC_CORS_ORIGINS ?? '').trim();
  const npc = (env.CC_GJ_NPC_JURORS ?? 'late').trim();
  return {
    port: int(env.PORT, 8787),
    host: env.HOST?.trim() || '127.0.0.1',
    store: env.CC_STORE === 'memory' ? 'memory' : 'file',
    dataDir: env.CC_DATA_DIR?.trim() || '.data/court-server',
    corsOrigins: origins === '*' ? '*' : origins ? origins.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean) : DEFAULT_ORIGINS,
    secret: env.CC_SECRET?.trim() || null,
    demoClock: flag(env.CC_DEMO_CLOCK, true),
    npcJurors: npc === 'fill' || npc === 'off' ? npc : 'late',
    maxSessions: int(env.CC_MAX_SESSIONS, 5000, 1),
    maxVersusCases: int(env.CC_MAX_VERSUS_CASES, 500, 1),
    maxFacts: int(env.CC_MAX_FACTS, 50_000, 10),
    trustProxy: flag(env.CC_TRUST_PROXY, false),
    maxBody: 64 * 1024,
    tickMs: int(env.CC_TICK_MS, 1000),
    counselLatencyMs: int(env.CC_COUNSEL_LATENCY_MS, 1200),
    world: worldFrom(env),
  };
}

function worldFrom(env: Readonly<Record<string, string | undefined>>): WorldServerConfig | null {
  const rpId = (env.WORLD_RP_ID || env.rp_id || '').trim();
  const appId = (env.WORLD_APP_ID || env.app_id || '').trim();
  const signingKey = (env.RP_SIGNING_KEY || env.signing_key_private || '').trim();
  const pepper = (env.HUMAN_ID_PEPPER || '').trim();
  if (!rpId && !appId && !signingKey) return null;
  if (!rpId || !appId || !signingKey || pepper.length < 16) return null;
  const environmentName = (env.WORLD_ENVIRONMENT || 'staging').trim();
  const signer = (env.WORLD_SIGNER_ADDRESS || env.signer_address || env.singner_address || '').trim();
  return {
    rpId,
    appId,
    action: (env.WORLD_ACTION || 'cringecourt-juror').trim() || 'cringecourt-juror',
    environment: environmentName === 'production' ? 'production' : 'staging',
    signingKey,
    pepper,
    signerAddress: signer || null,
  };
}

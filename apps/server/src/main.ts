/**
 * `npm run server`: start the court server with configuration from the
 * environment (see ./config.ts and docs/BACKEND.md).
 *
 * Loads apps/server/.env and the repo-parent .env when present. Existing
 * process env wins. Values are never printed.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from './config';
import { createCourtServer } from './app';

const here = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

for (const file of [resolve(here, '../../../../.env'), resolve(here, '../../../.env'), resolve(here, '../.env'), resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  loadEnvFile(file);
}

function ensurePepper(): void {
  const hasWorld = Boolean(process.env.WORLD_RP_ID || process.env.rp_id);
  const hasKey = Boolean(process.env.RP_SIGNING_KEY || process.env.signing_key_private);
  if (!hasWorld || !hasKey) return;
  if ((process.env.HUMAN_ID_PEPPER ?? '').trim().length >= 16) return;
  const dir = process.env.CC_DATA_DIR?.trim() || resolve(here, '../.data/court-server');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, 'human-pepper');
  if (existsSync(file)) {
    const saved = readFileSync(file, 'utf8').trim();
    if (saved.length >= 16) {
      process.env.HUMAN_ID_PEPPER = saved;
      return;
    }
  }
  const pepper = randomBytes(32).toString('hex');
  writeFileSync(file, `${pepper}\n`, { mode: 0o600 });
  process.env.HUMAN_ID_PEPPER = pepper;
}

ensurePepper();

const config = readConfig();
const court = await createCourtServer(config);
const url = await court.listen();
const world = config.world ? `world id on (${config.world.environment})` : 'world id off';
console.log(`[court-server] listening on ${url} (store: ${config.store === 'memory' ? 'memory, nothing kept' : config.dataDir}; demo clock ${config.demoClock ? 'on' : 'off'}; simulated jurors: ${config.npcJurors}; ${world})`);
console.log(`[court-server] allowed origins: ${config.corsOrigins === '*' ? 'any' : config.corsOrigins.join(', ')}`);

let closing = false;
const stop = (signal: string) => {
  if (closing) return;
  closing = true;
  console.log(`[court-server] ${signal}: closing`);
  court.close().then(
    () => process.exit(0),
    () => process.exit(1),
  );
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

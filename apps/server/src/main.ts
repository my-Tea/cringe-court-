/**
 * `npm run server`: start the court server with configuration from the
 * environment (see ./config.ts and docs/BACKEND.md).
 */
import { readConfig } from './config';
import { createCourtServer } from './app';

const config = readConfig();
const court = await createCourtServer(config);
const url = await court.listen();
console.log(`[court-server] listening on ${url} (store: ${config.store === 'memory' ? 'memory, nothing kept' : config.dataDir}; demo clock ${config.demoClock ? 'on' : 'off'}; simulated jurors: ${config.npcJurors})`);
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

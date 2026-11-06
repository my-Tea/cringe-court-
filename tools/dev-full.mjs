/* global process, console */
// `npm run dev:full`: the court server and the web app together, wired up.
// Server on :8787 (JSON-lines store in .data/, or CC_STORE=memory), Vite on
// :5173 with VITE_BACKEND_URL pointing at it. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '8787';
const backend = `http://127.0.0.1:${port}`;
const serverEnv = { ...process.env, PORT: port, CC_CORS_ORIGINS: process.env.CC_CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173' };
const webEnv = { ...process.env, VITE_BACKEND_URL: process.env.VITE_BACKEND_URL ?? backend };
// Each child leads its own process group, so stopping reaches npm's grandchildren (tsx, vite) too.
const children = [
  spawn('npm', ['run', 'server'], { stdio: 'inherit', env: serverEnv, detached: true }),
  spawn('npm', ['run', 'dev', '-w', '@cringe-court/web', '--', '--host', '127.0.0.1'], { stdio: 'inherit', env: webEnv, detached: true }),
];
console.log(`[dev:full] court server ${backend} · web http://127.0.0.1:5173`);
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(0), 500);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const c of children) c.on('exit', () => stop());

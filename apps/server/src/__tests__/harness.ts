/**
 * Test harness: a real court server on a random port (memory or file store),
 * and "devices": each with its own session token, connection, clock and salt
 * vault, exactly as two browsers would have.
 */
import type { AiCounselPort } from '@cringe-court/core';
import { MemorySaltVault, MockIdentity } from '@cringe-court/core/testing';
import { VersusCounsel } from '@cringe-court/modes-versus';
import { CourtConnection, RemoteFactStore, RemoteGrandJuryCourt, RemoteVersusDesk, type PersonaInfo, type SessionResponse } from '@cringe-court/net';
import { createCourtServer, type CourtServer, type ServerDeps } from '../app';
import { readConfig, type ServerConfig } from '../config';
import type { Storage } from '../store';

export interface Running {
  court: CourtServer;
  url: string;
  close(): Promise<void>;
}

export async function startServer(o: { config?: Partial<ServerConfig>; storage?: Storage; clockMs?: () => number; counsel?: AiCounselPort; worldVerifier?: ServerDeps['worldVerifier'] } = {}): Promise<Running> {
  const config: ServerConfig = { ...readConfig({}), store: 'memory', port: 0, host: '127.0.0.1', tickMs: 0, counselLatencyMs: 0, corsOrigins: ['http://app.test'], ...o.config };
  const court = await createCourtServer(config, {
    ...(o.storage ? { storage: o.storage } : {}),
    ...(o.clockMs ? { clockMs: o.clockMs } : {}),
    counsel: o.counsel ?? new VersusCounsel(),
    log: () => undefined,
    ...(o.worldVerifier ? { worldVerifier: o.worldVerifier } : {}),
  });
  const url = await court.listen();
  return { court, url, close: () => court.close() };
}

export interface Device {
  name: string;
  connection: CourtConnection;
  persona: PersonaInfo;
  token: string;
  store: RemoteFactStore;
  desk: RemoteVersusDesk;
  salts: MemorySaltVault;
  identity: MockIdentity;
  gj: RemoteGrandJuryCourt;
  close(): void;
}

let n = 0;

/** A new device: fresh session, its own clock (optionally skewed) and storage. */
export async function device(url: string, o: { skewMs?: number; token?: string; persona?: PersonaInfo; live?: boolean; random?: () => number } = {}): Promise<Device> {
  const name = `device-${++n}`;
  const now = () => Date.now() + (o.skewMs ?? 0);
  const connection = new CourtConnection({ baseUrl: url, now, pollMs: 200 });
  let token = o.token;
  let persona = o.persona;
  if (!token || !persona) {
    const s = await connection.post<SessionResponse>('/api/v1/sessions');
    token = s.token;
    persona = s.persona;
  }
  connection.setToken(token);
  const store = new RemoteFactStore(connection);
  const salts = new MemorySaltVault(`salts-${name}`);
  const identity = new MockIdentity({ human: `human-${persona.id}` });
  let r = n * 7919;
  const random = o.random ?? (() => ((r = (r * 9301 + 49297) % 233280), r / 233280));
  const desk = new RemoteVersusDesk({ store, persona, counsel: new VersusCounsel(), identity, salts, clock: () => connection.serverNow(), random });
  const gj = new RemoteGrandJuryCourt({ connection, identity, salts, deviceNow: now });
  if (o.live) connection.start();
  await store.ready();
  return {
    name,
    connection,
    persona,
    token,
    store,
    desk,
    salts,
    identity,
    gj,
    close: () => {
      connection.stop();
      store.close();
      gj.dispose();
    },
  };
}

export async function until(check: () => boolean | Promise<boolean>, timeoutMs = 10_000, what = 'condition'): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Raw GET with a device's token, as text (for "never on the wire" checks). */
export async function raw(url: string, path: string, token: string): Promise<string> {
  const res = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.text();
}

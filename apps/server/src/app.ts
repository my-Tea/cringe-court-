/**
 * The court server: Node's http module, JSON through the wire codec, and
 * Server-Sent Events for live updates. No framework; every route is listed in
 * `route()` below and documented in docs/BACKEND.md.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { caseNumber as toCaseNumber, usdc, type AiCounselPort, type BallotChoice, type CaseNumber, type Hex, type WorldIdProof } from '@cringe-court/core';
import { VersusCounsel, parseInviteCode, type FactBody } from '@cringe-court/modes-versus';
import {
  API,
  TIME_HEADER,
  decodeWire,
  encodeWire,
  type ErrorCode,
  type Features,
  type GjAction,
  type HealthResponse,
  type MeResponse,
  type SessionResponse,
  type VersusAccessResponse,
  type VersusAppendResponse,
  type VersusInviteResponse,
} from '@cringe-court/net';
import type { ServerConfig } from './config';
import { FAUCET_MAX, GrandJuryHall, type GjCommand } from './gj/hall';
import { RateLimiter } from './ratelimit';
import { InviteSigner, SessionFull, Sessions, type Session } from './sessions';
import { FileStorage, MemoryStorage, type Storage } from './store';
import { MAX_BATCH, BadFact, Forbidden, authorize, checkShape } from './versus/validate';
import { Conflict, Rejected, RoomFull, VersusRoom } from './versus/room';
import type { Fact } from '@cringe-court/modes-versus';

export const SERVER_VERSION = '0.1.0';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export interface ServerDeps {
  storage?: Storage;
  /** Wall clock in ms (tests skew it). */
  clockMs?: () => number;
  counsel?: AiCounselPort;
  log?: (line: string) => void;
}

export interface CourtServer {
  server: Server;
  room: VersusRoom;
  hall: GrandJuryHall;
  sessions: Sessions;
  config: ServerConfig;
  listen(): Promise<string>;
  close(): Promise<void>;
  /** One heartbeat (clerk + simulation), for tests that drive time. */
  tick(): Promise<void>;
}

interface Stream {
  res: ServerResponse;
  session: Session;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'cross-origin',
} as const;

export async function createCourtServer(config: ServerConfig, deps: ServerDeps = {}): Promise<CourtServer> {
  const clockMs = deps.clockMs ?? (() => Date.now());
  const clock = () => Math.floor(clockMs() / 1000);
  const log = deps.log ?? ((line: string) => console.log(line));
  const storage = deps.storage ?? (config.store === 'memory' ? new MemoryStorage() : new FileStorage(config.dataDir));
  const signer = new InviteSigner(config.secret ?? storage.secret());
  const sessions = new Sessions(storage.log('sessions'), clock, config.maxSessions);
  const streams = new Set<Stream>();

  const features: Features = { demoClock: config.demoClock, npcJurors: config.npcJurors };

  const broadcastVersus = () => {
    for (const s of streams) send(s.res, 'versus', { length: room.length, epoch: room.epoch(viewerOf(s.session)) });
  };
  const broadcastGj = () => {
    for (const s of streams) send(s.res, 'gj', { version: hall.version, now: hall.now() });
  };

  const room = await VersusRoom.open({
    log: storage.log<Fact>('versus'),
    clock,
    counsel: deps.counsel ?? new VersusCounsel({ latencyMs: config.counselLatencyMs }),
    maxCases: config.maxVersusCases,
    maxFacts: config.maxFacts,
    onChange: broadcastVersus,
  });
  const hall = await GrandJuryHall.open({
    log: storage.log<GjCommand>('grand-jury'),
    npcJurors: config.npcJurors,
    demoClock: config.demoClock,
    realNow: () => clockMs() / 1000,
    onChange: broadcastGj,
  });

  /* ── limits ─────────────────────────────────────────────────────────── */

  const limits = {
    ip: new RateLimiter({ capacity: 600, refill: 100 }, clockMs),
    sessionCreate: new RateLimiter({ capacity: 20, refill: 0.1 }, clockMs),
    reads: new RateLimiter({ capacity: 120, refill: 20 }, clockMs),
    writes: new RateLimiter({ capacity: 30, refill: 3 }, clockMs),
    inviteSession: new RateLimiter({ capacity: 8, refill: 1 / 60 }, clockMs),
    inviteIp: new RateLimiter({ capacity: 40, refill: 0.2 }, clockMs),
    faucet: new RateLimiter({ capacity: 6, refill: 1 / 20 }, clockMs),
  };
  const limit = (bucket: RateLimiter, key: string, message = 'Too many requests. Wait a moment and try again.') => {
    const wait = bucket.take(key);
    if (wait) throw new HttpError(429, 'rate-limited', message, wait);
  };

  /* ── helpers ────────────────────────────────────────────────────────── */

  const ipOf = (req: IncomingMessage) => {
    const fwd = config.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() : '';
    return fwd || req.socket.remoteAddress || 'unknown';
  };

  const cors = (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    const allowed = config.corsOrigins === '*' || config.corsOrigins.includes(origin);
    if (!allowed) return false;
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigins === '*' ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Expose-Headers', TIME_HEADER);
    return true;
  };

  function json(res: ServerResponse, status: number, body: unknown): void {
    const text = encodeWire(body);
    res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', [TIME_HEADER]: String(clockMs()) });
    res.end(text);
  }

  function send(res: ServerResponse, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${encodeWire(data)}\n\n`);
  }

  async function body<T>(req: IncomingMessage): Promise<T> {
    const type = String(req.headers['content-type'] ?? '');
    if (!type.startsWith('application/json')) throw new HttpError(415, 'bad-request', 'Send JSON.');
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > config.maxBody) throw new HttpError(413, 'too-large', 'That request is too large.');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > config.maxBody) throw new HttpError(413, 'too-large', 'That request is too large.');
      chunks.push(chunk as Buffer);
    }
    try {
      return decodeWire<T>(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      throw new HttpError(400, 'bad-request', 'That request is not valid JSON.');
    }
  }

  const tokenOf = (req: IncomingMessage) => {
    const h = String(req.headers.authorization ?? '');
    return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  };

  const auth = (req: IncomingMessage): Session => {
    const s = sessions.resolve(tokenOf(req));
    if (!s) throw new HttpError(401, 'unauthorized', 'This device is not known to the court server. Start a new session.');
    return s;
  };

  const viewerOf = (s: Session) => ({ account: s.persona.account, grants: s.grants, personaId: s.persona.id });

  const caseParam = (raw: string): CaseNumber => {
    if (!/^\d{1,9}$/.test(raw) || Number(raw) < 1) throw new HttpError(400, 'bad-request', 'Bad case number.');
    return toCaseNumber(Number(raw));
  };

  const hex32 = (v: unknown, field: string): Hex => {
    if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new HttpError(400, 'bad-request', `${field} is malformed.`);
    return v as Hex;
  };
  const choiceOf = (v: unknown): BallotChoice => {
    if (v !== 0 && v !== 1) throw new HttpError(400, 'bad-request', 'choice must be 0 or 1.');
    return v;
  };
  const amountOf = (v: unknown, max: bigint) => {
    if (typeof v !== 'bigint' || v <= 0n || v > max) throw new HttpError(400, 'bad-request', 'That amount is out of range.');
    return v as ReturnType<typeof usdc>;
  };
  const proofOf = (v: unknown): WorldIdProof => {
    const p = v as Partial<WorldIdProof> | null;
    if (!p || typeof p !== 'object') throw new HttpError(400, 'bad-request', 'A World ID proof is required.');
    hex32(p.nullifierHash, 'nullifierHash');
    hex32(p.merkleRoot, 'merkleRoot');
    if (typeof p.proof !== 'string' || p.proof.length > 2048 || !/^0x[0-9a-fA-F]*$/.test(p.proof)) throw new HttpError(400, 'bad-request', 'proof is malformed.');
    if (!['orb', 'document', 'secure-document', 'device'].includes(p.verificationLevel as string)) throw new HttpError(400, 'bad-request', 'Unknown verification level.');
    return { merkleRoot: p.merkleRoot!, nullifierHash: p.nullifierHash!, proof: p.proof, verificationLevel: p.verificationLevel! };
  };

  const gjMeta = () => ({ now: hall.now(), version: hall.version });

  /* ── routes ─────────────────────────────────────────────────────────── */

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://court.local');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const ip = ipOf(req);
    limit(limits.ip, ip);

    if (method === 'GET' && (path === `${API}/health` || path === '/healthz')) {
      const r: HealthResponse = { ok: true, name: 'cringe-court-server', version: SERVER_VERSION, serverTime: clockMs(), features };
      return json(res, 200, r);
    }

    if (method === 'POST' && path === `${API}/sessions`) {
      limit(limits.sessionCreate, ip, 'Too many new sessions from this network. Wait a minute.');
      await body(req);
      try {
        const { token, session } = sessions.create();
        const r: SessionResponse = { token, persona: session.persona, features };
        return json(res, 201, r);
      } catch (err) {
        if (err instanceof SessionFull) throw new HttpError(503, 'full', err.message);
        throw err;
      }
    }

    const session = auth(req);
    const sid = session.persona.id;

    if (method === 'GET' && path === `${API}/events`) return openStream(req, res, session);

    if (method === 'GET') limit(limits.reads, sid);
    else limit(limits.writes, sid);

    if (method === 'GET' && path === `${API}/sessions/me`) {
      const r: MeResponse = { persona: session.persona, features };
      return json(res, 200, r);
    }

    /* Versus */
    if (method === 'GET' && path === `${API}/versus/log`) {
      const since = Number(url.searchParams.get('since') ?? 0);
      const epoch = url.searchParams.get('epoch');
      return json(res, 200, room.view(viewerOf(session), since, epoch));
    }
    if (method === 'POST' && path === `${API}/versus/facts`) {
      const b = await body<{ facts?: unknown; base?: unknown }>(req);
      if (!Array.isArray(b.facts) || b.facts.length === 0 || b.facts.length > MAX_BATCH) throw new HttpError(400, 'bad-request', `Send 1 to ${MAX_BATCH} facts.`);
      let bodies: FactBody[];
      let authors: string[];
      try {
        bodies = b.facts.map(checkShape);
        authors = authorize(bodies, viewerOf(session), (t) => room.case(t), { demoClock: config.demoClock });
      } catch (err) {
        if (err instanceof BadFact) throw new HttpError(400, 'bad-request', err.message);
        if (err instanceof Forbidden) throw new HttpError(403, 'forbidden', err.message);
        throw err;
      }
      try {
        const accepted = await room.append(bodies, Number(b.base), authors);
        const viewer = viewerOf(session);
        // Seq numbers are log positions: the accepted facts end at the last one's seq.
        const r: VersusAppendResponse = { accepted: room.redact(viewer, accepted), length: accepted[accepted.length - 1]!.seq, epoch: room.epoch(viewer) };
        return json(res, 200, r);
      } catch (err) {
        if (err instanceof Conflict) throw new HttpError(409, 'conflict', err.message);
        if (err instanceof Rejected) throw new HttpError(422, 'rejected', err.message);
        if (err instanceof RoomFull) throw new HttpError(507, 'full', err.message);
        throw err;
      }
    }
    if (method === 'POST' && path === `${API}/versus/access`) {
      const b = await body<{ code?: unknown; token?: unknown }>(req);
      const parsed = typeof b.code === 'string' ? parseInviteCode(b.code) : null;
      if (!parsed?.ok) throw new HttpError(400, 'bad-request', parsed?.message ?? 'Enter the 8-character code from your invite.');
      const c = room.findByCode(parsed.code);
      const signed = typeof b.token === 'string' && c ? signer.verify(b.token, parsed.code, clock()) === c.trialId : false;
      if (!signed && !session.grants.has(c?.trialId ?? '')) {
        // Unsigned lookups are guesses as far as the server can tell: they are rationed.
        limit(limits.inviteSession, sid, 'Too many invite codes tried from this device. Wait a few minutes.');
        limit(limits.inviteIp, ip, 'Too many invite codes tried from this network. Wait a few minutes.');
      }
      if (!c) throw new HttpError(404, 'not-found', 'No case has that invite code.');
      if (sessions.grant(session, c.trialId)) broadcastVersus();
      const r: VersusAccessResponse = { trialId: c.trialId };
      return json(res, 200, r);
    }
    const invite = /^\/api\/v1\/versus\/invite\/(vs-[0-9a-z]{10})$/.exec(path);
    if (method === 'GET' && invite) {
      const c = room.case(invite[1]!);
      if (!c || c.parties.a?.account !== session.persona.account.toLowerCase()) throw new HttpError(404, 'not-found', 'No such case of yours.');
      const s = c.state;
      const expiresAt = s.stage === 'filing' && s.consentEndsAt !== null ? s.consentEndsAt + 3600 : clock() + 7 * 86400;
      const r: VersusInviteResponse = { code: c.code, token: signer.sign(c.trialId, c.code, expiresAt), expiresAt };
      return json(res, 200, r);
    }

    /* Grand Jury */
    const account = session.persona.account;
    if (method === 'GET' && path === `${API}/gj/state`) {
      const court = await hall.viewFor(account);
      return json(res, 200, { ...gjMeta(), account, balance: (await court.balance())!, marketingUsed: hall.marketingUsed() });
    }
    if (method === 'GET' && path === `${API}/gj/docket`) {
      const court = await hall.viewFor(account);
      return json(res, 200, { ...gjMeta(), entries: await court.list() });
    }
    if (method === 'POST' && path === `${API}/gj/faucet`) {
      limit(limits.faucet, sid, 'The faucet needs a moment. Try again shortly.');
      const b = await body<{ amount?: unknown }>(req);
      await hall.viewFor(account);
      const result = await hall.command({ type: 'faucet', account, amount: amountOf(b.amount, FAUCET_MAX) });
      return json(res, 200, { ...gjMeta(), result });
    }
    const gj = /^\/api\/v1\/gj\/cases\/(\d{1,9})(?:\/([a-z-]+))?$/.exec(path);
    if (gj) {
      const n = caseParam(gj[1]!);
      const action = gj[2] as GjAction | undefined;
      const court = await hall.viewFor(account);
      if (method === 'GET' && !action) return json(res, 200, { ...gjMeta(), detail: await court.detail(n) });
      if (method === 'POST' && action) {
        const b = await body<Record<string, unknown>>(req);
        let cmd: Parameters<GrandJuryHall['command']>[0];
        switch (action) {
          case 'contribute':
            cmd = { type: 'contribute', account, n, amount: amountOf(b.amount, usdc('1000.00')) };
            break;
          case 'screen':
            cmd = { type: 'screen', account, n, proof: proofOf(b.proof) };
            break;
          case 'seat-request':
          case 'seat-decline':
          case 'seat-accept':
          case 'settle':
          case 'claim':
            cmd = { type: action, account, n };
            break;
          case 'commit':
            cmd = { type: 'commit', account, n, commitment: hex32(b.commitment, 'commitment') };
            break;
          case 'reveal':
            cmd = { type: 'reveal', account, n, choice: choiceOf(b.choice), salt: hex32(b.salt, 'salt') };
            break;
          case 'gallery':
            cmd = { type: 'gallery', account, n, choice: choiceOf(b.choice) };
            break;
          case 'skip':
            if (!config.demoClock) throw new HttpError(403, 'disabled', 'Moving the court clock is switched off on this server.');
            cmd = { type: 'skip', n };
            break;
          default:
            throw new HttpError(404, 'not-found', 'No such action.');
        }
        const result = await hall.command(cmd);
        return json(res, 200, { ...gjMeta(), result });
      }
    }

    throw new HttpError(404, 'not-found', 'No such route.');
  }

  function openStream(req: IncomingMessage, res: ServerResponse, session: Session): void {
    const mine = [...streams].filter((s) => s.session === session);
    if (mine.length >= 4) mine[0]!.res.end();
    if (streams.size >= 4000) throw new HttpError(503, 'full', 'Too many live connections.');
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', [TIME_HEADER]: String(clockMs()) });
    res.write(': court server\n\n');
    const stream: Stream = { res, session };
    streams.add(stream);
    send(res, 'hello', { serverTime: clockMs() });
    send(res, 'versus', { length: room.length, epoch: room.epoch(viewerOf(session)) });
    send(res, 'gj', { version: hall.version, now: hall.now() });
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    const done = () => {
      clearInterval(ping);
      streams.delete(stream);
    };
    req.on('close', done);
    res.on('error', done);
  }

  const server = createServer((req, res) => {
    if (!cors(req, res)) {
      json(res, 403, { error: { code: 'forbidden', message: 'This origin may not use the court server.' } });
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...SECURITY_HEADERS,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      });
      res.end();
      return;
    }
    route(req, res).catch((err: unknown) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (err instanceof HttpError) {
        if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
        json(res, err.status, { error: { code: err.code, message: err.message, ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}) } });
        return;
      }
      log(`[court-server] ${req.method} ${req.url}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
      json(res, 500, { error: { code: 'server', message: 'The court server hit a problem. Nothing was recorded.' } });
    });
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let beating = false;
  const tick = async () => {
    await room.tick();
    await hall.tick();
  };
  if (config.tickMs > 0) {
    heartbeat = setInterval(() => {
      if (beating) return;
      beating = true;
      tick()
        .catch((err: unknown) => log(`[court-server] heartbeat: ${err instanceof Error ? err.message : String(err)}`))
        .finally(() => {
          beating = false;
        });
    }, config.tickMs);
  }

  return {
    server,
    room,
    hall,
    sessions,
    config,
    tick,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => {
          const a = server.address() as AddressInfo;
          resolve(`http://${a.address.includes(':') ? `[${a.address}]` : a.address}:${a.port}`);
        });
      }),
    close: async () => {
      if (heartbeat) clearInterval(heartbeat);
      for (const s of streams) s.res.end();
      streams.clear();
      await new Promise<void>((r) => server.close(() => r()));
      server.closeAllConnections?.();
      hall.dispose();
    },
  };
}

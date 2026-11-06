/**
 * Device sessions: a random bearer token per device (kept in that browser's
 * storage), and the demo wallet the court issued it. The server stores only a
 * SHA-256 of each token. This is demo-grade identity: whoever holds the token
 * is that device. World ID stays a separate (mocked) proof per action.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Hex } from '@cringe-court/core';
import type { PersonaInfo } from '@cringe-court/net';
import type { DurableLog } from './store';

export interface Session {
  persona: PersonaInfo;
  createdAt: number;
  /** Versus cases this device opened with an invite code or link. */
  grants: Set<string>;
}

type SessionRecord = { type: 'session'; hash: string; persona: PersonaInfo; at: number } | { type: 'grant'; personaId: string; trialId: string; at: number };

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class SessionFull extends Error {}

export class Sessions {
  readonly #byHash = new Map<string, Session>();
  readonly #byPersona = new Map<string, Session>();
  readonly #byAccount = new Map<string, Session>();

  constructor(
    private readonly log: DurableLog<SessionRecord>,
    private readonly clock: () => number,
    private readonly max: number,
  ) {
    for (const r of log.readAll()) this.#apply(r);
  }

  get size(): number {
    return this.#byHash.size;
  }

  #apply(r: SessionRecord): void {
    if (r.type === 'session') {
      const s: Session = { persona: r.persona, createdAt: r.at, grants: new Set() };
      this.#byHash.set(r.hash, s);
      this.#byPersona.set(r.persona.id, s);
      this.#byAccount.set(r.persona.account.toLowerCase(), s);
    } else {
      this.#byPersona.get(r.personaId)?.grants.add(r.trialId);
    }
  }

  #write(r: SessionRecord): void {
    this.log.append(r);
    this.#apply(r);
  }

  create(): { token: string; session: Session } {
    if (this.#byHash.size >= this.max) throw new SessionFull('This court server has as many devices as it can hold.');
    const token = randomBytes(32).toString('base64url');
    const n = this.#byHash.size + 1;
    const persona: PersonaInfo = { id: `p-${randomBytes(6).toString('hex')}`, name: `device-${n}`, account: `0x${randomBytes(20).toString('hex')}` as Hex };
    this.#write({ type: 'session', hash: hashToken(token), persona, at: this.clock() });
    return { token, session: this.#byPersona.get(persona.id)! };
  }

  resolve(token: string | null): Session | null {
    if (!token || token.length > 128) return null;
    return this.#byHash.get(hashToken(token)) ?? null;
  }

  byAccount(account: string): Session | null {
    return this.#byAccount.get(account.toLowerCase()) ?? null;
  }

  grant(session: Session, trialId: string): boolean {
    if (session.grants.has(trialId)) return false;
    this.#write({ type: 'grant', personaId: session.persona.id, trialId, at: this.clock() });
    return true;
  }
}

/* ── Signed invite tokens ────────────────────────────────────────────────── */

/**
 * `<trialId>.<expires>.<mac>`: an HMAC over the case, its code and an expiry.
 * The invite link carries it, so the link opens the case without a code guess
 * counting against the rate limit; a forged or expired token opens nothing.
 */
export class InviteSigner {
  constructor(private readonly secret: string) {}

  #mac(trialId: string, code: string, expires: number): string {
    return createHmac('sha256', this.secret).update(`versus-invite:${trialId}:${code}:${expires}`).digest('base64url').slice(0, 32);
  }

  sign(trialId: string, code: string, expires: number): string {
    return `${trialId}.${expires}.${this.#mac(trialId, code, expires)}`;
  }

  /** The trial id if the token is genuine, unexpired and for this code. */
  verify(token: string, code: string, now: number): string | null {
    const m = /^(vs-[0-9a-z]{10})\.(\d{1,12})\.([A-Za-z0-9_-]{32})$/.exec(token);
    if (!m) return null;
    const [, trialId, exp, mac] = m as unknown as [string, string, string, string];
    const expires = Number(exp);
    if (expires < now) return null;
    const want = Buffer.from(this.#mac(trialId, code, expires));
    const got = Buffer.from(mac);
    return want.length === got.length && timingSafeEqual(want, got) ? trialId : null;
  }
}

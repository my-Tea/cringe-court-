import type { CaseNumber, Hex } from '../case';
import { bytesToHex, keccak256, seededRandom } from '../hash';
import type { ModeId } from '../modes';
import type { Unsubscribe } from '../ports/chain';
import type { ScreeningResult } from '../ports/court';
import type {
  DrawRequest,
  IdentityPort,
  JuryPort,
  PoolEntry,
  ProofRequest,
  ProofResult,
  SaltVault,
  SealedBallot,
  SeatOffer,
  VerifyContext,
  WorldIdProof,
} from '../ports/people';

const key = (a: Hex) => a.toLowerCase();

export interface MockIdentityOptions {
  /** What the next `requestProof` does. Default 'verified'. */
  behaviour?: 'verified' | 'cancelled' | 'not-verified' | 'error';
  /** The human behind the mock: same human → same nullifier per action. */
  human?: string;
  appId?: string;
}

/**
 * World ID twin. Nullifiers are keccak(human, action, signal-scope), so the same
 * human gets the same nullifier for the same action (reuse is detectable), and
 * verification rejects reuse and conflicts exactly like the real flow.
 */
export class MockIdentity implements IdentityPort {
  readonly id = 'mock' as const;
  readonly appId: string;
  behaviour: NonNullable<MockIdentityOptions['behaviour']>;
  human: string;
  readonly #used = new Set<string>();

  constructor(options: MockIdentityOptions = {}) {
    this.behaviour = options.behaviour ?? 'verified';
    this.human = options.human ?? 'human-1';
    this.appId = options.appId ?? 'app_staging_cringecourt_mock';
  }

  /** The nullifier this mock issues for a human + action + signal. */
  static nullifierFor(human: string, request: ProofRequest): Hex {
    return keccak256(`nullifier:${human}:${request.action}:${request.signal}`);
  }

  async requestProof(request: ProofRequest, signal?: AbortSignal): Promise<ProofResult> {
    if (signal?.aborted || this.behaviour === 'cancelled') return { ok: false, reason: 'cancelled', message: 'You closed World ID before finishing.' };
    if (this.behaviour === 'not-verified') return { ok: false, reason: 'not-verified', message: 'This seat needs a verified World ID (Orb).' };
    if (this.behaviour === 'error') return { ok: false, reason: 'error', message: 'World ID is not responding. Try again.' };
    const proof: WorldIdProof = {
      merkleRoot: keccak256('mock-merkle-root'),
      nullifierHash: MockIdentity.nullifierFor(this.human, request),
      proof: bytesToHex(new Uint8Array(256).fill(7)),
      verificationLevel: 'orb',
    };
    return { ok: true, proof };
  }

  async verify(proof: WorldIdProof, request: ProofRequest, context: VerifyContext = {}): Promise<ScreeningResult> {
    const n = key(proof.nullifierHash);
    if (context.exclude?.some((x) => key(x) === n)) {
      return { ok: false, reason: 'conflicted', message: 'You are a party to this case, so you cannot sit on its jury.' };
    }
    const scope = `${request.action}:${request.signal}:${n}`;
    if (this.#used.has(scope)) return { ok: false, reason: 'already-used', message: 'This World ID was already used for this seat.' };
    this.#used.add(scope);
    return { ok: true, nullifier: proof.nullifierHash };
  }
}

/** Waiting pool twin with seeded, auditable draws. */
export class MockJury implements JuryPort {
  readonly id = 'mock' as const;
  readonly #pool = new Map<string, PoolEntry>();
  readonly #offers = new Map<string, SeatOffer>();
  readonly #listeners = new Map<string, Set<(o: SeatOffer) => void>>();
  #nextOffer = 0;

  constructor(private readonly clock: () => number = () => Math.floor(Date.now() / 1000)) {}

  async enlist(entry: Omit<PoolEntry, 'joinedAt'>): Promise<PoolEntry> {
    for (const e of this.#pool.values()) {
      if (key(e.nullifier) === key(entry.nullifier) && key(e.juror) !== key(entry.juror)) {
        throw new Error('This human is already in the pool with another wallet');
      }
    }
    const full: PoolEntry = { ...entry, joinedAt: this.clock() };
    this.#pool.set(key(entry.juror), full);
    return full;
  }

  async leave(juror: Hex): Promise<void> {
    this.#pool.delete(key(juror));
  }

  async poolSize(mode?: ModeId): Promise<number> {
    return [...this.#pool.values()].filter((e) => !mode || e.modes.includes(mode)).length;
  }

  async draw(request: DrawRequest): Promise<readonly SeatOffer[]> {
    const excluded = new Set(request.exclude.map(key));
    const eligible = [...this.#pool.values()]
      .filter((e) => e.modes.includes(request.mode) && !excluded.has(key(e.juror)) && !excluded.has(key(e.nullifier)))
      .sort((a, b) => (key(a.juror) < key(b.juror) ? -1 : 1));
    const rand = seededRandom(`${request.seed}:${request.caseNumber}`);
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j]!, eligible[i]!];
    }
    // Offer 2× the seats so refusals don't stall recruitment.
    const picked = eligible.slice(0, request.seats * 2);
    return picked.map((e) => {
      const offer: SeatOffer = {
        id: `offer-${++this.#nextOffer}`,
        caseNumber: request.caseNumber,
        juror: e.juror,
        mode: request.mode,
        category: request.category,
        title: request.title,
        bond: request.bond,
        expiresAt: request.expiresAt,
        status: 'open',
      };
      this.#offers.set(offer.id, offer);
      this.#listeners.get(key(e.juror))?.forEach((fn) => fn(offer));
      return offer;
    });
  }

  async offersFor(juror: Hex): Promise<readonly SeatOffer[]> {
    const now = this.clock();
    return [...this.#offers.values()]
      .filter((o) => key(o.juror) === key(juror))
      .map((o) => (o.status === 'open' && now >= o.expiresAt ? { ...o, status: 'expired' as const } : o));
  }

  async respond(offerId: string, answer: 'accepted' | 'declined'): Promise<SeatOffer> {
    const offer = this.#offers.get(offerId);
    if (!offer) throw new Error(`No offer ${offerId}`);
    if (offer.status !== 'open' || this.clock() >= offer.expiresAt) throw new Error('This offer is no longer open');
    const next = { ...offer, status: answer };
    this.#offers.set(offerId, next);
    return next;
  }

  subscribe(juror: Hex, listener: (offer: SeatOffer) => void): Unsubscribe {
    const k = key(juror);
    if (!this.#listeners.has(k)) this.#listeners.set(k, new Set());
    this.#listeners.get(k)!.add(listener);
    return () => this.#listeners.get(k)?.delete(listener);
  }
}

/** Salt vault in memory (the web app's real one persists to IndexedDB/localStorage). */
export class MemorySaltVault implements SaltVault {
  readonly #ballots = new Map<string, SealedBallot>();
  #n = 0;

  constructor(private readonly seed = 'salt') {}

  async save(ballot: SealedBallot): Promise<void> {
    this.#ballots.set(`${ballot.caseNumber}:${key(ballot.juror)}`, ballot);
  }

  async load(caseNumber: CaseNumber, juror: Hex): Promise<SealedBallot | null> {
    return this.#ballots.get(`${caseNumber}:${key(juror)}`) ?? null;
  }

  async remove(caseNumber: CaseNumber, juror: Hex): Promise<void> {
    this.#ballots.delete(`${caseNumber}:${key(juror)}`);
  }

  newSalt(): Hex {
    return keccak256(`${this.seed}:${++this.#n}`);
  }
}

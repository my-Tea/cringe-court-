/**
 * JuryPort (the verified waiting pool and random seat offers, V4 §10),
 * SaltVault (client-side ballot salts, V4 §7) and IdentityPort (World IDKit).
 */
import type { CaseNumber, Category, Hex } from '../case';
import type { ModeId } from '../modes';
import type { Usdc } from '../money';
import type { BallotChoice } from '../settlement';
import type { ScreeningResult } from './court';
import type { Unsubscribe } from './chain';

/* ── World IDKit ───────────────────────────────────────────────────────── */

/** One consistent app-wide action per juror role, so parties are excluded across wallets (V4 §10). */
export type IdentityAction = 'join-jury-pool' | 'accept-jury-seat' | 'case-party' | 'gallery-vote';

export type VerificationLevel = 'orb' | 'secure-document' | 'document' | 'device';

export interface WorldIdProof {
  merkleRoot: Hex;
  nullifierHash: Hex;
  proof: Hex;
  verificationLevel: VerificationLevel;
}

export interface ProofRequest {
  action: IdentityAction;
  /** Binds the proof to one thing: e.g. `case:69:seat` or the juror address. */
  signal: string;
  /** V4 §10: strong Proof of Human for paid seats. */
  minLevel?: VerificationLevel;
}

export type ProofResult =
  | { ok: true; proof: WorldIdProof }
  | { ok: false; reason: 'cancelled' | 'not-verified' | 'error'; message: string };

export interface VerifyContext {
  caseNumber?: CaseNumber;
  /** Nullifiers of the case's parties: a match is `conflicted`. */
  exclude?: readonly Hex[];
}

export interface IdentityPort {
  readonly id: 'world-idkit' | 'mock';
  readonly appId: string;
  /** Client: open IDKit and get a proof. */
  requestProof(request: ProofRequest, signal?: AbortSignal): Promise<ProofResult>;
  /** Server/contract: verify a proof, reject reuse and conflicts. */
  verify(proof: WorldIdProof, request: ProofRequest, context?: VerifyContext): Promise<ScreeningResult>;
}

/* ── Jury pool ─────────────────────────────────────────────────────────── */

export interface PoolEntry {
  juror: Hex;
  /** World ID nullifier for `join-jury-pool`: one entry per human. */
  nullifier: Hex;
  joinedAt: number;
  modes: readonly ModeId[];
}

export interface SeatOffer {
  id: string;
  caseNumber: CaseNumber;
  juror: Hex;
  mode: ModeId;
  category: Category;
  title: string;
  bond: Usdc;
  /** Offer lapses after this; refusing before deposit is never slashable (V4 §10). */
  expiresAt: number;
  status: 'open' | 'accepted' | 'declined' | 'expired';
}

export interface DrawRequest {
  caseNumber: CaseNumber;
  mode: ModeId;
  category: Category;
  title: string;
  bond: Usdc;
  seats: number;
  /** Parties' accounts and nullifiers. */
  exclude: readonly Hex[];
  /** Public seed (e.g. a block hash) so the draw is auditable. */
  seed: Hex;
  expiresAt: number;
}

export interface JuryPort {
  readonly id: 'pool' | 'mock';
  enlist(entry: Omit<PoolEntry, 'joinedAt'>): Promise<PoolEntry>;
  leave(juror: Hex): Promise<void>;
  poolSize(mode?: ModeId): Promise<number>;
  /** Draw random offers from the pool (more than seats, to absorb refusals). */
  draw(request: DrawRequest): Promise<readonly SeatOffer[]>;
  offersFor(juror: Hex): Promise<readonly SeatOffer[]>;
  respond(offerId: string, answer: 'accepted' | 'declined'): Promise<SeatOffer>;
  subscribe(juror: Hex, listener: (offer: SeatOffer) => void): Unsubscribe;
}

/* ── Ballot salts ──────────────────────────────────────────────────────── */

export interface SealedBallot {
  caseNumber: CaseNumber;
  juror: Hex;
  choice: BallotChoice;
  salt: Hex;
  commitment: Hex;
  savedAt: number;
}

/** The salt never leaves the client (ARCHITECTURE rule 3). Losing it = missed reveal. */
export interface SaltVault {
  save(ballot: SealedBallot): Promise<void>;
  load(caseNumber: CaseNumber, juror: Hex): Promise<SealedBallot | null>;
  remove(caseNumber: CaseNumber, juror: Hex): Promise<void>;
  /** Fresh 32-byte salt. */
  newSalt(): Hex;
}

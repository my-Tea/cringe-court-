/**
 * The court server's HTTP API, as types both ends compile against.
 * Everything travels through the wire codec (bigints and Maps survive).
 * Paths are relative to the server's base URL. docs/BACKEND.md has the prose.
 */
import type { BallotChoice, CaseNumber, Hex, Usdc, WorldIdProof } from '@cringe-court/core';
import type { ActionResult, CaseDetail, DocketEntry } from '@cringe-court/modes-grand-jury';
import type { Fact } from '@cringe-court/modes-versus';

export const API = '/api/v1';

/** Header carrying the server's wall clock (unix ms) on every response. */
export const TIME_HEADER = 'x-court-time';

export interface PersonaInfo {
  /** Stable id ("p-…"); the Versus fact author. */
  id: string;
  /** Shown only to its owner ("Device 2"). */
  name: string;
  /** Demo wallet the server issued for this device. Test money only. */
  account: Hex;
}

export interface Features {
  /** Demo control: may a visitor move the court clock forward? */
  demoClock: boolean;
  /** How simulated jurors take Grand Jury seats on this server. */
  npcJurors: 'fill' | 'late' | 'off';
}

export interface HealthResponse {
  ok: true;
  name: 'cringe-court-server';
  version: string;
  serverTime: number;
  features: Features;
}

export interface SessionResponse {
  token: string;
  persona: PersonaInfo;
  features: Features;
}

export interface MeResponse {
  persona: PersonaInfo;
  features: Features;
}

/* ── Versus ─────────────────────────────────────────────────────────────── */

export interface VersusLogResponse {
  /** Fingerprint of what this session may see. A change means "drop your copy and take this one". */
  epoch: string;
  /** True when `facts` is the whole log (first read, or the epoch changed). */
  reset: boolean;
  /** Index of the first fact in `facts`. */
  from: number;
  facts: Fact[];
  /** Length of the whole log. */
  length: number;
}

export interface VersusAppendRequest {
  facts: Fact[];
  /** How many facts the client had when it built these (optimistic concurrency, per case). */
  base: number;
}

export interface VersusAppendResponse {
  /** The facts as the court recorded them (seq, time and author are the court's). */
  accepted: Fact[];
  length: number;
  /** The session's view fingerprint after the write (it changes when, say, Side B joins). */
  epoch: string;
}

export interface VersusAccessRequest {
  code: string;
  /** The signed seat token from an invite link, if the visitor followed one. */
  token?: string;
}

export interface VersusAccessResponse {
  trialId: string;
}

export interface VersusInviteResponse {
  code: string;
  /** Signed by the server: proves the link was minted for this case. */
  token: string;
  expiresAt: number;
}

/* ── Grand Jury ─────────────────────────────────────────────────────────── */

export interface GjMeta {
  /** Court time (unix seconds), demo skips included. */
  now: number;
  version: number;
}

export interface GjStateResponse extends GjMeta {
  account: Hex;
  balance: Usdc;
  marketingUsed: number;
}

export interface GjDocketResponse extends GjMeta {
  entries: DocketEntry[];
}

export interface GjCaseResponse extends GjMeta {
  detail: CaseDetail | null;
}

export type GjActionResponse<T = unknown> = GjMeta & { result: ActionResult<T> };

export interface GjContributeRequest {
  amount: Usdc;
}
export interface GjScreenRequest {
  proof: WorldIdProof;
}
export interface GjCommitRequest {
  commitment: Hex;
}
export interface GjRevealRequest {
  choice: BallotChoice;
  salt: Hex;
}
export interface GjGalleryRequest {
  choice: BallotChoice;
}
export interface GjFaucetRequest {
  amount: Usdc;
}

export type GjAction = 'contribute' | 'screen' | 'seat-request' | 'seat-decline' | 'seat-accept' | 'commit' | 'reveal' | 'settle' | 'claim' | 'gallery' | 'skip';

export const gjCasePath = (n: CaseNumber | number, action?: GjAction) => `${API}/gj/cases/${n}${action ? `/${action}` : ''}`;

/* ── Errors and live events ─────────────────────────────────────────────── */

export type ErrorCode =
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rejected'
  | 'too-large'
  | 'rate-limited'
  | 'full'
  | 'disabled'
  | 'server';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; retryAfter?: number };
}

/** Server-sent events (`event:` name → `data:` JSON). */
export interface ServerEvents {
  hello: { serverTime: number };
  /** The log grew, or what this session may see changed (`epoch`). */
  versus: { length: number; epoch: string };
  gj: { version: number; now: number };
}

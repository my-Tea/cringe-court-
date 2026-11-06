/**
 * Ports: the only way app code talks to 0G, World and Arc. Each has a real
 * adapter (later phases) and a deterministic mock/fixture adapter for tests and
 * demos, chosen at startup. Nothing outside an adapter imports a sponsor SDK.
 */
import type { CaseNumber, CaseSummary, Hex } from '../case';
import type { ModeId } from '../modes';
import type { Usdc } from '../money';

/* ── 0G Compute: AI prosecution and defense ─────────────────────────────── */

/**
 * `clerk` is the Court Clerk (case introductions, procedure, waiting states).
 * Renderers without a clerk actor fall back to the narrator slot.
 */
export type Speaker = 'judge' | 'prosecutor' | 'defense' | 'side-a' | 'side-b' | 'narrator' | 'clerk';

export interface TranscriptLine {
  speaker: Speaker;
  text: string;
  /** Optional stage direction for the courtroom renderer ("desk-slam", "objection"). */
  beat?: string;
}

export interface ArgumentRequest {
  mode: ModeId;
  /** Approved, sanitized public story text per side (one entry in Solo). */
  stories: readonly string[];
  /** Mode 1 only: the user's one steering angle (≤ 140 chars, D2). */
  angle?: string;
  /** Teaser = openings only, no verdict (D3). */
  scope: 'teaser' | 'full';
}

export interface ArgumentResult {
  lines: readonly TranscriptLine[];
  /** Provider request ids, shown in the trial record (V4 §14.3). */
  requestIds: readonly string[];
  /** Fingerprint of the frozen transcript. */
  transcriptHash: Hex;
}

/** @deprecated Phase 3 sketch; use AiCounselPort. */
export interface AiCourtProvider {
  readonly id: 'og-compute' | 'fixture';
  argue(request: ArgumentRequest, signal?: AbortSignal): Promise<ArgumentResult>;
  /** A sentencing line consistent with an already recorded human verdict. */
  sentence(verdictLabel: string, transcriptHash: Hex, signal?: AbortSignal): Promise<string>;
}

/* ── World IDKit: juror screening ───────────────────────────────────────── */

export type ScreeningResult =
  | { ok: true; nullifier: Hex }
  | { ok: false; reason: 'not-verified' | 'already-used' | 'conflicted' | 'cancelled' | 'error'; message: string };

/** @deprecated Phase 3 sketch; use IdentityPort. */
export interface JurorVerifier {
  readonly id: 'world-idkit' | 'mock';
  /** Prove a unique human for one juror action on one case. */
  screen(caseNumber: CaseNumber, signal?: AbortSignal): Promise<ScreeningResult>;
}

/* ── Arc testnet: escrow, bonds, commit–reveal, settlement ─────────────── */

export interface TxReceipt {
  hash: Hex;
  /** Explorer URL, so every money moment can be checked by the user. */
  explorerUrl: string;
}

/** @deprecated Phase 3 sketch; use ChainPort. Kept so existing imports compile. */
export interface CourtLedger {
  readonly id: 'arc-testnet' | 'memory';
  readonly network: 'arc-testnet';
  getCase(caseNumber: CaseNumber): Promise<CaseSummary | null>;
  listCases(filter?: { mode?: ModeId }): Promise<readonly CaseSummary[]>;
  fund(caseNumber: CaseNumber, amount: Usdc): Promise<TxReceipt>;
  acceptSeat(caseNumber: CaseNumber, bond: Usdc): Promise<TxReceipt>;
  /** Commit keccak256(choice, salt). The salt never leaves the client. */
  commit(caseNumber: CaseNumber, commitment: Hex): Promise<TxReceipt>;
  reveal(caseNumber: CaseNumber, choice: 0 | 1, salt: Hex): Promise<TxReceipt>;
  finalize(caseNumber: CaseNumber): Promise<TxReceipt>;
}

/** @deprecated Phase 3 sketch; use CourtPorts. */
export interface CourtServices {
  ai: AiCourtProvider;
  verifier: JurorVerifier;
  ledger: CourtLedger;
}

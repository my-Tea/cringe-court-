/**
 * The Solo trial, written after the money moved. The player never sees a script
 * before staking: the server reads the stake from Arc, checks that the stake is
 * for this exact confession, and only then asks the model for the trial.
 */
import { CaseRejectedError, TrialGenerationError, createCourtAI, getOrGenerateTrial, loadCourtAIConfig, prepareCase, toCourtLines, MemoryTranscriptStore, type CourtAI, type Transcript } from '@cringe-court/ai/court';
import type { CourtLine } from '@cringe-court/core';
import { createPublicClient, http, keccak256, parseEventLogs, parseAbi, stringToBytes, type Address, type Hex } from 'viem';

const ARC_RPC = 'https://rpc.testnet.arc.network';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const COURT_EVENTS = parseAbi(['event CaseCreated(uint256 indexed caseId, uint8 indexed mode, address indexed creator, address sideB, bytes32 contentHash)']);

/** What the stake commits to. The web computes the same hash before it pays. */
export function confessionHash(title: string, story: string): Hex {
  return keccak256(stringToBytes(`${title}\n${story}`));
}

export interface StakeReader {
  /** The contentHash a Solo filing transaction committed to, with its case id. Null when it is not one. */
  filing(txHash: Hex): Promise<{ caseId: bigint; contentHash: Hex } | null>;
}

export function arcStakeReader(env: Readonly<Record<string, string | undefined>>, court: Address): StakeReader {
  const client = createPublicClient({ transport: http(env.ARC_RPC_URL?.trim() || ARC_RPC) });
  return {
    async filing(txHash) {
      const receipt = await client.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') return null;
      const logs = parseEventLogs({ abi: COURT_EVENTS, logs: receipt.logs.filter((l) => l.address.toLowerCase() === court.toLowerCase()) });
      const created = logs.find((l) => l.args.mode === 0);
      return created ? { caseId: created.args.caseId, contentHash: created.args.contentHash } : null;
    },
  };
}

export function courtWriter(env: Readonly<Record<string, string | undefined>>, log: (line: string) => void): CourtAI | null {
  try {
    return createCourtAI(loadCourtAIConfig({ ...env, OG_MODEL: env.OG_MODEL?.trim() || DEFAULT_MODEL }, { provider: '0g' }));
  } catch (e) {
    log(`[solo] no trial writer: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function prepare(title: string, story: string, caseId: string) {
  return prepareCase({ mode: 'solo', caseId, caseTitle: title, confession: story });
}

export type ScreenResult = { ok: true } | { ok: false; message: string };

/** Runs before payment, so nobody pays for a confession the court would refuse. */
export function screenConfession(title: unknown, story: unknown): ScreenResult {
  if (typeof title !== 'string' || typeof story !== 'string') return { ok: false, message: 'Tell the court what you did.' };
  try {
    prepare(title, story, 'screen');
    return { ok: true };
  } catch (e) {
    if (e instanceof CaseRejectedError) return { ok: false, message: e.message };
    throw e;
  }
}

export type TrialFailure = 'bad-request' | 'not-a-stake' | 'wrong-confession' | 'unavailable' | 'failed';
export type TrialResult = { ok: true; lines: CourtLine[]; contentHash: string } | { ok: false; reason: TrialFailure; message: string };

export function createSoloTrials(o: { writer: CourtAI | null; stakes: StakeReader }) {
  const store = new MemoryTranscriptStore();

  const generate = async (caseKey: string, title: string, story: string): Promise<Transcript> => {
    const prepared = prepare(title, story, caseKey);
    try {
      return await getOrGenerateTrial(store, o.writer!, prepared);
    } catch (e) {
      // A paid case deserves a second attempt: a model can misfire twice in a row without the case being unfit.
      if (e instanceof TrialGenerationError && e.code === 'invalid-output') return getOrGenerateTrial(store, o.writer!, prepared);
      throw e;
    }
  };

  return {
    async trial(txHash: unknown, title: unknown, story: unknown): Promise<TrialResult> {
      if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash) || typeof title !== 'string' || typeof story !== 'string') {
        return { ok: false, reason: 'bad-request', message: 'Send {txHash, title, story}.' };
      }
      if (!o.writer) return { ok: false, reason: 'unavailable', message: 'The court has no lawyers on call.' };
      const filing = await o.stakes.filing(txHash as Hex);
      if (!filing) return { ok: false, reason: 'not-a-stake', message: 'That transaction is not a Solo stake.' };
      if (filing.contentHash.toLowerCase() !== confessionHash(title, story)) {
        return { ok: false, reason: 'wrong-confession', message: 'That stake was for a different confession.' };
      }
      try {
        const transcript = await generate(`arc-solo-${filing.caseId}`, title, story);
        return { ok: true, lines: toCourtLines(transcript), contentHash: transcript.contentHash };
      } catch (e) {
        return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : 'The court could not sit.' };
      }
    },
  };
}

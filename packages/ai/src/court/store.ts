/**
 * Transcript storage: a trial is generated once per case and then replayed.
 * Refreshing a page or reconnecting must never regenerate it (and never re-bill
 * inference). Stores are write-once per caseId; the content hash is checked on
 * every read so a tampered or corrupted file is caught before it is performed.
 */
import { verifyTranscriptHash, type CourtAIProvider } from './engine';
import { TranscriptSchema, type PreparedCase, type Transcript } from './schema';

export interface TranscriptStore {
  get(caseId: string): Promise<Transcript | null>;
  /** Write once. Throws if a different transcript already exists for the case. */
  put(transcript: Transcript): Promise<void>;
}

export class TranscriptIntegrityError extends Error {
  constructor(readonly caseId: string, message: string) {
    super(message);
    this.name = 'TranscriptIntegrityError';
  }
}

/** Parse + hash-check a stored transcript. */
export function loadTranscript(raw: unknown, caseId: string): Transcript {
  const parsed = TranscriptSchema.safeParse(raw);
  if (!parsed.success) throw new TranscriptIntegrityError(caseId, `Stored transcript for ${caseId} does not match the schema`);
  if (!verifyTranscriptHash(parsed.data)) throw new TranscriptIntegrityError(caseId, `Stored transcript for ${caseId} fails its content hash`);
  return parsed.data;
}

export class MemoryTranscriptStore implements TranscriptStore {
  readonly #items = new Map<string, string>();

  async get(caseId: string): Promise<Transcript | null> {
    const raw = this.#items.get(caseId);
    return raw === undefined ? null : loadTranscript(JSON.parse(raw), caseId);
  }

  async put(t: Transcript): Promise<void> {
    const existing = this.#items.get(t.caseId);
    if (existing !== undefined) {
      if ((JSON.parse(existing) as Transcript).contentHash === t.contentHash) return;
      throw new TranscriptIntegrityError(t.caseId, `A different transcript is already stored for ${t.caseId}`);
    }
    this.#items.set(t.caseId, JSON.stringify(t));
  }
}

const inflight = new Map<string, Promise<Transcript>>();

/**
 * Return the stored trial for a case, generating it at most once. Concurrent
 * callers for the same case share one generation (per process).
 */
export async function getOrGenerateTrial(store: TranscriptStore, ai: CourtAIProvider, prepared: PreparedCase): Promise<Transcript> {
  const existing = await store.get(prepared.caseId);
  if (existing) return existing;
  const pending = inflight.get(prepared.caseId);
  if (pending) return pending;
  const job = (async () => {
    const t = await ai.generateTrial(prepared);
    await store.put(t);
    return t;
  })().finally(() => inflight.delete(prepared.caseId));
  inflight.set(prepared.caseId, job);
  return job;
}

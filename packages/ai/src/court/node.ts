/**
 * Node-only court AI helpers: file-backed transcript storage.
 * Import from "@cringe-court/ai/court/node" in server code and scripts only.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadTranscript, TranscriptIntegrityError, type TranscriptStore } from './store';
import type { Transcript } from './schema';

/** One JSON file per case: <dir>/<caseId>.json, written atomically, never overwritten with different content. */
export class FileTranscriptStore implements TranscriptStore {
  constructor(readonly dir: string) {}

  #path(caseId: string): string {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(caseId)) throw new Error(`Invalid caseId ${caseId}`);
    return join(this.dir, `${caseId}.json`);
  }

  async get(caseId: string): Promise<Transcript | null> {
    let text: string;
    try {
      text = await readFile(this.#path(caseId), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    return loadTranscript(JSON.parse(text), caseId);
  }

  async put(t: Transcript): Promise<void> {
    const existing = await this.get(t.caseId);
    if (existing) {
      if (existing.contentHash === t.contentHash) return;
      throw new TranscriptIntegrityError(t.caseId, `A different transcript is already stored for ${t.caseId}`);
    }
    await mkdir(this.dir, { recursive: true });
    const path = this.#path(t.caseId);
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(t, null, 2)}\n`, 'utf8');
    await rename(tmp, path);
  }
}

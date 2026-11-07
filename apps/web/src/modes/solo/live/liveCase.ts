import type { Hex } from '@cringe-court/core';
import { keccak256, stringToBytes } from 'viem';
import { backendClient } from '@/platform/backend';
import { platformConfig } from '@/platform/config';
import type { CourtLine } from '@cringe-court/core';

const DRAFT_KEY = 'cc:solo:draft';
const CASE_KEY = 'cc:solo:case:';
const TITLE_MAX = 60;

export interface Confession {
  title: string;
  story: string;
}

export interface LiveCase extends Confession {
  txHash: Hex;
  explorerUrl: string;
  jurors: number;
}

function read<T>(store: Storage | undefined, key: string): T | null {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(store: Storage | undefined, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: this page still works until it is closed */
  }
}

const session = () => (typeof window === 'undefined' ? undefined : window.sessionStorage);
const local = () => (typeof window === 'undefined' ? undefined : window.localStorage);

export const readDraft = () => read<Confession>(session(), DRAFT_KEY);
export const writeDraft = (c: Confession) => write(session(), DRAFT_KEY, c);
export const readCase = (n: string) => read<LiveCase>(local(), `${CASE_KEY}${n}`);
export const writeCase = (n: string, c: LiveCase) => write(local(), `${CASE_KEY}${n}`, c);

/** What the court calls every case. The judge says it aloud, so it cannot be the whole confession. */
export const CASE_TITLE = 'The Public Confession';

/** The first sentence, for headings. The player only ever writes one thing. */
export function titleFrom(story: string): string {
  const first = story.trim().split(/(?<=[.!?])\s/)[0] ?? story;
  if (first.length <= TITLE_MAX) return first.replace(/[.!?]+$/, '');
  return `${first.slice(0, TITLE_MAX).replace(/\s+\S*$/, '')}…`;
}

/** The same hash the server recomputes: the stake commits to this exact confession. */
export const confessionHash = ({ title, story }: Confession): Hex => keccak256(stringToBytes(`${title}\n${story}`));

function client() {
  const config = platformConfig.backend;
  if (!config) throw new Error('This build has no court server.');
  return backendClient(config);
}

export async function screenConfession(c: Confession): Promise<{ ok: true } | { ok: false; message: string }> {
  const api = client();
  await api.connect();
  return api.connection.post('/api/v1/solo/screen', c);
}

export type JuryChoice = 0 | 1;
export interface JurorView {
  seat: number;
  name: string;
  bio: string;
  address: Hex;
  seatTx: Hex | null;
  committed: boolean;
  choice: JuryChoice | null;
  line: string | null;
  revealTx: Hex | null;
}
export interface JuryStatus {
  caseId: string;
  stage: 'seating' | 'seated' | 'open' | 'deliberating' | 'sealing' | 'revealing' | 'finalizing' | 'final' | 'failed';
  jurors: JurorView[];
  openTx: Hex | null;
  finalizeTx: Hex | null;
  outcome: 'GUILTY' | 'NOT_COOKED' | 'NO_VERDICT' | null;
  announcement: string | null;
  quip: string | null;
  source: 'model' | 'template' | null;
  requestIds: string[];
  error: string | null;
}

/** The demo jury's next step on Arc, or null when this server has none. */
export async function juryStep(c: LiveCase, step: 'seat' | 'open' | 'vote' | 'status'): Promise<JuryStatus | null> {
  try {
    const api = client();
    await api.connect();
    return await api.connection.post<JuryStatus>('/api/v1/solo/jury', { step, txHash: c.txHash, title: c.title, story: c.story });
  } catch (e) {
    if ((e as { code?: string }).code === 'disabled' || !platformConfig.backend) return null;
    throw e;
  }
}

const POLL_MS = 2500;
const GIVE_UP_MS = 3 * 60 * 1000;

/** The trial is written on the server while this waits. A dropped request just asks again. */
export async function fetchTrial(c: LiveCase, alive: () => boolean): Promise<CourtLine[] | null> {
  const api = client();
  await api.connect();
  const deadline = Date.now() + GIVE_UP_MS;
  let lastError: unknown = new Error('The court took too long.');
  while (alive() && Date.now() < deadline) {
    try {
      const r = await api.connection.post<{ ok: true; lines: CourtLine[] } | { ok: 'writing' }>('/api/v1/solo/trial', { txHash: c.txHash, title: c.title, story: c.story });
      if (r.ok === true) return r.lines;
    } catch (e) {
      // Only a clear refusal is final. Anything else is a blip, and this player has already paid.
      const code = (e as { code?: string }).code;
      if (code === 'forbidden' || code === 'bad-request' || code === 'disabled') throw e;
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  if (!alive()) return null;
  throw lastError;
}

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

/** The first few words make the case title, so the player only ever writes one thing. */
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

export async function fetchTrial(c: LiveCase): Promise<CourtLine[]> {
  const api = client();
  await api.connect();
  const r = await api.connection.post<{ lines: CourtLine[] }>('/api/v1/solo/trial', { txHash: c.txHash, title: c.title, story: c.story });
  return r.lines;
}

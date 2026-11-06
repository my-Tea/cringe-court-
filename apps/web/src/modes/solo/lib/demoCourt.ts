/**
 * The demo court: every port the Solo flow needs, wired to the in-browser
 * twins (D14: testnet demo, labelled everywhere it matters).
 *   counsel  DemoCounsel (scripted, stands in for 0G Compute)
 *   chain    MemoryChain (twin of the Arc court contract, exact settlement)
 *   jury     three NPC jurors posting real bonds and commit–reveal ballots
 *   identity MockIdentity (stands in for World IDKit)
 * A real build swaps these for the 0G / Arc / World adapters behind the same ports.
 */
import { usdc, type AudioPort, type Hex } from '@cringe-court/core';
import { MemoryChain, MemorySaltVault, testAddress } from '@cringe-court/core/testing';
import { createMockIdentity } from '@/platform/identity/mockIdentity';
import { soloAudioPort } from './sound';
import { DemoCounsel, NpcJury, SoloSession, TeaserQuota, fromJson, memoryQuotaStore, toJson, type QuotaStore, type SoloSnapshot } from '@cringe-court/modes-solo';

/** Wall-clock seconds plus a demo offset, so "skip to the deadline" works and countdowns stay live. */
export class DemoClock {
  #offset = 0;
  now = (): number => Math.floor(Date.now() / 1000) + this.#offset;
  advanceTo = (t: number): void => {
    const now = this.now();
    if (t > now) this.#offset += t - now;
  };
}

export const DEMO_FAUCET = '10';

export interface DemoCourt {
  clock: DemoClock;
  chain: MemoryChain;
  filer: Hex;
  counsel: DemoCounsel;
  jury: NpcJury;
  teasers: TeaserQuota;
  audio: AudioPort;
  /** The case being filed or tried in this tab, if any. */
  session: SoloSession | null;
  startSession(): SoloSession;
  dropSession(): void;
}

export interface DemoCourtOptions {
  latencyMs?: number;
  store?: QuotaStore;
}

function browserStore(): QuotaStore {
  try {
    const ls = window.localStorage;
    return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v) };
  } catch {
    return memoryQuotaStore();
  }
}

export function createDemoCourt(options: DemoCourtOptions = {}): DemoCourt {
  const clock = new DemoClock();
  const chain = new MemoryChain({ clock: clock.now, firstCase: 69 });
  const filer = testAddress('demo-filer');
  chain.mint(filer, usdc(DEMO_FAUCET));
  const accounts = ['tina', 'chad', 'grandma'].map((n) => testAddress(`npc-juror-${n}`));
  accounts.forEach((a) => chain.mint(a, usdc('5')));
  const counsel = new DemoCounsel({ latencyMs: options.latencyMs ?? 900 });
  const salts = new MemorySaltVault();
  const jury = new NpcJury({
    chainFor: (a) => chain.as(a),
    nullifierFor: async (a, n) => {
      const r = await createMockIdentity(a).requestProof({ action: 'accept-jury-seat', signal: `case:${n}:seat` });
      if (!r.ok) throw new Error(r.message);
      return r.proof.nullifierHash;
    },
    salts,
    now: clock.now,
    accounts,
  });
  const teasers = new TeaserQuota(options.store ?? browserStore(), clock.now);
  const court: DemoCourt = {
    clock,
    chain,
    filer,
    counsel,
    jury,
    teasers,
    audio: soloAudioPort,
    session: null,
    startSession() {
      court.session = new SoloSession({ counsel, chain: chain.as(filer), clock, jury, teasers }, { filer, demo: true });
      return court.session;
    },
    dropSession() {
      court.session = null;
    },
  };
  return court;
}

let current: DemoCourt | null = null;

export function demoCourt(): DemoCourt {
  current ??= createDemoCourt();
  return current;
}

/** Tests: start from a fresh court. */
export function resetDemoCourt(options: DemoCourtOptions = {}): DemoCourt {
  current = createDemoCourt(options);
  return current;
}

/* ── Docket: decided cases, kept in this browser ── */

const DOCKET_KEY = 'cc:solo:docket';
const DOCKET_MAX = 24;

export interface DocketEntry {
  id: string;
  savedAt: number;
  snapshot: SoloSnapshot;
}

export function readDocket(): readonly DocketEntry[] {
  try {
    const raw = window.localStorage.getItem(DOCKET_KEY);
    const list = raw ? fromJson<DocketEntry[]>(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveToDocket(snapshot: SoloSnapshot): void {
  const t = snapshot.trial;
  if (t.stage !== 'verdict' && t.stage !== 'share') return;
  const entry: DocketEntry = { id: t.id, savedAt: Date.now(), snapshot: { ...snapshot, busy: null, error: null } };
  const next = [entry, ...readDocket().filter((e) => e.id !== t.id)].slice(0, DOCKET_MAX);
  try {
    window.localStorage.setItem(DOCKET_KEY, toJson(next));
  } catch {
    // Storage full or blocked: the case still shows for this visit.
  }
}

export function docketEntry(id: string): DocketEntry | null {
  return readDocket().find((e) => e.id === id) ?? null;
}

/* ── Filing draft autosave ── */

const DRAFT_KEY = 'cc:solo:draft';

export function loadDraftText<T>(fallback: T): T {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveDraftText(value: unknown): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
  } catch {
    // Ignore: autosave is a convenience.
  }
}

export function clearDraftText(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore.
  }
}

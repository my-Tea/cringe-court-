/**
 * The demo courts keep their cases, drafts, personas and sealed ballots in this
 * browser only. These helpers list and clear them, leaving player preferences
 * (sound, motion) alone.
 */
import type { MessageKey } from '@/i18n';

export interface DemoDataGroup {
  prefix: string;
  /** Catalog key for the group's description. */
  label: MessageKey;
}

export const DEMO_DATA_GROUPS: readonly DemoDataGroup[] = [
  { prefix: 'cc:solo:', label: 'shell.demoData.group.solo' },
  { prefix: 'cc:versus:', label: 'shell.demoData.group.versus' },
  { prefix: 'cc:gj:', label: 'shell.demoData.group.grandJury' },
];

function keysOf(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

function storages(): Storage[] {
  const out: Storage[] = [];
  try {
    out.push(window.localStorage);
  } catch {
    /* storage blocked */
  }
  try {
    out.push(window.sessionStorage);
  } catch {
    /* storage blocked */
  }
  return out;
}

/** How many stored entries each group holds right now. */
export function countDemoData(from: readonly Storage[] = storages()): Map<string, number> {
  const counts = new Map(DEMO_DATA_GROUPS.map((g) => [g.prefix, 0]));
  for (const s of from) {
    for (const k of keysOf(s)) {
      const g = DEMO_DATA_GROUPS.find((group) => k.startsWith(group.prefix));
      if (g) counts.set(g.prefix, (counts.get(g.prefix) ?? 0) + 1);
    }
  }
  return counts;
}

/** Removes every demo entry; returns how many were removed. */
export function clearDemoData(from: readonly Storage[] = storages()): number {
  let removed = 0;
  for (const s of from) {
    for (const k of keysOf(s)) {
      if (DEMO_DATA_GROUPS.some((g) => k.startsWith(g.prefix))) {
        s.removeItem(k);
        removed++;
      }
    }
  }
  return removed;
}

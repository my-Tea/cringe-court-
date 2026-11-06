import type { ModeId } from '@cringe-court/core';
import { normalizeLook, randomLook, type GateId, type PlayerLook } from '@cringe-court/scene/roam';

/**
 * What the arrival run remembers on this device: the look, whether this
 * browser has passed the World ID check, and the trial last chosen. Nothing
 * identifying is kept: only the screening result's nullifier fingerprint (the
 * same value the court already uses to keep one human to one seat).
 */
export interface PlayerProfile {
  look: PlayerLook;
  /** True once the look was confirmed at the wardrobe (a rolled look is not yet chosen). Optional. */
  dressed: boolean;
  verified: { nullifier: string; at: number } | null;
  mode: ModeId | null;
}

const KEY = 'cc:player';
const MODES: readonly ModeId[] = ['solo', 'versus', 'grand-jury'];

function fresh(): PlayerProfile {
  return { look: randomLook(Math.floor(Math.random() * 1e9)), dressed: false, verified: null, mode: null };
}

export function readProfile(storage: Storage | undefined = safeStorage()): PlayerProfile {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) {
      const p = fresh();
      writeProfile(p, storage);
      return p;
    }
    const o = JSON.parse(raw) as Partial<PlayerProfile>;
    const verified = o.verified && typeof o.verified.nullifier === 'string' && typeof o.verified.at === 'number' ? { nullifier: o.verified.nullifier, at: o.verified.at } : null;
    return {
      look: normalizeLook(o.look),
      dressed: o.dressed === true,
      verified,
      mode: MODES.includes(o.mode as ModeId) ? (o.mode as ModeId) : null,
    };
  } catch {
    return fresh();
  }
}

export function writeProfile(p: PlayerProfile, storage: Storage | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the run still works, it just is not remembered */
  }
}

/** The look confirmed at the wardrobe, if any: the trial room dresses the player in it. Never writes. */
export function savedLook(storage: Storage | undefined = safeStorage()): PlayerLook | undefined {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return undefined;
    const o = JSON.parse(raw) as Partial<PlayerProfile>;
    return o.dressed === true ? normalizeLook(o.look) : undefined;
  } catch {
    return undefined;
  }
}

/** Seals already lifted. The shrine and the wardrobe are optional; only the court needs a mode. */
export function openGatesFor(p: PlayerProfile): GateId[] {
  return p.mode ? ['verify', 'wardrobe', 'trials'] : ['verify', 'wardrobe'];
}

export type QuestStep = 'trial' | 'enter';

/** The step the player is on. Neither verifying nor dressing blocks the walk. */
export function currentStep(p: PlayerProfile): QuestStep {
  return p.mode ? 'enter' : 'trial';
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

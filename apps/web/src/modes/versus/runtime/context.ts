import type { AudioEngine } from '@cringe-court/audio';
import type { Usdc } from '@cringe-court/core';
import type { Persona, VersusDesk, WorldSnapshot } from '@cringe-court/modes-versus';
import { createContext, useContext, useSyncExternalStore } from 'react';

/** Which court this runtime plays on. */
export type CourtKind = { kind: 'local' } | { kind: 'remote'; host: string; status: string | null };

export interface VersusRuntime {
  desk: VersusDesk;
  persona: Persona;
  personas: readonly Persona[];
  switchPersona(id: string): void;
  newPersona(): void;
  /** Latest rebuilt world, or null while the first replay runs. */
  snapshot: WorldSnapshot | null;
  error: Error | null;
  /** World time, unix seconds (wall clock + demo skew). */
  now: number;
  balance: Usdc;
  /**
   * Run a command: toasts the court's message on failure, optional success toast.
   * Resolves true when the command succeeded.
   */
  run(action: () => Promise<unknown>, options?: { success?: string; quiet?: boolean }): Promise<boolean>;
  audio: AudioEngine;
  resetDemo(): void;
  court: CourtKind;
  /** Shared court only: ask the server for access to an invite (code, or signed link token). */
  openInvite?: (code: string, token?: string) => Promise<string | null>;
  /** Shared court only: the signed invite link Side A sends. */
  inviteUrl?: (trialId: string) => Promise<string>;
}

export const VersusContext = createContext<VersusRuntime | null>(null);

export function useVersus(): VersusRuntime {
  const ctx = useContext(VersusContext);
  if (!ctx) throw new Error('useVersus must be used inside <VersusProvider>');
  return ctx;
}

/** Live audio settings (mute toggle). */
export function useAudioSnapshot(audio: AudioEngine) {
  return useSyncExternalStore(audio.subscribe, audio.getSnapshot, audio.getSnapshot);
}

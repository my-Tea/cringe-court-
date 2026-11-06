import type { AudioEngine } from '@cringe-court/audio';
import type { Usdc } from '@cringe-court/core';
import type { Persona, VersusDesk, WorldSnapshot } from '@cringe-court/modes-versus';
import { createContext, useContext, useSyncExternalStore } from 'react';

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

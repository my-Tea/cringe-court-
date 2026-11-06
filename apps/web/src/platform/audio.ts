/**
 * The app-wide sound system: ONE shared AudioEngine (one AudioContext, one
 * settings store) used by every mode, the demo court and the settings UI.
 *
 * - Lazily created on first use, persisted under `cc:audio` (the package's
 *   localStorageStore), unlock handlers attached once on the document.
 * - SSR / no-WebAudio safe: without an AudioContext the engine reports
 *   `unavailable` and every call is a silent no-op.
 * - `reduceSound: 'system'` follows the app's motion preference
 *   (see <AudioMotionBridge/>), not only the OS media query.
 */
import type { AudioCueId, AudioPort } from '@cringe-court/core';
import {
  PHASE_AMBIENCE,
  isCueId,
  type CueId,
  SETTINGS_STORAGE_KEY,
  createAudioEngine,
  localStorageStore,
  type AudioEngine,
  type AudioSnapshot,
  type CaseAudioEvent,
  type CourtPhase,
} from '@cringe-court/audio';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useReducedMotion } from '@/ds/motion/MotionProvider';
import { AUDIO_CUE_MAP } from '@/stage/audioCues';

let engine: AudioEngine | null = null;

/** The shared engine. Never throws; a no-op engine where Web Audio is missing. */
export function appAudio(): AudioEngine {
  if (!engine) {
    engine = createAudioEngine({ store: localStorageStore(SETTINGS_STORAGE_KEY) });
    engine.attachUnlock();
  }
  return engine;
}

/** Test seam: swap (or clear) the shared engine. Pass `null` to reset to lazy creation. */
export function __setAppAudioForTests(next: AudioEngine | null): void {
  engine = next;
}

/** Fire a case moment through the shared engine. Silent while locked, muted or reduced. */
export function caseCue(event: CaseAudioEvent): void {
  appAudio().handle(event);
}

/** Live engine snapshot (state, settings, reduced, ambience) for React. */
export function useAudioSettings(): AudioSnapshot {
  const e = appAudio();
  return useSyncExternalStore(e.subscribe, e.getSnapshot, e.getSnapshot);
}

/** Feeds the app's effective reduced-motion state into the engine, so Reduce sound "system" follows it. Render once. */
export function AudioMotionBridge(): null {
  const reduced = useReducedMotion();
  useEffect(() => {
    appAudio().setSystemReduced(reduced);
  }, [reduced]);
  return null;
}

/**
 * Fires `phase.entered` when the case phase changes (never on every render).
 * The first observed phase only sets the ambience bed (no stinger for a case
 * you merely opened); the bed is switched off when the case view unmounts.
 */
export function usePhaseCue(phase: CourtPhase | null, audio: AudioEngine = appAudio()): void {
  const last = useRef<CourtPhase | null>(null);
  useEffect(() => {
    if (phase === null || last.current === phase) return;
    if (last.current === null) audio.setAmbience(PHASE_AMBIENCE[phase]);
    else audio.handle({ type: 'phase.entered', phase });
    last.current = phase;
  }, [phase, audio]);
  useEffect(
    () => () => {
      last.current = null;
      audio.setAmbience('off');
    },
    [audio],
  );
}

/**
 * Fires `deadline.tick` once per whole second as the deadline approaches
 * (warning at 30 s, ticks for the last 10, the expiry chime at 0). Nothing
 * fires for the first observation, so opening an old case stays silent.
 */
export function useDeadlineCues(endsAtMs: number | null, nowMs: number, audio: AudioEngine = appAudio()): void {
  const last = useRef<number | null>(null);
  const secondsLeft = endsAtMs === null ? null : Math.ceil((endsAtMs - nowMs) / 1000);
  useEffect(() => {
    if (secondsLeft === null) {
      last.current = null;
      return;
    }
    const prev = last.current;
    last.current = secondsLeft;
    if (prev === null || prev === secondsLeft || secondsLeft < 0 || prev < secondsLeft) return;
    audio.handle({ type: 'deadline.tick', secondsLeft });
  }, [secondsLeft, audio]);
}

/** Fires `event` once each time `key` changes after the first render (a transition, not a state). */
export function useChangeCue<K>(key: K, event: (key: K, prev: K) => CaseAudioEvent | null, audio: AudioEngine = appAudio()): void {
  const prev = useRef<{ key: K } | null>(null);
  const make = useRef(event);
  make.current = event;
  useEffect(() => {
    const p = prev.current;
    prev.current = { key };
    if (!p || Object.is(p.key, key)) return;
    const e = make.current(key, p.key);
    if (e) audio.handle(e);
  }, [key, audio]);
}

/** Core cue vocabulary → the audio engine's recipes: the shared map from the stage layer. Nulls stay silent. */
export const CUE_MAP: Readonly<Partial<Record<AudioCueId, CueId>>> = Object.fromEntries(
  Object.entries(AUDIO_CUE_MAP).filter((e): e is [AudioCueId, CueId] => e[1] !== null && isCueId(e[1])),
);

const noop = { stop: () => {} };

/** core AudioPort over the shared engine, for transcript cues (solo courtroom, demo court). Silent until sound is on. */
export const appAudioPort: AudioPort = {
  id: 'web-audio',
  unlock: async () => {
    await appAudio().unlock();
  },
  play(cue, options) {
    const id = CUE_MAP[cue];
    if (!id) return noop;
    const h = appAudio().play(id, options?.pan !== undefined ? { pan: options.pan } : {});
    return { stop: (fade?: number) => h?.stop(fade) };
  },
  loop: () => noop,
  setVolume: () => {},
  setMuted: (muted) => appAudio().setMuted(muted),
  stopAll: () => appAudio().stopAll(),
};

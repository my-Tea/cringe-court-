export { AudioEngine, createAudioEngine } from './engine.ts';
export type { AudioEngineOptions, AudioSnapshot, EngineState, PlayHandle, PlayOptions, Timers } from './engine.ts';
export { CUES, CUE_IDS, CUE_CATEGORIES, isCueId } from './cues.ts';
export type { CueCategory, CueId, CueSpec, ReducedBehavior } from './cues.ts';
export { AMBIENCE_LEVELS, AMBIENCE_PRESETS } from './ambience.ts';
export type { AmbiencePreset } from './ambience.ts';
export {
  ANIMATION_SOUND_CUES,
  BENCH_PAN,
  PHASE_AMBIENCE,
  VERDICT_CUE,
  cueForAnimationSound,
  cuesForEvent,
} from './events.ts';
export type {
  AnimationSoundLabel,
  Bench,
  CaseAudioEvent,
  CourtPhase,
  CrowdReaction,
  EventSound,
  ScheduledCue,
  VerdictOutcome,
} from './events.ts';
export {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SLIDER_RANGE_DB,
  dbToGain,
  localStorageStore,
  memoryStore,
  normalizeSettings,
  sliderToGain,
} from './settings.ts';
export type { AudioSettings, ReduceSoundPreference, SettingsStore, VolumeChannel } from './settings.ts';
export { analyse, encodeWav, renderAmbience, renderCue } from './render.ts';
export type { BufferStats, OfflineContextCtor, RenderOptions } from './render.ts';

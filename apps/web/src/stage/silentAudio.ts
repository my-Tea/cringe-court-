import type { AudioPort } from '@cringe-court/core';

/**
 * Until @cringe-court/audio (v3/audio) is merged, the stage runs silent. Same
 * port, so swapping in the Web Audio adapter is a one-line change at startup.
 */
export const silentAudio: AudioPort = {
  id: 'silent',
  unlock: async () => {},
  play: () => ({ stop: () => {} }),
  loop: () => ({ stop: () => {} }),
  setVolume: () => {},
  setMuted: () => {},
  stopAll: () => {},
};

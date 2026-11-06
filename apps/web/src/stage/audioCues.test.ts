import { AUDIO_CUES } from '@cringe-court/core';
import { AUDIO_CUE_MAP } from './audioCues';

// The audio package's cue ids as of v3/audio (packages/audio/src/cues.ts).
const AUDIO_PACKAGE_CUES = new Set([
  'gavel_strike', 'gavel_triple', 'objection', 'crowd_murmur', 'crowd_laugh', 'crowd_gasp', 'crowd_applause', 'verdict_guilty',
  'verdict_not_cooked', 'verdict_decided', 'verdict_none', 'vote_tick', 'ballot_seal', 'ballot_unlock', 'timer_warning', 'timer_tick',
  'timer_expired', 'stamp', 'paper', 'coin', 'door_creak', 'ui_click', 'ui_hover', 'ui_toggle', 'ui_toast', 'ui_confirm', 'ui_error',
]);

describe('core → audio cue map', () => {
  it('covers every core cue and only names cues the audio package has', () => {
    expect(Object.keys(AUDIO_CUE_MAP).sort()).toEqual([...AUDIO_CUES].sort());
    for (const target of Object.values(AUDIO_CUE_MAP)) if (target !== null) expect(AUDIO_PACKAGE_CUES).toContain(target);
  });
});

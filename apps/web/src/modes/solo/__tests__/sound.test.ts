import { AUDIO_CUES } from '@cringe-court/core';
import { isCueId } from '@cringe-court/audio';
import { CUE_MAP, soloAudioPort, soundOn } from '../lib/sound';

describe('Solo sound bridge', () => {
  it('maps core cues onto real audio-engine recipes', () => {
    for (const [core, sfx] of Object.entries(CUE_MAP)) {
      expect(AUDIO_CUES).toContain(core);
      expect(isCueId(sfx)).toBe(true);
    }
    expect(CUE_MAP['stinger.objection']).toBe('objection');
  });

  it('stays silent until the user turns sound on (jsdom has no Web Audio)', () => {
    expect(soundOn()).toBe(false);
    expect(() => soloAudioPort.play('sfx.gavel').stop()).not.toThrow();
  });
});

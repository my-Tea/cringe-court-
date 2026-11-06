/**
 * Deterministic twins of every port (`@cringe-court/core/testing`). Used by
 * tests, the gallery, offline demos and the "demo court" build. They are full
 * implementations of the port contracts, not stubs: the memory chain enforces
 * phases, deadlines, commit–reveal and exact settlement.
 */
import type { CourtPorts } from '../ports';
import { FixtureCounsel, type FixtureCounselOptions } from './counsel';
import { ManualClock, MemoryChain } from './chain';
import { MemorySaltVault, MockIdentity, MockJury } from './people';
import { RecordingAudio, RecordingScene } from './stage';

export * from './counsel';
export * from './chain';
export * from './people';
export * from './stage';

export interface MockPorts extends CourtPorts {
  counsel: FixtureCounsel;
  chain: MemoryChain;
  jury: MockJury;
  identity: MockIdentity;
  salts: MemorySaltVault;
  audio: RecordingAudio;
  scene: RecordingScene;
  clock: ManualClock;
}

export function createMockPorts(options: { counsel?: FixtureCounselOptions; clock?: ManualClock; firstCase?: number } = {}): MockPorts {
  const clock = options.clock ?? new ManualClock();
  return {
    counsel: new FixtureCounsel(options.counsel),
    chain: new MemoryChain({ clock: clock.now, firstCase: options.firstCase ?? 69 }),
    jury: new MockJury(clock.now),
    identity: new MockIdentity(),
    salts: new MemorySaltVault(),
    audio: new RecordingAudio(),
    scene: new RecordingScene(),
    clock,
  };
}

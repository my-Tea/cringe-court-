export * from './court';
export * from './counsel';
export * from './chain';
export * from './people';
export * from './stage';

import type { AiCounselPort } from './counsel';
import type { ChainPort } from './chain';
import type { IdentityPort, JuryPort, SaltVault } from './people';
import type { AudioPort, ScenePort } from './stage';

/** Every port the engine runs with. Chosen once at startup (ARCHITECTURE §3 rule 2). */
export interface CourtPorts {
  counsel: AiCounselPort;
  chain: ChainPort;
  jury: JuryPort;
  identity: IdentityPort;
  salts: SaltVault;
  audio: AudioPort;
  scene: ScenePort;
}

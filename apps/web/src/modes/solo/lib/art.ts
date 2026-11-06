/**
 * Solo-only art: the voxel courtroom renders (cc-art/dist/scene) and the seated
 * gallery NPCs used for the demo jury. Resolved at build time like src/art/art.ts.
 */
import type { CameraShot } from '@cringe-court/core';

const sceneFiles = import.meta.glob<string>('@art/scene/pov_{well,jury}.png', { eager: true, query: '?url', import: 'default' });
const npcFiles = import.meta.glob<string>('@art/characters/gallery/npc0{3,4,7}/threeq@2x.png', { eager: true, query: '?url', import: 'default' });

function find(files: Record<string, string>, suffix: string): string {
  for (const [path, url] of Object.entries(files)) if (path.endsWith(suffix)) return url;
  throw new Error(`Missing Solo art: ${suffix}`);
}

export type SetName = 'well' | 'jury';

/** Which voxel render backs a camera shot. Close-ups reuse the wide set and zoom. */
export function setFor(camera: CameraShot): SetName {
  if (camera === 'close_jury') return 'jury';
  return 'well';
}

export function sceneArt(set: SetName): string {
  return find(sceneFiles, `/scene/pov_${set}.png`);
}

/** Demo juror sprites, by persona id (NPC_PERSONAS). */
const NPC_SPRITE: Readonly<Record<string, string>> = {
  'touch-grass-tina': 'npc03',
  'chronically-online-chad': 'npc07',
  'grandma-wifi': 'npc04',
};

export function jurorArt(personaId: string): string {
  const npc = NPC_SPRITE[personaId] ?? 'npc03';
  return find(npcFiles, `/gallery/${npc}/threeq@2x.png`);
}

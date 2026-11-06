/** Fetch and assemble everything the roam world needs (courtroom boxes + voxel cast). */
import { COURTROOM_URLS } from '../assets';
import { parseBoxes } from '../courtroom/geometry';
import { fetchJson, type JsonFetcher } from '../load';
import { parseCast, type CastFile } from './cast';
import type { RoamWorld } from './types';
import { buildRoamWorld, type RoamBox } from './world';

export const ROAM_URLS = {
  cast: new URL('../../assets/roam/cast.json', import.meta.url).href,
  boxes: COURTROOM_URLS.boxes,
} as const;

export interface RoamData {
  world: RoamWorld & { boxes: readonly RoamBox[] };
  cast: CastFile;
}

export async function loadRoamData(fetcher: JsonFetcher = fetchJson, signal?: AbortSignal): Promise<RoamData> {
  const [boxes, cast] = await Promise.all([fetcher(ROAM_URLS.boxes, signal), fetcher(ROAM_URLS.cast, signal)]);
  const parsedCast = parseCast(cast);
  return { world: buildRoamWorld({ courtroom: parseBoxes(boxes), cast: parsedCast }), cast: parsedCast };
}

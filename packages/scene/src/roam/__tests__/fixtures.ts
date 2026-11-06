import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBoxes } from '../../courtroom/geometry';
import { parseCast } from '../cast';
import type { RoamData } from '../load';
import { buildRoamWorld } from '../world';

// Paths from this file, not `new URL(…, import.meta.url)`: under the jsdom
// environment Vite rewrites those into dev-server asset URLs.
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(resolve(here, rel), 'utf8')) as unknown;

let cached: Promise<RoamData> | null = null;
/** The real world, built from the generated courtroom and cast exactly as loadRoamData does. */
export function roamData(): Promise<RoamData> {
  cached ??= Promise.resolve().then(() => {
    const cast = parseCast(read('../../../assets/roam/cast.json'));
    return { world: buildRoamWorld({ courtroom: parseBoxes(read('../../../../../cc-art/dist/scene/courtroom.boxes.json')), cast }), cast };
  });
  return cached;
}

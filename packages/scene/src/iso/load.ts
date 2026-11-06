/**
 * Loading the town: fetch the two prop libraries and hand back a controller.
 *
 * Mirrors `roam/load.ts`: the fetcher is injected so the same code runs against
 * the network in the app and against `readFileSync` in tests.
 */
import { TOWN_URLS } from '../assets';
import type { CastFile } from '../roam/cast';
import { IsoController, type IsoControllerOptions } from './controller';
import { mergeLibraries, type PropLibraryFile } from './library';
import { TOWN_DIALOGUE, TOWN_NOTES } from './maps/dialogue';
import { TOWN_MAPS } from './maps/town';
import type { TownBox } from './world';

export interface TownData {
  /** Merged prop + building geometry, keyed by name. */
  library: Readonly<Record<string, readonly TownBox[]>>;
  controller: IsoController;
}

export type Fetcher = (url: string) => Promise<unknown>;

const defaultFetch: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iso: ${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as unknown;
};

export interface LoadTownOptions {
  fetcher?: Fetcher;
  /** Override the starting map / spawn. */
  start?: IsoControllerOptions['start'];
  spawn?: string;
  /** Display names for speakers that are not NPCs. */
  speakerNames?: Readonly<Record<string, string>>;
  reducedMotion?: boolean;
}

/**
 * Read both libraries, merge them, and build a controller on the whole town.
 *
 * Names are gathered from every map so the HUD can label a speaker even when
 * they are standing on another map.
 */
export async function loadTownData(cast: CastFile, options: LoadTownOptions = {}): Promise<TownData> {
  const fetcher = options.fetcher ?? defaultFetch;
  const [props, buildings] = await Promise.all([fetcher(TOWN_URLS.props), fetcher(TOWN_URLS.buildings)]);
  const library = mergeLibraries(props as PropLibraryFile, buildings as PropLibraryFile);

  const npcNames: Record<string, string> = {};
  for (const spec of Object.values(TOWN_MAPS)) {
    for (const npc of spec.npcs ?? []) npcNames[npc.id] = npc.name;
  }

  const controller = new IsoController({
    maps: TOWN_MAPS,
    library,
    dialogue: TOWN_DIALOGUE,
    start: options.start ?? 'square',
    ...(options.spawn ? { spawn: options.spawn } : {}),
    npcNames,
    notes: TOWN_NOTES,
    ...(options.speakerNames ? { speakerNames: options.speakerNames } : {}),
    reducedMotion: options.reducedMotion ?? false,
  });

  // The cast is validated here rather than in the renderer, so a missing model
  // fails at load with a useful message instead of drawing an empty group.
  for (const spec of Object.values(TOWN_MAPS)) {
    for (const npc of spec.npcs ?? []) {
      if (!cast.models[npc.model]) throw new Error(`iso: npc "${npc.id}" wants cast model "${npc.model}", which is not in cast.json`);
    }
  }

  return { library, controller };
}

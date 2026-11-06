/** Load and validate every data file the courtroom needs. */
import { parseAnimationLibrary, type AnimationLibrary } from './anim/library';
import { COURTROOM_URLS } from './assets';
import { parseAtlasManifest, type AtlasManifest } from './atlas';
import { parseBoxes, type Box } from './courtroom/geometry';
import { parseLayout, type CourtroomLayout } from './courtroom/layout';

export interface CourtroomData {
  boxes: readonly Box[];
  layout: CourtroomLayout;
  animations: AnimationLibrary;
  atlas: AtlasManifest;
}

export type JsonFetcher = (url: string, signal?: AbortSignal) => Promise<unknown>;

export const fetchJson: JsonFetcher = async (url, signal) => {
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
  return res.json();
};

export async function loadCourtroomData(fetcher: JsonFetcher = fetchJson, signal?: AbortSignal): Promise<CourtroomData> {
  const [boxes, layout, animations, atlas] = await Promise.all([
    fetcher(COURTROOM_URLS.boxes, signal),
    fetcher(COURTROOM_URLS.layout, signal),
    fetcher(COURTROOM_URLS.animations, signal),
    fetcher(COURTROOM_URLS.atlas, signal),
  ]);
  return { boxes: parseBoxes(boxes), layout: parseLayout(layout), animations: parseAnimationLibrary(animations), atlas: parseAtlasManifest(atlas) };
}

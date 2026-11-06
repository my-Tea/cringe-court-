/**
 * The town's prop library: the geometry the map author places.
 *
 * Two sources, both already authored, neither regenerated here:
 * - `cc-art/dist/town/props.json` — the 53 props from `cc-art/props.mjs`
 *   (fountain, benches, market stall, trees, barrels, bookshelves, …).
 * - `cc-art/dist/town/buildings.json` — the town architecture from
 *   `cc-art/town-buildings.mjs` (courthouse, tavern, archive, market hall,
 *   townhouse, well, fence, lamp, stall, bunting, cart, awning).
 *
 * The renderer merges geometry by material, so a bigger library costs memory,
 * not draw calls. Values are world units on the town grid (one cell = 28).
 */
import type { TownBox } from './world';

export interface PropLibraryFile {
  schemaVersion: number;
  source: string;
  cell: number;
  props: Record<string, TownBox[]>;
  meta: Record<string, { label: string; boxes: number; size: readonly number[]; floating: boolean }>;
}

export class PropLibraryError extends Error {
  constructor(message: string) {
    super(`prop library: ${message}`);
    this.name = 'PropLibraryError';
  }
}

/** Validate and merge the two source files into one lookup. */
export function mergeLibraries(...files: PropLibraryFile[]): Record<string, TownBox[]> {
  const out: Record<string, TownBox[]> = {};
  for (const file of files) {
    if (!file || typeof file !== 'object') throw new PropLibraryError('expected an object');
    if (file.schemaVersion !== 1) throw new PropLibraryError(`unsupported schemaVersion ${String(file.schemaVersion)}`);
    if (!file.props || typeof file.props !== 'object') throw new PropLibraryError('missing props');
    for (const [name, boxes] of Object.entries(file.props)) {
      if (!Array.isArray(boxes)) throw new PropLibraryError(`prop "${name}" is not a box list`);
      if (name in out) throw new PropLibraryError(`duplicate prop "${name}"`);
      for (const b of boxes) {
        if (!Array.isArray(b.f) || !Array.isArray(b.t) || typeof b.m !== 'string') {
          throw new PropLibraryError(`prop "${name}" has a malformed box`);
        }
        if (b.t[0] < b.f[0] || b.t[1] < b.f[1] || b.t[2] < b.f[2]) {
          throw new PropLibraryError(`prop "${name}" has a box with t < f`);
        }
      }
      out[name] = boxes;
    }
  }
  return out;
}

/** Every building whose footprint is wider than one cell needs centring help. */
export const BUILDING_PROPS = [
  'courthouse',
  'tavern',
  'archive',
  'marketHall',
  'townhouse',
  'well',
  'fence',
  'lampStandard',
  'stall',
  'buntingRow',
  'handcart',
  'awning',
] as const;

/** Exterior dressing reused from the original prop set. */
export const EXTERIOR_PROPS = [
  'fountain',
  'lamp_post',
  'bench',
  'barrel',
  'crate',
  'tree_round',
  'tree_pine',
  'bush',
  'flower_bed',
  'signpost',
  'market_stall',
  'cart',
  'bunting',
  'potted_plant',
] as const;

/** Interior furniture reused from the courtroom dressing. */
export const INTERIOR_PROPS = [
  'bookshelf',
  'bench',
  'barrel',
  'crate',
  'trunk',
  'sconce',
  'potted_plant',
  'wall_panel',
  'column',
  'arch_window',
  'railing',
  'papers_stack',
  'exhibit_a_paper',
  'case_stamp',
  'neon_sign',
  'court_seal',
  'banner_scales',
  'evidence_screen',
  'sealed_ballot_box',
  'judge_bench',
  'throne_chair',
  'prosecutor_desk',
  'defense_desk',
  'witness_stand',
  'jury_box',
  'gallery_bench',
  'dais_step',
  'courtroom_door',
  'ceiling_ring',
  'spotlight_rig',
] as const;

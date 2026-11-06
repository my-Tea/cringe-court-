/**
 * The town: six connected locations, authored as tile grids plus prop
 * placements.
 *
 * Scale is one cell = 28 world units, so a person (50 tall) is ~1.8 cells and a
 * townhouse (65 tall) is ~2.3 cells — Minecraft proportions, which is what makes
 * the iso projection read correctly.
 *
 * Layout intent, so the world feels like a place rather than six rooms:
 *
 *   streets (north) ──── square ──── market (east)     one outdoor map
 *                          │
 *                     courthouse, tavern, archive          entered through doors
 *
 * The courthouse faces the square. A lawn runs around all four sides of the
 * facade, and the archive stands far enough east that the east side stays open.
 * The market is past that lawn. The tavern is on the west approach; the
 * residential streets wrap the north. The courtroom map is the hall plus its
 * own grounds, so leaving the room is a walk, not a loading step.
 */
import type { PropPlacement, TownMapSpec } from '../world';


/** A wall ring for an interior: solid '#' border, gaps where doors are. */
function ring(cols: number, rows: number, doors: ReadonlyArray<[number, number]>): string[] {
  const at = new Set(doors.map(([c, r]) =>`${c},${r}`));
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) && !at.has(`${c},${r}`) ? '#' : '.').join(''),
  );
}

/** Pad a row to the full width so a typo in row length is a visible, not silent, bug. */
function row(s: string, cols: number): string {
  if (s.length > cols) throw new Error(`map row longer than ${cols}: ${s.length}`);
  return s.padEnd(cols, '.');
}

const COLS = 34;

/**
 * Town square: the hub. A paved plaza with a fountain, benches and lamps, the
 * courthouse steps to the south, the market street east and the tavern west.
 */
const square: TownMapSpec = {
  id: 'square',
  name: 'Town Square',
  cols: COLS,
  rows: 56,
  mood: 'day',
  floor: [
    row('..gggggggggggggggggggggggggggggg..', COLS),
    row('.gggggggggggggggggggggggggggggggg.', COLS),
    row('ggggCCCCCCCCCCCCCCCCCCCCCCCCCCgggg', COLS),
    row('gggCCCCCCCCCCCCCCCCCCCCCCCCCCCCggg', COLS),
    row('ggCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCgg', COLS),
    row('gCCCCCCCCCCCCCssssssssCCCCCCCCCCCg', COLS),
    row('gCCCCCCCCCCssssssssssssssCCCCCCCCg', COLS),
    row('gCCCCCCCCssssssssssssssssssCCCCCCg', COLS),
    row('gCCCCCCCssssssssssssssssssssCCCCCg', COLS),
    row('gCCCCCCssssssssssssssssssssssCCCCg', COLS),
    row('gCCCCCssssssssssssssssssssssssCCCg', COLS),
    row('gCCCCCssssssssssssssssssssssssCCCg', COLS),
    row('gCCCCCssssssssssssssssssssssssCCCg', COLS),
    row('gCCCCCssssssssssssssssssssssssCCCg', COLS),
    row('gCCCCCCssssssssssssssssssssssCCCCg', COLS),
    row('gCCCCCCCssssssssssssssssssssCCCCCg', COLS),
    row('gCCCCCCCCssssssssssssssssssCCCCCCg', COLS),
    row('gCCCCCCCCCCssssssssssssssCCCCCCCCg', COLS),
    row('gCCCCCCCCCCCCCssssssssCCCCCCCCCCCg', COLS),
    row('ggCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCgg', COLS),
    row('gggCCCCCCCCCCCCCCCCCCCCCCCCCCCCggg', COLS),
    row('ggggCCCCCCCCCCCCCCCCCCCCCCCCCCgggg', COLS),
    row('.gggggddddddddddddddddddddggggggg.', COLS),
    row('..ggggddddddddddddddddddddgggggg..', COLS),
    row('...gggddddddddddddddddddddggggg...', COLS),
    row('....ggddddddddddddddddddddgggg....', COLS),
    row('....ggddddddddddddddddddddgggg....', COLS),
    row('.....CCCCCCCCCCCCCCCCCCCCCCC......', COLS),
    row('.....CCCCCCCCCCCCCCCCCCCCCCC......', COLS),
    row('.....CCCCCCCCCCCCCCCCCCCCCCC......', COLS),
    row('......CCCCCCCCCCCCCCCCCCCCC.......', COLS),
    row('......CCCCCCCCCCCCCCCCCCCCC.......', COLS),
    row('.......gggggggggggggggggggg.......', COLS),
    row('........gggggggggggggggggg........', COLS),
    // Courthouse grounds: a long lawn and a processional path south of the steps,
    // wide enough to walk around the building instead of stopping at the door.
    ...Array.from({ length: 22 }, () => row('gggggggggggggCCCCCCCCCgggggggggggg', COLS)),
  ],
  props: [
    // The fountain, dead centre of the plaza.
    { prop: 'fountain', tile: [16, 11], interact: { id: 'fountain', prompt: 'Look into the fountain', kind: 'inspect', lines: 'fountain' } },
    // Benches facing the fountain.
    { prop: 'bench', tile: [9, 11], rotY: 90 },
    { prop: 'bench', tile: [23, 11], rotY: 270 },
    { prop: 'bench', tile: [16, 5] },
    { prop: 'bench', tile: [16, 17], rotY: 180 },
    // Lamps at the plaza corners.
    { prop: 'lampStandard', tile: [6, 4] },
    { prop: 'lampStandard', tile: [27, 4] },
    { prop: 'lampStandard', tile: [6, 20] },
    { prop: 'lampStandard', tile: [27, 20] },
    // Trees and planting around the edge.
    { prop: 'tree_round', tile: [3, 9] },
    { prop: 'tree_pine', tile: [3, 14] },
    { prop: 'tree_round', tile: [30, 9] },
    { prop: 'tree_pine', tile: [30, 14] },
    { prop: 'flower_bed', tile: [11, 3] },
    { prop: 'flower_bed', tile: [21, 3] },
    { prop: 'bush', tile: [5, 2] },
    { prop: 'bush', tile: [28, 2] },
    // Bunting across the open square.
    { prop: 'bunting', tile: [16, 7], y: 44 },
    { prop: 'bunting', tile: [16, 15], y: 44 },
    // Notice board.
    { prop: 'signpost', tile: [12, 21], interact: { id: 'signpost', prompt: 'Read the town notices', kind: 'inspect', lines: 'signpost' } },
    // Real facades at the doors. The courthouse interior is its own map; this
    // is the front the player sees from the square.
    { prop: 'courthouse', tile: [16, 26] },
    { prop: 'tavern', tile: [2, 9], rotY: 90 },
    // Set back east of the courthouse so the east lawn stays open.
    { prop: 'archive', tile: [42, 24] },
    // A small produce row along the east edge, so the square feels inhabited.
    { prop: 'stall', tile: [27, 8] },
    { prop: 'stall', tile: [27, 15] },
    { prop: 'awning', tile: [24, 18] },
    { prop: 'barrel', tile: [26, 12] },
    { prop: 'crate', tile: [26, 19] },
    { prop: 'bush', tile: [30, 18] },
    { prop: 'flower_bed', tile: [8, 22] },
    { prop: 'flower_bed', tile: [22, 22] },
    { prop: 'tree_pine', tile: [11, 1] },
    { prop: 'tree_round', tile: [22, 1] },
    // Street furniture by the market entrance.
    { prop: 'crate', tile: [28, 21] },
    { prop: 'barrel', tile: [29, 22] },
    { prop: 'handcart', tile: [5, 22], rotY: 90 },
    // Grounds south of the courthouse. Kept off the centre path (cols 13–19).
    { prop: 'column', tile: [11, 36] },
    { prop: 'column', tile: [23, 36] },
    { prop: 'lampStandard', tile: [8, 38] },
    { prop: 'lampStandard', tile: [26, 38] },
    { prop: 'lampStandard', tile: [8, 48] },
    { prop: 'lampStandard', tile: [26, 48] },
    { prop: 'tree_round', tile: [4, 40] },
    { prop: 'tree_pine', tile: [30, 40] },
    { prop: 'tree_round', tile: [5, 50] },
    { prop: 'tree_pine', tile: [29, 50] },
    { prop: 'bench', tile: [9, 44], rotY: 90 },
    { prop: 'bench', tile: [25, 44], rotY: 270 },
    { prop: 'flower_bed', tile: [10, 42] },
    { prop: 'flower_bed', tile: [24, 42] },
    { prop: 'flower_bed', tile: [10, 52] },
    { prop: 'flower_bed', tile: [24, 52] },
    { prop: 'bush', tile: [3, 46] },
    { prop: 'bush', tile: [31, 46] },
    { prop: 'potted_plant', tile: [12, 36] },
    { prop: 'potted_plant', tile: [22, 36] },
  ],
  portals: [
    { id: 'to-tavern', tile: [4, 12], to: 'tavern', spawn: 'from-square', prompt: 'Enter the tavern', style: 'door' },
    { id: 'to-archive', tile: [42, 28], to: 'archive', spawn: 'from-square', prompt: 'Enter the evidence archive', style: 'door' },
    { id: 'to-courthouse', tile: [16, 30], to: 'courthouse', spawn: 'forecourt', prompt: 'Climb the courthouse steps', style: 'stairs' },
  ],
  npcs: [
    { id: 'vera', name: 'Vera', model: 'clerk', tile: [13, 8], yaw: 2.2, lines: 'vera' },
    { id: 'gus', name: 'Gus', model: 'bailiff', tile: [21, 13], yaw: -2.4, lines: 'gus' },
    { id: 'mara', name: 'Mara', model: 'juror', tile: [19, 6], yaw: 3.0, lines: 'mara' },
    { id: 'clem', name: 'Clem', model: 'juror-a', tile: [8, 16], yaw: 0.7, lines: 'clem' },
  ],
  spawns: {
    'from-square': { tile: [16, 20], yaw: 0 },
    'from-courthouse': { tile: [16, 46], yaw: Math.PI },
    'from-market': { tile: [31, 11], yaw: Math.PI / 2 },
    'from-tavern': { tile: [3, 12], yaw: Math.PI / 2 },
    'from-archive': { tile: [42, 31], yaw: 0 },
    'from-streets': { tile: [16, 3], yaw: Math.PI },
  },
  defaultSpawn: 'from-square',
  lights: [
    { tile: [6, 4], y: 40, kind: 'warm' },
    { tile: [27, 4], y: 40, kind: 'warm' },
    { tile: [6, 20], y: 40, kind: 'warm' },
    { tile: [27, 20], y: 40, kind: 'warm' },
    { tile: [8, 38], y: 40, kind: 'warm' },
    { tile: [26, 38], y: 40, kind: 'warm' },
    { tile: [8, 48], y: 40, kind: 'warm' },
    { tile: [26, 48], y: 40, kind: 'warm' },
  ],
};

/**
 * Market: a tight street of stalls under awnings, running north–south.
 */
const market: TownMapSpec = {
  id: 'market',
  name: 'Market Row',
  cols: 20,
  rows: 28,
  mood: 'day',
  floor: [
    row('ggggCCCCCCCCCCgggg', 20),
    row('gggCCCCCCCCCCCCgggg', 20),
    row('ggCCCCCCCCCCCCCCggg', 20),
    row('gCCCCCCCCCCCCCCCCgg', 20),
    row('gCCCCCCCCCCCCCCCCgg', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('CCCCCCCCCCCCCCCCCCCC', 20),
    row('gCCCCCCCCCCCCCCCCgg', 20),
    row('ggCCCCCCCCCCCCCCggg', 20),
    row('gggCCCCCCCCCCCCgggg', 20),
    row('ggggCCCCCCCCCCggggg', 20),
    row('gggggCCCCCCCCgggggg', 20),
  ],
  props: [
    // The market hall anchors the north end.
    { prop: 'marketHall', tile: [10, 2] },
    // Two rows of stalls down the street, awnings alternating colour.
    { prop: 'stall', tile: [5, 8] },
    { prop: 'stall', tile: [15, 8] },
    { prop: 'stall', tile: [5, 12] },
    { prop: 'stall', tile: [15, 12] },
    { prop: 'stall', tile: [5, 16] },
    { prop: 'stall', tile: [15, 16] },
    { prop: 'awning', tile: [10, 10] },
    { prop: 'awning', tile: [10, 14] },
    { prop: 'market_stall', tile: [3, 20] },
    { prop: 'market_stall', tile: [17, 20] },
    // Goods and clutter.
    { prop: 'crate', tile: [7, 9] },
    { prop: 'crate', tile: [13, 9] },
    { prop: 'barrel', tile: [7, 13] },
    { prop: 'barrel', tile: [13, 13] },
    { prop: 'handcart', tile: [10, 22] },
    { prop: 'bunting', tile: [10, 6], y: 46 },
    { prop: 'bunting', tile: [10, 18], y: 46 },
    { prop: 'lampStandard', tile: [2, 8] },
    { prop: 'lampStandard', tile: [18, 8] },
    { prop: 'lampStandard', tile: [2, 20] },
    { prop: 'lampStandard', tile: [18, 20] },
    { prop: 'signpost', tile: [17, 24], interact: { id: 'market-rules', prompt: 'Read the market rules', kind: 'inspect', lines: 'market-rules' } },
  ],
  portals: [
    { id: 'to-square', tile: [10, 27], to: 'square', spawn: 'from-market', prompt: 'Walk back to the square', style: 'arch' },
  ],
  npcs: [
    { id: 'agnes', name: 'Agnes', model: 'juror', tile: [9, 10], yaw: 2.6, lines: 'agnes' },
    { id: 'milo', name: 'Milo', model: 'side-a', tile: [12, 16], yaw: -0.6, lines: 'milo' },
    { id: 'pip', name: 'Pip', model: 'side-b', tile: [4, 15], yaw: 0.9, lines: 'pip' },
  ],
  spawns: {
    'from-square': { tile: [10, 25], yaw: Math.PI },
  },
  defaultSpawn: 'from-square',
  lights: [
    { tile: [2, 8], y: 40, kind: 'warm' },
    { tile: [18, 8], y: 40, kind: 'warm' },
    { tile: [2, 20], y: 40, kind: 'warm' },
    { tile: [18, 20], y: 40, kind: 'warm' },
  ],
};

/**
 * The evidence archive interior: shelving, a strongroom, the case files.
 */
const archive: TownMapSpec = {
  id: 'archive',
  name: 'Evidence Archive',
  cols: 16,
  rows: 14,
  mood: 'interior',
  floor: [
    row('TTTTTTTTTTTTTTTT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TFFFFFFFFFFmmFFT', 16),
    row('TFFFFFFFFFFmmFFT', 16),
    row('TFFFFFFFFFFmmFFT', 16),
    row('TFFFFFFFFFFmmFFT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TFFFFFFFFFFFFFFT', 16),
    row('TTTTTTTTTTT TTTT', 16),
  ],
  props: [
    // Shelving banks down both sides.
    { prop: 'bookshelf', tile: [2, 2], rotY: 90 },
    { prop: 'bookshelf', tile: [2, 4], rotY: 90 },
    { prop: 'bookshelf', tile: [2, 6], rotY: 90 },
    { prop: 'bookshelf', tile: [13, 2], rotY: 270 },
    { prop: 'bookshelf', tile: [13, 4], rotY: 270 },
    { prop: 'bookshelf', tile: [13, 6], rotY: 270 },
    // Evidence crates and a trunk by the strongroom.
    { prop: 'crate', tile: [11, 2] },
    { prop: 'crate', tile: [11, 3] },
    { prop: 'trunk', tile: [4, 2], interact: { id: 'strongbox', prompt: 'Open the strongbox', kind: 'inspect', lines: 'strongbox' } },
    // The evidence table at the back.
    { prop: 'evidence_screen', tile: [8, 1] },
    { prop: 'papers_stack', tile: [6, 10] },
    { prop: 'papers_stack', tile: [7, 11] },
    { prop: 'exhibit_a_paper', tile: [9, 10], interact: { id: 'exhibit-a', prompt: 'Read Exhibit A', kind: 'exhibit' } },
    { prop: 'case_stamp', tile: [10, 11] },
    // Lighting and dressing.
    { prop: 'spotlight_rig', tile: [8, 6], y: 60 },
    { prop: 'sconce', tile: [1, 4], y: 34 },
    { prop: 'sconce', tile: [14, 4], y: 34 },
    { prop: 'column', tile: [1, 1] },
    { prop: 'column', tile: [14, 1] },
    { prop: 'banner_scales', tile: [5, 1], y: 34 },
    { prop: 'banner_scales', tile: [11, 1], y: 34 },
    { prop: 'potted_plant', tile: [14, 12] },
    { prop: 'potted_plant', tile: [1, 12] },
  ],
  walls: ring(16, 14, [[8, 13]]),
  portals: [
    { id: 'to-square', tile: [8, 12], to: 'square', spawn: 'from-archive', prompt: 'Step back into the square', style: 'door' },
  ],
  npcs: [
    { id: 'clerk', name: 'The Clerk', model: 'clerk', tile: [8, 4], yaw: 0, lines: 'clerk' },
  ],
  spawns: {
    'from-square': { tile: [8, 11], yaw: 0 },
  },
  defaultSpawn: 'from-square',
  lights: [
    { tile: [8, 4], y: 44, kind: 'cool' },
    { tile: [4, 8], y: 36, kind: 'warm' },
    { tile: [12, 8], y: 36, kind: 'warm' },
  ],
};

/**
 * The tavern interior: a bar, benches, a hearth, a back room.
 */
const tavern: TownMapSpec = {
  id: 'tavern',
  name: 'The Gavel & Goat',
  cols: 18,
  rows: 14,
  mood: 'interior',
  floor: [
    row('TTTTTTTTTTTTTTTTTT', 18),
    row('TffffffffffffffffT', 18),
    row('TffffffffffffffffT', 18),
    row('TffffffffffffffffT', 18),
    row('TffffffmmmmffffffT', 18),
    row('TffffffmmmmffffffT', 18),
    row('TffffffmmmmffffffT', 18),
    row('TffffffmmmmffffffT', 18),
    row('TffffffffffffffffT', 18),
    row('TffffffffffffffffT', 18),
    row('TffffffffffffffffT', 18),
    row('TffffffffffffffffT', 18),
    row('TffffffffffffffffT', 18),
    row('TTTTTTTTTTTTTTTTTT', 18),
  ],
  props: [
    // The bar along the north wall.
    { prop: 'bench', tile: [6, 2], rotY: 180 },
    { prop: 'bench', tile: [9, 2], rotY: 180 },
    { prop: 'bench', tile: [12, 2], rotY: 180 },
    { prop: 'barrel', tile: [2, 2] },
    { prop: 'barrel', tile: [3, 2] },
    { prop: 'crate', tile: [15, 2] },
    // Tables and seating down the room.
    { prop: 'bench', tile: [5, 8] },
    { prop: 'bench', tile: [12, 8] },
    { prop: 'bench', tile: [5, 11], rotY: 180 },
    { prop: 'bench', tile: [12, 11], rotY: 180 },
    { prop: 'throne_chair', tile: [8, 6], interact: { id: 'high-seat', prompt: 'Sit in the high seat', kind: 'seat' } },
    // Hearth and light.
    { prop: 'sconce', tile: [1, 5], y: 32 },
    { prop: 'sconce', tile: [16, 5], y: 32 },
    { prop: 'spotlight_rig', tile: [8, 4], y: 58 },
    { prop: 'ceiling_ring', tile: [8, 8], y: 62 },
    // Dressing: the bar's back wall.
    { prop: 'wall_panel', tile: [8, 1] },
    { prop: 'neon_sign', tile: [8, 1], y: 40 },
    { prop: 'papers_stack', tile: [4, 4] },
    { prop: 'potted_plant', tile: [16, 12] },
    { prop: 'potted_plant', tile: [1, 12] },
  ],
  walls: ring(18, 14, [[8, 13]]),
  portals: [
    { id: 'to-square', tile: [8, 12], to: 'square', spawn: 'from-tavern', prompt: 'Step outside', style: 'door' },
  ],
  npcs: [
    { id: 'barkeep', name: 'Odile', model: 'side-a', tile: [9, 4], yaw: 0, lines: 'odile' },
    { id: 'drunk', name: 'A Drunk Juror', model: 'juror', tile: [13, 10], yaw: 3.4, lines: 'drunk-juror' },
  ],
  spawns: {
    'from-square': { tile: [8, 11], yaw: 0 },
  },
  defaultSpawn: 'from-square',
  lights: [
    { tile: [8, 3], y: 40, kind: 'warm', intensity: 1.3 },
    { tile: [4, 8], y: 34, kind: 'warm' },
    { tile: [13, 8], y: 34, kind: 'warm' },
  ],
};

/**
 * Residential streets: a lane of townhouses with gardens.
 */
const streets: TownMapSpec = {
  id: 'streets',
  name: 'Lantern Row',
  cols: 30,
  rows: 20,
  mood: 'dusk',
  floor: [
    row('gggggggggggggggggggggggggggggg', 30),
    row('gggggggggggggggggggggggggggggg', 30),
    row('gggggggggggggggggggggggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggdddddddgggggggggg', 30),
    row('ggggggggggggggddgggggggggggggg', 30),
    row('ggggggggggggggddgggggggggggggg', 30),
    row('gggggggggggggggggggggggggggggg', 30),
    row('gggggggggggggggggggggggggggggg', 30),
    row('gggggggggggggggggggggggggggggg', 30),
  ],
  props: [
    // Townhouses lining both sides of the lane, facing the road.
    { prop: 'townhouse', tile: [4, 2] },
    { prop: 'townhouse', tile: [10, 2] },
    { prop: 'townhouse', tile: [16, 2] },
    { prop: 'townhouse', tile: [22, 2] },
    { prop: 'townhouse', tile: [28, 2] },
    { prop: 'townhouse', tile: [4, 16], rotY: 180 },
    { prop: 'townhouse', tile: [10, 16], rotY: 180 },
    { prop: 'townhouse', tile: [16, 16], rotY: 180 },
    { prop: 'townhouse', tile: [22, 16], rotY: 180 },
    // The tavern closes the far end of the row.
    { prop: 'tavern', tile: [28, 16], rotY: 180 },
    // Garden fences between the houses.
    { prop: 'fence', tile: [7, 3] },
    { prop: 'fence', tile: [13, 3] },
    { prop: 'fence', tile: [19, 3] },
    { prop: 'fence', tile: [25, 3] },
    { prop: 'fence', tile: [7, 15] },
    { prop: 'fence', tile: [13, 15] },
    { prop: 'fence', tile: [25, 15] },
    // Street lamps down the lane.
    { prop: 'lampStandard', tile: [8, 8] },
    { prop: 'lampStandard', tile: [15, 8] },
    { prop: 'lampStandard', tile: [22, 8] },
    { prop: 'lampStandard', tile: [8, 12] },
    { prop: 'lampStandard', tile: [22, 12] },
    // Trees and planting in the gardens.
    { prop: 'tree_round', tile: [2, 2] },
    { prop: 'tree_pine', tile: [29, 2] },
    { prop: 'tree_round', tile: [2, 17] },
    { prop: 'bush', tile: [19, 15] },
    { prop: 'flower_bed', tile: [19, 16] },
    { prop: 'flower_bed', tile: [7, 2] },
    { prop: 'flower_bed', tile: [13, 2] },
    { prop: 'flower_bed', tile: [25, 2] },
    { prop: 'potted_plant', tile: [9, 4] },
    { prop: 'potted_plant', tile: [21, 4] },
    { prop: 'bench', tile: [12, 10] },
    { prop: 'handcart', tile: [18, 13], rotY: 90 },
    { prop: 'signpost', tile: [14, 15], interact: { id: 'lane-sign', prompt: 'Read the street sign', kind: 'inspect', lines: 'lane-sign' } },
  ],
  portals: [
    { id: 'to-square', tile: [15, 19], to: 'square', spawn: 'from-streets', prompt: 'Walk back to the square', style: 'arch' },
  ],
  npcs: [
    { id: 'agnes-street', name: 'A Neighbour', model: 'juror-b', tile: [11, 12], yaw: 1.4, lines: 'neighbour' },
    { id: 'kid', name: 'A Child', model: 'juror', tile: [20, 9], yaw: -1.8, lines: 'child' },
  ],
  spawns: {
    'from-square': { tile: [15, 17], yaw: 0 },
  },
  defaultSpawn: 'from-square',
  lights: [
    { tile: [8, 8], y: 40, kind: 'warm' },
    { tile: [15, 8], y: 40, kind: 'warm' },
    { tile: [22, 8], y: 40, kind: 'warm' },
    { tile: [8, 12], y: 40, kind: 'warm' },
    { tile: [22, 12], y: 40, kind: 'warm' },
  ],
};

/**
 * The courthouse: a hall ten times the previous one on each side, with a lawn
 * on every side of the building.
 *
 * The previous hall was 42×56. Each of those cells is now a 10×10 block, so the
 * aisle, the well and the gallery keep the same arrangement and the cast is no
 * longer standing on the furniture. A grass apron with a cobble terrace and a
 * path runs around all four walls. Each wall has a door you walk through; the
 * paths lead back to the town square.
 */
const HALL_SCALE = 10;
const APRON = 32;
const HALL_COLS = 42 * HALL_SCALE;
const HALL_ROWS = 56 * HALL_SCALE;
const COURT_COLS = HALL_COLS + APRON * 2;
const COURT_ROWS = HALL_ROWS + APRON * 2;
const HALL_C0 = APRON;
const HALL_R0 = APRON;
const HALL_C1 = APRON + HALL_COLS - 1;
const HALL_R1 = APRON + HALL_ROWS - 1;
/** Centre of the old south door, in the scaled hall. */
const DOOR_C = APRON + 21 * HALL_SCALE + Math.floor((HALL_SCALE - 1) / 2);
const SIDE_R = APRON + 28 * HALL_SCALE + Math.floor((HALL_SCALE - 1) / 2);
const DOOR_HALF = 5;

function scaled(c: number, r: number): [number, number] {
  return [APRON + c * HALL_SCALE, APRON + r * HALL_SCALE];
}

function oldHallFloor(oc: number, orow: number): string {
  let ch = 's';
  if (orow >= 36 && orow <= 50 && oc >= 6 && oc <= 35) ch = 'S';
  if (orow >= 14 && orow <= 22 && ((oc >= 8 && oc <= 13) || (oc >= 28 && oc <= 33))) ch = 'm';
  if (orow >= 10 && orow <= 52 && oc >= 18 && oc <= 23) ch = 'm';
  return ch;
}

function courtFloor(): string[] {
  const grid = Array.from({ length: COURT_ROWS }, () => Array.from({ length: COURT_COLS }, () => 'g'));
  const terrace = 8;
  for (let r = 0; r < COURT_ROWS; r++) {
    const row = grid[r]!;
    for (let c = 0; c < COURT_COLS; c++) {
      const inHall = c >= HALL_C0 && c <= HALL_C1 && r >= HALL_R0 && r <= HALL_R1;
      if (inHall) {
        row[c] = oldHallFloor(Math.floor((c - HALL_C0) / HALL_SCALE), Math.floor((r - HALL_R0) / HALL_SCALE));
        continue;
      }
      const dc = c < HALL_C0 ? HALL_C0 - c : c > HALL_C1 ? c - HALL_C1 : 0;
      const dr = r < HALL_R0 ? HALL_R0 - r : r > HALL_R1 ? r - HALL_R1 : 0;
      if (Math.max(dc, dr) > 0 && Math.max(dc, dr) <= terrace) row[c] = 'C';
    }
  }
  for (let c = DOOR_C - DOOR_HALF; c <= DOOR_C + DOOR_HALF; c++) {
    for (let r = 0; r < HALL_R0; r++) grid[r]![c] = 'C';
    for (let r = HALL_R1 + 1; r < COURT_ROWS; r++) grid[r]![c] = 'C';
  }
  for (let r = SIDE_R - DOOR_HALF; r <= SIDE_R + DOOR_HALF; r++) {
    for (let c = 0; c < HALL_C0; c++) grid[r]![c] = 'C';
    for (let c = HALL_C1 + 1; c < COURT_COLS; c++) grid[r]![c] = 'C';
  }
  return grid.map((row) => row.join(''));
}

function courtWalls(): string[] {
  const grid = Array.from({ length: COURT_ROWS }, () => Array.from({ length: COURT_COLS }, () => '.'));
  const door = (c: number, r: number) =>
    ((r === HALL_R0 || r === HALL_R1) && Math.abs(c - DOOR_C) <= DOOR_HALF) ||
    ((c === HALL_C0 || c === HALL_C1) && Math.abs(r - SIDE_R) <= DOOR_HALF);
  for (let c = HALL_C0; c <= HALL_C1; c++) {
    if (!door(c, HALL_R0)) grid[HALL_R0]![c] = '#';
    if (!door(c, HALL_R1)) grid[HALL_R1]![c] = '#';
  }
  for (let r = HALL_R0; r <= HALL_R1; r++) {
    if (!door(HALL_C0, r)) grid[r]![HALL_C0] = '#';
    if (!door(HALL_C1, r)) grid[r]![HALL_C1] = '#';
  }
  return grid.map((row) => row.join(''));
}

function courtProps(): PropPlacement[] {
  const props: PropPlacement[] = [
    { prop: 'dais_step', tile: scaled(23, 8) },
    { prop: 'judge_bench', tile: scaled(22, 3), y: 8 },
    { prop: 'throne_chair', tile: scaled(22, 3), y: 16 },
    { prop: 'court_seal', tile: scaled(21, 2), y: 70 },
    { prop: 'banner_scales', tile: scaled(8, 2), y: 44 },
    { prop: 'banner_scales', tile: scaled(34, 2), y: 44 },
    { prop: 'prosecutor_desk', tile: scaled(11, 16) },
    { prop: 'defense_desk', tile: scaled(32, 16) },
    { prop: 'witness_stand', tile: scaled(21, 14) },
    { prop: 'evidence_screen', tile: scaled(7, 6), y: 34, interact: { id: 'evidence-screen', prompt: 'Review the evidence', kind: 'exhibit' } },
    { prop: 'sealed_ballot_box', tile: scaled(34, 8), interact: { id: 'ballot-box', prompt: 'Inspect the sealed ballot box', kind: 'inspect', lines: 'ballot-box' } },
    { prop: 'jury_box', tile: scaled(37, 18) },
    { prop: 'gallery_bench', tile: scaled(10, 40) },
    { prop: 'gallery_bench', tile: scaled(21, 40) },
    { prop: 'gallery_bench', tile: scaled(32, 40) },
    { prop: 'gallery_bench', tile: scaled(10, 46) },
    { prop: 'gallery_bench', tile: scaled(21, 46) },
    { prop: 'gallery_bench', tile: scaled(32, 46) },
    { prop: 'railing', tile: scaled(21, 30) },
    { prop: 'ceiling_ring', tile: scaled(21, 8), y: 80 },
    { prop: 'spotlight_rig', tile: scaled(21, 20), y: 72 },
    { prop: 'courtroom_door', tile: [DOOR_C, HALL_R1 - 2] },
    { prop: 'potted_plant', tile: [DOOR_C - 8, HALL_R1 + 2] },
    { prop: 'potted_plant', tile: [DOOR_C + 8, HALL_R1 + 2] },
    { prop: 'potted_plant', tile: [DOOR_C - 8, HALL_R0 - 2] },
    { prop: 'potted_plant', tile: [DOOR_C + 8, HALL_R0 - 2] },
    { prop: 'potted_plant', tile: [HALL_C0 - 2, SIDE_R - 8] },
    { prop: 'potted_plant', tile: [HALL_C0 - 2, SIDE_R + 8] },
    { prop: 'potted_plant', tile: [HALL_C1 + 3, SIDE_R - 8] },
    { prop: 'potted_plant', tile: [HALL_C1 + 3, SIDE_R + 8] },
    { prop: 'bench', tile: [DOOR_C - 14, HALL_R1 + 16], rotY: 180 },
    { prop: 'bench', tile: [DOOR_C + 14, HALL_R1 + 16], rotY: 180 },
    { prop: 'bench', tile: [DOOR_C - 14, HALL_R0 - 14] },
    { prop: 'bench', tile: [DOOR_C + 14, HALL_R0 - 14] },
    { prop: 'bench', tile: [HALL_C0 - 16, SIDE_R - 14], rotY: 90 },
    { prop: 'bench', tile: [HALL_C1 + 16, SIDE_R + 14], rotY: 270 },
    { prop: 'tree_round', tile: [HALL_C0 - 18, HALL_R1 + 18] },
    { prop: 'tree_pine', tile: [HALL_C1 + 12, HALL_R1 + 18] },
    { prop: 'tree_round', tile: [HALL_C0 + 20, HALL_R0 - 16] },
    { prop: 'tree_pine', tile: [HALL_C1 - 16, HALL_R0 - 16] },
    { prop: 'tree_round', tile: [HALL_C0 - 20, SIDE_R + 18] },
    { prop: 'tree_pine', tile: [HALL_C1 + 16, SIDE_R - 18] },
    { prop: 'flower_bed', tile: [DOOR_C - 16, HALL_R1 + 10] },
    { prop: 'flower_bed', tile: [DOOR_C + 12, HALL_R1 + 10] },
    { prop: 'flower_bed', tile: [DOOR_C - 16, HALL_R0 - 10] },
    { prop: 'flower_bed', tile: [DOOR_C + 12, HALL_R0 - 10] },
    { prop: 'lampStandard', tile: [HALL_C0 - 14, HALL_R0 - 14] },
    { prop: 'lampStandard', tile: [HALL_C1 + 10, HALL_R0 - 14] },
    { prop: 'lampStandard', tile: [HALL_C0 - 14, HALL_R1 + 14] },
    { prop: 'lampStandard', tile: [HALL_C1 + 10, HALL_R1 + 14] },
    { prop: 'lampStandard', tile: [HALL_C0 - 16, SIDE_R + 16] },
    { prop: 'lampStandard', tile: [HALL_C1 + 14, SIDE_R - 16] },
  ];
  let bay = 0;
  for (let r = HALL_R0 + 24; r < HALL_R1 - 12; r += 40) {
    if (Math.abs(r - SIDE_R) <= DOOR_HALF + 4) continue;
    props.push({ prop: 'column', tile: [HALL_C0 + 4, r] });
    props.push({ prop: 'column', tile: [HALL_C1 - 2, r] });
    if (bay % 2 === 0) {
      props.push({ prop: 'arch_window', tile: [HALL_C0 + 2, r], y: 40 });
      props.push({ prop: 'arch_window', tile: [HALL_C1 - 1, r], y: 40 });
      props.push({ prop: 'sconce', tile: [HALL_C0 + 2, r + 8], y: 36 });
      props.push({ prop: 'sconce', tile: [HALL_C1 - 1, r + 8], y: 36 });
    }
    bay++;
  }
  return props;
}

function courtLights(): NonNullable<TownMapSpec['lights']> {
  const lights: Array<NonNullable<TownMapSpec['lights']>[number]> = [];
  for (let r = HALL_R0 + 40; r < HALL_R1; r += 70) {
    lights.push({ tile: [DOOR_C, r], y: 72, kind: 'warm' });
  }
  lights.push(
    { tile: [DOOR_C, HALL_R1 + 14], y: 40, kind: 'warm' },
    { tile: [DOOR_C, HALL_R0 - 12], y: 40, kind: 'warm' },
    { tile: [HALL_C0 - 14, SIDE_R + 16], y: 40, kind: 'warm' },
    { tile: [HALL_C1 + 14, SIDE_R - 16], y: 40, kind: 'warm' },
  );
  return lights;
}

const courthouse: TownMapSpec = {
  id: 'courthouse',
  name: 'The Courtroom',
  cols: COURT_COLS,
  rows: COURT_ROWS,
  mood: 'day',
  floor: courtFloor(),
  props: courtProps(),
  walls: courtWalls(),
  portals: [
    { id: 'to-square-south', tile: [DOOR_C, COURT_ROWS - 3], to: 'square', spawn: 'from-courthouse', prompt: 'Return to the town square', style: 'arch' },
    { id: 'to-square-north', tile: [DOOR_C, 3], to: 'square', spawn: 'from-courthouse', prompt: 'Return to the town square', style: 'arch' },
    { id: 'to-square-west', tile: [3, SIDE_R], to: 'square', spawn: 'from-courthouse', prompt: 'Return to the town square', style: 'arch' },
    { id: 'to-square-east', tile: [COURT_COLS - 4, SIDE_R], to: 'square', spawn: 'from-courthouse', prompt: 'Return to the town square', style: 'arch' },
  ],
  npcs: [
    { id: 'judge', name: 'Judge Gavel.exe', model: 'judge', tile: scaled(21, 6), yaw: 0, lines: 'judge', radius: 0 },
    { id: 'prosecutor', name: 'Miss Ratio', model: 'prosecutor', tile: scaled(12, 20), yaw: 0.6, lines: 'prosecutor', radius: 0 },
    { id: 'defense', name: 'Counsel Chaos', model: 'defense', tile: scaled(30, 20), yaw: -0.6, lines: 'defense', radius: 0 },
    { id: 'bailiff', name: 'The Bailiff', model: 'bailiff', tile: scaled(26, 12), yaw: -0.4, lines: 'bailiff', radius: 0 },
    { id: 'clerk-court', name: 'The Clerk', model: 'clerk', tile: scaled(16, 12), yaw: 0.4, lines: 'clerk', radius: 0 },
  ],
  spawns: {
    // Just outside the south door, so arriving from town lands on the grounds.
    forecourt: { tile: [DOOR_C, HALL_R1 + 6], yaw: 0 },
    entrance: { tile: [DOOR_C, HALL_R1 - 14], yaw: 0 },
    aisle: { tile: scaled(21, 36), yaw: 0 },
    well: { tile: scaled(21, 24), yaw: 0 },
    defendant: { tile: scaled(24, 22), yaw: 0 },
    witness: { tile: scaled(21, 18), yaw: 0 },
    bench: { tile: scaled(21, 11), yaw: 0 },
  },
  defaultSpawn: 'entrance',
  lights: courtLights(),
};

/**
 * One outdoor map.
 *
 * The square, the market and the residential streets are stamped side by side
 * so you walk between them. Courthouse, tavern and archive stay separate maps:
 * those are the buildings you enter. Outdoor portals (the old arches) are
 * dropped here because the ground already connects.
 */
const STREETS_AT = [16, 0] as const;
const SQUARE_AT = [14, 22] as const;
const MARKET_AT = [68, 26] as const;
const OVER_COLS = 92;
const OVER_ROWS = 80;

function setCell(grid: string[], c: number, r: number, ch: string): void {
  const line = grid[r];
  if (!line || c < 0 || c >= line.length || r < 0 || r >= grid.length) return;
  grid[r] = line.slice(0, c) + ch + line.slice(c + 1);
}

function stampFloor(grid: string[], floor: readonly string[], ox: number, oy: number): void {
  for (let r = 0; r < floor.length; r++) {
    const line = floor[r]!;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]!;
      if (ch === '.' || ch === ' ') continue;
      setCell(grid, ox + c, oy + r, ch);
    }
  }
}

const OUTDOOR_LINKS = new Set<TownMapSpec['id']>(['square', 'market', 'streets']);

/**
 * Walkable ground on every side of the courthouse facade.
 *
 * The building's collision sits on cols 26–34, rows 46–49. West of it was void
 * or a pinched strip, and the archive used to stand in the east passage. This
 * fills a lawn around that footprint and a grass pad under the archive, which
 * now stands further east. Existing plaza and path tiles are left alone.
 */
function paintCourthouseApron(grid: string[]): void {
  const fill = (c0: number, r0: number, c1: number, r1: number, ch: string) => {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) if (grid[r]?.[c] === '.') setCell(grid, c, r, ch);
    }
  };
  fill(4, 40, 24, 78, 'g');
  fill(35, 40, 54, 78, 'g');
  fill(52, 42, 66, 56, 'g');
  // A cobble circuit tight against the facade, so the way around reads as a path.
  for (let r = 43; r <= 53; r++) {
    for (let c = 22; c <= 38; c++) {
      const solid = c >= 26 && c <= 34 && r >= 46 && r <= 49;
      const onRing = c <= 25 || c >= 35 || r <= 45 || r >= 50;
      if (solid || !onRing) continue;
      const ch = grid[r]?.[c];
      if (ch === '.' || ch === 'g' || ch === 'd') setCell(grid, c, r, 'C');
    }
  }
  // Door apron in front of the relocated archive.
  for (let r = 48; r <= 54; r++) setCell(grid, 56, r, 'C');
}

function composeOverworld(): TownMapSpec {
  const grid = Array.from({ length: OVER_ROWS }, () => '.'.repeat(OVER_COLS));
  stampFloor(grid, streets.floor, STREETS_AT[0], STREETS_AT[1]);
  stampFloor(grid, square.floor, SQUARE_AT[0], SQUARE_AT[1]);
  stampFloor(grid, market.floor, MARKET_AT[0], MARKET_AT[1]);

  // The lane in Lantern Row lines up with the square's north path. Fill the
  // one-row gap so you walk off the street and onto the plaza.
  for (let r = STREETS_AT[1] + streets.rows - 1; r <= SQUARE_AT[1] + 2; r++) {
    for (let c = 28; c <= 34; c++) setCell(grid, c, r, 'd');
  }
  // Cobble from the plaza's east edge into Market Row. Only fill void, so a
  // stall that already owns the tile keeps its ground. The market sits further
  // east so the courthouse can have a lawn on that side.
  for (let r = 32; r <= 38; r++) {
    for (let c = 44; c <= MARKET_AT[0] + 4; c++) if (grid[r]?.[c] === '.') setCell(grid, c, r, 'C');
  }
  paintCourthouseApron(grid);

  const parts = [
    { spec: streets, at: STREETS_AT },
    { spec: square, at: SQUARE_AT },
    { spec: market, at: MARKET_AT },
  ] as const;

  const props = [
    ...parts.flatMap(({ spec, at }) => spec.props.map((p) => ({ ...p, tile: [p.tile[0] + at[0], p.tile[1] + at[1]] as [number, number] }))),
    // Dressing on the west and east lawns, clear of the building and the doors.
    { prop: 'tree_round', tile: [8, 52] as [number, number] },
    { prop: 'tree_pine', tile: [10, 66] as [number, number] },
    { prop: 'lampStandard', tile: [12, 60] as [number, number] },
    { prop: 'bench', tile: [14, 72] as [number, number], rotY: 90 as const },
    { prop: 'flower_bed', tile: [16, 48] as [number, number] },
    { prop: 'tree_round', tile: [46, 54] as [number, number] },
    { prop: 'tree_pine', tile: [48, 68] as [number, number] },
    { prop: 'lampStandard', tile: [44, 62] as [number, number] },
    { prop: 'bench', tile: [50, 74] as [number, number], rotY: 270 as const },
    { prop: 'flower_bed', tile: [42, 70] as [number, number] },
  ];
  const npcs = parts.flatMap(({ spec, at }) => (spec.npcs ?? []).map((n) => ({ ...n, tile: [n.tile[0] + at[0], n.tile[1] + at[1]] as [number, number] })));
  const portals = parts.flatMap(({ spec, at }) =>
    (spec.portals ?? [])
      .filter((p) => !OUTDOOR_LINKS.has(p.to))
      .map((p) => ({ ...p, tile: [p.tile[0] + at[0], p.tile[1] + at[1]] as [number, number] })),
  );
  const lights = parts.flatMap(({ spec, at }) =>
    (spec.lights ?? []).map((l) => ({ ...l, tile: [l.tile[0] + at[0], l.tile[1] + at[1]] as [number, number] })),
  );
  const spawns: Record<string, { tile: [number, number]; yaw: number }> = {};
  for (const [id, s] of Object.entries(square.spawns)) {
    spawns[id] = { tile: [s.tile[0] + SQUARE_AT[0], s.tile[1] + SQUARE_AT[1]], yaw: s.yaw };
  }

  return {
    id: 'square',
    name: 'Town Square',
    cols: OVER_COLS,
    rows: OVER_ROWS,
    mood: 'day',
    floor: grid,
    props,
    npcs,
    portals,
    spawns,
    defaultSpawn: square.defaultSpawn,
    lights,
    regions: [
      { name: 'Lantern Row', c0: STREETS_AT[0], r0: STREETS_AT[1], c1: STREETS_AT[0] + streets.cols - 1, r1: STREETS_AT[1] + streets.rows - 1 },
      { name: 'Market Row', c0: MARKET_AT[0], r0: MARKET_AT[1], c1: MARKET_AT[0] + market.cols - 1, r1: MARKET_AT[1] + market.rows - 1 },
      { name: 'Courthouse grounds', c0: 4, r0: 44, c1: 52, r1: 78 },
    ],
  };
}

export const TOWN_MAPS = {
  square: composeOverworld(),
  archive,
  tavern,
  courthouse,
} as const satisfies Readonly<Record<'square' | 'archive' | 'tavern' | 'courthouse', TownMapSpec>>;

export const MAP_ORDER = ['square', 'archive', 'tavern', 'courthouse'] as const;

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
 * The courthouse faces the square across its forecourt; the market and archive
 * sit off the square's east side; the tavern is on the west approach; the
 * residential streets wrap the north.
 */
import type { TownMapSpec } from '../world';


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
  rows: 34,
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
    { prop: 'archive', tile: [25, 24] },
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
  ],
  portals: [
    { id: 'to-tavern', tile: [4, 12], to: 'tavern', spawn: 'from-square', prompt: 'Enter the tavern', style: 'door' },
    { id: 'to-archive', tile: [25, 28], to: 'archive', spawn: 'from-square', prompt: 'Enter the evidence archive', style: 'door' },
    { id: 'to-courthouse', tile: [16, 30], to: 'courthouse', spawn: 'entrance', prompt: 'Climb the courthouse steps', style: 'stairs' },
  ],
  npcs: [
    { id: 'vera', name: 'Vera', model: 'clerk', tile: [13, 8], yaw: 2.2, lines: 'vera' },
    { id: 'gus', name: 'Gus', model: 'bailiff', tile: [21, 13], yaw: -2.4, lines: 'gus' },
    { id: 'mara', name: 'Mara', model: 'juror', tile: [19, 6], yaw: 3.0, lines: 'mara' },
    { id: 'clem', name: 'Clem', model: 'juror-a', tile: [8, 16], yaw: 0.7, lines: 'clem' },
  ],
  spawns: {
    'from-square': { tile: [16, 20], yaw: 0 },
    'from-courthouse': { tile: [16, 31], yaw: Math.PI },
    'from-market': { tile: [31, 11], yaw: Math.PI / 2 },
    'from-tavern': { tile: [3, 12], yaw: Math.PI / 2 },
    'from-archive': { tile: [24, 22], yaw: 0 },
    'from-streets': { tile: [16, 3], yaw: Math.PI },
  },
  defaultSpawn: 'from-square',
  lights: [
    { tile: [6, 4], y: 40, kind: 'warm' },
    { tile: [27, 4], y: 40, kind: 'warm' },
    { tile: [6, 20], y: 40, kind: 'warm' },
    { tile: [27, 20], y: 40, kind: 'warm' },
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
 * The courthouse interior: the explorable version of the trial room.
 *
 * This is the map where the trial lives. It uses the same axis: the bench is at
 * −Z, the gallery at +Z, exactly as the first-person courtroom does, so the
 * existing beat scripts describe the same space.
 */
const courthouse: TownMapSpec = {
  id: 'courthouse',
  name: 'The Courtroom',
  cols: 18,
  rows: 22,
  mood: 'interior',
  floor: [
    row('TTTTTTTTTTTTTTTTTT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TsssmmmsssssmmmssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TssssssssssssssssT', 18),
    row('TmmmmmmmmmmmmmmmmT', 18),
    row('TmmmmmmmmmmmmmmmmT', 18),
    row('TmmmmmmmmmmmmmmmmT', 18),
    row('TmmmmmmmmmmmmmmmmT', 18),
    row('TmmmmmmmmmmmmmmmmT', 18),
    row('TmmmmmmmmmmmmmmmmT', 18),
    row('TmmmmmmmmmmmmmmmmT', 18),
    row('TTTTTTTTTTTTTTTTTT', 18),
  ],
  props: [
    // The bench and the judge, at the north end.
    { prop: 'dais_step', tile: [9, 3] },
    { prop: 'judge_bench', tile: [9, 1], y: 8 },
    { prop: 'throne_chair', tile: [9, 1], y: 16 },
    { prop: 'court_seal', tile: [9, 1], y: 62 },
    { prop: 'banner_scales', tile: [4, 1], y: 40 },
    { prop: 'banner_scales', tile: [14, 1], y: 40 },
    // Counsel tables.
    { prop: 'prosecutor_desk', tile: [5, 7] },
    { prop: 'defense_desk', tile: [13, 7] },
    { prop: 'witness_stand', tile: [9, 6] },
    // Evidence and the ballot box.
    { prop: 'evidence_screen', tile: [4, 2], y: 34, interact: { id: 'evidence-screen', prompt: 'Review the evidence', kind: 'exhibit' } },
    { prop: 'sealed_ballot_box', tile: [14, 4], interact: { id: 'ballot-box', prompt: 'Inspect the sealed ballot box', kind: 'inspect', lines: 'ballot-box' } },
    // The jury box and the gallery.
    { prop: 'jury_box', tile: [15, 6] },
    { prop: 'gallery_bench', tile: [4, 16] },
    { prop: 'gallery_bench', tile: [9, 16] },
    { prop: 'gallery_bench', tile: [14, 16] },
    { prop: 'gallery_bench', tile: [4, 18] },
    { prop: 'gallery_bench', tile: [9, 18] },
    { prop: 'gallery_bench', tile: [14, 18] },
    { prop: 'railing', tile: [9, 12] },
    // Architecture dressing.
    { prop: 'column', tile: [1, 4] },
    { prop: 'column', tile: [16, 4] },
    { prop: 'column', tile: [1, 12] },
    { prop: 'column', tile: [16, 12] },
    { prop: 'arch_window', tile: [1, 8], y: 40 },
    { prop: 'arch_window', tile: [16, 8], y: 40 },
    { prop: 'sconce', tile: [1, 6], y: 36 },
    { prop: 'sconce', tile: [16, 6], y: 36 },
    { prop: 'ceiling_ring', tile: [9, 4], y: 76 },
    { prop: 'spotlight_rig', tile: [9, 8], y: 66 },
    { prop: 'courtroom_door', tile: [9, 21] },
    { prop: 'potted_plant', tile: [2, 20] },
    { prop: 'potted_plant', tile: [15, 20] },
  ],
  walls: ring(18, 22, [[9, 21]]),
  portals: [
    { id: 'to-square', tile: [9, 20], to: 'square', spawn: 'from-courthouse', prompt: 'Leave the courtroom', style: 'door' },
  ],
  npcs: [
    { id: 'judge', name: 'Judge Gavel.exe', model: 'judge', tile: [9, 2], yaw: 0, lines: 'judge', radius: 0 },
    { id: 'prosecutor', name: 'Miss Ratio', model: 'prosecutor', tile: [5, 6], yaw: 1.4, lines: 'prosecutor', radius: 0 },
    { id: 'defense', name: 'Counsel Chaos', model: 'defense', tile: [13, 6], yaw: -1.4, lines: 'defense', radius: 0 },
    { id: 'bailiff', name: 'The Bailiff', model: 'bailiff', tile: [12, 3], yaw: -0.8, lines: 'bailiff', radius: 0 },
    { id: 'clerk-court', name: 'The Clerk', model: 'clerk', tile: [6, 3], yaw: 0.8, lines: 'clerk', radius: 0 },
  ],
  spawns: {
    entrance: { tile: [9, 19], yaw: 0 },
    aisle: { tile: [9, 14], yaw: 0 },
    well: { tile: [9, 9], yaw: 0 },
    defendant: { tile: [11, 8], yaw: 0 },
    witness: { tile: [9, 7], yaw: 0 },
    bench: { tile: [9, 5], yaw: 0 },
  },
  defaultSpawn: 'entrance',
  lights: [
    { tile: [9, 3], y: 66, kind: 'warm', intensity: 1.4 },
    { tile: [4, 10], y: 40, kind: 'warm' },
    { tile: [14, 10], y: 40, kind: 'warm' },
    { tile: [9, 17], y: 36, kind: 'warm' },
  ],
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
const MARKET_AT = [48, 26] as const;
const OVER_COLS = 70;
const OVER_ROWS = 58;

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
  // stall that already owns the tile keeps its ground.
  for (let r = 30; r <= 40; r++) {
    for (let c = 44; c <= 52; c++) if (grid[r]?.[c] === '.') setCell(grid, c, r, 'C');
  }

  const parts = [
    { spec: streets, at: STREETS_AT },
    { spec: square, at: SQUARE_AT },
    { spec: market, at: MARKET_AT },
  ] as const;

  const props = parts.flatMap(({ spec, at }) => spec.props.map((p) => ({ ...p, tile: [p.tile[0] + at[0], p.tile[1] + at[1]] as [number, number] })));
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

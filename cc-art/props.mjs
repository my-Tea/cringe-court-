// Prop specs — voxel geometry, one entry per asset.
// Shorthand: b(from, to, material) => box. Materials are palette keys from
// palette.mjs MAT. All props are authored facing +Z (toward camera), origin at
// the base centre (y=0 is the ground plane), so the game can drop them straight
// onto a floor.
import { MAT as M } from './palette.mjs';

const b = (f, t, m) => ({ f, t, m });

// helper: symmetric pair across X
const pair = (f, t, m) => [b(f, t, m), b([-t[0], f[1], f[2]], [-f[0], t[1], t[2]], m)];

export const PROPS = {
  // ────────────────────────────── courtroom ──────────────────────────────
  judge_bench: {
    label: 'Judge bench + high back',
    parts: [
      b([-18, 0, -10], [18, 10, 10], M.marble),        // plinth
      b([-18, 10, -10], [18, 11, 10], M.goldLight),    // gold cap rail
      b([-16, 11, -9], [16, 13, 9], M.marbleMid),      // desktop
      b([-17, 0, 8], [17, 1, 10], M.marbleMid),        // front lip
      b([-13, 13, -9], [13, 40, -5], M.marble),        // back panel (rises)
      b([-14, 39, -10], [14, 42, -4], M.gold),         // back crest
      b([-3, 41, -10], [3, 47, -4], M.goldLight),      // scaled crest centre
      ...pair([-16, 41, -9], [-13, 44, -5], M.goldPale),
      b([-11, 13, -5.6], [11, 30, -5.1], M.velvet),     // velvet inset (in front of the panel)
    ],
  },

  gavel: {
    label: 'Judge gavel (held prop)',
    parts: [
      b([-2, 0, -2], [2, 16, 2], M.wood),              // handle
      b([-7, 16, -3], [7, 22, 3], M.woodLight),        // head
      b([-8, 18, -3], [8, 20, 3], M.gold),             // gold band
      ...pair([-8, 16, -3], [-6, 22, 3], M.goldLight), // end caps
    ],
  },

  gavel_block: {
    label: 'Gavel sound block',
    parts: [
      b([-5, 0, -5], [5, 3, 5], M.wood),               // base
      b([-4, 3, -4], [4, 4, 4], M.woodLight),          // striking face
      b([-1, 3, -5], [1, 4, 5], M.gold),
    ],
  },

  prosecutor_desk: {
    label: 'Prosecution lectern desk',
    parts: [
      b([-12, 0, -7], [12, 2, 7], M.marble),           // foot
      b([-11, 2, -6], [11, 20, 6], M.wood),            // body
      b([-12, 20, -7], [12, 22, 7], M.woodLight),      // top
      b([-12, 21, 6], [12, 22, 7], M.gold),            // gold front edge
      b([-9, 22, -5], [9, 24, 5], M.marbleMid),        // raised reading stand
      b([-4, 24, -4], [4, 25, 4], M.goldLight),        // book/plaque
    ],
  },

  defense_desk: {
    label: 'Defence desk (mirror of prosecution)',
    parts: [
      b([-12, 0, -7], [12, 2, 7], M.marble),
      b([-11, 2, -6], [11, 20, 6], M.wood),
      b([-12, 20, -7], [12, 22, 7], M.woodLight),
      b([-12, 21, 6], [12, 22, 7], M.gold),
      b([-9, 22, -5], [9, 24, 5], M.marbleMid),
      b([-4, 24, -4], [4, 25, 4], M.tealLight),        // teal plaque = defence
    ],
  },

  witness_stand: {
    label: 'Witness stand with rail',
    parts: [
      b([-10, 0, -8], [10, 2, 8], M.marble),
      b([-10, 2, -8], [10, 16, -4], M.marbleMid),      // back wall
      b([-10, 16, -8], [10, 18, -4], M.gold),
      b([-10, 2, 4], [10, 14, 8], M.marble),           // front rail
      b([-10, 14, 4], [10, 15, 8], M.goldLight),
      ...pair([-10, 2, -4], [-8, 14, 4], M.marbleMid), // side posts
    ],
  },

  jury_box: {
    label: 'Jury box (3 seats)',
    parts: [
      b([-22, 0, -8], [22, 2, 8], M.marble),
      b([-22, 2, 6], [22, 14, 8], M.marbleMid),        // front panel
      b([-22, 14, 6], [22, 15, 8], M.gold),
      b([-22, 2, -8], [22, 4, -6], M.marbleMid),       // back panelling
      // three seat blocks
      b([-19, 4, -5], [-8, 9, 4], M.velvet),
      b([-5, 4, -5], [6, 9, 4], M.velvet),
      b([9, 4, -5], [20, 9, 4], M.velvet),
      b([-19, 9, -6], [-8, 13, -5], M.velvetLight),
      b([-5, 9, -6], [6, 13, -5], M.velvetLight),
      b([9, 9, -6], [20, 13, -5], M.velvetLight),
    ],
  },

  evidence_screen: {
    label: 'Evidence wall screen',
    parts: [
      b([-16, 0, -4], [16, 20, 0], M.stoneDeep),       // frame plate
      b([-15, 1, -3], [15, 19, 1], M.waterLight),           // glowing display
      b([-16, 19, -4], [16, 21, 0], M.gold),           // top cap
      ...pair([-16, 0, -4], [-14, 20, 0], M.gold),     // side trims
      b([-6, 21, -4], [6, 24, 0], M.royal1),           // "EVIDENCE" header plate
    ],
  },

  sealed_ballot_box: {
    label: 'Sealed ballot box (locked)',
    parts: [
      b([-9, 0, -7], [9, 18, 7], M.wood),              // body
      b([-10, 18, -8], [10, 22, 8], M.woodLight),      // lid
      b([-10, 21, -8], [10, 22, 8], M.gold),           // gold band
      b([-2, 22, -8], [2, 24, 8], M.goldLight),        // lock hasp
      b([-1, 22, 7], [1, 25, 8], M.goldPale),          // slot mark
    ],
  },

  ballot_box_open: {
    label: 'Ballot box (open / unlocked)',
    parts: [
      b([-9, 0, -7], [9, 18, 7], M.wood),
      b([-10, 18, -8], [-9, 30, 8], M.woodLight),      // lid flipped back
      b([-2, 18, -8], [2, 18.6, -7], M.goldLight),
      b([-6, 18, -6], [6, 18.5, 6], M.ink),            // visible opening
    ],
  },

  court_seal: {
    label: 'CringeCourt wall seal',
    parts: [
      b([-14, 0, -2], [14, 6, 2], M.gold),             // base bar
      b([-2, 6, -2], [2, 20, 2], M.goldLight),         // pivot post
      b([-3, 19, -2], [3, 22, 2], M.goldPale),         // finial
      ...pair([-14, 2, -2], [-10, 8, 2], M.goldLight), // pans
      ...pair([-12, 8, -2], [-9, 10, 2], M.gold),
    ],
  },

  courtroom_door: {
    label: 'Double courtroom doors',
    parts: [
      b([-14, 0, -2], [14, 34, 2], M.stoneDeep),       // frame
      b([-13, 1, 0], [-1, 33, 2], M.wood),             // left leaf
      b([1, 1, 0], [13, 33, 2], M.wood),               // right leaf
      b([-13, 26, 1], [-1, 29, 2], M.gold),            // transom bars
      b([1, 26, 1], [13, 29, 2], M.gold),
      ...pair([-3, 15, 2], [-1, 19, 3], M.goldLight),  // handles
      b([-14, 33, -2], [14, 36, 2], M.gold),           // lintel
    ],
  },

  gallery_bench: {
    label: 'Gallery bench row',
    parts: [
      b([-16, 0, -6], [16, 2, 6], M.wood),             // base
      b([-16, 2, -6], [16, 9, -2], M.woodLight),       // backrest
      b([-16, 9, -6], [16, 10, -2], M.gold),           // top rail
      b([-16, 2, -2], [16, 4, 5], M.velvet),           // seat
      ...pair([-14, 0, -6], [-12, 10, -2], M.wood),    // end arms
    ],
  },

  railing: {
    label: 'Bar railing (separation)',
    parts: [
      b([-18, 0, -1], [18, 2, 1], M.gold),             // bottom rail
      b([-18, 12, -1], [18, 14, 1], M.goldLight),      // top rail
      ...[-15, -9, -3, 3, 9, 15].map((x) => b([x, 2, -1], [x + 2, 12, 1], M.gold)),
    ],
  },

  spotlight_rig: {
    label: 'Overhead spotlight housing',
    parts: [
      b([-4, 8, -4], [4, 10, 4], M.stoneDeep),         // mount
      b([-3, 0, -3], [3, 8, 3], M.ink),                // body
      b([-5, 0, -5], [5, 2, 5], M.ink),                // hood
      b([-4, -1, -4], [4, 0, 4], M.goldPale),          // lens
    ],
  },

  ceiling_ring: {
    label: 'Circular ceiling halo',
    parts: [
      ...Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const x = Math.cos(a) * 16, z = Math.sin(a) * 16;
        return b([Math.round(x) - 1, 0, Math.round(z) - 1], [Math.round(x) + 1, 2, Math.round(z) + 1], M.goldLight);
      }),
    ],
  },

  column: {
    label: 'Marble column (tall)',
    parts: [
      b([-6, 0, -6], [6, 3, 6], M.marbleMid),          // base
      b([-5, 3, -5], [5, 34, 5], M.marble),            // shaft
      b([-7, 34, -7], [7, 38, 7], M.goldLight),        // capital
      b([-7, 30, -7], [7, 31, 7], M.gold),             // necking band
    ],
  },

  arch_window: {
    label: 'Gothic arch window (lit)',
    parts: [
      b([-8, 0, -1], [8, 22, 1], M.stoneDeep),         // surround
      b([-6, 1, 0], [6, 20, 2], M.waterLight),              // glass
      b([-1, 1, 1], [1, 20, 2], M.stoneDeep),          // mullion
      b([-6, 10, 1], [6, 11, 2], M.stoneDeep),         // transom
      b([-8, 22, -1], [8, 25, 1], M.gold),             // arch cap
    ],
  },

  dais_step: {
    label: 'Raised dais step',
    parts: [
      b([-24, 0, -12], [24, 3, 12], M.marble),
      b([-24, 3, -12], [24, 4, 12], M.marbleMid),      // top surface
      b([-24, 3, 11], [24, 4, 12], M.gold),            // gold nosing
      b([-20, 3, -10], [20, 3.6, 10], M.carpet),       // carpet inset
    ],
  },

  wall_panel: {
    label: 'Dark wall panel (modular)',
    parts: [
      b([-16, 0, -1], [16, 24, 0], M.stoneDeep),
      b([-15, 1, 0], [15, 23, 1], M.velvet),           // inset field
      b([-16, 23, -1], [16, 25, 0], M.gold),           // cornice
      ...pair([-16, 0, -1], [-14, 24, 0], M.gold),     // pilaster trims
    ],
  },

  sconce: {
    label: 'Wall sconce (warm light)',
    parts: [
      b([-1, 0, -1], [1, 10, 1], M.gold),              // bracket stem
      b([-5, 8, -3], [5, 10, 3], M.goldLight),         // arm
      b([-4, 10, -3], [4, 15, 3], M.goldPale),         // flame shade
      b([-3, 15, -2], [3, 17, 2], '#FFD79A'),          // hot tip
    ],
  },

  neon_sign: {
    label: '"ON TRIAL" neon sign',
    parts: [
      b([-18, 0, -1], [18, 8, 1], M.ink),              // backing
      b([-17, 1, 0], [17, 7, 1], M.royal1),            // plate
      b([-15, 3, 0], [15, 5, 1], '#FF7AC6'),           // neon tube bar
      ...[-13, 13].map((x) => b([x, 1, 0], [x + 2, 7, 1], '#FF7AC6')),
    ],
  },

  banner_scales: {
    label: 'Hanging scales banner',
    parts: [
      b([-6, 0, -0.5], [6, 26, 0.5], M.velvet),        // main cloth
      ...pair([-6, 0, -0.5], [-5, 26, 0.5], M.gold),   // gold edges
      b([-6, 24, -0.5], [6, 26, 0.5], M.goldLight),    // top bar
      b([-4, 10, 0], [4, 20, 0.6], M.goldLight), // crest field
      b([-3, 14, 0.6], [3, 15, 0.8], M.goldPale),      // scales bar
      b([-1, 11, 0.6], [1, 15, 0.8], M.goldPale),
      b([-2, 0, -0.5], [2, 6, 0.5], M.velvet),         // pointed tail
    ],
  },

  stair_block: {
    label: 'Wide stair block',
    parts: [
      b([-20, 0, -10], [20, 3, 10], M.marble),
      b([-20, 3, -10], [20, 6, 4], M.marbleMid),
      b([-20, 6, -10], [20, 9, -2], M.marble),
      ...[-9, -3, 3, 9].map((x) => b([x, 6, -2], [x + 1, 6.6, 10], M.carpet)),
    ],
  },

  // ────────────────────────── village / courtyard ──────────────────────────
  fountain: {
    label: 'Two-tier stone fountain',
    parts: [
      b([-14, 0, -14], [14, 4, 14], M.marbleMid),      // outer basin
      b([-13, 4, -13], [13, 4.6, 13], M.water),        // water surface
      b([-4, 4, -4], [4, 8, 4], M.marble),             // pedestal
      b([-8, 8, -8], [8, 9, 8], M.marbleMid),          // upper bowl
      b([-7, 9, -7], [7, 9.6, 7], M.waterLight),
      b([-1, 9, -1], [1, 15, 1], M.marble),            // spout column
      b([-2, 15, -2], [2, 16, 2], M.goldLight),        // finial
    ],
  },

  lamp_post: {
    label: 'Street lamp post (lit)',
    parts: [
      b([-3, 0, -3], [3, 2, 3], M.stoneDeep),          // base
      b([-1, 2, -1], [1, 24, 1], M.ink),               // pole
      b([-4, 24, -4], [4, 26, 4], M.gold),             // lantern base
      b([-3, 26, -3], [3, 32, 3], '#FFE9A8'),          // glass (warm)
      b([-4, 32, -4], [4, 34, 4], M.goldLight),        // cap
      b([-1, 34, -1], [1, 36, 1], M.gold),             // finial
    ],
  },

  bench: {
    label: 'Park bench',
    parts: [
      b([-14, 0, -5], [14, 2, 5], M.wood),
      b([-14, 2, 2], [14, 4, 5], M.woodLight),         // seat
      b([-14, 4, -5], [14, 12, -3], M.woodLight),      // back
      b([-14, 12, -5], [14, 13, -3], M.wood),          // top rail
      ...pair([-14, 0, -5], [-12, 4, 5], M.ink),       // legs
    ],
  },

  barrel: {
    label: 'Wooden barrel',
    parts: [
      b([-5, 0, -5], [5, 12, 5], M.wood),
      b([-5.5, 3, -5.5], [5.5, 4, 5.5], M.gold), // band
      b([-5.5, 9, -5.5], [5.5, 10, 5.5], M.gold),
      b([-4, 12, -4], [4, 13, 4], M.woodLight),        // lid
    ],
  },

  crate: {
    label: 'Wooden crate',
    parts: [
      b([-5, 0, -5], [5, 10, 5], M.wood),
      b([-5, 0, -5], [5, 1, 5], M.woodLight),          // frame edges
      b([-5, 9, -5], [5, 10, 5], M.woodLight),
      ...pair([-5, 0, -5], [-4, 10, 5], M.woodLight),
      b([-5, 4, -5], [5, 5, 5], M.woodLight),          // cross plank
    ],
  },

  bookshelf: {
    label: 'Bookshelf (court library)',
    parts: [
      b([-10, 0, -4], [10, 26, 4], M.wood),            // carcass
      b([-10, 1, 3], [10, 25, 4], M.ink),              // dark back
      ...[[2, 8], [10, 16], [18, 24]].flatMap(([y0, y1]) => [
        b([-10, y0, -3], [10, y0 + 1, 4], M.woodLight), // shelf board
        b([-9, y0 + 1, -2], [-3, y1, 3], M.royal2),     // books
        b([-2, y0 + 1, -2], [2, y1 - 1, 3], M.goldLight),
        b([3, y0 + 1, -2], [9, y1, 3], M.teal),
      ]),
    ],
  },

  throne_chair: {
    label: 'Red velvet armchair / throne',
    parts: [
      b([-9, 0, -8], [9, 3, 8], M.wood),               // plinth
      b([-8, 3, -6], [8, 8, 6], M.velvet),             // seat
      b([-9, 8, -8], [9, 30, -6], M.velvet),           // high back
      b([-9, 30, -8], [9, 33, -6], M.gold),            // crest
      ...pair([-10, 8, -8], [-8, 16, 6], M.gold),      // arm frames
      b([-8, 16, -6], [8, 17, 6], M.goldLight),        // arm rails
      b([-2, 20, -7], [2, 24, -6], M.goldPale),        // emblem
    ],
  },

  judge_desk: {
    label: 'Wood desk with papers + scales',
    parts: [
      b([-14, 0, -8], [14, 3, 8], M.wood),             // base
      b([-15, 3, -9], [15, 5, 9], M.woodLight),        // top
      b([-15, 4, 8], [15, 5, 9], M.gold),              // front trim
      b([-8, 5, -6], [8, 6, -2], M.parchment),         // papers
      b([-3, 5, 1], [3, 5.6, 5], M.gold),              // small scales
      b([-1, 5.6, 3], [1, 9, 4], M.goldLight),
      ...pair([-6, 8, -7], [-5, 13, -6], M.wood),      // legs
    ],
  },

  trunk: {
    label: 'Treasure trunk / chest',
    parts: [
      b([-8, 0, -6], [8, 10, 6], M.wood),              // body
      b([-8, 10, -6], [8, 14, 6], M.woodLight),        // curved lid
      b([-8, 9.5, -6], [8, 11, 6], M.gold),            // lid band
      b([-1, 6, 6], [1, 10, 7], M.goldLight),          // clasp
      ...pair([-8, 0, -6], [-7, 12, 6], M.gold),       // corner strapping
    ],
  },

  tree_round: {
    label: 'Round leafy tree',
    parts: [
      b([-2, 0, -2], [2, 14, 2], M.wood),              // trunk
      b([-9, 12, -9], [9, 22, 9], M.leaf),             // canopy mass
      b([-7, 22, -7], [7, 27, 7], M.leafLight),
      b([-4, 27, -4], [4, 30, 4], M.grassLight),
    ],
  },

  tree_pine: {
    label: 'Pine tree',
    parts: [
      b([-2, 0, -2], [2, 8, 2], M.wood),
      b([-8, 6, -8], [8, 12, 8], M.leaf),
      b([-6, 12, -6], [6, 18, 6], M.leaf),
      b([-4, 18, -4], [4, 24, 4], M.leafLight),
      b([-1, 24, -1], [1, 27, 1], M.grassLight),
    ],
  },

  bush: {
    label: 'Shrub / hedge',
    parts: [
      b([-6, 0, -5], [6, 5, 5], M.leaf),
      b([-4, 5, -4], [4, 8, 4], M.leafLight),
    ],
  },

  flower_bed: {
    label: 'Flower bed with stone edging',
    parts: [
      b([-10, 0, -7], [10, 2, 7], M.marbleMid),        // edge
      b([-9, 2, -6], [9, 2.6, 6], M.grass),            // soil/grass
      ...[[-6, -3], [-6, 3], [0, 0], [5, -4], [5, 3]].map(([x, z]) =>
        b([x, 2.6, z], [x + 1, 4.6, z + 1], x > 2 ? M.velvet : M.goldLight)),
    ],
  },

  signpost: {
    label: 'Wooden signpost',
    parts: [
      b([-1, 0, -1], [1, 18, 1], M.wood),              // post
      b([-7, 12, -0.5], [7, 17, 0.5], M.woodLight),    // board
      b([-7, 14, 0.5], [7, 15, 0.8], M.gold),          // text bar
      b([-6, 16, 0.5], [4, 16.6, 0.8], M.gold),
    ],
  },

  market_stall: {
    label: 'Market stall with striped awning',
    parts: [
      b([-12, 0, -7], [12, 3, 7], M.wood),             // counter base
      b([-13, 3, -8], [13, 4.5, 8], M.woodLight),      // counter top
      ...pair([-12, 4.5, -7], [-10, 20, -5], M.wood),  // posts
      ...pair([-12, 4.5, 5], [-10, 20, 7], M.wood),
      // scalloped striped awning
      ...Array.from({ length: 8 }, (_, i) =>
        b([-13 + i * 3.25, 18, -9], [-13 + (i + 1) * 3.25, 20, 9], i % 2 ? M.velvet : M.parchment)),
      b([-1, 4.5, -4], [3, 8, 2], M.goldLight),        // goods
      b([-8, 4.5, -3], [-4, 7, 1], M.woodLight),
    ],
  },

  bunting: {
    label: 'Pennant bunting string',
    parts: [
      b([-20, 14, -0.3], [20, 14.6, 0.3], M.ink),      // cord
      ...Array.from({ length: 9 }, (_, i) => {
        const x = -18 + i * 4.5;
        const col = [M.velvet, M.goldLight, M.teal, M.parchment][i % 4];
        return b([x, 8, -0.2], [x + 3, 14, 0.2], col);
      }),
    ],
  },

  cart: {
    label: 'Two-wheel cart',
    parts: [
      b([-10, 4, -6], [10, 7, 6], M.wood),             // bed
      b([-10, 7, -6], [10, 12, -5], M.woodLight),      // side rail
      b([-10, 7, 5], [10, 12, 6], M.woodLight),
      ...pair([-9, 7, -6], [-8, 12, 6], M.wood),
      b([-1, 7, -8], [1, 14, -6], M.wood),             // handle
      ...[-7, 7].map((z) => b([-3, 0, z - 1], [3, 6, z + 1], M.ink)), // wheels (simplified)
    ],
  },

  // ───────────────────── trial-moment props (art bible part 3) ─────────────────────
  ballot_paper: {
    label: 'Ballot paper ("Secret Verdict Scroll"), half-folded',
    parts: [
      b([-5, 0, -7], [5, 0.4, 0], M.parchment),                // lower half, flat
      b([-5, 0.4, 0], [5, 4.4, 0.4], M.parchment),             // upper half, folded up
      b([-4, 0.4, -6], [-1, 0.6, -3], M.velvet),               // GUILTY tick box
      b([1, 0.4, -6], [4, 0.6, -3], M.teal),                   // NOT COOKED tick box
      b([-4, 0.4, -2], [4, 0.6, -1.4], M.ink),                 // signature line
      b([-3, 1.4, 0.4], [3, 3.4, 0.7], M.goldPale),            // crest on the fold
    ],
  },

  ballot_envelope: {
    label: 'Sealed ballot envelope (commit phase)',
    parts: [
      b([-7, 0, -4.5], [7, 1, 4.5], M.parchment),              // body
      b([-7, 1, -4.5], [7, 1.3, 0], M.woodLight),              // flap shadow
      b([-5, 1, -0.2], [5, 1.4, 1.6], M.parchment),            // flap tip
      b([-2, 1.3, -1.6], [2, 2.3, 1.6], M.velvet),             // wax seal
      b([-1, 2.3, -0.6], [1, 2.6, 0.6], M.velvetLight),        // seal emboss
    ],
  },

  case_stamp: {
    label: 'Case-number rubber stamp',
    parts: [
      b([-5, 0, -3], [5, 1.2, 3], M.ink),                      // rubber face
      b([-5.4, 1.2, -3.4], [5.4, 4, 3.4], M.wood),             // block
      b([-5.4, 3.6, -3.4], [5.4, 4, 3.4], M.gold),             // brass band
      b([-1.4, 4, -1.4], [1.4, 10, 1.4], M.woodLight),         // neck
      b([-3, 10, -3], [3, 14, 3], M.velvet),                   // knob
      b([-2, 14, -2], [2, 14.6, 2], M.velvetLight),
    ],
  },

  settlement_receipt: {
    label: 'Settlement receipt slip (curled)',
    parts: [
      b([-4, 0, -9], [4, 0.3, 6], M.parchment),                // slip
      b([-4, 0.3, 6], [4, 2.3, 6.4], M.parchment),             // curl
      b([-4, 2.3, 4.6], [4, 2.6, 6.4], M.parchment),
      ...[-6, -4, -2, 0, 2].map((z) => b([-3, 0.3, z], [z === 2 ? 3 : 1, 0.45, z + 0.6], M.ink)), // printed lines
      b([-3, 0.3, 4], [3, 0.45, 4.8], M.velvet),               // total line
      b([-4, 0, -9.6], [4, 0.3, -9], M.goldPale),              // torn edge
    ],
  },

  podium_mic: {
    label: 'Podium microphone (press / witness)',
    parts: [
      b([-4, 0, -4], [4, 1, 4], M.stoneDeep),                  // weighted base
      b([-0.5, 1, -0.5], [0.5, 14, 0.5], M.stoneDark),         // stand
      b([-0.5, 13, -0.5], [0.5, 14, 5], M.stoneDark),          // gooseneck, toward the speaker
      b([-1.2, 12.4, 4], [1.2, 15.4, 8], M.ink),               // mic body
      b([-1.4, 12.2, 7.6], [1.4, 15.6, 8.4], M.goldLight),     // grille ring
      b([-1, 12.6, 8.4], [1, 15.2, 8.8], M.stone),             // grille
    ],
  },

  potted_plant: {
    label: 'Potted plant (corner dressing)',
    parts: [
      b([-4, 0, -4], [4, 7, 4], M.velvet),                     // pot
      b([-4.6, 6, -4.6], [4.6, 8, 4.6], M.gold),               // rim
      b([-3.6, 7, -3.6], [3.6, 7.6, 3.6], M.wood),             // soil
      b([-0.6, 7.6, -0.6], [0.6, 12, 0.6], M.grassDark),       // stem
      b([-4, 11, -4], [4, 17, 4], M.leaf),                     // canopy
      b([-3, 16, -3], [3, 20, 3], M.leafLight),
      b([-5, 12, -2], [-4, 16, 2], M.leaf),
      b([4, 12, -2], [5, 16, 2], M.leaf),
    ],
  },
};

import { DETAILS } from './detail.mjs';

// Merge the detail layer into each prop so consumers see one box list.
for (const k of Object.keys(DETAILS)) {
  if (!PROPS[k]) continue;
  PROPS[k].parts = PROPS[k].parts.concat(DETAILS[k]);
  PROPS[k].boxes = PROPS[k].parts.length;
}

export const PROP_NAMES = Object.keys(PROPS);

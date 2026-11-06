/**
 * The wardrobe: a player's look as a combination of parts (skin, hair,
 * outfit, accessory, effect, and two colours), built at runtime into a voxel
 * model in the cast format. Nothing here is drawn from cc-art: every part is a
 * handful of boxes in model units (1 voxel, feet at y 0, face toward −Z,
 * right hand at +X), sized like the chibi cast so it shares the rig.
 *
 * Colours come only from the style-guide palette. A look with no save behind
 * it is rolled from a seed (`randomLook`), so every new player arrives dressed.
 */
import { C, SWATCHES } from './palette';
import type { CastFile, CastModel, CastRow } from './cast';
import type { PlayerLook } from './types';


export const SKINS = [C.gold100, C.neutral300, C.neutral500, C.gold700, C.neutral700, C.neutral900] as const;
export const HAIR_COLORS = [C.neutral900, C.gold900, C.gold500, C.gold300, C.royal700, C.neutral100, C.blue900, C.teal700] as const;
export const OUTFIT_COLORS = [C.neutral900, C.blue900, C.blue700, C.neutral100, C.neutral300, C.gold700, C.teal900, C.royal900, C.royal700, C.green900] as const;

export const HAIRS = ['messy', 'short', 'long', 'buzz', 'bun', 'mohawk', 'curly'] as const;
export const OUTFITS = ['suit', 'robe', 'hoodie', 'tee', 'coat', 'vest'] as const;
export const ACCESSORIES = ['none', 'glasses', 'shades', 'cap', 'wig', 'crown', 'headphones'] as const;
export const EFFECTS = ['none', 'aura', 'halo', 'sparkles', 'embers'] as const;

export type HairStyle = (typeof HAIRS)[number];
export type Outfit = (typeof OUTFITS)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type Effect = (typeof EFFECTS)[number];

export const DEFAULT_LOOK: PlayerLook = { skin: 1, hair: 'messy', hairColor: 0, outfit: 'suit', outfitColor: 0, accessory: 'none', effect: 'none' };

/** Clamp a stored look to valid options (old saves, hand-edited storage). */
export function normalizeLook(input: Partial<PlayerLook> | null | undefined): PlayerLook {
  const l = input ?? {};
  const idx = (n: unknown, len: number, d: number) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < len ? n : d);
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);
  return {
    skin: idx(l.skin, SKINS.length, DEFAULT_LOOK.skin),
    hair: pick(l.hair, HAIRS, 'messy'),
    hairColor: idx(l.hairColor, HAIR_COLORS.length, DEFAULT_LOOK.hairColor),
    outfit: pick(l.outfit, OUTFITS, 'suit'),
    outfitColor: idx(l.outfitColor, OUTFIT_COLORS.length, DEFAULT_LOOK.outfitColor),
    accessory: pick(l.accessory, ACCESSORIES, 'none'),
    effect: pick(l.effect, EFFECTS, 'none'),
  };
}

function rand(seed: number, i: number): number {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** A full outfit from a seed: the "Randomize" button, and the look a new player arrives in. */
export function randomLook(seed: number): PlayerLook {
  const at = <T>(list: readonly T[], i: number) => list[Math.floor(rand(seed, i) * list.length)]!;
  return {
    skin: Math.floor(rand(seed, 1) * SKINS.length),
    hair: at(HAIRS, 2),
    hairColor: Math.floor(rand(seed, 3) * HAIR_COLORS.length),
    outfit: at(OUTFITS, 4),
    outfitColor: Math.floor(rand(seed, 5) * OUTFIT_COLORS.length),
    // Most people arrive without a hat; effects are earned flair, so none by default.
    accessory: rand(seed, 6) < 0.55 ? 'none' : at(ACCESSORIES, 7),
    effect: 'none',
  };
}

/** Stable key for caching the built model. */
export function lookKey(l: PlayerLook): string {
  return `${l.skin}.${l.hair}.${l.hairColor}.${l.outfit}.${l.outfitColor}.${l.accessory}`;
}

/* ── Model building ─────────────────────────────────────────────────── */

const G = { body: 0, head: 1, armR: 2, armL: 3, legR: 4, legL: 5 } as const;
type Group = (typeof G)[keyof typeof G];

class Rows {
  readonly rows: number[][] = [];
  constructor(readonly color: (hex: string) => number) {}
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string, g: Group): void {
    this.rows.push([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), this.color(hex), g]);
  }
  /** Mirror a box across x = 0 too (both sides of the face or body). */
  pair(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string, g: Group, gMirror: Group = g): void {
    this.box(x0, y0, z0, x1, y1, z1, hex, g);
    this.box(-x1, y0, z0, -x0, y1, z1, hex, gMirror);
  }
}

interface Paint {
  skin: string;
  hair: string;
  cloth: string;
  pants: string;
  shoes: string;
  shirt: string;
}

function paint(l: PlayerLook): Paint {
  const cloth = OUTFIT_COLORS[l.outfitColor]!;
  const darkCloth = cloth === C.neutral900 || cloth === C.blue900 || cloth === C.teal900 || cloth === C.royal900 || cloth === C.green900;
  const jeans = cloth === C.blue900 ? C.neutral900 : C.blue900;
  const pants = l.outfit === 'tee' || l.outfit === 'hoodie' ? jeans : l.outfit === 'coat' ? C.neutral900 : l.outfit === 'vest' ? (darkCloth ? cloth : C.neutral700) : cloth;
  return {
    skin: SKINS[l.skin]!,
    hair: HAIR_COLORS[l.hairColor]!,
    cloth,
    pants,
    shoes: l.outfit === 'tee' || l.outfit === 'hoodie' ? C.neutral100 : C.neutral900,
    shirt: cloth === C.neutral100 ? C.neutral300 : C.neutral100,
  };
}

function head(r: Rows, l: PlayerLook, p: Paint, dy = 0): void {
  const y = (v: number) => v + dy;
  const H = G.head;
  r.box(-12.5, y(70), -11.5, 12.5, y(96), 11.5, p.skin, H);
  // Eyes: white, pupil low and inward (the chibi glance), brows in hair colour.
  r.pair(3, y(80), -12.1, 8, y(86), -11.5, C.neutral100, H);
  r.pair(3.4, y(80), -12.4, 5.8, y(85), -12.1, C.neutral900, H);
  r.pair(3.4, y(84), -12.5, 4.4, y(85), -12.4, C.neutral100, H);
  r.pair(2.6, y(87.4), -12.3, 8.4, y(88.8), -11.5, p.hair, H);
  r.box(-2.4, y(75.4), -12.1, 2.4, y(76.8), -11.5, C.royal900, H);
  r.pair(7.2, y(77), -11.9, 10, y(78.6), -11.5, C.royal500, H);
  r.pair(12.5, y(80), -1.5, 13.4, y(85), 1.5, p.skin, H);

  // Hair.
  const c = p.hair;
  switch (l.hair as HairStyle) {
    case 'buzz':
      r.box(-12.9, y(95), -11.9, 12.9, y(97.6), 11.9, c, H);
      r.box(-12.9, y(88), 8, 12.9, y(95), 11.9, c, H);
      break;
    case 'mohawk':
      r.box(-12.9, y(94), -11.9, 12.9, y(96.4), 11.9, c, H);
      r.box(-2.6, y(96), -12, 2.6, y(106), 11, c, H);
      r.box(-2, y(100), 11, 2, y(104), 13, c, H);
      break;
    case 'curly': {
      r.box(-13.4, y(91), -12.4, 13.4, y(100), 12.6, c, H);
      for (let i = 0; i < 9; i++) {
        const x = -12 + (i % 5) * 6;
        const z = i < 5 ? -8 : 4;
        r.box(x - 2.6, y(99), z - 2.6, x + 2.6, y(103 + (i % 2) * 2), z + 2.6, c, H);
      }
      r.pair(12.4, y(78), -10, 14.6, y(98), 12.6, c, H);
      r.box(-13.4, y(74), 9, 13.4, y(94), 12.8, c, H);
      break;
    }
    default: {
      // Cap of hair over the crown and the back of the head, sides over the ears.
      r.box(-13.2, y(92), -12.2, 13.2, y(99.5), 12.4, c, H);
      const back = l.hair === 'long' ? 54 : l.hair === 'short' ? 84 : 78;
      r.box(-13.2, y(back), 9, 13.2, y(96), 12.6, c, H);
      const side = l.hair === 'long' ? 66 : l.hair === 'short' ? 86 : 82;
      r.pair(12.4, y(side), -9, 13.6, y(96), 12.4, c, H);
      if (l.hair === 'long') r.pair(11.5, y(56), 5, 13.8, y(70), 12.6, c, H);
      // Fringe, notched for messy, clean for short and long.
      if (l.hair === 'messy') {
        r.box(-12.8, y(90), -12.7, -5, y(94.5), -10.5, c, H);
        r.box(-5, y(88.6), -12.7, 1, y(94.5), -10.5, c, H);
        r.box(1, y(91), -12.7, 8, y(94.5), -10.5, c, H);
        r.box(8, y(89.6), -12.7, 12.8, y(94.5), -10.5, c, H);
        // Spikes.
        r.box(-9, y(99), -6, -3, y(104), 0, c, H);
        r.box(-1, y(99), -9, 5, y(105.5), -3, c, H);
        r.box(4, y(99), 1, 10, y(103), 7, c, H);
        r.box(-6, y(99), 3, 0, y(102.6), 9, c, H);
      } else {
        r.box(-12.8, y(91.5), -12.6, 12.8, y(94.5), -10.5, c, H);
        r.box(-12.8, y(89), -12.6, -6, y(91.5), -10.5, c, H);
      }
      if (l.hair === 'bun') {
        r.box(-4.6, y(99), 1, 4.6, y(107), 9, c, H);
        r.box(-5, y(98.5), 0.6, 5, y(100), 9.4, C.royal500, H);
      }
    }
  }

  // Accessory.
  switch (l.accessory as Accessory) {
    case 'glasses':
      for (const s of [-1, 1]) {
        const x0 = s * 2.4;
        const x1 = s * 9;
        r.box(x0, y(79), -12.9, x1, y(79.9), -12.3, C.neutral900, H);
        r.box(x0, y(86), -12.9, x1, y(86.9), -12.3, C.neutral900, H);
        r.box(x0, y(79), -12.9, x0 + s * 0.9, y(86.9), -12.3, C.neutral900, H);
        r.box(x1 - s * 0.9, y(79), -12.9, x1, y(86.9), -12.3, C.neutral900, H);
        r.box(x1, y(84.5), -12.6, s * 13.2, y(85.5), 4, C.neutral900, H);
      }
      r.box(-2.4, y(84), -12.9, 2.4, y(85), -12.3, C.neutral900, H);
      break;
    case 'shades':
      r.box(-9.6, y(79.4), -12.9, 9.6, y(86.4), -12.2, C.neutral900, H);
      r.box(-8.4, y(84.2), -13, -6.4, y(85.4), -12.8, C.blue300, H);
      r.box(3.6, y(84.2), -13, 5.6, y(85.4), -12.8, C.blue300, H);
      r.pair(9.6, y(84.4), -12.6, 13.3, y(85.6), 4, C.neutral900, H);
      break;
    case 'cap':
      r.box(-13.8, y(95), -12.8, 13.8, y(103), 12.8, p.cloth === C.neutral100 ? C.royal700 : p.cloth, H);
      r.box(-11.5, y(95), -21, 11.5, y(96.6), -12.6, p.cloth === C.neutral100 ? C.royal700 : p.cloth, H);
      r.box(-3, y(97), -13.2, 3, y(101.5), -12.8, C.neutral100, H);
      r.box(-1, y(103), -1, 1, y(104.2), 1, C.gold300, H);
      break;
    case 'wig':
      // The judge's powdered wig: curled rolls down both sides, a queue at the back.
      r.box(-14.4, y(94), -12.8, 14.4, y(103), 13, C.neutral100, H);
      for (let i = 0; i < 4; i++) r.pair(13, y(76 + i * 5), -8, 16, y(80 + i * 5), 12, i % 2 ? C.neutral300 : C.neutral100, H);
      r.box(-4, y(66), 12, 4, y(92), 15, C.neutral100, H);
      r.box(-4.4, y(70), 14.6, 4.4, y(72), 15.4, C.neutral900, H);
      break;
    case 'crown':
      r.box(-11.4, y(99), -10.4, 11.4, y(102.6), 10.4, C.gold300, H);
      for (const [x, z] of [[-9, -8], [0, -10], [9, -8], [-9, 8], [9, 8], [0, 10]] as const) r.box(x - 1.6, y(102.6), z - 1, x + 1.6, y(106.6), z + 1, C.gold300, H);
      r.box(-1.6, y(100), -10.9, 1.6, y(102.2), -10.4, C.royal700, H);
      break;
    case 'headphones':
      r.box(-14.2, y(99), -2, 14.2, y(101.4), 2, C.neutral900, H);
      r.pair(12.8, y(92), -2, 14.2, y(99), 2, C.neutral900, H);
      r.pair(12.8, y(78), -5, 16, y(92), 5, C.neutral900, H);
      r.pair(16, y(81), -3, 16.6, y(89), 3, C.teal500, H);
      break;
    default:
      break;
  }
}

function torso(r: Rows, l: PlayerLook, p: Paint, dy = 0): void {
  const y = (v: number) => v + dy;
  const B = G.body;
  const cloth = p.cloth;
  const outfit = l.outfit as Outfit;
  r.box(-13, y(38), -7, 13, y(70), 7, outfit === 'vest' ? p.shirt : cloth, B);
  switch (outfit) {
    case 'suit':
      r.box(-3.2, y(52), -7.5, 3.2, y(70), -7, p.shirt, B);
      r.box(-1.4, y(48), -7.9, 1.4, y(69), -7.4, C.royal700, B);
      r.box(-2, y(66), -8, 2, y(69.4), -7.4, C.royal700, B);
      r.pair(3.2, y(54), -7.6, 5.6, y(70), -7, cloth === C.neutral900 ? C.neutral700 : C.neutral900, B);
      r.box(5.6, y(60), -7.6, 9, y(61.2), -7, C.neutral100, B);
      r.box(-0.8, y(42), -7.6, 0.8, y(43.6), -7.1, C.gold300, B);
      break;
    case 'robe':
      r.box(-13.4, y(8), -7.4, 13.4, y(40), 7.4, cloth, B);
      r.box(-2, y(8), -7.9, 2, y(70), -7.3, C.gold300, B);
      r.box(-3.2, y(60), -8.2, 3.2, y(70), -7.4, C.neutral100, B);
      r.box(-13.6, y(66), -7.6, 13.6, y(70.6), 7.6, C.gold300, B);
      break;
    case 'hoodie':
      r.box(-7.5, y(42), -7.6, 7.5, y(51), -7, C.neutral900, B);
      r.box(-6.6, y(42.8), -7.8, 6.6, y(50.2), -7.4, cloth, B);
      r.pair(1.6, y(56), -7.8, 2.6, y(66), -7.2, C.neutral100, B);
      r.box(-13, y(66), -7.6, 13, y(70.4), 7.6, cloth, B);
      // Hood resting on the back.
      r.box(-11, y(58), 7, 11, y(72), 11, cloth, B);
      break;
    case 'tee':
      r.box(-5, y(54), -7.6, 5, y(64), -7, C.gold300, B);
      r.box(-3.4, y(55.4), -7.9, 3.4, y(62.6), -7.5, C.royal700, B);
      r.box(-4, y(68), -7.4, 4, y(70.2), -7, p.skin, B);
      break;
    case 'coat':
      r.pair(0.4, y(14), -7.6, 13.6, y(40), 7.6, cloth, B);
      r.box(-13.4, y(44), -7.6, 13.4, y(47), 7.6, C.neutral900, B);
      r.box(-1.6, y(44.4), -7.9, 1.6, y(46.6), -7.5, C.gold300, B);
      r.pair(3, y(58), -7.8, 7, y(70.4), -7.2, cloth === C.neutral300 ? C.gold700 : C.neutral300, B);
      r.pair(1.4, y(50), -7.8, 3, y(56), -7.4, C.gold300, B);
      break;
    case 'vest':
      r.pair(1.2, y(40), -7.6, 13.2, y(66), 7.6, cloth, B);
      r.box(-1.2, y(40), -7.4, 1.2, y(64), -7, C.royal700, B);
      r.pair(7, y(50), -7.9, 9, y(51), -7.5, C.gold300, B);
      r.box(-13, y(38), -7.4, 13, y(40), 7.4, C.neutral900, B);
      break;
  }
}

function limbs(r: Rows, l: PlayerLook, p: Paint, seated: boolean): void {
  const dy = seated ? -13 : 0;
  const y = (v: number) => v + dy;
  const outfit = l.outfit as Outfit;
  const sleeve = outfit === 'vest' ? p.shirt : p.cloth;
  // Arms (right at +X).
  for (const [s, g] of [[1, G.armR], [-1, G.armL]] as const) {
    const x0 = s * 13.8;
    const x1 = s * 21.8;
    const wide = outfit === 'robe' ? 1.6 : 0;
    if (outfit === 'tee') {
      r.box(x0 - s * wide, y(56), -4.6, x1 + s * wide, y(68), 4.6, sleeve, g);
      r.box(x0, y(36), -3.8, x1, y(56), 3.8, p.skin, g);
    } else {
      r.box(x0 - s * wide, y(37), -4.6 - wide, x1 + s * wide, y(68), 4.6 + wide, sleeve, g);
      r.box(x0, y(37), -4.8, x1, y(39), 4.8, outfit === 'robe' ? C.gold300 : p.shirt, g);
    }
    r.box(x0 + s * 0.6, y(31), -3.4, x1 - s * 0.6, y(37), 3.4, p.skin, g);
  }
  if (!seated) {
    // Legs (animate at the hip).
    for (const [s, g] of [[1, G.legR], [-1, G.legL]] as const) {
      r.box(s * 1.2, 5, -6.4, s * 12.4, 38.5, 6.4, p.pants, g);
      r.box(s * 1, 0, -8.6, s * 12.6, 5, 6.6, p.shoes, g);
      r.box(s * 1, 4.6, -8.8, s * 12.6, 5.4, -6, p.shoes === C.neutral100 ? C.royal700 : C.gold900, g);
    }
    return;
  }
  // Seated: thighs forward on the seat, shins down to the floor. Static, so they ride the body.
  for (const s of [1, -1]) {
    r.box(s * 1.2, 18.5, -20, s * 12.4, 31.5, 6.4, p.pants, G.body);
    r.box(s * 1.2, 5, -20, s * 12.4, 18.5, -8, p.pants, G.body);
    r.box(s * 1, 0, -22.4, s * 12.6, 5, -7.6, p.shoes, G.body);
  }
}

function buildRows(l: PlayerLook, color: (hex: string) => number, seated: boolean): CastRow[] {
  const r = new Rows(color);
  const p = paint(l);
  const dy = seated ? -13 : 0;
  torso(r, l, p, dy);
  head(r, l, p, dy);
  limbs(r, l, p, seated);
  if (seated && l.outfit === 'robe') {
    // The robe drapes over the lap.
    r.box(-13.4, 18, -20.4, 13.4, 31.8, 7.4, p.cloth, G.body);
  }
  return r.rows;
}

/** Height in voxels, including the tallest hair or hat. */
function heightOf(rows: readonly CastRow[]): number {
  return rows.reduce((h, row) => Math.max(h, row[4]!), 0);
}

/**
 * The cast plus this look as model `id`, with any palette swatches the cast
 * lacks appended to its colours. Returns a new CastFile (cast objects are
 * cache keys for geometry, so a new look never reuses a stale mesh).
 */
export function castWithLook(cast: CastFile, look: PlayerLook, id = 'player'): CastFile {
  const colors = [...cast.colors];
  const index = new Map(colors.map((c, i) => [c.toUpperCase(), i]));
  const color = (hex: string) => {
    const k = hex.toUpperCase();
    let i = index.get(k);
    if (i === undefined) {
      i = colors.length;
      colors.push(k);
      index.set(k, i);
    }
    return i;
  };
  const l = normalizeLook(look);
  const stand = buildRows(l, color, false);
  const sit = buildRows(l, color, true);
  const model: CastModel = { label: 'Player', height: heightOf(stand), stand, sit };
  return { ...cast, colors, models: { ...cast.models, [id]: model } };
}

/** Every option, for the wardrobe UI and for tests. */
export const LOOK_OPTIONS = {
  skins: SKINS,
  hairs: HAIRS,
  hairColors: HAIR_COLORS,
  outfits: OUTFITS,
  outfitColors: OUTFIT_COLORS,
  accessories: ACCESSORIES,
  effects: EFFECTS,
} as const;

/** Palette check for tests: every colour a look can use is a style-guide swatch. */
export const LOOK_SWATCHES: readonly string[] = [...new Set([...SKINS, ...HAIR_COLORS, ...OUTFIT_COLORS])].filter((c) => (SWATCHES as readonly string[]).includes(c));

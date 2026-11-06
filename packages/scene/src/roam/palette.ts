/**
 * The 30-swatch CringeCourt palette (docs/STYLE-GUIDE.md §1) and the remap every
 * in-world colour goes through. The courtroom and character generators in cc-art
 * still carry some pre-guide hexes; the roam world never shows them raw: each is
 * mapped through the style guide's §7 table, then a hand-tuned table for
 * character design colours, then nearest swatch (CIE Lab distance).
 */

export const PALETTE = {
  royal: ['#7A1C2E', '#A32D3F', '#CE4A44', '#E07A3F', '#FFD79A'],
  teal: ['#2E5F73', '#3F8FA8', '#58B7C6', '#8EDBC8', '#F0F8E7'],
  gold: ['#8B5E2A', '#B77D3A', '#D9A046', '#F6C75B', '#FFF2C7'],
  neutral: ['#4A3A32', '#7B645A', '#A9917D', '#DCC8B0', '#FFF9ED'],
  green: ['#1F5B3A', '#3E7F50', '#6EBF73', '#A9D98F', '#DFF3D6'],
  blue: ['#2F4F8F', '#4D7CC5', '#7FA9E6', '#BFD7F5', '#EAF4FF'],
} as const;

export type PaletteHex = (typeof PALETTE)[keyof typeof PALETTE][number];

export const SWATCHES: readonly PaletteHex[] = Object.values(PALETTE).flat();

/**
 * Named swatches, with the web token names (apps/web/src/ds/tokens.ts:
 * `--cc-royal-900` is `C.royal900`). Every colour the roam world, renderer and
 * HUD use comes from here: this module is roam's token layer, and no other roam
 * file may hold a colour literal (enforced in apps/web/src/ds/tokens.test.ts).
 */
const STEPS = [900, 700, 500, 300, 100] as const;
type Family = keyof typeof PALETTE;
type Step = (typeof STEPS)[number];
export type SwatchName = `${Family}${Step}`;

export const C = Object.fromEntries(
  (Object.keys(PALETTE) as Family[]).flatMap((family) => STEPS.map((step, i) => [`${family}${step}`, PALETTE[family][i]])),
) as Readonly<Record<SwatchName, PaletteHex>>;

/** A swatch with alpha, as CSS `rgb(r g b / a)`: the only way to get a translucent colour. */
export function alpha(hex: PaletteHex, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

/**
 * Source-art colours the world code matches on before the remap (cc-art's
 * courtroom generator output). They never reach the screen raw.
 */
export const ART = {
  /** The bench windows' glass in the cutaway. */
  windowGlass: '#BDF5FF',
} as const;

const SWATCH_SET = new Set<string>(SWATCHES);

export function isPaletteColor(hex: string): hex is PaletteHex {
  return SWATCH_SET.has(hex.toUpperCase());
}

/** STYLE-GUIDE §7 plus explicit choices for colours the guide leaves to "the art pass". */
export const REMAP: Readonly<Record<string, PaletteHex>> = {
  // §7
  '#140E1A': '#4A3A32',
  '#2A1636': '#7A1C2E',
  '#3A2A24': '#4A3A32',
  '#3FB8C9': '#3F8FA8',
  '#F08A3C': '#E07A3F',
  '#6B4CA8': '#2E5F73',
  '#6E1B2A': '#7A1C2E',
  '#C0392B': '#A32D3F',
  '#FF4FB8': '#A32D3F',
  '#FFF6E4': '#FFF9ED',
  '#FFF8EC': '#FFF9ED',
  // glows: neon pink → gold glow (§7), window glass → sky
  '#FF7AC6': '#F6C75B',
  '#BDF5FF': '#BFD7F5',
  // ink / outline / near-black hair
  '#241A22': '#4A3A32',
  '#1A1620': '#4A3A32',
  '#1A1A1A': '#4A3A32',
  '#0E0E0E': '#4A3A32',
  '#2A2422': '#4A3A32',
  '#232A44': '#2F4F8F',
  '#151A2C': '#2E5F73',
  '#3A4468': '#4D7CC5',
  // skin ramp: light → deep, kept warm and distinct
  '#FBE0C8': '#FFD79A',
  '#F5D2B4': '#FFD79A',
  '#F3D5BD': '#FFD79A',
  '#E8C4A8': '#DCC8B0',
  '#D2A98C': '#A9917D',
  '#B48A6C': '#B77D3A',
  '#C49A7A': '#B77D3A',
  '#B98560': '#B77D3A',
  '#A87B5C': '#8B5E2A',
  '#8B5E42': '#8B5E2A',
  '#7C5842': '#7B645A',
  '#5E3E2B': '#4A3A32',
  // character accents
  '#E87DB4': '#CE4A44',
  '#C05C90': '#A32D3F',
  '#FFA8D0': '#FFD79A',
  '#F08CBE': '#E07A3F',
  '#FFB4D8': '#FFD79A',
  '#3F6FB5': '#4D7CC5',
  '#264A85': '#2F4F8F',
  '#6FA3E0': '#7FA9E6',
  '#5FD3E0': '#58B7C6',
  '#A8F0F8': '#8EDBC8',
  '#3A9AA6': '#3F8FA8',
  '#452F75': '#2E5F73',
  '#8E72C8': '#3F8FA8',
  '#8E3B42': '#A32D3F',
  '#7A3340': '#7A1C2E',
  '#D2686E': '#CE4A44',
  '#4E2F1A': '#4A3A32',
  '#6B4226': '#8B5E2A',
  '#8B5A34': '#B77D3A',
  '#E4E1DA': '#FFF9ED',
  '#C2BFB7': '#DCC8B0',
  '#9A968E': '#A9917D',
  '#FFFFFF': '#FFF9ED',
  '#E8D6BC': '#DCC8B0',
  '#A97C2A': '#8B5E2A',
  '#E6D08A': '#F6C75B',
  '#C4AE68': '#D9A046',
};

type Lab = readonly [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toLab(hex: string): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex).map(lin) as [number, number, number];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const SWATCH_LAB = SWATCHES.map((s) => [s, toLab(s)] as const);
const cache = new Map<string, PaletteHex>();

/** Map any #RRGGBB to a palette swatch. Total and deterministic. */
export function toPalette(hex: string): PaletteHex {
  const key = hex.toUpperCase();
  const hit = cache.get(key);
  if (hit) return hit;
  let out: PaletteHex;
  if (isPaletteColor(key)) out = key as PaletteHex;
  else if (REMAP[key]) out = REMAP[key]!;
  else {
    const lab = toLab(key);
    let best = SWATCH_LAB[0]!;
    let bestD = Infinity;
    for (const entry of SWATCH_LAB) {
      const d = (entry[1][0] - lab[0]) ** 2 + (entry[1][1] - lab[1]) ** 2 + (entry[1][2] - lab[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = entry;
      }
    }
    out = best[0];
  }
  cache.set(key, out);
  return out;
}

/** Colours that glow (unlit in the renderer). */
export const GLOW: ReadonlySet<string> = new Set(['#F6C75B', '#BFD7F5']);

/** Source colours that are light sources in the art (before remap). */
export const EMISSIVE_SOURCES: ReadonlySet<string> = new Set(['#BDF5FF', '#FFD79A', '#FF7AC6']);

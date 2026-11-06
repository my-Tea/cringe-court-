/**
 * CringeCourt design tokens: the single source of truth.
 *
 * `npm run tokens` turns this file into src/ds/tokens.css (CSS custom properties,
 * prefix `--cc-`). Components only ever read the CSS variables; TypeScript reads
 * this module for the gallery and the contrast tests.
 *
 * Grounding: docs/STYLE-GUIDE.md (canonical) and its source image
 * docs/assets/style-guide.png, "CringeCourt: Your Honor, Bro Is Cooked."
 *   - The 30 printed hex labels of the style guide are the ONLY colours. Every
 *     role below points at one of them; shadows and tints are those same colours
 *     with alpha (see `alpha`). No other hex may appear in the app.
 *   - Parchment (warm cream) is the default surface; maroon and gold carry the
 *     brand; teal is secondary/info, green is success, blue is sky/environment.
 *   - Wood is the deep maroon-and-wood variant for stages, toasts and tooltips.
 */

/* ── Raw palette ────────────────────────────────────────────────────────── */

/** The style-guide swatches, each ramp dark (900) to light (100), in printed order. */
export const palette = {
  royal: { 900: '#7A1C2E', 700: '#A32D3F', 500: '#CE4A44', 300: '#E07A3F', 100: '#FFD79A' },
  teal: { 900: '#2E5F73', 700: '#3F8FA8', 500: '#58B7C6', 300: '#8EDBC8', 100: '#F0F8E7' },
  gold: { 900: '#8B5E2A', 700: '#B77D3A', 500: '#D9A046', 300: '#F6C75B', 100: '#FFF2C7' },
  neutral: { 900: '#4A3A32', 700: '#7B645A', 500: '#A9917D', 300: '#DCC8B0', 100: '#FFF9ED' },
  green: { 900: '#1F5B3A', 700: '#3E7F50', 500: '#6EBF73', 300: '#A9D98F', 100: '#DFF3D6' },
  blue: { 900: '#2F4F8F', 700: '#4D7CC5', 500: '#7FA9E6', 300: '#BFD7F5', 100: '#EAF4FF' },
} as const;

/** Style-guide group names, for the gallery and docs. */
export const paletteGroups: Readonly<Record<keyof typeof palette, string>> = {
  royal: 'Royal',
  teal: 'Accents (teal)',
  gold: 'Golds',
  neutral: 'Neutrals',
  green: 'Greens',
  blue: 'Blues (env)',
};

/** A palette colour with alpha, as `rgb(r g b / a)`. The only way to get a translucent colour. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

/* ── Semantic colour roles ──────────────────────────────────────────────── */

export const colorRoles = [
  'canvas',
  'surface',
  'surface-raised',
  'surface-sunken',
  'scrim',
  'text',
  'text-muted',
  'text-subtle',
  'border',
  'border-strong',
  'frame',
  'frame-light',
  'frame-dark',
  'accent',
  'accent-hover',
  'accent-pressed',
  'accent-shadow',
  'accent-text',
  'on-accent',
  'secondary',
  'secondary-hover',
  'secondary-text',
  'highlight',
  'on-highlight',
  'highlight-shadow',
  'danger',
  'danger-hover',
  'danger-shadow',
  'danger-text',
  'on-danger',
  'danger-surface',
  'success-text',
  'success-surface',
  'warning-text',
  'warning-surface',
  'info-text',
  'info-surface',
  'focus',
  'guilty',
  'not-cooked',
  'side-a',
  'side-b',
  'sky',
  'sky-light',
  'disabled-surface',
  'disabled-text',
] as const;

export type ColorRole = (typeof colorRoles)[number];
export type Surface = 'parchment' | 'wood';

const p = palette;

export const surfaces: Readonly<Record<Surface, Readonly<Record<ColorRole, string>>>> = {
  /** Default. The style-guide sheet: cream paper, maroon ink, gold trim. */
  parchment: {
    canvas: p.gold[100],
    surface: p.neutral[100],
    'surface-raised': p.neutral[100],
    'surface-sunken': p.gold[100],
    scrim: alpha(p.neutral[900], 0.62),
    text: p.neutral[900],
    'text-muted': p.neutral[700],
    'text-subtle': p.gold[900],
    border: p.neutral[300],
    'border-strong': p.gold[900], // 3:1 non-text contrast (WCAG 1.4.11)
    frame: p.gold[500],
    'frame-light': p.gold[300],
    'frame-dark': p.gold[900],
    accent: p.royal[900],
    'accent-hover': p.royal[700],
    'accent-pressed': p.royal[900],
    'accent-shadow': p.neutral[900],
    'accent-text': p.royal[900],
    'on-accent': p.neutral[100],
    secondary: p.teal[900],
    'secondary-hover': p.teal[700],
    'secondary-text': p.teal[900],
    highlight: p.gold[300],
    'on-highlight': p.royal[900],
    'highlight-shadow': p.gold[900],
    danger: p.royal[700],
    'danger-hover': p.royal[900],
    'danger-shadow': p.neutral[900],
    'danger-text': p.royal[700],
    'on-danger': p.neutral[100],
    'danger-surface': p.royal[100],
    'success-text': p.green[900],
    'success-surface': p.green[100],
    'warning-text': p.gold[900],
    'warning-surface': p.neutral[100],
    'info-text': p.teal[900],
    'info-surface': p.teal[100],
    focus: p.teal[900],
    guilty: p.royal[700],
    'not-cooked': p.green[700],
    'side-a': p.teal[700],
    'side-b': p.royal[500],
    sky: p.blue[300],
    'sky-light': p.blue[100],
    'disabled-surface': p.neutral[300],
    'disabled-text': p.neutral[700],
  },
  /** Deep variant: wood panelling and maroon velvet, gold type. */
  wood: {
    canvas: p.neutral[900],
    surface: p.royal[900],
    'surface-raised': p.royal[900],
    'surface-sunken': p.neutral[900],
    scrim: alpha(p.neutral[900], 0.78),
    text: p.neutral[100],
    'text-muted': p.royal[100],
    'text-subtle': p.neutral[300],
    border: p.neutral[700],
    'border-strong': p.neutral[500], // 3:1 non-text contrast (WCAG 1.4.11)
    frame: p.gold[500],
    'frame-light': p.gold[300],
    'frame-dark': p.gold[900],
    accent: p.gold[300],
    'accent-hover': p.royal[100],
    'accent-pressed': p.gold[500],
    'accent-shadow': p.gold[900],
    'accent-text': p.gold[300],
    'on-accent': p.neutral[900],
    secondary: p.teal[300],
    'secondary-hover': p.teal[100],
    'secondary-text': p.teal[300],
    highlight: p.gold[300],
    'on-highlight': p.royal[900],
    'highlight-shadow': p.gold[900],
    danger: p.royal[700],
    'danger-hover': p.royal[900],
    'danger-shadow': p.gold[900],
    'danger-text': p.royal[100],
    'on-danger': p.neutral[100],
    'danger-surface': p.royal[900],
    'success-text': p.green[300],
    'success-surface': p.green[900],
    'warning-text': p.gold[100],
    'warning-surface': p.gold[900],
    'info-text': p.teal[100],
    'info-surface': p.teal[900],
    focus: p.gold[300],
    guilty: p.royal[300],
    'not-cooked': p.green[500],
    'side-a': p.teal[500],
    'side-b': p.royal[100],
    sky: p.blue[900],
    'sky-light': p.blue[700],
    'disabled-surface': p.neutral[700],
    'disabled-text': p.neutral[300],
  },
};

/**
 * Pairs that must meet WCAG 2.1 AA on each surface. `min` is 4.5 for body text
 * and 3 for large text / UI parts (WCAG 1.4.3, 1.4.11). Tested in tokens.test.ts
 * and listed with measured ratios in docs/STYLE-GUIDE.md.
 */
export const contrastPairs: ReadonlyArray<{ fg: ColorRole; bg: ColorRole; min: 3 | 4.5; use: string }> = [
  { fg: 'text', bg: 'canvas', min: 4.5, use: 'body text' },
  { fg: 'text', bg: 'surface', min: 4.5, use: 'text on panels' },
  { fg: 'text', bg: 'surface-raised', min: 4.5, use: 'text on cards' },
  { fg: 'text', bg: 'surface-sunken', min: 4.5, use: 'text in inputs and wells' },
  { fg: 'text-muted', bg: 'canvas', min: 4.5, use: 'secondary text' },
  { fg: 'text-muted', bg: 'surface', min: 4.5, use: 'secondary text on panels' },
  { fg: 'text-muted', bg: 'surface-raised', min: 4.5, use: 'secondary text on cards' },
  { fg: 'text-subtle', bg: 'canvas', min: 4.5, use: 'hints, placeholders' },
  { fg: 'text-subtle', bg: 'surface', min: 4.5, use: 'hints on panels' },
  { fg: 'text-subtle', bg: 'surface-sunken', min: 4.5, use: 'placeholders in inputs' },
  { fg: 'accent-text', bg: 'canvas', min: 4.5, use: 'links' },
  { fg: 'accent-text', bg: 'surface-raised', min: 4.5, use: 'links on cards' },
  { fg: 'on-accent', bg: 'accent', min: 4.5, use: 'primary button label' },
  { fg: 'on-accent', bg: 'accent-hover', min: 4.5, use: 'primary button hover' },
  { fg: 'on-accent', bg: 'accent-pressed', min: 4.5, use: 'primary button pressed' },
  { fg: 'on-highlight', bg: 'highlight', min: 4.5, use: 'swear button label' },
  { fg: 'on-danger', bg: 'danger', min: 4.5, use: 'danger button label' },
  { fg: 'on-danger', bg: 'danger-hover', min: 4.5, use: 'danger button hover' },
  { fg: 'secondary-text', bg: 'canvas', min: 4.5, use: 'secondary button label' },
  { fg: 'secondary-text', bg: 'surface-raised', min: 4.5, use: 'secondary button on cards' },
  { fg: 'danger-text', bg: 'danger-surface', min: 4.5, use: 'error banner' },
  { fg: 'danger-text', bg: 'canvas', min: 4.5, use: 'field error' },
  { fg: 'danger-text', bg: 'surface-raised', min: 4.5, use: 'field error on cards' },
  { fg: 'success-text', bg: 'success-surface', min: 4.5, use: 'success banner' },
  { fg: 'warning-text', bg: 'warning-surface', min: 4.5, use: 'warning banner' },
  { fg: 'info-text', bg: 'info-surface', min: 4.5, use: 'info banner' },
  { fg: 'focus', bg: 'canvas', min: 3, use: 'focus ring' },
  { fg: 'focus', bg: 'surface-raised', min: 3, use: 'focus ring on cards' },
  { fg: 'border-strong', bg: 'canvas', min: 3, use: 'input borders' },
  { fg: 'border-strong', bg: 'surface-raised', min: 3, use: 'input borders on cards' },
  { fg: 'guilty', bg: 'canvas', min: 3, use: 'GUILTY marks' },
  { fg: 'guilty', bg: 'surface-raised', min: 3, use: 'GUILTY marks on cards' },
  { fg: 'not-cooked', bg: 'canvas', min: 3, use: 'NOT COOKED marks' },
  { fg: 'not-cooked', bg: 'surface-raised', min: 3, use: 'NOT COOKED marks on cards' },
  { fg: 'side-a', bg: 'canvas', min: 3, use: 'Side A marks' },
  { fg: 'side-a', bg: 'surface-raised', min: 3, use: 'Side A marks on cards' },
  { fg: 'side-b', bg: 'canvas', min: 3, use: 'Side B marks' },
  { fg: 'side-b', bg: 'surface-raised', min: 3, use: 'Side B marks on cards' },
];

/* ── Typography ─────────────────────────────────────────────────────────── */

export const fontFamily = {
  /**
   * Paper display face: the chunky, rounded caps cut from card stock on the
   * papercraft reference ("THE COURT IS NOW IN SESSION", "ENTER THE COURT").
   * Headings, ribbons, buttons, tabs, stamps.
   */
  display: "'Lilita One', 'Nunito Variable', system-ui, sans-serif",
  /** Serif accent: the italic motto ("Your Honor, Bro Is Cooked.") and receipts' signature lines. */
  serif: "'Fraunces Variable', 'Iowan Old Style', Georgia, serif",
  /**
   * Label face (eyebrows, badges, counters). Historically the pixel face; the
   * papercraft direction replaces it with the paper display face. The token
   * name stays so existing components and the mode tracks keep working.
   */
  pixel: "'Lilita One', 'Nunito Variable', system-ui, sans-serif",
  /** Body face: rounded, friendly and very readable, like the form labels on the reference. */
  body: "'Nunito Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  /** Numbers that carry money or time: tabular, unambiguous. */
  mono: "'JetBrains Mono Variable', ui-monospace, 'SFMono-Regular', Menlo, monospace",
} as const;

/** Type scale (1.25 ratio from 16px). Display sizes are fluid between 360px and 1280px viewports. */
export const fontSize = {
  '2xs': '0.6875rem', // 11
  xs: '0.75rem', // 12
  sm: '0.875rem', // 14
  md: '1rem', // 16
  lg: '1.125rem', // 18
  xl: '1.25rem', // 20
  '2xl': '1.5rem', // 24
  '3xl': 'clamp(1.75rem, 1.5rem + 1.1vw, 2.25rem)', // 28 → 36
  '4xl': 'clamp(2.125rem, 1.6rem + 2.3vw, 3.25rem)', // 34 → 52
  '5xl': 'clamp(2.75rem, 1.9rem + 3.8vw, 4.75rem)', // 44 → 76
} as const;

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700', black: '800' } as const;

export const lineHeight = { tight: '1.1', snug: '1.25', normal: '1.5', relaxed: '1.65' } as const;

export const letterSpacing = { tight: '-0.02em', normal: '0', wide: '0.04em', caps: '0.08em' } as const;

/* ── Space, size, radius ────────────────────────────────────────────────── */

/** 4px grid. Keys are steps, not pixels: space-4 = 16px. */
export const space = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

/** Rounded like the style-guide frames and tiles; `pill` is for badges and switches only. */
export const radius = { none: '0', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '18px', '2xl': '28px', pill: '999px' } as const;

/** Control heights, so buttons, inputs and selects line up. */
export const controlHeight = { sm: '2rem', md: '2.75rem', lg: '3.25rem' } as const;

export const layout = { contentMax: '72rem', proseMax: '42rem', gutter: 'clamp(1rem, 0.6rem + 1.8vw, 2rem)' } as const;

/* ── Elevation ──────────────────────────────────────────────────────────── */

const ink = p.neutral[900];

/**
 * Parchment elevation is warm ink-brown shadow, never grey: a hard 1-2px pixel
 * drop (the style-guide tiles sit on a dark edge) plus a soft spread.
 * `ring-*` are the ornate rims: a gold band with a dark-gold outer line, as on
 * the style-guide frames and icon buttons.
 */
export const shadow = {
  0: 'none',
  1: `0 1px 0 ${alpha(ink, 0.1)}, 0 1px 3px ${alpha(ink, 0.12)}`,
  2: `0 2px 0 ${alpha(ink, 0.1)}, 0 6px 16px ${alpha(ink, 0.14)}`,
  3: `0 3px 0 ${alpha(ink, 0.12)}, 0 14px 32px ${alpha(ink, 0.18)}`,
  4: `0 4px 0 ${alpha(ink, 0.14)}, 0 28px 64px ${alpha(ink, 0.26)}`,
  'ring-accent': `0 0 0 2px ${p.gold[500]}, 0 0 0 4px ${alpha(p.royal[900], 0.85)}`,
  'ring-highlight': `0 0 0 2px ${p.gold[300]}, 0 0 0 4px ${p.gold[900]}`,
  'ring-danger': `0 0 0 2px ${p.royal[500]}, 0 0 0 4px ${alpha(p.royal[900], 0.6)}`,
  /** Inner bevel for ornate frames: light top-left, gold-brown bottom-right. */
  bevel: `inset 1px 1px 0 ${alpha(p.neutral[100], 0.9)}, inset -1px -1px 0 ${alpha(p.gold[900], 0.35)}`,
} as const;

/** On wood the drop is darker and the top edge catches a little gold light. */
const woodShadow: Partial<Record<keyof typeof shadow, string>> = {
  1: `inset 0 1px 0 ${alpha(p.gold[300], 0.12)}, 0 1px 3px ${alpha(ink, 0.6)}`,
  2: `inset 0 1px 0 ${alpha(p.gold[300], 0.14)}, 0 6px 16px ${alpha(ink, 0.7)}`,
  3: `inset 0 1px 0 ${alpha(p.gold[300], 0.16)}, 0 14px 32px ${alpha(ink, 0.8)}`,
  bevel: `inset 1px 1px 0 ${alpha(p.gold[300], 0.22)}, inset -1px -1px 0 ${alpha(ink, 0.6)}`,
};

/* ── Papercraft ─────────────────────────────────────────────────────────── */

/**
 * The papercraft art direction (docs/STYLE-GUIDE.md §9): every surface is a
 * sheet of card stock. Light comes from the top-left, so each sheet casts a
 * tight contact shadow plus a soft ambient shadow down and to the right onto
 * the sheet below it. `paper-N` are box-shadows for rectangular sheets;
 * `paper-drop-N` are the same stack as `filter: drop-shadow()` for sheets
 * whose outline is cut by a mask or clip-path (torn edges, ribbons, tiles).
 */
const paperShadowStops = {
  1: [[1, 1, 0, 0.2], [2, 3, 5, 0.16]],
  2: [[1, 2, 0, 0.22], [4, 7, 12, 0.2]],
  3: [[2, 3, 0, 0.24], [8, 14, 24, 0.24]],
  4: [[3, 5, 0, 0.26], [14, 26, 44, 0.3]],
} as const;

export const paperElevation = Object.fromEntries(
  Object.entries(paperShadowStops).map(([k, stops]) => [k, stops.map(([x, y, b, a]) => `${x}px ${y}px ${b}px ${alpha(ink, a)}`).join(', ')]),
) as Record<keyof typeof paperShadowStops, string>;

export const paperDrop = Object.fromEntries(
  Object.entries(paperShadowStops).map(([k, stops]) => [k, stops.map(([x, y, b, a]) => `drop-shadow(${x}px ${y}px ${b / 2}px ${alpha(ink, a)})`).join(' ')]),
) as Record<keyof typeof paperShadowStops, string>;

/** Mix two palette colours in sRGB (w = share of `a`). Only for the derived paper shades below. */
export function mix(a: string, b: string, w: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((ca >> shift) & 255) * w + ((cb >> shift) & 255) * (1 - w));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * Derived paper shades. The 30 swatches stay authoritative; these are the only
 * extra colours, each an sRGB mix of two swatches (documented in the style
 * guide). They are emitted as `color-mix()` of the palette variables, so
 * tokens.css still names only palette colours, and `paperShadeHex` carries
 * their computed values for the contrast tests.
 */
export const paperShades = {
  /** The deep maroon of the "PLAY AS GUEST" plate and the nav bar's lower fold. */
  'maroon-deep': { a: 'royal-900', b: 'neutral-900', w: 0.62 },
  /** The lit fold of a maroon sheet (between royal-900 and royal-700). */
  'maroon-fold': { a: 'royal-900', b: 'royal-700', w: 0.5 },
  /** The lit fold of a cream sheet. */
  'cream-fold': { a: 'neutral-100', b: 'gold-100', w: 0.5 },
  /** Cream paper in shadow (input fields, the back of ribbons). */
  'cream-shade': { a: 'neutral-300', b: 'gold-100', w: 0.45 },
} as const;

export type PaperShade = keyof typeof paperShades;

const swatch = (name: string): string => {
  const [family, step] = name.split('-') as [keyof typeof palette, string];
  return (palette[family] as Record<string, string>)[step]!;
};

export const paperShadeHex = Object.fromEntries(
  Object.entries(paperShades).map(([k, { a, b, w }]) => [k, mix(swatch(a), swatch(b), w)]),
) as Record<PaperShade, string>;

/** Deterministic jagged edge: a torn-paper silhouette, 120×12 tile, fill below the tear. */
function tornEdgePath(flip: boolean): string {
  // Hand-tuned tooth heights (0-12) so the tear reads irregular but tiles seamlessly.
  const teeth = [3, 8, 2, 6, 4, 9, 3, 5, 1, 7, 4, 8, 2, 6, 3, 9, 5, 2, 7, 3];
  const step = 120 / teeth.length;
  const pts = teeth.map((t, i) => `${(i * step).toFixed(1)} ${flip ? 12 - t : t}`);
  pts.push(`120 ${flip ? 12 - teeth[0]! : teeth[0]!}`);
  return flip ? `M0 0 L${pts.join(' L')} L120 0 Z` : `M0 12 L${pts.join(' L')} L120 12 Z`;
}

const svgUrl = (svg: string) => `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`;

/** Masks and textures used by the paper primitives (alpha only: no colour of their own, except the grain's ink). */
export const paperTexture = {
  /** Mask tile for a torn top edge (120×12, repeat-x). */
  'edge-torn-top': svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 12" preserveAspectRatio="none"><path d="${tornEdgePath(false)}"/></svg>`),
  /** Mask tile for a torn bottom edge. */
  'edge-torn-bottom': svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 12" preserveAspectRatio="none"><path d="${tornEdgePath(true)}"/></svg>`),
  /** Mask tile for a pinking-shear zig-zag bottom edge (16×8). */
  'edge-zigzag-bottom': svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 8" preserveAspectRatio="none"><path d="M0 0H16V2L8 8L0 2Z"/></svg>`),
  'edge-zigzag-top': svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 8" preserveAspectRatio="none"><path d="M0 8H16V6L8 0L0 6Z"/></svg>`),
  /**
   * Paper grain: fine fibre noise tinted with ink (neutral-900 = 74 58 50 → the
   * colour-matrix row offsets), mostly transparent. Layer it over any paper fill.
   */
  grain: svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.29 0 0 0 0 0.227 0 0 0 0 0.196 0 0 0 0.75 -0.38"/></filter><rect width="180" height="180" filter="url(#g)"/></svg>`,
  ),
  /** Large, soft mottling (pulp clouds) for big sheets such as the page backdrop and the login panel. */
  mottle: svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"><filter id="m"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.29 0 0 0 0 0.227 0 0 0 0 0.196 0 0 0 0.34 -0.13"/></filter><rect width="420" height="420" filter="url(#m)"/></svg>`,
  ),
} as const;

/**
 * Low-poly fold facets: hard-edged light and shade planes laid over a sheet's
 * fill, so a flat panel reads as folded card. Light planes are cream with
 * alpha, shade planes ink with alpha; they work on any paper colour.
 */
const lit = (a: number) => `color-mix(in srgb, var(--cc-neutral-100) ${a}%, transparent)`;
const shade = (a: number) => `color-mix(in srgb, var(--cc-neutral-900) ${a}%, transparent)`;
export const paperFacets = {
  /** Panels and cards: a broad lit plane top-left, a shade plane bottom-right, one diagonal fold between. */
  panel: [
    `linear-gradient(118deg, ${lit(14)} 0 24%, transparent calc(24% + 1px))`,
    `linear-gradient(242deg, transparent 0 62%, ${shade(7)} calc(62% + 1px) 100%)`,
    `linear-gradient(152deg, transparent 0 46%, ${lit(6)} calc(46% + 1px) 71%, transparent calc(71% + 1px))`,
    `linear-gradient(28deg, transparent 0 80%, ${shade(5)} calc(80% + 1px))`,
  ].join(', '),
  /** Buttons and plates: the sheet is folded once along its length (lit top, shaded bottom), with a cut-in at each end. */
  plate: [
    `linear-gradient(176deg, ${lit(22)} 0 46%, transparent calc(46% + 1px) 100%)`,
    `linear-gradient(184deg, transparent 0 54%, ${shade(9)} calc(54% + 1px) 100%)`,
    `linear-gradient(100deg, ${lit(10)} 0 12%, transparent calc(12% + 1px) 88%, ${shade(10)} calc(88% + 1px))`,
  ].join(', '),
  /** Tiles and small badges: four facets meeting near the centre, like a folded paper gem. */
  gem: [
    `conic-gradient(from 210deg at 46% 42%, ${lit(24)} 0 90deg, transparent 90deg 180deg, ${shade(12)} 180deg 270deg, ${lit(6)} 270deg 360deg)`,
  ].join(', '),
} as const;

/** Corner cuts (chamfers) for clip-paths: paper is trimmed with scissors, not rounded. */
export const paperCut = { sm: '4px', md: '7px', lg: '12px' } as const;

/* ── Motion ─────────────────────────────────────────────────────────────── */

/**
 * Durations collapse to 0ms under reduced motion (see toCss). Components must use
 * these variables, never literal times, so reduced motion is honoured everywhere.
 */
export const duration = {
  instant: '0ms',
  fast: '120ms',
  base: '200ms',
  slow: '320ms',
  slower: '480ms',
  /** Verdict stamps, gavel strikes: the "dramatic" beats from V4 §5. */
  dramatic: '720ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
  /** Overshoot for stamps and pop-ins. */
  stamp: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Pixel-art stepping, for typewriter and sprite flicks. */
  pixel: 'steps(4, end)',
  /** Paper unfolding: a quick open with a soft settle. */
  unfold: 'cubic-bezier(0.22, 1.25, 0.36, 1)',
  /** Paper being pressed down onto the sheet beneath. */
  press: 'cubic-bezier(0.3, 0, 0.5, 1)',
} as const;

/* ── Layers and breakpoints ─────────────────────────────────────────────── */

export const zIndex = { base: '0', raised: '10', sticky: '100', overlay: '1000', modal: '1100', toast: '1200', tooltip: '1300' } as const;

/** Min-width breakpoints in px. CSS media queries can't read variables, so CSS uses these literals. */
export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

/* ── CSS generation ─────────────────────────────────────────────────────── */

const key = (k: string | number) => String(k).replace('.', '_');

function block(selector: string, vars: Record<string, string>, indent = ''): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `${indent}  --cc-${k}: ${v};`)
    .join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

function scaleVars(prefix: string, scale: Record<string | number, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(scale).map(([k, v]) => [`${prefix}-${key(k)}`, v]));
}

function pick<T extends Record<string, string>>(o: T, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, o[k as keyof T] as string]));
}

function surfaceVars(s: Surface): Record<string, string> {
  return Object.fromEntries(colorRoles.map((role) => [`color-${role}`, surfaces[s][role]]));
}

export function toCss(): string {
  const paletteVars: Record<string, string> = {};
  for (const [family, steps] of Object.entries(palette)) {
    for (const [step, value] of Object.entries(steps)) paletteVars[`${family}-${step}`] = value;
  }
  const root = {
    ...paletteVars,
    ...surfaceVars('parchment'),
    'font-display': fontFamily.display,
    'font-serif': fontFamily.serif,
    'font-pixel': fontFamily.pixel,
    'font-body': fontFamily.body,
    'font-mono': fontFamily.mono,
    ...scaleVars('text', fontSize),
    ...scaleVars('weight', fontWeight),
    ...scaleVars('leading', lineHeight),
    ...scaleVars('tracking', letterSpacing),
    ...scaleVars('space', space),
    ...scaleVars('radius', radius),
    ...scaleVars('control', controlHeight),
    'content-max': layout.contentMax,
    'prose-max': layout.proseMax,
    gutter: layout.gutter,
    ...scaleVars('shadow', shadow),
    ...scaleVars('paper', paperElevation),
    ...scaleVars('paper-drop', paperDrop),
    ...scaleVars('paper-cut', paperCut),
    ...scaleVars('paper-facets', paperFacets),
    ...scaleVars('paper', paperTexture),
    ...Object.fromEntries(
      Object.entries(paperShades).map(([k, { a, b, w }]) => [`paper-${k}`, `color-mix(in srgb, var(--cc-${a}) ${Math.round(w * 100)}%, var(--cc-${b}))`]),
    ),
    ...scaleVars('duration', duration),
    ...scaleVars('ease', easing),
    ...scaleVars('z', zIndex),
  };
  const reduced = Object.fromEntries(
    Object.keys(duration).map((k) => [`duration-${k}`, '0ms']),
  );
  return [
    '/* Generated by `npm run tokens` from src/ds/tokens.ts. Do not edit by hand. */',
    '',
    block(':root', root),
    '',
    '/* Surfaces re-map the semantic roles; components adapt without variants. */',
    block("[data-surface='parchment']", { ...surfaceVars('parchment'), ...scaleVars('shadow', pick(shadow, ['1', '2', '3', 'bevel'])) }),
    '',
    block("[data-surface='wood']", { ...surfaceVars('wood'), ...scaleVars('shadow', woodShadow as Record<string, string>) }),
    '',
    '/* Reduced motion: the effective preference is set on <html> by MotionProvider',
    '   (system setting unless the user overrides it). The media query is the no-JS fallback. */',
    block(":root[data-reduced-motion='true']", reduced),
    '',
    '@media (prefers-reduced-motion: reduce) {',
    block(':root:not([data-reduced-motion])', reduced, '  '),
    '}',
    '',
  ].join('\n');
}

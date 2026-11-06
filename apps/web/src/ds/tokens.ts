/**
 * CringeCourt design tokens: the single source of truth.
 *
 * `npm run tokens` turns this file into src/ds/tokens.css (CSS custom properties,
 * prefix `--cc-`). Components only ever read the CSS variables; TypeScript reads
 * this module for the gallery and the contrast tests.
 *
 * Grounding (see docs/DESIGN-SYSTEM.md):
 *   - Neon-noir is the global identity (ART-BIBLE "the courtroom is the brand").
 *     Night, neon, purple, cream and gold come from cc-art/brand-kit.mjs.
 *   - Parchment is the in-world document surface (dialogue box, receipts, panels)
 *     from cc-art/ui-kit.mjs: paper, ink, burgundy, gold.
 *   - Verdict and side colours come from the UI kit cards and cc-art/vox-chars.mjs
 *     (Side A teal #3FB8C9, Side B orange #F08A3C).
 */

/* ── Raw palette ────────────────────────────────────────────────────────── */

export const palette = {
  night: {
    950: '#0B0710',
    900: '#140E1A', // brand-kit night
    850: '#1A1222',
    800: '#21172B',
    700: '#2A1636', // brand-kit nightLt, portrait backdrop
    600: '#3A2549',
    500: '#523866',
    400: '#7A6290',
    300: '#A995BC',
    200: '#CDBEDB',
  },
  neon: {
    200: '#FFD3EC',
    300: '#FFA8D8', // brand-kit neonLt
    400: '#FF7AC9',
    500: '#FF4FB8', // brand-kit neon
    600: '#E0399E',
    700: '#B02C7F',
    800: '#8E2A6E', // brand-kit neonDk
  },
  purple: {
    300: '#B79CF0',
    400: '#9277D0',
    500: '#6B4CA8', // brand-kit purple
    700: '#452F75', // brand-kit purpleSh
  },
  gold: {
    200: '#FFF2C7',
    300: '#F6C75B', // goldLt
    500: '#D9A046', // gold
    700: '#A97C2A', // goldDk
    900: '#6E4A17',
  },
  cream: {
    50: '#FFFCF5',
    100: '#FFF8EC', // ui-kit paper
    150: '#FFF6E4', // brand-kit cream (text on night)
    200: '#F5E6CE', // paperMid
    300: '#E4CFB0', // paperLow
    400: '#C9AD86',
  },
  ink: {
    900: '#2A1D18',
    800: '#3A2A24', // ui-kit ink
    600: '#6B5646', // inkSoft
  },
  burgundy: {
    900: '#4A1020', // burgDk
    800: '#6E1B2A', // burg
    700: '#8E2A3C', // burgLt
  },
  red: {
    700: '#9C2B1F',
    500: '#C0392B', // ui-kit red (GUILTY)
    400: '#E05C48', // redLt
    300: '#FF8C78',
  },
  green: {
    700: '#2C5E3A',
    500: '#3E7F50', // ui-kit green (NOT COOKED)
    400: '#6EBF73', // greenLt
    300: '#9BE09E',
  },
  teal: {
    700: '#1F6F7C', // Side A shade
    500: '#3FB8C9', // Side A
    300: '#A8F0F8', // Side A light
  },
  orange: {
    700: '#A8521C', // Side B shade
    500: '#F08A3C', // Side B
    300: '#FFC890', // Side B light
  },
} as const;

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
  'disabled-surface',
  'disabled-text',
] as const;

export type ColorRole = (typeof colorRoles)[number];
export type Surface = 'night' | 'parchment';

const p = palette;

export const surfaces: Readonly<Record<Surface, Readonly<Record<ColorRole, string>>>> = {
  night: {
    canvas: p.night[900],
    surface: p.night[850],
    'surface-raised': p.night[700],
    'surface-sunken': p.night[950],
    scrim: 'rgb(11 7 16 / 0.78)',
    text: p.cream[150],
    'text-muted': p.night[200],
    'text-subtle': p.night[300],
    border: p.night[600],
    'border-strong': p.night[400], // 3:1 non-text contrast (WCAG 1.4.11)
    accent: p.neon[500],
    'accent-hover': p.neon[400],
    'accent-pressed': p.neon[600],
    'accent-shadow': p.neon[800],
    'accent-text': p.neon[400],
    'on-accent': p.night[900],
    secondary: p.purple[400],
    'secondary-hover': p.purple[300],
    'secondary-text': p.purple[300],
    highlight: p.gold[300],
    'on-highlight': p.night[900],
    'highlight-shadow': p.gold[700],
    danger: p.red[500],
    'danger-hover': p.red[400],
    'danger-shadow': p.red[700],
    'danger-text': p.red[300],
    'on-danger': p.cream[150],
    'danger-surface': '#3A1420',
    'success-text': p.green[300],
    'success-surface': '#16281F',
    'warning-text': p.gold[300],
    'warning-surface': '#2E2112',
    'info-text': p.teal[300],
    'info-surface': '#102A30',
    focus: p.gold[300],
    guilty: p.red[400],
    'not-cooked': p.green[400],
    'side-a': p.teal[500],
    'side-b': p.orange[500],
    'disabled-surface': p.night[700],
    'disabled-text': p.night[400],
  },
  parchment: {
    canvas: p.cream[100],
    surface: p.cream[50],
    'surface-raised': p.cream[50],
    'surface-sunken': p.cream[200],
    scrim: 'rgb(42 29 24 / 0.6)',
    text: p.ink[800],
    'text-muted': p.ink[600],
    'text-subtle': '#7A6452',
    border: p.cream[300],
    'border-strong': '#8F7650', // 3:1 non-text contrast (WCAG 1.4.11)
    accent: p.burgundy[800],
    'accent-hover': p.burgundy[700],
    'accent-pressed': p.burgundy[900],
    'accent-shadow': p.burgundy[900],
    'accent-text': p.burgundy[800],
    'on-accent': p.cream[150],
    secondary: p.purple[500],
    'secondary-hover': p.purple[700],
    'secondary-text': p.purple[700],
    highlight: p.gold[500],
    'on-highlight': p.ink[900],
    'highlight-shadow': p.gold[900],
    danger: p.red[700],
    'danger-hover': p.red[500],
    'danger-shadow': '#6A1A12',
    'danger-text': p.red[700],
    'on-danger': p.cream[150],
    'danger-surface': '#F8DCD3',
    'success-text': p.green[700],
    'success-surface': '#DDEFD6',
    'warning-text': p.gold[900],
    'warning-surface': p.gold[200],
    'info-text': p.teal[700],
    'info-surface': '#D7F1F4',
    focus: p.neon[800],
    guilty: p.red[500],
    'not-cooked': p.green[500],
    'side-a': p.teal[700],
    'side-b': p.orange[700],
    'disabled-surface': p.cream[200],
    'disabled-text': '#8A7E6C',
  },
};

/**
 * Pairs that must meet WCAG 2.1 AA on each surface. `min` is 4.5 for body text
 * and 3 for large text / UI parts (WCAG 1.4.3, 1.4.11). Tested in tokens.test.ts.
 */
export const contrastPairs: ReadonlyArray<{ fg: ColorRole; bg: ColorRole; min: 3 | 4.5; use: string }> = [
  { fg: 'text', bg: 'canvas', min: 4.5, use: 'body text' },
  { fg: 'text', bg: 'surface-raised', min: 4.5, use: 'text on cards' },
  { fg: 'text-muted', bg: 'canvas', min: 4.5, use: 'secondary text' },
  { fg: 'text-muted', bg: 'surface-raised', min: 4.5, use: 'secondary text on cards' },
  { fg: 'text-subtle', bg: 'canvas', min: 4.5, use: 'hints, placeholders' },
  { fg: 'text-subtle', bg: 'surface', min: 4.5, use: 'hints on panels' },
  { fg: 'accent-text', bg: 'canvas', min: 4.5, use: 'links' },
  { fg: 'accent-text', bg: 'surface-raised', min: 4.5, use: 'links on cards' },
  { fg: 'on-accent', bg: 'accent', min: 4.5, use: 'primary button label' },
  { fg: 'on-accent', bg: 'accent-hover', min: 4.5, use: 'primary button hover' },
  { fg: 'on-highlight', bg: 'highlight', min: 4.5, use: 'swear button label' },
  { fg: 'on-danger', bg: 'danger', min: 4.5, use: 'danger button label' },
  { fg: 'secondary-text', bg: 'canvas', min: 4.5, use: 'secondary button label' },
  { fg: 'danger-text', bg: 'danger-surface', min: 4.5, use: 'error banner' },
  { fg: 'danger-text', bg: 'canvas', min: 4.5, use: 'field error' },
  { fg: 'success-text', bg: 'success-surface', min: 4.5, use: 'success banner' },
  { fg: 'warning-text', bg: 'warning-surface', min: 4.5, use: 'warning banner' },
  { fg: 'info-text', bg: 'info-surface', min: 4.5, use: 'info banner' },
  { fg: 'focus', bg: 'canvas', min: 3, use: 'focus ring' },
  { fg: 'focus', bg: 'surface-raised', min: 3, use: 'focus ring on cards' },
  { fg: 'border-strong', bg: 'canvas', min: 3, use: 'input borders' },
  { fg: 'guilty', bg: 'canvas', min: 3, use: 'GUILTY marks' },
  { fg: 'not-cooked', bg: 'canvas', min: 3, use: 'NOT COOKED marks' },
  { fg: 'side-a', bg: 'canvas', min: 3, use: 'Side A marks' },
  { fg: 'side-b', bg: 'canvas', min: 3, use: 'Side B marks' },
];

/* ── Typography ─────────────────────────────────────────────────────────── */

export const fontFamily = {
  /** Pixel display face: echoes the voxel wordmark and the UI-kit pixel font. Headings and stamps only. */
  display: "'Pixelify Sans', 'Space Grotesk Variable', system-ui, sans-serif",
  /** Body face: geometric, quirky, very readable. */
  body: "'Space Grotesk Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
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

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;

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

/** Small radii keep the pixel-art edge; `pill` is for badges and switches only. */
export const radius = { none: '0', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '18px', pill: '999px' } as const;

/** Control heights, so buttons, inputs and selects line up. */
export const controlHeight = { sm: '2rem', md: '2.75rem', lg: '3.25rem' } as const;

export const layout = { contentMax: '72rem', proseMax: '42rem', gutter: 'clamp(1rem, 0.6rem + 1.8vw, 2rem)' } as const;

/* ── Elevation ──────────────────────────────────────────────────────────── */

/**
 * Elevation on a dark stage is light, not shadow: each level adds a hairline top
 * highlight plus a deeper drop. `press-*` are the hard bottom edges of the
 * UI-kit buttons; `glow-*` are the neon rims of the brand cards.
 */
export const shadow = {
  0: 'none',
  1: 'inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.4)',
  2: 'inset 0 1px 0 rgb(255 255 255 / 0.05), 0 4px 12px rgb(0 0 0 / 0.45)',
  3: 'inset 0 1px 0 rgb(255 255 255 / 0.06), 0 12px 32px rgb(0 0 0 / 0.55)',
  4: 'inset 0 1px 0 rgb(255 255 255 / 0.07), 0 24px 64px rgb(0 0 0 / 0.65)',
  'glow-accent': '0 0 0 1px rgb(255 79 184 / 0.55), 0 0 24px rgb(255 79 184 / 0.28)',
  'glow-highlight': '0 0 0 1px rgb(246 199 91 / 0.55), 0 0 24px rgb(246 199 91 / 0.25)',
  'glow-danger': '0 0 0 1px rgb(224 92 72 / 0.6), 0 0 24px rgb(224 92 72 / 0.25)',
} as const;

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
    ...surfaceVars('night'),
    'font-display': fontFamily.display,
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
    block("[data-surface='night']", { ...surfaceVars('night'), 'shadow-1': shadow[1] }),
    '',
    block("[data-surface='parchment']", {
      ...surfaceVars('parchment'),
      'shadow-1': '0 1px 0 rgb(58 42 36 / 0.08), 0 1px 3px rgb(58 42 36 / 0.12)',
      'shadow-2': '0 2px 0 rgb(58 42 36 / 0.08), 0 6px 16px rgb(58 42 36 / 0.16)',
    }),
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

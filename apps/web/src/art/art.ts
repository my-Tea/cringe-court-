/**
 * Typed access to the generated art in cc-art/dist (aliased as @art).
 * import.meta.glob resolves at build time, so a missing file fails the build
 * instead of shipping a broken image, and only referenced files are bundled.
 */

// Only the 64px and @2x busts (the _32 thumbnails are for in-engine use).
import type { StagePose } from './stagePoses';

const portraitFiles = import.meta.glob<string>(['@art/characters/*/portraits/*.png', '!**/*_32.png'], {
  eager: true,
  query: '?url',
  import: 'default',
});

const poseFiles = import.meta.glob<string>('@art/characters/*/poses/*@2x.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const cutoutFiles = import.meta.glob<string>('./cutouts/*.png', { eager: true, query: '?url', import: 'default' });

const uiFiles = import.meta.glob<string>(['@art/ui/icon_*.png', '@art/ui/badge_*.png'], { eager: true, query: '?url', import: 'default' });
const brandFiles = import.meta.glob<string>('@art/brand/*.png', { eager: true, query: '?url', import: 'default' });

/** Characters with portraits (cc-art/dist/characters/portraits.json). */
export const CHARACTERS = {
  judge: 'Judge Gavel.exe',
  prosecutor: 'Miss Ratio',
  defense: 'Counsel Chaos',
  bailiff: 'Bailiff',
  clerk: 'Clerk',
  'ai-narrator': 'AI Narrator',
  juror: 'Juror',
  creator: 'Creator',
  'side-a': 'Side A',
  'side-b': 'Side B',
} as const;

export type CharacterId = keyof typeof CHARACTERS;
export type Expression = 'neutral' | 'smug' | 'shocked' | 'defeated';
export const EXPRESSIONS: readonly Expression[] = ['neutral', 'smug', 'shocked', 'defeated'];

export type Pose =
  | 'idle'
  | 'idle_a'
  | 'idle_b'
  | 'idle_c'
  | 'talking'
  | 'happy'
  | 'laughing'
  | 'angry'
  | 'confused'
  | 'crying'
  | 'defeated'
  | 'shocked'
  | 'objection'
  /** Jurors only. */
  | 'seated'
  | 'seated_threeq';

function pick(files: Record<string, string>, suffix: string): string | undefined {
  for (const [path, url] of Object.entries(files)) if (path.endsWith(suffix)) return url;
  return undefined;
}

export interface PortraitSources {
  src: string;
  srcSet: string;
}

/** 64px portrait with a 128px @2x source. Throws if the art is missing. */
export function portrait(character: CharacterId, expression: Expression = 'neutral'): PortraitSources {
  const base = `/characters/${character}/portraits/${expression}`;
  const x1 = pick(portraitFiles, `${base}.png`);
  const x2 = pick(portraitFiles, `${base}@2x.png`);
  if (!x1 || !x2) throw new Error(`Missing portrait art: ${character}/${expression}`);
  return { src: x2, srcSet: `${x1} 64w, ${x2} 128w` };
}

/** Full-body pose (transparent PNG, @2x). Throws if that pose was not generated for the character. */
export function pose(character: CharacterId, name: Pose): string {
  const url = pick(poseFiles, `/characters/${character}/poses/${name}@2x.png`);
  if (!url) throw new Error(`Missing pose art: ${character}/${name}`);
  return url;
}

/**
 * Transparent cutout of a stage pose (see stagePoses.ts). Only pairs listed in
 * STAGE_POSES type-check, so a missing cutout is a compile error.
 */
export function stagePose<C extends StagePose[0]>(character: C, name: Extract<StagePose, readonly [C, Pose]>[1]): string {
  const url = pick(cutoutFiles, `/cutouts/${character}__${name}.png`);
  if (!url) throw new Error(`Missing cutout: ${character}/${name}. Run \`npm run cutouts\`.`);
  return url;
}

export type UiIconName =
  | 'accuse'
  | 'board'
  | 'bond'
  | 'commit'
  | 'endday'
  | 'journal'
  | 'menu'
  | 'notebook'
  | 'refund'
  | 'reveal'
  | 'slashed'
  | 'sound';

export function uiIcon(name: UiIconName): PortraitSources {
  const x1 = pick(uiFiles, `/ui/icon_${name}.png`);
  const x2 = pick(uiFiles, `/ui/icon_${name}@2x.png`);
  if (!x1 || !x2) throw new Error(`Missing UI icon art: ${name}`);
  return { src: x2, srcSet: `${x1} 1x, ${x2} 2x` };
}

export function brandArt(file: 'wordmark' | 'wordmark_small' | 'wordmark_stacked' | 'share_card' | 'case_card'): string {
  const url = pick(brandFiles, `/brand/${file}.png`);
  if (!url) throw new Error(`Missing brand art: ${file}`);
  return url;
}

/** Interim scene art cropped from the style guide (scripts/gen-guide-art.py; docs/STYLE-GUIDE.md). */
const guideFiles = import.meta.glob<string>('./guide/*.webp', { eager: true, query: '?url', import: 'default' });

export type GuideArtName = 'courthouse' | 'colonnade';

export function guideArt(name: GuideArtName): string {
  const url = guideFiles[`./guide/${name}.webp`];
  if (!url) throw new Error(`Missing guide art: ${name}`);
  return url;
}

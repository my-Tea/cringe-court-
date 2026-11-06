import { CHARACTERS, portrait, type CharacterId, type Expression } from '../../../art/art';
import { t } from '@/i18n';
import { cx } from '../../lib/cx';
import styles from './Portrait.module.css';

export type PortraitSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type PortraitRing = 'neutral' | 'accent' | 'highlight' | 'side-a' | 'side-b';

const ringClass: Record<PortraitRing, string | undefined> = {
  neutral: undefined,
  accent: styles.accent,
  highlight: styles.highlight,
  'side-a': styles.sideA,
  'side-b': styles.sideB,
};

export interface PortraitProps {
  character: CharacterId;
  expression?: Expression;
  size?: PortraitSize;
  ring?: PortraitRing;
  /** Accessible name. Defaults to the character's name; pass "" when a caption already names them. */
  alt?: string;
  className?: string;
}

/** Voxel dialogue bust from cc-art (64px, @2x 128px), scaled with crisp pixels. */
export function Portrait({ character, expression = 'neutral', size = 'md', ring = 'neutral', alt, className }: PortraitProps) {
  const { src, srcSet } = portrait(character, expression);
  return (
    <span className={cx(styles.portrait, size !== 'md' && styles[size], ringClass[ring], className)}>
      <img src={src} srcSet={srcSet} sizes="128px" alt={alt ?? CHARACTERS[character]} width={128} height={128} decoding="async" data-pixel />
    </span>
  );
}

/** The anonymous defendant silhouette: who is on trial is never shown as a face. */
export function AnonymousPortrait({ size = 'md', ring = 'neutral', label = t('ds.portrait.anonymous'), className }: Omit<PortraitProps, 'character' | 'expression' | 'alt'> & { label?: string }) {
  return (
    <span role="img" aria-label={label} className={cx(styles.portrait, styles.anonymous, size !== 'md' && styles[size], ringClass[ring], className)}>
      <svg viewBox="0 0 12 12" fill="currentColor" shapeRendering="crispEdges" aria-hidden focusable="false">
        <path d="M4 1h4v1H4zM3 2h6v4H3zM4 6h4v1H4zM5 7h2v1H5zM2 8h8v1H2zM1 9h10v3H1z" />
        <path d="M5 3h2v1H5zM6 4h1v1H6z" fill="var(--cc-neutral-900)" />
      </svg>
    </span>
  );
}

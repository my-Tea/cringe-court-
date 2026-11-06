import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './PaperTile.module.css';

export interface PaperTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible name (tiles are icon-only). */
  label: string;
  /** `hex` (default): a folded paper hexagon. `round`: a rounded square of card. */
  shape?: 'hex' | 'round';
  /** Paper stock behind the glyph. `brand` tiles use a fixed palette pairing per brand slot. */
  tone?: 'maroon' | 'cream' | 'gold' | 'teal' | 'blue';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * A small paper tile with one glyph: the social sign-in tiles and quick links
 * on the reference. A gem of four facets, a gold rim, and a press that sinks it.
 */
export const PaperTile = forwardRef<HTMLButtonElement, PaperTileProps>(function PaperTile(
  { icon, label, shape = 'hex', tone = 'maroon', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} aria-label={label} className={cx(styles.tile, className)} data-shape={shape} data-tone={tone} data-size={size} {...rest}>
      <span className={styles.rim} aria-hidden />
      <span className={styles.face} aria-hidden />
      <Icon name={icon} className={styles.glyph} />
    </button>
  );
});

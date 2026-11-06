import type { ReactNode } from 'react';
import { cx, PaperPanel, PaperRibbon, type PaperPanelProps } from '@/ds';
import styles from '../versus.module.css';

export interface PaperSectionProps extends Omit<PaperPanelProps, 'edge' | 'facets'> {
  /** The banner across the top: a label (`p`) over a section that has its own heading, or the section's `h2`. */
  ribbon?: ReactNode;
  ribbonAs?: 'p' | 'h2';
  /** Layout for the content under the ribbon (the sheet itself wraps it in its own padded box). */
  bodyClassName?: string;
}

/**
 * One stage of a Versus case on a sheet of card: chamfered cream (or maroon)
 * stock, with a paper ribbon pinned across its top edge. Every panel in the case
 * room (brief, draft, funding, jury, verdict) is one of these.
 */
export function PaperSection({ ribbon, ribbonAs = 'p', bodyClassName, tone = 'cream', elevation = 2, backing, padding = 'lg', as = 'section', className, children, ...rest }: PaperSectionProps) {
  return (
    <PaperPanel
      as={as}
      tone={tone}
      edge="cut"
      elevation={elevation}
      backing={backing ?? (tone === 'maroon' ? 'gold' : 'none')}
      padding={padding}
      className={cx(styles.paperSection, ribbon != null && styles.paperSectionRibboned, className)}
      {...rest}
    >
      {ribbon != null && (
        <PaperRibbon as={ribbonAs} tone={tone === 'maroon' ? 'gold' : 'maroon'} size="sm" className={styles.sectionRibbon}>
          {ribbon}
        </PaperRibbon>
      )}
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </PaperPanel>
  );
}

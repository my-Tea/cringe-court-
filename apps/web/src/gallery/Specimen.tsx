import type { ReactNode } from 'react';
import { cx } from '@/ds';
import styles from './Gallery.module.css';

export interface GallerySectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

export function GallerySection({ id, title, description, children }: GallerySectionProps) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          {title}
        </h2>
        {description && <p className={styles.sectionDesc}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Specimen({ label, note, layout, children }: { label: string; note?: string; layout?: 'row' | 'stack' | 'grid2' | 'grid3'; children: ReactNode }) {
  return (
    <figure className={styles.specimen}>
      <figcaption className={styles.specimenLabel}>
        <span>{label}</span>
        {note && <span>{note}</span>}
      </figcaption>
      <div className={cx(styles.specimenBody, layout === 'stack' && styles.stack, layout === 'grid2' && styles.grid2, layout === 'grid3' && styles.grid3)}>
        {children}
      </div>
    </figure>
  );
}

import type { ReactNode } from 'react';
import styles from '../versus.module.css';

/** The sky band at the top of every Versus page (style guide: environment blues over parchment). */
export function PageHead({ eyebrow, title, lede, aside }: { eyebrow: ReactNode; title: ReactNode; lede?: ReactNode; aside?: ReactNode }) {
  return (
    <header className={styles.pageHead}>
      <div className={styles.pageHeadInner}>
        <div className={styles.pageHeadCopy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.pageTitle}>{title}</h1>
          {lede && <p className={styles.pageLede}>{lede}</p>}
        </div>
        {aside && <div className={styles.pageHeadAside}>{aside}</div>}
      </div>
    </header>
  );
}

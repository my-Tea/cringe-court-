import { Icon, PaperPanel, PaperRibbon } from '@/ds';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { MotionToggle } from '@/app/shell/MotionToggle';
import { SoundSettings } from '@/platform/SoundSettings';
import { ConnectionsPanel } from './ConnectionsPanel';
import { DemoDataPanel } from './DemoDataPanel';
import pages from '../pages.module.css';
import styles from './Settings.module.css';

/** /settings: sound, motion, where the court's money and jurors come from, and the demo data. */
export function SettingsPage() {
  useDocumentTitle('Settings');
  return (
    <div className={pages.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold aria-labelledby="settings-title">
        <div className={pages.hero}>
          <PaperRibbon as="h1" id="settings-title" size="lg" sparks className={pages.heroTitle}>
            Settings
          </PaperRibbon>
          <p className={pages.lede}>Sound, motion, and exactly which court is holding your test USDC and checking your jurors.</p>
        </div>
      </PaperPanel>

      <div className={styles.grid}>
        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="sound-title" className={styles.panel}>
          <h2 id="sound-title" className={styles.heading}>
            <Icon name="megaphone" className={styles.headingIcon} />
            Sound
          </h2>
          <SoundSettings />
        </PaperPanel>

        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="motion-title" className={styles.panel}>
          <h2 id="motion-title" className={styles.heading}>
            <Icon name="sparkle" className={styles.headingIcon} />
            Motion
          </h2>
          <p className={styles.body}>
            Paper unfolds, the gavel bounces and the roaming courtroom glides. Reduce motion swaps all of that for calm fades and a
            fixed camera.
          </p>
          <MotionToggle />
        </PaperPanel>

        <PaperPanel as="section" tone="kraft" edge="torn" elevation={2} padding="lg" aria-labelledby="court-title" className={styles.wide}>
          <h2 id="court-title" className={styles.heading}>
            <Icon name="scales" className={styles.headingIcon} />
            Court connections
          </h2>
          <ConnectionsPanel />
        </PaperPanel>

        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="data-title" className={styles.wide}>
          <h2 id="data-title" className={styles.heading}>
            <Icon name="document" className={styles.headingIcon} />
            Demo data
          </h2>
          <DemoDataPanel />
        </PaperPanel>
      </div>
    </div>
  );
}

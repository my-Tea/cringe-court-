import { Icon, PaperPanel, PaperRibbon } from '@/ds';
import { RadioCards } from '@/ds';
import { LOCALES, t, useLocale, type Locale, type MessageKey } from '@/i18n';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { MotionToggle } from '@/app/shell/MotionToggle';
import { SoundSettings } from '@/platform/SoundSettings';
import { ConnectionsPanel } from './ConnectionsPanel';
import { DemoDataPanel } from './DemoDataPanel';
import pages from '../pages.module.css';
import styles from './Settings.module.css';

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Locale; label: MessageKey }> = LOCALES.map((value) => ({
  value,
  label: value === 'en' ? 'shell.settings.language.en' : 'shell.settings.language.enXA',
}));

/** /settings: sound, motion, where the court's money and jurors come from, and the demo data. */
export function SettingsPage() {
  useDocumentTitle(t('shell.nav.settings'));
  const { locale, setLocale } = useLocale();
  return (
    <div className={pages.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold aria-labelledby="settings-title">
        <div className={pages.hero}>
          <PaperRibbon as="h1" id="settings-title" size="lg" sparks className={pages.heroTitle}>
            {t('shell.nav.settings')}
          </PaperRibbon>
          <p className={pages.lede}>{t('shell.settings.lede')}</p>
        </div>
      </PaperPanel>

      <div className={styles.grid}>
        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="sound-title" className={styles.panel}>
          <h2 id="sound-title" className={styles.heading}>
            <Icon name="megaphone" className={styles.headingIcon} />
            {t('shell.settings.sound')}
          </h2>
          <SoundSettings />
        </PaperPanel>

        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="motion-title" className={styles.panel}>
          <h2 id="motion-title" className={styles.heading}>
            <Icon name="sparkle" className={styles.headingIcon} />
            {t('shell.settings.motion')}
          </h2>
          <p className={styles.body}>
            {t('shell.settings.motion.body')}
          </p>
          <MotionToggle />
        </PaperPanel>

        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="language-title" className={styles.panel}>
          <h2 id="language-title" className={styles.heading}>
            <Icon name="book" className={styles.headingIcon} />
            {t('shell.settings.language')}
          </h2>
          <p className={styles.body}>{t('shell.settings.language.body')}</p>
          <RadioCards
            legend={t('shell.settings.language.legend')}
            name="cc-language"
            options={LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
            value={locale}
            onValueChange={(v) => setLocale(v as Locale)}
          />
        </PaperPanel>

        <PaperPanel as="section" tone="kraft" edge="torn" elevation={2} padding="lg" aria-labelledby="court-title" className={styles.wide}>
          <h2 id="court-title" className={styles.heading}>
            <Icon name="scales" className={styles.headingIcon} />
            {t('shell.settings.connections')}
          </h2>
          <ConnectionsPanel />
        </PaperPanel>

        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="data-title" className={styles.wide}>
          <h2 id="data-title" className={styles.heading}>
            <Icon name="document" className={styles.headingIcon} />
            {t('shell.settings.demoData')}
          </h2>
          <DemoDataPanel />
        </PaperPanel>
      </div>
    </div>
  );
}

import { MODE_IDS } from '@cringe-court/core';
import { Link } from 'react-router';
import { DialogueBox, Icon, PaperButtonLink, PaperPanel, PaperRibbon } from '@/ds';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
import { ModeFacts } from './ModeFacts';
import { MODE_NAME_KEY, MODE_TAGLINE_KEY } from './modeText';
import { PILLARS, TRIAL_STEPS } from './trialContent';
import styles from './pages.module.css';

export function HowToPlayPage() {
  useDocumentTitle(t('shell.nav.howToPlay'));
  return (
    <div className={styles.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold>
        <div className={styles.hero}>
          <PaperRibbon as="h1" size="lg" sparks className={styles.heroTitle}>
            {t('shell.nav.howToPlay')}
          </PaperRibbon>
          <p className={styles.lede}>{t('shell.howTo.lede')}</p>
        </div>
      </PaperPanel>

      <section aria-labelledby="trial-title">
        <div className={styles.sectionHead}>
          <PaperRibbon as="h2" id="trial-title" tone="gold" size="md">
            {t('shell.howTo.trial.title')}
          </PaperRibbon>
        </div>
        <ol className={styles.steps}>
          {TRIAL_STEPS.map((step, i) => (
            <PaperPanel key={step.title} as="li" tone="cream" edge="cut" elevation={2} padding="md" className={styles.step}>
              <div className={styles.stepHead}>
                <span className={styles.stepNum} aria-hidden>
                  {i + 1}
                </span>
                <Icon name={step.icon} className={styles.stepIcon} />
              </div>
              <h3 className={styles.stepTitle}>{t(step.title)}</h3>
              <p className={styles.stepBody}>{t(step.body)}</p>
            </PaperPanel>
          ))}
        </ol>
      </section>

      <section aria-labelledby="courts-title">
        <div className={styles.sectionHead}>
          <PaperRibbon as="h2" id="courts-title" tone="gold" size="md">
            {t('shell.howTo.courts.title')}
          </PaperRibbon>
          <p className={styles.sectionLede}>{t('shell.courts.tagline')}</p>
        </div>
        <ul className={styles.courtsGrid} role="list">
          {MODE_IDS.map((id) => (
            <PaperPanel key={id} as="li" tone="kraft" edge="torn" elevation={2} padding="md">
              <div className={styles.courtBox}>
                <h3 className={styles.modeName}>{t(MODE_NAME_KEY[id])}</h3>
                <p className={styles.modeTagline}>{t(MODE_TAGLINE_KEY[id])}</p>
                <ModeFacts id={id} />
                <Link to={paths.mode(id)} className={styles.modeMore}>
                  {t('shell.home.explore', { name: t(MODE_NAME_KEY[id]) })} <Icon name="arrow-right" />
                </Link>
              </div>
            </PaperPanel>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fair-title">
        <div className={styles.fairGrid}>
          <PaperPanel tone="cream" edge="cut" elevation={2} padding="lg">
            <div className={styles.sectionHead}>
              <PaperRibbon as="h2" id="fair-title" size="md">
                {t('shell.howTo.fair.title')}
              </PaperRibbon>
            </div>
            <ul className={styles.pillars} role="list">
              {PILLARS.map((p) => (
                <li key={p.title} className={styles.pillar}>
                  <Icon name="check" className={styles.pillarIcon} />
                  <div>
                    <h3 className={styles.pillarTitle}>{t(p.title)}</h3>
                    <p className={styles.pillarBody}>{t(p.body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </PaperPanel>
          <DialogueBox
            speaker="judge"
            expression="smug"
            text={t('shell.howTo.judge')}
          />
        </div>
      </section>

      <div className={styles.cta}>
        <PaperButtonLink to={paths.court} size="lg" iconStart={<Icon name="gavel" />}>
          {t('shell.courts.pick')}
        </PaperButtonLink>
      </div>
    </div>
  );
}

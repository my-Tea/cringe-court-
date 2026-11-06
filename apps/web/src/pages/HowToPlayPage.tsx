import { MODE_IDS, MODES } from '@cringe-court/core';
import { Link } from 'react-router';
import { DialogueBox, Icon, PaperButtonLink, PaperPanel, PaperRibbon } from '@/ds';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { ModeFacts } from './ModeFacts';
import { PILLARS, TRIAL_STEPS } from './trialContent';
import styles from './pages.module.css';

export function HowToPlayPage() {
  useDocumentTitle('How to play');
  return (
    <div className={styles.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold>
        <div className={styles.hero}>
          <PaperRibbon as="h1" size="lg" sparks className={styles.heroTitle}>
            How to play
          </PaperRibbon>
          <p className={styles.lede}>Six beats, about an hour, every deadline fixed before anyone puts money down.</p>
        </div>
      </PaperPanel>

      <section aria-labelledby="trial-title">
        <div className={styles.sectionHead}>
          <PaperRibbon as="h2" id="trial-title" tone="gold" size="md">
            How a trial works
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
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </PaperPanel>
          ))}
        </ol>
      </section>

      <section aria-labelledby="courts-title">
        <div className={styles.sectionHead}>
          <PaperRibbon as="h2" id="courts-title" tone="gold" size="md">
            Three courts
          </PaperRibbon>
          <p className={styles.sectionLede}>Same jury rules everywhere. Different drama.</p>
        </div>
        <ul className={styles.courtsGrid} role="list">
          {MODE_IDS.map((id) => (
            <PaperPanel key={id} as="li" tone="kraft" edge="torn" elevation={2} padding="md">
              <div className={styles.courtBox}>
                <h3 className={styles.modeName}>{MODES[id].name}</h3>
                <p className={styles.modeTagline}>{MODES[id].tagline}</p>
                <ModeFacts id={id} />
                <Link to={paths.mode(id)} className={styles.modeMore}>
                  Explore {MODES[id].name} <Icon name="arrow-right" />
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
                Funny show. Serious rules.
              </PaperRibbon>
            </div>
            <ul className={styles.pillars} role="list">
              {PILLARS.map((p) => (
                <li key={p.title} className={styles.pillar}>
                  <Icon name="check" className={styles.pillarIcon} />
                  <div>
                    <h3 className={styles.pillarTitle}>{p.title}</h3>
                    <p className={styles.pillarBody}>{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </PaperPanel>
          <DialogueBox
            speaker="judge"
            expression="smug"
            text="Order! The AI writes the drama. The verdict belongs to the jury. I just bang the gavel and read it out loud."
          />
        </div>
      </section>

      <div className={styles.cta}>
        <PaperButtonLink to={paths.court} size="lg" iconStart={<Icon name="gavel" />}>
          Pick your court
        </PaperButtonLink>
      </div>
    </div>
  );
}

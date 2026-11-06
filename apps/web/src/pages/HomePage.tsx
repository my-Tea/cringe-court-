import { MODE_IDS, MODES } from '@cringe-court/core';
import { brandArt, stagePose, uiIcon, type UiIconName } from '@/art/art';
import { Link } from 'react-router';
import { ButtonLink, buttonClassName, Card, CardBody, CardFooter, CardHeader, CardTitle, DialogueBox, Icon, ImpactText, Stamp } from '@/ds';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { MODE_PRESENTATION } from './modeContent';
import { ModeFacts } from './ModeFacts';
import styles from './pages.module.css';

const TRIAL_STEPS: ReadonlyArray<{ icon: UiIconName; title: string; body: string }> = [
  { icon: 'accuse', title: 'File the case', body: 'Write it, pick a category, approve the public version. Nothing goes live without your OK.' },
  { icon: 'bond', title: 'Jury swears in', body: 'Random World-verified humans accept a seat and lock a refundable bond. No friends on the jury.' },
  { icon: 'journal', title: 'The AI performs', body: 'Miss Ratio prosecutes, Counsel Chaos defends. The transcript is frozen and fingerprinted.' },
  { icon: 'commit', title: 'Secret Verdict Scroll', body: 'Each juror seals a hidden vote. Nobody, not even the court, sees a tally.' },
  { icon: 'reveal', title: 'Open Your Scroll', body: 'Jurors reveal what they sealed. Only revealed votes count; a majority decides.' },
  { icon: 'refund', title: 'Verdict & receipts', body: 'Gavel. Bonds back, rewards paid or refunds sent, each with a receipt you can check.' },
];

const PILLARS: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Real, verified humans', body: 'Every juror passes World ID screening. One person, one seat, never on their own case.' },
  { title: 'Sealed ballots', body: 'Commit, then reveal. Votes stay hidden until the reveal window, so nobody follows the crowd.' },
  { title: 'Fixed deadlines', body: 'Every fee, bond and deadline is written into the case when it opens and can never change.' },
  { title: 'Honest money', body: 'Testnet only. No pricing needs no-shows, and failures refund. Every movement gets a receipt.' },
];

export function HomePage() {
  useDocumentTitle(null);
  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1 id="hero-title" className={styles.heroTitle}>
              <img className={styles.heroWordmark} src={brandArt('wordmark')} alt="CringeCourt" width={1114} height={186} data-pixel />
              <span className={styles.heroTagline}>
                The AI performs. <em>Humans decide.</em>
              </span>
            </h1>
            <p className={styles.heroLede}>
              A comedy courtroom for the internet&apos;s dumbest crimes. AI lawyers make the case, a jury of verified strangers
              seals the verdict, and every test-USDC bond, reward and refund is on the record.
            </p>
            <div className={styles.heroActions}>
              {/* In-page jumps stay plain anchors: native scrolling and focus, no router involvement. */}
              <a href="#courts" className={buttonClassName({ size: 'lg' })}>
                <span>Pick your court</span>
                <Icon name="arrow-right" />
              </a>
              <a href="#how" className={buttonClassName({ size: 'lg', variant: 'secondary' })}>
                How a trial works
              </a>
            </div>
          </div>

          <div className={styles.stage} aria-hidden>
            <div className={styles.spotlight} />
            <img className={`${styles.stageChar} ${styles.stageLeft}`} src={stagePose('defense', 'idle_a')} alt="" data-pixel />
            <img className={`${styles.stageChar} ${styles.stageCenter}`} src={stagePose('judge', 'idle')} alt="" data-pixel />
            <img className={`${styles.stageChar} ${styles.stageRight}`} src={stagePose('prosecutor', 'objection')} alt="" data-pixel />
            <div className={styles.stageFloor} />
            <ImpactText kind="objection" size="sm" animate className={styles.stageImpact} />
            <Stamp tone="case-number" size="sm" animate className={styles.stageStamp}>
              Case #0069
            </Stamp>
          </div>
        </div>
      </section>

      <section id="courts" className={styles.section} aria-labelledby="courts-title">
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>Three courts</p>
          <h2 id="courts-title" className={styles.sectionTitle}>
            Pick your court
          </h2>
          <p className={styles.sectionLede}>Same jury rules everywhere. Different drama.</p>
        </div>
        <ul className={styles.modeGrid} role="list">
          {MODE_IDS.map((id) => {
            const m = MODE_PRESENTATION[id];
            return (
              <Card as="li" key={id} tone="raised" padding="md" interactive className={styles.modeCard} data-accent={m.accent}>
                <div className={styles.modeArt} aria-hidden>
                  {m.cast.map((c, i) => (
                    <img key={c.character} src={stagePose(c.character, c.pose)} alt="" className={styles.modeArtChar} data-pos={i} data-pixel />
                  ))}
                </div>
                <CardHeader eyebrow={m.eyebrow}>
                  <CardTitle as="h3">
                    <Link to={paths.mode(id)} data-card-link>
                      {MODES[id].name}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <p className={styles.modeTagline}>{MODES[id].tagline}</p>
                  <ModeFacts id={id} />
                </CardBody>
                <CardFooter>
                  <span className={styles.modeMore}>
                    Explore {MODES[id].name} <Icon name="arrow-right" />
                  </span>
                </CardFooter>
              </Card>
            );
          })}
        </ul>
      </section>

      <section id="how" className={styles.section} aria-labelledby="how-title">
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>The trial</p>
          <h2 id="how-title" className={styles.sectionTitle}>
            How a trial works
          </h2>
          <p className={styles.sectionLede}>Six beats, about an hour, every deadline fixed before anyone puts money down.</p>
        </div>
        <ol className={styles.steps}>
          {TRIAL_STEPS.map((step, i) => {
            const icon = uiIcon(step.icon);
            return (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNum} aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <img src={icon.src} srcSet={icon.srcSet} alt="" width={48} height={48} className={styles.stepIcon} data-pixel />
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="fair-title">
        <div className={styles.fairGrid}>
          <div>
            <div className={styles.sectionHead} data-align="start">
              <p className={styles.eyebrow}>Fair play</p>
              <h2 id="fair-title" className={styles.sectionTitle}>
                Funny show. Serious rules.
              </h2>
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
          </div>
          <DialogueBox
            speaker="judge"
            expression="smug"
            text="Order! The AI writes the drama. The verdict belongs to the jury. I just bang the gavel and read it out loud."
            className={styles.fairDialogue}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="cta-title">
        <Card tone="ornate" padding="lg" as="section" className={styles.ctaBand}>
          <div className={styles.ctaInner}>
            <div>
              <h2 id="cta-title" className={styles.ctaTitle}>
                Court is almost in session.
              </h2>
              <p className={styles.sectionLede}>Filing opens when the contracts and AI counsel land. Until then, tour the courts.</p>
            </div>
            <ButtonLink to={paths.mode('solo')} size="lg" variant="swear" iconEnd={<Icon name="gavel" />}>
              Start with Solo
            </ButtonLink>
          </div>
        </Card>
      </section>
    </>
  );
}

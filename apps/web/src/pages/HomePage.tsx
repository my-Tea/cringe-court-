import { MODE_IDS, MODES } from "@cringe-court/core";
import { Link } from "react-router";
import { stagePose } from "@/art/art";
import { Icon, PaperButtonLink, PaperPanel, PaperRibbon } from "@/ds";
import { paths } from "@/app/routes";
import { useDocumentTitle } from "@/app/useDocumentTitle";
import { webModes } from "@/modes/registry";
import { MODE_PRESENTATION } from "./modeContent";
import { ModeFacts } from "./ModeFacts";
import styles from "./pages.module.css";

/** The courts lobby (/court): pick Solo, Versus or Grand Jury. */
export function HomePage() {
  useDocumentTitle("The court");
  return (
    <div className={styles.page}>
      <PaperPanel
        as="section"
        tone="maroon"
        edge="cut"
        elevation={3}
        backing="gold"
        padding="lg"
        unfold
        aria-labelledby="lobby-title"
      >
        <div className={styles.hero}>
          <PaperRibbon
            as="h1"
            id="lobby-title"
            size="lg"
            sparks
            className={styles.heroTitle}
          >
            Pick your court
          </PaperRibbon>
          <PaperRibbon
            as="p"
            tails={false}
            size="sm"
            className={styles.heroTag}
          >
            Same jury rules everywhere. Different drama.
          </PaperRibbon>
          <p className={styles.lede}>
            AI lawyers make the case, a jury of verified strangers seals the
            verdict, and every test-USDC bond, reward and refund is on the
            record.
          </p>
        </div>
      </PaperPanel>

      <section aria-label="Courts">
        <ul className={styles.modeGrid} role="list">
          {MODE_IDS.map((id) => {
            const m = MODE_PRESENTATION[id];
            return (
              <li
                key={id}
                className={styles.modeCardWrap}
                data-accent={m.accent}
              >
                <PaperPanel tone="cream" edge="cut" elevation={2} padding="md">
                  <div className={styles.modeCard}>
                    <div className={styles.modeArt} aria-hidden>
                      {m.cast.map((c, i) => (
                        <img
                          key={c.character}
                          src={stagePose(c.character, c.pose)}
                          alt=""
                          className={styles.modeArtChar}
                          data-pos={i}
                          data-pixel
                        />
                      ))}
                    </div>
                    <p className={styles.modeEyebrow}>{m.eyebrow}</p>
                    <h2 className={styles.modeName}>
                      <Link to={paths.mode(id)}>{MODES[id].name}</Link>
                    </h2>
                    <p className={styles.modeTagline}>{MODES[id].tagline}</p>
                    <ModeFacts id={id} />
                    <span className={styles.modeMore}>
                      {webModes.get(id)?.landing ? "Enter" : "Explore"} {MODES[id].name} <Icon name="arrow-right" />
                    </span>
                  </div>
                </PaperPanel>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="mine-title" className={styles.mine}>
        <div className={styles.sectionHead}>
          <PaperRibbon as="h2" id="mine-title" tone="gold" size="md">
            Your cases
          </PaperRibbon>
          <p className={styles.sectionLede}>Pick up where you left off: open trials, sealed ballots and money to collect.</p>
        </div>
        <ul className={styles.mineList} role="list">
          {MODE_IDS.map((id) => {
            const docket = webModes.get(id)?.docket;
            if (!docket) return null;
            return (
              <li key={id}>
                <PaperButtonLink to={docket.to} variant="maroon" size="md" iconStart={<Icon name="document" />}>
                  {docket.label}
                </PaperButtonLink>
              </li>
            );
          })}
        </ul>
      </section>

      <PaperPanel
        as="section"
        tone="kraft"
        edge="torn"
        elevation={2}
        padding="lg"
        aria-labelledby="cta-title"
      >
        <div className={styles.cta}>
          <h2 id="cta-title" className={styles.ctaTitle}>
            New here? Learn the trial in a minute.
          </h2>
          <p className={styles.sectionLede}>
            Every court is open on the testnet demo: scripted AI counsel, an
            in-browser twin of the Arc contract and free test USDC. Read the
            rules, or watch a whole trial play out in the demo court.
          </p>
          <div className={styles.heroActions}>
            <PaperButtonLink
              to={paths.howToPlay}
              size="md"
              iconStart={<Icon name="book" />}
            >
              How to play
            </PaperButtonLink>
            <PaperButtonLink
              to={paths.courtroom}
              variant="maroon"
              size="md"
              iconStart={<Icon name="gavel" />}
            >
              Visit the demo court
            </PaperButtonLink>
          </div>
        </div>
      </PaperPanel>
    </div>
  );
}

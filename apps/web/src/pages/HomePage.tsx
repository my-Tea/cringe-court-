import { MODE_IDS } from "@cringe-court/core";
import { Link } from "react-router";
import { stagePose } from "@/art/art";
import { Icon, PaperButtonLink, PaperPanel, PaperRibbon } from "@/ds";
import { paths } from "@/app/routes";
import { useDocumentTitle } from "@/app/useDocumentTitle";
import { resolveModeLabel, webModes } from "@/modes/registry";
import { t } from "@/i18n";
import { MODE_PRESENTATION } from "./modeContent";
import { MODE_NAME_KEY, MODE_TAGLINE_KEY } from "./modeText";
import { ModeFacts } from "./ModeFacts";
import styles from "./pages.module.css";

/** The courts lobby (/court): pick Solo, Versus or Grand Jury. */
export function HomePage() {
  useDocumentTitle(t("shell.nav.court"));
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
            {t("shell.courts.pick")}
          </PaperRibbon>
          <PaperRibbon
            as="p"
            tails={false}
            size="sm"
            className={styles.heroTag}
          >
            {t("shell.courts.tagline")}
          </PaperRibbon>
          <p className={styles.lede}>
            {t("shell.home.lede")}
          </p>
        </div>
      </PaperPanel>

      <section aria-label={t("shell.nav.courts")}>
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
                    <p className={styles.modeEyebrow}>{t(m.eyebrow)}</p>
                    <h2 className={styles.modeName}>
                      <Link to={paths.mode(id)}>{t(MODE_NAME_KEY[id])}</Link>
                    </h2>
                    <p className={styles.modeTagline}>{t(MODE_TAGLINE_KEY[id])}</p>
                    <ModeFacts id={id} />
                    <span className={styles.modeMore}>
                      {t(webModes.get(id)?.landing ? "shell.home.enter" : "shell.home.explore", { name: t(MODE_NAME_KEY[id]) })} <Icon name="arrow-right" />
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
            {t("shell.home.mine.title")}
          </PaperRibbon>
          <p className={styles.sectionLede}>{t("shell.home.mine.lede")}</p>
        </div>
        <ul className={styles.mineList} role="list">
          {MODE_IDS.map((id) => {
            const docket = webModes.get(id)?.docket;
            if (!docket) return null;
            return (
              <li key={id}>
                <PaperButtonLink to={docket.to} variant="maroon" size="md" iconStart={<Icon name="document" />}>
                  {resolveModeLabel(docket.label)}
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
            {t("shell.home.cta.title")}
          </h2>
          <p className={styles.sectionLede}>
            {t("shell.home.cta.body")}
          </p>
          <div className={styles.heroActions}>
            <PaperButtonLink
              to={paths.howToPlay}
              size="md"
              iconStart={<Icon name="book" />}
            >
              {t("shell.nav.howToPlay")}
            </PaperButtonLink>
            <PaperButtonLink
              to={paths.courtroom}
              variant="maroon"
              size="md"
              iconStart={<Icon name="gavel" />}
            >
              {t("shell.home.cta.demo")}
            </PaperButtonLink>
          </div>
        </div>
      </PaperPanel>
    </div>
  );
}

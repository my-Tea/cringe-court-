import { MODES, type ModeId } from '@cringe-court/core';
import { stagePose } from '@/art/art';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, Card, CardBody, CardHeader, CardTitle, Icon, PaperButton, PaperButtonLink, PaperPanel, PaperRibbon, PhaseStepper, Tooltip } from '@/ds';
import { webModes } from '@/modes/registry';
import { MODE_PRESENTATION } from './modeContent';
import { ModeFacts } from './ModeFacts';
import styles from './pages.module.css';

export function ModePage({ id }: { id: ModeId }) {
  const mode = MODES[id];
  const m = MODE_PRESENTATION[id];
  const playable = webModes.get(id)?.landing;
  useDocumentTitle(mode.name);

  return (
    <div className={styles.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold aria-labelledby="mode-title">
        <div className={styles.modeHero} data-accent={m.accent}>
          <div className={styles.modeHeroCopy}>
            <PaperRibbon as="p" tone="gold" size="sm">
              {m.eyebrow}
            </PaperRibbon>
            <h1 id="mode-title" className={styles.modeTitle}>
              {mode.name}
            </h1>
            <p className={styles.modeHeadline}>{m.headline}</p>
            <p className={styles.modeLede}>{m.pitch}</p>
            <div className={styles.heroActions}>
              {playable ? (
                <>
                  <PaperButtonLink to={playable.to} size="lg" iconEnd={<Icon name="arrow-right" />}>
                    {playable.label}
                  </PaperButtonLink>
                  {playable.secondary && (
                    <PaperButtonLink to={playable.secondary.to} size="lg" variant="maroon">
                      {playable.secondary.label}
                    </PaperButtonLink>
                  )}
                </>
              ) : (
                <Tooltip content="Filing opens when the contracts and AI counsel phases land.">
                  <PaperButton size="lg" disabled iconStart={<Icon name="lock" />}>
                    Filing opens soon
                  </PaperButton>
                </Tooltip>
              )}
              <PaperButtonLink to={paths.court} size="lg" variant="ghost" iconStart={<Icon name="arrow-left" />}>
                All courts
              </PaperButtonLink>
            </div>
          </div>
          <div className={styles.modeStage} aria-hidden>
            {m.cast.map((c, i) => (
              <img key={c.character} src={stagePose(c.character, c.pose)} alt="" className={styles.modeStageChar} data-pos={i} data-pixel />
            ))}
          </div>
        </div>
      </PaperPanel>

      <div className={styles.modeBody}>
        <Card tone="raised" as="section" aria-labelledby="facts-title">
          <CardHeader eyebrow="Before anyone pays">
            <CardTitle id="facts-title" as="h2">
              The numbers
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ModeFacts id={id} detailed />
            <p className={styles.factsNote}>Written into each case when it opens. They can never change for that case.</p>
          </CardBody>
        </Card>

        <Card as="section" aria-labelledby="flow-title">
          <CardHeader eyebrow="Step by step">
            <CardTitle id="flow-title" as="h2">
              How it goes
            </CardTitle>
          </CardHeader>
          <CardBody>
            <PhaseStepper steps={m.steps} current={-1} orientation="vertical" label={`${mode.name} steps`} />
          </CardBody>
        </Card>

        <Card as="section" aria-labelledby="money-title" className={styles.moneyCard}>
          <CardHeader eyebrow="Follow the money">
            <CardTitle id="money-title" as="h2">
              Who pays, who keeps, who gets refunded
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className={styles.moneyList}>
              <div>
                <dt>Who pays</dt>
                <dd>{m.whoPays}</dd>
              </div>
              <div>
                <dt>What the court keeps</dt>
                <dd>{m.revenue}</dd>
              </div>
              <div>
                <dt>Refunds</dt>
                <dd>{m.refunds}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {playable ? (
          <Alert tone="info" title="Playable on the demo court" className={styles.modeAlert}>
            This court runs on this browser with test USDC on a memory twin of the Arc testnet contract, offline AI counsel and a mock
            World ID verifier. Open the invite in a second tab to play the other side. Nothing here touches real money.
          </Alert>
        ) : (
          <Alert tone="warning" title="You are looking at the app shell" className={styles.modeAlert}>
            This build has the courts, design system and rules, but no filing yet. Contracts on Arc testnet, AI counsel on 0G and
            World ID juror screening arrive in the next phases. Nothing here touches money.
          </Alert>
        )}
      </div>
    </div>
  );
}

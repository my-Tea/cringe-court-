import { type ModeId } from '@cringe-court/core';
import { stagePose } from '@/art/art';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, Card, CardBody, CardHeader, CardTitle, Icon, PaperButton, PaperButtonLink, PaperPanel, PaperRibbon, PhaseStepper, Tooltip } from '@/ds';
import { resolveModeLabel, webModes } from '@/modes/registry';
import { t } from '@/i18n';
import { MODE_PRESENTATION } from './modeContent';
import { ModeFacts } from './ModeFacts';
import { MODE_NAME_KEY } from './modeText';
import styles from './pages.module.css';

export function ModePage({ id }: { id: ModeId }) {
  const name = t(MODE_NAME_KEY[id]);
  const m = MODE_PRESENTATION[id];
  const playable = webModes.get(id)?.landing;
  useDocumentTitle(name);

  return (
    <div className={styles.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold aria-labelledby="mode-title">
        <div className={styles.modeHero} data-accent={m.accent}>
          <div className={styles.modeHeroCopy}>
            <PaperRibbon as="p" tone="gold" size="sm">
              {t(m.eyebrow)}
            </PaperRibbon>
            <h1 id="mode-title" className={styles.modeTitle}>
              {name}
            </h1>
            <p className={styles.modeHeadline}>{t(m.headline)}</p>
            <p className={styles.modeLede}>{t(m.pitch)}</p>
            <div className={styles.heroActions}>
              {playable ? (
                <>
                  <PaperButtonLink to={playable.to} size="lg" iconEnd={<Icon name="arrow-right" />}>
                    {resolveModeLabel(playable.label)}
                  </PaperButtonLink>
                  {playable.secondary && (
                    <PaperButtonLink to={playable.secondary.to} size="lg" variant="maroon">
                      {resolveModeLabel(playable.secondary.label)}
                    </PaperButtonLink>
                  )}
                </>
              ) : (
                <Tooltip content={t('shell.mode.filing.tooltip')}>
                  <PaperButton size="lg" disabled iconStart={<Icon name="lock" />}>
                    {t('shell.mode.filing.soon')}
                  </PaperButton>
                </Tooltip>
              )}
              <PaperButtonLink to={paths.court} size="lg" variant="ghost" iconStart={<Icon name="arrow-left" />}>
                {t('shell.mode.allCourts')}
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
          <CardHeader eyebrow={t('shell.mode.facts.eyebrow')}>
            <CardTitle id="facts-title" as="h2">
              {t('shell.mode.facts.title')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ModeFacts id={id} detailed />
            <p className={styles.factsNote}>{t('shell.mode.facts.note')}</p>
          </CardBody>
        </Card>

        <Card as="section" aria-labelledby="flow-title">
          <CardHeader eyebrow={t('shell.mode.flow.eyebrow')}>
            <CardTitle id="flow-title" as="h2">
              {t('shell.mode.flow.title')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <PhaseStepper steps={m.steps.map((k) => t(k))} current={-1} orientation="vertical" label={t('shell.mode.flow.label', { name })} />
          </CardBody>
        </Card>

        <Card as="section" aria-labelledby="money-title" className={styles.moneyCard}>
          <CardHeader eyebrow={t('shell.mode.money.eyebrow')}>
            <CardTitle id="money-title" as="h2">
              {t('shell.mode.money.title')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className={styles.moneyList}>
              <div>
                <dt>{t('shell.mode.money.pays')}</dt>
                <dd>{t(m.whoPays)}</dd>
              </div>
              <div>
                <dt>{t('shell.mode.money.keeps')}</dt>
                <dd>{t(m.revenue)}</dd>
              </div>
              <div>
                <dt>{t('shell.mode.money.refunds')}</dt>
                <dd>{t(m.refunds)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {playable ? (
          id === 'versus' ? (
            <Alert tone="info" title={t('shell.mode.alert.versus.title')} className={styles.modeAlert}>
              {t('shell.mode.alert.versus.body')}
            </Alert>
          ) : id === 'grand-jury' ? (
            <Alert tone="info" title={t('shell.mode.alert.grandJury.title')} className={styles.modeAlert}>
              {t('shell.mode.alert.grandJury.body')}
            </Alert>
          ) : (
            <Alert tone="info" title={t('shell.mode.alert.demo.title')} className={styles.modeAlert}>
              {t('shell.mode.alert.demo.body')}
            </Alert>
          )
        ) : (
          <Alert tone="warning" title={t('shell.mode.alert.shell.title')} className={styles.modeAlert}>
            {t('shell.mode.alert.shell.body')}
          </Alert>
        )}
      </div>
    </div>
  );
}

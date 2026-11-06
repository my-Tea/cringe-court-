import { BASE_MODES, TRIAL_STAGES, type TrialStage as Stage } from '@cringe-court/core';
import { formatAmount, stageLabel } from '@/i18n/domain';
import { ShowPlayer } from '@cringe-court/engine';
import { useCourtroom } from '@cringe-court/scene/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Icon, PhaseStepper, Receipt, Spinner, cx, useReducedMotion } from '@/ds';
import { t, type MessageKey } from '@/i18n';
import { SAMPLE_CASES, runDemoCourt, type DemoUpdate, type JuryPlan, type SampleCase } from './demoCourt';
import { appAudioPort } from '@/platform/audio';
import { TrialStage } from './TrialStage';
import styles from './DemoCourtPage.module.css';

const STEPS = TRIAL_STAGES.filter((s): s is Exclude<Stage, 'closed' | 'appeal'> => s !== 'closed' && s !== 'appeal');

/** What the stage chip says, by demo phase (the case itself is already recruiting while the show plays). */
const PHASE_CHIP: Readonly<Record<DemoUpdate['phase'], MessageKey>> = {
  preparing: 'solo.stage.demo.phase.preparing',
  opening: 'solo.stage.demo.phase.opening',
  trial: 'solo.stage.demo.phase.trial',
  jury: 'solo.stage.demo.phase.jury',
  verdict: 'solo.stage.demo.phase.verdict',
  done: 'solo.stage.demo.phase.done',
};

const PLAN_LABELS: Readonly<Record<JuryPlan, { title: MessageKey; sub: MessageKey }>> = {
  guilty: { title: 'solo.stage.demo.plan.guilty', sub: 'solo.stage.demo.plan.guiltySub' },
  'not-cooked': { title: 'solo.stage.demo.plan.notCooked', sub: 'solo.stage.demo.plan.notCookedSub' },
  mistrial: { title: 'solo.stage.demo.plan.mistrial', sub: 'solo.stage.demo.plan.mistrialSub' },
};

export function DemoCourtPage() {
  useDocumentTitle(t('solo.stage.demo.doc'));
  const reduced = useReducedMotion();
  const court = useCourtroom({ reducedMotion: reduced });
  const [sample, setSample] = useState<SampleCase>(SAMPLE_CASES[0]!);
  const [plan, setPlan] = useState<JuryPlan>('guilty');
  const [update, setUpdate] = useState<DemoUpdate | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const player = useMemo(() => (court.state === 'ready' ? new ShowPlayer({ scene: court.port, audio: appAudioPort }) : null), [court]);

  // Stage the Solo cast as soon as the room is ready, so the idle court is alive.
  useEffect(() => {
    if (court.state !== 'ready') return;
    court.port.setCast(BASE_MODES.solo.staging(BASE_MODES.solo.terms()));
    court.port.camera('pov_entrance', 0);
    court.port.lighting('house', 0);
  }, [court]);

  useEffect(() => () => abort.current?.abort(), []);

  // `?debug` exposes the runtime for staging work and browser checks (window.__courtroom).
  useEffect(() => {
    if (court.state === 'ready' && new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as { __courtroom?: unknown }).__courtroom = court;
    }
  }, [court]);

  const start = async () => {
    if (court.state !== 'ready' || !player) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRunning(true);
    setError(null);
    setUpdate(null);
    try {
      await runDemoCourt({ sample, plan, scene: court.port, audio: appAudioPort, player, onUpdate: setUpdate, signal: ctrl.signal });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abort.current === ctrl) setRunning(false);
    }
  };

  const stop = () => {
    abort.current?.abort();
    setRunning(false);
    if (court.state === 'ready') {
      court.port.lighting('house', 0.6);
      court.port.camera('pov_entrance', 1.2);
    }
  };

  const settledCase = update && update.receipts.length > 0 ? update.caseNumber : null;
  const stage = update?.state.stage;
  const current = update?.phase === 'done' ? STEPS.length : stage ? Math.max(0, STEPS.indexOf(stage as (typeof STEPS)[number])) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t('solo.stage.demo.eyebrow')}</p>
        <h1 className={styles.title}>{t('solo.stage.demo.heading')}</h1>
        <p className={styles.lede}>{t('solo.stage.demo.lede')}</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          {court.state === 'loading' && (
            <div className={styles.placeholder}>
              <Spinner size="lg" label={t('solo.stage.demo.loadingAria', { pct: Math.round(court.progress * 100) })} />
              <p>{t('solo.stage.demo.loading', { pct: Math.round(court.progress * 100) })}</p>
            </div>
          )}
          {court.state === 'error' && (
            <Alert tone="danger" title={t('solo.stage.demo.loadError')}>
              {t('solo.stage.demo.loadErrorBody', { message: court.error.message })}
            </Alert>
          )}
          {court.state === 'ready' && player && (
            <TrialStage
              runtime={court.runtime}
              scene={court.port}
              player={player}
              caseLabel={update?.caseLabel ?? null}
              status={update ? t(PHASE_CHIP[update.phase]) : t('solo.stage.demo.phase.recess')}
            />
          )}
          {error && (
            <Alert tone="danger" title={t('solo.stage.demo.stoppedTitle')} live="assertive">
              {error}
            </Alert>
          )}
        </div>

        <aside className={styles.side} aria-label={t('solo.stage.demo.caseFile')}>
          <Card tone="raised" as="section" aria-labelledby="setup-title">
            <CardHeader eyebrow={t('solo.stage.demo.pick')}>
              <CardTitle id="setup-title" as="h2">
                {t('solo.stage.demo.docket')}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <fieldset className={styles.choices} disabled={running}>
                <legend className={styles.legend}>{t('solo.stage.demo.confession')}</legend>
                {SAMPLE_CASES.map((c) => (
                  <label key={c.id} className={cx(styles.choice, sample.id === c.id && styles.chosen)}>
                    <input type="radio" name="sample" value={c.id} checked={sample.id === c.id} onChange={() => setSample(c)} />
                    <span className={styles.choiceTitle}>{c.title}</span>
                    <span className={styles.choiceSub}>{c.story}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className={cx(styles.choices, styles.plans)} disabled={running}>
                <legend className={styles.legend}>{t('solo.stage.demo.juryVotes')}</legend>
                {(Object.keys(PLAN_LABELS) as JuryPlan[]).map((p) => (
                  <label key={p} className={cx(styles.choice, plan === p && styles.chosen)} data-plan={p}>
                    <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} />
                    <span className={styles.choiceTitle}>{t(PLAN_LABELS[p].title)}</span>
                    <span className={styles.choiceSub}>{t(PLAN_LABELS[p].sub)}</span>
                  </label>
                ))}
              </fieldset>
              <div className={styles.actions}>
                {running ? (
                  <Button variant="secondary" onClick={stop} fullWidth>
                    {t('solo.stage.demo.stop')}
                  </Button>
                ) : (
                  <Button onClick={() => void start()} disabled={court.state !== 'ready'} fullWidth iconStart={<Icon name="gavel" />}>
                    {update ? t('solo.stage.demo.runAgain') : t('solo.stage.demo.start')}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          <Card as="section" aria-labelledby="progress-title">
            <CardHeader eyebrow={update?.caseLabel ?? t('solo.stage.demo.noCase')}>
              <CardTitle id="progress-title" as="h2">
                {t('solo.stage.demo.where')}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <PhaseStepper steps={STEPS.map((s) => stageLabel(s))} current={update ? current : -1} orientation="vertical" label={t('solo.stage.demo.progress')} />
              {update && (
                <dl className={styles.facts}>
                  <div>
                    <dt>{t('solo.stage.demo.sealed')}</dt>
                    <dd>
                      {t('solo.stage.demo.sealedValue', { n: update.sealed })} <span className={styles.hint}>{t('solo.stage.demo.sealedHint')}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>{t('solo.stage.demo.revealed')}</dt>
                    <dd>{t('solo.stage.demo.sealedValue', { n: update.revealed })}</dd>
                  </div>
                  <div>
                    <dt>{t('solo.stage.demo.charge')}</dt>
                    <dd>{t('solo.stage.demo.chargeValue', { amount: formatAmount(update.state.terms.target) })}</dd>
                  </div>
                </dl>
              )}
              <p className={styles.log} aria-live="polite">
                {update?.log ?? t('solo.stage.demo.log.idle')}
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <section className={styles.receipts} aria-labelledby="receipts-title">
        <h2 id="receipts-title" className={styles.sectionTitle}>
          {t('solo.stage.demo.receipts')}
        </h2>
        {update && settledCase !== null ? (
          <div className={styles.receiptGrid}>
            {update.receipts.map((r) => (
              <Receipt key={r.party} caseNumber={settledCase} title={r.party} lines={r.lines} note={t('solo.stage.demo.receiptNote')} />
            ))}
          </div>
        ) : (
          <EmptyState title={t('solo.stage.demo.noReceipts')} compact headingLevel={3}>
            {t('solo.stage.demo.noReceiptsBody')}
          </EmptyState>
        )}
      </section>
    </div>
  );
}

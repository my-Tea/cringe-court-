import { BASE_MODES, STAGE_LABELS, TRIAL_STAGES, formatUsdc, type TrialStage as Stage } from '@cringe-court/core';
import { ShowPlayer } from '@cringe-court/engine';
import { useCourtroom } from '@cringe-court/scene/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Icon, PhaseStepper, Receipt, Spinner, cx, useReducedMotion } from '@/ds';
import { SAMPLE_CASES, runDemoCourt, type DemoUpdate, type JuryPlan, type SampleCase } from './demoCourt';
import { silentAudio } from './silentAudio';
import { TrialStage } from './TrialStage';
import styles from './DemoCourtPage.module.css';

const STEPS = TRIAL_STAGES.filter((s): s is Exclude<Stage, 'closed' | 'appeal'> => s !== 'closed' && s !== 'appeal');

/** What the stage chip says, by demo phase (the case itself is already recruiting while the show plays). */
const PHASE_CHIP: Readonly<Record<DemoUpdate['phase'], string>> = {
  preparing: 'Counsel preparing',
  opening: 'Case opened',
  trial: 'Court in session',
  jury: 'Jury duty',
  verdict: 'Verdict',
  done: 'Case closed',
};

const PLAN_LABELS: Readonly<Record<JuryPlan, { title: string; sub: string }>> = {
  guilty: { title: 'Guilty', sub: '2 of 3 say GUILTY' },
  'not-cooked': { title: 'Not cooked', sub: '2 of 3 say NOT COOKED' },
  mistrial: { title: 'Mistrial', sub: 'A no-show and a split vote' },
};

export function DemoCourtPage() {
  useDocumentTitle('Demo court');
  const reduced = useReducedMotion();
  const court = useCourtroom({ reducedMotion: reduced });
  const [sample, setSample] = useState<SampleCase>(SAMPLE_CASES[0]!);
  const [plan, setPlan] = useState<JuryPlan>('guilty');
  const [update, setUpdate] = useState<DemoUpdate | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const player = useMemo(() => (court.state === 'ready' ? new ShowPlayer({ scene: court.port, audio: silentAudio }) : null), [court]);

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
      await runDemoCourt({ sample, plan, scene: court.port, audio: silentAudio, player, onUpdate: setUpdate, signal: ctrl.signal });
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
        <p className={styles.eyebrow}>Engine preview</p>
        <h1 className={styles.title}>Demo court</h1>
        <p className={styles.lede}>
          A complete Solo trial, start to finish, in the voxel courtroom. The AI counsel, the ledger and World ID are the offline twins the tests use, so
          nothing here touches a wallet or a network.
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          {court.state === 'loading' && (
            <div className={styles.placeholder}>
              <Spinner size="lg" label={`Building the courtroom, ${Math.round(court.progress * 100)}%`} />
              <p>Building the courtroom… {Math.round(court.progress * 100)}%</p>
            </div>
          )}
          {court.state === 'error' && (
            <Alert tone="danger" title="The courtroom could not load">
              {court.error.message}. WebGL may be off in this browser.
            </Alert>
          )}
          {court.state === 'ready' && player && (
            <TrialStage
              runtime={court.runtime}
              scene={court.port}
              player={player}
              caseLabel={update?.caseLabel ?? null}
              status={update ? PHASE_CHIP[update.phase] : 'Court in recess'}
            />
          )}
          {error && (
            <Alert tone="danger" title="The demo stopped" live="assertive">
              {error}
            </Alert>
          )}
        </div>

        <aside className={styles.side} aria-label="Case file">
          <Card tone="raised" as="section" aria-labelledby="setup-title">
            <CardHeader eyebrow="Pick a case">
              <CardTitle id="setup-title" as="h2">
                The docket
              </CardTitle>
            </CardHeader>
            <CardBody>
              <fieldset className={styles.choices} disabled={running}>
                <legend className={styles.legend}>Confession</legend>
                {SAMPLE_CASES.map((c) => (
                  <label key={c.id} className={cx(styles.choice, sample.id === c.id && styles.chosen)}>
                    <input type="radio" name="sample" value={c.id} checked={sample.id === c.id} onChange={() => setSample(c)} />
                    <span className={styles.choiceTitle}>{c.title}</span>
                    <span className={styles.choiceSub}>{c.story}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className={cx(styles.choices, styles.plans)} disabled={running}>
                <legend className={styles.legend}>How the simulated jury votes</legend>
                {(Object.keys(PLAN_LABELS) as JuryPlan[]).map((p) => (
                  <label key={p} className={cx(styles.choice, plan === p && styles.chosen)} data-plan={p}>
                    <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} />
                    <span className={styles.choiceTitle}>{PLAN_LABELS[p].title}</span>
                    <span className={styles.choiceSub}>{PLAN_LABELS[p].sub}</span>
                  </label>
                ))}
              </fieldset>
              <div className={styles.actions}>
                {running ? (
                  <Button variant="secondary" onClick={stop} fullWidth>
                    Stop the trial
                  </Button>
                ) : (
                  <Button onClick={() => void start()} disabled={court.state !== 'ready'} fullWidth iconStart={<Icon name="gavel" />}>
                    {update ? 'Run it again' : 'Call the court to order'}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          <Card as="section" aria-labelledby="progress-title">
            <CardHeader eyebrow={update?.caseLabel ?? 'No case yet'}>
              <CardTitle id="progress-title" as="h2">
                Where the case is
              </CardTitle>
            </CardHeader>
            <CardBody>
              <PhaseStepper steps={STEPS.map((s) => STAGE_LABELS[s])} current={update ? current : -1} orientation="vertical" label="Case progress" />
              {update && (
                <dl className={styles.facts}>
                  <div>
                    <dt>Sealed ballots</dt>
                    <dd>
                      {update.sealed} of 3 <span className={styles.hint}>(choices stay hidden until reveal)</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Revealed</dt>
                    <dd>{update.revealed} of 3</dd>
                  </div>
                  <div>
                    <dt>Case charge</dt>
                    <dd>{formatUsdc(update.state.terms.target)} (test)</dd>
                  </div>
                </dl>
              )}
              <p className={styles.log} aria-live="polite">
                {update?.log ?? 'Pick a confession and a jury, then call the court to order.'}
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <section className={styles.receipts} aria-labelledby="receipts-title">
        <h2 id="receipts-title" className={styles.sectionTitle}>
          Settlement receipts
        </h2>
        {update && settledCase !== null ? (
          <div className={styles.receiptGrid}>
            {update.receipts.map((r) => (
              <Receipt key={r.party} caseNumber={settledCase} title={r.party} lines={r.lines} note="Paid by the in-memory ledger with the same settlement maths as the contract." />
            ))}
          </div>
        ) : (
          <EmptyState title="No receipts yet" compact headingLevel={3}>
            Every juror and the filer get a line-by-line receipt when the case settles.
          </EmptyState>
        )}
      </section>
    </div>
  );
}

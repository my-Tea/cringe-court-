import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { CANCEL_LABELS, formatCaseNumber } from '@cringe-court/core';
import { isDemoTerms, soloMode } from '@cringe-court/modes-solo';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
import { Badge, EmptyState, Icon, PaperButton, PaperButtonLink, PaperRibbon, PhaseStepper, TestnetBadge } from '@/ds';
import { beatsFromLines } from '@/trial/beats';
import { TrialViewFrame } from '@/trial/TrialViewFrame';
import { Courtroom } from '../court/Courtroom';
import { JuryStage } from '../court/JuryStage';
import { demoCourt, docketEntry, saveToDocket } from '../lib/demoCourt';
import { soloPaths } from '../lib/paths';
import { useSessionSnapshot } from '../lib/useSession';
import { CaseSounds } from './CaseSounds';
import { VerdictPanel } from './VerdictPanel';
import styles from './CasePage.module.css';

const steps = () => [t('solo.case.steps.jury'), t('solo.case.steps.trial'), t('solo.case.steps.deliberation'), t('solo.case.steps.verdict'), t('solo.case.steps.share')];

/**
 * /solo/case/:trialId — the paid case: the jury is seated, everyone watches the
 * frozen trial, the jury seals and opens its scrolls, the verdict lands and the
 * share card is drawn. Decided cases are kept in this browser's docket.
 */
export function CasePage() {
  const { trialId = '' } = useParams();
  const court = demoCourt();
  const session = court.session?.trial.id === trialId ? court.session : null;
  const live = useSessionSnapshot(session);
  const [stored] = useState(() => (session ? null : docketEntry(trialId)));
  const snap = live ?? stored?.snapshot ?? null;
  const [watched, setWatched] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const tState = snap?.trial;
  useDocumentTitle(tState && 'caseNumber' in tState && tState.caseNumber ? t('solo.case.doc.numbered', { caseNumber: formatCaseNumber(tState.caseNumber) }) : t('solo.case.doc.default'));

  // The trial plays before the verdict exists (the jury beat ends it), so no verdict beat is planned.
  const lines = tState && 'transcript' in tState ? tState.transcript?.lines : undefined;
  const roamBeats = useMemo(() => (lines ? beatsFromLines(lines) : []), [lines]);

  useEffect(() => {
    if (live) saveToDocket(live);
  }, [live]);

  const phaseKey = tState ? `${tState.stage}:${watched}` : '';
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (tState?.stage === 'verdict') headingRef.current?.querySelector<HTMLElement>('h1')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  if (!snap || !tState) {
    return (
      <div className={styles.page}>
        <EmptyState
          title={t('solo.case.missing.title')}
          headingLevel={1}
          character="clerk"
          expression="shocked"
          actions={
            <>
              <PaperButtonLink to={soloPaths.file} iconStart={<Icon name="plus" />}>
                {t('solo.case.missing.file')}
              </PaperButtonLink>
              <PaperButtonLink to={soloPaths.docket} variant="maroon">
                {t('solo.docket.heading')}
              </PaperButtonLink>
            </>
          }
        >
          {t('solo.case.missing.body')}
        </EmptyState>
      </div>
    );
  }

  if (tState.stage === 'filing' || tState.stage === 'evidence' || tState.stage === 'counsel') return <Navigate to={soloPaths.file} replace />;

  const caseNumber = 'caseNumber' in tState && tState.caseNumber ? formatCaseNumber(tState.caseNumber) : null;
  const inJury = tState.stage === 'jury';
  const showTrial = inJury && tState.step !== 'recruiting' && !watched && tState.step === 'commit' && tState.seats.every((s) => !s.committed);
  const current = tState.stage === 'jury' ? (tState.step === 'recruiting' ? 0 : showTrial ? 1 : 2) : tState.stage === 'verdict' ? 3 : tState.stage === 'share' ? 4 : 0;

  return (
    <div className={styles.page}>
      <CaseSounds key={trialId} t={tState} />
      <header className={styles.top}>
        <div className={styles.topRow}>
          <PaperButtonLink to={soloPaths.docket} variant="maroon" size="sm" iconStart={<Icon name="arrow-left" />}>
            {t('solo.case.back')}
          </PaperButtonLink>
          <div className={styles.badges}>
            {caseNumber && <Badge tone="accent">{caseNumber}</Badge>}
            <TestnetBadge />
            {isDemoTerms(tState.terms) && <Badge tone="info">{t('solo.case.demoBadge')}</Badge>}
          </div>
        </div>
        <div ref={headingRef} className={styles.title}>
          <PaperRibbon as="h1" size="lg" sparks tabIndex={-1}>
            {tState.filing.title}
          </PaperRibbon>
        </div>
        {tState.stage !== 'closed' && <PhaseStepper steps={steps()} current={current} label={t('solo.case.progress')} />}
      </header>

      {inJury && showTrial && (
        <section aria-labelledby="trial-title" className={styles.trial}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>{t('solo.case.trial.eyebrow')}</p>
            <h2 id="trial-title" className={styles.h2}>
              {t('solo.case.trial.heading')}
            </h2>
            <p className={styles.small}>{t('solo.case.trial.body')}</p>
          </div>
          <TrialViewFrame
            roam={{
              beats: roamBeats,
              label: t('solo.courtroom.region', { title: tState.filing.title }),
              role: 'defendant',
              spawn: 'defendant',
              avatar: { model: 'creator', name: t('solo.case.trial.you') },
              onDone: () => setWatched(true),
            }}
            classic={<Courtroom lines={tState.transcript.lines} cast={soloMode.staging(tState.terms)} title={tState.filing.title} exhibits={tState.exhibits} audio={court.audio} onFinished={() => setWatched(true)} />}
            toolbar={
              <PaperButton size="sm" variant="maroon" onClick={() => setWatched(true)} iconEnd={<Icon name="arrow-right" />}>
                {t('solo.case.trial.skip')}
              </PaperButton>
            }
          />
        </section>
      )}

      {inJury && !showTrial && session && live && live.trial.stage === 'jury' && <JuryStage session={session} snap={{ ...live, trial: live.trial }} clock={court.clock} />}

      {(tState.stage === 'verdict' || tState.stage === 'share') && <VerdictPanel snap={{ ...snap, trial: tState }} session={session} />}

      {tState.stage === 'closed' && (
        <EmptyState title={t('solo.case.closed.title')} headingLevel={2} character="judge" expression="shocked" actions={<PaperButtonLink to={soloPaths.file}>{t('solo.case.closed.again')}</PaperButtonLink>}>
          {t('solo.case.closed.body', { reason: CANCEL_LABELS[tState.reason] })}
        </EmptyState>
      )}
    </div>
  );
}

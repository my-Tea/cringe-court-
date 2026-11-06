import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { CANCEL_LABELS, formatCaseNumber } from '@cringe-court/core';
import { isDemoTerms, soloMode } from '@cringe-court/modes-solo';
import { useDocumentTitle } from '@/app/useDocumentTitle';
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

const STEPS = ['Jury selection', 'The trial', 'Deliberation', 'Verdict', 'Share'];

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
  const t = snap?.trial;
  useDocumentTitle(t && 'caseNumber' in t && t.caseNumber ? `${formatCaseNumber(t.caseNumber)} · Solo Court` : 'Solo case');

  // The trial plays before the verdict exists (the jury beat ends it), so no verdict beat is planned.
  const lines = t && 'transcript' in t ? t.transcript?.lines : undefined;
  const roamBeats = useMemo(() => (lines ? beatsFromLines(lines) : []), [lines]);

  useEffect(() => {
    if (live) saveToDocket(live);
  }, [live]);

  const phaseKey = t ? `${t.stage}:${watched}` : '';
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (t?.stage === 'verdict') headingRef.current?.querySelector<HTMLElement>('h1')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  if (!snap || !t) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="This case is not in this browser"
          headingLevel={1}
          character="clerk"
          expression="shocked"
          actions={
            <>
              <PaperButtonLink to={soloPaths.file} iconStart={<Icon name="plus" />}>
                File a confession
              </PaperButtonLink>
              <PaperButtonLink to={soloPaths.docket} variant="maroon">
                Your docket
              </PaperButtonLink>
            </>
          }
        >
          Demo cases live in the tab that filed them until the verdict is in; reloading mid-trial ends the demo case (nothing real is ever charged). Decided cases are kept in your docket.
        </EmptyState>
      </div>
    );
  }

  if (t.stage === 'filing' || t.stage === 'evidence' || t.stage === 'counsel') return <Navigate to={soloPaths.file} replace />;

  const caseNumber = 'caseNumber' in t && t.caseNumber ? formatCaseNumber(t.caseNumber) : null;
  const inJury = t.stage === 'jury';
  const showTrial = inJury && t.step !== 'recruiting' && !watched && t.step === 'commit' && t.seats.every((s) => !s.committed);
  const current = t.stage === 'jury' ? (t.step === 'recruiting' ? 0 : showTrial ? 1 : 2) : t.stage === 'verdict' ? 3 : t.stage === 'share' ? 4 : 0;

  return (
    <div className={styles.page}>
      <CaseSounds key={trialId} t={t} />
      <header className={styles.top}>
        <div className={styles.topRow}>
          <PaperButtonLink to={soloPaths.docket} variant="maroon" size="sm" iconStart={<Icon name="arrow-left" />}>
            Docket
          </PaperButtonLink>
          <div className={styles.badges}>
            {caseNumber && <Badge tone="accent">{caseNumber}</Badge>}
            <TestnetBadge />
            {isDemoTerms(t.terms) && <Badge tone="info">Demo court</Badge>}
          </div>
        </div>
        <div ref={headingRef} className={styles.title}>
          <PaperRibbon as="h1" size="lg" sparks tabIndex={-1}>
            {t.filing.title}
          </PaperRibbon>
        </div>
        {t.stage !== 'closed' && <PhaseStepper steps={STEPS} current={current} label="Case progress" />}
      </header>

      {inJury && showTrial && (
        <section aria-labelledby="trial-title" className={styles.trial}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Phase 2 · The trial</p>
            <h2 id="trial-title" className={styles.h2}>
              All rise
            </h2>
            <p className={styles.small}>The jury is seated and watching with you. Nothing in this transcript can change now: it was frozen before you paid.</p>
          </div>
          <TrialViewFrame
            roam={{
              beats: roamBeats,
              label: `Courtroom: ${t.filing.title}`,
              role: 'defendant',
              spawn: 'defendant',
              avatar: { model: 'creator', name: 'You' },
              onDone: () => setWatched(true),
            }}
            classic={<Courtroom lines={t.transcript.lines} cast={soloMode.staging(t.terms)} title={t.filing.title} exhibits={t.exhibits} audio={court.audio} onFinished={() => setWatched(true)} />}
            toolbar={
              <PaperButton size="sm" variant="maroon" onClick={() => setWatched(true)} iconEnd={<Icon name="arrow-right" />}>
                Skip to the jury
              </PaperButton>
            }
          />
        </section>
      )}

      {inJury && !showTrial && session && live && live.trial.stage === 'jury' && <JuryStage session={session} snap={{ ...live, trial: live.trial }} clock={court.clock} />}

      {(t.stage === 'verdict' || t.stage === 'share') && <VerdictPanel snap={{ ...snap, trial: t }} session={session} />}

      {t.stage === 'closed' && (
        <EmptyState title="Case dismissed" headingLevel={2} character="judge" expression="shocked" actions={<PaperButtonLink to={soloPaths.file}>File again</PaperButtonLink>}>
          {CANCEL_LABELS[t.reason]}. Your payment is refunded in full.
        </EmptyState>
      )}
    </div>
  );
}

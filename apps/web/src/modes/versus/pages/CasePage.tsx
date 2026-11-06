import { viewerOf } from '@cringe-court/modes-versus';
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { EmptyState, ErrorState, LoadingState, PaperButtonLink } from '@/ds';
import { CaseHeader } from '../components/CaseHeader';
import { CaseRail } from '../components/CaseRail';
import { StagePanel } from '../components/StagePanel';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

/** One case, as the viewer in this tab sees it: header, the current stage, and the rail. */
export function CasePage() {
  const { trialId } = useParams();
  const { snapshot, error, persona, audio, resetDemo } = useVersus();
  const c = snapshot?.cases.find((x) => x.trialId === trialId);
  useDocumentTitle(c ? c.state.filing.title : 'Versus case');

  // The courtroom ambience follows the case phase (silent until sound is on).
  const phase = c?.chain?.phase ?? (c?.state.stage === 'closed' ? 'cancelled' : 'draft');
  const lastPhase = useRef<string | null>(null);
  useEffect(() => {
    if (!c || lastPhase.current === phase) return;
    if (lastPhase.current !== null) audio.handle({ type: 'phase.entered', phase });
    lastPhase.current = phase;
  }, [c, phase, audio]);

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorState title="The demo court could not load" details={error.message} onRetry={resetDemo} retryLabel="Reset demo court">
          The case record in this browser could not be read.
        </ErrorState>
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className={styles.page}>
        <LoadingState title="Opening the case file…" />
      </div>
    );
  }
  if (!c) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="No such case in this court"
          character="clerk"
          expression="shocked"
          headingLevel={1}
          actions={
            <>
              <PaperButtonLink to={versusPaths.cases}>My cases</PaperButtonLink>
              <PaperButtonLink to={versusPaths.newCase} variant="maroon">
                Start a case
              </PaperButtonLink>
            </>
          }
        >
          The demo court lives in this browser. Case links only open in a tab of the browser where the case was filed.
        </EmptyState>
      </div>
    );
  }

  const viewer = viewerOf(c, persona.account);
  return (
    <>
      <CaseHeader c={c} viewer={viewer} />
      <div className={styles.room}>
        <div className={styles.roomMain}>
          <StagePanel c={c} viewer={viewer} />
        </div>
        <CaseRail c={c} viewer={viewer} />
      </div>
    </>
  );
}

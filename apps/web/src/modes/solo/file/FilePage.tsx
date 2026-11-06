import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import type { Usdc } from '@cringe-court/core';
import { EMPTY_DRAFT, type SoloDraft } from '@cringe-court/modes-solo';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Icon, PaperButtonLink, PaperRibbon, PhaseStepper } from '@/ds';
import { clearDraftText, demoCourt, loadDraftText, saveDraftText } from '../lib/demoCourt';
import { soloPaths } from '../lib/paths';
import { useSessionSnapshot } from '../lib/useSession';
import { BriefStep } from './BriefStep';
import { ConfessStep } from './ConfessStep';
import { DismissedStep, DraftingStep, PayStep, ReviewStep } from './CounselSteps';
import styles from './FilePage.module.css';

const STEPS = ['Confess', 'Brief your lawyer', 'Counsel drafts', 'Review the script', 'Pay & open'];

/** /solo/file — from confession to a paid, frozen case (GAME-MODES §2 steps 1–4). */
export function FilePage() {
  useDocumentTitle('File a confession · Solo Court');
  const court = demoCourt();
  const [session, setSession] = useState(() => {
    const s = court.session;
    return s && (s.trial.stage === 'filing' || s.trial.stage === 'evidence' || s.trial.stage === 'counsel' || s.trial.stage === 'closed') ? s : court.startSession();
  });
  const snap = useSessionSnapshot(session)!;
  const [draft, setDraft] = useState<SoloDraft>(() => loadDraftText(EMPTY_DRAFT));
  const [balance, setBalance] = useState<Usdc | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const t = snap.trial;
  const stepKey = `${t.stage}/${t.step}`;

  useEffect(() => saveDraftText(draft), [draft]);

  // Move focus to the page heading on every step change, so keyboard and screen-reader users land at the top of the new step.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.querySelector<HTMLElement>('h1')?.focus();
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, [stepKey]);

  useEffect(() => {
    if (t.stage === 'counsel' && t.step === 'funding') void court.chain.usdcBalance(court.filer).then(setBalance);
  }, [t, court]);

  if (t.stage === 'jury' || t.stage === 'verdict' || t.stage === 'share') {
    clearDraftText();
    return <Navigate to={soloPaths.case(t.id)} replace />;
  }

  const current = t.stage === 'filing' ? 0 : t.stage === 'evidence' ? 1 : t.stage === 'counsel' ? (t.step === 'drafting' ? 2 : t.step === 'review' ? 3 : 4) : 0;

  const restart = () => {
    setSession(court.startSession());
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <PaperButtonLink to={soloPaths.landing} variant="maroon" size="sm" iconStart={<Icon name="arrow-left" />}>
          Solo Court
        </PaperButtonLink>
        <div ref={headingRef} className={styles.pageTitle}>
          <PaperRibbon as="h1" size="lg" sparks tabIndex={-1}>
            File a confession
          </PaperRibbon>
        </div>
        <PhaseStepper steps={STEPS} current={current} label="Filing progress" className={styles.stepper} />
      </div>

      <div className={styles.body}>
        {t.stage === 'filing' && (
          <ConfessStep
            draft={draft}
            onChange={setDraft}
            serverError={snap.error?.code === 'validation' ? snap.error.message : null}
            onSubmit={(d) => {
              session.fileConfession(d);
            }}
          />
        )}
        {t.stage === 'evidence' && (
          <BriefStep session={session} snap={{ ...snap, trial: t }} hiddenNames={draft.hiddenNames} teaserAllowance={court.teasers.allowance(null)} />
        )}
        {t.stage === 'counsel' && t.step === 'drafting' && <DraftingStep session={session} snap={{ ...snap, trial: t }} />}
        {t.stage === 'counsel' && t.step === 'review' && <ReviewStep session={session} snap={{ ...snap, trial: t }} />}
        {t.stage === 'counsel' && t.step === 'funding' && <PayStep session={session} snap={{ ...snap, trial: t }} balance={balance} />}
        {t.stage === 'closed' && (
          <DismissedStep
            trial={t}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  );
}


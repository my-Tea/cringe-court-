import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import type { Usdc } from '@cringe-court/core';
import { EMPTY_DRAFT, type SoloDraft } from '@cringe-court/modes-solo';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
import { Icon, PaperButtonLink, PaperRibbon, PhaseStepper } from '@/ds';
import { appLedger } from '@/platform/ledger';
import { clearDraftText, demoCourt, loadDraftText, openArcCourt, saveDraftText } from '../lib/demoCourt';
import { soloPaths } from '../lib/paths';
import { useSessionSnapshot } from '../lib/useSession';
import { ArcWalletGate } from './ArcWalletGate';
import { BriefStep } from './BriefStep';
import { ConfessStep } from './ConfessStep';
import { DismissedStep, DraftingStep, PayStep, ReviewStep } from './CounselSteps';
import styles from './FilePage.module.css';

const steps = () => [t('solo.file.steps.confess'), t('solo.file.steps.brief'), t('solo.file.steps.drafts'), t('solo.file.steps.review'), t('solo.file.steps.pay')];

/** /solo/file — on Arc, the wallet comes first: a case is paid from the player's own wallet. */
export function FilePage() {
  useDocumentTitle(t('solo.file.doc'));
  const [ready, setReady] = useState(() => appLedger().kind !== 'arc-testnet');
  if (!ready) {
    return (
      <ArcWalletGate
        onReady={(account) => {
          openArcCourt(account);
          setReady(true);
        }}
      />
    );
  }
  return <FileFlow />;
}

/** From confession to a paid, frozen case (GAME-MODES §2 steps 1–4). */
function FileFlow() {
  const court = demoCourt();
  const [session, setSession] = useState(() => {
    const s = court.session;
    return s && (s.trial.stage === 'filing' || s.trial.stage === 'evidence' || s.trial.stage === 'counsel' || s.trial.stage === 'closed') ? s : court.startSession();
  });
  const snap = useSessionSnapshot(session)!;
  const [draft, setDraft] = useState<SoloDraft>(() => loadDraftText(EMPTY_DRAFT));
  const [balance, setBalance] = useState<Usdc | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const tState = snap.trial;
  const stepKey = `${tState.stage}/${tState.step}`;

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
    if (tState.stage === 'counsel' && tState.step === 'funding') void court.chain.usdcBalance(court.filer).then(setBalance);
  }, [tState, court]);

  if (tState.stage === 'jury' || tState.stage === 'verdict' || tState.stage === 'share') {
    clearDraftText();
    return <Navigate to={soloPaths.case(tState.id)} replace />;
  }

  const current = tState.stage === 'filing' ? 0 : tState.stage === 'evidence' ? 1 : tState.stage === 'counsel' ? (tState.step === 'drafting' ? 2 : tState.step === 'review' ? 3 : 4) : 0;

  const restart = () => {
    setSession(court.startSession());
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <PaperButtonLink to={soloPaths.landing} variant="maroon" size="sm" iconStart={<Icon name="arrow-left" />}>
          {t('solo.nav.solo')}
        </PaperButtonLink>
        <div ref={headingRef} className={styles.pageTitle}>
          <PaperRibbon as="h1" size="lg" sparks tabIndex={-1}>
            {t('solo.file.heading')}
          </PaperRibbon>
        </div>
        <PhaseStepper steps={steps()} current={current} label={t('solo.file.progress')} className={styles.stepper} />
      </div>

      <div className={styles.body}>
        {tState.stage === 'filing' && (
          <ConfessStep
            draft={draft}
            onChange={setDraft}
            serverError={snap.error?.code === 'validation' ? snap.error.message : null}
            onSubmit={(d) => {
              session.fileConfession(d);
            }}
          />
        )}
        {tState.stage === 'evidence' && (
          <BriefStep session={session} snap={{ ...snap, trial: tState }} hiddenNames={draft.hiddenNames} teaserAllowance={court.teasers.allowance(null)} />
        )}
        {tState.stage === 'counsel' && tState.step === 'drafting' && <DraftingStep session={session} snap={{ ...snap, trial: tState }} />}
        {tState.stage === 'counsel' && tState.step === 'review' && <ReviewStep session={session} snap={{ ...snap, trial: tState }} />}
        {tState.stage === 'counsel' && tState.step === 'funding' && <PayStep session={session} snap={{ ...snap, trial: tState }} balance={balance} />}
        {tState.stage === 'closed' && (
          <DismissedStep
            trial={tState}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  );
}


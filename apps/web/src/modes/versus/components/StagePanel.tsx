import type { VersusCase, Viewer } from '@cringe-court/modes-versus';
import { t } from '@/i18n';
import { EmptyState, PaperButtonLink } from '@/ds';
import { versusPaths } from '../mode';
import { BriefPanel } from './BriefPanel';
import { DraftingPanel, DraftReviewPanel, FundingPanel } from './CounselPanels';
import { DismissedPanel } from './DismissedPanel';
import { InvitePanel } from './InvitePanel';
import { RecruitingPanel, TrialPanel } from './JuryPanels';
import { VerdictPanel } from './VerdictPanel';

/** The main panel for the case's current stage, as this viewer should see it. */
export function StagePanel({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  const s = c.state;
  const party = viewer === 'a' || viewer === 'b';
  switch (s.stage) {
    case 'filing':
      if (viewer === 'a') return <InvitePanel c={c} />;
      if (viewer === 'invitee')
        return (
          <EmptyState title={t('versus.stage.invited.title')} character="side-a" expression="smug" actions={<PaperButtonLink to={versusPaths.joinCode(c.code)}>{t('versus.stage.invited.action')}</PaperButtonLink>}>
            {t('versus.stage.invited.body')}
          </EmptyState>
        );
      return <PrivateCase />;
    case 'evidence':
      return party ? <BriefPanel c={c} side={viewer} /> : <PrivateCase />;
    case 'counsel':
      if (!party) return <PrivateCase />;
      if (s.step === 'drafting') return <DraftingPanel c={c} />;
      if (s.step === 'review') return <DraftReviewPanel c={c} side={viewer} />;
      return <FundingPanel c={c} side={viewer} />;
    case 'jury':
      if (s.step === 'recruiting') return <RecruitingPanel c={c} viewer={viewer} />;
      return <TrialPanel c={c} viewer={viewer} />;
    case 'verdict':
    case 'appeal':
    case 'share':
      return <VerdictPanel c={c} viewer={viewer} />;
    case 'closed':
      return <DismissedPanel c={c} viewer={viewer} />;
    default:
      return null;
  }
}

function PrivateCase() {
  return (
    <EmptyState title={t('versus.stage.private.title')} character="bailiff" expression="neutral">
      {t('versus.stage.private.body')}
    </EmptyState>
  );
}

import type { VersusCase, Viewer } from '@cringe-court/modes-versus';
import { ButtonLink, EmptyState } from '@/ds';
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
          <EmptyState title="You have been invited to this case" character="side-a" expression="smug" actions={<ButtonLink to={versusPaths.joinCode(c.code)}>Read the invite</ButtonLink>}>
            Read what you are agreeing to, then accept or decline.
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
    <EmptyState title="This case is still private" character="bailiff" expression="neutral">
      Versus cases stay between the two sides until both have paid. The jury and the public see it once the court calls a jury.
    </EmptyState>
  );
}

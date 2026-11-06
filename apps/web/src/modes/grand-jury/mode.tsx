import { DEMO_DEADLINES, grandJuryMode } from '@cringe-court/modes-grand-jury';
import { Navigate } from 'react-router';
import { t } from '@/i18n';
import type { WebModeModule } from '../registry';
import { GrandJuryLayout } from './GrandJuryLayout';
import { appLedger } from '@/platform/ledger';
import { paths } from './lib';

/**
 * Mode 3, Grand Jury. The pages are split into their own chunk: the docket,
 * the demo ledger and the share renderer load only when someone opens the court.
 */
const grandJury: WebModeModule = {
  definition: grandJuryMode,
  demoDeadlines: DEMO_DEADLINES,
  // Labels are getters so they translate at read time (render), not once at module load.
  landing: {
    get label() {
      return t('grandJury.mode.landing');
    },
    to: paths.docket,
  },
  docket: {
    get label() {
      return t('grandJury.mode.docket');
    },
    to: paths.duty,
  },
  routes: [
    {
      element: <GrandJuryLayout />,
      children: [
        { path: 'docket', lazy: async () => ({ Component: appLedger().kind === 'arc-testnet' ? (await import('./pages/ArcDocketPage')).ArcDocketPage : (await import('./pages/DocketPage')).DocketPage }) },
        { path: 'case/:caseNumber', lazy: async () => ({ Component: (await import('./pages/CasePage')).CasePage }) },
        { path: 'duty', lazy: async () => ({ Component: (await import('./pages/DutyPage')).DutyPage }) },
        { path: 'pricing', lazy: async () => ({ Component: (await import('./pages/PricingPage')).PricingPage }) },
        { path: 'case', element: <Navigate to={paths.docket} replace /> },
      ],
    },
  ],
};

export default grandJury;

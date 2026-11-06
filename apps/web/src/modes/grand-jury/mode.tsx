import { grandJuryMode } from '@cringe-court/modes-grand-jury';
import { Navigate } from 'react-router';
import type { WebModeModule } from '../registry';
import { GrandJuryLayout } from './GrandJuryLayout';
import { paths } from './lib';

/**
 * Mode 3, Grand Jury. The pages are split into their own chunk: the docket,
 * the demo ledger and the share renderer load only when someone opens the court.
 */
const grandJury: WebModeModule = {
  definition: grandJuryMode,
  cta: { label: 'Open the docket', to: paths.docket },
  routes: [
    {
      element: <GrandJuryLayout />,
      children: [
        { path: 'docket', lazy: async () => ({ Component: (await import('./pages/DocketPage')).DocketPage }) },
        { path: 'case/:caseNumber', lazy: async () => ({ Component: (await import('./pages/CasePage')).CasePage }) },
        { path: 'duty', lazy: async () => ({ Component: (await import('./pages/DutyPage')).DutyPage }) },
        { path: 'pricing', lazy: async () => ({ Component: (await import('./pages/PricingPage')).PricingPage }) },
        { path: 'case', element: <Navigate to={paths.docket} replace /> },
      ],
    },
  ],
};

export default grandJury;

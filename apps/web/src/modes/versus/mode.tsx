import { VERSUS_DEMO_DEADLINES, versusMode } from '@cringe-court/modes-versus';
import { t } from '@/i18n';
import type { WebModeModule } from '../registry';

export const versusPaths = {
  landing: '/versus',
  newCase: '/versus/new',
  join: '/versus/join',
  joinCode: (code: string) => `/versus/join/${code}`,
  case: (trialId: string) => `/versus/case/${trialId}`,
  cases: '/versus/cases',
} as const;

const mode: WebModeModule = {
  definition: versusMode,
  demoDeadlines: VERSUS_DEMO_DEADLINES,
  // Labels are getters so they translate at read time (render), not once at module load.
  landing: {
    to: versusPaths.newCase,
    get label() {
      return t('versus.mode.landing.start');
    },
    secondary: {
      to: versusPaths.join,
      get label() {
        return t('versus.mode.landing.join');
      },
    },
  },
  docket: {
    get label() {
      return t('versus.mode.docket');
    },
    to: versusPaths.cases,
  },
  routes: [
    {
      lazy: async () => ({ Component: (await import('./VersusLayout')).VersusLayout }),
      children: [
        { path: 'new', lazy: async () => ({ Component: (await import('./pages/NewCasePage')).NewCasePage }) },
        { path: 'join', lazy: async () => ({ Component: (await import('./pages/JoinPage')).JoinPage }) },
        { path: 'join/:code', lazy: async () => ({ Component: (await import('./pages/JoinPage')).JoinPage }) },
        { path: 'case/:trialId', lazy: async () => ({ Component: (await import('./pages/CasePage')).CasePage }) },
        { path: 'cases', lazy: async () => ({ Component: (await import('./pages/CasesPage')).CasesPage }) },
      ],
    },
  ],
};

export default mode;

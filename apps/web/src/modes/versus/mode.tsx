import { versusMode } from '@cringe-court/modes-versus';
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
  start: { to: versusPaths.newCase, label: 'Start a Versus case', secondary: { to: versusPaths.join, label: 'I have an invite code' } },
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

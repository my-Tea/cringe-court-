import { DEMO_DEADLINES, soloMode } from '@cringe-court/modes-solo';
import { t } from '@/i18n';
import type { WebModeModule } from '../registry';

/** Mode 1 — Solo vs NPC. Routes mount under /solo (the landing page stays at /solo). */
const mode: WebModeModule = {
  definition: soloMode,
  demoDeadlines: DEMO_DEADLINES,
  // Getters keep the label in the active locale at the moment the lobby reads it.
  landing: {
    get label() {
      return t('solo.mode.landing');
    },
    to: '/solo/file',
  },
  docket: {
    get label() {
      return t('solo.mode.docket');
    },
    to: '/solo/docket',
  },
  routes: [
    { path: 'file', lazy: async () => ({ Component: (await import('./file/FilePage')).FilePage }) },
    { path: 'case/:trialId', lazy: async () => ({ Component: (await import('./case/CasePage')).CasePage }) },
    { path: 'docket', lazy: async () => ({ Component: (await import('./case/DocketPage')).DocketPage }) },
  ],
};

export default mode;

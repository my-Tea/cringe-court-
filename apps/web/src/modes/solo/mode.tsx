import { soloMode } from '@cringe-court/modes-solo';
import type { WebModeModule } from '../registry';

/** Mode 1 — Solo vs NPC. Routes mount under /solo (the landing page stays at /solo). */
const mode: WebModeModule = {
  definition: soloMode,
  landing: { label: 'File a confession', to: '/solo/file' },
  docket: { label: 'Solo docket', to: '/solo/docket' },
  routes: [
    { path: 'file', lazy: async () => ({ Component: (await import('./file/FilePage')).FilePage }) },
    { path: 'case/:trialId', lazy: async () => ({ Component: (await import('./case/CasePage')).CasePage }) },
    { path: 'docket', lazy: async () => ({ Component: (await import('./case/DocketPage')).DocketPage }) },
  ],
};

export default mode;

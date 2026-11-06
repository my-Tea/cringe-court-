import { defineProject, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineProject({
    test: {
      name: 'web',
      // Tests run on the in-browser chain, whatever this machine's .env.local says.
      env: { VITE_LEDGER: 'demo' },
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 20000,
      css: { modules: { classNameStrategy: 'non-scoped' } },
    },
  }),
);

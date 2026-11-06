import { defineProject, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineProject({
    test: {
      name: 'web',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 20000,
      css: { modules: { classNameStrategy: 'non-scoped' } },
    },
  }),
);

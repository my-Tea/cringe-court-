import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/core/vitest.config.ts', 'packages/ai/vitest.config.ts', 'packages/scene/vitest.config.ts', 'packages/engine/vitest.config.ts', 'packages/modes-grand-jury/vitest.config.ts', 'apps/web/vitest.config.ts'],
  },
});

import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Art is imported straight from the generated asset tree, so the app never
      // carries a stale copy. Vite fingerprints whatever is actually used.
      '@art': fileURLToPath(new URL('../../cc-art/dist', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Pixel art is small; keep it as files so the browser can cache it.
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't bust the React/Radix cache.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: 'radix', test: /node_modules[\\/](@radix-ui|@floating-ui)[\\/]/ },
            // three.js + R3F only load with the courtroom; one long-lived chunk.
            { name: 'three', test: /node_modules[\\/](three|@react-three|its-fine|zustand|suspend-react|react-use-measure)[\\/]/ },
          ],
        },
      },
    },
  },
});

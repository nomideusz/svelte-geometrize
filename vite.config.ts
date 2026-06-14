import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { geometrize } from './src/lib/vite/index.js';

export default defineConfig({
  plugins: [geometrize(), sveltekit()],
  // geometrizejs (CommonJS) is only reached through the demo's Web Worker, so Vite's
  // dev dependency scanner never sees it and the worker's import fails at runtime.
  // Pre-bundling it here makes the live, in-browser fitter work in `vite dev` too.
  optimizeDeps: {
    include: ['geometrizejs'],
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});

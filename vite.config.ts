import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { geometrize } from './src/lib/vite/index.js';

export default defineConfig({
  plugins: [geometrize(), sveltekit({
		adapter: adapter(),
		// transpile TS out of shipped .svelte files so consumers without a TS
		// preprocessor (svelte-loader, bundlephobia, plain rollup) can compile them
		preprocess: vitePreprocess({ script: true, style: false })
	})],
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

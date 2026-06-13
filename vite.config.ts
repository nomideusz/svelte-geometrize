import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { geometrize } from './src/lib/vite/index.js';

export default defineConfig({
  plugins: [geometrize(), sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});

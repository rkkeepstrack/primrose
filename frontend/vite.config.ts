import {configDefaults, defineConfig} from 'vitest/config'
import {svelte} from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // vitest would otherwise pick svelte's server build, where mount() throws
  resolve: process.env.VITEST ? {conditions: ['browser']} : undefined,
  // e2e/ holds the Playwright screenshot specs, not vitest tests
  test: {exclude: [...configDefaults.exclude, 'e2e/**']},
})

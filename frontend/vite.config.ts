import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // vitest would otherwise pick svelte's server build, where mount() throws
  resolve: process.env.VITEST ? {conditions: ['browser']} : undefined,
})

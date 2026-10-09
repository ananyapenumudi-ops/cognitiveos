/// <reference types="vitest/config" />
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

const cwd = process.cwd()

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // Two pages: the 3D landing page and the simulator (three.js stays out of the simulator bundle)
  build: { rollupOptions: { input: { main: resolve(cwd, 'index.html'), app: resolve(cwd, 'app.html') } } },
  // Allow the project's real path too: on redirected or symlinked folders the
  // worker URL resolves via the real path, which Vite would otherwise refuse.
  server: { fs: { allow: [searchForWorkspaceRoot(cwd), realpathSync.native(cwd)] } },
  // property tests run hundreds of random days; give them room on a busy machine
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000 },
})

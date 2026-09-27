/// <reference types="vitest/config" />
// apps/vite.config.ts — only the `test` block is prescribed by elf-cicd-frontend;
// keep the project's own plugins / alias / define / server settings as they are.
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: false },
  test: {
    environment: 'jsdom',
    // Tests sit next to the file they cover: Foo.vue -> Foo.test.ts, foo.ts -> foo.test.ts
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      // json-summary → read by the CI "Branch coverage (advisory)" step
      // cobertura    → consumable by other tools / PR summaries
      reporter: ['text-summary', 'json-summary', 'html', 'cobertura'],
      reportsDirectory: './coverage',
      // Without `include`, only files some test imports are measured, so an
      // untested file does not lower the number at all.
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/main.ts', 'src/api/mock/**'],
      thresholds: {
        // Enforced: vitest exits non-zero below this, CI goes red.
        lines: 55,
        // branches: 50 is ADVISORY — do NOT add it here, or it becomes a hard gate.
      },
    },
  },
})

---
type: llm
focus: trace
weight: 1
---

`apps/package.json` 或 `pnpm-workspace.yaml` 的 catalog 中寫的是 `vite ^8.3.5`、`@vitejs/plugin-vue ^6.0.10`、`pinia ^4.1.0`、`vue-router ^5.4.0`、`vue ^3.5.44`，以及 `vitest ^5.0.5` 或依 elf-cicd-frontend 規則 16 寫的精確 `5.0.5`（此時 `@vitest/coverage-v8` 也是精確 `5.0.5`），兩種都算通過（六項都要符合）

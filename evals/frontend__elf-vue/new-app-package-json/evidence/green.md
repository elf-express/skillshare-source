# new-app-package-json：GREEN 紀錄

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive c86619e609094e26817647d6c00eb8376d6709ae`（Task 7 的 commit）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：6/6 個 grader 通過 → **全部通過**

提示：工作目錄一行＋Plan 全域限制的那一行（案例 1、5 含 elf-stack；案例 2、3、4、B1、B2 不含），其餘逐字照 `prompt.md`，和 RED 同一個模型。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-nvmrc` | 通過 | `.nvmrc` 只有一行 `24.22.2` |
| `02-engines-package-manager` | 通過 | `engines.node` `>=24.22.2`、`packageManager` `pnpm@12.16.1` |
| `03-runtime-deps` | 通過 | `apps/package.json`：`vite ^8.3.5`、`@vitejs/plugin-vue ^6.0.10`、`pinia ^4.1.0`、`vue-router ^5.4.0`、`vue ^3.5.44` |
| `04-vitest-exact` | 通過 | `vitest`、`@vitest/coverage-v8` 都是精確 `5.0.5` |
| `05-typescript-toolchain` | 通過 | `typescript ^6.0.3`、`vue-tsc ^3.3.13`、`typescript-eslint ^8.72.0` |
| `06-no-old-values` | 通過 | 逐項 grep 只有 `jsdom ^25.0.1` 含 `5.0.1` 字串，那是 jsdom 的 25.0.1（範本原值，不是 vitest 舊值 `5.0.1`），其餘零筆 |

## 子代理最後回覆（逐字）

`````markdown
四個檔案都建好了，範本裡與 elf-stack 不一致的版本一律改用 elf-stack v2 值（新 repo，適用 §0）。只驗證了兩個 `package.json` 能解析為 JSON；沒跑 `pnpm install`，所以 lint、typecheck、測試、build 都沒驗（規則 12）。

檔案都在 `E:/source/e46-scratch/frontend__elf-vue-workspace/iteration-1/new-app-package-json/with_skill/work/` 下：`package.json`、`apps/package.json`、`.nvmrc`（`24.22.2`）、`pnpm-workspace.yaml`（`packages: [apps]`、`engineStrict: true`）。根 `package.json` 另釘了 `packageManager: pnpm@12.16.1` 和 `engines.node: >=24.22.2`。

**elf-vue 範本與 elf-stack 的衝突（規則 1 要求回報）**

| 套件 | `references/config.md` | 實際寫入（elf-stack） |
|---|---|---|
| prettier | `^3.3.3` | `^3.9.10` |
| eslint | `^9.17.0` | `^10.13.0` |
| @eslint/js | `^9.17.0` | `^10.0.1` |
| eslint-config-prettier | `^9.1.0` | `^10.1.8` |
| eslint-plugin-vue | `^9.32.0` | `^10.12.0` |
| globals | 範本沒有 | `^17.13.0` |

加 `globals` 是因為 eslint-plugin-vue 10 不再提供 browser globals，手動組裝時要自己裝（elf-stack 3.2 註）。`eslint.config.js` 建立時也要記得供應，範本目前沒寫這段。

**需要決定或確認的事**
1. **lint 組合：** elf-stack 3.6 和檢查清單要新 repo 用完整 antfu，且新 repo 不能登記例外；但 elf-vue 規則 34–35、範本和 CI 的 `format:check` 都還是手動組合加 Prettier。你要求照範本，我用了手動組合，表面上不符 elf-stack 檢查清單。
   - 維持手動：與範本和 CI 一致，但之後要再遷移一次。
   - 改 antfu：符合 elf-stack，但要連帶改 scripts、eslint 設定和 CI，目前 elf-vue 沒有對應範本。
2. **專案名稱：** 你沒給代號，我先用 `vue-app` 和 `@vue-app/web` 這個暫定名，兩處要一起改。
3. **vitest 寫法：** elf-stack 表寫 `^5.0.5`，elf-vue 範本和 elf-cicd-frontend 規則 16 要求與 coverage-v8 同為精確版號。我兩者都寫 `5.0.5`，版號相同，只有寫法不同。
4. **表外套件：** `@ant-design/icons-vue`、`axios`、`@vue/test-utils`、`jsdom`、`@vitest/coverage-v8` 不在 elf-stack 表上。版本照抄範本，沒有自行決定，PR 要註明「待加入 elf-stack」。

**還沒做的**
- **Lockfile：** `pnpm-lock.yaml` 還沒產生，規則 6 要求提交。產生時要確認 TypeScript 實際解析值低於 6.1.0（elf-stack 3.6）。pnpm 12 的建置腳本核准（`allowBuilds`）也還沒實測。
- **未建的設定檔：** 你只要求這四個檔案，所以沒建 `.prettierrc.json`、`eslint.config.js`、`vite.config.ts` 和 `tsconfig.json`，`pnpm verify` 要等這些檔案和 `apps/src` 都到位才能跑。
- **未加的相依：** `@playwright/test` 和 `@types/node` 不在 elf-vue 範本裡，所以沒加。
`````

## 產出檔案（逐字）

`.nvmrc`

`````
24.22.2
`````

`apps/package.json`

`````
{
  "name": "@vue-app/web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@ant-design/icons-vue": "^7.0.1",
    "ant-design-vue": "^4.2.6",
    "axios": "^1.7.9",
    "pinia": "^4.1.0",
    "vue": "^3.5.44",
    "vue-i18n": "^11.4.16",
    "vue-router": "^5.4.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@vitejs/plugin-vue": "^6.0.10",
    "@vitest/coverage-v8": "5.0.5",
    "@vue/test-utils": "^2.4.6",
    "eslint": "^10.13.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-vue": "^10.12.0",
    "globals": "^17.13.0",
    "jsdom": "^25.0.1",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.72.0",
    "vite": "^8.3.5",
    "vitest": "5.0.5",
    "vue-tsc": "^3.3.13"
  }
}
`````

`package.json`

`````
{
  "name": "vue-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@12.16.1",
  "scripts": {
    "dev": "pnpm --filter ./apps dev",
    "build": "pnpm --filter ./apps build",
    "preview": "pnpm --filter ./apps preview",
    "lint": "pnpm -r --if-present run lint",
    "lint:fix": "pnpm -r --if-present run lint:fix",
    "typecheck": "pnpm -r --if-present run typecheck",
    "test": "pnpm -r --if-present run test",
    "test:coverage": "pnpm -r --if-present run test:coverage",
    "format": "prettier --write \"**/*.{ts,vue,json,md,css}\"",
    "format:check": "prettier --check \"**/*.{ts,vue,json,md,css}\"",
    "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build"
  },
  "devDependencies": {
    "prettier": "^3.9.10"
  },
  "engines": {
    "node": ">=24.22.2"
  }
}
`````

`pnpm-workspace.yaml`

`````
packages:
  - apps

# Refuse to install on an unsupported Node instead of warning and failing later.
engineStrict: true
`````

# new-app-package-json：RED 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 開分支時的 `origin/dev`：`b757add4747263593abc5a654930512cdedeb430`
- 結果：5/6 個 grader 通過 → **失敗**

提示：工作目錄一行＋Plan 全域限制的「先讀」一行，其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-nvmrc` | 通過 | `.nvmrc` 只有一行 `24.22.2` |
| `02-engines-package-manager` | 通過 | `engines.node` `>=24.22.2`、`packageManager` `pnpm@12.16.1` |
| `03-runtime-deps` | 通過 | `apps/package.json` 五項都是新表值 |
| `04-vitest-exact` | 通過 | `vitest`、`@vitest/coverage-v8` 都是精確 `5.0.5` |
| `05-typescript-toolchain` | 失敗 | `typescript ^6.0.3`、`vue-tsc ^3.3.13` 正確，但沒有 `typescript-eslint`：代理依 elf-stack §3.6 改用 `@antfu/eslint-config ^10.0.0`（§3.6 寫 typescript-eslint「手動組裝設定才直接裝」） |
| `06-no-old-values` | 通過 | 產出沒有列出的任何舊值 |

## 子代理最後回覆（逐字）

`````markdown
四個檔案已建好（根 `package.json`、`apps/package.json`、`.nvmrc`、`pnpm-workspace.yaml`），版本用 `elf-stack` 的 v2 值，不是 `elf-vue` 範本上的值。只驗過 JSON 語法與檔案內容；沒跑 install、lint、typecheck、測試、build，也還沒有 lockfile。

**範本與 elf-stack 不符（照 elf-stack 規則 1 以它為準，在此回報）**

`elf-vue` 的 `references/config.md`、規則 44 與 `elf-cicd-frontend` 的 `package.root.json` 都落後 `elf-stack`：

| 項目 | elf-vue 範本 | 實際寫入 |
|---|---|---|
| Node（`.nvmrc`／`engines`） | `24.18`／`>=24.18` | `24.22.2`／`>=24.22.2` |
| pnpm | `<PNPM_VERSION>`（例 11.x） | `pnpm@12.16.1` |
| vue | `^3.5.13` | `^3.5.44` |
| pinia | `^2.2.6` | `^4.1.0` |
| vue-router | `^4.4.5` | `^5.4.0` |
| vite | `^6.4.3` | `^8.3.5` |
| @vitejs/plugin-vue | `^6.0.9` | `^6.0.10` |
| vitest、@vitest/coverage-v8 | `5.0.1` | `5.0.5` |
| typescript | `^5.6.3` | `^6.0.3` |
| vue-tsc | `^2.1.10` | `^3.3.13` |
| eslint | `^9.17.0` | `^10.13.0` |
| lint／format | `@eslint/js`＋`typescript-eslint`＋`eslint-plugin-vue`＋`eslint-config-prettier`＋prettier CLI | `@antfu/eslint-config ^10.0.0`＋`eslint-plugin-format ^2.0.1`，不裝 prettier |

另外加了 `@types/node ^24.19.2`（3.6 表，`vite.config.ts` 用到 `node:` 模組）。

**偏離或待補**

- `vitest` 寫精確 `5.0.5`，不是表上的 `^5.0.5`：`elf-cicd-frontend` 規則 16 要求它與 `@vitest/coverage-v8` 精確同版。
- `@ant-design/icons-vue`、`axios`、`@vue/test-utils`、`jsdom` 不在 `elf-stack` 表上，沿用範本值，待加入 elf-stack；這些舊值與新版工具的搭配沒驗證過。`@vitest/coverage-v8` 也不在表上，版本跟著 vitest。
- 專案名你沒給，暫用 `vue-app`／`@vue-app/web`，請換掉。
- 根目錄的 `format`、`format:check` 改成轉呼叫 lint，`verify` 順序不變。eslint 在 `apps/`，所以根目錄的檔案不在格式檢查範圍內；範本的 prettier 原本涵蓋。
- 沒加 `@playwright/test` 和 `test:e2e` 腳本，你這次沒要求 E2E。

**現在還跑不起來**

- 本機 Node 是 24.18.0，低於 `engines` 的 24.22.2，`engineStrict` 會擋下 `pnpm install`。要先裝 24.22.2。
- 產生 lockfile 後要確認 TypeScript 解析值 `<6.1.0`（elf-stack 3.6）；`^6.0.3` 本身允許超過這個上限。lockfile 要提交。
- 還沒有 `eslint.config.js`，`pnpm lint` 目前跑不了。`elf-vue` config.md §8 的範本是舊組合，不適用，要照 antfu 寫。

**需要你決定：lint／format 用哪一組**

1. 完整 antfu（目前的寫法）：符合 `elf-stack` 3.6 與「新 repo 不登記例外」；代價是 `elf-vue` 規則 34、35 與 config.md §8、§9 的範本不能照用，`elf-cicd-frontend` 的範本也要跟著改。
2. 手動 ESLint＋Prettier：範本可直接套（版本用 3.6 的過渡值）；代價是新 repo 一開始就停在過渡組合，違反 `elf-stack` §0，之後還要再遷一次。
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
    "@antfu/eslint-config": "^10.0.0",
    "@types/node": "^24.19.2",
    "@vitejs/plugin-vue": "^6.0.10",
    "@vitest/coverage-v8": "5.0.5",
    "@vue/test-utils": "^2.4.6",
    "eslint": "^10.13.0",
    "eslint-plugin-format": "^2.0.1",
    "jsdom": "^25.0.1",
    "typescript": "^6.0.3",
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
    "format": "pnpm -r --if-present run lint:fix",
    "format:check": "pnpm -r --if-present run lint",
    "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build"
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

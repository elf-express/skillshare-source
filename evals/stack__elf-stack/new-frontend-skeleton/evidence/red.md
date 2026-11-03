# new-frontend-skeleton：RED 紀錄

- 日期：2026-11-03
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive 5e13bd2a797e113dd937d07eada936a6cf092b7e` 取出的樹
- 開分支時的 `origin/dev`：`5e13bd2a797e113dd937d07eada936a6cf092b7e`
- 結果：3/6 個 grader 通過 → **失敗**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-nvmrc-24-22-2` | 失敗 | `.nvmrc` 寫 `24.18`（v1 值） |
| `02-engines-and-package-manager` | 失敗 | `engines.node` 為 `>=24.18`，`packageManager` 為 `pnpm@11.28.3`（舊表 pnpm「待確認」，取本機版號） |
| `03-engine-strict` | 通過 | `pnpm-workspace.yaml` 有 `engineStrict: true` |
| `04-runtime-ranges` | 失敗 | `apps/package.json` 寫 `vite ^6.4.3`、`@vitejs/plugin-vue ^6.0.9`、`pinia ^2.2.6`、`vue-router ^4.4.5`、`vue ^3.5.13`、`vitest 5.0.1`，六項都是 v1 值 |
| `05-typescript-6-not-exception` | 通過 | `typescript ^6.0.3`；回覆沒有說它要登記例外（提到的「過渡例外」是指改用手動 ESLint+Prettier 的選項，不是 TS） |
| `06-no-downstream-template-versions` | 通過 | 表內項目都取 elf-stack 值，並指出 elf-vue `config.md` 的舊版號不採用；表外套件（axios 等）照 elf-vue 填並列為待加入，不是舊表項目 |

## 子代理最後回覆（逐字）

````markdown
我在空資料夾建好了骨架：根 `package.json`、`.nvmrc`、`pnpm-workspace.yaml`、`apps/package.json`，另外產生了 `pnpm-lock.yaml`。lockfile 是用 `pnpm install --lockfile-only` 產生的，沒有出現 peer 錯誤；套件沒有實際裝進 `node_modules`，也還沒跑過任何 script。

檔案在 `E:/source/e45-scratch/stack__elf-stack-workspace/iteration-0/new-frontend-skeleton/old_skill/work/`：

- **`.nvmrc`**：`24.18`
- **`pnpm-workspace.yaml`**：`packages: [apps]` 加上 `engineStrict: true`。沒有建 `.npmrc`，因為它只放 registry / auth，這裡用不到。
- **根 `package.json`**：
  - `private`、`type: module`
  - `"packageManager": "pnpm@11.28.3"`，用完整版號
  - `"engines": { "node": ">=24.18" }`
  - 一組轉呼叫 `apps` 的 script，包含 `verify`（`format:check` → `lint` → `typecheck` → `test:coverage` → `build`）
- **`apps/package.json`**，版本都照 `elf-stack` 的表：
  - **dependencies**：`vue ^3.5.13`、`pinia ^2.2.6`、`vue-router ^4.4.5`、`vue-i18n ^11.4.16`、`ant-design-vue ^4.2.6`、`@ant-design/icons-vue ^7.0.1`、`axios ^1.7.9`
  - **devDependencies**：
    - 建置與型別：`vite ^6.4.3`、`@vitejs/plugin-vue ^6.0.9`、`typescript ^6.0.3`、`vue-tsc ^3.3.13`
    - 測試：`vitest 5.0.1` 與 `@vitest/coverage-v8 5.0.1`（兩者鎖成同一個精確版號）、`@vue/test-utils ^2.4.6`、`jsdom ^25.0.1`
    - lint：`eslint ^10.13.0`、`@antfu/eslint-config ^10.0.0`、`eslint-plugin-format ^2.0.1`、`@types/node ^24.19.2`

lockfile 解析出 TypeScript `6.0.3`，在 typescript-eslint 支援的 `<6.1.0` 上限以內。其他主要套件解析為 vue 3.5.44、vite 6.4.5、vue-tsc 3.3.14、eslint 10.14.0。

**需要你決定：lint／format 工具鏈**

`elf-stack` 3.6 的目標是完整的 `@antfu/eslint-config`，而且 `elf-stack` 是版本的唯一來源，所以我先照它做。但這跟另外兩個 skill 衝突：

- `elf-vue` 規則 34、35 和 `references/config.md` 規定手動組 `@eslint/js` + `typescript-eslint` + `eslint-plugin-vue` + Prettier。
- `elf-cicd-frontend` 的 `format:check` 是跑 `prettier --check`。

為了相容，我讓根目錄的 `format` 和 `format:check` 改成呼叫 ESLint。這樣 CI 的步驟順序不變，但 `format:check` 和 `lint` 實際上是同一個檢查。可選的做法：

1. **保持 antfu（現況）**：符合 `elf-stack` 的目標；代價是 `elf-vue` 的 `eslint.config.js`、`.prettierrc.json` 範本和 CI 的 Prettier 步驟都要改寫。
2. **改用手動 ESLint + Prettier**：版本用 `elf-stack` 3.6 的過渡值（`@eslint/js ^10.0.1`、`typescript-eslint ^8.72.0`、`prettier ^3.9.10`、`eslint-config-prettier ^10.1.8`），其他 skill 的範本可以直接套；代價是新專案一開始就是過渡例外，要另外寫明理由和怎麼收斂到 antfu。

**待確認**

- **pnpm 版本**：`elf-stack` 標成「待確認：11.x 或 12」。我照暫定值寫 11.x，完整版號用本機的 `11.28.3`。
- **不在 `elf-stack` 表上的套件**：`@ant-design/icons-vue`、`axios`、`@vue/test-utils`、`jsdom`、`@vitest/coverage-v8`。版本是照 `elf-vue` 的範本填的，要先補進 `elf-stack` 的表，或在 PR 註明「待加入 elf-stack」。
- **`elf-vue` 範本落後 `elf-stack`**：`references/config.md` 裡還是舊版號（TS `^5.6.3`、vue-tsc `^2.1.10`、ESLint 9、`eslint-plugin-vue` 9、prettier `^3.3.3`）。我照規則以 `elf-stack` 為準，那份範本應該另外修正。
- **根目錄檔案沒被 lint 涵蓋**：lint 工具鏈放在 `apps`，所以 `package.json`、`pnpm-workspace.yaml` 這些根目錄檔案目前沒有被 ESLint 檢查到。

`name` 欄位我先填了 `elf-app` 和 `@elf-app/web`，請換成實際的專案代號。

下一步：`apps/` 裡的 `eslint.config.js`、`vite.config.ts`、`tsconfig.json`、`src/` 還沒建，所以 `pnpm lint` 和 `pnpm build` 現在跑不起來。
````

## 工作目錄的檔案（逐字；`node_modules`、`pnpm-lock.yaml` 不列）

`.nvmrc`

````
24.18
````

`package.json`

````
{
  "name": "elf-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@11.28.3",
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
    "node": ">=24.18"
  }
}
````

`pnpm-workspace.yaml`

````
packages:
  - apps

# Refuse to install on an unsupported Node instead of warning and failing later.
engineStrict: true
````

`apps/package.json`

````
{
  "name": "@elf-app/web",
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
    "pinia": "^2.2.6",
    "vue": "^3.5.13",
    "vue-i18n": "^11.4.16",
    "vue-router": "^4.4.5"
  },
  "devDependencies": {
    "@antfu/eslint-config": "^10.0.0",
    "@types/node": "^24.19.2",
    "@vitejs/plugin-vue": "^6.0.9",
    "@vitest/coverage-v8": "5.0.1",
    "@vue/test-utils": "^2.4.6",
    "eslint": "^10.13.0",
    "eslint-plugin-format": "^2.0.1",
    "jsdom": "^25.0.1",
    "typescript": "^6.0.3",
    "vite": "^6.4.3",
    "vitest": "5.0.1",
    "vue-tsc": "^3.3.13"
  }
}
````

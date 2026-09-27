---
name: elf-cicd-frontend
description: |
  Elf Express Vue 前端 CI 規範（pnpm + Node 24.18 + Vitest 覆蓋率門檻 + Playwright E2E）。
  當任務涉及新增或修改 .github/workflows/ci.yml 的 web / e2e job、pnpm 安裝與快取、
  .nvmrc / engines / packageManager 釘版、format / lint / typecheck / 單元測試 / 覆蓋率門檻、
  前端 build artifact、Playwright 在 CI 上執行，或把專案從 npm 轉成 pnpm 時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 前端 CI（elf-cicd-frontend）

> 本 skill 只管 `ci.yml` 裡的 `web` 與 `e2e` 兩個 job 及其相依設定檔。
> `server` job 見 **elf-cicd-backend**；PR AI 審查見 **elf-cicd-review**；
> 版號與發版見 **elf-cicd-versioning**；測試怎麼寫見 **elf-unit** / **elf-e2e**。

## 1. 何時使用

- 新專案建立 `.github/workflows/ci.yml`
- 修改前端 CI 步驟、Node / pnpm 版本、覆蓋率門檻
- 把 npm 專案轉成 pnpm（刪 `package-lock.json`、改 scripts、改 CI）
- Playwright E2E 在 CI 失敗、artifact 找不到報告
- 有人問「為什麼 CI 紅了但本機是綠的」

## 2. 固定規則

**版本釘死（為什麼：本機、CI、同事三方版本不一致是「本機明明可以」的頭號原因）**

1. MUST 在 repo 根目錄放 `.nvmrc`，內容**只有一行** `24.18`。
2. MUST 在根 `package.json` 設 `"engines": { "node": ">=24.18" }`，並在 `pnpm-workspace.yaml` 設 `engineStrict: true`。
   為什麼：沒有 strict，版本不符只是一行警告，真正的錯誤會在很後面、不相干的地方才冒出來。
3. MUST 在根 `package.json` 設 `"packageManager": "pnpm@<PNPM_VERSION>"`（pnpm 11.x，確切版本見「待確認」）。MUST NOT 使用 corepack（CI 用 `pnpm/action-setup`、Docker 用 `npm install -g pnpm@${PNPM_VERSION}`）。
4. MUST 在 CI 用 `actions/setup-node` 的 `node-version-file: .nvmrc`。MUST NOT 在 workflow 裡寫死 `node-version: 24`。
   為什麼：版本只能有一個來源，改 `.nvmrc` 就全部跟著改。
5. MUST 使用 `pnpm/action-setup@v4` 且**不傳 `version:`**，讓它讀 `packageManager`。
   為什麼：兩處都寫版本會互相打架，action 會直接報錯。
6. MUST 把 `pnpm/action-setup` 放在 `actions/setup-node` **之前**。
   為什麼：`cache: pnpm` 要呼叫 pnpm 查 store 路徑，pnpm 還沒裝就會失敗。
6a. MUST 所有 `actions/*`（checkout / setup-node / upload-artifact …）統一用 `@v5`。

**安裝**

7. MUST 用 `pnpm install --frozen-lockfile`。MUST NOT 在 CI 用 `pnpm install`（無旗標）或 `npm ci` / `npm install`。
   為什麼：lockfile 與 `package.json` 不一致時要在 CI 失敗，不是讓 CI 偷偷改寫 lockfile。
8. MUST 提交 `pnpm-lock.yaml`。MUST NOT 同時存在 `package-lock.json` / `yarn.lock`。
9. MUST 以 `pnpm-workspace.yaml` 宣告 workspace（`packages: [apps]`）。MUST NOT 使用 `package.json` 的 `"workspaces"` 欄位（那是 npm/yarn 的）。

**Job 內容與順序（web job，固定這個順序，前面失敗就不用跑後面）**

10. MUST 依序：`format:check` → `lint` → `typecheck` → `test:coverage` → `build` → upload `web-dist`。
11. MUST 用根目錄 script 呼叫（`pnpm lint`），不要在 workflow 裡直接寫 `pnpm --filter ... exec eslint`。
    為什麼：本機 `pnpm verify` 與 CI 跑的必須是同一組指令，CI 紅了本機才重現得出來。
12. MUST 維持 `pnpm verify` = CI web job 的前五步（見 `templates/package.root.json`）。

**覆蓋率**

13. MUST 在 `apps/vite.config.ts` 的 `test.coverage.thresholds` 設 `lines: 55`（強制，低於即 CI 失敗）。
14. MUST NOT 把 `branches: 50` 放進 `thresholds`。branch 50% 是**建議值**，只由 CI 的 advisory step 印 `::warning::`。
15. MUST 設 `coverage.include: ['src/**/*.{ts,vue}']`，`exclude` 固定為測試檔、`.d.ts`、`src/main.ts`、`src/api/mock/**`。
    為什麼：沒設 include 時，只有被測試 import 到的檔案才會被計算，完全沒測的檔案不會拉低數字，55% 形同虛設。
16. MUST 在 `apps/` 安裝（`pnpm --filter @<scope>/web add -D`，不是裝在 repo 根目錄）與 `vitest` **完全相同版本**（精確版號，不加 `^`）的 `@vitest/coverage-v8`。
17. MUST NOT 為了過門檻調低數字、擴大 `exclude`、或寫沒有 assert 的測試（見 elf-unit）。

**測試檔位置**

18. MUST 前端單元測試與被測檔放同一資料夾：`OrderCard.vue` → `OrderCard.test.ts`、`useCart.ts` → `useCart.test.ts`。
    MUST NOT 寫成 `.test.vue`，也不要另開 `__tests__/`。為什麼：`test.include` 只收 `src/**/*.test.ts`，放錯地方的測試不會跑、也不計覆蓋率。
19. E2E 測試 MUST 放在 repo 根目錄 `e2e/*.spec.ts`；`playwright.config.ts` MUST 放在 repo 根目錄，`testDir: './e2e'`。

**E2E job**

20. MUST 在 `playwright.config.ts` 的 project 用 `channel: 'chrome'`，CI MUST 用 `pnpm exec playwright install --with-deps chrome` 安裝對應瀏覽器。MUST NOT 裝 `chromium` 卻在 config 寫 `channel: 'chrome'`（或反之）。
20a. 預設 CI e2e MUST 在 mock 模式執行（`VITE_USE_MOCK` 預設開啟），MUST NOT 有 auth setup project。需要真實登入的變體屬 opt-in：必須另起後端 webServer，並提供 `E2E_USER` / `E2E_PASSWORD` secrets（細節見 elf-e2e）。
21. MUST 在 CI 上同時啟用 `github` 與 `html` reporter（allure 可另加，但 MUST NOT 拿掉 `github`），並在失敗時上傳 `playwright-report/` 與 `test-results/`。
22. MUST 保留 `forbidOnly: !!process.env.CI` 與 `webServer.reuseExistingServer: !process.env.CI`（config 細節見 elf-e2e）。

**Workflow 本身**

23. MUST 只有一個 `.github/workflows/ci.yml`，觸發條件固定 `push: branches: [main]` + `pull_request`。
24. MUST NOT 在 `ci.yml` 使用 `paths:` / `paths-ignore:` 過濾。
    為什麼：`main` 的 branch protection 把這些 job 設為 required check；被路徑過濾掉的 workflow 不會回報狀態，PR 會永遠卡在 "Expected — Waiting for status"。
25. MUST NOT 改 job 的 `name:`（`web (lint · types · tests · build)`、`e2e (browser)`）。若真的要改，同一個 PR 必須同步改 branch protection 的 required checks。
26. MUST NOT 在 CI 加 `continue-on-error: true` 讓失敗的步驟變綠。

## 3. 標準範本

直接複製，只替換 `<...>` 佔位符：

| 檔案 | 範本 | 放到 |
|------|------|------|
| CI workflow | [`templates/ci.yml`](templates/ci.yml) | `.github/workflows/ci.yml` |
| Node 版本 | [`templates/.nvmrc`](templates/.nvmrc) | `.nvmrc` |
| pnpm workspace | [`templates/pnpm-workspace.yaml`](templates/pnpm-workspace.yaml) | `pnpm-workspace.yaml` |
| 根 package.json | [`templates/package.root.json`](templates/package.root.json) | `package.json`（合併 scripts / engines / packageManager） |
| 前端 package.json | [`templates/package.apps.json`](templates/package.apps.json) | `apps/package.json`（合併 scripts；只列出與 CI 相關的 devDependencies） |
| Vitest 設定 | [`templates/vite.config.ts`](templates/vite.config.ts) | `apps/vite.config.ts`（只規定 `test` 區塊） |

### 3.1 CI 用到的 script 對照（根 `package.json`）

| CI step | 指令 | 實際執行 |
|---------|------|----------|
| Format check | `pnpm format:check` | `prettier --check "**/*.{ts,vue,json,md,css}"` |
| Lint | `pnpm lint` | `pnpm -r --if-present run lint` → `eslint .` |
| Type-check | `pnpm typecheck` | `pnpm -r --if-present run typecheck` → `vue-tsc --noEmit` |
| Unit + coverage | `pnpm test:coverage` | `pnpm -r --if-present run test:coverage` → `vitest run --coverage` |
| Build | `pnpm build` | `pnpm --filter @<scope>/web build` |
| E2E | `pnpm test:e2e` | `playwright test` |

`pnpm -r` 預設不含根 package，所以根 script 不會遞迴呼叫自己。

### 3.2 Playwright config 在 CI 必須有的片段

完整 config 由 **elf-e2e** 規定；CI 只要求以下幾點成立：

```ts
// playwright.config.ts（repo 根目錄）
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI 上一定要有 html，否則失敗時上傳的 playwright-report/ 是空的
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  // 預設 mock 模式、無 auth setup project；登入變體見 elf-e2e（opt-in）
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

### 3.3 npm → pnpm 轉換步驟（照順序做）

1. 本機安裝 pnpm 11.x（`npm install -g pnpm@<PNPM_VERSION>`，不用 corepack），根 `package.json` 加 `"packageManager": "pnpm@<PNPM_VERSION>"`。
2. 刪除 `package-lock.json`、所有 `node_modules/`。
3. 刪除根 `package.json` 的 `"workspaces"`，新增 `pnpm-workspace.yaml`。
4. `.npmrc` 的 `engine-strict=true` 改成 `pnpm-workspace.yaml` 的 `engineStrict: true`（`.npmrc` 只留 registry / auth 設定）。
5. scripts 內所有 `npm run x --workspace y` 改成 `pnpm --filter y x`；`npm run x --workspaces --if-present` 改成 `pnpm -r --if-present run x`；`npx` 改 `pnpm exec`。
6. `pnpm install` 產生 `pnpm-lock.yaml` 並提交。
7. 更新 `ci.yml`、`playwright.config.ts` 的 `webServer.command`、Dockerfile、README、CLAUDE.md 內所有 `npm` 字樣。
8. 本機跑 `pnpm verify` 全綠再開 PR。

## 4. 檢查清單

宣稱完成前逐項確認：

- [ ] `.nvmrc` 存在且內容為 `24.18`
- [ ] 根 `package.json` 有 `packageManager: "pnpm@..."` 與 `engines.node: ">=24.18"`
- [ ] `pnpm-workspace.yaml` 存在，含 `packages: [apps]` 與 `engineStrict: true`
- [ ] repo 內沒有 `package-lock.json` / `yarn.lock`；`pnpm-lock.yaml` 已提交
- [ ] `ci.yml` 裡沒有 `node-version: 24`、沒有 `npm ci`、沒有 `npx`
- [ ] `pnpm/action-setup` 在 `setup-node` 之前，且沒有 `version:` 輸入
- [ ] 所有 `actions/*` 都是 `@v5`；repo 內沒有 `corepack`
- [ ] `apps/vite.config.ts` 有 `thresholds.lines: 55`、有 `coverage.include`、**沒有** `thresholds.branches`
- [ ] `@vitest/coverage-v8` 裝在 `apps/`，版本與 `vitest` 完全一致
- [ ] 新增的測試檔與被測檔同資料夾、副檔名 `.test.ts`
- [ ] `playwright.config.ts` 在 repo 根目錄、`testDir: './e2e'`、`channel: 'chrome'`，CI 裝 `chrome`
- [ ] 預設 e2e 跑 mock 模式、沒有 auth setup project
- [ ] CI 上 Playwright reporter 含 `github` 與 `html`
- [ ] `ci.yml` 沒有 `paths:` 過濾、沒有 `continue-on-error`
- [ ] job `name:` 未變更（或已同步更新 branch protection）
- [ ] 本機 `pnpm verify` 全綠、`pnpm test:e2e` 全綠
- [ ] 刻意把一個被測函式改壞，確認對應測試會變紅，再改回來（綠燈不等於有測到）

## 5. 常見錯誤

| 症狀 | 原因 | 修正 |
|------|------|------|
| `setup-node` 報 `Unable to locate executable file: pnpm` | `pnpm/action-setup` 放在 `setup-node` 之後 | 對調順序（規則 6） |
| `pnpm/action-setup` 報版本衝突 | 同時給了 `version:` 與 `packageManager` | 刪掉 `version:` 輸入 |
| CI `ERR_PNPM_OUTDATED_LOCKFILE` | 改了 `package.json` 但沒提交更新後的 `pnpm-lock.yaml` | 本機 `pnpm install`，提交 lockfile |
| 本機可以、CI 在很後面才報怪錯 | Node 版本不同，沒有 engine strict，只印了警告 | `.nvmrc` + `engines` + `engineStrict: true` |
| 覆蓋率很高但明明很多檔案沒測 | 沒設 `coverage.include`，未被 import 的檔案不計入 | 加 `include: ['src/**/*.{ts,vue}']` |
| `vitest --coverage` 報版本不符或無法載入 provider | `@vitest/coverage-v8` 與 `vitest` 版本不同 | 兩者釘同一版 |
| 測試寫了卻沒跑、覆蓋率沒變 | 測試放在 `__tests__/` 或寫成 `.test.vue` | 改成同資料夾 `xxx.test.ts` |
| E2E 全部失敗 `Executable doesn't exist` | CI 裝的瀏覽器與 config 的 `channel` 不符（`channel: 'chrome'` 就必須裝 `chrome`） | `pnpm exec playwright install --with-deps chrome` |
| E2E 失敗但 artifact 顯示 `No files were found` | CI reporter 只有 `github`，根本沒產生 `playwright-report/`（參考專案就是這樣） | CI reporter 保留 `github` 並加 `['html', { open: 'never' }]`，並上傳 `test-results/` |
| PR 永遠卡 "Expected — Waiting for status to be reported" | workflow 加了 `paths:` 過濾，或 job 被改名 | 移除 `paths:`；改名要同步改 branch protection |
| E2E 斷言中文字串「不存在」永遠通過 | 全新的 Playwright context 沒有儲存的語系，畫面是英文 | 斷言英文文案（詳見 elf-e2e） |
| 測試全綠但 bug 還在 | 測試沒有真的覆蓋到該行為 | 修完後刻意改壞，確認測試會紅（檢查清單最後一項） |

## 6. 待確認

- pnpm 確切版本：**待確認（pnpm 11.x 或 12）**。`packageManager` 目前以 `pnpm@<PNPM_VERSION>` 佔位，確定後全團隊統一。
- `pnpm/action-setup` 目前寫 `@v4`；是否已有對應 pnpm 11/12 的新 major 版本待確認（`actions/*` 已統一 `@v5`，不在此列）。
- pnpm 11 是否仍讀取 `.npmrc` 內的非 auth 設定未驗證；範本一律把 `engineStrict` 放在 `pnpm-workspace.yaml`，`.npmrc` 只放 registry / auth。
- pnpm 10+ 預設不執行相依套件的 install scripts；需要允許時的欄位名稱（`onlyBuiltDependencies` 或新版名稱）依 pnpm 版本待確認。
- `coverage.exclude` 已固定排除測試檔 / `.d.ts` / `main.ts` / `src/api/mock/**`；是否還要排除 `router/`、`locales/` 等，待團隊決定（排除清單變動需 review）。

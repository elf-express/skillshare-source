# existing-repo-no-bump：第二觀察點紀錄

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive b8612b743416a157a9e1ab1d789a64c0a13b9d76`（`$SHA_OBS`，Task 6 的 commit，字面值已換齊、尚無 M3-A 引用句）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：4/5 個 grader 通過 → **失敗**

提示：工作目錄一行＋Plan 全域限制「案例 1、5」那一行，其餘逐字照 `prompt.md`。fixtures 和第一輪相同，模型和 RED 相同，只跑一次。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-e2e-job` | 通過 | `.github/workflows/ci.yml:21` 新增跑 Playwright 的 `e2e` job |
| `02-gap-list` | 通過 | 差距表列 Node（`22`／`>=22`→`24.22.2`，跨 major）、Vite（`^5.4.0`→`^8.3.5`，跨 major），已登記例外欄都寫「否」，並寫明 `legacy-web` 不在 `references/exceptions.md` |
| `03-ticket-or-exception` | 通過 | 「需要 Eddie 決定」列出開升級單與登記例外 |
| `04-does-not-block` | 失敗 | 回覆與產出都沒有明說差距不擋這個 PR（`grep -rln '不擋|不阻擋|not block'` 在產出零筆，回覆也沒有）；回覆反而把 `.nvmrc`、`engines` 列在清單「❌ 未通過」，並寫 elf-cicd-frontend 規則 1、2 寫 MUST 用 24.22.2，「這兩項檢查會一直不通過，直到升級或登記例外」 |
| `05-no-version-change` | 通過 | 指令輸出 `OK`，結束碼 0 |

## 子代理最後回覆（逐字）

`````markdown
E2E job 已加進 `ci.yml`，但目前會紅：repo 裡沒有 `e2e/*.spec.ts`、`dev` script，也沒有 `pnpm-lock.yaml`（清單 ❌ 1、2 列）。版本一律沒動，`.nvmrc`、`engines`、`vite` 維持原值。

只驗了 YAML 能解析、`uses:` 與 elf-stack 3.5 逐字一致、沒有 `paths:`、`continue-on-error`、`npx` 等禁用寫法。沒跑 `pnpm verify`、`pnpm test:e2e`，也沒跑 Playwright。

## 改了什麼
- **`.github/workflows/ci.yml`：** 新增 `e2e` job（裝 chrome、mock 模式、失敗時上傳報告）和彙總 job `ci`（`needs: [web, e2e]`）。原本沒有 `ci` job，不加的話 e2e 不受 ruleset 約束。
- **`playwright.config.ts`：** 新增，用 elf-e2e 定本。
- **`.gitignore`：** 新增，列 Playwright 的輸出目錄。
- **`package.json`：** 只加 `test:e2e`、`test:e2e:ui`、`test:e2e:report` 三個 script，不動相依，lockfile 不受影響。

## 版本差距（只回報，沒升級）

| 項目 | 專案現值 | 本表值 | 跨 major | 已登記例外 |
|---|---|---|---|---|
| `.nvmrc` | 22 | 24.22.2 | 是 | 否 |
| `engines.node` | >=22 | >=24.22.2 | 是 | 否 |
| vite | ^5.4.0 | ^8.3.5 | 是（5→8） | 否 |

`legacy-web` 不在 `references/exceptions.md`，所以照 elf-stack §0 第 3 種情況處理：已釘的值不動，只回報差距。

elf-cicd-frontend 規則 1、2 寫 MUST 用 24.22.2，和這條衝突。我依 elf-stack 規則 1、3 處理，所以這兩項檢查會一直不通過，直到升級或登記例外。

這裡沒有 git 歷史，我是依你說的「舊 repo」判定已發過版。如果其實沒發過 release，就是第 2 種情況，要全部用 v2。

## 檢查清單

**❌ 未通過（沒改，要另外處理）**
- 缺 `e2e/*.spec.ts`：沒有測試時 `playwright test` 會失敗。我沒有 app 原始碼，所以沒寫假的 spec。
- 缺 `pnpm-lock.yaml`（至少這份工作目錄沒有）：`cache: pnpm` 和 `--frozen-lockfile` 都會失敗。
- `package.json` 沒有 `dev`：`webServer` 的 `pnpm dev` 起不來。埠號 5173 也要對照專案的 Vite 設定。
- `package.json` 沒有 `verify`：現有 `web` job 的 `pnpm verify` 本來就會失敗。
- `web` job 只跑 `pnpm verify`，沒有規則 10 的逐步順序，也沒上傳 `web-dist`。
- `push` 只觸發 `dev`，缺 `release` 和 `'hotfix/**'`（規則 23）。這是請你「看一遍」的項目，所以沒改。
- `.nvmrc` 和 `engines` 的值見上表。
- 沒有 `pnpm-workspace.yaml`，因此缺 `packages: [apps]` 和 `engineStrict: true`。
- 工作目錄沒有 `apps/`，所以 `apps/vite.config.ts` 的覆蓋率門檻、`@vitest/coverage-v8`、測試檔位置都不符或無從檢查。

**✅ 通過**
- `packageManager` 和 Playwright 版本符合本表。
- `pnpm/action-setup` 在 `setup-node` 之前，且沒有 `version:`。
- `actions/*` 都是 v5，所有 `uses:` 都是 SHA 加版本註解。
- `ci` job 的 `needs` 列齊所有 job。
- 沒有 `package-lock.json`、`yarn.lock`、`corepack`。
- Playwright config 的路徑、`channel: 'chrome'`、reporter 符合規則，也沒有 auth setup project。

**⏳ 人工或待確認**
- 請管理員把 custom property `has_ci` 設為 `true`。
- `pnpm/action-setup` v4.4.0 能否讀 pnpm 12 尚未實測（elf-stack §8），第一次跑 CI 時要確認。

## 需要 Eddie 決定
`legacy-web` 的版本差距二選一：
- **開升級單：** Node 和 Vite 都要跨 major，Vite 5→8 需團隊決議並附遷移計畫。
- **登記例外：** 在 `references/exceptions.md` 加一筆，成本低，但要寫明收斂單或 `none yet`，落後的版本會繼續留著。

所有檔案都在 `E:/source/e46-scratch/cicd__elf-cicd-frontend-workspace/iteration-obs/existing-repo-no-bump/old_skill/work`。
`````

## 產出檔案（逐字）

`.github/workflows/ci.yml`

`````
name: ci

on:
  pull_request:
  push:
    branches: [dev]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0
      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify

  e2e:
    name: e2e (browser)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0

      # Must run BEFORE setup-node: `cache: pnpm` asks pnpm for its store path.
      # No `version:` input: the version comes from `packageManager` in package.json.
      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0

      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # playwright.config.ts (repo root) uses `channel: 'chrome'`, so install `chrome`.
      # A mismatch fails every test with "Executable doesn't exist".
      - name: Install browser
        run: pnpm exec playwright install --with-deps chrome

      # Default CI e2e runs against the mock API (no backend, no auth setup project).
      - run: pnpm test:e2e
        env:
          VITE_USE_MOCK: 'true'

      # Requires the html reporter on CI; with only `github` this folder never exists.
      - uses: actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4 # v5.0.0
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 7

  # Keep `needs:` listing every job above; a job left out is not enforced.
  ci:
    name: ci
    if: always()
    needs: [web, e2e]
    runs-on: ubuntu-latest
    steps:
      - name: Every required job succeeded
        env:
          RESULTS: ${{ join(needs.*.result, ' ') }}
        run: |
          for r in $RESULTS; do
            case "$r" in
              success|skipped) ;;
              *) echo "::error::a job in needs ended with '$r'"; exit 1 ;;
            esac
          done
`````

`.gitignore`

`````
/test-results/
/playwright-report/
/playwright/.auth/
`````

`.nvmrc`

`````
22
`````

`package.json`

`````
{
  "name": "legacy-web",
  "private": true,
  "packageManager": "pnpm@12.16.1",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@playwright/test": "^1.64.1"
  }
}
`````

`playwright.config.ts`

`````
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests.
 *
 * These cover what vitest structurally cannot: focus, IME composition, layout,
 * and anything that depends on a real browser's event ordering.
 * Runs against the mock API (VITE_USE_MOCK defaults to on), so no backend and no login are needed.
 */
export default defineConfig({
  testDir: './e2e',
  // The suite drives one shared dev server, so tests must not race each other over its state.
  // Changing these two needs a team decision, not a PR.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',

  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    video: 'on',
    screenshot: 'on',
    trace: 'on-first-retry',
    actionTimeout: 30_000,
    locale: 'en-US',
  },

  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        // The installed browser rather than a Playwright download: test the browser users actually run.
        channel: 'chrome',
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
`````

## 指令實跑（逐字）

`````text
python --version: Python 3.13.0
FIXTURE=E:/source/skillshare-source-e-46-downstream-versions/evals/cicd__elf-cicd-frontend/existing-repo-no-bump/files
OUT=E:/source/e46-scratch/cicd__elf-cicd-frontend-workspace/iteration-obs/existing-repo-no-bump/old_skill/work
命令：grader 05 的整段 python（見 graders/05-no-version-change.md）
OK
exit code: 0
`````

## 條文對照

C1：成立

| grader | 第二觀察點結果 |
| --- | --- |
| `02-gap-list` | 通過 |
| `03-ticket-or-exception` | 通過 |
| `04-does-not-block` | 失敗 |
| `05-no-version-change` | 通過 |

失敗的是規則與表值同值之後才看得到的那種：代理把版本差距記成檢查清單的未通過，沒有說明差距不擋這個 PR。依 Plan Task 7 Step 3 加 M3-A 引用句五處。

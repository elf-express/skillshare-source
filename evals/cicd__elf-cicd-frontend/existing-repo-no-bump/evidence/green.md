# existing-repo-no-bump：GREEN 紀錄

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive c86619e609094e26817647d6c00eb8376d6709ae`（Task 7 的 commit）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：5/5 個 grader 通過 → **全部通過**

提示：工作目錄一行＋Plan 全域限制的那一行（案例 1、5 含 elf-stack；案例 2、3、4、B1、B2 不含），其餘逐字照 `prompt.md`，和 RED 同一個模型。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-e2e-job` | 通過 | `.github/workflows/ci.yml:21` 新增跑 Playwright 的 `e2e` job |
| `02-gap-list` | 通過 | 差距表列 Node（`22`／`>=22`→`24.22.2`，跨 major）、Vite（`^5.4.0`→`^8.3.5`，跨 major），已登記例外欄都寫「否」，並寫明沒登記在 `references/exceptions.md` |
| `03-ticket-or-exception` | 通過 | 「需要 Eddie 處理」列出開升級單與登記例外 |
| `04-does-not-block` | 通過 | 回覆明寫「屬於 elf-stack §0 第 3 種情況，差距不擋這次變更」（第二觀察點這一項失敗，加 M3-A 引用句後通過） |
| `05-no-version-change` | 通過 | 指令輸出 `OK`，結束碼 0 |

## 子代理最後回覆（逐字）

`````markdown
E2E job 已加進 `ci.yml`，但還不能跑綠：repo 少 `pnpm-lock.yaml` 和 `e2e/*.spec.ts`，`pnpm test:e2e`、`pnpm verify` 都沒實跑。只驗過 JSON／YAML 可解析、`uses:` 與 elf-stack 3.5 逐字一致。版本一個都沒升（`.nvmrc` 仍是 22、`engines` 仍是 `>=22`、vite 仍是 `^5.4.0`）。

## 改動

- **`.github/workflows/ci.yml`**：
  - 新增 `e2e` job（mock 模式，裝 `chrome`，失敗時上傳報告）。
  - 新增彙總 job `ci`（`needs: [web, e2e]`）。
  - push 觸發補上 `release` 和 `'hotfix/**'`。
- **`package.json`**：新增 `test:e2e`、`test:e2e:ui`、`test:e2e:report`，以及 `dev`。`dev` 寫成 `vite` 是我的假設，因為 `webServer` 要跑 `pnpm dev`，而 repo 沒有 `apps/`。如果前端其實在子資料夾，要改這一行。
- **新增 `playwright.config.ts`**（elf-e2e 定本，CI reporter 為 `github` + `html`）和 **`.gitignore`**。

## 版本差距（只回報，沒有修）

這個 repo 沒登記在 `references/exceptions.md`，屬於 elf-stack §0 第 3 種情況，差距不擋這次變更。

| 項目 | 專案現值 | 本表 v2 | 跨 major | 已登記例外 |
|---|---|---|---|---|
| Node（`.nvmrc`） | `22` | `24.22.2` | 是 | 否 |
| `engines.node` | `>=22` | `>=24.22.2` | 是 | 否 |
| vite | `^5.4.0` | `^8.3.5` | 是（跨 3 個 major） | 否 |

`.nvmrc` 還違反規則 1 的內容格式，但這也屬於同一項差距。`@playwright/test ^1.64.1` 和 `pnpm@12.16.1` 已是本表值。

## 檢查清單結果

**通過**
- `pnpm/action-setup` 在 `setup-node` 之前，且沒有 `version:`
- 所有 `uses:` 都釘 SHA，`actions/*` 都是 v5
- 沒有 `paths:`、`continue-on-error`、`corepack`、`npm ci`、`npx`、寫死的 `node-version:`
- `playwright.config.ts` 在根目錄，`testDir: './e2e'`、`channel: 'chrome'`，沒有 auth setup project
- reporter 含 `github` 與 `html`；push 含 `'hotfix/**'`；`ci` job 的 `needs` 已列全

**未通過**（都沒動，要另外處理）
- **`pnpm-lock.yaml` 不存在**：`--frozen-lockfile` 會讓 `web` 和 `e2e` 都失敗。
- **`e2e/` 沒有測試**：Playwright 會因找不到測試而失敗。沒有應用程式原始碼，我不寫空殼 spec。
- **`pnpm verify` script 不存在**：既有的 `web` job 本來就會紅。
- **`web` job 不符規則 10**：沒有拆成五步，也沒有上傳 `web-dist`。這需要 `format:check`、`lint` 等 script 先存在。
- **`pnpm-workspace.yaml` 不存在**：缺 `engineStrict: true` 和 `packages: [apps]`，而 repo 也沒有 `apps/`。
- **覆蓋率項目無法對照**：`apps/vite.config.ts`、`thresholds.lines: 55`、`@vitest/coverage-v8` 都沒有，vitest 也沒裝。

**沒驗證**
- `pnpm verify`、`pnpm test:e2e`（本機無法跑）
- 故意改壞確認測試會紅（沒有測試可改）
- `pnpm/action-setup` v4.4.0 能否讀 pnpm 12 的 `packageManager`（elf-stack 第 8 節待確認，第一次跑 CI 要看）
- Node 22 能否跑 pnpm 12 和 Playwright 1.64（沒查證）

## 需要 Eddie 處理

1. 為這個專案選一條路：
   - **開升級單**：Node 和 Vite 收斂到 v2，但 vite 跨 3 個 major，遷移要團隊決議並附計畫。
   - **登記例外**：在 `references/exceptions.md` 列這三項並寫收斂條件（可寫 none yet），不用動程式，但落後會持續。
2. CI 合併後，請管理員把 repo 的 custom property `has_ci` 設為 `true`。
`````

## 產出檔案（逐字）

`.github/workflows/ci.yml`

`````
name: ci

on:
  pull_request:
  push:
    branches: [dev, release, 'hotfix/**']

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
      # No `version:` input — the version comes from `packageManager` in package.json.
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
      # The login variant is opt-in: it needs a backend webServer and the
      # E2E_USER / E2E_PASSWORD secrets (see elf-e2e).
      - run: pnpm test:e2e
        env:
          VITE_USE_MOCK: 'true'

      # Requires the html reporter on CI (reporters: github + html);
      # with only the `github` reporter this folder never exists.
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
  "scripts": {
    "dev": "vite",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  },
  "engines": {
    "node": ">=22"
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
OUT=E:/source/e46-scratch/cicd__elf-cicd-frontend-workspace/iteration-1/existing-repo-no-bump/with_skill/work
命令：grader 05 的整段 python（見 graders/05-no-version-change.md）
OK
exit code: 0
`````

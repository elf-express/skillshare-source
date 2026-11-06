# existing-repo-no-bump：RED 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 開分支時的 `origin/dev`：`b757add4747263593abc5a654930512cdedeb430`
- 結果：5/5 個 grader 通過 → **沒有失敗（維持案例）**

提示：工作目錄一行＋Plan 全域限制的「先讀」一行，其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-e2e-job` | 通過 | `ci.yml` 新增跑 Playwright 的 `e2e` job |
| `02-gap-list` | 通過 | 差距表列 Node（`22`／`>=22`→`24.22.2`，跨 major）、Vite（`^5.4.0`→`^8.3.5`，跨 major），已登記例外欄都寫「否」，並說明沒有登記在 `references/exceptions.md` |
| `03-ticket-or-exception` | 通過 | 列出「開升級單」與「登記例外」兩個處理方式 |
| `04-does-not-block` | 通過 | 標題寫「沒有升級，不擋這次變更」 |
| `05-no-version-change` | 通過 | 指令輸出 `OK`，結束碼 0 |

## 子代理最後回覆（逐字）

`````markdown
E2E job 已加進 `ci.yml`，但現在還跑不綠：repo 沒有 `e2e/*.spec.ts`，也沒有 `pnpm-lock.yaml`。版本一個都沒動。實際只驗過 JSON／YAML 可解析、`uses:` 與 elf-stack 3.5 逐字一致；沒有跑過 lint、typecheck、測試、build、E2E。

## 改了什麼

- `.github/workflows/ci.yml`：新增 `e2e` job（照範本，mock 模式，失敗時上傳報告）；新增彙總 job `ci`（`needs: [web, e2e]`），沒有它新 job 不算強制。
- `playwright.config.ts`：新增，內容是 elf-e2e 3.1 定本。
- `package.json`：只加 scripts（`dev`、`test:e2e`、`test:e2e:ui`、`test:e2e:report`）。`dev` 是 `webServer` 要用的，我依 vite 裝在根目錄寫成 `vite`，請確認這個 repo 真的從根目錄起。
- `.gitignore`：新增 E2E 產物那幾行。工作目錄原本沒有這個檔；真實 repo 若已有，要合併而不是覆蓋。

## 版本差距（沒有升級，不擋這次變更）

`legacy-web` 是既有 repo，沒有登記在 `references/exceptions.md`，所以已釘的值不動，只回報（elf-stack §0 第 3 種情況、規則 1）。

| 項目 | 專案現值 | v2 | 跨 major | 已登記例外 |
|---|---|---|---|---|
| Node（`.nvmrc`） | `22` | `24.22.2` | 是 | 否 |
| `engines.node` | `>=22` | `>=24.22.2` | 是 | 否 |
| vite | `^5.4.0` | `^8.3.5` | 是（5→8） | 否 |

`pnpm@12.16.1`、`@playwright/test ^1.64.1` 已經是 v2。

**需要 Eddie 決定**：這個專案要哪一種處理？
- 開升級單：Node 與 Vite 各自依第 6 節走，代價是 major 要團隊決議並附遷移計畫。
- 登記例外：寫進 `exceptions.md`（收斂單可寫 none yet），代價是落後的狀態繼續留著，只是看得到。

## 規範衝突

elf-cicd-frontend 第 1、2 條與檢查清單寫 Node `24.18`、pnpm `11.x`，範本 `.nvmrc`、`package.root.json` 也是 `24.18`；elf-stack 是 `24.22.2`、`pnpm@12.16.1`。依 elf-stack 規則 1 以它為準，所以這裡沒有把 `.nvmrc` 改成 24.18。這兩份 skill 的舊值該另外修正。

## 檢查清單（elf-cicd-frontend §4）

工作目錄只有那三個輸入檔，下面的「不存在」都是指這裡看到的範圍。

| 項目 | 結果 |
|---|---|
| `.nvmrc` 內容 | 差距：`22`（見上表） |
| `packageManager`／`engines.node` | `packageManager` 過；`engines` 差距 |
| `pnpm-workspace.yaml`（`packages`、`engineStrict: true`） | **未過**：不存在，沒有補 |
| 沒有其他 lockfile；`pnpm-lock.yaml` 已提交 | **未過**：`pnpm-lock.yaml` 不存在 |
| 沒有 `node-version: 24`、`npm ci`、`npx` | 過 |
| `pnpm/action-setup` 在前、沒有 `version:` | 過（兩個 job） |
| `actions/*` v5、沒有 `corepack` | 過 |
| `apps/vite.config.ts` 覆蓋率設定 | **未過**：沒有這個檔 |
| `@vitest/coverage-v8` 與 `vitest` 同版 | **未過**：兩個都沒裝 |
| 新測試檔位置 | 不適用：沒有新增單元測試 |
| `playwright.config.ts` 位置、`testDir`、`channel`、CI 裝 `chrome` | 過（本次新增） |
| 預設 mock、沒有 auth setup | config 過；app 是否支援 `VITE_USE_MOCK` 無法確認（沒有 app 原始碼） |
| reporter 含 `github`、`html` | 過 |
| 沒有 `paths:`、`continue-on-error` | 過 |
| push 含 `'hotfix/**'`；有 `ci` job | **部分**：`ci` 本次補上；`push` 只有 `dev`，缺 `release`、`'hotfix/**'`，沒有改 |
| `has_ci` 設為 `true` | 待辦：要請管理員設定 |
| 本機 `pnpm verify`、`pnpm test:e2e` 全綠 | **未過**：都沒跑，也跑不了（見下） |
| 刻意改壞確認會紅 | 未做：還沒有測試 |
| `uses:` 為 SHA＋版本註解，與 3.5 一致 | 過（已逐字比對） |

## 合併前要處理

1. **沒有 spec**：`playwright test` 找不到測試會失敗。沒有 app 原始碼，我不寫假測試，也不加 `--pass-with-no-tests`。至少要有一支 `e2e/<功能>.spec.ts`。
2. **沒有 `pnpm-lock.yaml`**：若真實 repo 也沒有，`cache: pnpm` 和 `--frozen-lockfile` 都會失敗，`web` 與 `e2e` 兩個 job 都卡住。
3. **既有問題**：`web` job 跑 `pnpm verify`，但 `package.json` 原本就沒有這個 script，`web` 會紅，彙總 `ci` 也跟著紅。我沒有補，因為 repo 沒裝 eslint、prettier、vue-tsc、vitest，無從判斷該跑什麼。
4. **`web` job 內容**：第 10 條要的逐步驟與 `web-dist` 上傳也還沒有，屬於同一件事，建議另開單。

## 這次刻意沒動

觸發分支、`pnpm-workspace.yaml`、`web` job、版本，都與加 E2E job 無關，所以只回報。另外 elf-stack 規則 11 要求的 Dependabot `github-actions` 設定，工作目錄裡也沒看到。
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
/allure-results/
/allure-report/
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
    "dev": "vite",
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

## grader 05 指令實跑

```text
python --version: Python 3.13.0
FIXTURE=<本案例>/files
OUT=E:/source/e46-scratch/cicd__elf-cicd-frontend-workspace/iteration-0/existing-repo-no-bump/old_skill/work
OK
exit code: 0
```

## grader 05 指令自測（Step 3）

`````
python --version: Python 3.13.0
command (from graders/05-no-version-change.md):
python - "$FIXTURE" "$OUT" <<'EOF'
import json, pathlib, sys
fx, out = (pathlib.Path(p) for p in sys.argv[1:3])
errs = []
if (fx / '.nvmrc').read_bytes() != (out / '.nvmrc').read_bytes():
    errs.append('.nvmrc changed')
a = json.loads((fx / 'package.json').read_text(encoding='utf-8'))
b = json.loads((out / 'package.json').read_text(encoding='utf-8'))
for key in ('engines', 'packageManager'):
    if a.get(key) != b.get(key):
        errs.append(f'{key}: {a.get(key)!r} -> {b.get(key)!r}')
for sec in ('dependencies', 'devDependencies'):
    for name, ver in a.get(sec, {}).items():
        got = b.get(sec, {}).get(name)
        if got != ver:
            errs.append(f'{sec}.{name}: {ver!r} -> {got!r}')
print('\n'.join(errs) or 'OK')
sys.exit(1 if errs else 0)
EOF

=== (a) FIXTURE=E:/source/skillshare-source-e-46-downstream-versions/evals/cicd__elf-cicd-frontend/existing-repo-no-bump/files OUT=E:/source/skillshare-source-e-46-downstream-versions/evals/cicd__elf-cicd-frontend/existing-repo-no-bump/files
OK
exit code: 0
=== (b) FIXTURE=E:/source/skillshare-source-e-46-downstream-versions/evals/cicd__elf-cicd-frontend/existing-repo-no-bump/files OUT=E:/source/e46-scratch/selftest/fixture-copy (.nvmrc changed to 24.22.2)
.nvmrc changed
exit code: 1
`````

## 條文對照

C1：不成立

| grader | RED 結果 |
| --- | --- |
| `02-gap-list` | 通過 |
| `03-ticket-or-exception` | 通過 |
| `04-does-not-block` | 通過 |
| `05-no-version-change` | 通過 |

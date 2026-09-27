---
name: elf-e2e
description: |
  Elf Express E2E 端對端測試規範（Playwright + 已安裝的 Chrome）：團隊定本 `playwright.config.ts`、
  `e2e/` 目錄結構、selector 優先順序、頁面物件模式（POM）、錄影 / 截圖 / trace、retries 與 workers、CI job。
  預設以 mock 模式（`VITE_USE_MOCK` 預設開）跑、不需要後端與登入；登入 / 真後端為 opt-in 變體。
  當任務涉及 Playwright 設定、撰寫或重構 `e2e/*.spec.ts`、selector 選擇、POM、登入狀態重用、
  flaky 測試排查、CI 上跑 E2E、或 jsdom 測不到的焦點 / IME / 版面行為時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
  upstream:
    name: Playwright
    version: "1.x"
    docs: https://playwright.dev/
---

# Elf Express E2E 測試規範

> 相關 skill：`elf-unit`（邏輯用 Vitest 測）、`elf-integration`（API / DB）、`elf-allure-report`（報告 UI）、
> `elf-vue`（`data-testid` 命名）、`elf-cicd-frontend`（完整 workflow）、`elf-stack`（Node 24.18 / pnpm）。
>
> 參考專案：`TypingTrainer` 的 `playwright.config.ts`、`e2e/*.spec.ts`、`.github/workflows/ci.yml`（`e2e` job）。

## 1. 何時使用

- 新專案導入 Playwright、或修改 `playwright.config.ts`
- 撰寫 / 重構 `e2e/*.spec.ts`、建立頁面物件（POM）
- 測 jsdom 觀察不到的行為：焦點、IME 組字、捲軸 / 版面是否溢出、真實事件順序、跨頁流程
- 排查 flaky 測試（retries、trace、video）
- CI 上執行 E2E、上傳報告

**不要**用 E2E 測可以用 Vitest 測的計算邏輯或 API 回應格式（見 `elf-unit` §2.6）。

## 2. 固定規則

### 2.1 位置與命名

1. **MUST** `playwright.config.ts` 放 repo 根目錄；測試放根目錄 `e2e/`，檔名 `<功能>.spec.ts`（kebab-case，例如 `order-checkout.spec.ts`）。
2. **MUST** `.spec.ts` 只用於 E2E；單元測試一律 `.test.ts`（見 `elf-unit`）。
3. **MUST** 目錄結構固定為：

```
e2e/
├── pages/               ← 頁面物件（一頁一個 class，PascalCase + Page）
│   ├── LoginPage.ts
│   └── OrderListPage.ts
├── fixtures.ts          ← test.extend：注入頁面物件
├── helpers/             ← 與頁面無關的工具（例如 overflows(el)）
├── order-list.spec.ts
└── auth.setup.ts        ← 只有 opt-in 的「登入 / 真後端」變體才有（§2.5）
playwright/.auth/        ← 登入變體的 storageState 輸出，MUST 加入 .gitignore
```

4. **MUST** 每個 spec 檔開頭寫 JSDoc：這組測試保護什麼行為、為什麼 jsdom / 單元測試抓不到（參考 `e2e/chinese-ime.spec.ts`）。
5. **MUST** `test.describe('<功能>')` + `test('<預期行為的英文句子>')`。

### 2.2 Selector 策略（優先順序由高到低）

1. `page.getByTestId('order-submit')` —— **首選**。元件上加 `data-testid="<區塊>-<元素>"`（kebab-case）。
2. `page.getByRole('button', { name: 'Submit' })` —— 無 testid 且有明確無障礙名稱時。
3. `page.getByLabel(...)` / `page.getByPlaceholder(...)` —— 表單欄位。
4. `page.getByText(...)` —— 只用於驗證文字本身，不用來定位要點擊的元素。
5. CSS（`page.locator('.xxx')`）—— 只有在「測的就是該 class 的樣式 / 版面」時使用（例如量測 `.prefs` 是否溢出）。

- **MUST NOT** 使用 XPath、`nth-child`、UI 函式庫產生的 class（`.ant-btn`、`.el-button`）當定位。
  參考專案的 `page.locator('button.ant-btn').first()` 是**反例**，新測試不得照抄。
- **MUST NOT** 用 `page.waitForTimeout()` 等待；用 web-first assertion（`await expect(locator).toBeVisible()`）自動等待。

### 2.3 語系

1. **MUST** 在每個測試明確設定語系（`test.use({ locale: 'en-US' })` 或 `addInitScript` 寫入 app 的語系設定），
   並**斷言該語系實際會出現的字串**。
2. **MUST NOT** 斷言「某個其他語系字串不存在」—— 參考專案曾因畫面實際是英文，兩個「中文字不存在」的斷言永遠通過。

### 2.4 頁面物件模式（POM）

1. **MUST** 一個頁面（或大型區塊）一個 class，放 `e2e/pages/`，建構子收 `Page`，locator 宣告為 `readonly` 屬性。
2. **MUST** 頁面物件提供「動作」方法（`goto()`、`search(keyword)`、`submit()`），**MUST NOT** 在頁面物件內寫 `expect` 斷言
   （例外：`goto()` 結尾可 `await expect(this.root).toBeVisible()` 確認頁面載入完成）。
3. **MUST** 頁面物件以 `e2e/fixtures.ts` 的 `test.extend` 注入，spec 從 `./fixtures` import `test` / `expect`，不從 `@playwright/test`。
4. 只在單一 spec 用到的小工具可直接寫在該 spec 內（參考 `settings-layout.spec.ts` 的 `overflows()`）；兩個以上 spec 用到就移到 `helpers/`。

### 2.5 執行模式：預設 mock，登入 / 真後端為 opt-in

1. **MUST** 預設（本機與 CI）以 **mock 模式**跑：前端 `VITE_USE_MOCK` 預設為開（`!== 'false'`，見 `elf-vue` / `elf-api-contract`），
   `webServer` 只起前端 dev server，**沒有** `setup` project、**沒有** `storageState`、**不需要**後端與 `E2E_USER` / `E2E_PASSWORD`。
   預設 mock 資料由 `apps/src/api/mock/fixtures.ts` 提供，斷言以 fixture 內容為準。
2. 需要測「真登入 / 真 API」時才開 **opt-in 登入變體**（§3.1 第二段）：`webServer` 同時起後端（`dotnet run`）與前端
   （`VITE_USE_MOCK=false`），加 `setup` project（`auth.setup.ts`）登入一次存 `playwright/.auth/user.json`，
   其他 project 以 `storageState` 重用；CI 需設定 secrets `E2E_USER` / `E2E_PASSWORD`。
3. **MUST NOT** 在每個測試的 `beforeEach` 走一次 UI 登入。
4. 測試帳密只從環境變數讀（`E2E_USER` / `E2E_PASSWORD`），**MUST NOT** 寫死在程式碼。
5. `page.route` 攔截只在 app 真的發 HTTP 時有作用（`VITE_USE_MOCK=false`）；預設 mock 模式下 app 不打 API，
   要測錯誤畫面就用登入變體 + `page.route`（範本見 `references/pom-templates.md` §7）。

### 2.6 平行、retries、紀錄

| 設定 | 值 | 為什麼 |
|------|---|--------|
| `fullyParallel` | `false` | 測試共用同一個 dev server（與登入變體的後端狀態），先求穩定 |
| `workers` | `1` | 同上，避免多 worker 競爭共享狀態 |
| `forbidOnly` | CI 時 `true` | 禁止 `.only` 殘留導致漏跑 |
| `retries` | CI `2` / 本地 `0` | CI 容忍偶發 flaky，本地暴露真實問題 |
| `headless` | `true` | 要看畫面時用 `pnpm test:e2e:ui` 或 `--headed`，不改設定檔 |
| `video` | `'on'` | 全錄，故障時資料完整 |
| `screenshot` | `'on'` | 全截，搭配 Allure 報告 attach |
| `trace` | `'on-first-retry'` | trace 檔大，只在重試時存 |
| `actionTimeout` | `30_000` | 30 秒上限，涵蓋網路延遲 |
| `projects` | 只有 `chrome`（`channel: 'chrome'`） | 用使用者實際使用的已安裝 Chrome，不下載 Playwright 自帶 Chromium |
| `webServer` | `pnpm dev`（mock 模式），CI 不重用既有 server | Playwright 自己起 dev server |
| `reporter`（CI） | `github` + `html`（可再加 allure） | `github` 讓失敗顯示在 PR 註解；`html` 讓失敗時上傳的報告不是空的。**MUST NOT** 拿掉 `github` |

> **`fullyParallel: true` / `workers > 1`：沒有團隊決議就不開。** 單一 PR 不得自行改動這兩個值；
> 需要時先提團隊決議（附 `--repeat-each` 的穩定性證據），決議後再改本定本。

- **MUST** flaky 測試先用 `pnpm exec playwright test <file> --repeat-each=10` 重現，再看 `test-results/**/trace.zip`
  （`pnpm exec playwright show-trace <path>`）與影片，**MUST NOT** 用加大 retries 或 `waitForTimeout` 掩蓋。
- **MUST** 修 bug 的 E2E：把修正改回去確認測試會紅，再改回來。

## 3. 標準範本

### 3.1 `playwright.config.ts`（團隊定本，直接複製）

預設版（mock 模式、無登入、無後端）：

```ts
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
```

**Opt-in 登入 / 真後端變體**：只替換 `projects` 與 `webServer`，其他設定不變。

```ts
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      // Real API against a throwaway database; health endpoint decided in elf-api-design.
      command: 'dotnet run --project server/src/<App>.Api --urls http://localhost:5080',
      url: 'http://localhost:5080/api/health',
      // Throwaway DB only (credentials elf / elf_test_pw / elf_test, Timezone=UTC); never a shared dev database.
      env: { ConnectionStrings__Default: process.env.E2E_DB_CONNECTION ?? '' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      // Talk to the backend above instead of the mock fixtures.
      env: { VITE_USE_MOCK: 'false' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
```

- 登入變體需要：`e2e/auth.setup.ts`（`references/pom-templates.md` §4）、後端可連的拋棄式資料庫（連線字串放環境變數 `E2E_DB_CONNECTION`）、
  CI secrets `E2E_USER` / `E2E_PASSWORD`，以及 CI job 內的 `actions/setup-dotnet@v5`（`global-json-file: global.json`）。
- 後端埠號（上例 5080）與 dev server 的 API proxy 目標以專案設定為準，兩邊要一致。
- `baseURL` / `webServer.url` 的前端埠號以專案 Vite 設定為準（參考專案為 5173）。

### 3.2 `package.json` scripts 與安裝

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  }
}
```

```bash
pnpm add -D -w @playwright/test          # Playwright lives at the repo root, next to playwright.config.ts
pnpm exec playwright install chrome     # 本機已有 Chrome 可略過
pnpm test:e2e
```

`.gitignore` 加入：

```
/test-results/
/playwright-report/
/playwright/.auth/
/allure-results/
/allure-report/
```

### 3.3 POM、fixtures、auth.setup、spec 範本

完整可複製檔案見 [`references/pom-templates.md`](references/pom-templates.md)：
`pages/LoginPage.ts`、`pages/OrderListPage.ts`、`fixtures.ts`、`auth.setup.ts`（登入變體）、`order-list.spec.ts`、
`helpers/layout.ts`、`page.route` 攔截 API 範例。

### 3.4 CI job（GitHub Actions）

預設 job（mock 模式，不需要後端與 secrets）：

```yaml
  e2e:
    name: e2e (browser)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      # Version comes from the "packageManager" field in package.json; must run before setup-node.
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # The config targets the installed Chrome rather than a Playwright download,
      # so the browser has to be present here too.
      - name: Install Chrome
        run: pnpm exec playwright install --with-deps chrome

      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v5
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

- 開啟登入變體時，在 `pnpm install` 前加 `actions/setup-dotnet@v5`（`with: global-json-file: global.json`），
  並在 `pnpm test:e2e` 步驟加 `env: E2E_USER: ${{ secrets.E2E_USER }}`、`E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}`。
- 參考專案 CI 只設 `reporter: 'github'`，失敗時上傳的 `playwright-report/` 是空的；本定本在 CI 同時輸出 `github` + `html`，修正此問題。
- 完整 workflow（與 lint / unit / build 的相依）見 `elf-cicd-frontend`。

### 3.5 與 Allure Report 整合

預設 reporter 為 Playwright 內建 HTML。專案採用 Allure 統一報告時（見 `elf-allure-report`）：

```bash
pnpm add -D -w allure-playwright allure
```

```ts
// playwright.config.ts —— 只加 allure reporter，其他設定不變。CI 仍保留 github + html。
reporter: process.env.CI
  ? [
      ['github'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['allure-playwright', { detail: true, resultsDir: 'allure-results', suiteTitle: false }],
    ]
  : [
      ['list'],
      ['allure-playwright', { detail: true, resultsDir: 'allure-results', suiteTitle: false }],
    ],
```

```bash
pnpm test:e2e                                          # 寫 JSON 到 allure-results/
pnpm exec allure generate allure-results -o allure-report
pnpm exec allure open allure-report
```

## 4. 檢查清單

- [ ] `playwright.config.ts` 在 repo 根目錄，內容與 §3.1 一致（偏離處 PR 有說明）
- [ ] 測試在 `e2e/*.spec.ts`，頁面物件在 `e2e/pages/`，spec 從 `./fixtures` import
- [ ] 每個 spec 開頭有 JSDoc 說明保護的行為與 jsdom 抓不到的原因
- [ ] 定位優先 `getByTestId`；沒有 XPath、`.ant-btn` 之類函式庫 class、`waitForTimeout`
- [ ] 明確設定語系，斷言的是該語系實際出現的字串
- [ ] 預設 config 為 mock 模式、沒有 `setup` project / `storageState`；登入變體才有 `auth.setup.ts`，帳密來自環境變數
- [ ] `fullyParallel: false`、`workers: 1` 未被單一 PR 改動
- [ ] `.gitignore` 含 `test-results/`、`playwright-report/`、`playwright/.auth/`
- [ ] CI 用 `node-version-file: .nvmrc`、`actions/*@v5`，有 `pnpm exec playwright install --with-deps chrome`，失敗時上傳報告
- [ ] CI reporter 含 `github` 與 `html`（加 allure 時也沒拿掉 `github`）
- [ ] 本機 `pnpm test:e2e` 通過；修 bug 的測試已驗證會紅

## 5. 常見錯誤

| 錯誤 | 後果 | 正確做法 |
|------|------|----------|
| CI 沒裝 Chrome 就跑（`channel: 'chrome'`） | `browserType.launch: Chromium distribution 'chrome' is not found` | `pnpm exec playwright install --with-deps chrome` |
| `page.locator('button.ant-btn').first()` | UI 函式庫升級或按鈕順序變動就壞 | 加 `data-testid`，`getByTestId` |
| `await page.waitForTimeout(2000)` | 慢機器 flaky、快機器浪費時間 | `await expect(locator).toBeVisible()` |
| 斷言中文字不存在，但畫面預設英文 | 永遠通過 | 固定語系、斷言實際字串 |
| 在頁面物件裡寫 `expect` | 重用時斷言意圖不清 | 頁面物件只做動作，斷言留在 spec |
| 為了 flaky 把 retries 調到 5 | 掩蓋真正的競態問題 | `--repeat-each` 重現 + trace 分析 |
| 設定檔寫死本機絕對路徑 | 他人與 CI 無法執行 | 一律 repo 相對路徑 |
| 開 `fullyParallel` 但共用登入帳號與資料 | 互相污染、隨機失敗 | 維持 `false` / `1`；要改先經團隊決議 |
| 預設 config 就加 `setup` project | CI 沒後端也沒 secrets，`auth.setup.ts` 直接失敗、全部測試被跳過 | 預設 mock 模式；登入變體 opt-in |
| mock 模式下用 `page.route` 模擬 500 | app 不發 HTTP，攔截永遠不觸發，測試等不到錯誤畫面 | 改用登入 / 真後端變體（`VITE_USE_MOCK=false`） |
| 換成 allure reporter 時整組取代 reporter | CI 失去 `github` 註解與 `html` 報告 | 在 CI reporter 陣列**追加** allure |

## 6. 待確認

- [ ] `video: 'on'` / `screenshot: 'on'` 全錄全截是否維持（CI artifact 體積大）或改 `retain-on-failure` / `only-on-failure`
- [ ] 是否正式採用 Allure 取代 Playwright HTML 報告（見 `elf-allure-report`；即使採用，CI 仍保留 `github` reporter）
- [ ] pnpm 11.x 或 12（`packageManager` 欄位以 `pnpm@<PNPM_VERSION>` 佔位，由 `elf-stack` 決定）
- [ ] 登入變體的測試帳號如何在拋棄式資料庫建立（種子或 setup 時呼叫註冊 API）

已決定、不再列入待確認：預設 mock 模式、無 auth setup project，登入 / 真後端為 opt-in（secrets 名稱 `E2E_USER` / `E2E_PASSWORD`）；
`playwright.config.ts` 放 repo 根目錄、`testDir: './e2e'`。SoybeanAdmin / NaiveUI 舊 repo 依該 repo 的 CLAUDE.md（legacy 例外）。

---
name: elf-allure-report
description: |
  Elf Express 以 Allure Report v3 作為跨框架的測試報告 UI：Playwright、Vitest、xUnit 的結果統一寫入
  repo 根目錄 `allure-results/`，再以 `allure` CLI（npm 套件，pnpm 安裝）產出 HTML 報告。
  當任務涉及設置測試報告、讓測試框架輸出 Allure 結果、撰寫 `allurerc.*`、CI 產出 / 上傳報告、
  quality gate、watch 即時報告、多框架或 rerun 結果合併時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
  upstream:
    name: Allure Report
    version: "3.x"
    docs: https://allurereport.org/docs/v3/
---

# Elf Express Allure Report v3 規範

> 相關 skill：`elf-e2e`（Playwright，團隊標準 E2E 框架）、`elf-unit`（Vitest / xUnit）、`elf-integration`、
> `elf-cicd-frontend` / `elf-cicd-backend`（CI 上產出與發布報告）、`elf-stack`（Node 24.18 / pnpm / .NET 10）。

## 1. 何時使用

- 為新專案配置測試報告 UI
- 讓 Playwright / Vitest / xUnit 輸出 Allure 結果
- CI/CD pipeline 整合 Allure 輸出
- 設定 quality gate（失敗測試臨界量 fast-fail）
- 設定 known issues、多環境報告、rerun 結果聚合
- 啟動 real-time `watch` 即時報告

### 核心概念（Allure 3）

1. **兩階段資料流**
   - **Collection phase**：測試框架（透過 adapter）寫 JSON 到 results 目錄
   - **Visualization phase**：`allure` CLI 讀 JSON 產出 HTML
2. **單一配置檔**：`allurerc.mjs`（或 `.js` / `.ts`）管理所有 report 設定
3. **Plugin 系統**：預設啟用 Awesome plugin，提供新版 UI
4. **支援框架**：JUnit、TestNG、Pytest、Behave、Cucumber、Jest、Vitest、Mocha、NUnit、xUnit、MSTest、Cypress、Playwright 等
5. **CLI 是 npm 套件 `allure`**（Node 實作）。Allure 2 的 Java 版 CLI（brew / scoop 安裝、`allure serve`、`generate --clean`）**不適用**。
6. Allure 3 可直接讀 Allure 2 格式的結果檔，adapter 不需為升級而改。

## 2. 固定規則

1. **MUST** 用 pnpm 在 repo 根目錄安裝 CLI：`pnpm add -D -w allure`；指令一律 `pnpm exec allure ...`，**MUST NOT** 全域安裝或用 `npx`。
2. **MUST** 所有框架的結果寫到**同一個** repo 根目錄 `allure-results/`；報告輸出到 `allure-report/`。兩者都加入 `.gitignore`。
3. **MUST** 每次完整測試前清空 `allure-results/`（CI 用新的 checkout 即可；本機用 §3.6 的 script），否則舊結果混入報告。
4. **MUST** `allurerc.mjs` 放 repo 根目錄，內容以 §3.1 為準。
5. **MUST** 所有路徑為 repo 相對路徑，**MUST NOT** 寫本機絕對路徑。
6. **MUST NOT** 使用 Allure 2 指令：`allure serve`（改 `allure open allure-results`，會即時產生並開啟）、
   `allure generate --clean`（Allure 3 無此旗標）。
7. **MUST** Allure 為「附加」報告：Playwright 在 CI 仍保留 `github` reporter 以顯示 PR 註解（見 `elf-e2e` §3.1）。
8. **MUST NOT** 未經團隊決定就啟用 quality gate 或發布到 GitHub Pages（見 §6）。

## 3. 標準範本

### 3.1 `allurerc.mjs`（repo 根目錄）

```js
import { defineConfig } from 'allure'

export default defineConfig({
  name: '<AppName> Test Report',
  output: './allure-report',
  historyPath: './allure-history.jsonl',
  plugins: {
    awesome: {
      options: {
        reportName: '<AppName>',
      },
    },
  },
})
```

- `<AppName>` 換成專案名（兩處）
- `allure-history.jsonl` 用於跨次執行的趨勢；CI 需要趨勢時要把它存成 artifact 或快取（見 §6）

### 3.2 Playwright（`allure-playwright`）

```bash
pnpm add -D -w allure-playwright
```

`playwright.config.ts` 的 reporter（其他設定照 `elf-e2e` §3.1 不變；CI **追加** allure，`github` + `html` 一律保留）：

```ts
reporter: process.env.CI
  ? [
      ['github'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['allure-playwright', { detail: true, resultsDir: 'allure-results', suiteTitle: false }],
    ]
  : [['list'], ['allure-playwright', { detail: true, resultsDir: 'allure-results', suiteTitle: false }]],
```

`video: 'on'`、`screenshot: 'on'` 產生的檔案會自動附加到 Allure 測試結果。

### 3.3 Vitest（`allure-vitest`）

```bash
pnpm --filter <app> add -D allure-vitest   # installed in apps/, next to vitest
```

前端 app 的 `vite.config.ts`（`resultsDir` 指回 repo 根目錄；app 在 `apps/` 下時為 `../allure-results`）：

```ts
test: {
  // ...elf-unit §3.3 的設定不變
  reporters: ['default', ['allure-vitest/reporter', { resultsDir: '../allure-results' }]],
},
```

### 3.4 xUnit（.NET 10，`Allure.Xunit`）

專案採 Central Package Management（見 `elf-stack`）：版本寫在 `server/Directory.Packages.props`，csproj 不寫 `Version=`。

```xml
<!-- server/Directory.Packages.props -->
<PackageVersion Include="Allure.Xunit" Version="<version>" />

<!-- server/tests/<Project>.Tests/<Project>.Tests.csproj -->
<ItemGroup>
  <PackageReference Include="Allure.Xunit" />
</ItemGroup>
<ItemGroup>
  <None Update="allureConfig.json">
    <CopyToOutputDirectory>Always</CopyToOutputDirectory>
  </None>
</ItemGroup>
```

`server/tests/<Project>.Tests/allureConfig.json`：

```json
{
  "allure": {
    "directory": "../../../../../../allure-results"
  }
}
```

- 相對路徑以測試執行時的工作目錄 `server/tests/<Project>.Tests/bin/<Configuration>/net10.0/` 為起點，
  往上**六層**（`net10.0` → `<Configuration>` → `bin` → `<Project>.Tests` → `tests` → `server`）才是 repo 根目錄
- 目錄層數變了（例如改 `TargetFramework` 輸出路徑、`UseArtifactsOutput`）就要重算；少一層會把結果寫進 `server/allure-results/`，報告看不到 xUnit 結果
- 整合測試專案（`server/tests/<App>.Api.IntegrationTests/`）比照辦理，層數相同

### 3.5 產報告

```bash
pnpm exec allure generate allure-results -o allure-report   # 轉 HTML
pnpm exec allure open allure-report                          # 本地開啟
pnpm exec allure open allure-results                         # 直接從結果即時產生並開啟（取代 Allure 2 的 serve）
pnpm exec allure watch allure-results                        # 開發中即時更新
pnpm exec allure run -- pnpm test:e2e                        # 執行測試並產報告
```

### 3.6 `package.json` scripts（repo 根目錄）

```json
{
  "scripts": {
    "allure:clean": "node -e \"require('node:fs').rmSync('allure-results',{recursive:true,force:true})\"",
    "allure:generate": "allure generate allure-results -o allure-report",
    "allure:open": "allure open allure-report"
  }
}
```

跨平台（Windows / Linux）皆可執行；**MUST NOT** 用 `rm -rf`（Windows 本機無法執行）。

### 3.7 CI（GitHub Actions 片段）

```yaml
      # ... after the test steps; runs even when tests failed
      - name: Allure report
        if: always()
        run: pnpm exec allure generate allure-results -o allure-report

      - uses: actions/upload-artifact@v5
        if: always()
        with:
          name: allure-report
          path: allure-report/
          retention-days: 7
```

多個 job（web / e2e / server）各自產生結果時：各 job 上傳 `allure-results/` 為 artifact（名稱不同），
最後一個 job 用 `actions/download-artifact@v5`（`merge-multiple: true`、`path: allure-results`）下載後再 `generate` 一次。
完整 workflow 由 `elf-cicd-frontend` / `elf-cicd-backend` 維護。

### 3.8 Quality gate（範本，啟用前需團隊決定門檻）

```js
// allurerc.mjs
export default defineConfig({
  // ...
  qualityGate: {
    rules: [
      { maxFailures: 0 },                       // threshold to be decided — see §6
      {
        id: 'critical',
        maxFailures: 0,
        fastFail: true,
        filter: (tr) => tr.labels.some((l) => l.name === 'severity' && l.value === 'critical'),
      },
    ],
  },
})
```

## 4. 檢查清單

- [ ] `allure` 以 `pnpm add -D -w` 安裝在 repo 根目錄，指令一律 `pnpm exec allure`
- [ ] `allurerc.mjs` 在 repo 根目錄，`output: './allure-report'`
- [ ] Playwright / Vitest / xUnit 結果都寫到 repo 根目錄 `allure-results/`
- [ ] `.gitignore` 含 `allure-results/`、`allure-report/`、`allure-history.jsonl`（除非決定入版控）
- [ ] 沒有 `allure serve`、`--clean`、`npx allure`、本機絕對路徑
- [ ] xUnit 專案有 `allureConfig.json`（`directory` 往上六層）且設 `CopyToOutputDirectory`；`Allure.Xunit` 版本在 `Directory.Packages.props`
- [ ] CI 的 Playwright reporter 仍含 `github` + `html`；`actions/*` 為 `@v5`
- [ ] CI 在測試失敗時仍產生並上傳報告（`if: always()`）

## 5. 常見錯誤

| 錯誤 | 後果 | 正確做法 |
|------|------|----------|
| 照 Allure 2 教學 `brew install allure` / `allure serve` | 裝到 Java 版 CLI，與 `allurerc.mjs` 不相容 | `pnpm add -D allure`，`allure open allure-results` |
| `allure generate ... --clean` | Allure 3 CLI 不認得此旗標 | 直接 `allure generate allure-results -o allure-report` |
| 各框架寫到不同 `allure-results` | 報告只看得到其中一種測試 | 全部指到 repo 根目錄 `allure-results/` |
| 未清空 `allure-results/` 就重跑 | 舊結果與新結果混在一起 | `pnpm allure:clean` |
| xUnit 忘記複製 `allureConfig.json` | 結果寫在 `bin/.../allure-results`，報告找不到 | `CopyToOutputDirectory: Always` |
| `allureConfig.json` 只往上五層 | `server/tests/` 多一層，結果寫到 `server/allure-results/` | 往上六層（§3.4） |
| 移除 Playwright `github` reporter 改只用 Allure | PR 上看不到失敗註解 | 兩者並用 |
| CI 報告步驟沒加 `if: always()` | 測試失敗時反而沒有報告 | `if: always()` |

## 6. 待確認

- [ ] 是否正式採用 Allure 作為團隊統一報告（目前 `elf-e2e` 預設仍為 Playwright HTML）
- [ ] 報告發布方式：CI artifact（目前規定）、GitHub Pages、或 Allure Service
- [ ] Quality gate 門檻（允許失敗數 / 比例）與是否 fast-fail
- [ ] Known issues 的來源與設定方式
- [ ] 趨勢歷史 `allure-history.jsonl` 的保存方式（artifact / cache / 入版控）
- [ ] 多環境（dev / staging / prod）報告是否需要分開產出或合併
- [ ] `allure`（3.18.0）、`allure-playwright` / `allure-vitest`（3.12.2）、`Allure.Xunit`（2.15.0）版本是否納入 `elf-stack` 定本（2026-09 查得最新版）
- [ ] Python（pytest）等非團隊主力框架的 adapter 範本是否需要

## 參考

- 官方文檔：https://allurereport.org/docs/v3/
- Demo：https://demo.allurereport.org
- GitHub：https://github.com/allure-framework/allure3

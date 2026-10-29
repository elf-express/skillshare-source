---
name: elf-stack
description: |
  Elf Express 技術堆疊版本的唯一真實來源（single source of truth），規定每個工具的版本與在 repo 中的釘選方式。
  當任務涉及建立新專案、新增或升級套件 / SDK / runtime、撰寫 global.json、.nvmrc、package.json 的 engines 或
  packageManager、Directory.Packages.props、docker image tag、CI 的 setup-* 版本，或需要回答「團隊用哪一版」時觸發。
metadata:
  version: 1.1.0
  owner: Elf Express
---

# Elf Express 技術堆疊版本（elf-stack）

本 skill 是版本號的**唯一來源**。其他 skill（elf-dotnet、elf-sqlsugar、elf-postgresql、elf-vue、
elf-cicd-backend…）只引用這張表，不自行寫版本號。表上沒有的東西，AI **不得自行決定版本**。

版本依據：參考專案 `TypingTrainer`（2026-09 實際檔案）＋團隊已決議事項；lint／format／TS 工具鏈依 E-426（2026-10-25）查證更新。
參考專案與團隊標準不一致的地方，在表中以「參考專案現況」註明。

## 1. 何時使用

- 建立新 repo / 新專案骨架，需要寫版本釘選檔。
- 新增套件、升級套件、升級 SDK / runtime / docker image。
- 撰寫 CI（`actions/setup-node`、`actions/setup-dotnet`、`dtolnay/rust-toolchain`）的版本參數。
- 使用者或其他 skill 問「團隊用哪一版 X」。

## 2. 固定規則

1. **MUST** 以本表為準。其他文件、README、舊專案與本表衝突時，以本表為準，並回報衝突。
2. **MUST** 每個版本都用表中「釘選方式」寫進 repo，不可只寫在 README 或口頭約定。
3. **MUST NOT** 在沒有使用者明確要求的情況下升級任何版本（包含「順手」升級 patch）。
4. **MUST NOT** 使用表中標為「待確認」的值作為最終決定；遇到時照「暫定值」寫，並在 PR / 回覆中列出。
5. **MUST** .NET 套件版本集中在 `Directory.Packages.props`；`.csproj` 內的 `<PackageReference>` **不得**帶 `Version=`。
6. **MUST** Node 專案 commit lockfile；CI 以 frozen lockfile 安裝（`pnpm install --frozen-lockfile`）。
7. **MUST NOT** 使用 `latest`、`*`、浮動 docker tag（如 `postgres:latest`）。
8. 升級流程見第 6 節：**先改本表，再改專案**。
9. **MUST** 範本與文件中的 `uses:` 一律釘 40 碼 commit SHA 並在行尾註解版本，SHA 與版本逐字取自 3.5 節對照表；升版先改本表再改範本。WHY：tag 可被改指；tj-actions/changed-files 於 2025-03 被改指 tag，外洩使用者 CI secrets（CVE-2025-30066，`gh api advisories/GHSA-mrrh-fwg8-r2c3`）；elf-cicd-desktop 的 release.yml 把自動更新簽章金鑰交給未釘的 action（E-302 稽核）。證據見 `references/simplification-evidence.md` E1–E3。
10. **MUST NOT** 把 `uses:` 改回 `@vN`／`@stable`／分支名，或新增未列在 3.5 對照表的 action。WHY：同規則 9。
11. **MUST** 下游 repo 啟用 Dependabot 的 `package-ecosystem: github-actions` 更新。WHY：釘 SHA 後 action 的安全修補不會自動進來，沒有更新機制等於把舊版凍結。Dependabot 對 SHA 釘選發 PR 並同步更新同一行的版本註解（GitHub 官方文件已確認，連結見 `references/simplification-evidence.md`）。下游 `dependabot.yml` 的 `github-actions` 區塊 **MUST** 忽略主版本升級：`ignore: - dependency-name: "*"` 加 `update-types: ["version-update:semver-major"]`（寫法同 `mcp/elf-mcp-gateway` 的 `semver-major` ignore）。WHY：規則 3 禁止未經明確要求就升級，主版本升級要先改 3.5 對照表（見 6）再動專案，Dependabot 不該自行跨主版本。主版本升級不是永遠不做：要開單、規劃後再升，否則舊的主版本總有一天會停止提供安全修補。下游 repo 收到 Dependabot PR 就是通知：先更新 3.5 節，3.5 與該 PR 的 SHA／版本一致後才可合併；團隊不採用該版本就關閉 PR。

## 3. 版本表

### 3.1 Runtime / SDK / 基礎設施

| 項目 | 版本 | 釘選方式 | 備註 |
|------|------|----------|------|
| Node.js | **24.18** | `.nvmrc`（內容 `24.18`）＋ `package.json` `"engines": { "node": ">=24.18" }` ＋ `pnpm-workspace.yaml` `engineStrict: true` | 參考專案用 npm，以 `.npmrc` `engine-strict=true` 達成；新專案改由 `pnpm-workspace.yaml` 設定，`.npmrc` 只放 registry / auth |
| pnpm | **11.x**（暫定）「待確認：11.x 或 12」 | `package.json` `"packageManager": "pnpm@<PNPM_VERSION>"`（完整版號）；CI 用 `pnpm/action-setup`（不寫 `version:`，讀 `packageManager`）；Docker 用 `npm install -g pnpm@${PNPM_VERSION}`。**不使用 corepack** | 參考專案仍用 npm（`package-lock.json`）；新專案用 pnpm |
| .NET SDK | **10.0**（feature band「待確認」） | repo 根目錄 `global.json`：`"version": "10.0.100"`, `"rollForward": "latestFeature"` | CI 以 `global-json-file: global.json` 讀取 |
| .NET TFM | **net10.0** | `server/Directory.Build.props` 的 `<TargetFramework>net10.0</TargetFramework>` | 參考專案寫在每個 csproj；新專案集中 |
| ASP.NET Core 套件 | **10.0.12** | `Directory.Packages.props`（`Microsoft.AspNetCore.OpenApi` 等） | 取自參考專案 |
| PostgreSQL | **18** | docker image `postgres:18`（compose 與 Testcontainers 用相同 tag） | 參考專案用 SQLite；團隊標準改 PostgreSQL，見 elf-postgresql |
| SqlSugarCore | **5.1.4.x**（參考專案 `5.1.4.221`；確切 minor「待確認」） | `Directory.Packages.props` `<PackageVersion Include="SqlSugarCore" Version="5.1.4.221" />` | 見 elf-sqlsugar |
| Npgsql | 由 SqlSugarCore 5.1.4.221 間接帶入 **5.0.18** | 不直接引用（是否顯式升級「待確認」） | 見 elf-postgresql 的時間欄位說明 |
| Rust | **stable** | CI：`dtolnay/rust-toolchain`（SHA 見 3.5）；`Cargo.toml` `rust-version = "1.77.2"`（MSRV）、`edition = "2021"` | 參考專案無 `rust-toolchain.toml`；是否加「待確認」 |

### 3.2 前端 / 桌面（取自參考專案 `apps/package.json`、`src-tauri/Cargo.toml`）

| 項目 | 版本（range） | lockfile 實際解析 | 釘選方式 |
|------|---------------|-------------------|----------|
| Vue | `^3.5.13` | 3.5.43 | `package.json` dependencies ＋ lockfile |
| Vite | `^6.4.3` | 6.4.3 | devDependencies ＋ lockfile |
| @vitejs/plugin-vue | `^6.0.9` | — | devDependencies |
| TypeScript | `^6.0.3` | —（目標；現況見 3.6） | devDependencies ＋ lockfile；受 typescript-eslint `<6.1.0` 限制 |
| vue-tsc | `^3.3.13` | —（目標；BasicApp 例外見 3.6） | devDependencies ＋ lockfile |
| Pinia | `^2.2.6` | — | dependencies |
| vue-router | `^4.4.5` | — | dependencies |
| vue-i18n | `^11.4.16` | — | dependencies |
| Vitest | `^5.0.1` | — | devDependencies |
| @playwright/test | `^1.63.0` | — | 根 `package.json` devDependencies |
| eslint-plugin-vue | `^10.11.1` | 10.11.1 | 根 `package.json` devDependencies ＋ lockfile |
| globals | `^17.13.0` | 17.13.0 | 根 `package.json` devDependencies ＋ lockfile |
| Tauri CLI（@tauri-apps/cli） | `^2.11.4` | 2.11.4 | 根 `package.json` devDependencies |
| @tauri-apps/api | `^2.11.1` | — | dependencies |
| tauri（Rust crate） | `"2"` | `Cargo.lock` | `src-tauri/Cargo.toml` ＋ commit `Cargo.lock` |
| tauri-build | `"2"` | `Cargo.lock` | `[build-dependencies]` |
| ant-design-vue | `^4.2.6` | — | dependencies（`apps/package.json`） |

> UI 元件庫（已決議）：**ant-design-vue 4** 是團隊標準。既有 SoybeanAdmin / NaiveUI repo 屬歷史例外，依該 repo 自己的 CLAUDE.md；AI 不得在任何 repo 自行替換 UI 庫。

> eslint-plugin-vue 10 與 globals（E-415 補入，取自 ELF.Studio v0.1.1）：v10 的 flat config 不再提供 v9 給的 browser globals，也不再把 `globals` 列為自己的相依，所以用 v10 的 repo 必須自己裝 `globals` 並在 `eslint.config.js` 供應（`.vue` 用 `globals.browser`、Node 腳本用 `globals.node`）；`.ts` 不受影響，typescript-eslint 的 `eslint-recommended` 對 TS 檔關掉 `no-undef`。v10 另宣告 `postcss-selector-parser: ^7.1.4`，這是 ELF.Studio 升到 v10 的原因（6.x 線沒有 GHSA-rj75-hqrm-r3gf 的修補版）。
> 上段是直接組裝設定時的責任；採 3.6 的 antfu 組合時，`globals`、Vue plugin 與 parser 由 preset 帶入。設定檔若自行 import 套件，仍須直接宣告相依，不能依賴 pnpm 未公開的間接相依。

### 3.3 .NET 測試（團隊已決議：`server/tests/<Project>.Tests/`、整合測試 `server/tests/<App>.Api.IntegrationTests/`、xUnit、`coverlet.msbuild`、合併後 line 55% 強制 / branch 50% 建議）

| 套件 | 版本 | 釘選方式 |
|------|------|----------|
| xunit | 2.9.3 | `Directory.Packages.props` |
| xunit.runner.visualstudio | 3.1.4 | `Directory.Packages.props` |
| Microsoft.NET.Test.Sdk | 17.14.1 | `Directory.Packages.props` |
| coverlet.msbuild | 6.0.4 | `Directory.Packages.props`（**不用** `coverlet.collector` / `--collect:"XPlat Code Coverage"`） |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.12 | `Directory.Packages.props`（與 ASP.NET Core 套件同版） |
| Testcontainers.PostgreSql | 4.15.0 | `Directory.Packages.props`（整合測試用，見 elf-integration） |

覆蓋率指令（門檻看**所有測試專案合併後**的總覆蓋率，不要求每個測試專案單獨達 55%；多個測試專案時的報告合併寫法由 elf-cicd-backend 擁有）：

```bash
dotnet test server/<App>.slnx -c Release \
  -p:CollectCoverage=true -p:Threshold=55 -p:ThresholdType=line -p:ThresholdStat=total
```

### 3.4 MCP server（Node / TypeScript，elf-mcp-server 範本）

| 項目 | 版本（range） | lockfile 實際解析 | 釘選方式 |
|------|---------------|-------------------|----------|
| express-rate-limit | `^8.7.1` | 8.7.1 | `elf-mcp-server` 範本 `templates/package.json` dependencies ＋ lockfile |

### 3.5 GitHub Actions 釘選（commit SHA）

`uses:` 一律寫 40 碼 commit SHA，行尾以 `# <版本>` 註解版本；SHA 與版本以本表為準（規則 9–11）。SHA 取得方式：`gh api repos/<owner>/<repo>/commits/<版本> --jq .sha`（取 commit，不取 annotated tag 物件）。

| Action | 版本 | Commit SHA | 備註 |
|--------|------|------------|------|
| `actions/checkout` | v5.1.0 | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` |  |
| `actions/setup-dotnet` | v5.4.0 | `26b0ec14cb23fa6904739307f278c14f94c95bf1` |  |
| `actions/setup-node` | v5.0.0 | `a0853c24544627f65ddf259abe73b1d18a591444` |  |
| `actions/upload-artifact` | v5.0.0 | `330a01c490aca151604b8cf639adc76d48f6c5d4` |  |
| `actions/download-artifact` | v5.0.0 | `634f93cb2916e3fdff6788551b99b062d0335ce0` | 只出現在 elf-allure-report 的說明文字（沒有 `uses:` 行），validate.sh 對它報「未使用」警告是預期的 |
| `anthropics/claude-code-action` | v1.0.252 | `f27be6b65a4652f08a2ba3cff79114829b588967` |  |
| `docker/build-push-action` | v6.19.2 | `10e90e3645eae34f1e60eeb005ba3a3d33f178e8` |  |
| `docker/login-action` | v3.7.0 | `c94ce9fb468520275223c153574b00df6fe4bcc9` |  |
| `docker/setup-buildx-action` | v3.12.0 | `8d2750c68a42422c14e847fe6c8ac0403b4cbd6f` |  |
| `pnpm/action-setup` | v4.4.0 | `fc06bc1257f339d1d5d8b3a19a8cae5388b55320` |  |
| `Swatinem/rust-cache` | v2.9.2 | `6323deb102c322ba6fcbdcafc7e3dddab59af2b6` |  |
| `tauri-apps/tauri-action` | v0.6.2 | `84b9d35b5fc46c1e45415bdb6144030364f7ebc5` |  |
| `dtolnay/rust-toolchain` | master@2026-10-16 | `683b588c487a69d01f6c6ddf40f036ff682cc2c8` | 需人工更新：釘的是分支 commit，Dependabot 可能只把 SHA 升到最新 commit 而不更新 `master@<日期>` 註解（證據 E4），日期與 SHA 要人工核對 |

### 3.6 lint／format 工具鏈（E-426，2026-10-25）

**目標是完整採用 `@antfu/eslint-config`**，由 ESLint／preset 管理 JS／TS／Vue、JSON／JSONC、YAML／TOML 等，CSS／HTML／Markdown 等依需要啟用 `formatters`，逐副檔名驗證覆蓋；不是只加 `eslint-plugin-format`。新版本取查證當日最新穩定版，不採 beta／RC；TS 與 Node 型別的相容例外見下方。表列值是**目標版本**，不是兩個產品已安裝或已通過 CI 的宣告。

| 套件 | 版本（range） | 釘選方式／適用範圍 |
|------|---------------|-------------------|
| eslint | `^10.13.0` | 工具鏈所在 workspace 的 devDependencies ＋ lockfile |
| @antfu/eslint-config | `^10.0.0` | devDependencies ＋ lockfile；完整 preset |
| eslint-plugin-format | `^2.0.1` | devDependencies ＋ lockfile；啟用外部 formatters 時直接安裝的 optional peer |
| typescript-eslint | `^8.72.0` | 手動組裝設定才直接裝；antfu 透過 `@typescript-eslint/parser`／`eslint-plugin` 的 `^8.72.0` 帶入，不重疊啟用兩套 recommended |
| eslint-plugin-vue | `^10.11.1` | antfu 間接帶入並由 lockfile 固定；自行 import 時直接宣告（同 3.2） |
| vue-eslint-parser | `^10.4.1` | antfu 間接帶入並由 lockfile 固定；自行 import 時直接宣告 |
| globals | `^17.13.0` | antfu 間接帶入並由 lockfile 固定；自行 import 時直接宣告（同 3.2） |
| @types/node | `^24.19.2` | devDependencies ＋ lockfile；跟隨 3.1 的 Node 24，不採最新主版 26 的 API 型別 |
| @eslint/js | `^10.0.1` | 手動組裝 JS recommended 才直接裝；完整 antfu 目標不額外疊加 |
| prettier | `^3.9.10` | 過渡期獨立 CLI 才直接裝；完整 antfu 目標不另跑 CLI，plugin 內部使用 formatter 不等於另一套 CLI |
| eslint-config-prettier | `^10.1.8` | 過渡期手動 ESLint＋Prettier 組合使用；遷到完整 antfu 後移除 |

pnpm catalog 專案把 range 集中在 `pnpm-workspace.yaml`，使用端寫 `catalog:`；非 catalog 專案寫 `package.json`，都必須提交 lockfile。BasicApp 目前忽略 lockfile 是待 E-428 修正的 repo 例外，不能當成此規則的永久豁免。間接套件由 preset 與 lockfile 固定，不為湊表列套件而全部加成直接相依。

**已核對的相容組合與上限**

- `typescript-eslint` 的 ESLint peer 支援 `^8.57.0 || ^9.0.0 || ^10.0.0`，TypeScript 支援 `>=4.8.4 <6.1.0`。因此 3.2 的 TS 維持 `^6.0.3`，即使 registry 最新穩定為 TS 7，也不能直接升；antfu 內部同樣受這個上限限制。**解除條件**：typescript-eslint 穩定版正式支援 TS 7，重新確認 antfu／parser／vue-tsc 組合、更新本表，再由產品另單驗證。
- `^6.0.3` 是已決定的宣告 range，**本身仍允許 6.1+，不等於 `<6.1.0` 的保證**。MUST 在每次產生／更新 lockfile 時檢查實際 TypeScript 解析值仍 `<6.1.0`，CI 使用 frozen lockfile；解析越界就停止更新並回報，不關閉 peer／不支援版本檢查來通過。WHY：保留核准 range 的同時，必須由 lockfile 驗證守住目前支援上限。
- antfu 的 ESLint peer 支援 `^9.10.0 || ^10.0.0`；Vue plugin／parser 與 format plugin 都支援 ESLint 10；vue-tsc 的 peer 要求 TS `>=5.0.0`。ESLint 10 的 Node 要求 `^20.19.0 || ^22.13.0 || >=24`，涵蓋 3.1 的 Node 24.18。
- Peer／engine 範圍相容只是遷移前提，**不是產品驗收**。ESLint 10 改變 config 查找方式與 recommended 規則；antfu 的規則集也不同，必須在產品 PR 核對 lint 範圍、規則、formatter 的副檔名覆蓋及 CI。

**repo 過渡例外（只保留現況，不要求降版或在本單遷移）**

| repo | 例外與理由 | 收斂條件 |
|------|------------|----------|
| ELF.Studio | 目前 ESLint 9＋手動 recommended＋Prettier；TS `^5.6.3`、vue-tsc `^2.1.10`。既有 CI 與 repo 專屬規則需整組遷移，不能只升 ESLint 或只換 formatter | 另單遷到完整 antfu 與本表工具鏈；保留 schema UI 中立守門、SFC 樣式限制、browser／node globals 的語意與工作區 ignores；根目錄納入 lint 且 0 錯誤 0 警告，typecheck／測試／build／E2E 通過；全庫排版獨立 commit |
| ELF.BasicApp `frontend` | antfu `^9.5.1`、ESLint `^10.12.0`；`formatters` 啟用 CSS／HTML，但獨立 Prettier CLI 仍處理 JSON／CSS／HTML／MD，尚未完整收斂；Node 型別為 `^26.6.4`。另外固定 vue-tsc `3.3.11` 避開模板誤報，override TS ESLint plugin `8.71.0` 避開 `.mjs` no-unused-vars 誤報；lint 入口先跑 oxlint 再跑 ESLint；lockfile 被忽略，解析值只是本機快照 | 另單對齊 antfu 與 ESLint，保留 oxlint 先行守門並確認規則分工；提交 lockfile 並驗證 frozen install；盤點各副檔名由單一入口處理，確認 Node runtime／型別一致；重現並驗證兩項誤報已由穩定版修復、typecheck／lint／測試／build 通過，才解除固定版與 override；不因 latest 存在就移除例外 |

完整盤點（含 range、lockfile、registry、逐項建議與代價）、上游連結及重現指令見 [查證紀錄](references/lint-format-e426.md)。產品跟進：ELF.Studio 為 [E-427](https://linear.app/elf-express/issue/E-427)，ELF.BasicApp 為 [E-428](https://linear.app/elf-express/issue/E-428)；vue-i18n 已由 E-21 依安全性修補（GHSA-83rm-6c8r-g728、GHSA-8rc2-428q-7ww3）決議升為 `^11.4.16`，E-22 補登於 3.2；Vite／Pinia／vue-router 等執行期仍由 [E-429](https://linear.app/elf-express/issue/E-429) 決策，3.2 的這些列維持原值。

**生效與交接**：本次只送 PR 到 `dev`。合併後 E-426 維持「驗證中」，留待 E-391 群組完成，由該批獨立發版審計員核對候選 SHA／CI、快轉 `release`／`main`，並在停於 `release` 的 source 執行 pull／sync、確認各 AI 工具讀到新版後留下證據，才具備結案條件。E-426 實作者不執行發版或實際同步；本 worktree 的隔離 config、`targets: {}` 與 dry-run 只驗證內容，不代表規範已派發。

## 4. 標準範本

### 4.1 repo 根目錄檔案

`.nvmrc`
```
24.18
```

`pnpm-workspace.yaml`（片段）
```yaml
# Refuse to install on an unsupported Node instead of warning.
engineStrict: true
```

`.npmrc`：只放 registry / auth 設定（不放 `engine-strict`）。

`package.json`（根目錄片段）
```json
{
  "private": true,
  "type": "module",
  "packageManager": "pnpm@<PNPM_VERSION>",
  "engines": {
    "node": ">=24.18"
  }
}
```
> `<PNPM_VERSION>` 替換為完整版號（例如撰寫時本機的 `11.26.0`）；團隊確切版號「待確認」。

`global.json`（放 repo 根目錄，讓 `server/`（含 `server/tests/`）、CI 全部解析到同一個 SDK）
```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```

### 4.2 `server/Directory.Build.props`

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>
</Project>
```

### 4.3 `server/Directory.Packages.props`

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <!-- Web -->
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.12" />
    <!-- Data -->
    <PackageVersion Include="SqlSugarCore" Version="5.1.4.221" />
    <!-- Tests -->
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageVersion Include="xunit" Version="2.9.3" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="3.1.4" />
    <PackageVersion Include="coverlet.msbuild" Version="6.0.4" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.12" />
    <PackageVersion Include="Testcontainers.PostgreSql" Version="4.15.0" />
  </ItemGroup>
</Project>
```

csproj 中只寫：
```xml
<PackageReference Include="SqlSugarCore" />
```

### 4.4 docker compose（本機 PostgreSQL）

```yaml
services:
  postgres:
    image: postgres:18
```
本機開發 compose 見 elf-postgresql（`docker/docker-compose.dev.yml`）；部署 compose 見 elf-cicd-docker（`docker/docker-compose.yml`）。兩者服務名都是 `postgres`，帳密都來自 `docker/.env`。

### 4.5 CI 片段（詳見 elf-cicd-backend）

```yaml
- uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0 (no `version:`; reads packageManager)
- uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
  with:
    node-version-file: .nvmrc
    cache: pnpm
- uses: actions/setup-dotnet@26b0ec14cb23fa6904739307f278c14f94c95bf1 # v5.4.0
  with:
    global-json-file: global.json
- uses: dtolnay/rust-toolchain@683b588c487a69d01f6c6ddf40f036ff682cc2c8 # master@2026-10-16
  with:
    toolchain: stable
```

## 5. 檢查清單

- [ ] repo 根目錄有 `.nvmrc`（`24.18`）、`global.json`；`pnpm-workspace.yaml` 有 `engineStrict: true`；`.npmrc` 只有 registry / auth
- [ ] 根 `package.json` 有 `engines.node` 與 `packageManager`（完整版號）
- [ ] lockfile（`pnpm-lock.yaml` / `Cargo.lock`）已 commit
- [ ] `server/Directory.Packages.props` 存在且 `ManagePackageVersionsCentrally=true`
- [ ] 所有 `.csproj` 的 `<PackageReference>` 都沒有 `Version=`
- [ ] 所有 `.csproj` 沒有自己寫 `<TargetFramework>`（統一由 `Directory.Build.props` 提供）
- [ ] docker image tag 為 `postgres:18`，不是 `latest`
- [ ] CI 的 Node / .NET 版本來自 `.nvmrc` / `global.json`，不是寫死在 yml；`uses:` 皆為 3.5 對照表的 SHA＋版本註解
- [ ] 測試專案用 `coverlet.msbuild`，沒有 `coverlet.collector`
- [ ] 沒有任何 `corepack enable`
- [ ] 新增的套件版本已先加到本表（或已在 PR 註明「待加入 elf-stack」）
- [ ] lint／format 採 3.6 的完整 antfu 組合，或列明 repo 過渡例外、理由與收斂驗證；TS 未超過 typescript-eslint 支援上限

## 6. 升級政策

1. **決策者**：「待確認」（建議：後端 / 前端 Tech Lead 各自負責其領域，跨領域如 Node / .NET 大版本由團隊會議決定）。
2. **順序**：先開 PR 修改本 skill 的版本表（附升級理由、breaking changes 摘要、影響的 repo）→ 合併後各 repo 再各自開 PR 升級。
3. **範圍**：
   - patch：可由任一成員提出，更新本表後直接套用。
   - minor：需 Tech Lead 核准。
   - major（例如 .NET 10→11、PostgreSQL 18→19、Vite 6→7）：需團隊決議並安排遷移計畫。
4. **AI 行為**：AI 代理**只能在使用者明確要求時**升級；升級時必須同時更新本表（或提醒使用者更新本表）。
5. **安全性修補**：有 CVE 時可先升級專案再補本表，但須在同一週內補齊。

## 7. 常見錯誤

| 錯誤 | 正確 |
|------|------|
| csproj 寫 `<PackageReference Include="SqlSugarCore" Version="5.1.4.221" />` | 版本放 `Directory.Packages.props`，csproj 不帶 `Version` |
| `packageManager: "pnpm@11"` | 寫完整版號 `pnpm@<PNPM_VERSION>`（如 `pnpm@11.26.0`），`pnpm/action-setup` 與 Docker 安裝都靠它 |
| CI / Dockerfile 寫 `corepack enable` | CI 用 `pnpm/action-setup`；Docker 用 `npm install -g pnpm@${PNPM_VERSION}` |
| 測試專案引用 `coverlet.collector`、用 `--collect:"XPlat Code Coverage"` | `coverlet.msbuild` ＋ `-p:CollectCoverage=true -p:Threshold=55 ...` |
| CI 寫 `dotnet-version: '10.0.x'` 而 repo 沒有 `global.json` | 加 `global.json`，CI 用 `global-json-file` |
| `image: postgres` 或 `postgres:latest` | `postgres:18` |
| 只有 `engines`，沒有 `engineStrict: true` | 沒有 engine-strict 時 engines 只是警告（參考專案的 `.npmrc` 已註明此坑）；新專案寫在 `pnpm-workspace.yaml` |
| AI 看到新版就順手升級 | 只在使用者要求時升級，且先更新本表 |

## 8. 待確認

- pnpm 主版本：11.x 或 12；確切版號（`packageManager` 需要完整版號）。
- .NET SDK feature band（`global.json` 的 `version` 最低值，目前暫定 `10.0.100` + `latestFeature`）。
- SqlSugarCore 確切 minor（參考專案 5.1.4.221）。
- 是否顯式引用較新版 Npgsql（取代 SqlSugarCore 間接帶入的 5.0.18）。
- PostgreSQL docker tag 是否釘到 minor（例如 `postgres:18.x`）或 OS 變體（`-bookworm` / `-alpine`）。
- Rust 是否加 `rust-toolchain.toml` 釘選特定 stable 版本。
- 版本升級的決策者名單。
- ELF.Studio／ELF.BasicApp 的 3.6 過渡例外，須由各 repo 後續 PR 驗證才能解除；本表的 peer 查證不代替實跑。

## 9. 禁止簡化

- 不得把「最新穩定版」簡化成無條件跟 registry latest：TS 上限與 Node 型別必須一起核對相容性。
- 不得把完整 antfu 目標簡化成只裝 format plugin，或省略非 JS 副檔名、repo 專屬規則與 CI 的遷移驗證。
- 不得因表已更新而抹掉產品過渡例外；解除條件未驗證前保留理由與追蹤。
- 不得把 `dev` 合併或 dry-run 成功當成已發版、已同步或 E-426 可結案的證據。

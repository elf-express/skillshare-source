---
name: elf-stack
description: |
  Elf Express 技術堆疊版本的唯一真實來源（single source of truth），規定每個工具的版本與在 repo 中的釘選方式。
  當任務涉及建立新專案、新增或升級套件 / SDK / runtime、撰寫 global.json、.nvmrc、package.json 的 engines 或
  packageManager、Directory.Packages.props、docker image tag、CI 的 setup-* 版本，或需要回答「團隊用哪一版」時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 技術堆疊版本（elf-stack）

本 skill 是版本號的**唯一來源**。其他 skill（elf-dotnet、elf-sqlsugar、elf-postgresql、elf-vue、
elf-cicd-backend…）只引用這張表，不自行寫版本號。表上沒有的東西，AI **不得自行決定版本**。

版本依據：參考專案 `TypingTrainer`（2026-09 實際檔案）＋團隊已決議事項。
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
| Rust | **stable** | CI：`dtolnay/rust-toolchain@stable`；`Cargo.toml` `rust-version = "1.77.2"`（MSRV）、`edition = "2021"` | 參考專案無 `rust-toolchain.toml`；是否加「待確認」 |

### 3.2 前端 / 桌面（取自參考專案 `apps/package.json`、`src-tauri/Cargo.toml`）

| 項目 | 版本（range） | lockfile 實際解析 | 釘選方式 |
|------|---------------|-------------------|----------|
| Vue | `^3.5.13` | 3.5.43 | `package.json` dependencies ＋ lockfile |
| Vite | `^6.4.3` | 6.4.3 | devDependencies ＋ lockfile |
| @vitejs/plugin-vue | `^6.0.9` | — | devDependencies |
| TypeScript | `^5.6.3` | 5.9.3 | devDependencies ＋ lockfile |
| vue-tsc | `^2.1.10` | — | devDependencies |
| Pinia | `^2.2.6` | — | dependencies |
| vue-router | `^4.4.5` | — | dependencies |
| vue-i18n | `^10.0.5` | — | dependencies |
| Vitest | `^5.0.1` | — | devDependencies |
| @playwright/test | `^1.63.0` | — | 根 `package.json` devDependencies |
| Tauri CLI（@tauri-apps/cli） | `^2.11.4` | 2.11.4 | 根 `package.json` devDependencies |
| @tauri-apps/api | `^2.11.1` | — | dependencies |
| tauri（Rust crate） | `"2"` | `Cargo.lock` | `src-tauri/Cargo.toml` ＋ commit `Cargo.lock` |
| tauri-build | `"2"` | `Cargo.lock` | `[build-dependencies]` |
| ant-design-vue | `^4.2.6` | — | dependencies（`apps/package.json`） |

> UI 元件庫（已決議）：**ant-design-vue 4** 是團隊標準。既有 SoybeanAdmin / NaiveUI repo 屬歷史例外，依該 repo 自己的 CLAUDE.md；AI 不得在任何 repo 自行替換 UI 庫。

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
- uses: pnpm/action-setup@v4      # no `version:`; reads packageManager
- uses: actions/setup-node@v5
  with:
    node-version-file: .nvmrc
    cache: pnpm
- uses: actions/setup-dotnet@v5
  with:
    global-json-file: global.json
- uses: dtolnay/rust-toolchain@stable
```

## 5. 檢查清單

- [ ] repo 根目錄有 `.nvmrc`（`24.18`）、`global.json`；`pnpm-workspace.yaml` 有 `engineStrict: true`；`.npmrc` 只有 registry / auth
- [ ] 根 `package.json` 有 `engines.node` 與 `packageManager`（完整版號）
- [ ] lockfile（`pnpm-lock.yaml` / `Cargo.lock`）已 commit
- [ ] `server/Directory.Packages.props` 存在且 `ManagePackageVersionsCentrally=true`
- [ ] 所有 `.csproj` 的 `<PackageReference>` 都沒有 `Version=`
- [ ] 所有 `.csproj` 沒有自己寫 `<TargetFramework>`（統一由 `Directory.Build.props` 提供）
- [ ] docker image tag 為 `postgres:18`，不是 `latest`
- [ ] CI 的 Node / .NET 版本來自 `.nvmrc` / `global.json`，不是寫死在 yml；`actions/*` 一律 v5
- [ ] 測試專案用 `coverlet.msbuild`，沒有 `coverlet.collector`
- [ ] 沒有任何 `corepack enable`
- [ ] 新增的套件版本已先加到本表（或已在 PR 註明「待加入 elf-stack」）

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

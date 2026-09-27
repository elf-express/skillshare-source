---
name: elf-cicd-backend
description: |
  Elf Express .NET 10 後端 CI 規範（restore / build / test + coverlet.msbuild 合併行覆蓋率 55% 門檻 + Testcontainers PostgreSQL 18）。
  當任務涉及新增或修改 .github/workflows/ci.yml 的 server job、global.json 釘 SDK、
  dotnet test 覆蓋率門檻、coverlet 設定、測試專案 csproj、CI 整合測試（Testcontainers）需要 PostgreSQL，
  或 .NET 測試在 CI 失敗時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 後端 CI（elf-cicd-backend）

> 本 skill 只管 `ci.yml` 裡的 `server` job 與 .NET 端的釘版 / 覆蓋率設定。
> 檔頭（`name` / `on`）與 `web` / `e2e` job 見 **elf-cicd-frontend**；
> PR AI 審查見 **elf-cicd-review**；版號（含 csproj `<Version>`）見 **elf-cicd-versioning**；
> 測試寫法見 **elf-unit** / **elf-integration**；SqlSugar 用法見 **elf-sqlsugar**；NuGet 版本見 **elf-stack**。

## 1. 何時使用

- 建立或修改 `ci.yml` 的 `server` job
- 新增 .NET 測試專案、調整 coverlet / 覆蓋率門檻
- 新增 `global.json` 或升級 .NET SDK
- 整合測試需要真的 PostgreSQL（Testcontainers，fixture 由 elf-integration 負責）
- `dotnet test` 本機綠、CI 紅

## 2. 固定規則

**SDK 釘版**

1. MUST 在 repo 根目錄放 `global.json`，`sdk.version` 為 10.0 的 SDK、`rollForward: latestFeature`（見 `templates/global.json`）。
   為什麼：沒有 global.json，每台機器用它裝過最新的 SDK，編譯結果與分析器警告會不同。
2. MUST 在 CI 用 `actions/setup-dotnet@v5` + `global-json-file: global.json`。MUST NOT 用 `dotnet-version:`（不論 `10.0.x`、`latest` 或其他）。
   為什麼：SDK 版本只能有一個來源；改 `global.json`，CI 就跟著改。
3. MUST NOT 在 `global.json` 加 `"test": { "runner": "Microsoft.Testing.Platform" }`。
   為什麼：本規範的覆蓋率門檻靠 coverlet.msbuild 掛在 VSTest 流程上，切換 runner 後 coverlet 不再插樁，門檻會「靜默消失」。
4. MUST 所有 `actions/*`（checkout / setup-dotnet / upload-artifact …）統一用 `@v5`。

**方案與目錄**

5. MUST 使用單一方案檔 `server/<AppName>.slnx`，CI 的 restore / build / test 全部指向它。
   為什麼：指向單一專案會漏掉其他測試專案；新增的測試專案沒加進 `.slnx` 就等於沒跑。
6. MUST 主專案放 `server/src/<Project>/`（API 為 `server/src/<AppName>.Api/`）；單元測試放 `server/tests/<Project>.Tests/`，一個主專案對應一個 `<Project>.Tests`（見 elf-unit）。
   整合測試（需要 Docker，含 contract / `WebApplicationFactory` 測試）MUST 放在獨立的 `server/tests/<AppName>.Api.IntegrationTests/`（見 elf-integration）。
7. MUST 新增測試專案後立刻加入 `.slnx`（`dotnet sln server/<AppName>.slnx add server/tests/<Project>.Tests/<Project>.Tests.csproj`）。
8. 測試 `.csproj` MUST 遵守 Central Package Management：`PackageReference` MUST NOT 帶 `Version=`（版本統一在 `server/Directory.Packages.props`），MUST NOT 自訂 `TargetFramework`（繼承 `server/Directory.Build.props`）。見 `templates/Project.Tests.csproj`。

**步驟順序（固定）**

9. MUST 依序：`dotnet restore` → `dotnet build --no-restore -c Release` → `dotnet test --no-build -c Release` → 合併覆蓋率門檻檢查。
   為什麼：分開幾步才看得出是哪一段壞；`--no-restore` / `--no-build` 保證測的就是剛剛 build 出來的那份 Release 產物。

**覆蓋率（本規範選定：coverlet.msbuild + MSBuild 屬性，門檻套在「合併後」的整體）**

10. MUST 在每個測試專案參考 `coverlet.msbuild`，並移除 `dotnet new xunit` 預設帶入的 `coverlet.collector`。
11. MUST 以 solution 層級跑一次 `dotnet test`，帶 `-p:CollectCoverage=true`，並用 `MergeWith` + `-m:1` 把所有測試專案的覆蓋率合併成一份（完整指令見 `templates/ci-server-job.yml` 與 3.2）。
12. MUST 以 `Threshold=55`、`ThresholdType=line`、`ThresholdStat=total` 的語意檢查**合併後**的 `coverage/coverage.cobertura.xml`：整體行覆蓋率 < 55% → CI 紅。
    MUST NOT 要求每個測試專案各自達到 55%。為什麼：單元測試與整合測試量的是同一份程式碼的不同面向，逐專案檢查會讓「加起來夠、各自不夠」的專案永遠紅。
    只有一個測試專案時，可直接在 `dotnet test` 帶 `-p:Threshold=55 -p:ThresholdType=line -p:ThresholdStat=total`（效果相同）；有兩個以上時一律用合併門檻。
13. MUST NOT 把 `branch` 列入門檻。branch 50% 為**建議值**，只由 advisory step 印 `::warning::`。
14. MUST NOT 使用 `coverlet.collector` / `--collect:"XPlat Code Coverage"`。為什麼：它不讀 coverlet.msbuild 的屬性，與 `-p:CollectCoverage=true` 並用還會重複插樁，數字不可信、偶發失敗。
15. MUST NOT 為了過門檻加 `[ExcludeFromCodeCoverage]`、`-p:Exclude=...` 或寫沒有 assert 的測試。排除清單變動必須在 PR 說明理由。

**資料庫（PostgreSQL 18 + SqlSugar 5.x）**

16. 需要真的資料庫的測試 MUST 用 Testcontainers（`postgres:18`，由 elf-integration 的 fixture 啟動）。MUST NOT 在 `ci.yml` 加 `services: postgres`。
    為什麼：同一份 fixture 本機與 CI 行為一致；GitHub `ubuntu-latest` runner 內建 Docker，不需要額外設定。
17. MUST 釘 `postgres:18`，MUST NOT 用 `postgres:latest` / `postgres`。為什麼：新 major 會在沒有 PR 的情況下改變測試行為。
18. 測試用拋棄帳密全團隊統一：user `elf`、password `elf_test_pw`、db `elf_test`；連線字串 MUST 含 `Timezone=UTC`。MUST NOT 放真實密碼或 production 連線字串。
    要改連既有資料庫（例如除錯）時，由 elf-integration 的 `ELF_TEST_PG_CONNECTION` 環境變數切換；CI 範本不設定它。
19. MUST NOT 在 CI 讓測試連外部共用資料庫。每次 job 都是全新空庫，測試自己建表 / 種資料。

**Job 本身**

20. MUST 維持 job id `server`、`name: server (build · tests)`。為什麼：branch protection 的 required check 以 `name` 比對，改名會讓 PR 永遠等不到狀態。
21. MUST NOT 使用 `paths:` 過濾或 `continue-on-error: true`（理由同 elf-cicd-frontend 規則 24、26）。

## 3. 標準範本

| 檔案 | 範本 | 放到 |
|------|------|------|
| server job | [`templates/ci-server-job.yml`](templates/ci-server-job.yml) | 貼到 `.github/workflows/ci.yml` 的 `jobs:` 底下 |
| SDK 釘版 | [`templates/global.json`](templates/global.json) | repo 根目錄 `global.json` |
| 測試專案 | [`templates/Project.Tests.csproj`](templates/Project.Tests.csproj) | `server/tests/<Project>.Tests/<Project>.Tests.csproj` |

`coverlet.msbuild`、`Microsoft.NET.Test.Sdk`、xUnit、`Microsoft.AspNetCore.Mvc.Testing`、`Testcontainers.PostgreSql` 的版本統一寫在 `server/Directory.Packages.props`（見 elf-stack）。

### 3.1 目錄結構

```
global.json
server/
├── <AppName>.slnx
├── Directory.Build.props            ← TargetFramework 等共用屬性
├── Directory.Packages.props         ← 所有 NuGet 版本（CPM）
├── src/
│   └── <AppName>.Api/
│       └── <AppName>.Api.csproj      ← 含 <Version>，由 scripts/version.mjs 改寫
└── tests/
    ├── <AppName>.Api.Tests/                  ← 單元測試
    │   ├── <AppName>.Api.Tests.csproj
    │   └── Services/OrderServiceTests.cs     ← 資料夾結構比照主專案
    └── <AppName>.Api.IntegrationTests/       ← 整合 / contract 測試（需要 Docker）
        └── <AppName>.Api.IntegrationTests.csproj
```

### 3.2 本機重現 CI（與 CI 完全相同的指令）

需要 Docker 執行中（整合測試用 Testcontainers 自己起 `postgres:18`）。

```bash
dotnet restore server/<AppName>.slnx
dotnet build server/<AppName>.slnx --no-restore --configuration Release
rm -rf coverage
dotnet test server/<AppName>.slnx --no-build --configuration Release -m:1 \
  -p:CollectCoverage=true \
  -p:CoverletOutput="$PWD/coverage/" \
  -p:MergeWith="$PWD/coverage/coverage.json" \
  -p:CoverletOutputFormat=\"json,cobertura\"
# 合併後的整體行覆蓋率（門檻 0.55）
grep -o -m1 'line-rate="[0-9.]*"' coverage/coverage.cobertura.xml
```

### 3.3 覆蓋率報告位置

`-p:CoverletOutput` 指到 repo 根目錄的 `coverage/`；每個測試專案跑完都把結果併入 `coverage/coverage.json`，
最後寫出的 `coverage/coverage.cobertura.xml` 就是**所有測試專案合併後**的結果。門檻檢查、advisory branch warning 與 artifact 都只看這一份。
`-m:1` 讓測試專案依序執行，避免多個專案同時寫同一個合併檔。

## 4. 檢查清單

- [ ] repo 根目錄有 `global.json`，`rollForward: latestFeature`，沒有 `test.runner`
- [ ] CI 用 `actions/setup-dotnet@v5` + `global-json-file: global.json`，沒有 `dotnet-version:`
- [ ] 所有 `actions/*` 都是 `@v5`
- [ ] 所有 restore / build / test 都指向 `server/<AppName>.slnx`
- [ ] 單元測試在 `server/tests/<Project>.Tests/`、整合測試在 `server/tests/<AppName>.Api.IntegrationTests/`，且都已加入 `.slnx`
- [ ] 測試 csproj 參考 `coverlet.msbuild`，**沒有** `coverlet.collector`、沒有 `Version=`、沒有自己的 `TargetFramework`
- [ ] `dotnet test` 帶 `CollectCoverage` + `MergeWith` + `-m:1`；門檻檢查看合併後的 `coverage/coverage.cobertura.xml`（line ≥ 55%）
- [ ] 門檻裡沒有 `branch`；branch 只有 advisory warning
- [ ] `ci.yml` 沒有 `services: postgres`；DB 測試走 Testcontainers `postgres:18`
- [ ] 測試帳密為 `elf` / `elf_test_pw` / `elf_test`，連線字串含 `Timezone=UTC`
- [ ] job `name: server (build · tests)` 未變更
- [ ] 本機跑 3.2 的指令全綠，且合併後 line-rate ≥ 0.55
- [ ] 刻意改壞一段被測邏輯，確認測試會紅，再改回來

## 5. 常見錯誤

| 症狀 | 原因 | 修正 |
|------|------|------|
| 覆蓋率明明很低 CI 卻綠 | 用的是 `coverlet.collector`（`--collect`），coverlet.msbuild 的屬性完全沒作用 | 換成 `coverlet.msbuild`（規則 10、14） |
| 覆蓋率門檻突然不生效 | `global.json` 被加了 `test.runner: Microsoft.Testing.Platform` | 移除，維持 VSTest（規則 3） |
| 整體夠、但某個測試專案單獨報 threshold 失敗 | 在多專案的 solution 上直接帶 `-p:Threshold=55`，每個專案各自被檢查 | 改用 `MergeWith` 合併後再檢查（規則 11、12） |
| 合併報告數字忽高忽低 / 檔案損毀 | 沒帶 `-m:1`，多個測試專案同時寫 `coverage.json` | 加 `-m:1` |
| 新測試專案的測試 CI 沒跑 | 沒加進 `server/<AppName>.slnx` | `dotnet sln ... add ...` |
| 整合測試報 Docker 無法連線 | 在沒有 Docker 的 runner（非 Linux / 自架）上執行 | 用 `ubuntu-latest`（內建 Docker）；本機先啟動 Docker |
| `NU1008`（CPM 專案不應定義版本） | 測試 csproj 的 `PackageReference` 帶了 `Version=` | 刪掉 `Version=`，版本放 `Directory.Packages.props` |
| 本機綠、CI 資料庫行為不同 | 本機 Postgres 版本與 CI / production 不同，或用 `latest` | 全部釘 `postgres:18` |
| 時間欄位差 8 小時 | 連線字串沒有 `Timezone=UTC` | 所有連線字串加 `Timezone=UTC` |
| SqlSugar 讀資料時 `Activator.CreateInstance` 丟例外 | Entity 用了 C# `required` 成員（參考專案踩過） | 改用屬性預設值（見 elf-sqlsugar） |
| 測試在 CI 綠、`dotnet run` 卻找不到檔案 | 程式用相對於「目前目錄」的路徑；測試剛好從輸出目錄跑（參考專案踩過） | 改用 `AppContext.BaseDirectory` |
| `dotnet test --no-build` 找不到組件 | build 用 Release、test 沒帶 `--configuration Release` | 每一步都帶同一個 configuration |

## 6. 待確認

- `global.json` 的確切 SDK 版本（範本暫填 `10.0.100`）：團隊要釘哪個 feature band / patch 待確認。
- 是否改用 xUnit v3 待確認（版本號一律在 `Directory.Packages.props`，由 elf-stack 維護）。
- 是否把單元測試與整合測試分成兩段執行（例如 `--filter "Category!=Integration"`），待確認；目前範本一次跑全部並合併覆蓋率。
- 覆蓋率摘要是否要貼到 PR（例如 ReportGenerator 產生 `$GITHUB_STEP_SUMMARY`），待確認；目前只上傳 artifact + warning。
- `coverlet.msbuild` 搭配 `dotnet test --no-build` + `MergeWith` 在 .NET 10 SDK 的行為未在實機驗證；首次導入時請確認 CI log 出現 coverlet 的 `Calculating coverage result...`，且 `coverage/coverage.cobertura.xml` 的 line-rate 合理。

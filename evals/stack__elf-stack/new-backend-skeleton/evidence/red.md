# new-backend-skeleton：RED 紀錄

- 日期：2026-11-03
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive 5e13bd2a797e113dd937d07eada936a6cf092b7e` 取出的樹
- 開分支時的 `origin/dev`：`5e13bd2a797e113dd937d07eada936a6cf092b7e`
- 結果：1/5 個 grader 通過 → **失敗**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-global-json` | 失敗 | `global.json` `version` 為 `10.0.100`（`rollForward` 為 `latestFeature`） |
| `02-aspnetcore-10-0-14` | 失敗 | `Microsoft.AspNetCore.OpenApi` 與 `Mvc.Testing` 都是 `10.0.12` |
| `03-test-toolchain-exact` | 失敗 | `xunit.runner.visualstudio 3.1.4`、`Microsoft.NET.Test.Sdk 17.14.1`、`coverlet.msbuild 6.0.4`、`Testcontainers.PostgreSql 4.15.0`（精確版號，但都是 v1 值） |
| `04-no-npgsql-packageversion` | 通過 | `Directory.Packages.props` 沒有 Npgsql |
| `05-postgres-18-6` | 失敗 | compose（寫在 `docker/docker-compose.dev.yml`）的 image 為 `postgres:18` |

## 子代理最後回覆（逐字）

````markdown
我依 elf-stack 的版本表與範本寫好了三個檔，另外補了一個 `docker/.env.example`。這些檔只寫進工作目錄，沒有實際執行建置或 `docker compose` 驗證。

本機 compose 我放在 `docker/docker-compose.dev.yml`，沒有用你說的 `docker-compose.yml`。團隊規範把本機開發 compose 放在 `docker/docker-compose.dev.yml`（裡面只有資料庫，API 在 IDE 跑），`docker/docker-compose.yml` 是部署用、含 postgres、api、web 三個服務。兩份同名會撞，所以採規範的檔名。

**寫了哪些檔**（都在 `E:/source/e45-scratch/stack__elf-stack-workspace/iteration-0/new-backend-skeleton/old_skill/work/` 下）
- **`global.json`**：SDK `10.0.100`，`rollForward: latestFeature`。CI 要用 `global-json-file: global.json` 讀它，不要在 yml 寫死 `dotnet-version`。
- **`server/Directory.Packages.props`**：開啟 `ManagePackageVersionsCentrally=true`，版本都照團隊版本表：
  - `Microsoft.AspNetCore.OpenApi` 與 `Microsoft.AspNetCore.Mvc.Testing`：10.0.12
  - `SqlSugarCore`：5.1.4.221
  - 測試套件：`xunit` 2.9.3、`xunit.runner.visualstudio` 3.1.4、`Microsoft.NET.Test.Sdk` 17.14.1、`coverlet.msbuild` 6.0.4、`Testcontainers.PostgreSql` 4.15.0
  - `.csproj` 裡的 `<PackageReference>` 不能帶 `Version=`。
- **`docker/docker-compose.dev.yml`**：
  - image 用 `postgres:18`，不用 `latest`，`TZ: UTC`。
  - 帳密取自 `docker/.env` 的 `POSTGRES_*`，沒設定就直接報錯。
  - volume 掛在 `/var/lib/postgresql`，因為 postgres 18 的資料放在版本子目錄裡。
  - 有 `pg_isready` healthcheck。
  - 啟動指令：`docker compose --env-file docker/.env -f docker/docker-compose.dev.yml up -d`
- **`docker/.env.example`**：本機開發值（acme / acme_dev）。compose 少了 `docker/.env` 起不來，所以一起補上。把 `acme` 換成產品代號小寫，複製成 `docker/.env`，並把 `docker/.env` 加進 `.gitignore`。

**規範上還「待確認」、我先照暫定值寫的地方**
- .NET SDK 的 feature band：先寫 `10.0.100` 加 `latestFeature`。
- SqlSugarCore 的確切小版號：先寫參考專案用的 `5.1.4.221`。
- PostgreSQL 的 tag 要不要釘到小版號（例如 `18.x`）或指定 OS 版本（`-alpine`、`-bookworm`）：先寫 `postgres:18`。

**你沒要求、但新骨架通常也需要的**
- `server/Directory.Build.props`：集中寫 `<TargetFramework>net10.0</TargetFramework>`，每個 csproj 不要各寫一次。
- `appsettings.json` 的本機連線字串：`Host=localhost;Port=5432;Database=acme;Username=acme;Password=acme_dev;Timezone=UTC`。

需要的話我可以接著補。
````

## 工作目錄的檔案（逐字；`node_modules`、`pnpm-lock.yaml` 不列）

`global.json`

````
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
````

`docker/.env.example`

````
# Local development values only (not secrets). Copy to docker/.env (git-ignored).
# Replace "acme" with the product code in lowercase.
POSTGRES_DB=acme
POSTGRES_USER=acme
POSTGRES_PASSWORD=acme_dev
````

`docker/docker-compose.dev.yml`

````
# Local PostgreSQL for development only (the API runs from the IDE).
# Run from the repo root; docker/.env is git-ignored (copy docker/.env.example):
#   docker compose --env-file docker/.env -f docker/docker-compose.dev.yml up -d
services:
  postgres:
    image: postgres:18
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:?set POSTGRES_DB in docker/.env}
      POSTGRES_USER: ${POSTGRES_USER:?set POSTGRES_USER in docker/.env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in docker/.env}
      TZ: UTC
    ports:
      - '5432:5432'
    volumes:
      # postgres:18 images keep data under /var/lib/postgresql/18/docker;
      # mount the parent so the major-version subdirectory is included.
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
````

`server/Directory.Packages.props`

````
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
````

# new-backend-skeleton：GREEN 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive edc237aad13287a16bbd48aac6415237ae982555` 取出的樹
- 結果：5/5 個 grader 通過 → **通過**

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-global-json` | 通過 | `version` 是 `10.0.403`，`rollForward` 是 `latestFeature` |
| `02-aspnetcore-10-0-14` | 通過 | `Microsoft.AspNetCore.OpenApi` 與 `Microsoft.AspNetCore.Mvc.Testing` 都是 `10.0.14` |
| `03-test-toolchain-exact` | 通過 | 四個套件的版本都符合，全部是精確版號、沒有 `^` |
| `04-no-npgsql-packageversion` | 通過 | `Directory.Packages.props` 沒有 Npgsql |
| `05-postgres-18-6` | 通過 | image 是 `postgres:18.6` |

## 子代理最後回覆（逐字）

````markdown
三個檔案都寫好了，版本照 elf-stack v2 欄，因為新 repo 依 §0 一律用 v2。只做了靜態檢查：JSON／XML 能解析，`docker compose config` 通過；缺環境變數時會如預期報錯。沒有跑 `dotnet restore`／build，也沒有啟動容器。

**檔案**（都在 `C:/Users/EDDIE/AppData/Local/Temp/multica-task-2127579446/e45-green-1793990179/run/new-backend-skeleton/`）
- `global.json`：SDK `10.0.403`，`rollForward: latestFeature`
- `server/Directory.Packages.props`：照 §4.3 範本，開啟 `ManagePackageVersionsCentrally`。版本為 AspNetCore 系列 `10.0.14`、SqlSugarCore `5.1.4.221`、Test.Sdk `18.11.0`、xunit `2.9.3`、runner `4.0.1`、coverlet.msbuild `10.1.0`、Testcontainers.PostgreSql `4.16.0`。不寫 Npgsql，它由 SqlSugarCore 間接帶入 5.0.18，這就是表上的值。
- `docker-compose.yml`：服務名 `postgres`、image `postgres:18.6`，volume 掛 `/var/lib/postgresql`，帳密用 `${POSTGRES_*:?}` 從 `docker/.env` 取，`TZ: UTC`，有 healthcheck。

**要留意的差異**
1. **規範衝突：** elf-postgresql 的 §3.1 範本和檢查清單寫 `postgres:18`，elf-stack 則明列 `postgres:18` 是錯誤、應為 `postgres:18.6`。我依規則 1 用 `18.6`，elf-postgresql 那邊需要另外修正。
2. **檔案路徑：** 團隊標準的本機 compose 是 `docker/docker-compose.dev.yml`，而 `docker/docker-compose.yml` 是部署用。你指定 `docker-compose.yml` 又沒寫目錄，所以放在 repo 根目錄，不會跟部署檔衝突。要對齊標準的話，改名搬過去即可，同時把檔頭註解的啟動指令改回 `-f docker/docker-compose.dev.yml`。
3. **`docker/.env` 沒有建立：** 你沒要求這個檔，但少了它 compose 會直接報錯。啟動前要自己建，並列入 git ignore，內容是 `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`。

**第 8 節仍待確認的項目**（依規則 4 列出，都先照表值寫）
- SqlSugarCore 的確切 minor
- PostgreSQL image 的 OS 變體（目前不加後綴）
- runner 4、Test.Sdk 18、coverlet 10 還沒在團隊專案實跑，覆蓋率指令首次使用時要確認
````

## 子代理寫出的檔案（逐字）

### `global.json`

````text
{
  "sdk": {
    "version": "10.0.403",
    "rollForward": "latestFeature"
  }
}
````

### `server/Directory.Packages.props`

````text
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <!-- Web -->
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.14" />
    <!-- Data -->
    <PackageVersion Include="SqlSugarCore" Version="5.1.4.221" />
    <!-- Tests -->
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="18.11.0" />
    <PackageVersion Include="xunit" Version="2.9.3" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="4.0.1" />
    <PackageVersion Include="coverlet.msbuild" Version="10.1.0" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.14" />
    <PackageVersion Include="Testcontainers.PostgreSql" Version="4.16.0" />
  </ItemGroup>
</Project>
````

### `docker-compose.yml`

````text
# Local PostgreSQL for development only (the API runs from the IDE).
# Run from the repo root; docker/.env is git-ignored and holds POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD:
#   docker compose --env-file docker/.env up -d
services:
  postgres:
    image: postgres:18.6
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

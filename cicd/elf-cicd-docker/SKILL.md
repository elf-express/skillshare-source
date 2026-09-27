---
name: elf-cicd-docker
description: |
  Elf Express 容器化與映像發佈規範（docker/api.Dockerfile、docker/web.Dockerfile、nginx /api 反向代理、
  docker-compose 含 PostgreSQL 18、GitHub Actions 建置並推送到 GHCR）。當任務涉及撰寫或修改 Dockerfile、
  nginx.conf、docker-compose.yml、.dockerignore、release.yml 的 docker job、GHCR 映像名稱與 tag、
  GHA build cache，或排查容器建置 / 啟動 / 推送失敗時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express 容器映像規範（Docker + GHCR）

> 參考實作：`TypingTrainer/docker/*`、`.dockerignore`、`release.yml` 的 `docker` job。
> 本 skill 以團隊標準改寫：pnpm 11.x、Node 24.18、.NET 10、**PostgreSQL 18**（參考專案用 SQLite）、SqlSugar 5.x。

相關 skill：
- `elf-cicd-desktop` — 同一個 `release.yml` 的桌面 job；有桌面版時 docker job 放進那個檔案
- `elf-cicd-versioning` — `version.yml` 以 `workflow_call` 呼叫 release（需 `secrets: inherit`、`packages: write`）
- `elf-cicd-frontend` / `elf-cicd-backend` — PR 階段的 build / test
- `elf-stack` — 團隊技術棧版本總表

---

## 1. 何時使用

- 新專案要容器化網頁版：複製 `templates/` 全部檔案到 `docker/` 與 `.github/workflows/`
- 修改 Dockerfile、nginx 代理、compose 服務、`.dockerignore`
- 新增後端專案參考（csproj）、新增 Vite build-time 變數
- GHCR 推送失敗、快取沒命中、容器 unhealthy 排查

---

## 2. 固定規則

### 檔案位置

1. **MUST** 所有容器檔案放在 `docker/`：`api.Dockerfile`、`web.Dockerfile`、`nginx.conf`、`docker-compose.yml`、`.env.example`；
   `.dockerignore` 放在 **repo 根目錄**。WHY：build context 是 repo 根目錄，Docker 只讀 context 根的 `.dockerignore`。
2. **MUST** build context 永遠是 repo 根目錄（compose 用 `context: ..`、GHA 用 `context: .`）。WHY：web 與 api 都要讀根目錄的 manifest。

### api.Dockerfile（.NET 10）

本 skill 的 [`templates/api.Dockerfile`](templates/api.Dockerfile) 是團隊**唯一**的 API Dockerfile 範本；`elf-dotnet` 引用這裡，不另外維護一份。

3. **MUST** 兩階段：`mcr.microsoft.com/dotnet/sdk:10.0` 建置 → `mcr.microsoft.com/dotnet/aspnet:10.0` 執行。
4. **MUST** 依序 COPY `global.json` → `server/Directory.Build.props` + `server/Directory.Packages.props` → 所有被參考專案的 `.csproj`（維持 `server/src/<Project>/` 相對結構）→ `dotnet restore` → 再 COPY `server/` → `dotnet publish --no-restore`。
   WHY：restore 需要 SDK 釘版、共用 MSBuild 屬性（`TargetFramework`、CPM 版本）與每個 ProjectReference 的 manifest；少了 `Directory.Packages.props`，CPM 專案的 `PackageReference` 沒有版本，restore 直接失敗。只複製 manifest 讓這層在依賴沒變時保持快取。新增專案參考時 **MUST** 同步加一行 COPY。
5. **MUST** 以非 root 的 `$APP_UID` 執行、`ENV ASPNETCORE_HTTP_PORTS=8080`、`ENV TZ=UTC`、`EXPOSE 8080`。
5a. **MUST** 在執行階段以 `apt-get install -y --no-install-recommends curl` 安裝 `curl`（切回 `$APP_UID` 之前），healthcheck 一律 `curl -fsS http://localhost:8080/api/health`。**MUST NOT** 用 `wget`。
    WHY：`mcr.microsoft.com/dotnet/aspnet:10.0` 沒有 `curl` 也沒有 `wget`；healthcheck 呼叫不存在的指令會永遠 unhealthy，而 web 只等 `service_started`，不容易察覺。
5b. 健康檢查端點固定 `GET /api/health`；連線字串設定鍵固定 `ConnectionStrings:Default`（環境變數 `ConnectionStrings__Default`）。
6. **MUST NOT** 在 Dockerfile 寫連線字串或任何帳密。WHY：`ENV` 會永久留在映像層，任何能 pull 映像的人都看得到。
   連線字串只從執行期環境變數 `ConnectionStrings__Default` 注入。

### web.Dockerfile（pnpm + Vite + nginx）

7. **MUST** 建置階段 `FROM node:24.18-alpine`，以 `npm install -g pnpm@${PNPM_VERSION}` 安裝 pnpm，版本與根 `package.json` 的 `packageManager` 一致。
8. **MUST** 先 COPY `package.json pnpm-lock.yaml pnpm-workspace.yaml` 與各 workspace 的 `package.json` → `pnpm install --frozen-lockfile` → 再 COPY 原始碼。
   WHY：原始碼變更不重跑安裝；少了 `pnpm-workspace.yaml` 時 pnpm 看不到 workspace，`--frozen-lockfile` 會失敗。
9. **MUST** `VITE_*` 用 `ARG` + `ENV` 傳入，`VITE_API_BASE_URL` 預設 `/api`。WHY：Vite 在 build 時把值寫死進 bundle；相對路徑 `/api` 讓瀏覽器維持同源，不需要 CORS。
9a. **MUST** 有 `ARG VITE_USE_MOCK=false` + `ENV VITE_USE_MOCK=$VITE_USE_MOCK`；compose 與 release job 也明確傳 `VITE_USE_MOCK=false`。
    WHY：程式碼預設開啟 mock（`import.meta.env.VITE_USE_MOCK !== 'false'`，方便本機與 CI e2e）；production 映像不設這個值就會打包成**假資料版**，畫面正常、資料全是假的。
10. **MUST** 執行階段 `FROM nginx:alpine`，先 `rm -f /etc/nginx/conf.d/default.conf`，設定檔複製成 `/etc/nginx/conf.d/<app>.conf`。
    WHY：映像的 `10-listen-on-ipv6-by-default.sh` 只在 `default.conf` 存在時執行，會呼叫 `apk manifest nginx`，無網路時容器啟動卡死。
11. **MUST NOT** 在前端映像放任何 secret。WHY：`VITE_*` 最後都是公開的 JS 字串。

### nginx.conf

12. **MUST** `location /api/ { proxy_pass http://api:8080/api/; … }`，並帶 `Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto` 標頭。
    WHY：`api` 是 compose 服務名稱；轉發標頭讓後端拿到真實 IP 與協定。
13. **MUST** 同時 `listen 80;` 與 `listen [::]:80;`（因規則 10 移除了自動加 IPv6 的腳本）。
14. **MUST** 靜態資源（js/css/字型/圖片）`expires 1y` + `Cache-Control "public, immutable"`；`location /` 用 `try_files $uri $uri/ /index.html`。
    WHY：Vite 檔名含 hash 可長快取。團隊 router 用 hash 模式（`createWebHashHistory`，同一份 bundle 可給 Tauri 用），路由在 `#` 之後、不會送到 nginx；保留 fallback 是為了日後改 `createWebHistory` 時重新整理不 404。

### docker-compose.yml（PostgreSQL 18）

本 skill 的 `docker/docker-compose.yml` 是**部署用**的唯一 compose 檔；`elf-postgresql` 的 `docker/docker-compose.dev.yml` 只給本機開發，兩者同樣用服務名稱 `postgres` 與 `docker/.env`。

15. **MUST** 三個服務：`postgres`（`image: postgres:18`）、`api`、`web`；只有 `web` 對外開 `ports`。
16. **MUST** 資料庫帳密（`POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD`）全部來自 `docker/.env`（git-ignored），compose 以 `${VAR:?訊息}` 強制必填；repo 只提交 `docker/.env.example`（假值）。
17. **MUST** postgres volume 掛在 `/var/lib/postgresql`（**不是** `/var/lib/postgresql/data`）。
    WHY：postgres 18 官方映像把資料目錄改到 `/var/lib/postgresql/18/docker`，舊路徑會被拒絕。
18. **MUST** postgres 有 `pg_isready` healthcheck，`api.depends_on.postgres.condition: service_healthy`。
    WHY：SqlSugar CodeFirst 在啟動時建表，資料庫還在初始化就會失敗。
19. **MUST** api 連線字串寫成 `ConnectionStrings__Default: Host=postgres;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD};Timezone=UTC`（Npgsql 格式），並設 `TZ: UTC`。
    WHY：少了 `Timezone=UTC`，Npgsql session 時區跟著主機走，`timestamptz` 讀寫會差出時區偏移。
19a. **MUST NOT** 把本範本的「api 以 `POSTGRES_USER` 連線」用在正式環境。官方 postgres 映像的 `POSTGRES_USER` 是**超級使用者**，本範本只適用本機開發與單機展示。
    正式環境 MUST 依 **elf-postgresql** 規則 28：擁有者帳號（跑 CodeFirst / 遷移）與 api 用的應用程式帳號（無 DDL 權限）分開；CodeFirst 何時、由誰執行依 **elf-sqlsugar** 規則 18a。
    WHY：api 被攻破時，超級使用者連線等於整台資料庫（含其他 schema、`COPY ... PROGRAM`）一起失守。
20. **MUST** 執行指令一律帶 `--env-file docker/.env -f docker/docker-compose.yml`，從 repo 根目錄執行。

### .dockerignore

21. **MUST** 排除 `.git`、`node_modules`、前端 `dist`、`bin`/`obj`、`src-tauri`、`**/.env*`（保留 `!**/.env.example`）、本機資料庫檔。
    WHY：縮小 context；避免把本機 `.env` 或開發資料庫燒進映像。

### GHCR 推送（release.yml 的 docker job）

22. **MUST** 映像名稱：`ghcr.io/<owner>/<repo>/api`、`ghcr.io/<owner>/<repo>/web`，前綴以 `${GITHUB_REPOSITORY,,}` 轉**小寫**。
    WHY：GHCR 拒絕大寫，而 repo slug 常含大寫（例：`TW199501/TypingTrainer`）。
23. **MUST** 每個映像推兩個 tag：release tag（`${{ inputs.tag || github.ref_name }}`，例 `v1.2.3`）與 `latest`。
24. **MUST** job 權限 `contents: read`、`packages: write`；登入用 `docker/login-action@v3` + `secrets.GITHUB_TOKEN`。**MUST NOT** 使用個人 PAT。
25. **MUST** 使用 `docker/setup-buildx-action@v3` + `docker/build-push-action@v6`，快取 `type=gha` 並**每個映像獨立 `scope`**
    （`cache-from: type=gha,scope=api` / `cache-to: type=gha,mode=max,scope=api`，web 同理）。
    WHY：未指定 scope 時兩個映像共用預設 scope，互相覆蓋快取。
26. **MUST** 有桌面版的專案把 docker job 放進 `elf-cicd-desktop` 的同一個 `release.yml`；純網頁專案才用獨立的 [`templates/release-docker.yml`](templates/release-docker.yml)。
    WHY：`version.yml` 只呼叫一個 workflow。
27. **MUST** 有桌面版又有 docker job 時，保留 `.github/release-body.md`（`elf-cicd-desktop`）最後一行 GHCR 連結 `ghcr.io/<owner>/<repo>`（小寫）；沒有 docker job 就刪除該行。

---

## 3. 標準範本

| 範本 | 複製到 |
|---|---|
| [`templates/api.Dockerfile`](templates/api.Dockerfile) | `docker/api.Dockerfile` |
| [`templates/web.Dockerfile`](templates/web.Dockerfile) | `docker/web.Dockerfile` |
| [`templates/nginx.conf`](templates/nginx.conf) | `docker/nginx.conf` |
| [`templates/docker-compose.yml`](templates/docker-compose.yml) | `docker/docker-compose.yml` |
| [`templates/env.example`](templates/env.example) | `docker/.env.example` |
| [`templates/dockerignore`](templates/dockerignore) | `.dockerignore`（repo 根目錄） |
| [`templates/release-docker.yml`](templates/release-docker.yml) | `.github/workflows/release.yml`（純網頁）或只取 `jobs.docker` |

要替換的佔位符：

| 佔位符 | 範例 | 出現在 |
|---|---|---|
| `<AppName>` | `MyApp`（API 專案為 `server/src/MyApp.Api/`，目錄結構依 `elf-cicd-backend`） | api.Dockerfile |
| `<web-dir>` | `apps` | web.Dockerfile、.dockerignore |
| `<app>` | `myapp`（小寫） | web.Dockerfile、compose、env.example |
| `<PNPM_VERSION>` | pnpm 版本（與 `packageManager: "pnpm@<PNPM_VERSION>"` 相同） | web.Dockerfile `PNPM_VERSION` |

`.gitignore` **MUST** 包含：

```gitignore
docker/.env
```

根目錄 `package.json` 建議的指令：

```jsonc
"scripts": {
  "docker:up":   "docker compose --env-file docker/.env -f docker/docker-compose.yml up --build -d",
  "docker:down": "docker compose --env-file docker/.env -f docker/docker-compose.yml down",
  "docker:logs": "docker compose --env-file docker/.env -f docker/docker-compose.yml logs -f"
}
```

後端讀取連線字串（SqlSugar 5.x，細節見 `elf-sqlsugar` / `elf-dotnet`）：

```csharp
var conn = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings__Default is not set");
// new ConnectionConfig { DbType = DbType.PostgreSQL, ConnectionString = conn, IsAutoCloseConnection = true }
```

### 部署端拉取

```bash
docker pull ghcr.io/<owner>/<repo>/api:v1.2.3
docker pull ghcr.io/<owner>/<repo>/web:latest
```

---

## 4. 檢查清單

- [ ] `docker/` 內 5 個檔案 + 根目錄 `.dockerignore` 都在；`docker/.env` 已加入 `.gitignore`
- [ ] api.Dockerfile：有 COPY `global.json`、`server/Directory.Build.props`、`server/Directory.Packages.props`；每個 ProjectReference 都有對應 `COPY *.csproj`；沒有任何 `ENV ConnectionStrings__…`
- [ ] api.Dockerfile：最終階段裝了 `curl`、`TZ=UTC`；healthcheck 用 `curl`，不是 `wget`
- [ ] web.Dockerfile：`node:24.18-alpine`、`PNPM_VERSION` 等於 `packageManager`、有 COPY `pnpm-workspace.yaml`、`--frozen-lockfile`
- [ ] web.Dockerfile：刪除 `default.conf`、設定檔名為 `<app>.conf`
- [ ] web.Dockerfile 有 `ARG VITE_USE_MOCK=false` + `ENV`；compose 與 release job 都傳 `VITE_USE_MOCK=false`
- [ ] nginx：`/api/` 代理到 `http://api:8080/api/`、IPv4 + IPv6 listen、SPA fallback
- [ ] compose：`postgres:18`、volume 在 `/var/lib/postgresql`、`pg_isready` healthcheck、`service_healthy`、帳密用 `${VAR:?}`
- [ ] compose：只有 web 有 `ports`；api 有 `TZ: UTC`，連線字串含 `Timezone=UTC`
- [ ] 本機 `pnpm docker:up` 後 `docker compose … ps` 三個服務皆 running / healthy，`http://localhost:8080/api/health` 回 200
- [ ] release docker job：小寫前綴、兩個 tag、`packages: write`、每個映像各自的 gha `scope`
- [ ] 呼叫端 `version.yml` 給了 `packages: write` 與 `secrets: inherit`

---

## 5. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| 推送報 `repository name must be lowercase` | GHCR 名稱含大寫 | 用 `${GITHUB_REPOSITORY,,}` 產生前綴 |
| 推送報 `denied: permission_denied` / 403 | job 沒有 `packages: write`，或呼叫端沒給 | job 與 `version.yml` 的 release job 都加 `packages: write` |
| web 容器啟動卡住不動（離線環境） | 保留了 `default.conf`，IPv6 腳本呼叫 `apk manifest` | `rm -f /etc/nginx/conf.d/default.conf`，設定檔改名 |
| `dotnet restore` 找不到專案 | 新增 ProjectReference 沒補 `COPY *.csproj` | 補 COPY 行，路徑維持同樣相對結構 |
| `pnpm install --frozen-lockfile` 報 lockfile 不符 / 找不到 workspace 套件 | 沒 COPY `pnpm-workspace.yaml` 或某個 workspace 的 `package.json` | 補齊 manifest COPY |
| pnpm 報 `ERR_PNPM_BAD_PM_VERSION` 類錯誤 | `PNPM_VERSION` 與 `packageManager` 不一致 | 兩處改成同一版本 |
| postgres 容器啟動即退出，提示資料目錄格式 / 路徑 | volume 掛在 `/var/lib/postgresql/data` | 改掛 `/var/lib/postgresql`（18 版新路徑） |
| api 啟動時連不上資料庫 | `depends_on` 用 `service_started`，DB 尚未就緒 | postgres 加 healthcheck，改 `service_healthy` |
| `compose up` 報 `set POSTGRES_PASSWORD in docker/.env` | `.env` 沒建或沒用 `--env-file` | `cp docker/.env.example docker/.env` 並填值 |
| api 容器永遠 `unhealthy`，但 API 其實正常 | healthcheck 用 `wget`，aspnet 映像沒有這個指令 | 在最終階段 apt 安裝 `curl`，healthcheck 改 `curl -fsS` |
| `dotnet restore` 報 `NU1010` / PackageReference 沒有版本 | Dockerfile 沒 COPY `server/Directory.Packages.props`（CPM） | 照範本 COPY `global.json` 與兩個 `Directory.*.props` |
| 正式站畫面正常但資料全是假的 | web 映像建置時沒傳 `VITE_USE_MOCK=false`，程式碼預設開 mock | web.Dockerfile 預設 `ARG VITE_USE_MOCK=false`（規則 9a） |
| 時間欄位差 8 小時 | 連線字串沒有 `Timezone=UTC` 或容器沒設 `TZ=UTC` | 兩者都加（規則 19） |
| 前端呼叫 API 出現 CORS 錯誤 | `VITE_API_BASE_URL` 設成絕對網址 | 設 `/api`，由 nginx 同源代理 |
| 每次 release 映像都完整重建 | 兩個映像共用 gha 快取 scope 互相覆蓋 | 每個映像加 `scope=api` / `scope=web` |
| desktop job 金鑰錯誤但 docker job 綠燈 | `GITHUB_TOKEN` 是唯一自動傳遞的 secret（沒 `secrets: inherit`） | 見 `elf-cicd-desktop` |

---

## 6. 待確認

- pnpm 確切版本（11.x 或 12），決定 `PNPM_VERSION` 與 `packageManager` 的值。
- 映像 tag 是否保留 `v` 前綴（目前沿用 git tag，例 `v1.2.3`），或改為純 semver `1.2.3`。
- postgres 18 volume 路徑改為 `/var/lib/postgresql` 依據官方映像變更說明，團隊尚未在實際專案驗證。
- 各映像獨立 gha cache `scope` 是對參考專案的改良（參考專案未設定 scope），尚未在團隊 CI 實測命中率。
- `node:24.18-alpine` tag 在 Docker Hub 是否存在（若只有 `24-alpine` / `24.18.x-alpine`，需調整）。
- 正式環境部署方式（直接 compose、Kubernetes 或其他）與 secrets 注入方式尚未定義；本 skill 只涵蓋建置與推送。
- 正式環境的應用程式帳號如何建立（`docker-entrypoint-initdb.d` 初始化腳本、部署管線，或 DBA 手動），以及 CodeFirst 在正式環境由哪個步驟以擁有者帳號執行（規則 19a、elf-postgresql 規則 28、elf-sqlsugar 規則 18a）。

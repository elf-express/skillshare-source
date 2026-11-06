# web-image-and-compose：RED 紀錄

- 日期：2026-11-07
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 開分支時的 `origin/dev`：`b757add4747263593abc5a654930512cdedeb430`
- 結果：4/4 個 grader 通過 → **沒有失敗（維持案例）**

提示：工作目錄一行＋Plan 全域限制的「先讀」一行，其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-node-image` | 通過 | `docker/web.Dockerfile:4` `FROM node:24.22.2-alpine AS build` |
| `02-pnpm-version` | 通過 | `ARG PNPM_VERSION=12.16.1`，和 fixture 的 `packageManager` 一致 |
| `03-postgres-image` | 通過 | `docker/docker-compose.yml:14` `image: postgres:18.6`（代理依規則 1 放在 `docker/`） |
| `04-no-old-values` | 通過 | `grep -rnE 'node:24\.18|postgres:18([^.0-9]|$)'` 結束碼 1，零筆 |

## 子代理最後回覆（逐字）

`````markdown
已寫好 `docker/web.Dockerfile` 和 `docker/docker-compose.yml`；`docker compose config` 語法通過（用臨時環境變數），映像沒有實際建置，目前也還建不起來（缺的檔案見下）。

**和你的要求或 skill 不同的地方**
- compose 放在 `docker/docker-compose.yml`，不是根目錄：elf-cicd-docker 規則 1 規定容器檔案都放 `docker/`。
- 版本照 elf-stack，不照 elf-cicd-docker：Node 用 `node:24.22.2-alpine`（skill 寫 `24.18`）、PostgreSQL 用 `postgres:18.6`（skill 寫 `18`）。elf-stack 規定衝突時以它為準，這個衝突要在 skill 修正。Docker Hub 上這兩個 tag 都查得到。
- `nginx:alpine` 照 skill 規則 10 保留，但它是浮動 tag，違反 elf-stack 規則 7；elf-stack 表上沒有 nginx，我不能自行決定版本，要先把 nginx 加進版本表。

**我自行假設的值，請確認**
- 前端目錄 `apps`：`package.json` 看不出來，這是 skill 範例的值，也是 elf-stack 提到的參考專案目錄。不對的話要改 Dockerfile 的三處。
- `<app>` 用 `acme`（取自 `package.json` 的 `name`）。

**要真的建置，還缺這些（你只要求兩個檔，我沒有產生）**
- `docker/nginx.conf`：web 映像要用。
- `docker/api.Dockerfile` 和 `server/`：compose 的 `api` 服務要用，且需要 API 專案名稱才能填範本。
- `docker/.env.example` 和 `docker/.env`：沒有 `.env` 時 compose 會拒絕啟動；`docker/.env` 要加進 `.gitignore`。
- 根目錄 `.dockerignore`。
- `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`apps/package.json`：Dockerfile 會 COPY 它們，且 `apps` 要有 `build` 腳本。
- `package.json` 沒有 `engines.node`（應為 `>=24.22.2`）：沒有改，因為你沒要求。

要我接著補齊 `nginx.conf`、`.env.example`、`.dockerignore` 的話說一聲；`api.Dockerfile` 需要你提供 API 專案名稱。
`````

## 產出檔案（逐字）

`docker/docker-compose.yml`

`````
# docker/docker-compose.yml
# Web deployment: Vue bundle behind nginx + the ASP.NET Core API + PostgreSQL 18.
# Run from the repo root. Copy docker/.env.example to docker/.env (git-ignored)
# and fill it in; pass it explicitly so the lookup never depends on the
# current directory:
#   docker compose --env-file docker/.env -f docker/docker-compose.yml up --build
# Then open http://localhost:8080
#
# This is THE deployment compose file. elf-postgresql's docker/docker-compose.dev.yml
# is local-dev only; both use the service name `postgres` and docker/.env.

services:
  postgres:
    image: postgres:18.6
    restart: unless-stopped
    environment:
      # `:?` makes compose refuse to start when a value is missing, instead of
      # silently starting a database with an empty password.
      POSTGRES_DB: ${POSTGRES_DB:?set POSTGRES_DB in docker/.env}
      POSTGRES_USER: ${POSTGRES_USER:?set POSTGRES_USER in docker/.env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in docker/.env}
    volumes:
      # PostgreSQL 18 images keep data under /var/lib/postgresql/18/docker and
      # declare the volume at /var/lib/postgresql. Mounting the old
      # /var/lib/postgresql/data path (<=17 habit) is refused by the 18 image.
      - pg-data:/var/lib/postgresql
    healthcheck:
      # $$ escapes compose interpolation so the container's own env is used.
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 10s
      timeout: 5s
      start_period: 20s
      retries: 5
    # No `ports:` — only the api container talks to the database. Add
    # '127.0.0.1:5432:5432' locally if you need a GUI client.

  api:
    build:
      context: ..
      dockerfile: docker/api.Dockerfile
    image: acme-api:local
    restart: unless-stopped
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      # All timestamps are UTC end to end: process clock and Npgsql session.
      TZ: UTC
      # Npgsql format, read by SqlSugar via ConnectionStrings:Default. Host is the
      # compose service name. Credentials come only from docker/.env.
      ConnectionStrings__Default: Host=postgres;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD};Timezone=UTC
    expose:
      - '8080'
    depends_on:
      # service_healthy, not service_started: SqlSugar CodeFirst runs at
      # start-up and fails if the database is still initialising.
      postgres:
        condition: service_healthy
    healthcheck:
      # curl is installed in api.Dockerfile's final stage — the aspnet image has
      # neither curl nor wget, so without it this check can never pass.
      test: ['CMD-SHELL', 'curl -fsS http://localhost:8080/api/health >/dev/null || exit 1']
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 3

  web:
    build:
      context: ..
      dockerfile: docker/web.Dockerfile
      args:
        # Relative base → the browser stays same-origin and nginx proxies /api.
        VITE_API_BASE_URL: /api
        # Production image talks to the real API, never the mock.
        VITE_USE_MOCK: 'false'
    image: acme-web:local
    restart: unless-stopped
    ports:
      - '${WEB_PORT:-8080}:80'
    depends_on:
      api:
        condition: service_started

volumes:
  pg-data:
`````

`docker/web.Dockerfile`

`````
# docker/web.Dockerfile
# Build context is the repo root: docker compose -f docker/docker-compose.yml build
# Web workspace: apps. Config file name: acme.
FROM node:24.22.2-alpine AS build
WORKDIR /repo

# Must match "packageManager": "pnpm@12.16.1" in the root package.json.
# Installed with npm, never corepack (team rule: no corepack anywhere).
ARG PNPM_VERSION=12.16.1
RUN npm install -g pnpm@${PNPM_VERSION}

# Manifests first so a source-only change does not re-run the install.
# pnpm-workspace.yaml is required: without it pnpm does not see the workspace
# packages and --frozen-lockfile fails. Add .npmrc here if the repo has one.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/package.json apps/package.json
RUN pnpm install --frozen-lockfile

COPY apps apps

# Vite reads these at build time and bakes them into the bundle. Pointing at a
# relative /api keeps the browser same-origin, so nginx proxies to the API and
# no CORS negotiation is needed. Add further VITE_* build args the same way.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# The app defaults to the mock API when VITE_USE_MOCK is unset (code checks
# `!== 'false'`), which is right for local dev and CI e2e — and wrong for a
# production image. Default it OFF here; override only for a demo image.
ARG VITE_USE_MOCK=false
ENV VITE_USE_MOCK=$VITE_USE_MOCK

RUN pnpm run build

FROM nginx:alpine AS runtime
# Not named default.conf on purpose: the image's
# 10-listen-on-ipv6-by-default.sh entrypoint only runs when that exact file is
# present, and it shells out to `apk manifest nginx` to checksum it — which
# needs the Alpine package index and hangs the container start when the network
# is unavailable. Removing the stock file makes that script exit early; our
# config listens on IPv6 itself.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/acme.conf
COPY --from=build /repo/apps/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
`````

`package.json`

`````
{"name": "acme", "private": true, "packageManager": "pnpm@12.16.1"}
`````

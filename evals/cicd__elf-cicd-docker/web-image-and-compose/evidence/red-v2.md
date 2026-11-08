# web-image-and-compose：RED v2 紀錄（不載入 elf-stack）

- 日期：2026-11-09
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理）
- skill 來源：`git archive dc8fff9b8ada13f0aed4d4395f9436c859fcb342`（`E45_SHA`）取出的樹
- 當時的 `origin/dev`：`9b60421368e9bd8ce5744b777d97191989d9df1f`
- 結果：4/4 個 grader 通過 → **沒有失敗（維持案例）**
- 代理有沒有讀 `stack/elf-stack`：有，提示沒有指示；回覆引用 elf-stack 3.1 節、第 7 節、規則 1、規則 7。依 Spec 這是真實路徑，不重跑、不判失敗。

提示：工作目錄一行＋Plan 全域限制「案例 2、3、4、B1、B2」那一行（`skills` 依 `case.yaml` 展開成路徑），其餘逐字照 `prompt.md`。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-node-image` | 通過 | `docker/web.Dockerfile:3` `FROM node:24.22.2-alpine AS build` |
| `02-pnpm-version` | 通過 | `docker/web.Dockerfile:8` `ARG PNPM_VERSION=12.16.1`，和 fixture 的 `packageManager` 一致 |
| `03-postgres-image` | 通過 | `docker/docker-compose.yml:14` `image: postgres:18.6`（代理依規則 1 放在 `docker/`） |
| `04-no-old-values` | 通過 | `grep -rnE 'node:24\.18|postgres:18([^.0-9]|$)'` 結束碼 1，零筆 |

## 子代理最後回覆（逐字）

`````markdown
已寫好 `docker/web.Dockerfile` 和 `docker/docker-compose.yml`，但映像還建不起來：缺下面列的檔案，也沒實際跑過 build。`docker compose config` 語法檢查通過，只驗語法。

**與要求或 skill 不一致的地方**
- **compose 路徑：** 你寫 `docker-compose.yml`，我依規則 1 放在 `docker/`，`context: ..` 也是配這個位置。要放根目錄的話，context 和 Dockerfile 路徑都要改。
- **版本衝突：** elf-cicd-docker 的規則 7、規則 15 和範本寫 `node:24.18-alpine`、`postgres:18`；elf-stack 3.1 節是 Node 24.22.2、`postgres:18.6`，第 7 節還把 `postgres:18` 列為錯誤。
  - elf-stack 規則 1 規定以它為準並回報衝突，這個 repo 也還沒有 release，所以我用 `node:24.22.2-alpine` 和 `postgres:18.6`。兩個 tag 在 Docker Hub 都查得到。
  - elf-cicd-docker 的規則、檢查清單和範本都該改。
- **nginx 浮動 tag：** `nginx:alpine` 是規則 10 指定的，但違反 elf-stack 規則 7（禁浮動 tag）。elf-stack 表上沒有 nginx，我不能自訂版本，所以照寫，這條要等團隊定版本。

**我的假設**
- `<web-dir>` 用 `apps`（團隊慣例）
- `<app>` 用 `acme`（取自 `package.json` 的 name）
- `PNPM_VERSION` 用 `12.16.1`，與 `packageManager` 及 elf-stack 一致

**還缺什麼才建得起來**
- **web 映像：** `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`apps/`（含 `package.json`）、`docker/nginx.conf`。
- **根目錄 `build` script：** 目前 `package.json` 沒有這個 script，`RUN pnpm run build` 會失敗。要照 elf-cicd-frontend 的 `package.root.json` 補上。
- **compose：** `docker/api.Dockerfile`、`docker/.env`（範例檔是 `docker/.env.example`）。
- **其他 skill 要求：** 根目錄 `.dockerignore`，`.gitignore` 加 `docker/.env`。

這些不在你要的範圍，我沒有建立。

**正式環境限制：** 這份 compose 的 api 以 `POSTGRES_USER`（超級使用者）連線，依規則 19a 只適用本機開發與單機展示。
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

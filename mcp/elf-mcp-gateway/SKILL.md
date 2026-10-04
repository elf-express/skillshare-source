---
name: elf-mcp-gateway
description: |
  Elf Express MCPJungle gateway 部署與註冊規範：vendored fork 從源碼 build、docker compose（內建 Postgres + gateway + docs-mcp + 一次性 registrar，零設定可起）、
  mcpjungle/servers/*.json 註冊檔格式、registrar 重試與冪等、REGISTER_LIST、Dockhand / pull 部署、nginx 反向代理（SSE）、
  GHCR 發佈（GHCR_PAT fallback）、SHA 釘選的 GitHub Actions、環境變數與安全（SERVER_MODE、bearer token、dashboard 不外露）。
  當任務涉及 mcpjungle/ 目錄、docker-compose*.yml、Dockerfile.registrar、registrar.sh / register.sh、servers/*.json、
  MCPJungle 設定或升級、nginx.example.conf、docker-publish.yml / ci.yml，或排查「gateway 看不到工具 / 註冊失敗 / 連不上」時觸發。
metadata:
  version: 1.1.0
  owner: Elf Express
---

# MCPJungle Gateway 部署與註冊（Elf Express）

> 參考實作：`elf-express/mcp-library` 的 `mcpjungle/`、根 `docker-compose*.yml`、`.github/workflows/`。
> 架構：**AI 工具只連一個 MCPJungle**；gateway 後面掛多個知識 MCP server（目前 `docs-mcp-server` 的 `sqlsugar-zh-tw` / `fc-zh-tw`，
> 加上官方 stdio server `filesystem` / `fetch` / `time`）。

相關 skill：
- **`elf-mcp-knowledge`** — 新增知識庫的主流程（本 skill 是其中「註冊 / 部署 / 驗證」三步的細節）
- `elf-mcp-server` — server 本身的寫法
- `elf-cicd-docker`（映像規範）、`elf-cicd-review`（PR AI review）、`elf-cicd-versioning`（版號 / tag）、`elf-stack`

---

## 1. 何時使用

- 部署 / 重佈 gateway stack；換 DB、換 port、改網路
- 新增 / 修改 `servers/*.json`、`REGISTER_LIST`、tool group
- 升級 vendored MCPJungle fork、改 `Dockerfile.fullbuild`
- 對外開放（nginx / HTTPS / token）
- 改 `docker-publish.yml`、`ci.yml`、`dependabot.yml`
- 排查：registrar 失敗、23505 重名、stdio server 起不來、SSE 收不到回應

---

## 2. 固定規則

### 拓撲與 compose

1. **MUST** 以根 `docker-compose.yml`（`include: mcpjungle/docker-compose.mcpjungle.yml`）為正式入口；**四個**服務：
   `postgres`（`postgres:16-alpine`，container `mcpjungle-postgres`，**不對外開 port**，volume `pgdata`）、
   `mcpjungle`（container `mcpjungle-server`，:18800→8080）、`docs-mcp-server`（:5690，只在內網）、`registrar`（一次性，`restart: "no"`）。
   docs-mcp 的 build context 是 `../mcp/docs-mcp-server`（`fb1d578` 把 server 收進 `mcp/` 之後的路徑）。
2. **MUST** 維持「**DB 內建、零設定可起**」：stack 自帶 `postgres` service，`mcpjungle` 的 `DATABASE_URL` 預設值是
   `postgres://mcpjungle:mcpjungle@postgres:5432/mcpjungle?sslmode=disable`（**容器名** `postgres`，在 `mcpjungl` 網路內解析），
   gateway 以 `depends_on: postgres: condition: service_healthy` 等 DB 就緒。`docker compose up -d --build` 不必先 `cp .env.example .env`。
   WHY：`a39e3eb`（feat(deploy): bundle Postgres into the stack, drop shared-db）——這條**取代**了早先 `6d25d6f` 的「DB 走外部 IP、stack 不含 Postgres」決策，`shared-db/` 目錄已不存在。
2a. **MUST** 只有要接「既有的外部 DB」才在 `.env` 設 `MCPJUNGLE_DATABASE_URL` 覆寫（host 填該 DB 的 **IP**、port 填它實際監聽的 port）；
   內建那顆容器仍會起，可 `docker compose stop postgres` 關掉。
2b. **MUST** 改內建 DB 密碼時 **`POSTGRES_PASSWORD` 與 `MCPJUNGLE_DATABASE_URL` 兩處同步改**，否則 gateway 連不上 DB。
   `pgdata` volume 的資料 `docker compose down` 不會刪，`down -v` 才會——**MUST NOT** 在正式環境用 `down -v` 當重啟手段。
2c. 網路 `mcpjungl` 由 stack **自建**（實際名 `<project>_mcpjungl`），不必 `docker network create`；自包含端到端測試用 `docker-compose.localtest.yml`（現況見待確認 8）。
3. **MUST** 分清兩個位址：`--registry http://<host>:18800`（CLI → gateway）與 `servers/*.json` 的 `http://docs-mcp-server:5690/...`（gateway → server，用**容器名**在 `mcpjungl` 內解析）。
4. **MUST** gateway image 從 vendored fork 源碼 build：`context: ./MCPJungle`、`dockerfile: Dockerfile.fullbuild`、tag `mcpjungle-fork:latest`（`75c0649`）。
5. **MUST** gateway runtime 保持 **Node 22+ 與 uv**（`Dockerfile.fullbuild` stage 3：`ghcr.io/astral-sh/uv:debian` + nodesource `setup_22.x` + `tzdata`）。
   WHY：`67b8864`——Node 20 跑不動使用 Node 22 API 的 stdio server（`@smartbear/mcp` 用 `module.enableCompileCache`）；`npx` / `uvx` 是 stdio server 的前提。
6. **MUST** `MCP_SERVER_INIT_REQ_TIMEOUT_SEC` 預設 **30**。WHY：`bafd8e8`——`npx -y` 首次執行要下載套件，10 秒不夠。
7. **MUST** 四個服務都設 `TZ: ${TZ:-Asia/Taipei}`（含 `postgres`），gateway image 安裝 `tzdata`（`bafd8e8`）。TZ 只影響日誌 / 顯示；DB 時間欄位依 `elf-postgresql` 以 UTC `timestamptz` 儲存。
8. **MUST** 要接「現有」gateway 時用 `mcpjungle/docker-compose.dockhand.yml`（只起 docs-mcp + registrar，加入 external 網路 `MCPJUNGLE_NETWORK`），**MUST NOT** 再起第二個 gateway。
   WHY：container 名固定 `mcpjungle-server`，同機已有同名 gateway 會撞名。

### 註冊檔 `servers/*.json`

9. **MUST** 依 MCPJungle `RegisterServerInput`（`MCPJungle/pkg/types/mcp_server.go`）撰寫，欄位：

   | 欄位 | 何時必填 | 說明 |
   |---|---|---|
   | `name` | 一律 | `^[a-zA-Z0-9_-]+$`、不含 `__`、不以 `_` 結尾；團隊規定小寫 kebab-case。全 gateway 唯一 |
   | `transport` | 一律 | `streamable_http`（自家 server）/ `stdio`（npx / uvx 官方 server）/ `sse` |
   | `description` | 團隊規定必填 | 列出該 server 有效的**全部**工具名（證據 E10） |
   | `url` | `streamable_http` | gateway → server 的容器內網址 |
   | `bearer_token` | server 設了 `MCP_AUTH_TOKEN` 時 | 用 `${ENV_NAME}`，CLI 註冊時展開；**MUST NOT** 寫明文 |
   | `headers` | 選用 | 自訂 header；`Authorization` 會蓋過 `bearer_token` |
   | `command` / `args` / `env` | `stdio` | `env` 值也用 `${ENV_NAME}` |
   | `session_mode` | 選用 | `stateless`（預設）/ `stateful` |

   範本：`templates/servers/http-server.json`、`http-server-auth.json`、`stdio-server.json`、`stdio-server-env.json`。
10. **MUST** 需 token 的 server（如 github）不放進自動註冊清單，除非 token 已由 env 提供。WHY：`mcpjungle/README.md`「沒進自動註冊，以免無 token 失敗」。
11. **MUST** 知識語料採**策略 A**（每本書一個 server，`/mcp/<id>`，工具 `<id>__docs_search`）；策略 B（`docs-all.json`，`docs__docs_*`）只當補充入口。
    WHY：A 才能在 gateway 以 server 為單位做 tool group 與 enterprise ACL。

### registrar

12. **MUST** registrar 以 `Dockerfile.registrar` 把 `servers/` 與 `registrar.sh` **烤進 image**（`ghcr.io/elf-express/docs-registrar`），**MUST NOT** 改回 bind mount。
    WHY：`54a9c08`——Dockhand / Portainer 把 repo clone 進自己的容器，相對 bind mount 由 host daemon 解析，報 `mkdir /app: read-only file system`。
13. **MUST** 保留 `registrar.sh` 的三段邏輯：等 gateway（每 2 秒、上限 60 次＝120 秒）→ 每個 server 註冊重試（3 秒、上限 20 次）→ 冪等（`list servers` 已有則略過）。
    WHY：`3eaebfd`——docs-mcp 尚未監聽時註冊會 connection refused；冪等讓每次 push 後 redeploy 安全。
14. **MUST** 新 server 加進 `REGISTER_LIST`：`registrar.sh` 預設值（主 stack）與 `docker-compose.dockhand.yml` 預設值（接現有 gateway）各自維護。
15. registrar 結束 `Exited (0)` 是**正常**；`docker logs` 應見「registrar: 完成,目前 servers:」與清單。

### 對外與安全

16. **MUST** 對外只經 nginx（`templates/nginx.example.conf`）：TLS、`limit_req 10r/s burst 20`、`limit_conn 20`、`/health` 免限流；
    `/mcp` 必須 `proxy_http_version 1.1`、`Connection ""`、`proxy_buffering off`、`proxy_cache off`、`proxy_read_timeout/send_timeout 3600s`、透傳 `Authorization`；`client_max_body_size 8m`（對齊 express 8mb）。
    WHY：少任何一行 SSE 就會「能呼叫工具但收不到串流回應」。
17. **MUST** `SERVER_MODE=development` 時 gateway **不驗證用戶端**——只能在內網使用；要對公網開放，必須切 enterprise 模式（`mcpjungle init-server`、`create mcp-client --allow`）或在 nginx 加驗證。MCPJungle dashboard（`location /`）**MUST NOT** 對公網開放，只 allow 內網段。
18. **MUST** docs-mcp 等內層 server 不發佈 port（compose 內沒有 `ports:`），只在 `mcpjungl` 網路可達；dev 可不設 token，對外硬化時設 `DOCS_MCP_AUTH_TOKEN` 並在 `servers/*.json` 加 `bearer_token`。
19. **MUST** 機密只放 `.env`（已 `.gitignore`）或 GitOps 工具的 env 編輯器 / GitHub secrets。本 repo 用到的機密名稱：
    `MCPJUNGLE_DATABASE_URL`、`DOCS_MCP_AUTH_TOKEN`、`MCP_AUTH_TOKEN`、`FC_MCP_AUTH_TOKEN`、`GHCR_PAT`、`NPM_TOKEN`、`HF_TOKEN`（`GITHUB_TOKEN` 為內建）。

### CI / 發佈

20. **MUST** 所有 workflow 的 `uses:` 釘**完整 commit SHA**並在行尾註解版本（`@<40-char-sha>  # v7`）。WHY：`83cb805`——org policy 要求 SHA 釘選。
    注意：其他團隊 skill（`elf-stack` 等）寫 `@v5` 版本標籤，與本 repo 衝突，見待確認。
21. **MUST** GHCR 登入用 `password: ${{ secrets.GHCR_PAT || secrets.GITHUB_TOKEN }}`，**MUST NOT** 改成 step `if: secrets...`。
    WHY：`5c42768`——`secrets` context 不能用在 step `if:`（報 `Unrecognized named-value: 'secrets'`）。
22. **MUST** `docker-publish.yml` 維持：matrix 每個 image 一筆（`docs-mcp-server` → `./mcp/docs-mcp-server`、`docs-registrar` → `./mcpjungle`（自訂 `dockerfile`）、
    `fc-designer-mcp` → `./mcp/legacy/fc-designer-mcp`、`sqlsugar-mcp` → `./mcp/legacy/sqlsugar-mcp/sqlsugar-mcp-server`；context 已隨 `fb1d578` 搬到 `mcp/` 下，image 名**不變**以免線上斷）、`linux/amd64,linux/arm64`、
    `metadata-action` tags（semver 三層、branch、`sha-<short>`、預設分支 `latest`、手動 tag）、GHA cache `scope=<image>`、`provenance: false`。
23. **MUST** 新 server 同 PR 加進：`docker-publish.yml` matrix、`ci.yml` 的 `build-test` 與 `docker-build` matrix、`dependabot.yml`（含 `semver-major` ignore）。範本 `templates/docker-publish.matrix-entry.yml`。
    WHY：證據 E4——核心 `docs-mcp-server` 至今不在 CI matrix 與 dependabot；證據 E3——拿掉 major ignore 後主版本分岔。
24. **MUST** commit / PR 標題走 Conventional Commits（CI `basics` 用 `webiny/action-conventional-commits` 擋）。

---

## 3. 標準範本與操作

| 檔案 | 用途 |
|---|---|
| `templates/docker-compose.mcpjungle.yml` | 現行正式 compose（原樣） |
| `templates/.env.example` | 所有 env 與預設值說明 |
| `templates/Dockerfile.registrar`、`templates/registrar.sh` | registrar（原樣，**不可精簡**） |
| `templates/servers/*.json` | 四種註冊檔 |
| `templates/group.json` | tool group（`mcpjungle create group -c group.json` → `/v0/groups/<name>/mcp`） |
| `templates/nginx.example.conf` | 對外反向代理（改 ① server_name ② 憑證 ③ `<GATEWAY_LAN_IP>`） |
| `templates/docker-publish.matrix-entry.yml` | 新 server 要加的 CI / publish / dependabot 片段 |

部署（根目錄）：

```bash
docker compose up -d --build                           # 零設定即可起（DB 內建）；build 法：現場 build 最新源碼
cp .env.example .env                                   # 只在要改預設值時才需要（密碼、外部 DB、port、TZ…）
docker compose -f docker-compose.pull.yml up -d        # pull 法：拉 GHCR 映像（docs-mcp-server、docs-registrar，pull_policy: always）
# GHCR 為 private 時，部署端先：echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
```

驗證（每次部署後）：

```bash
docker compose ps                                                     # mcpjungle-server Up、docs-mcp-server Up、registrar Exited (0)
docker logs $(docker compose ps -aq registrar)                        # 「registrar: 完成」＋清單
docker exec mcpjungle-server /mcpjungle list servers
docker exec mcpjungle-server /mcpjungle list tools
docker exec mcpjungle-server /mcpjungle invoke sqlsugar-zh-tw__docs_list_corpora --input '{}'
curl -s http://<host>:18800/health                                    # 外部可達性（經 nginx 則打 https://<domain>/health）
```

用戶端連線：`http://<host>:18800/mcp`（全部工具）、`http://<host>:18800/v0/groups/<group>/mcp`（tool group）；對外一律 `https://<domain>/mcp`。

修改既有註冊（registrar 冪等不會覆寫）：

```bash
docker exec mcpjungle-server /mcpjungle deregister <name>
docker compose up -d --force-recreate registrar
```

手動註冊（host 上裝官方 CLI）：`REGISTRY=http://localhost:18800 ./register.sh [per-book|all|none]`，`WITH_TOOLS=0` 略過官方工具。

---

## 4. 禁止簡化

> 每條附證據（`references/simplification-evidence.md`）或 commit。違反須在 PR 說明並取得人工同意。

1. **MUST NOT** 移除 registrar 的等待 / 重試 / 冪等任一段，或把上限調到「不重試」。WHY：`3eaebfd` 修的競態；沒有 healthcheck-gated `depends_on`，重試是唯一保護。
2. **MUST NOT** 把 registrar 改回 bind mount 或刪掉 `Dockerfile.registrar`。WHY：`54a9c08`。
3. **MUST NOT** 把 gateway runtime 降回 Node 20、移除 uv / `tzdata`、或改用不含 npx/uvx 的 image。WHY：`67b8864`、`bafd8e8`。
4. **MUST NOT** 把 `MCP_SERVER_INIT_REQ_TIMEOUT_SEC` 改回 10 或刪掉。WHY：`bafd8e8`（npx 首次下載）。
5. **MUST NOT** 刪 nginx `/mcp` 的 SSE 設定、rate limit、`/health` 例外、dashboard 限內網。WHY：`nginx.example.conf` 註解的每一行都對應一個「極難查」的故障。
6. **MUST NOT** 把 action 從 SHA 改回 `@vN` 標籤，或新增未釘 SHA 的 `uses:`。WHY：`83cb805` org policy。
7. **MUST NOT** 把 GHCR 登入的 `||` fallback 拆成 step `if:`。WHY：`5c42768`。
8. **MUST NOT** 刪 `dependabot.yml` 的 `semver-major` ignore（新增時一律帶上），或把 server 從 CI matrix 拿掉。WHY：證據 E3、E4。
9. **MUST NOT** 刪發版能力而不留替代。WHY：證據 E1——`0115d50` 刪了 `release.yml`（建 tag / Release / dispatch publish），之後沒有任何東西產生 `v*.*.*` tag，`docker-publish` / `npm-publish` 的 tag 觸發形同虛設。要恢復請依 `elf-cicd-versioning`。
10. **MUST NOT** 在 `servers/*.json` 寫明文 token，或把 `description` 簡化成一個詞。WHY：安全；證據 E10。
11. **MUST NOT** 改 compose service 名 / container 名 / image 名而不全域搜尋更新 README 與 CLAUDE.md。WHY：證據 E11（`docs-mcp` → `docs-mcp-server` 後 README 指令失效）。

---

## 5. 檢查清單

- [ ] `.env` 只含 `.env.example` 列出的變數（全部選用）；用內建 DB 時**不要**設 `MCPJUNGLE_DATABASE_URL`，改密碼則兩處同步
- [ ] `docker compose config` 無錯；gateway `build.context: ./MCPJungle`、`Dockerfile.fullbuild`
- [ ] `MCP_SERVER_INIT_REQ_TIMEOUT_SEC=30`、四服務 `TZ`；`postgres` 有 healthcheck 且 gateway `depends_on: service_healthy`
- [ ] 新 `servers/<name>.json`：name 合規且唯一、description 列齊工具、無明文 token
- [ ] `REGISTER_LIST` 兩處（registrar.sh / dockhand compose）按需更新
- [ ] registrar `Exited (0)`；`list servers` / `list tools` / 一次 `invoke` 成功並貼到 PR
- [ ] 對外：nginx 範本三處已改；dashboard 限內網；development 模式未直接暴露公網
- [ ] workflow 新增的 `uses:` 皆為完整 SHA＋版本註解
- [ ] 新 image 已加 docker-publish / ci / dependabot（含 semver-major ignore）
- [ ] README / CLAUDE.md 的服務名、預設清單、port 已同步

---

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| `duplicate key value violates unique constraint "idx_mcp_servers_name" (SQLSTATE 23505)` | 同名 server 已被 registrar 自動註冊 | 換 name，或先 `deregister` |
| registrar `mkdir /app: read-only file system` | GitOps 工具下使用相對 bind mount | 用烤好設定的 `docs-registrar` image（`54a9c08`） |
| registrar 反覆「上游尚未就緒」後放棄 | docs-mcp 啟動失敗或不在 `mcpjungl` 網路 | `docker logs docs-mcp-server`；確認 `networks: [mcpjungl]` |
| registrar「等 gateway 逾時(120s)」 | gateway 連不上 DB：改了 `POSTGRES_PASSWORD` 卻沒同步 `MCPJUNGLE_DATABASE_URL`，或覆寫的外部 DB 位址不通 | `docker logs mcpjungle-server`；兩處密碼對齊（規則 2b），或移除覆寫回用內建 DB |
| stdio server 註冊時 init timeout | `npx -y` 首次下載慢 | `MCP_SERVER_INIT_REQ_TIMEOUT_SEC=30`（或更高） |
| stdio server 啟動即崩、log 有 `enableCompileCache is not a function` | gateway runtime Node 20 | Node 22（`67b8864`） |
| 起 stack 報 container name `mcpjungle-server` already in use | 同機已有 gateway | 停舊的，或改用 dockhand compose 接現有 gateway |
| 能呼叫工具但收不到回應 / 60 秒斷線 | nginx buffer SSE、預設 timeout | 依規則 16 |
| Actions 報 `Unrecognized named-value: 'secrets'` | 在 step `if:` 用了 secrets | 改 `password: ${{ secrets.GHCR_PAT \|\| secrets.GITHUB_TOKEN }}` |
| workflow 被 org 拒絕執行 | `uses:` 未釘 SHA | 釘完整 SHA（`83cb805`） |
| pull 法部署後內容沒更新 | main 的 Action 尚未推完新 `latest` | 看 Actions 完成再 `up -d`（`pull_policy: always`） |
| `docker compose build docs-mcp` 報 no such service | service 已改名 `docs-mcp-server` | 用新名字（證據 E11） |
| 時間顯示差 8 小時 | 容器沒設 TZ / 沒裝 tzdata | 規則 7 |

---

## 7. 待確認

1. **Action 版本策略衝突**：本 repo org policy 要求 SHA 釘選（`83cb805`），其他團隊 skill 寫 `actions/*@v5`；以哪個為團隊標準。另 `npm-publish.yml` 釘的 checkout（v6）/ setup-node（v4）與 ci.yml（v7 / v6）不一致（證據 E12）。
2. **PR AI review**：團隊標準要求 Claude AI review（`elf-cicd-review`），本 repo `.github/workflows/` 目前**沒有** claude-review workflow。
3. **發版流程**：`release.yml` 已刪（證據 E1），`v*.*.*` tag 目前靠人工推；是否導入 `elf-cicd-versioning`。
4. **公網存取模型**：gateway 目前 `SERVER_MODE=development`（無用戶端驗證），nginx 範例也未加驗證；對外開放前要選 enterprise 模式或 nginx 層驗證。
5. `bearer_token: "${VAR}"` 展開：fork 的 CLI 有此功能（`cmd/config_reader_env_test.go`），但 registrar 用的是**上游** `ghcr.io/mcpjungle/mcpjungle:latest-stdio` 為 base，且 compose 的 registrar 目前沒有傳 `DOCS_MCP_AUTH_TOKEN`；硬化時需實測並補 env。
6. CI Node 版本：`ci.yml` / `npm-publish.yml` 用 `node-version: 20`，與團隊 Node 24.18、Docker `node:26-alpine`、gateway Node 22 皆不同。
7. TZ 與 DB：gateway 設 `TZ=Asia/Taipei`；MCPJungle 寫入 Postgres 的時間欄位型別（timestamp vs timestamptz）未查證，是否符合團隊「DB 一律 UTC」。
8. `docker-compose.localtest.yml` 與正式 stack 已三處不一致：① 仍用上游 image、無 TZ / timeout 30 ② 仍是雙網路（`shared-db` ＋ `mcpjungl`）寫法，而 `shared-db/` 目錄已隨 `a39e3eb` 移除
   ③ **`build: ../docs-mcp-server` 路徑在 `fb1d578` 之後已失效**（現為 `../mcp/docs-mcp-server`），照註解執行會 build 失敗。是否同步或廢除。
9. 根 README 寫用戶端可連 `http://<host>:18800/mcp/<corpus>`——MCPJungle 本身的路由是 `/mcp` 與 `/v0/groups/<group>/mcp`，此寫法是否正確待實測。
10. 備援（README「公司一套、家裡一套」）：兩套 gateway 的 DB 與註冊同步方式未文件化。
11a. **`mcpjungle/nginx.example.conf` 在 mcp-library 裡從未 `git add`**（實測 2026-10-04，`git ls-files --error-unmatch` 回非零）。
    本 skill 規則 16 與禁止簡化 5 都以它為權威出處，但重新 clone 的人拿不到——要嘛把它提交上去，要嘛改以本 skill 的 `templates/nginx.example.conf` 為準。
    同樣未納管的還有 `AGENTS.md`、`.mcp.json`、`docs/superpowers/**`。
11. docs-mcp-server 在 compose 內沒有 healthcheck（獨立 compose 有）；是否補上並讓 registrar `depends_on: condition: service_healthy`（不取代重試）。

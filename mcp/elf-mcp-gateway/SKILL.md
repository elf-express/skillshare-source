---
name: elf-mcp-gateway
description: |
  Elf Express MCPJungle gateway 部署與註冊規範：vendored fork 從源碼 build、docker compose（內建 Postgres + gateway + docs-mcp + 一次性 registrar，零設定可起）、
  書本註冊設定由產生器輸出、mcpjungle/registry/*.json 註冊檔格式、registrar 驗證 / 重試 / 冪等、REGISTER_LIST、工具群組、Dockhand / pull 部署、nginx 反向代理（SSE）、
  GHCR 發佈（GHCR_PAT fallback）、SHA 釘選的 GitHub Actions、環境變數與安全（SERVER_MODE、bearer token、dashboard 不外露）。
  當任務涉及 mcpjungle/ 目錄、compose*.yaml（CI 只允許根目錄 compose.yaml / compose.pull.yaml / compose.attach.yaml 三份，ci.yml:64-66）、
  mcpjungle/registry/、registrar.sh、gen-book-configs.mjs、gen-group-configs.mjs、registry/*.json、registry/groups/*.json、
  MCPJungle 設定或升級、nginx.example.conf、docker-publish.yml / ci.yml，或排查「gateway 看不到工具 / 註冊失敗 / 連不上」時觸發。
metadata:
  version: 1.2.0
  owner: Elf Express
---

# MCPJungle Gateway 部署與註冊（Elf Express）

> 參考實作：`elf-express/mcp-library` 的 `mcpjungle/`、根目錄 `compose.yaml` / `compose.pull.yaml` / `compose.attach.yaml`、`.github/workflows/`。行號以 `origin/release` @ `73b8206` 為準。
> 架構：**AI 工具只連一個 MCPJungle**；gateway 後面掛 9 個 server：`docs-mcp-server` 的 6 份語料（`sqlsugar-zh-tw` / `fc-zh-tw` / `nginx-en` / `opnsense-en` / `opnsense-zh-tw` / `stalwart-en`，每本書一個 server），
> 加上官方 stdio server `filesystem` / `fetch` / `time`；registrar 另建工具群組 `claude-tools`（全部書本 + `fetch` + `time`，端點 `/v0/groups/claude-tools/mcp`）（`README.md:62`）。

相關 skill：
- **`elf-mcp-knowledge`** — 新增知識庫的主流程（本 skill 是其中「註冊 / 部署 / 驗證」三步的細節）
- `elf-mcp-server` — server 本身的寫法
- `elf-cicd-docker`（映像規範）、`elf-cicd-review`（PR AI review）、`elf-cicd-versioning`（版號 / tag）、`elf-stack`

---

## 1. 何時使用

- 部署 / 重佈 gateway stack（`compose.yaml` / `compose.pull.yaml` / `compose.attach.yaml`）；換 DB、換 port、改網路
- 新增 / 修改書本（`corpus.json`，由 `gen-book-configs.mjs` 產生註冊設定）、`mcpjungle/registry/*.json`、`registry/optional/*.json`、`REGISTER_LIST`、tool group（`registry/groups/*.json`）
- 升級 vendored MCPJungle fork（`mcpjungle/gateway/`）、改 `mcpjungle/gateway/Dockerfile.fullbuild`
- 對外開放（nginx / HTTPS / token）
- 改 `.github/workflows/docker-publish.yml`、`.github/workflows/ci.yml`、`.github/dependabot.yml`
- 排查：registrar 失敗（含註冊前驗證 exit 1）、23505 重名、stdio server 起不來、SSE 收不到回應

---

## 2. 固定規則

### 拓撲與 compose

1. **MUST** 以根目錄 `compose.yaml` 為正式入口（單一檔案，沒有 `include`）；**四個**服務：
   `postgres`（`compose.yaml:10-25`，`postgres:16-alpine`，**不對外開 port**，volume `pgdata`）、
   `mcpjungle`（`:27-48`，`${MCPJUNGLE_HOST_PORT:-18800}:8080`）、`docs-mcp-server`（`:50-69`，:5690，只在內網）、`registrar`（`:72-91`，一次性，`restart: "no"`）。
   container 名由 compose 依 project 產生（如 `mcp-library-mcpjungle-1`），不寫死；進容器用 `docker compose exec <service>`（`AGENTS.md:47`）。
   docs-mcp 的 build 是 `context: ./mcpjungle` 加 `dockerfile: docs-mcp-server/Dockerfile`（`compose.yaml:51-53`；`a196fdf` 把 server 與語料搬進 `mcpjungle/`）。
2. **MUST** 維持「**DB 內建、零設定可起**」：stack 自帶 `postgres` service，`mcpjungle` 的 `DATABASE_URL` 預設值是
   `postgres://mcpjungle:mcpjungle@postgres:5432/mcpjungle?sslmode=disable`（`compose.yaml:38`；**服務名** `postgres`，在 `mcpjungl` 網路內解析），
   gateway 以 `depends_on: postgres: condition: service_healthy` 等 DB 就緒（`:33-35`）。`docker compose up -d --build` 不必先 `cp .env.example .env`。
   WHY：`878add4`（feat(deploy): bundle Postgres into the stack, drop shared-db）——這條**取代**了早先 `6d25d6f` 的「DB 走外部 IP、stack 不含 Postgres」決策，`shared-db/` 目錄已不存在。
2a. **MUST** 只有要接「既有的外部 DB」才在 `.env` 設 `MCPJUNGLE_DATABASE_URL` 覆寫（host 填該 DB 的 **IP**、port 填它實際監聽的 port）；
   內建那顆容器仍會起，可 `docker compose stop postgres` 關掉（`.env.example:17-21`）。
2b. **MUST** 改內建 DB 密碼時 **`POSTGRES_PASSWORD` 與 `MCPJUNGLE_DATABASE_URL` 兩處同步改**，否則 gateway 連不上 DB（`compose.yaml:9`）。
   `pgdata` volume 的資料 `docker compose down` 不會刪，`down -v` 才會（`compose.yaml:94`）——**MUST NOT** 在正式環境用 `down -v` 當重啟手段。
2c. 網路 `mcpjungl` 由 stack **自建**（實際名 `<project>_mcpjungl`，`compose.yaml:96-98`），不必 `docker network create`。
   原本的自包含端到端測試 compose 已在 `e563c9e` 刪除（待確認 8）；並存測試改用 `MCPJUNGLE_HOST_PORT=18900 IMAGE_TAG=mcp-test docker compose -p mcp-test up -d --build`（`compose.yaml:6`、`README.md:90-96`）。
3. **MUST** 分清兩個位址：`--registry http://<host>:18800`（CLI → gateway）與書本註冊設定裡的 `${DOCS_MCP_URL}/mcp/<id>`（gateway → server）。
   後者由產生器寫入（`mcpjungle/registry/gen-book-configs.mjs:63`），`DOCS_MCP_URL` 預設 `http://docs-mcp-server:5690`（`gen-book-configs.mjs:5`），用**服務名**在 `mcpjungl` 內解析；不寫在任何手寫註冊檔裡。
4. **MUST** gateway image 從 vendored fork 源碼 build：`context: ./mcpjungle/gateway`、`dockerfile: Dockerfile.fullbuild`、`image: mcpjungle-fork:${IMAGE_TAG:-latest}`、`pull_policy: build`（`compose.yaml:28-32`）。
   來源是 `75c0649`（vendor fork 源碼）；`31722f7` 把源碼搬到 `mcpjungle/gateway`。
5. **MUST** gateway runtime 保持 **Node 22+ 與 uv**（`mcpjungle/gateway/Dockerfile.fullbuild:44-52` stage 3：`ghcr.io/astral-sh/uv:debian` + nodesource `setup_22.x` + `tzdata`）。
   WHY：`67b8864`——Node 20 跑不動使用 Node 22 API 的 stdio server（`@smartbear/mcp` 用 `module.enableCompileCache`）；`npx` / `uvx` 是 stdio server 的前提。
6. **MUST** `MCP_SERVER_INIT_REQ_TIMEOUT_SEC` 預設 **30**（`compose.yaml:41`）。WHY：`bafd8e8`——`npx -y` 首次執行要下載套件，10 秒不夠。
7. **MUST** 四個服務都設 `TZ: ${TZ:-Asia/Taipei}`（含 `postgres`，`compose.yaml:16,42,61,89`），gateway image 安裝 `tzdata`（`bafd8e8`）。TZ 只影響日誌 / 顯示；DB 時間欄位依 `elf-postgresql` 以 UTC `timestamptz` 儲存。
8. **MUST** 要接「現有」gateway 時用 `compose.attach.yaml`（只起 docs-mcp + registrar，加入 external 網路 `MCPJUNGLE_NETWORK`，預設 `mcp-library_mcpjungl`），**MUST NOT** 再起第二個 gateway。
   出處（mcp-library `origin/release` @ `73b8206`）：`compose.attach.yaml:1`、`CLAUDE.md:130`、`AGENTS.md:29`、`mcpjungle/README.md:117`。這些檔只寫了規則、沒寫理由，理由列在待確認「為什麼不能再起第二個 gateway」。

### 註冊

本節是註冊的權威版本；其他規則、第 3 節操作、第 5 節檢查清單只指向這裡，`elf-mcp-knowledge` Step 4／Step 6 的指令與預期輸出跟本節逐字一致。**書本註冊設定只以產生器的輸出為準**：registrar 啟動時由 `mcpjungle/registry/gen-book-configs.mjs` 依各書 `corpus.json` 產生，連同 `registry/*.json` 註冊進 gateway（`registrar.sh:2-3`），不手寫、不進 repo。行號以 mcp-library `origin/release` @ `73b8206` 為準；以下指令都在 mcp-library repo 根目錄執行。

**A. 新增一本書：三步，每步都附指令、預期輸出、停止條件**

- **步驟 1（不手寫註冊檔）**：不新增任何註冊檔，`REGISTER_LIST` 保持空白（預設）。
  指令 `docker compose config | grep REGISTER_LIST`，預期 `REGISTER_LIST: ""`（接現有 gateway 時加 `-f compose.attach.yaml`）；GitOps 工具則看它的 env 編輯器有沒有設 `REGISTER_LIST`。
  有值就停，見 B 表第 2 列。
- **步驟 2（部署前驗證）**：
  指令 `node mcpjungle/registry/gen-book-configs.mjs mcpjungle/books "$(mktemp -d)"`，預期 exit 0，印出的 id 包含 `<id>`（`73b8206` 印出 6 個 id）。
  exit 1 就停，修 `corpus.json`（原因見 B 表第 4 列）；這時 registrar 也會整批不註冊。
- **步驟 3（部署後驗證）**：五條指令都要跑，每條都要符合預期：

  ```bash
  docker compose logs registrar                                   # 應有「>> 註冊 <id>」且 Exited (0)
  docker compose exec mcpjungle /mcpjungle list servers           # 有 <id>
  docker compose exec mcpjungle /mcpjungle list tools | grep '<id>__'        # 無條件工具 4 個 + 能力工具
  docker compose exec mcpjungle /mcpjungle invoke <id>__docs_list_corpora --input '{}'
  docker compose exec mcpjungle /mcpjungle invoke <id>__docs_search --input '{"query":"<該領域關鍵字>"}'
  ```

  `docs_list_corpora` 在單書端點只會列 `<id>` 自己，且標題行要帶正確 badge（速查表 / 代碼範例 / 符號查）；`docs_search` 要有結果。
  接現有 gateway（`compose.attach.yaml`）時，`exec mcpjungle` 改在現有 gateway 的 compose 專案執行：`compose.attach.yaml` 只有 `docs-mcp-server`、`registrar` 兩個 service（`compose.attach.yaml:10`、`:16`），`gateway` 是外部網路（`:28-31`），沒有 `mcpjungle`；`logs registrar` 則寫成 `docker compose -f compose.attach.yaml logs registrar`。
  不能只看 `list servers`。任一項不符就停，查 B 表。

**B. 症狀 → 原因 → 處理（registrar 的四種行為）**

| 症狀 | 原因 | 處理 |
|---|---|---|
| registrar 印出「…(未註冊任何 server)」並 exit 1，整批都沒註冊 | 註冊前驗證失敗，由 `fail`（`registrar.sh:24`）整批中止：語料設定不合法（`:27`）；`registry/*.json` 跟語料 id 同名（`:34`）；`REGISTER_LIST` 列了找不到設定檔的名稱（`:54-56`）；群組設定不合法（`:29`） | 依訊息修正，再 `docker compose run --rm registrar` |
| 新書沒註冊，其他書正常 | `REGISTER_LIST` 有值時只註冊列出的名稱（`registrar.sh:44-45`） | 清空 `REGISTER_LIST` 或補上 `<id>` |
| 改了 description／url 沒生效；改名後舊名還在 | 已註冊的直接略過（`registrar.sh:68-75`）；改名只新增、不移除 | `docker compose exec mcpjungle /mcpjungle deregister <名稱>`，再 `docker compose run --rm registrar` |
| `gen-book-configs` exit 1，訊息指向 id | id 規則：`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`、最多 30 字元（`gen-book-configs.mjs:10-11`）；不可重複（`:40`）；`book` 等於書資料夾名，id 等於 `<book>-<language 小寫>` 或 `<book>-bi`（`:52-55`） | 改資料夾名或 `corpus.json` |

9. **MUST** 非書本註冊檔（`mcpjungle/registry/<name>.json`、`registry/optional/<name>.json`）依 MCPJungle `RegisterServerInput`（`mcpjungle/gateway/pkg/types/mcp_server.go:49`）撰寫；書本不手寫，走上面 A。下表只適用非書本設定，欄位：

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
   mcp-library 現行對照：stdio 看 `mcpjungle/registry/fetch.json`、`filesystem.json`、`time.json`；streamable_http 看 `registry/optional/docs.json`。
   檔名（不含 `.json`）就是 `name`，不可跟語料 id 同名（`registrar.sh:34`）。`bearer_token` 的 `${ENV_NAME}` 能不能在 registrar 映像裡展開還沒驗證（待確認 5）。
10. **MUST** 非書本 server 依需求走下面兩條路之一，並遵守後面的限制：
    - **不需要 token**：放 `mcpjungle/registry/<name>.json`。`compose.yaml` 預設會註冊（`REGISTER_EXTRAS` 預設 1，`compose.yaml:87`）；`compose.attach.yaml` 預設不註冊（預設 0，`compose.attach.yaml:25`）。
    - **點名才註冊**：放 `mcpjungle/registry/optional/<name>.json`。`optional/` 的意義是「點名才註冊」，不是「需要 token」（`optional/docs.json` 沒有 token）。預設清單只收產生器輸出（`$GEN`）與 `registry/*.json`（`registrar.sh:47-51`）；`optional/` 只在 `config_of` 查名稱時用到（`:37-42`）。
      只准用一次性指令註冊：`docker compose run --rm -e REGISTER_LIST=<名稱> registrar`。
    - **MUST NOT** 把 `REGISTER_LIST` 寫進 `.env`（或 GitOps 工具的 env）。WHY：有值時只註冊列出的名稱（`registrar.sh:44-45`），之後新加的書都不會被註冊，也不會報錯。
    - 需要 token 的 server（如 github）：token 怎麼傳進 registrar 容器還沒驗證（待確認 5），維持停止條件：**需要 token 時停下來回報**。
    - **MUST NOT** 把 token 寫進 `registry/*.json`（含 `optional/`），也不能烤進映像。WHY：`registry/Dockerfile:6-7` 會把 `registry/*.json` 與 `optional/` 整包 COPY 進 `docs-registrar` 映像，推到 GHCR。
      mcp-library `mcpjungle/README.md:95-100` 目前教人把 PAT 明文放進 `optional/`，不要照做，追蹤 E-325（高優先）。
    - 範本細節見 E-317；CI 與 Dependabot 見 `elf-mcp-knowledge` 路線 C 與本 skill 規則 23。
11. **MUST** 知識語料採**策略 A**：每本書一個 server，名稱＝語料 id，位址由產生器寫成 `${DOCS_MCP_URL}/mcp/<id>`（`gen-book-configs.mjs:63`），工具 `<id>__docs_search`；這是預設，不必設定（`mcpjungle/README.md:68`）。
    策略 B（整包一個 `docs`，`registry/optional/docs.json`，工具 `docs__docs_*`，用 `corpus` 參數選書）只當補充入口，依規則 10 點名註冊（`mcpjungle/README.md:69`）。
    B 是手寫檔，設了 `DOCS_MCP_AUTH_TOKEN` 也不會自動帶 `bearer_token`（`mcpjungle/README.md:69`）；要加就屬於規則 10 的「需要 token」，停下來回報。
    WHY：A 才能在 gateway 以 server 為單位做 tool group 與 enterprise ACL（`registry/groups/claude-tools.json` 的 `"@books"` 展開成全部書本 server，`mcpjungle/README.md:73`）。

### registrar

12. **MUST** registrar 以 `mcpjungle/registry/Dockerfile` 把各書 `books/`、`registry/*.json`、`registry/optional/`、`registry/groups/` 與腳本（`registrar.sh`、`gen-book-configs.mjs`、`gen-group-configs.mjs`）**烤進 image**（`ghcr.io/elf-express/docs-registrar`，`registry/Dockerfile:4-10`），**MUST NOT** 改回 bind mount。
    WHY：`54a9c08`——Dockhand / Portainer 把 repo clone 進自己的容器，相對 bind mount 由 host daemon 解析，報 `mkdir /app: read-only file system`；現況的說明在 `registry/Dockerfile:3`。
13. **MUST** 保留 `mcpjungle/registry/registrar.sh` 的三段邏輯：等 gateway（每 2 秒、上限 60 次＝120 秒，`registrar.sh:60-65`）→ 每個 server 註冊重試（3 秒、上限 20 次，`:77-84`）→ 冪等（`list servers` 已有則略過，`:68-75`）。
    另兩段同樣保留：註冊前先驗證，不合法就整批不註冊（`:24-56`）；任一 server 或群組失敗時最後 exit 1（`:105`）。各情況的症狀與處理見〈註冊〉B 表。
    WHY：`3eaebfd`——docs-mcp 尚未監聽時註冊會 connection refused；冪等讓每次 push 後 redeploy 安全。
14. 註冊見第 2 節〈註冊〉。**MUST NOT** 為新 server 改 `REGISTER_LIST`。
15. registrar 結束 `Exited (0)` 是**正常**；`docker compose logs registrar` 應見「registrar: 完成,目前 servers:」與清單（`registrar.sh:87`）。
    例外：任一 server 或群組註冊失敗時印「registrar: 註冊失敗:…」並 exit 1（`registrar.sh:105`）；註冊前驗證失敗也是 exit 1（〈註冊〉B 表第 1 列）。

### 對外與安全

16. **MUST** 對外只經 nginx（`templates/nginx.example.conf`；mcp-library 現行版在根目錄 `nginx.example.conf`，`e563c9e` 搬移）：TLS、`limit_req 10r/s burst 20`、`limit_conn 20`、`/health` 免限流；
    `/mcp` 必須 `proxy_http_version 1.1`、`Connection ""`、`proxy_buffering off`、`proxy_cache off`、`proxy_read_timeout/send_timeout 3600s`、透傳 `Authorization`；`client_max_body_size 8m`（對齊 express 8mb）。
    出處：`nginx.example.conf:19-20,48,51-54,60-79,83-89`。
    WHY：少任何一行 SSE 就會「能呼叫工具但收不到串流回應」。
17. **MUST** `SERVER_MODE=development` 時 gateway **不驗證用戶端**——只能在內網使用（預設值見 `compose.yaml:39`）；要對公網開放，必須切 enterprise 模式（`mcpjungle init-server`、`create mcp-client --allow`）或在 nginx 加驗證。MCPJungle dashboard（`location /`）**MUST NOT** 對公網開放，只 allow 內網段（`nginx.example.conf:83-89`）。
18. **MUST** docs-mcp 等內層 server 不發佈 port（`compose.yaml:50-69` 沒有 `ports:`），只在 `mcpjungl` 網路可達；dev 可不設 token。
    對外硬化時設 `DOCS_MCP_AUTH_TOKEN`（容器內是 `MCP_AUTH_TOKEN`，`compose.yaml:59-60`；registrar 也收到同一值，`:85`），書本註冊設定的 `bearer_token` 由產生器自動加上（`gen-book-configs.mjs:65`），不手寫。
19. **MUST** 機密只放 `.env`（已 `.gitignore`）或 GitOps 工具的 env 編輯器 / GitHub secrets。本 repo 用到的機密名稱（`.env.example:11-28`、`.github/workflows/docker-publish.yml:66-74`）：
    `MCPJUNGLE_DATABASE_URL`、`POSTGRES_PASSWORD`、`DOCS_MCP_AUTH_TOKEN`（容器內是 `MCP_AUTH_TOKEN`，`compose.yaml:60`）、`GHCR_PAT`（`GITHUB_TOKEN` 為內建）。
    已移除：`FC_MCP_AUTH_TOKEN`（`0a37607`）、`NPM_TOKEN`、`HF_TOKEN`（`cf42e88`）。

### CI / 發佈

20. **MUST** 所有 workflow 的 `uses:` 釘**完整 commit SHA**並在行尾註解版本（`@<40-char-sha>  # v7`）。WHY：`83cb805`——org policy 要求 SHA 釘選。
    注意：其他團隊 skill（`elf-stack` 等）原用 `actions/*` 版本標籤；已決改釘 SHA（E-302），見待確認第 1 條與 elf-stack 3.5。
    現況（mcp-library `origin/release` @ `73b8206`）：`ci.yml:114,149,175` 的 setup-node 註解寫 `# v6`，實際是 v7.1.0，違反本規則，追蹤 E-324。
21. **MUST** GHCR 登入用 `password: ${{ secrets.GHCR_PAT || secrets.GITHUB_TOKEN }}`（`.github/workflows/docker-publish.yml:66-74`），**MUST NOT** 改成 step `if: secrets...`。
    WHY：`5c42768`——`secrets` context 不能用在 step `if:`（報 `Unrecognized named-value: 'secrets'`）。
22. **MUST** `.github/workflows/docker-publish.yml` 維持：matrix 每個 image 一筆，現有 2 筆、context 都是 `./mcpjungle`（`docs-mcp-server` → `dockerfile: ./mcpjungle/docs-mcp-server/Dockerfile`、`docs-registrar` → `dockerfile: ./mcpjungle/registry/Dockerfile`，`docker-publish.yml:44-54`）；
    `docs-mcp-server` 的 context 先隨 `f8b7416` 搬到 `mcp/`，再隨 `a196fdf` 搬進 `mcpjungle/`，image 名**不變**以免線上斷；fc、sqlsugar 兩個 legacy 映像（`0a37607` 移除）已不在 matrix。
    觸發：push `release`、`v*.*.*` tag、`workflow_dispatch`（`:15-21`）。`linux/amd64,linux/arm64`（`:103`）、
    `metadata-action` tags（`:82-89`；semver 三層、branch、`sha-<short>`、`latest` 只在 `refs/heads/release` 產生（`:88`）、手動 tag）、GHA cache `scope=<image>`（`:107-108`）、`provenance: false`（`:109`）。
23. **MUST** 新 server 同 PR 加進：`docker-publish.yml` matrix、`ci.yml` 的 `build-test` 與 `docker-build` matrix、`dependabot.yml`（含 `semver-major` ignore）。範本 `templates/docker-publish.matrix-entry.yml`。
    WHY：證據 E4——核心 `docs-mcp-server` 至今不在 CI matrix 與 dependabot；證據 E3——拿掉 major ignore 後主版本分岔。
    現況（mcp-library `origin/release` @ `73b8206`）：`dependabot.yml` 沒有 `semver-major` ignore，違反本規則，追蹤 E-323。
    現行位置：`build-test` matrix 在 `.github/workflows/ci.yml:161-166`；`docker-build` matrix 在 `ci.yml:214-224`，另含 `mcpjungle-gateway`；dependabot 的 ecosystem 清單在 `.github/dependabot.yml:4-51`。
    證據 E4 已解決：`55153b2` 把 `docs-mcp-server` 納入 CI matrix（`ci.yml:163,216`）；dependabot 的條目由 `0a37607` 加入（`dependabot.yml:4-10`）。
24. **MUST** commit / PR 標題走 Conventional Commits（CI `basics` 用 shell regex 只檢查 PR 裡的 commit，type 另外允許 `deploy`（`.github/workflows/ci.yml:40-60`，`55153b2`）；不檢查 PR 標題，PR 標題要人工確認）。

---

## 3. 標準範本與操作

| 檔案 | 用途 |
|---|---|
| `templates/docker-compose.mcpjungle.yml` | 正式 compose；mcp-library 現行是根目錄 `compose.yaml`（`compose.yaml:7-98`） |
| `templates/.env.example` | 所有 env 與預設值說明 |
| `templates/Dockerfile.registrar`、`templates/registrar.sh` | registrar（**不可精簡**）；mcp-library 現行是 `mcpjungle/registry/Dockerfile` 與 `mcpjungle/registry/registrar.sh` |
| `templates/servers/*.json` | 四種註冊檔；mcp-library 現行的非書本註冊檔在 `mcpjungle/registry/*.json`，書本不手寫（見〈註冊〉） |
| `templates/group.json` | tool group（端點 `/v0/groups/<name>/mcp`）；mcp-library 現行放 `mcpjungle/registry/groups/<name>.json`，格式由 `mcpjungle/registry/gen-group-configs.mjs:13-50` 驗證，registrar 建立或更新（`registrar.sh:90-104`） |
| `templates/nginx.example.conf` | 對外反向代理（改 ① server_name ② 憑證 ③ `<GATEWAY_LAN_IP>`）；mcp-library 現行是根目錄 `nginx.example.conf` |
| `templates/docker-publish.matrix-entry.yml` | 新 server 要加的 CI / publish / dependabot 片段（現行位置見規則 22、23） |

部署（mcp-library repo 根目錄）：

```bash
docker compose up -d --build                           # 零設定即可起（DB 內建）；build 法：現場 build 最新源碼（README.md:75）
cp .env.example .env                                   # 只在要改預設值時才需要（密碼、外部 DB、port、TZ…）
docker compose -f compose.pull.yaml up -d              # pull 法：docs-mcp-server、docs-registrar 拉 GHCR 映像（pull_policy: always，compose.pull.yaml:20,27）；gateway 仍現場 build（README.md:76）
# GHCR 為 private 時，部署端先：echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
```

驗證（每次部署後；容器名由 compose 產生，一律用 service 名，`AGENTS.md:47`）：

```bash
docker compose ps -a                                                  # mcpjungle、docs-mcp-server Up，registrar Exited (0)（README.md:92）
docker compose logs registrar                                         # 「registrar: 完成」＋清單（README.md:93、registrar.sh:87）
docker compose exec mcpjungle /mcpjungle list servers                 # （README.md:94）
docker compose exec mcpjungle /mcpjungle list tools
docker compose exec mcpjungle /mcpjungle invoke sqlsugar-zh-tw__docs_list_corpora --input '{}'
curl -s http://<host>:18800/health                                    # 外部可達性（經 nginx 則打 https://<domain>/health）
```

新增一本書的完整驗證見第 2 節〈註冊〉A 步驟 3。

用戶端連線：`http://<host>:18800/mcp`（全部工具）、`http://<host>:18800/v0/groups/<group>/mcp`（tool group）（`mcpjungle/gateway/internal/api/server.go:213-225`）；對外一律 `https://<domain>/mcp`。

修改既有註冊（registrar 冪等不會覆寫）：

```bash
docker compose exec mcpjungle /mcpjungle deregister <name>      # mcpjungle/README.md:113
docker compose run --rm registrar                               # mcpjungle/README.md:60
```

手動註冊單一 server（舊的 host 端註冊腳本已在 `56e67b6` 刪除，host 不必裝 CLI）：`docker compose run --rm -e REGISTER_LIST="<name>" registrar`（`mcpjungle/README.md:61`）。`<name>` 可以是書本 id、`registry/*.json` 或 `registry/optional/*.json` 的名稱（`compose.yaml:86`）。
只准這樣一次性執行，**不要**把 `REGISTER_LIST` 寫進 `.env`（〈註冊〉規則 10）；要略過 `filesystem` / `fetch` / `time`，同樣一次性加 `-e REGISTER_EXTRAS=0`（`compose.yaml:87`）。

---

## 4. 禁止簡化

> 每條附證據（`references/simplification-evidence.md`）或 commit。違反須在 PR 說明並取得人工同意。

1. **MUST NOT** 移除 registrar 的等待 / 重試 / 冪等任一段，或把上限調到「不重試」。WHY：`3eaebfd` 修的競態；docs-mcp 已有 `service_healthy`（`compose.yaml:81-82`），但 gateway 只有 `service_started`（`compose.yaml:79-80`），等 gateway 與重試仍是唯一保護。
2. **MUST NOT** 把 registrar 改回 bind mount 或刪掉 `mcpjungle/registry/Dockerfile`。WHY：`54a9c08`。
3. **MUST NOT** 把 gateway runtime 降回 Node 20、移除 uv / `tzdata`、或改用不含 npx/uvx 的 image。WHY：`67b8864`、`bafd8e8`。
4. **MUST NOT** 把 `MCP_SERVER_INIT_REQ_TIMEOUT_SEC` 改回 10 或刪掉。WHY：`bafd8e8`（npx 首次下載）。
5. **MUST NOT** 刪 nginx `/mcp` 的 SSE 設定、rate limit、`/health` 例外、dashboard 限內網。WHY：`nginx.example.conf` 註解的每一行都對應一個「極難查」的故障。
6. **MUST NOT** 把 action 從 SHA 改回 `@vN` 標籤，或新增未釘 SHA 的 `uses:`。WHY：`83cb805` org policy。
7. **MUST NOT** 把 GHCR 登入的 `||` fallback 拆成 step `if:`。WHY：`5c42768`。
8. **MUST NOT** 刪 `dependabot.yml` 的 `semver-major` ignore（新增時一律帶上），或把 server 從 CI matrix 拿掉。WHY：證據 E3、E4。
9. **MUST NOT** 刪發版能力而不留替代。WHY：證據 E1——`0115d50` 刪了 `release.yml`（建 tag / Release / dispatch publish），之後沒有任何東西產生 `v*.*.*` tag，`docker-publish`（`.github/workflows/docker-publish.yml:19-20`）/ `npm-publish`（已在 `cf42e88` 刪除）的 tag 觸發形同虛設。要恢復請依 `elf-cicd-versioning`。
10. **MUST NOT** 在 `mcpjungle/registry/*.json`（含 `optional/`）寫明文 token，或把 `description` 簡化成一個詞。WHY：安全；證據 E10。
11. **MUST NOT** 改 compose service 名 / image 名而不全域搜尋更新 README、CLAUDE.md 與 AGENTS.md。WHY：證據 E11（`docs-mcp` → `docs-mcp-server` 後 README 指令失效）。

---

## 5. 檢查清單

- [ ] `.env` 只含 `.env.example` 列出的變數（全部選用）；用內建 DB 時**不要**設 `MCPJUNGLE_DATABASE_URL`，改密碼則兩處同步
- [ ] `docker compose config` 無錯（CI 對 `compose.yaml`、`compose.pull.yaml`、`compose.attach.yaml` 三份各跑 `config -q`，`.github/workflows/ci.yml:71-73`）；gateway `build.context: ./mcpjungle/gateway`、`Dockerfile.fullbuild`（`compose.yaml:28-30`）
- [ ] `MCP_SERVER_INIT_REQ_TIMEOUT_SEC=30`（`compose.yaml:41`）、四服務 `TZ`（`:16,42,61,89`）；`postgres` 有 healthcheck（`:19-23`）且 gateway `depends_on: service_healthy`（`:33-35`）；docs-mcp 也有 healthcheck（`:62-67`），registrar 等它 `service_healthy`（`:81-82`）
- [ ] 書本依〈註冊〉A；非書本 `mcpjungle/registry/<name>.json` 依〈註冊〉規則 9、10：name 合規且唯一、description 列齊工具、無明文 token
- [ ] 沒有為新 server 改 `REGISTER_LIST`（規則 14）；點名註冊只用一次性 `docker compose run --rm -e REGISTER_LIST=<名稱> registrar`（規則 10）
- [ ] registrar `Exited (0)`；`list servers` / `list tools` / 一次 `invoke` 成功並貼到 PR（新書照〈註冊〉A 步驟 3 五條全跑）
- [ ] 對外：nginx 範本三處已改；dashboard 限內網；development 模式未直接暴露公網
- [ ] workflow 新增的 `uses:` 皆為完整 SHA＋版本註解
- [ ] 新 image 已加 docker-publish / ci / dependabot（含 semver-major ignore）
- [ ] README / CLAUDE.md / AGENTS.md 的服務名、預設清單、port 已同步

---

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| `duplicate key value violates unique constraint "idx_mcp_servers_name" (SQLSTATE 23505)` | 同名 server 已被 registrar 自動註冊 | 換 name，或先 `deregister` |
| registrar `mkdir /app: read-only file system` | GitOps 工具下使用相對 bind mount | 用烤好設定的 `docs-registrar` image（`54a9c08`） |
| registrar 反覆「上游尚未就緒」後放棄（`registrar.sh:82`；20 次後記為失敗，最後 exit 1，`:81,105`） | docs-mcp 啟動失敗，或不在 registrar 所在的網路 | `docker compose logs docs-mcp-server`；確認 `networks: [mcpjungl]`（`compose.yaml:68`）；接現有 gateway 時兩個 service 都在 `gateway` 網路（`compose.attach.yaml:14,26`），它指到 `MCPJUNGLE_NETWORK`（`:28-31`） |
| registrar「等 gateway 逾時(120s)」（`registrar.sh:63`） | gateway 連不上 DB：改了 `POSTGRES_PASSWORD` 卻沒同步 `MCPJUNGLE_DATABASE_URL`，或覆寫的外部 DB 位址不通 | `docker compose logs mcpjungle`；兩處密碼對齊（規則 2b），或移除覆寫回用內建 DB |
| stdio server 註冊時 init timeout | `npx -y` 首次下載慢 | `MCP_SERVER_INIT_REQ_TIMEOUT_SEC=30`（或更高） |
| stdio server 啟動即崩、log 有 `enableCompileCache is not a function` | gateway runtime Node 20 | Node 22（`67b8864`） |
| 起 stack 報 container name `mcpjungle-server` already in use | 機器上還跑著舊的固定 container 名堆疊，或自己加了 `container_name`（違反 `ci.yml:68-70`；CI 報「compose 不可寫死 container_name(-p mcp-test 並存會撞名)」，`ci.yml:69`） | 停掉舊堆疊、拿掉 `container_name`；並存測試用 `docker compose -p mcp-test` |
| 能呼叫工具但收不到回應 / 60 秒斷線 | nginx buffer SSE、預設 timeout | 依規則 16 |
| Actions 報 `Unrecognized named-value: 'secrets'` | 在 step `if:` 用了 secrets | 改 `password: ${{ secrets.GHCR_PAT \|\| secrets.GITHUB_TOKEN }}` |
| workflow 被 org 拒絕執行 | `uses:` 未釘 SHA | 釘完整 SHA（`83cb805`） |
| pull 法部署後內容沒更新 | push `release` 觸發的 Action 尚未推完新 `latest`（`.github/workflows/docker-publish.yml:16-18,88`） | 看 Actions 完成再 `docker compose -f compose.pull.yaml up -d`（`pull_policy: always`，`compose.pull.yaml:20,27`） |
| `docker compose build docs-mcp` 報 no such service | service 已改名 `docs-mcp-server` | 用新名字（證據 E11） |
| 時間顯示差 8 小時 | 容器沒設 TZ / 沒裝 tzdata | 規則 7 |

---

## 7. 待確認

1. **Action 版本策略衝突**（**已解決**）：本 repo org policy 要求 SHA 釘選（`83cb805`），其他團隊 skill 原寫 `actions/*` v5 版本標籤（未釘 SHA）；已決（E-302，2026-10-17）：團隊標準為釘 SHA，見 elf-stack 規則 9 與 3.5。
   另一處 `npm-publish.yml` 釘的 checkout（v6）/ setup-node（v4）與 ci.yml（v7 / v6）不一致（證據 E12），`npm-publish.yml` 已在 `cf42e88` 刪除。
2. **PR AI review**：團隊標準要求 Claude AI review（`elf-cicd-review`），mcp-library `.github/workflows/` 目前（`origin/release` @ `73b8206`）只有 `ci.yml`、`docker-publish.yml`，**沒有** claude-review workflow。
3. **發版流程**（**部分解決**）：分支部分已解決：mcp-library 已採用 `dev` / `release`（`5d00449`），CI 在 push `dev`、`release`、`hotfix/**` 時跑（`.github/workflows/ci.yml:19`），`docker-publish.yml` 只在 push `release` 時發佈、`latest` 只在 `refs/heads/release` 產生（`.github/workflows/docker-publish.yml:16-18,88`），符合 `elf-team-rule`；第 6 節「pull 法部署後內容沒更新」一列已改寫。
   仍未解決：`release.yml` 已刪（證據 E1），沒有任何東西自動打 `v*.*.*` tag，tag 只能人工推；是否導入 `elf-cicd-versioning`。
4. **公網存取模型**：gateway 目前 `SERVER_MODE=development`（`compose.yaml:39`，無用戶端驗證），nginx 範例也未加驗證；對外開放前要選 enterprise 模式或 nginx 層驗證。
5. **`${VAR}` 展開與 token 傳遞**（**部分解決**）：書本的 token 已解決：設了 `DOCS_MCP_AUTH_TOKEN` 時由產生器自動加上 `bearer_token`（`56e67b6`，`gen-book-configs.mjs:65`），compose 也把它傳進 registrar（`compose.yaml:85`）。
   仍未解決：非書本註冊檔（`registry/*.json`、`optional/`）裡 `bearer_token` / `env` 的 `${VAR}` 能不能被 registrar 映像的 CLI 展開——fork 的 CLI 有此功能（`mcpjungle/gateway/cmd/config_reader_env_test.go`），但 registrar 以**上游** `ghcr.io/mcpjungle/mcpjungle:latest-stdio` 為基底（`registry/Dockerfile:4`）；以及非書本 server 需要的 token 怎麼傳進 registrar 容器（〈註冊〉規則 9、10）。硬化時需實測，在那之前照規則 10「需要 token 時停下來回報」。
6. CI Node 版本：`.github/workflows/ci.yml:116`（dashboard 建置）用 `node-version: 20`，`:151`（registry 測試）、`:165`（docs-mcp-server build-test）用 Node 24；registrar 映像基底內建 Node 20（`registry/Dockerfile:1`）。
   與團隊 Node 24.18、docs-mcp Docker `node:26-alpine`（`mcpjungle/docs-mcp-server/Dockerfile:5,14`）、gateway Node 22（`mcpjungle/gateway/Dockerfile.fullbuild:49`）仍不一致。
7. TZ 與 DB（**已解決**，2026-10-18 以 `-p mcp-test` 實跑 `origin/release` @ `73b8206`）：gateway 設 `TZ=Asia/Taipei`；原本未查證 MCPJungle 寫入 Postgres 的時間欄位型別（timestamp vs timestamptz），是否符合團隊「DB 一律 UTC」。
   實測 `docker compose -p mcp-test exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d mcp_servers"'`：`created_at`、`updated_at`、`deleted_at` 三欄都是 `timestamp with time zone`，PostgreSQL 內部以 UTC 儲存，符合「DB 一律 UTC」。只驗證了 `mcp_servers` 表；其他表（`tools`、`prompts`、`resources` 等）的時間欄位沒逐一查。
8. **自包含端到端測試的 localtest compose**（**已解決**）：原本跟正式 stack 三處不一致（① 用上游 image、無 TZ / timeout 30 ② 雙網路（`shared-db` ＋ `mcpjungl`）寫法 ③ docs-mcp 的 build 路徑失效），已在 `e563c9e`（E-131）刪除。
   並存測試改用 `MCPJUNGLE_HOST_PORT=18900 IMAGE_TAG=mcp-test docker compose -p mcp-test up -d --build`（`compose.yaml:6`、`README.md:90-96`），見規則 2c。
9. 根 README 寫用戶端可連 `http://<host>:18800/mcp/<corpus>`（`README.md:64`）。靜態已確認：gateway 只有 `/mcp`、`/v0/groups/:name/mcp`、`/sse` 三個 MCP 路由（`mcpjungle/gateway/internal/api/server.go:213-230`），`/mcp/<corpus>` 不存在；
   README 這句屬於 mcp-library 的文件漂移（見本節末）。連線還沒實測。
10. 備援（`README.md:82`「公司一套、家裡一套」）：兩套 gateway 的 DB 與註冊同步方式未文件化。
11a. **nginx 範例與 `AGENTS.md` 未納管**（**已解決**）：實測 2026-10-04 時它們在 mcp-library 從未 `git add`，規則 16 與禁止簡化 5 的權威出處重新 clone 拿不到；當時的選項是把它提交上去，或改以本 skill 的 `templates/nginx.example.conf` 為準。
    mcp-library 選了前者：`fb4a0ed` 把 nginx 範例、`AGENTS.md` 與 `docs/superpowers/**` 的 dashboard plan / spec 納管，`e563c9e` 再把 nginx 範例搬到根目錄 `nginx.example.conf`。
    `docs/superpowers/**` 之後在 `cf42e88` 刪除；`.mcp.json` 改列入 `.gitignore`（`d22cfbf`，`.gitignore:11`）。
11. **docs-mcp-server 的 compose healthcheck**（**已解決**）：`e563c9e` 在 compose 內補上 healthcheck（`compose.yaml:62-67`），registrar `depends_on` docs-mcp `condition: service_healthy`（`:81-82`）；重試仍保留，不被取代（禁止簡化 1）。
12. **為什麼不能再起第二個 gateway**（規則 8）：mcp-library 的 `compose.attach.yaml:1`、`CLAUDE.md:130`、`AGENTS.md:29`、`mcpjungle/README.md:117` 只寫「不要再起 gateway」，沒寫理由。
    舊理由（固定 container 名會撞名）在 `e563c9e`（E-131）拿掉 `container_name` 後已不成立，CI 也擋 `container_name`（`ci.yml:68-70`）。真正的理由待查明。

**mcp-library 自己的文件漂移**（只記錄，不在本 skill 處理；`origin/release` @ `73b8206`）：

- `README.md:64` 寫用戶端可連 `/mcp/<corpus>`，gateway 沒有這個路由（待確認 9）。
- `README.md:78` 與 `compose.pull.yaml:1` 寫映像在 push `main` 時發佈，實際是 push `release`（`.github/workflows/docker-publish.yml:16-18`）。
- `mcpjungle/books/README.md:116-117` 把 `book`、`language` 標成程式不讀取，但 `gen-book-configs.mjs:52-55` 用它們驗證語料 id（E-309 交接已提）。

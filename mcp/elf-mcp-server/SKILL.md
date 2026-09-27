---
name: elf-mcp-server
description: |
  Elf Express 撰寫 / 修改 MCP server（TypeScript + @modelcontextprotocol/sdk）的團隊規範與完整範本：專案結構、工具命名與描述、
  zod 輸入 schema、唯讀 annotations、錯誤以文字結果回傳、輸出截斷、stdio 與 Streamable HTTP 雙 transport、Bearer token、
  /health、stderr 日誌、測試、Dockerfile，以及「禁止簡化」清單。當任務涉及新建 MCP server、修改 src/index.ts 的 registerTool、
  tool description / inputSchema、http.ts transport、MCP 相關測試或 Dockerfile，或重構 / 精簡既有 MCP server 程式碼時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# MCP Server 撰寫規範（Elf Express）

> 參考實作：`elf-express/mcp-library` 的 `docs-mcp-server/`（核心、多語料）、`sqlsugar-mcp/sqlsugar-mcp-server/` 與
> `fc-designer-mcp/`（legacy，工具描述寫得最完整）。完整範本在 `templates/`，已在 Node 24.18 下實測 `tsc` 通過、9 個測試通過、stdio 可呼叫工具。

相關 skill：
- **`elf-mcp-knowledge`** — 「新增知識庫」主流程。**要掛新文件 / 新書時先看它**：90% 的情況是新增語料，不需要寫新 server
- `elf-mcp-gateway` — 寫好的 server 如何註冊到 MCPJungle、部署、CI
- `elf-stack`（版本）、`elf-unit`（測試放置 / 覆蓋率 55%）、`elf-cicd-docker`（映像）、`elf-cicd-review`（PR AI review）
- 第三方 `mcp-builder`（Anthropic）：通用設計原則；與本 skill 衝突時以本 skill 為準

---

## 1. 何時使用

- 新建一個 MCP server（只在 `elf-mcp-knowledge` 的決策樹判定為路線 C 時：需要即時資料、非文字資料、另一個 runtime）
- 修改任何 MCP server 的 `registerTool`、description、zod schema、handler、`http.ts`、Dockerfile、測試
- 「重構 / 精簡 / 整理」MCP server 程式碼 —— **先讀第 4 節「禁止簡化」**

---

## 2. 固定規則

### 專案結構與分層

1. **MUST** 三層分檔：`src/index.ts`（工具註冊薄殼＋啟動）、`src/http.ts`（transport）、`src/<domain>.ts`（純邏輯，不 import SDK / zod）。
   WHY：`docs-mcp-server` 的 `corpus.ts` 可以不起 server 直接單元測試；設計文件 `bc6760c` §8 明定此邊界。
2. **MUST** 純邏輯函式一律回傳 `string`（Markdown），handler 一行 `textResult(doX(...))`。
   WHY：邏輯可測、工具殼不長邏輯；現有 8 個工具全是這個形狀。
3. **MUST** 新專案依團隊標準：Node 24.18、pnpm 11.x、TypeScript、`*.test.ts` 與原始碼同目錄、vitest 行覆蓋率 ≥ 55%（範本 `vitest.config.ts`）。
   現況落差（**不要順手「統一」，列在待確認**）：`docs-mcp-server` 用 npm、`tests/` 目錄、無覆蓋率門檻、Docker `node:26-alpine`、CI `node-version: 20`、`engines >=18`。

### SDK 與版本（實際在用的）

4. **MUST** 用 `@modelcontextprotocol/sdk` 的高階 API：`McpServer` + `server.registerTool(name, {title, description, inputSchema, annotations}, handler)`；
   stdio 用 `StdioServerTransport`，HTTP 用 `StreamableHTTPServerTransport`。package.json 寫 `^1.12.0`，三個 server 的 lockfile 實際解析到 **1.29.0**。
5. **MUST** zod 版本在同一個 repo 內一致。現況 `docs-mcp-server`/`sqlsugar` 是 zod 3.25.76、`fc-designer-mcp` 被 dependabot 升到 zod 4.4.3（證據 E3）。新 server 跟 `docs-mcp-server`（zod 3）。

### 工具設計

6. **MUST** 工具名 `snake_case`、`<domain>_<verb>`（例：`docs_search`、`sqlsugar_read_note`），**不含 `__`**、不以 `_` 結尾、只用 ASCII。
   WHY：MCPJungle 以第一個 `__` 切 `<server>__<tool>`；gateway 後面的 AI 看到的是 `<server>__<domain>_<verb>`。
7. **MUST** 一個 server 的工具數**固定**，資料種類（語料 / 書 / 資料集）是**參數**，不是新工具；能力差異用 capability gating。
   WHY：`docs-mcp-server` 工具數恆為 8，不隨語料膨脹；gateway 底下掛越多 server，工具總數越要可控。
8. **MUST** description 固定四段：一句用途 →「用途:」何時用、與哪個工具分工 →「參數:」逐項（型別、範圍、預設）→「回傳:」格式 ＋「範例:」真實值。
   有 scope 的 server 追加 `scopeNote`。範本見 `templates/src/index.ts`。
   WHY：證據 E6 —— legacy 描述有範例，docs-mcp 的 `docs_code_*` / `docs_symbol` 描述只剩一行參數名。
9. **MUST** 每個輸入欄位：zod 型別＋`min`/`max`（字串長度、數字範圍）＋`default`（選填數值）＋`.describe()`；物件 `.strict()`；schema 放模組層級。
   WHY：`dd4853a` 把 schema 從 `createServer` 內移出（每 session 重建）；`.strict()` 讓打錯參數名的呼叫直接失敗而不是被默默忽略。
10. **MUST** 唯讀工具帶 `annotations: READ_ONLY`（`readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false`）。有寫入的工具另立 annotations 並在 description 開頭寫明副作用。
11. **MUST** 「找不到 / 未啟用 / 缺參數」回**文字結果**，內容含下一步（改用哪個工具、可用值清單）；**MUST NOT** 為這類情況 throw。
    只有 transport 層意外才走 JSON-RPC error（`http.ts` 的 500 `-32603`）。WHY：AI 能讀文字自我修正；例外只會變成一行「tool failed」。
12. **MUST** 所有輸出經 `truncateIfNeeded`（`CHARACTER_LIMIT = 25000`），截斷訊息要告訴 AI 怎麼縮小範圍；列表類工具要有 `limit`（`docs_search` 1–50 預設 15、`docs_code_search` 1–30 預設 10、`docs_symbol` 1–30 預設 8）。
13. **MUST** 讀檔只從「目錄列舉結果」中比對（`findNotes` / `findFiles`），**MUST NOT** `path.join(root, userInput)`。WHY：天然防 `../` 穿越；範本有測試 `never escapes the data root`。

### Transport / 設定 / 日誌

14. **MUST** 同一份程式支援兩種 transport：`TRANSPORT` 未設 = stdio（本機 `.mcp.json` / npx），`TRANSPORT=http` = Streamable HTTP（Docker / gateway）。Dockerfile 內建 `ENV TRANSPORT=http`。
15. **MUST** HTTP 模式：每 session 一個 transport（以 `mcp-session-id` 為鍵、`onclose` 刪除）；`POST /mcp` 非 initialize 又無 session → 400；`GET`/`DELETE` 以 session 找 transport；`GET /health` **免驗證**並回載入數量。
16. **MUST** `MCP_AUTH_TOKEN` 有設就要求 `Authorization: Bearer <token>`（401 + JSON-RPC `-32001`）；`/health` 永遠公開。
17. **MUST** 所有日誌走 `console.error`（stderr），前綴 `[<server-name>]`。**MUST NOT** 在任何路徑 `console.log`。
    WHY：stdio 模式 stdout 就是 JSON-RPC 串流，一行 log 就讓用戶端解析失敗。
18. **MUST** 環境變數一覽寫進 README：`TRANSPORT`、`PORT`、`MCP_AUTH_TOKEN`、資料目錄覆寫（如 `DOCS_CORPORA_DIR`）、scope（如 `DOCS_SCOPE`）。
19. **MUST** 啟動時印出：資料目錄、載入數量、找不到資料時的警告、HTTP 監聽位址、驗證是否啟用（`logStartupInfo` 模式）。
20. `express.json({ limit: "8mb" })` 與 nginx `client_max_body_size 8m` 保持一致（`mcpjungle/nginx.example.conf` 註明對齊）。

### 時區

21. 容器設 `TZ=${TZ:-Asia/Taipei}`（`bafd8e8`，gateway / docs-mcp / registrar 三者一致）。本 repo 的 server 不寫 DB；**若 server 會讀寫 PostgreSQL，時間一律以 UTC `timestamptz` 儲存（`elf-postgresql`），只在輸出給人看時轉台北時間**——TZ 只影響日誌與顯示。

### 測試

22. **MUST** 純邏輯每個 `do*` 至少測：命中、未命中（回提示且含下一步）、邊界（空輸入、上限截斷）、gating（若有）、路徑穿越。
23. **MUST** fixture 用 `fs.mkdtempSync` 臨時目錄＋環境變數覆寫資料根（`corpus.test.ts` 模式），`afterAll` 還原 env 並刪目錄；快取模組要匯出 `_clearCaches()` 在 `beforeEach` 呼叫。
24. **MUST** 另做一次 stdio 冒煙：build 後送 `initialize` → `tools/list` → `tools/call`（見第 3 節），確認工具數與描述正確。

---

## 3. 標準範本

`templates/` 內容（全部可直接複製，替換 `<...>`）：

| 檔案 | 說明 |
|---|---|
| `package.json` | ESM、`bin`、scripts（build/test/test:coverage）、engines ≥24.18、`packageManager` |
| `tsconfig.json` | 與 docs-mcp-server 相同（ES2022 / Node16 / strict），排除 `*.test.ts` |
| `vitest.config.ts` | colocated 測試、v8 覆蓋率 lines 55 |
| `src/index.ts` | 3 個唯讀工具（list/search/read）、模組層級 strict schema、完整四段描述、雙 transport 啟動 |
| `src/http.ts` | Streamable HTTP（session map、/mcp 與 /mcp/:scope、401/404/400/500、/health） |
| `src/knowledge.ts` | 純邏輯：資料根解析、列舉、mtime 快取、去 BOM、模糊比對、AND 搜尋、截斷 |
| `src/knowledge.test.ts` | 9 個測試：排序、AND、未命中提示、空查詢、讀檔、巢狀、路徑穿越、過濾、截斷 |
| `Dockerfile` / `.dockerignore` / `docker-compose.yml` / `.env.example` | 多階段 build、prod-only deps、`TRANSPORT=http`、healthcheck、TZ |

佔位符：`<server-name>`（kebab-case，= image 名 = container 名 = gateway server 名）、`<domain>`（工具前綴，snake_case）、
`<PORT>`（現有：sqlsugar 5688、fc 5689、docs 5690；新 server 往後取號）、`<ENV_DATA_DIR>`、`<data-dir>`、`<NODE_IMAGE_TAG>`、`<PNPM_VERSION>`（見 `elf-stack`）。

stdio 冒煙（bash；PowerShell 改用 legacy `sqlsugar-mcp-server/test-client.mjs` 的 Node 寫法）：

```bash
pnpm run build
(printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"<domain>_search","arguments":{"query":"<real keyword>"}}}'; sleep 2) \
 | node dist/index.js
```

HTTP 冒煙：`$env:TRANSPORT="http"; pnpm start` 後 `curl http://localhost:<PORT>/health`，再照 `docs-mcp-server/README.md`「驗證 MCP 流程」的 initialize → 帶 `mcp-session-id` 呼叫。

---

## 4. 禁止簡化

> 使用者痛點：「AI 越寫越簡單」。以下每條附證據編號（見 `references/simplification-evidence.md`）或現行程式碼位置。
> **任何 PR 讓下列基準值下降，必須在 PR 描述逐條說明並取得人工同意。**

基準值（`docs-mcp-server`，HEAD `bafd8e8`）——修改前後都跑一次並貼到 PR：

```bash
cd docs-mcp-server
grep -c 'registerTool(' src/index.ts          # 8
grep -c '\.strict()' src/index.ts             # 8
grep -c 'annotations: READ_ONLY' src/index.ts # 8
cat tests/*.ts | grep -cE '^\s*it\('          # 57（2+4+25+7+10+4+5）
```

1. **MUST NOT** 刪工具、合併工具、或把「收編」說成「簡化」。WHY：證據 E5——收斂成 docs-mcp 時丟了 C# 範例工具與 `include_index`，事後才補。任何工具變動要附「舊工具 → 新位置」對照表。
2. **MUST NOT** 縮短 description、拿掉「參數 / 回傳 / 範例」段落。WHY：證據 E6；gateway 後的 AI 只能靠描述選工具。
3. **MUST NOT** 刪 zod 的 `min`/`max`/`default`/`.describe()`/`.strict()`，或把欄位改成 `z.any()` / `z.string()` 無上限。WHY：輸入上限是唯一的防濫用閘（搜尋 200 字、檔名 300 字、limit ≤ 50）。
4. **MUST NOT** 把友善文字錯誤改成 throw，或把錯誤訊息的「下一步建議」刪掉。WHY：證據 E8，`dd4853a` 補回被寫短的缺 corpus 訊息。
5. **MUST NOT** 為了讓測試通過放寬比對或加 fallback；**MUST NOT** 刪測試、改成 `it.skip`、把斷言改寬（`toMatch(/./)`）。WHY：證據 E7（`e3d8808` 移除讓測試假通過的 token-OR fallback）。
6. **MUST NOT** 移除 `truncateIfNeeded`、mtime 快取、BOM 處理、`SKIP_DIRS`、副檔名白名單。WHY：分別防爆 context、確保改檔即時生效、避免亂碼、避免掃進 `node_modules`/`bin`/`obj`。
7. **MUST NOT** 移除 HTTP 模式的 `/health`、Bearer 驗證、404（未知 scope）、400（無 session）、500 包裝與 `onclose` 清理。WHY：gateway healthcheck、registrar 等待、MCPJungle 連線都依賴這些行為（`docs-mcp-server/src/http.ts`）。
8. **MUST NOT** 移除 stdio 或 HTTP 任一 transport。WHY：stdio 給本機 `.mcp.json` / `npx -y @elf-express/docs-mcp-server`，HTTP 給 gateway 與遠端連接器（CLAUDE.md「A–D 四種接法」）。
9. **MUST NOT** 用 `console.log`。WHY：stdio 串流污染。
10. **MUST NOT** 只改程式不改檔頭註解 / README / servers/*.json 描述。WHY：證據 E8、E9、E10。
11. **MUST NOT** 讓 dependabot 或「順手升級」跨主版本（zod、express、typescript、@types/node、SDK）而不經人工評估。WHY：證據 E3——拿掉 `semver-major` ignore 後三個 server 主版本分岔。

---

## 5. 檢查清單

- [ ] 三層分檔；純邏輯不 import SDK / zod
- [ ] 每個工具：snake_case `<domain>_<verb>`、四段描述含真實範例、strict schema（上下限 / default / describe）、READ_ONLY
- [ ] 找不到 / 缺參數 → 文字結果含下一步；無 throw
- [ ] 輸出經 `truncateIfNeeded`；列表有 `limit`
- [ ] 讀檔只從列舉結果比對；有路徑穿越測試
- [ ] stdio 與 HTTP 都能跑；`/health` 免驗證；設 token 後未帶 → 401
- [ ] 全部日誌 `console.error`；`grep -rn "console.log" src/` 無結果
- [ ] 測試 colocated、覆蓋率 ≥ 55%（新專案）；第 4 節基準值未下降（既有專案）
- [ ] stdio 冒煙輸出（tools/list 工具數、一次 tools/call）貼到 PR
- [ ] README 環境變數表、檔頭工具清單、`servers/*.json` 描述已同步
- [ ] Dockerfile：多階段、prod-only deps、`TRANSPORT=http`、`EXPOSE <PORT>`；compose 有 healthcheck 與 TZ

---

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| Claude Desktop 顯示 server 啟動後立刻斷線 / JSON 解析錯 | stdio 模式有東西寫到 stdout | 全改 `console.error` |
| gateway 呼叫回 `Bad Request: no valid session ID provided` | 用戶端 / proxy 沒轉送 `mcp-session-id` header，或第一個請求不是 initialize | nginx 保留 header；確認 initialize 先行 |
| 能呼叫工具但收不到串流回應 | 反向代理 buffer SSE / 60s 斷線 | nginx `proxy_buffering off`、`proxy_read_timeout 3600s`（見 `elf-mcp-gateway`） |
| `/mcp/<x>` 回 404 `Unknown corpus` | scope 不存在（大小寫或拼錯） | 用 `docs_list_corpora` 查 id；id 一律小寫 |
| 改了 md 沒生效 | 手動加的快取沒做 mtime 失效 | 照 `readContent` 的 mtime 模式 |
| 測試在 CI 綠、在本機紅（或反之） | 測試依賴打包語料且另一測試改了 `DOCS_CORPORA_DIR` 未還原 | `afterAll` 還原 env ＋ `_clearCaches()` |
| 模板測試檔無法被 vitest 轉譯 | JSDoc 註解內寫了 `src/**/*.test.ts`，`*/` 提前關閉註解 | 註解內避免 `*/` 字元序列 |
| `npm run clean` 在 PowerShell 失敗 | `rm -rf` 是 bash 指令 | 用 `Remove-Item -Recurse -Force dist` 或改 `rimraf` |

---

## 7. 待確認

1. Node 版本統一：團隊標準 24.18；現況 Docker `node:26-alpine`（三個 server）、CI `node-version: 20`、`engines: >=18`、gateway runtime Node 22。以哪個為準、何時遷移。
2. 套件管理：團隊 pnpm 11.x（確切版號待 `elf-stack` 定案）；本 repo 三個 server 都是 npm + `package-lock.json`。既有 server 是否遷移。
3. 測試放置：團隊標準 colocated `*.test.ts` + 55%；`docs-mcp-server` 用 `tests/` 且無覆蓋率門檻。是否搬移並加門檻。
4. .NET 10 MCP server：repo 內**沒有**任何 C# MCP server（`.cs` 檔都是 SqlSugar 範例 / 效能測試資料），本 skill 不提供 .NET 範本；若要用官方 C# SDK，需另立規範。
5. zod 3 vs 4、express 4 vs 5 在 repo 內分岔（證據 E3）——統一到哪一版。
6. `express-rate-limit` 已加進 `docs-mcp-server/package.json`（未 commit）但程式未使用；nginx 範例說 rate limit 放邊界。應用層要不要限流。
7. Bearer token 比對用 `===`（非 constant-time）；是否改 `crypto.timingSafeEqual`。
8. 工具層逾時：現有工具都是同步檔案讀取、沒有 per-tool timeout；若新 server 會呼叫外部 API，逾時值與重試策略待定（gateway 端 `MCP_SERVER_INIT_REQ_TIMEOUT_SEC=30` 只管初始化）。
9. 工具描述語言：現況繁中描述＋英文工具名；給 gateway 後多語系用戶是否要中英並列。

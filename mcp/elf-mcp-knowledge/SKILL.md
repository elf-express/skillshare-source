---
name: elf-mcp-knowledge
description: |
  Elf Express「新增知識庫到 MCPJungle」的主流程規範：把一套冷門/內部知識（如 SqlSugar、FcDesigner）做成 docs-mcp-server
  的語料（corpora/<id>/ + corpus.json + capability），或在必要時做成獨立知識 MCP server，再以 mcpjungle/servers/<id>.json
  註冊到唯一入口 MCPJungle gateway、驗證 gateway 真的曝露出工具、並同步更新文件。當任務涉及新增或修改語料、corpus.json、
  capabilities（cheatsheet / examples / symbol）、docs_* 工具、語料或 server 命名、servers/*.json、REGISTER_LIST、
  「讓 AI 查得到某份文件 / 某個框架的知識」時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# 新增知識庫到 MCPJungle（Elf Express）

> 參考實作：`elf-express/mcp-library` —— `docs-mcp-server/`（多語料知識 server）＋ `mcpjungle/`（gateway 與註冊）。
> 使用情境：**一台 MCPJungle gateway，底下掛很多「知識型」MCP server / 語料；AI 工具只連 gateway。**

相關 skill：
- `elf-mcp-gateway` — gateway 部署、registrar、nginx、GHCR、安全（本 skill 第 5–7 步會用到）
- `elf-mcp-server` — 語料模式放不下時，從零寫一個知識 MCP server 的範本與禁止簡化規則
- `elf-unit`（測試放置 / 覆蓋率）、`elf-stack`（版本）、`elf-cicd-docker`（映像）
- 第三方通用 skill `mcp-builder`（Anthropic）：通用 MCP 設計原則；本 skill 是它之上的團隊具體層，**衝突時以本 skill 為準**

---

## 1. 何時使用

- 「讓 AI 查得到 X 的文件」「把 Y 框架的筆記掛上 MCP」「新增一本書 / 一個語料」
- 修改既有語料的 md、`corpus.json`、`sources.json`、`examples/`
- 為語料開新能力（cheatsheet / examples / symbol）或新增一種能力（新 `docs_*` 工具）
- 新增 / 修改 `mcpjungle/servers/*.json`、`REGISTER_LIST`
- 檢查「gateway 上看不到新語料 / 工具」

### 先選路線（決策樹）

| 情況 | 路線 | 要改程式碼嗎 |
|---|---|---|
| 知識是 markdown（可轉成 md）＋可選的範例原始碼 | **A. 新增語料**（預設，90% 的情況） | 否 |
| 語料需要現有能力以外的查詢方式（例：依版本號查、表格欄位查） | **B. 新增 capability + 一個 `docs_*` 工具** | 是，見 `references/add-capability.md` |
| 需要即時資料（DB / 外部 API）、非文字資料、或必須另一個 runtime | **C. 獨立知識 MCP server** | 是，照 `elf-mcp-server` |

**MUST NOT** 為了一本新書另寫一個 server（路線 C）——`docs-mcp-server` 的設計主軸就是「新增一本書 = 丟資料夾 + corpus.json，不改 `.ts`」。

---

## 2. 固定規則

### 命名（一個 gateway 底下很多 server 共存的關鍵）

1. **MUST** 語料 id = 資料夾名 = gateway server 名（策略 A）= HTTP 路徑 `/mcp/<id>`。四者**同一個字串**。
   WHY：`servers/<id>.json` 的 `url` 是 `http://docs-mcp-server:5690/mcp/<id>`，gateway 工具名是 `<id>__docs_search`；任一處不同就對不上。
2. **MUST** id 用小寫 `[a-z0-9-]`，以字母開頭，**不含底線**。
   WHY：MCPJungle `validateServerName` 只允許 `^[a-zA-Z0-9_-]+$`、禁止 `__`、禁止結尾 `_`（`internal/service/mcp/util.go`），
   因為工具以 `<server>__<tool>` 切分；不用底線就永遠不會踩到。`getCorpus` 比對不分大小寫，但 URL 與 gateway 名稱分大小寫，一律小寫才不會出現兩套。
2a. **MUST** 語料 id 格式為 **`<書名>-<語言>`**（使用者決議，2026-09-27）：

   | 語言後綴 | 意思 | 使用時機 |
   |---|---|---|
   | `-en` | 英文 | 英文原文 |
   | `-zh-tw` | 繁體中文 | 中文原文或繁中譯本 |
   | `-zh-cn` | 簡體中文 | 簡中原文 |
   | `-bi` | 中英混排 | **只有**來源本身中英混排、無法拆開時 |

   - 同一本書有兩種語言 = **兩個語料**（`opnsense-en`、`opnsense-zh-tw`），按字母排序自然相鄰（「書放在一起」）。**MUST NOT** 再放第三份雙語版（同內容存三份、搜三次）。
   - 書名本身可含 `-`（`vue-router-en`）；分辨書名與語言靠 `corpus.json` 的 `book` / `language` 欄位，**不靠**拆字串。
   - id 總長 **≤ 30 字元**，因 gateway 工具名為 `<id>__<tool>`，部分用戶端上限約 64 字元。
   - `corpus.json` **MUST** 含 `book`、`language`（BCP 47，如 `zh-TW`）、`source`（原始網址）、`title`、`description`、`capabilities`。
   - 目錄樹與完整範例見 repo 的 `docs-mcp-server/corpora/README.md`（唯一權威版本）。
   WHY：`.` 不在 MCPJungle 允許字元內，`_` 會和 `__` 切分衝突；語言放後綴讓同書各語言相鄰、AI 從 id 就知道語言。
3. **MUST** id 在「整台 gateway」唯一，不只是 `corpora/` 內唯一。
   現有保留名：`docs`（策略 B 整包）、`sqlsugar-zh-tw`、`fc-zh-tw`、`opnsense-en`、`opnsense-zh-tw`、`filesystem`、`fetch`、`time`，以及 DB 裡任何已註冊的名字（舊名 `sqlsugar`、`fc` 已改名，gateway 需先 `deregister` 舊名）。
   WHY：重名註冊會報 `duplicate key value violates unique constraint "idx_mcp_servers_name" (SQLSTATE 23505)`；`servers/*.json` 看不出 DB 實際有什麼，要以 `list servers` 為準。
4. **MUST** 用領域名（`sqlsugar`、`furion`、`fc`），**MUST NOT** 用 `docs`、`notes`、`kb`、`test`、`new` 這種泛名。
   WHY：AI 端看到的工具是 `<id>__docs_search`，id 就是 AI 選工具的唯一線索。
5. **MUST NOT** 為語料新增工具名（例如 `furion_search`）。工具固定 `docs_*` 8 個，語料是**參數**。
   WHY：`docs-mcp-server/src/index.ts` 註解「語料是參數不是新工具，故工具數恆為 8」；工具數隨語料膨脹會吃爆 AI 的工具清單。

### 語料內容

6. **MUST** 每篇 md 以 `# 標題` 開頭，前 15 行內放來源：`> 📖 官方文件:[文字](https://…)` 或 `> Source: https://…`。
   WHY：`extractSourceUrl` 只掃前 15 行、只認這兩種格式（`corpus.ts`）；抽不到就沒有來源連結，AI 無法引用官方文件。`sources.json` 只用於覆寫。
7. **MUST** 開 `cheatsheet` 的語料，每篇要有標題含「速查」的段落（慣例 `## 速查表`，其上一行放 `[//]: # (<id>-cheatsheet)` 標記）。
   WHY：`extractCheatsheet` 以 `^#{1,6}\s+.*速查` 找段落，切到下一個同級標題；沒有就回「沒有速查表段落」。
8. **MUST** 開 `symbol` 的語料，API / 組件名要寫成 `#`/`##`/`###` 標題（`####` 以下不進索引）。
   WHY：`buildSymbolIndex` 用 `extractHeadings(content, 1)`，只收 1–3 級；U+200B/U+FEFF 已自動清掉。
9. **MUST** 範例原始碼放 `corpora/<id>/examples/`，副檔名限 `.cs .csproj .sln .json .ts .js`，並在 `corpus.json` 開 `examples: true`。
   WHY：`listCodeFiles` 用白名單 `CODE_EXT`、略過 `bin/obj/.vs`；`listMarkdownFiles` 會跳過 `examples/`，兩者不互相污染。
10. **MUST** 單檔 < 5MB、不含真實連線字串 / 密碼 / token。
    WHY：CI `basics` 擋 >5MB 檔案；機密掃描對 `examples/`、`notes/` **整個排除**，放進去的機密不會被抓到，只能靠人。
11. **MUST** 分類用一層子目錄（`開發文檔/xx.md`），檔名前綴編號（`01xxx.md`）保持順序。
    WHY：`docs_outline` 以頂層目錄分組、`localeCompare("zh-Hant")` 排序；多層目錄只會被歸到第一層。

### 註冊與部署

12. **MUST** 每個新語料新增 `mcpjungle/servers/<id>.json`（策略 A，範本 `templates/servers-corpus.json`），`description` 列出**該語料實際有效的所有工具**。
    WHY：gateway dashboard 與 AI 端只看得到這段描述（證據 E10：`fc.json` 漏列 outline / symbol）。
13. **MUST** 把 `<id>` 加進 `mcpjungle/registrar.sh` 的 `REGISTER_LIST` 預設值；若也要進「現有 gateway」，同步改 `docker-compose.dockhand.yml` 的 `REGISTER_LIST` 預設。
    WHY：registrar 只註冊清單裡的名字；`servers/*.json` 會被 `Dockerfile.registrar` 的 `COPY servers/ /configs/` 烤進 image，**但不在清單就不會註冊**。
14. **MUST** 修改既有 server 的 `url` / `description` 時，先 `mcpjungle deregister <id>` 再重新註冊。
    WHY：`registrar.sh` 的 `is_registered` 看到同名就「略過」，改過的 json 不會生效。

---

## 3. 標準範本與步驟（新增知識庫 Step-by-step）

範本檔：`templates/corpus.json`、`templates/doc-template.md`、`templates/servers-corpus.json`、`templates/corpus-smoke.test.ts`。

```text
Step 0  選 id、查撞名
Step 1  建 corpora/<id>/ 與 md
Step 2  corpus.json（＋選用 sources.json / examples/）
Step 3  本機驗證（test / build / stdio / http）
Step 4  servers/<id>.json ＋ REGISTER_LIST
Step 5  部署（build 法或 pull 法）
Step 6  驗證 gateway 真的曝露工具
Step 7  同 PR 更新文件
```

**Step 0 — 選 id、查撞名**

```bash
ls docs-mcp-server/corpora/ mcpjungle/servers/
docker exec mcpjungle-server /mcpjungle list servers      # 以 gateway 執行期清單為準
```

**Step 1 — 語料資料夾**（`docs-mcp-server/corpora/<id>/`）

```text
corpora/<id>/
├── corpus.json            # 必放（欄位全選填，但團隊規定 title / description / capabilities 都要寫）
├── sources.json           # 選用：只在要覆寫自動抽取的來源時放
├── index.md               # 選用：分類導航
├── <分類>/01<主題>.md      # 依 templates/doc-template.md
└── examples/              # 僅 capabilities.examples=true 時
```

**Step 2 — `corpus.json`**（`templates/corpus.json`）

```json
{
  "title": "<人類可讀名稱>",
  "description": "<一句話：這是什麼、涵蓋哪些主題、附不附程式碼範例>",
  "capabilities": { "cheatsheet": false, "examples": false, "symbol": false }
}
```

能力對照（目前：`sqlsugar` = cheatsheet + examples；`fc` = symbol）：

| capability | 啟用的工具 | 語料需要具備 |
|---|---|---|
| （無條件） | `docs_list_corpora` `docs_search` `docs_read` `docs_outline` | md 檔 |
| `cheatsheet` | `docs_cheatsheet` | 每篇有「速查」標題段落 |
| `examples` | `docs_code_search` `docs_code_read` | `examples/` 下有白名單副檔名原始碼 |
| `symbol` | `docs_symbol` | API / 組件名以 `#`/`##`/`###` 標題呈現 |

**Step 3 — 本機驗證**（`cd docs-mcp-server`；PowerShell 用 `$env:X="..."`）

```bash
npm install && npm run build && npm test          # 既有 57 個測試必須全過，數量不得減少
cp <skill>/templates/corpus-smoke.test.ts tests/<id>.test.ts   # 把 <corpus-id> 換掉後跑
$env:DOCS_SCOPE="<id>"; npm run dev               # stdio 鎖單一語料，stderr 應印「已鎖定單一語料:<id>」
$env:TRANSPORT="http"; npm start                  # 另開終端：
curl http://localhost:5690/health                 # corpora / docs 數要 +1 / +篇數
```

**Step 4 — 註冊檔**（`mcpjungle/servers/<id>.json`，範本 `templates/servers-corpus.json`）

```json
{
  "name": "<id>",
  "transport": "streamable_http",
  "description": "<title>:<一句說明>(docs_list_corpora / docs_search / docs_read / docs_outline<依能力追加 / docs_cheatsheet / docs_code_search / docs_code_read / docs_symbol>)",
  "url": "http://docs-mcp-server:5690/mcp/<id>"
}
```

再改 `mcpjungle/registrar.sh`：

```sh
LIST="${REGISTER_LIST:-sqlsugar fc <id> filesystem fetch time}"
```

策略 B（`docs-all.json` → `docs__docs_search`）不需要任何改動，新語料自動出現在 `corpus` 參數。

**Step 5 — 部署**：push main → `docker-publish.yml` 重建 `docs-mcp-server` 與 `docs-registrar` 兩個 image（語料打包在 image 內）。
build 法 `docker compose up -d --build`；pull 法 `docker compose -f docker-compose.pull.yml up -d`。細節見 `elf-mcp-gateway`。

**Step 6 — 驗證 gateway**（三項都要貼輸出到 PR）

```bash
docker logs <registrar 容器>                                    # 應有「>> 註冊 <id>」且 Exited (0)
docker exec mcpjungle-server /mcpjungle list servers           # 有 <id>
docker exec mcpjungle-server /mcpjungle list tools | grep '<id>__'        # 無條件工具 4 個 + 能力工具
docker exec mcpjungle-server /mcpjungle invoke <id>__docs_list_corpora --input '{}'
docker exec mcpjungle-server /mcpjungle invoke <id>__docs_search --input '{"query":"<該領域關鍵字>"}'
```

`docs_list_corpora` 在單書端點只會列 `<id>` 自己，且標題行要帶正確 badge（速查表 / 代碼範例 / 符號查）。

**Step 7 — 同 PR 更新文件**（證據 E9–E11：每次都有人漏）

| 檔案 | 更新什麼 |
|---|---|
| 根 `README.md` | 結構表的語料清單與篇數 |
| 根 `CLAUDE.md` | 「目前:sqlsugar 開 cheatsheet+examples、fc 開 symbol…」那行、registrar 預設清單 |
| `docs-mcp-server/README.md` | 種子語料清單與篇數、工具表 |
| `mcpjungle/README.md` | `REGISTER_LIST` 預設值、策略 A 範例 |
| `servers/<id>.json` | description 列齊工具 |

硬化環境（docs-mcp 設了 `DOCS_MCP_AUTH_TOKEN`）改用 `templates/servers-corpus-hardened.json`（`bearer_token: "${DOCS_MCP_AUTH_TOKEN}"`，**不寫明文**）。

### 路線 C：獨立知識 MCP server 掛到 gateway（摘要）

1. 依 `elf-mcp-server` 建 server（`<server-name>` kebab-case、工具 `<domain>_<verb>`、雙 transport、`/health`）。
2. 在 `mcpjungle/docker-compose.mcpjungle.yml` 加 service：`networks: [mcpjungl]`、**不發佈 ports**、`TZ`、`TRANSPORT: http`。
3. `servers/<server-name>.json` 用 `elf-mcp-gateway` 的 `templates/servers/http-server.json`，`url: http://<container-name>:<PORT>/mcp`。
4. 加進 `REGISTER_LIST`、`docker-publish.yml` / `ci.yml` / `dependabot.yml` matrix（`elf-mcp-gateway` 規則 23）。
5. Step 6 驗證方式相同：`list tools | grep '<server-name>__'` ＋ 一次 `invoke`。

---

## 4. 禁止簡化

> 背景：使用者回報「AI 越寫越簡單」。下列每條都對應 `references/simplification-evidence.md` 的證據（E#）或現行程式碼的關鍵機制。
> 改動若違反任一條，**必須在 PR 描述中明寫理由並取得人工同意**，否則視為退化。

1. **MUST NOT** 把 capability gating 拿掉、改成「只對某語料註冊工具」或「未啟用就丟例外」。
   WHY：工具對所有語料都存在、未啟用回友善提示並指向替代工具（`doCheatsheet` / `requireExamples` / `doSymbol`）；這是工具數恆定的前提。
2. **MUST NOT** 把 `corpus` 參數改成 `z.enum([...])`。WHY：語料是執行期資料（`index.ts` 註解），寫死 enum 就回到「加書要改程式碼」。
3. **MUST NOT** 刪減未命中 / 缺參數時的「下一步建議」（`請用 docs_list_corpora…`、`改用單書端點 /mcp/<corpus>`、`建議減少關鍵字`）。
   WHY：證據 E8 —— 精簡版錯誤訊息曾被 review 抓出並補回；AI 靠這些字句自我修正下一次呼叫。
4. **MUST NOT** 為了讓測試通過而放寬比對（加 OR fallback、改成模糊比對、吞掉未命中）。WHY：證據 E7，`e3d8808` 移除的正是這種假通過邏輯。測試要用語料**真實**標題 / 內容。
5. **MUST NOT** 拿掉 `truncateIfNeeded`（25000 字元）或放大上限。WHY：所有 `do*` 都經它輸出，避免單次回應塞爆 AI context。
6. **MUST NOT** 用 `path.join(corpusDir, userInput)` 直接讀檔。WHY：`findNotes` / `doCodeRead` 只在 `listMarkdownFiles` / `listCodeFiles` 列出的檔案內比對，天然擋掉 `../` 路徑穿越。
7. **MUST NOT** 移除 mtime 快取失效（`corporaCache` / `contentCache` / `sourcesCache` / `symbolIndexCache`）。WHY：「改檔即時生效、不必重啟」是語料模式的承諾（CLAUDE.md）。
8. **MUST NOT** 在收斂 / 搬移語料時丟掉原 server 的能力。WHY：證據 E5，sqlsugar 收斂時丟了 C# 範例工具，過了一整輪才以 `examples` capability 補回；`include_index`（index.md 分類導航）至今沒補。搬移前先列出舊工具清單，逐一標「收編到哪個工具 / capability」。
9. **MUST NOT** 縮短工具 `description`、刪 zod `.describe()`、刪 `min/max/default`、刪 `.strict()`。WHY：證據 E6；gateway 後面的 AI 只看得到這些字。基準：`src/index.ts` 內 `registerTool(`、`.strict()`、`annotations: READ_ONLY` 各 8 處。
10. **MUST NOT** 只改程式不改文件。WHY：證據 E9–E11。第 3 節 Step 7 的表是必做項。

---

## 5. 檢查清單

- [ ] id 符合 `[a-z0-9-]`、無底線、非泛名；`list servers` 確認無撞名
- [ ] 每篇 md：`# 標題`、前 15 行有來源行；速查 / 符號語料符合第 7、8 條
- [ ] `corpus.json` 三欄都寫；capabilities 與內容相符
- [ ] `examples/` 只有白名單副檔名、無機密、無 `bin/obj`
- [ ] `npm run build` 通過；`npm test` 全過且測試數 ≥ 57＋新增的 smoke test
- [ ] `/health` 的 corpora / docs 數正確；`/mcp/<id>` 可初始化、`/mcp/<不存在>` 回 404
- [ ] `servers/<id>.json` description 列齊工具；`REGISTER_LIST` 已加（mcpjungle 與 dockhand 兩處視需要）
- [ ] registrar log、`list tools`、`invoke <id>__docs_search` 輸出已貼到 PR
- [ ] 第 3 節 Step 7 的文件都已更新
- [ ] `grep -c 'registerTool(' src/index.ts` 仍為 8（路線 A 不應改變）

---

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| dashboard / CLI 註冊報 `SQLSTATE 23505 idx_mcp_servers_name` | registrar 已自動註冊同名 server | 換 id，或先 `mcpjungle deregister <id>` |
| 改了 `servers/<id>.json` 但 gateway 行為沒變 | registrar 冪等「已註冊略過」 | `deregister` 後重跑 registrar（`docker compose up -d --force-recreate registrar`） |
| 新語料在本機有、gateway 查不到 | ① 沒加進 `REGISTER_LIST` ② pull 法拉到舊 image（語料打包在 image 內） | 加清單；確認 Action 已 push 新 `latest`，`pull_policy: always` 重拉 |
| `docs_read` 沒有「📖 官方文件來源」 | 來源行不在前 15 行或格式不符 | 依第 6 條改寫，或補 `sources.json` |
| `docs_cheatsheet` 回「未啟用速查表」 | `corpus.json` 沒開 `cheatsheet` | 開啟並確認每篇有速查段落 |
| `docs_symbol` 找不到明明存在的 API | 名稱在 `####` 或內文，不在 1–3 級標題 | 升為 `###` 以上標題，或改用 `docs_search` |
| registrar log `connection refused` 後重試 | docs-mcp 還沒開始監聽（競態，`3eaebfd`） | 正常；最多重試 20 次 × 3s，勿移除重試 |
| 照 `mcpjungle/README.md` 打 `build docs-mcp` 失敗 | service 已改名 `docs-mcp-server`（證據 E11） | 用 `docs-mcp-server` |

---

## 7. 待確認

1. （已決議）語料 id 禁止底線、格式 `<書名>-<語言>`、≤ 30 字元，見規則 2a。
2. （已決議）見規則 2a。
3. 新語料是否一律同時做策略 A（每書一個 server）與 B（`docs` 整包），或只做 A。
4. fc 語料檔名與標題為簡體、內文為繁中；已命名為 `fc-zh-tw`。檔名是否要轉繁體（會影響 `sources.json` 的鍵）仍待決定。
5. `include_index`（legacy `sqlsugar_list_notes` 附 index.md 導航）是否要以 `docs_outline` 參數補回（證據 E5）。
6. 每個新語料是否強制附一個 `tests/<id>.test.ts` smoke test（本 skill 建議強制）。
7. `docs-mcp-server` 核心測試何時加入 CI matrix（證據 E4）——在那之前，第 5 節的測試項只能靠 PR 作者自證。

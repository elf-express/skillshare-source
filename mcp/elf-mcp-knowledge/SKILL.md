---
name: elf-mcp-knowledge
description: |
  Elf Express「新增知識庫到 MCPJungle」的主流程規範：把一套冷門/內部知識（如 SqlSugar、FcDesigner）做成 docs-mcp-server
  的語料（mcpjungle/books/<書名>/corpus/<id>/ + corpus.json + capability），或在必要時做成獨立知識 MCP server，再由 registrar 依 corpus.json
  自動註冊到唯一入口 MCPJungle gateway、驗證 gateway 真的曝露出工具、並同步更新文件。當任務涉及新增或修改語料、corpus.json、
  capabilities（cheatsheet / examples / symbol）、docs_* 工具、語料或 server 命名、gen-book-configs.mjs、registry/*.json、REGISTER_LIST、
  「讓 AI 查得到某份文件 / 某個框架的知識」時觸發。
metadata:
  version: 1.2.2
  owner: Elf Express
---

# 新增知識庫到 MCPJungle（Elf Express）

> 參考實作：`elf-express/mcp-library` —— `mcpjungle/docs-mcp-server/`（多語料知識 server）＋ `mcpjungle/books/`（書與語料）
> ＋ `mcpjungle/registry/`（registrar 與註冊設定）＋ `mcpjungle/gateway/`（gateway）。量測基準：`origin/release` @ `73b8206`。
> legacy server 已於 `0a37607` 刪除（E-126；歷史內容用 `git show 0a37607^:<路徑>` 讀）。
> 使用情境：**一台 MCPJungle gateway，底下掛很多「知識型」MCP server / 語料；AI 工具只連 gateway。**

相關 skill：
- **`elf-mcp-book`** — 知識來源是「一本書」（`mcpjungle/books/<書名>/source/` 的素材）時**先看它**：素材在 `source/`、四類衍生物哪些不上架、
  `import.ts` 要做到什麼、`sources.json` 怎麼從 front matter 產生（舊式語料）、上架前檢查（來源與標題可辨識性）。本 skill 負責素材挑好之後的上架流程
- `elf-mcp-gateway` — gateway 部署、registrar、nginx、GHCR、安全（本 skill 第 4 步〈註冊〉、第 5–7 步會用到）
- `elf-mcp-server` — 語料模式放不下時，從零寫一個知識 MCP server 的範本與禁止簡化規則
- `elf-unit`（測試放置 / 覆蓋率）、`elf-stack`（版本）、`elf-cicd-docker`（映像）
- 第三方通用 skill `mcp-builder`（Anthropic）：通用 MCP 設計原則；本 skill 是它之上的團隊具體層，**衝突時以本 skill 為準**

---

## 1. 何時使用

- 「讓 AI 查得到 X 的文件」「把 Y 框架的筆記掛上 MCP」「新增一本書 / 一個語料」
- 修改既有語料的 md、`corpus.json`、`sources.json`、`examples/`
- 為語料開新能力（cheatsheet / examples / symbol）或新增一種能力（新 `docs_*` 工具）
- 書本註冊（registrar 依 `corpus.json` 自動產生）；新增 / 修改非書本註冊檔 `mcpjungle/registry/*.json`、`REGISTER_LIST`
- 檢查「gateway 上看不到新語料 / 工具」

### 先選路線（決策樹）

| 情況 | 路線 | 要改程式碼嗎 |
|---|---|---|
| 來源是一本書 / 一份線上文件的擷取產物（`mcpjungle/books/<書名>/source/` 底下） | **A. 新增語料**，但**先讀 `elf-mcp-book`** 挑哪一份、排除哪些 | 否 |
| 知識是 markdown（可轉成 md）＋可選的範例原始碼 | **A. 新增語料**（預設，90% 的情況） | 否 |
| 語料需要現有能力以外的查詢方式（例：依版本號查、表格欄位查） | **B. 新增 capability + 一個 `docs_*` 工具** | 是，見 `references/add-capability.md` |
| 需要即時資料（DB / 外部 API）、非文字資料、或必須另一個 runtime | **C. 獨立知識 MCP server** | 是，照 `elf-mcp-server` |

**MUST NOT** 為了一本新書另寫一個 server（路線 C）——`docs-mcp-server` 的設計主軸就是「新增一本書 = 丟資料夾 + corpus.json，不改 `.ts`」。

---

## 2. 固定規則

### 命名（一個 gateway 底下很多 server 共存的關鍵）

1. **MUST** 語料 id = 資料夾名 = gateway server 名（策略 A）= HTTP 路徑 `/mcp/<id>`。四者**同一個字串**。
   WHY：registrar 產生的註冊設定 `url` 是 `http://docs-mcp-server:5690/mcp/<id>`（`gen-book-configs.mjs:63`），gateway 工具名是 `<id>__docs_search`；任一處不同就對不上。
2. **MUST** id 用小寫 `[a-z0-9-]`，以字母開頭，**不含底線**。
   WHY：MCPJungle `validateServerName` 只允許 `^[a-zA-Z0-9_-]+$`、禁止 `__`、禁止結尾 `_`（`mcpjungle/gateway/internal/service/mcp/util.go`），
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
   - 目錄樹與完整範例見 repo 的 `mcpjungle/books/README.md`（唯一權威版本；命名在第一節 `:12-45`，目錄樹在第二節）。
     `:12-45` 是整個第一節：`:12-34` 是命名規則（語言後綴表與規則表），`:36-45` 是「現有語料」表。
   WHY：`.` 不在 MCPJungle 允許字元內，`_` 會和 `__` 切分衝突；語言放後綴讓同書各語言相鄰、AI 從 id 就知道語言。
3. **MUST** id 在「整台 gateway」唯一，不只是 `mcpjungle/books/` 內唯一。
   現有保留名（`73b8206`）：6 個語料 id `fc-zh-tw`、`nginx-en`、`opnsense-en`、`opnsense-zh-tw`、`sqlsugar-zh-tw`、`stalwart-en`（`books/README.md:38-45`）；`filesystem`、`fetch`、`time`（`mcpjungle/registry/*.json`）；`docs`（策略 B 整包，`mcpjungle/registry/optional/docs.json`）；以及 DB 裡任何已註冊的名字（舊名 `sqlsugar`、`fc` 已改名，gateway 需先手動 `deregister` 舊名，mcp-library `mcpjungle/README.md:113`）。
   WHY：重名註冊會報 `duplicate key value violates unique constraint "idx_mcp_servers_name" (SQLSTATE 23505)`；repo 內的設定（`corpus.json`、`registry/*.json`）看不出 DB 實際有什麼，要以 `list servers` 為準（mcp-library `CLAUDE.md:132`）。
   `gen-book-configs.mjs:40` 擋語料 id 重複，registrar 也擋 `registry/*.json` 與語料 id 同名（`registrar.sh:4`、`:32-35`）；兩者都只看 repo，擋不到 DB 裡的舊名。
4. **MUST** 用領域名（`sqlsugar`、`furion`、`fc`），**MUST NOT** 用 `docs`、`notes`、`kb`、`test`、`new` 這種泛名。
   WHY：AI 端看到的工具是 `<id>__docs_search`，id 就是 AI 選工具的唯一線索。
5. **MUST NOT** 為語料新增工具名（例如 `furion_search`）。工具固定 `docs_*` 8 個，語料是**參數**。
   WHY：`mcpjungle/docs-mcp-server/src/index.ts:5` 註解「語料是參數不是新工具，故工具數恆為 8」；工具數隨語料膨脹會吃爆 AI 的工具清單。

### 語料內容

6. **MUST** 每篇 md 以 `# 標題` 開頭，前 15 行內放來源：`> 📖 官方文件:[文字](https://…)` 或 `> Source: https://…`。
   WHY：`extractSourceUrl` 只掃前 15 行，只看以 `>` 開頭或含 source／来源／來源／官方 字樣的行，先取 markdown 連結、否則取裸網址（`mcpjungle/docs-mcp-server/src/corpus.ts:326-342`，註解列的就是這兩種格式）；抽不到就沒有來源連結，AI 無法引用官方文件。`sources.json` 只用於覆寫（優先於自動抽取，`books/README.md:187`）。
   front matter 的 `source: https://…`（不帶引號）也抽得到，所以 `import.ts` 產生、以 front matter 開頭再接 `# 標題` 的 md 也符合本條（`books/README.md:193`）；帶引號會把 `"` 吃進網址，見 `elf-mcp-book` 規則 9。
7. **MUST** 開 `cheatsheet` 的語料，每篇要有標題含「速查」的段落（慣例 `## 速查表`，其上一行放 `[//]: # (<id>-cheatsheet)` 標記）。
   WHY：`extractCheatsheet` 以 `^#{1,6}\s+.*速查` 找段落，切到下一個同級標題；沒有就回「沒有速查表段落」。
8. **MUST** 開 `symbol` 的語料，API / 組件名要寫成 `#`/`##`/`###` 標題（`####` 以下不進索引）。
   WHY：`buildSymbolIndex` 用 `extractHeadings(content, 1)`，只收 1–3 級；U+200B/U+FEFF 已自動清掉。
9. **MUST** 範例原始碼放 `mcpjungle/books/<書名>/corpus/<id>/examples/`，副檔名限 `.cs .csproj .sln .json .ts .js`，並在 `corpus.json` 開 `examples: true`。
   WHY：`listCodeFiles` 用白名單 `CODE_EXT`、略過 `bin/obj/.vs`；`listMarkdownFiles` 會跳過 `examples/`，兩者不互相污染。
10. **MUST** 單檔 < 5MB、不含真實連線字串 / 密碼 / token。
    WHY：CI `basics` 擋 >5MB 檔案（`ci.yml:77`）；機密掃描對 `examples/` **整個排除**（`ci.yml:95`；`notes/` 在 `73b8206` 已不在排除清單），放進 `examples/` 的機密不會被抓到，只能靠人。
11. **MUST** 分類用一層子目錄（`開發文檔/xx.md`），檔名前綴編號（`01xxx.md`）保持順序。
    WHY：`docs_outline` 以頂層目錄分組、`localeCompare("zh-Hant")` 排序；多層目錄只會被歸到第一層。

### 註冊與部署

12. **MUST** 新語料不手寫註冊檔：registrar 依 `corpus.json` 自動產生，見 `elf-mcp-gateway` 第 2 節〈註冊〉。本機先跑 `node mcpjungle/registry/gen-book-configs.mjs mcpjungle/books <暫存目錄>`，印出的 id 要包含新語料。以 `elf-mcp-gateway` 第 2 節〈註冊〉A 步驟 1、2 為準。
    WHY：產生器依 capabilities 自動列齊工具（`gen-book-configs.mjs:57,62`），取代證據 E10 那種手寫漏列；任一語料不合法，registrar 不註冊任何 server 並以 1 結束（`:87-90`）。
    （`:87-90` 是產生器自己以 1 結束；registrar 收到後呼叫 `fail` 整批不註冊，見 `registrar.sh:24,27`、`books/README.md:171`。）
    gateway dashboard 與 AI 端只看得到這段描述（E10：當時手寫的 fc 註冊檔漏列 outline / symbol），所以描述的來源 `corpus.json` 的 `description` 要寫清楚涵蓋範圍。
13. **MUST NOT** 為了新語料去改 `REGISTER_LIST`：它空白時 registrar 註冊全部書本＋`registry/*.json`，有值時只註冊它列的名字（`registrar.sh:44-52`；`REGISTER_EXTRAS=0` 時空白只註冊書本，`compose.attach.yaml:25` 預設 0）。細節見 `elf-mcp-gateway` 第 2 節〈註冊〉。以 `elf-mcp-gateway` 規則 14、規則 10 為準。
    WHY：書本清單由 `gen-book-configs.mjs` 掃 `books/*/corpus/*/` 產生，registrar 映像也直接帶 `books/`（`mcpjungle/registry/Dockerfile:5`）；把新 id 寫進 `REGISTER_LIST` 只會讓它變成「只註冊這些」，**清單外的書反而不會註冊**。
14. **MUST** 修改既有 server 的 `url` / `description` 時，先 `mcpjungle deregister <id>` 再重新註冊。
    WHY：`registrar.sh` 的 `is_registered` 看到同名就「已註冊，略過」（`registrar.sh:68-75`），改過的設定不會生效。改名既有語料時 registrar 只新增、不移除，舊名要手動 `deregister`（`books/README.md:179`）。

---

## 3. 標準範本與步驟（新增知識庫 Step-by-step）

範本檔：`templates/corpus.json`、`templates/doc-template.md`、`templates/corpus-smoke.test.ts`。
`templates/servers-corpus.json`、`templates/servers-corpus-hardened.json` 是舊式手寫註冊檔格式，僅供對照；現行由 `gen-book-configs.mjs:59-65` 產生（兩者的差異見第 7 節待確認 9）。

```text
Step 0  選 id、查撞名
Step 1  建 mcpjungle/books/<書名>/corpus/<id>/ 與 md
Step 2  corpus.json（＋選用 sources.json / examples/）
Step 3  本機驗證（test / build / stdio / http ＋ 書本的上架前檢查）
Step 4  註冊（registrar 依 corpus.json 自動產生；本機用 gen-book-configs.mjs 驗證）
Step 5  部署（build 法或 pull 法）
Step 6  驗證 gateway 真的曝露工具
Step 7  同 PR 更新文件
```

**Step 0 — 選 id、查撞名**

在 mcp-library repo 根目錄執行（Step 0–2 都在根目錄；Step 3 才 `cd mcpjungle/docs-mcp-server`）：

```bash
ls mcpjungle/books/*/corpus/ mcpjungle/registry/
docker compose exec mcpjungle /mcpjungle list servers      # 以 gateway 執行期清單為準（books/README.md:163）
```

**Step 1 — 語料資料夾**（`mcpjungle/books/<書名>/corpus/<id>/`）

來源是一本書時，md 由 `import.ts` 產生，照 `elf-mcp-book` 第 3 節；下面是語料資料夾本身的內容。

```text
mcpjungle/books/<書名>/corpus/<id>/
├── corpus.json            # 必放（docs-mcp-server 讀取時欄位全選填，但團隊規定六欄 book / language / source / title / description / capabilities 都要寫；book 要等於書資料夾名）
├── sources.json           # 選用：只在要覆寫自動抽取的來源時放
├── index.md               # 選用：分類導航
├── <分類>/01<主題>.md      # 依 templates/doc-template.md
└── examples/              # 僅 capabilities.examples=true 時
```

**Step 2 — `corpus.json`**（`templates/corpus.json`）

```json
{
  "book": "<書名，小寫、同一本書各語言共用>",
  "language": "<BCP 47：en / zh-TW / zh-CN>",
  "source": "https://<原始網址>",
  "title": "<人類可讀名稱，用該語料的語言寫>",
  "description": "<一句話：這是什麼、涵蓋哪些主題、附不附程式碼範例、有沒有已知缺陷（機器翻譯、失效圖片連結…）>",
  "capabilities": { "cheatsheet": false, "examples": false, "symbol": false }
}
```

六個欄位**都要寫**（`mcpjungle/books/README.md` 第三節 `:112-155` 的團隊規定）；`source` 程式不讀；`book`／`language` docs-mcp-server 不讀，但 registrar 的 `gen-book-configs.mjs:52-55` 會驗證（`book` 要等於書資料夾名、id 要等於 `<book>-<language 小寫>` 或 `<book>-bi`），不符就整批不註冊（`registrar.sh:24,27`）。三者是回溯來源與分辨同書各語言的唯一依據。
上游授權要求保留聲明時另加 `license` 欄並在語料根目錄放 `LICENSE` 全文。

能力對照（目前，`73b8206`：`sqlsugar-zh-tw` = cheatsheet + examples；`fc-zh-tw`、`nginx-en`、`opnsense-en`、`opnsense-zh-tw`、`stalwart-en` = symbol，`books/README.md:38-45`）：

| capability | 啟用的工具 | 語料需要具備 |
|---|---|---|
| （無條件） | `docs_list_corpora` `docs_search` `docs_read` `docs_outline` | md 檔 |
| `cheatsheet` | `docs_cheatsheet` | 每篇有「速查」標題段落 |
| `examples` | `docs_code_search` `docs_code_read` | `examples/` 下有白名單副檔名原始碼 |
| `symbol` | `docs_symbol` | API / 組件名以 `#`/`##`/`###` 標題呈現 |

**Step 3 — 本機驗證**（`cd mcpjungle/docs-mcp-server`；PowerShell 用 `$env:X="..."`，mcp-library `CLAUDE.md:50-55` 也是這個寫法）

```bash
npm ci && npm run build && npm test               # 既有測試（73b8206 為 128 個）必須全過，數量不得減少
cp <skill>/templates/corpus-smoke.test.ts tests/<id>.test.ts   # 即 mcpjungle/docs-mcp-server/tests/<id>.test.ts；把 <corpus-id> 換掉後跑
$env:DOCS_SCOPE="<id>"; npm run dev               # stdio 鎖單一語料，stderr 應印「已鎖定單一語料:<id>」
#   （PowerShell；Git Bash 寫成 DOCS_SCOPE=<id> npm run dev）
$env:TRANSPORT="http"; npm start                  # 另開終端：
#   （PowerShell；Git Bash 寫成 TRANSPORT=http npm start）
curl http://localhost:5690/health                 # corpora / docs 數要 +1 / +篇數
```

書本語料另跑 `elf-mcp-book` 第 3 節的「上架前檢查（規則 9、10、11）」：泛名標題 0 篇、來源問題 0 篇。

**Step 4 — 註冊**：註冊見 `elf-mcp-gateway` 第 2 節〈註冊〉。下面兩步即該節 A 的步驟 1、2，指令、預期與停止條件跟該節逐字一致；兩步都不起容器。

下面兩步在 mcp-library repo 根目錄執行（Step 3 停在 `mcpjungle/docs-mcp-server`，先 `cd ../..`）：

- **步驟 1（不手寫註冊檔）**：不新增任何註冊檔，`REGISTER_LIST` 保持空白（預設）。
  指令 `docker compose config | grep REGISTER_LIST`，預期 `REGISTER_LIST: ""`（接現有 gateway 時加 `-f compose.attach.yaml`）；GitOps 工具則看它的 env 編輯器有沒有設 `REGISTER_LIST`。
  有值就停，見 `elf-mcp-gateway`〈註冊〉B 表第 2 列。
- **步驟 2（部署前驗證）**：
  指令 `node mcpjungle/registry/gen-book-configs.mjs mcpjungle/books "$(mktemp -d)"`，預期 exit 0，印出的 id 包含 `<id>`（`73b8206` 印出 6 個 id）。
  exit 1 就停，修 `corpus.json`（原因見 `elf-mcp-gateway`〈註冊〉B 表第 4 列）；這時 registrar 也會整批不註冊。

補充（不屬於上面跟 `elf-mcp-gateway` 逐字一致的段落）：留在 `mcpjungle/docs-mcp-server` 底下時，步驟 2 的等價寫法如下（`73b8206` 兩種寫法都 exit 0、印出同樣 6 個 id）：

    node ../registry/gen-book-configs.mjs ../books "$(mktemp -d)"

**Step 5 — 部署**：push `release` → `docker-publish.yml` 重建 `docs-mcp-server` 與 `docs-registrar` 兩個 image（`docker-publish.yml:16-18`；語料打包在 image 內，`mcpjungle/docs-mcp-server/Dockerfile:26`）。
build 法 `docker compose up -d --build`；pull 法 `docker compose -f compose.pull.yaml up -d`；接現有 gateway 用 `docker compose -f compose.attach.yaml up -d --build`。細節見 `elf-mcp-gateway`。
以上 `docker compose` 指令在 mcp-library repo 根目錄執行（`compose.yaml`、`compose.pull.yaml`、`compose.attach.yaml` 都在根目錄）。

**Step 6 — 驗證 gateway**（以下指令都要跑，每條都要符合預期；輸出貼到 PR）

在 mcp-library repo 根目錄執行。指令、預期與停止條件即 `elf-mcp-gateway` 第 2 節〈註冊〉A 的步驟 3，跟該節逐字一致。

```bash
docker compose logs registrar                                   # 應有「>> 註冊 <id>」
docker compose ps -a registrar                                  # 應為 Exited (0)
docker compose exec mcpjungle /mcpjungle list servers           # 有 <id>
docker compose exec mcpjungle /mcpjungle list tools 2>&1 | grep '<id>__'   # 8 個
docker compose exec mcpjungle /mcpjungle invoke <id>__docs_list_corpora --input '{}'
docker compose exec mcpjungle /mcpjungle invoke <id>__docs_search --input '{"query":"<該領域關鍵字>"}'
```

Windows Git Bash 下，`exec mcpjungle /mcpjungle …` 要加前綴 `MSYS_NO_PATHCONV=1`：Git Bash 會把 `/mcpjungle` 改寫成 Windows 路徑，指令會失敗（E-316 mcp-test 實跑觀察，2026-10-18）。
`list tools` 的清單印在 stderr（`mcpjungle/gateway/cmd/list.go:195-208` 用 cobra 的 `cmd.Printf`），`list servers` 印在 stdout（`:220-248` 用 `fmt.Println`）；少了 `2>&1`，grep 一律 0 筆也不報錯，終端機上卻看得到沒過濾的整份清單（E-338，mcp-test 實跑 mcp-library `2f71743`，2026-10-18：不加時 grep 0 筆、加了 8 筆）。
docs-mcp-server 對每本書一律曝露全部 8 個工具，跟 `capabilities` 無關（`mcpjungle/docs-mcp-server/src/index.ts:145-279`，8 次 `registerTool` 都沒有條件），所以 `list tools` 驗不出能力設定；能力對不對看下一行。
`docs_list_corpora` 在單書端點只會列 `<id>` 自己，且標題行要帶正確 badge（速查表 / 代碼範例 / 符號查）；`docs_search` 要有結果。
接現有 gateway（`compose.attach.yaml`）時，`exec mcpjungle` 改在現有 gateway 的 compose 專案執行：`compose.attach.yaml` 只有 `docs-mcp-server`、`registrar` 兩個 service（`compose.attach.yaml:10`、`:16`），`gateway` 是外部網路（`:28-31`），沒有 `mcpjungle`；`logs registrar` 與 `ps -a registrar` 則寫成 `docker compose -f compose.attach.yaml logs registrar`、`docker compose -f compose.attach.yaml ps -a registrar`。
退出碼只能用 `ps -a` 看，`logs` 不會顯示；registrar 在處理群組前就印「registrar: 完成,目前 servers:」（`registrar.sh:87`），之後群組失敗仍會 exit 1（`:90-105`），只看日誌會把失敗的部署誤判為通過。
接現有 gateway 時，所有 `docker compose run --rm … registrar` 都要加 `-f compose.attach.yaml`，所有 `exec mcpjungle …`（含 `deregister`）都在現有 gateway 的 compose 專案執行；否則在預設 `compose.yaml` 上 `run` 會經 `depends_on` 一併起 `mcpjungle` 與 `postgres`（`compose.yaml:78-80`、`:33-35`），等於第二個 gateway，違反 `elf-mcp-gateway` 規則 8。
不能只看 `list servers`。任一項不符就停，查 `elf-mcp-gateway`〈註冊〉B 表。

**Step 7 — 同 PR 更新文件**（證據 E9–E11：每次都有人漏）

| 檔案 | 更新什麼 |
|---|---|
| 根 `README.md` | 結構表的書名清單（`:23`）、`import.ts` 書（`:26-28`）、registrar 註冊的 server 清單（`:62`、`:93`） |
| 根 `CLAUDE.md` | 語料清單（`:13`）、「目前:`sqlsugar-zh-tw` 開 `cheatsheet`+`examples`…開 `symbol`」那行（`:95`）、registrar 自動註冊的書本清單（`:132`） |
| `mcpjungle/docs-mcp-server/README.md` | 種子語料清單與篇數（`:10`、`:27`）、工具表 |
| `mcpjungle/books/README.md` | 第一節「現有語料」表（`:36-45`，id / book / language / 篇數 / capabilities）與第六節的總量數字（`:206`） |
| `mcpjungle/README.md` | 已實測註冊的 server 清單（`:34`）、策略 A 範例（`:68`）；`REGISTER_LIST` 已沒有預設清單要改（空值＝全部，`:49`） |
| `corpus.json` 的 `description` | ＝ registrar 產生的註冊描述（`gen-book-configs.mjs:62`）；工具清單由產生器依 capabilities 附上，description 本身寫清楚涵蓋範圍 |

對照 `books/README.md:176` 的文件清單，兩邊要一致。

硬化環境（docs-mcp 設了 `DOCS_MCP_AUTH_TOKEN`）：registrar 自動在書本註冊設定加 `bearer_token`（`gen-book-configs.mjs:65,85`），**不寫明文**；`templates/servers-corpus-hardened.json`（`bearer_token: "${DOCS_MCP_AUTH_TOKEN}"`）只是舊式格式對照。

### 路線 C：獨立知識 MCP server 掛到 gateway（摘要）

1. 依 `elf-mcp-server` 建 server（`<server-name>` kebab-case、工具 `<domain>_<verb>`、雙 transport、`/health`）。
2. 在根 `compose.yaml` 加 service：`networks: [mcpjungl]`、**不發佈 ports**、`TZ`、`TRANSPORT: http`、**不寫** `container_name`（`ci.yml:68`）。
3. `mcpjungle/registry/<server-name>.json` 用 `elf-mcp-gateway` 的 `templates/registry/http-server.json`，`url: http://<service 名>:<PORT>/mcp`。
4. 預設會註冊 `registry/*.json`（`registrar.sh:49-50`；接現有 gateway（`compose.attach.yaml` 的 `REGISTER_EXTRAS=0`）時見規則 13）；加進 `ci.yml` 的 `build-test` matrix（`:156-165`）、`docker-build`（`:216`）、`docker-publish.yml`、`dependabot.yml`（`elf-mcp-gateway` 規則 23）。
5. Step 6 驗證方式相同：`docker compose exec mcpjungle /mcpjungle list tools 2>&1 | grep '<server-name>__'` ＋ 一次 `invoke`。

---

## 4. 禁止簡化

> 背景：使用者回報「AI 越寫越簡單」。下列每條都對應 `references/simplification-evidence.md` 的證據（E#）或現行程式碼的關鍵機制。
> 改動若違反任一條，**必須在 PR 描述中明寫理由並取得人工同意**，否則視為退化。

1. **MUST NOT** 把 capability gating 拿掉、改成「只對某語料註冊工具」或「未啟用就丟例外」。
   WHY：工具對所有語料都存在、未啟用回友善提示並指向替代工具（`doCheatsheet` / `requireExamples` / `doSymbol`）；這是工具數恆定的前提。
2. **MUST NOT** 把 `corpus` 參數改成 `z.enum([...])`。WHY：語料是執行期資料（`mcpjungle/docs-mcp-server/src/index.ts:44` 註解），寫死 enum 就回到「加書要改程式碼」。
3. **MUST NOT** 刪減未命中 / 缺參數時的「下一步建議」（`請用 docs_list_corpora…`、`改用單書端點 /mcp/<corpus>`、`建議減少關鍵字`）。
   WHY：證據 E8 —— 精簡版錯誤訊息曾被 review 抓出並補回；AI 靠這些字句自我修正下一次呼叫。
4. **MUST NOT** 為了讓測試通過而放寬比對（加 OR fallback、改成模糊比對、吞掉未命中）。WHY：證據 E7，`e3d8808` 移除的正是這種假通過邏輯。測試要用語料**真實**標題 / 內容。
5. **MUST NOT** 拿掉 `truncateIfNeeded`（25000 字元）或放大上限。WHY：所有 `do*` 都經它輸出，避免單次回應塞爆 AI context。
6. **MUST NOT** 用 `path.join(corpusDir, userInput)` 直接讀檔。WHY：`findNotes` / `doCodeRead` 只在 `listMarkdownFiles` / `listCodeFiles` 列出的檔案內比對，天然擋掉 `../` 路徑穿越。
7. **MUST NOT** 移除 mtime 快取失效（`corporaCache` / `contentCache` / `sourcesCache` / `symbolIndexCache`）。WHY：「改檔即時生效、不必重啟」是語料模式的承諾（mcp-library `CLAUDE.md:99`）。
8. **MUST NOT** 在收斂 / 搬移語料時丟掉原 server 的能力。WHY：證據 E5，sqlsugar 收斂時丟了 C# 範例工具，過了一整輪才以 `examples` capability 補回；`include_index`（index.md 分類導航）至今沒補。搬移前先列出舊工具清單，逐一標「收編到哪個工具 / capability」。
9. **MUST NOT** 縮短工具 `description`、刪 zod `.describe()`、刪 `min/max/default`、刪 `.strict()`。WHY：證據 E6；gateway 後面的 AI 只看得到這些字。基準（`origin/release` @ `73b8206`）：`mcpjungle/docs-mcp-server/src/index.ts` 內 `registerTool(`、`.strict()`、`annotations: READ_ONLY` 各 8 處。
10. **MUST NOT** 只改程式不改文件。WHY：證據 E9–E11。第 3 節 Step 7 的表是必做項。

---

## 5. 檢查清單

- [ ] id 符合 `[a-z0-9-]`、無底線、非泛名；`list servers` 確認無撞名
- [ ] 每篇 md：`# 標題`、前 15 行有來源行；速查 / 符號語料符合第 7、8 條
- [ ] `corpus.json` 六欄都寫（規則 2a），`book` 等於書資料夾名；capabilities 與內容相符
- [ ] `examples/` 只有白名單副檔名、無機密、無 `bin/obj`
- [ ] `npm run build` 通過；`npm test` 全過且測試數 ≥ 128＋新增的 smoke test
- [ ] 書本語料：`elf-mcp-book` 第 3 節的上架前檢查兩項皆 0（泛名標題、來源問題）
- [ ] `/health` 的 corpora / docs 數正確；`/mcp/<id>` 可初始化、`/mcp/<不存在>` 回 404
- [ ] `gen-book-configs.mjs` 本機印出 `<id>`（註冊描述的工具清單由它依 capabilities 列齊）；沒有手改 `REGISTER_LIST`
- [ ] 第 3 節 Step 6 的六條指令（`logs registrar`、`ps -a registrar` 為 Exited (0)、`list servers`、`list tools`、兩個 `invoke`）輸出都已貼到 PR
- [ ] 第 3 節 Step 7 的文件都已更新
- [ ] `grep -c 'registerTool(' src/index.ts` 仍為 8（路線 A 不應改變）

---

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| dashboard / CLI 註冊報 `SQLSTATE 23505 idx_mcp_servers_name` | registrar 已自動註冊同名 server | 換 id，或先 `mcpjungle deregister <id>` |
| 改了 `corpus.json` 的 description（或 `registry/*.json`）但 gateway 行為沒變 | registrar 冪等「已註冊略過」 | `deregister` 後重跑 registrar（`docker compose run --rm registrar`，mcp-library `CLAUDE.md:64`；或 `docker compose up -d --force-recreate registrar`） |
| 新語料在本機有、gateway 查不到 | ① 設了 `REGISTER_LIST` 卻沒列新 id，或 `gen-book-configs` exit 1（任一語料不合法就整批不註冊）② pull 法（`compose.pull.yaml`）拉到舊 image（語料打包在 image 內） | 清空 `REGISTER_LIST`（`elf-mcp-gateway` 規則 10）；已註冊的 server 不受影響，仍留在 gateway（E-316 mcp-test 實測）；修好 `corpus.json`；確認 Action 已 push 新 `latest`，`pull_policy: always` 重拉（`compose.pull.yaml:20,27`） |
| `docs_read` 沒有「📖 官方文件來源」 | 來源行不在前 15 行或格式不符 | 依第 6 條改寫，或補 `sources.json` |
| `docs_cheatsheet` 回「未啟用速查表」 | `corpus.json` 沒開 `cheatsheet` | 開啟並確認每篇有速查段落 |
| `docs_symbol` 找不到明明存在的 API | 名稱在 `####` 或內文，不在 1–3 級標題 | 升為 `###` 以上標題，或改用 `docs_search` |
| registrar log `connection refused` 後重試 | docs-mcp 還沒開始監聽（競態，`3eaebfd`） | 正常；最多重試 20 次 × 3s，勿移除重試 |
| 照舊版 `mcpjungle/README.md` 打 `build docs-mcp` 失敗 | service 已改名 `docs-mcp-server`（`compose.yaml:50`；證據 E11，`mcpjungle/README.md:133-134` 已改正） | 用 `docs-mcp-server` |

---

## 7. 待確認

1. （已決議）語料 id 禁止底線、格式 `<書名>-<語言>`、≤ 30 字元，見規則 2a。
2. （已決議）見規則 2a。
3. 新語料是否一律同時做策略 A（每書一個 server）與 B（`docs` 整包），或只做 A。
   現況（`73b8206`）：A 是預設，registrar 自動註冊全部書本；B 要設 `REGISTER_LIST=docs`（設定在 `registry/optional/docs.json`，mcp-library `CLAUDE.md:116`），註冊後 `docs__docs_search` 用 `corpus` 參數選書，新語料自動出現在參數裡、不需任何改動。設 `REGISTER_LIST=docs` 時只註冊 docs、書本不註冊（`registrar.sh:44-45`）；A、B 要並存時，依 `elf-mcp-gateway` 規則 10 用一次性指令 `docker compose run --rm -e REGISTER_LIST=docs registrar` 註冊 docs；已註冊的書本 server 仍留在 gateway（`elf-mcp-gateway`〈註冊〉B 表第 2 列，E-316 mcp-test 實測）。
4. fc 語料檔名與標題為簡體、內文為繁中；已命名為 `fc-zh-tw`。檔名是否要轉繁體（會影響 `sources.json` 的鍵）仍待決定。
5. `include_index`（legacy `sqlsugar_list_notes` 附 index.md 導航）是否要以 `docs_outline` 參數補回（證據 E5）。
6. 每個新語料是否強制附一個 `tests/<id>.test.ts` smoke test（本 skill 建議強制）。
7. （已解決，2026-10-17）`docs-mcp-server` 核心測試何時加入 CI matrix（證據 E4）——在那之前，第 5 節的測試項只能靠 PR 作者自證。
   依據：`ci.yml` 的 `build-test` matrix 已含 docs-mcp-server（`:156-165`，mcp-library `CLAUDE.md:142`），PR 會跑核心測試。
8. （已解決，2026-10-17）**分支模型與團隊規範不符**：2026-10-11 實測時 mcp-library 僅 `main` 一個分支，`docker-publish.yml` 在 push `main` 時重建映像（`gh api repos/elf-express/mcp-library/branches`）。依 `elf-team-rule` 應導入 `dev` / `release`、改由 `release` 上的 tag 部署；導入時 Step 5 與 `elf-mcp-gateway` 一併改寫。
   依據（E-310 留言，2026-10-17 重查）：`gh api repos/elf-express/mcp-library/branches` 有 `dev`、`main`、`release`；`BRANCHING.md` 第 1 行「本 repo 為【第 3 種：自有專案】」；`docker-publish.yml:16-18` 在 push `release` 時觸發（另有 `v*.*.*` tag `:19-20` 與手動 `workflow_dispatch` `:21`），不再監聽 `main`。Step 5 已改寫；`elf-mcp-gateway` 由 E-315 改寫。
9. **`templates/servers-corpus*.json` 與 registrar 產生的註冊設定不一致**（2026-10-17，`73b8206` 逐欄比對）：`name`、`transport`、`url`（`DOCS_MCP_URL` 用預設值時）、`bearer_token`（hardened 版）一致；`description` 不一致——產生器是 `<title>:<corpus.json 的整段 description>(工具:<依 capabilities 列的工具>)`（`gen-book-configs.mjs:62`；`title` 空時改用 id，`:58`），範本是 `<CORPUS_TITLE>:<one sentence>(<工具清單>)`，括號內沒有 `工具:` 前綴。
   依 E-308 決策 10 保留兩個範本、僅供對照；要刪除得先讓兩邊逐欄一致，或確認不再需要對照。

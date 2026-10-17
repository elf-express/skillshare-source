---
name: elf-mcp-book
description: |
  Elf Express 書籍素材（mcpjungle/books/<書名>/source/）與「挑一份上架成 docs-mcp 語料」的規範。
  當任務涉及 mcpjungle/books/<書名>/source/ 下的檔案、新增或整理一本書的素材、把某本書的某個語言上架成語料、
  寫或修改某本書的 import.ts／transform.ts、
  書籍圖片（一般 git、-text -diff）、.gitattributes 的素材規則、語料的 sources.json、168小隊譯文審查，
  或排查「書上架後查不到 / CI 擋大檔」時觸發。
metadata:
  version: 1.1.0
  owner: Elf Express
---

# 書籍素材與語料上架（Elf Express）

> 參考實作：`elf-express/mcp-library` 的 `mcpjungle/books/<書名>/source/`（素材區，commit `f05dcb1` 建立、`9465d9d` 搬到現址）、
> `mcpjungle/books/<書名>/{import,transform}.ts`（產生語料）、`mcpjungle/books/<書名>/corpus/`（語料區）、
> 根 `.gitattributes`（圖片與素材政策）。量測基準：`origin/release` @ `73b8206`。
> 核心觀念來自 `.gitattributes:10` 的註解原文：**「書是素材，不是原始碼。放進這裡不代表要上架成語料 —— 上架是另一回事，由人挑哪一種形式。」**

相關 skill：
- **`elf-mcp-knowledge`** — 上架流程的主規範（Step 0–7：語料、`corpus.json`、smoke test、註冊、部署、文件同步）。
  **本 skill 只管「素材區怎麼放」與「挑哪一份上架」；真的要上架時照它走。**
- `elf-mcp-gateway` — 註冊與部署
- `elf-mcp-server` — 語料模式放不下時才寫新 server
- 權威目錄規範：repo 的 `mcpjungle/books/README.md`（語料 id、目錄樹、`corpus.json` 欄位、內容規則）

---

## 1. 何時使用

- 新增一本書的素材到 `mcpjungle/books/<書名>/source/`，或整理 / 改名既有的書
- 把某本書的某個語言**上架**成 docs-mcp 語料（挑哪一份、排除哪些）
- 寫或修改某本書的 `import.ts`／`transform.ts`（篩選與轉換）
- 處理書籍圖片（一般 git、`-text -diff`）、`.gitattributes` 的素材規則
- 產生或修補語料的 `sources.json`
- 執行或延續 168小隊的譯文審查
- 排查「素材有、AI 查不到」「CI 擋大檔」

### 素材區與語料區的分界（先認清這條線）

| | 素材區 `mcpjungle/books/<書名>/source/` | 語料區 `mcpjungle/books/<書名>/corpus/<id>/` |
|---|---|---|
| 目的 | 人閱讀、翻譯、審稿的工作區 | 餵給 MCP 的純文字語料 |
| 保留範圍 | **完整**：原文、譯文、雙語對照、回譯、合併全書、圖片 | **只取一種形式**，且只放文字 |
| 圖片 | 有，走一般 git（`-text -diff`） | **沒有**，md 內的 `../images/…` 刻意留成失效連結，或由 `transform.ts` 改成官方網址連結（證據 B4） |
| 進不進 Docker image / npm 套件 | 不進（`mcpjungle/.dockerignore:7`） | 進 Docker image（所以有容量上限）；npm 套件的 `files` 只有 `dist`、`README.md`，不含語料（`docs-mcp-server/package.json:10-13`） |
| 誰決定內容 | 擷取工具產出，原樣保留 | **人**決定篩選規則，寫進 `transform.ts` 的 `isIncluded`；`import.ts` 產生、勿手改（`books/README.md:74`） |

現況（`origin/release` @ `73b8206`，實測 2026-10-17）。篇數用 `git -c core.quotepath=false ls-files -- "mcpjungle/books/<書>/source/<語言>" | grep -c '\.md$'` 量，
不受本機被 `.gitignore` 排除的合併檔影響；圖片欄同法量 `\.(png|jpe?g|gif|webp)$`：

| 書 | 語言資料夾（md 篇數） | 圖片（png/jpg/gif/webp，一般 git） | 已上架成語料？ |
|---|---|---|---|
| `multica` | `zh-CN` 92、`zh-TW` 92 | 60（png/jpg 1、gif/webp 59） | 否 |
| `nginx` | `en` 355、`en+zh-TW` 355 | 22 | 是：`nginx-en` 149 篇 |
| `opnsense` | `en` 379、`zh-TW` 379、`en+zh-TW` 378、`en-translated` 379 | 399 ＋ 6 svg | 是：`opnsense-en` / `opnsense-zh-tw` 各 377 篇 |
| `portabase` | `en` 110、`en+zh-TW` 110 | 57 | 否 |
| `stalwart` | `en` 478、`en+zh-TW` 569 | 105（png/jpg 93、gif/webp 12） | 是：`stalwart-en` 487 篇 |
| `fc`、`sqlsugar` | 舊式語料，沒有 `import.ts`（第 3 節「舊式語料」） | 0 | 是：`fc-zh-tw` 133 篇、`sqlsugar-zh-tw` 74 篇 |

`books/README.md:36-45` 的現有語料表與實測一致（6 個），見第 7 節待確認 1。

---

## 2. 固定規則

### 素材區（`mcpjungle/books/<書名>/source/`）

1. **MUST** 目錄結構 `mcpjungle/books/<書名>/source/<語言>/*.md` ＋ 同層 `mcpjungle/books/<書名>/source/images/`；
   書資料夾另有 `import.ts`、`transform.ts`（產生語料）與 `corpus/`（語料區）。
   `<書名>` 用小寫、可含 `-`，且**與未來語料 id 的書名部分同一個字串**（`opnsense` → `opnsense-en` / `opnsense-zh-tw`）。
   WHY：素材與語料靠這個字串對應；`mcpjungle/books/README.md` 規定 id 為 `<書名>-<語言>`，書名不一致就無法回溯來源；
   registrar 的 `gen-book-configs.mjs:52` 要求 `corpus.json` 的 `book` 等於書資料夾名，`:53-55` 要求 id 等於 `<book>-<language 小寫>`，或 `<book>-bi`（中英混排，`gen-book-configs.mjs:54-55`）。
2. **MUST** 語言資料夾用擷取工具的原樣命名，現況四種：`en`、`zh-TW`、`zh-CN`（原文 / 譯文）、`en+zh-TW`（雙語對照）、`en-translated`（回譯）。
   **MUST NOT** 把 `en+zh-TW`、`en-translated` 這類衍生物刪掉或壓成一份。
   WHY：`.gitattributes:10-11` 註解明文「素材區保留完整（含 en+zh-TW 雙語對照、en-translated 等衍生物），語料只取其中一種」；
   `en+zh-TW` 是 168小隊審稿的**輸入**（見規則 16），刪了審查就沒有對照基準。
3. **MUST** 圖片走一般 git，不走 LFS：`.gitattributes` 對 `mcpjungle/books/*/source/**` 的 `png`／`jpg`／`jpeg`／`gif`／`webp` 標 `-text -diff`（`:26-30`）；svg 不另設規則。**MUST NOT** 改回 Git LFS。
   WHY：mcp-library `21786bc` 推送時 GitHub 回 `This repository exceeded its LFS budget`，配額是帳號層級、repo 內解不了，整個 push 失敗；這批圖單檔都遠小於 GitHub 100 MB 上限，不需要 LFS（`.gitattributes:13-23` 註解原文，證據 B2）。`-text -diff` 讓二進位圖不做換行轉換、diff 不展開。
   圖片容量只靠規則 5 的 CI 5 MB 檢查擋，git 設定本身不擋。驗證：`git check-attr text diff -- "mcpjungle/books/<書>/source/images/<檔>.png"` 應回 `text: unset`、`diff: unset`。
4. **MUST** 保留 `mcpjungle/books/*/source/** linguist-vendored`（`.gitattributes:34`）。
   WHY：`.gitattributes:32-33` 註解——2600+ 篇書會把這個 repo 標成 Markdown 專案，蓋掉真正的 TypeScript 原始碼；也讓 diff 預設折疊。
5. **MUST** 單一檔案 < 5 MB。CI `basics` 的檢查是 `ci.yml:77` 對**整棵樹**的 `find . -type f -size +5M -not -path "./.git/*" -not -path "*/node_modules/*"`（只排除 `.git/` 與 `node_modules/`），
   不是只看變更檔，也**不**排除 `mcpjungle/books/`；不分副檔名，對圖片也有效。
   **現況（新書不要再犯）**：4 個超標合併檔都不在版控——`nginx/source/en/000 全書 (nginx.org) en.md` 12 MB、`nginx/source/en+zh-TW/000 全書 (nginx.org) en+zh-TW.md` 16 MB、
   `opnsense/source/en+zh-TW/000 全書 (docs.opnsense.org) en+zh-TW.md` 7.3 MB 由 `4554bdf` 移除；`stalwart/source/en+zh-TW/000 全書 (stalw.art) en+zh-TW.md` 從未進版控、由 `920892f` 列名。
   四個都靠 `.gitignore:13-20` **逐檔列名**排除，不是通用規則；新書再出現超標檔只有 CI 擋得住。見第 7 節待確認 2。
   自查：
   ```bash
   find . -type f -size +5M -not -path "./.git/*" -not -path "*/node_modules/*"
   ```
6. **MUST** 擷取產出的 md 保持與來源一致（YAML front matter、`[⬆ 目錄]` / 上下篇導航行都留著）。
   WHY：front matter 的 `source:` 是 `transform.ts` 去引號或產 `sources.json`（規則 9）與日後重新同步的唯一依據。

### 挑哪一份上架

7. **MUST** 一個語言資料夾 = 一個語料，id = `<書名>-<語言小寫>`（`opnsense/source/zh-TW/` → `opnsense-zh-tw`）。
   命名的完整規則（禁底線、禁點、≤ 30 字元、禁泛名、全 gateway 唯一）以 `mcpjungle/books/README.md` 第一節（`:12-34`）為**權威**，不要在這裡另立一套；
   registrar 會實際檢查（`gen-book-configs.mjs:10-11,38-40,53-55`）。
8. **MUST NOT** 上架下列四類，它們只留在素材區：

   | 不上架 | 原因（權威出處） |
   |---|---|
   | `en+zh-TW/`（雙語對照） | `books/README.md:31`（第一節）：「不可再放第三份雙語合併版」——同內容存三份、搜三次；要雙語就讓 AI 分別查兩個語料 |
   | `en-translated/`（回譯） | 衍生物，內容與 `en/` 重複；`.gitattributes` 把它歸在素材區 |
   | `000 全書 *.md`（合併全書） | `books/README.md:201-202`（第六節）：合併檔是重複內容，每次搜尋都多命中一篇超大檔，**一律排除**；也是規則 5 的超標來源 |
   | `images/` 與任何非文字檔 | `books/README.md:199-200`（第六節）：語料只放文字；md 內的 `../images/…` 失效連結可接受，但要在 `corpus.json` 的 `description` 註明 |

   由 `transform.ts` 的 `isIncluded` 執行（opnsense `transform.ts:7` 排除 `000 `、nginx `transform.ts:17-19` 只收 `NNN [章節] 標題.md`）。
9. **MUST** 每篇都要抽得到正確的來源網址，結尾不能多帶 `"`，也不能是空值。做法二擇一：
   ① 新書由 `transform.ts` 把 front matter 的 `source: "…"` 去引號（nginx `transform.ts:67-68`、opnsense `transform.ts:56-59`；stalwart 由 `sourceUrl()` 產生，`transform.ts:22`）；
   ② 舊式語料（fc、sqlsugar），或 `transform.ts` 無法去引號時，用 `templates/make-sources-json.mjs` 產生 `sources.json`。
   WHY：`mcpjungle/books/README.md` 第五節（`:183-193`）——自動抽取只掃前 15 行，front matter 帶引號時會把結尾的 `"` 一起吃進網址（`:190`）；`sources.json` 優先於自動抽取（`:187`）；匯入腳本去引號的例外寫在 `:193`。
   驗證：第 3 節的上架前檢查，「來源問題」必須是 0 篇。
10. **MUST** 要不要收目錄頁（`000 目錄.md`）由 `import.ts` 的 `isIncluded` 決定；有收的話，目錄頁同樣要通過規則 9 的來源檢查。
    WHY：`books/README.md` 第六節（`:202`）允許保留目錄頁；但它沒有 front matter，開頭是 `# …`＋`> 網站：https://…`（證據 B12），收了卻抽不到來源就違反規則 9。
    現況（`73b8206`）：opnsense `transform.ts:7` 排除 `000 `、nginx `transform.ts:17-19` 只收有章節標籤的檔名，兩本都不收目錄頁。
11. **MUST** `import.ts` 產出的語料不得有泛名標題：`page`、`index`、`untitled` 或空標題。
    標題取法：先取 front matter 的 `title:`，沒有才取第一個 `# ` 標題，去掉頭尾空白，不分大小寫。（`title:` 的值依 YAML 解析，外層引號不算標題的一部分。）重複標題只列出，不算失敗。
    WHY：`docs_search`／`docs_outline` 回傳的是檔名與標題，那是 AI 選檔的唯一線索。
    驗證：第 3 節的上架前檢查，「泛名標題」必須是 0 篇。舊式語料另有已知的例外，見 evidence。
    注意：nginx 的 `source/en` 有 41 篇 `page`，語料裡是 0 篇，靠的是 `transform.ts:6-14` 的章節白名單間接擋下，不是標題檢查（證據 B11）。
12. **MUST** 上架是**人工挑選**的決定，不是把素材區自動同步過去。
    WHY：`.gitattributes:10` 註解明文「放進這裡不代表要上架成語料 —— 上架是另一回事，由人挑哪一種形式」。
13. **MUST** 上架動作本身照 **`elf-mcp-knowledge` 第 3 節 Step 1–7** 走完：
    素材放進 `source/` → `import.ts` 產生 `corpus/<id>/` → `corpus.json`（`book` / `language` / `source` / `title` / `description` / `capabilities` 六欄）→ 本機驗證 ＋ smoke test ＋ 上架前檢查
    → 註冊（見 `elf-mcp-gateway` 第 2 節〈註冊〉）→ 部署 → 驗證 gateway 曝露工具 → 同 PR 更新文件。
    **MUST NOT** 手放 md 進 `corpus/` 當作上架，也 **MUST NOT** 手改 `import.ts` 產出的 md（`books/README.md:74`）。fc、sqlsugar 見第 3 節「舊式語料」。
14. **MUST** 顧容量：`books/*/corpus/` 總量上限約 **200 MB**（`books/README.md:204-206`；語料會打包進 `docs-mcp-server` 的 Docker image，每次 clone 都下載）。
    目前總量 17 MB（`du -sh --total mcpjungle/books/*/corpus`，`73b8206`：`opnsense-en` 4.6、`opnsense-zh-tw` 4.4、`stalwart-en` 3.8、`nginx-en` 2.2、`fc-zh-tw` 1.0、`sqlsugar-zh-tw` 0.8 MB）。
    超過時把大型語料拆到獨立 repo、以 `DOCS_CORPORA_DIR` 掛載，**不要**繼續塞進本 repo。
15. **MUST** 授權與品質如實註明：
    - 上游要求保留聲明（BSD、MIT…）→ 語料根目錄放 `LICENSE` 全文，並在 `corpus.json` 的 `license` 欄註明。
    - 機器翻譯 / 未校稿 → 在 `description` 寫明，並指出以哪個語料為準。範例（`books/README.md:142-144` 的 `opnsense-zh-tw`）：
      「機器翻譯(google_v2),168 小隊審稿中,術語以 opnsense-en 原文為準」。
    - 刻意失效的連結（圖片、被排除的合併檔）→ 一併寫進 `description`。
    WHY：`corpus.json` 的 `description` 是 `docs_list_corpora` 唯一會顯示給 AI 的品質說明；不寫＝AI 把機翻當權威。

### 168小隊（譯文審查）

16. **MUST** 譯文審查在**素材區**做；目前只針對 opnsense：在 `mcpjungle/books/opnsense/source` 開工作階段（`168小隊-啟動提示.md:6`），
    產出放 `../168小隊/`（即 `mcpjungle/books/opnsense/168小隊/`，`73b8206` 上尚未建立）。
    **MUST NOT** 直接改 `corpus/`（`import.ts` 產出，勿手改）。啟動方式見 `mcpjungle/books/opnsense/168小隊-啟動提示.md`：
    建 agent team（不是只用子代理）、
    隊員 `168-terminologist` ×1、`168-reviewer` ×3（依 `000 目錄.md` 把章節平均切三段、範圍不重疊；共 377 篇，`:13`）、
    `168-devils-advocate` ×1、`168-format-checker` ×1，審稿任務依賴「術語表完成」。
    WHY：審查的輸入是 `en/` ＋ `zh-TW/` ＋ `en+zh-TW/` 三者對照（規則 2），語料區只有一份、無法對照。
17. **MUST NOT** 在啟動提示裡寫模型，也**MUST NOT** 把 `168-*` agent 改成 `elf-*` 的形狀（預載 skill、改 tools）。
    WHY：啟動提示原文（`168小隊-啟動提示.md:7`）——「提示裡不要寫模型，否則會蓋過定義檔中的 model 設定」；
    skillshare 的 `AGENTS.md` 明文：`168-*` 與 `elf-*` 慣例無關、不預載 skill，**不要**為了一致性去改它們。

---

## 3. 標準範本

| 檔案 | 用途 |
|---|---|
| `templates/make-sources-json.mjs` | 舊式語料，或 `transform.ts` 無法去引號時使用（規則 9）：從 front matter 的 `source:` 產生 `sources.json`（零依賴、跳過 `examples/` 與 `images/`；已在 opnsense / nginx 素材上實測，證據 B12） |
| `templates/corpus-book.json` | 書籍語料的 `corpus.json`（六個必填欄位 ＋ `license`，含機翻 / 失效連結的註明範例） |

素材區與語料區目錄樹：

```text
mcpjungle/books/
├── README.md                         # 語料命名與目錄結構的唯一權威版本
└── <書名>/
    ├── import.ts                     # 在 mcpjungle/docs-mcp-server 執行 npx tsx ../books/<書名>/import.ts
    ├── transform.ts                  # isIncluded（篩選）＋轉換，純函式
    ├── source/                       # 素材區；不進映像（mcpjungle/.dockerignore:7）
    │   ├── en/                       # 原文 → 可產生 <書名>-en
    │   │   ├── 000 全書 (<來源網域>) en.md   # ✗ 不上架（合併檔；超過 5 MB 要逐檔列進 .gitignore）
    │   │   ├── 000 目錄.md                   # 收不收由 isIncluded 決定（規則 10）
    │   │   └── 001 … .md
    │   ├── zh-TW/                    # 譯文 → 可產生 <書名>-zh-tw
    │   ├── en+zh-TW/                 # ✗ 不上架（雙語對照，168小隊審稿用）
    │   ├── en-translated/            # ✗ 不上架（回譯衍生物）
    │   └── images/                   # ✗ 不上架（一般 git，-text -diff）
    └── corpus/
        └── <書名>-<語言>/             # import.ts 產出的 md 勿手改；corpus.json、LICENSE 手寫
```

opnsense 另有 `168小隊-啟動提示.md`（譯文審查的啟動提示，貼給新工作階段）、`ONBOARDING.md`，以及審查產出（術語表、報告）的目錄 `168小隊/`（`73b8206` 上尚未建立）。

上架一本書（素材 → 語料），指令照抄：

```bash
# 0) 選 id 並查撞名（規則 7；權威規則見 mcpjungle/books/README.md 第一節）
ls mcpjungle/books/*/corpus/ mcpjungle/registry/
docker compose exec mcpjungle /mcpjungle list servers      # 以 gateway 執行期清單為準

# 1) 素材放進 mcpjungle/books/<書名>/source/<語言>/，寫 transform.ts（isIncluded 排除規則 8 的四類）與 import.ts
#    寫法照 mcpjungle/books/nginx/{import,transform}.ts；來源已是 md 時，import.ts 只做篩選與複製

# 2) 產生語料：全部轉換成功才清掉舊 md 再寫入，任何錯誤都不寫檔
cd mcpjungle/docs-mcp-server
npm ci
npx tsx ../books/<書名>/import.ts
#    corpus/<id>/corpus.json（與 LICENSE）手寫；import.ts 只清 md，不會刪它們

# 3) 確認沒有漏進非文字檔與超標檔
find ../books/<書名>/corpus -type f ! -name '*.md' ! -name '*.json' ! -name 'LICENSE'
find ../books/<書名>/corpus -type f -size +5M

# 4) 確認腳本可重複執行：先 git add，再跑一次，diff 必須是空的
git add ../books/<書名>/corpus && npx tsx ../books/<書名>/import.ts && git diff --stat -- ../books/<書名>/corpus

# 5) corpus.json、smoke test、註冊、部署、文件 → 照 elf-mcp-knowledge Step 2–7
```

上架前檢查（規則 9、10、11）：

```bash
# 在 mcpjungle/docs-mcp-server、npm run build 之後執行；ID 換成語料 id
ID=<id>
node --input-type=module - "$ID" <<'EOF'
import * as c from "./dist/corpus.js";
const id = process.argv[2];
const corpus = c.getCorpus(id);
if (!corpus) { console.error(`找不到語料 ${id}`); process.exit(2); }
const GENERIC = ["page", "index", "untitled", ""];
let generic = 0, badSource = 0;
for (const f of c.listMarkdownFiles(corpus)) {
  const lines = c.readNoteContent(f).split(/\r?\n/);
  let title = null;
  if (lines[0] === "---") {
    for (let i = 1; i < lines.length && lines[i] !== "---"; i++) {
      const m = lines[i].match(/^title:\s*(.*)$/);
      if (m) { title = m[1].trim().replace(/^(["'])(.*)\1$/, "$2"); break; }
    }
  }
  if (title === null) title = (lines.find((l) => l.startsWith("# ")) ?? "").slice(2);
  if (GENERIC.includes(title.trim().toLowerCase())) { generic++; console.log(`泛名標題：${f.filename}`); }
  const url = c.sourceLine(corpus, f.filename).replace(/^📖 官方文件來源:/, "");
  if (!url || url.endsWith('"')) { badSource++; console.log(`來源缺漏或結尾帶 "：${f.filename}`); }
}
console.log(`${id}：泛名標題 ${generic} 篇、來源問題 ${badSource} 篇`);
process.exit(generic || badSource ? 1 : 0);
EOF
```

舊式語料（fc、sqlsugar）：它們直接放 md、沒有 `import.ts`（fc 只有 `corpus/`；sqlsugar 的 `source/` 是扁平 md）。
來源用 `sources.json`（規則 9 ②）。下次更新內容時改成 `source/`＋`import.ts`。

驗證上架後真的查得到（四項都貼到 PR）：

```bash
cd mcpjungle/docs-mcp-server && npm run build && npm test       # 73b8206 為 128 個測試，全過、數量不減
#   上架前檢查（上一段）：泛名標題 0 篇、來源問題 0 篇
curl -s http://localhost:5690/health                      # corpora +1、docs +篇數
docker compose exec mcpjungle /mcpjungle invoke "$ID"__docs_search --input '{"query":"<該書真實關鍵字>"}'
```

---

## 4. 禁止簡化

> 每條都對應 `.gitattributes` / `mcpjungle/books/README.md` 的既有決策或實測，見 `references/simplification-evidence.md`。
> **任何 PR 違反下列任一條，必須在 PR 描述逐條說明並取得人工同意。**

1. **MUST NOT** 為了「整理乾淨」刪掉素材區的衍生物（`en+zh-TW`、`en-translated`、`000 全書`、`images`）。
   WHY：`.gitattributes` 明文素材區保留完整；`en+zh-TW` 是 168小隊的審稿輸入，刪了審查流程就廢掉。
   要處理的是**超標檔案**（規則 5），處理方式是逐檔列進 `.gitignore` 排除出版控（`.gitignore:13-20`），**不是**刪素材，也**不是**改回 LFS（規則 3）。
2. **MUST NOT** 把素材原樣倒進 `corpus/`，或讓 `isIncluded` 放進合併檔、`en+zh-TW`、`images`。
   WHY：`books/README.md` 第六節（`:199-203`）三條內容規則；合併檔會讓每次搜尋都多命中一篇超大檔。
3. **MUST NOT** 把「一本書兩種語言」做成一個語料（或第三份雙語語料）。
   WHY：`books/README.md` 第一節（`:30-31`）；兩個語料按字母排序自然相鄰，雙語需求由 AI 分別查。
4. **MUST NOT** 拿掉 `transform.ts` 的去引號或 `sources.json`，改依賴帶引號的自動抽取；**MUST NOT** 把產生器改成抓第一個 http。
   WHY：`books/README.md:190` 的已知缺陷（結尾 `"` 被吃進網址）；抓第一個 http 會命中導航行與正文連結。
5. **MUST NOT** 把 `corpus.json` 的 `description` 縮成一句廣告詞，刪掉機器翻譯、失效連結、擷取日期、篇數這些品質資訊。
   WHY：`docs_list_corpora` 只顯示這段；AI 無從判斷該不該信這份語料。
6. **MUST NOT** 刪 `LICENSE` 或 `license` 欄。WHY：BSD / MIT 等上游授權要求保留聲明，這是合規問題不是風格問題。
7. **MUST NOT** 拿掉 `.gitattributes` 的 `-text -diff`／`linguist-vendored`，也 **MUST NOT** 改回 LFS。WHY：規則 3、4；`21786bc` 改回一般 git 的原因寫在 `.gitattributes:13-23`。
8. **MUST NOT** 讓 `import.ts` 產出泛名標題的檔案（如 `nginx/source/en` 那 41 篇 `page`），只在 `description` 寫「標題待修」。
   WHY：規則 11；語料的用途就是被搜到，搜到也選不出檔等於沒上架。
9. **MUST NOT** 為了讓 smoke test 過而放寬比對。測試要用該書**真實**標題與關鍵字。
   WHY：與 `elf-mcp-knowledge` 禁止簡化第 4 條同源（證據 E7，`e3d8808` 移除過假通過的 fallback）。

---

## 5. 檢查清單

素材進 `mcpjungle/books/<書名>/source/`：

- [ ] 路徑 `mcpjungle/books/<書名>/source/<語言>/`，`<書名>` 與未來語料 id 的書名一致
- [ ] 圖片在 `<書名>/source/images/`；`git check-attr text diff` 對圖片回 `text: unset`、`diff: unset`（不是 LFS）
- [ ] `find . -type f -size +5M -not -path "./.git/*" -not -path "*/node_modules/*"` 沒有新增項目
- [ ] front matter 與導航行原樣保留
- [ ] 沒有刪掉任何既有衍生物

挑一份上架：

- [ ] id = `<書名>-<語言小寫>`，符合 `mcpjungle/books/README.md` 第一節全部規則，`list servers` 無撞名
- [ ] `isIncluded` 已排除 `000 全書*.md`、`en+zh-TW`、`en-translated`、`images/` 與所有非文字檔
- [ ] `import.ts` 跑過兩次，第二次之後 `git diff` 為空
- [ ] 上架前檢查（第 3 節）「來源問題」0 篇（規則 9、10）
- [ ] 上架前檢查「泛名標題」0 篇：每篇標題與檔名可辨識（不是 `page` 這類，規則 11）
- [ ] `corpus.json` 六欄齊全；機翻 / 失效連結 / 擷取日期 / 篇數都寫進 `description`；需要時有 `LICENSE` ＋ `license`
- [ ] `books/*/corpus/` 總量仍遠低於 200 MB
- [ ] `elf-mcp-knowledge` Step 2–7 全部走完（smoke test、註冊（見 `elf-mcp-gateway` 第 2 節〈註冊〉）、部署、文件）
- [ ] `node mcpjungle/registry/gen-book-configs.mjs mcpjungle/books <暫存目錄>` 本機印出的 id 包含新 id
- [ ] `npm test` 全過且測試數 ≥ 128 ＋ 新增的 smoke test
- [ ] `invoke <id>__docs_search` 輸出已貼到 PR

---

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| CI `basics` 報「發現大檔案(>5MB)」 | 合併檔 `000 全書*.md`（例：12 / 16 / 7.3 MB）被 git 納管；檢查掃整棵樹、不排除 `mcpjungle/books/` | 素材區的超標檔逐檔列進 `.gitignore`（`.gitignore:13-20` 的做法），語料區的由 `isIncluded` 排除（規則 5、8、待確認 2）；**不要**改 CI 門檻 |
| 上架後 `docs_search` 命中一篇超大檔、其他都沉底 | `isIncluded` 沒排除 `000 全書`，合併檔跟著產生進語料 | 修 `transform.ts` 的 `isIncluded`，重跑 `import.ts`（規則 8） |
| `docs_read` 的「📖 官方文件來源」是壞網址、結尾多一個 `"` | `transform.ts` 沒去引號，自動抽取讀到帶引號的 YAML front matter | `transform.ts` 去引號，或用 `make-sources-json.mjs` 產 `sources.json`（規則 9） |
| `000 目錄.md` 沒有來源連結 | `isIncluded` 收了目錄頁卻沒來源：它沒有 front matter，`> 網站：…` 不是認得的格式 | `isIncluded` 不收，或補 `sources.json` 條目（規則 10） |
| AI 搜到結果卻選不出要讀哪篇 | 部分檔案的標題與檔名是 `page` 之類的泛名 | 上架前檢查「泛名標題」必須 0 篇（規則 11）；`nginx/source/en` 有 41 篇是這樣 |
| 語料裡出現圖片或 `.html` | `import.ts` 沒過濾副檔名（`isIncluded` 只該收 md） | 修 `isIncluded` 後重跑，再用 `find ! -name '*.md'`（第 3 節指令）自查 |
| 圖片 diff 出一堆亂碼／被轉換換行 | `.gitattributes` 的 `-text -diff` 被拿掉（或規則被改動） | `git check-attr text diff` 應回 `unset`；svg 是**刻意**不另設規則；**不要**改回 LFS（規則 3） |
| repo 語言統計變成 Markdown | `linguist-vendored` 被移除 | 還原 `.gitattributes`（規則 4） |
| 168小隊隊員全用同一個模型 | 啟動提示裡寫了模型，蓋過 `~/.claude/agents/` 的定義 | 提示不寫模型（規則 17） |

---

## 7. 待確認

1. **（已解決，2026-10-17）目錄規範的「現有語料」表與 `main` 不一致**：原本表中列了 `opnsense-en` / `opnsense-zh-tw`（各 378 篇、總量 4.9 / 4.7 MB），
   但當時 `main` 的語料區只有 `fc-zh-tw`、`sqlsugar-zh-tw`；加入語料的 commit `b7a5efe` 只在 `feat/corpora-naming` 分支（`git merge-base --is-ancestor b7a5efe HEAD` 回 false）。
   當時要補的是「把分支併進 main」還是「把表改回 main 的實況」，由維護者決定；結果是 opnsense 改由 `import.ts` 產生後進了 `main`（`b7a5efe` 本身仍未併入）。
   依據：`73b8206` 的 `books/README.md:36-45` 列 6 個語料，與 `ls -d mcpjungle/books/*/corpus/*/` 的 6 個一致（證據 B13）；沒有機制在擋，增刪語料要同 PR 更新表。
2. **（已解決，2026-10-17）三個超標合併檔**：`nginx/en`、`nginx/en+zh-TW`、`opnsense/en+zh-TW` 的 `000 全書` 檔（12 / 16 / 7.3 MB）原本已 tracked，
   而 CI `basics` 掃整棵樹擋 >5 MB；當時 `f05dcb1` 之後 CI 還沒在 `main` 跑過（最後一次成功執行是 `bafd8e8` 時期），所以尚未爆。
   當時的選項：納入 LFS（`.gitattributes` 加 `000 全書*.md` 規則）／排除出版控／調整 CI 檢查排除素材區，本 skill 不替維護者決定。
   維護者選了排除出版控：`4554bdf` 移除三檔，`.gitignore:13-20` 逐檔列名（另含 `920892f` 列入、從未進版控的 stalwart 合併檔）。這不是通用規則，新書的超標檔靠 CI `ci.yml:77` 擋（規則 5、證據 B10）。
3. **四本書的上架計畫**：`multica`（zh-CN / zh-TW）、`portabase`（en）仍未上架，要不要上架、誰的優先未定。
   `nginx`（en）已上架為 `nginx-en`（149 篇）；那 41 篇 `page` 標題沒有修，是被 `transform.ts:6-14` 的章節白名單排除（規則 11）——白名單放寬前要先修標題；改標題若連檔名一起改，用 `sources.json` 的語料要一起重產。
4. **`en-translated` 的用途**：目前只有 `opnsense` 有這個資料夾（379 篇），是回譯品質檢查的中間產物還是另有用途，未文件化。
5. **`multica` 只有 zh-CN / zh-TW、沒有 en**：簡中轉繁中是機器轉換還是各自擷取，影響 `corpus.json` 的 `description` 怎麼寫。
6. **`mcpjungle/books/opnsense/ONBOARDING.md` 仍是 TODO 骨架**（Codebases / MCP Servers / Skills 三節都是 `_TODO_`）；
   是否由本 skill 的內容補齊，或它屬於另一份團隊 onboarding 文件。
7. **素材擷取工具未進 repo**：front matter 的 `generated` / `captured` 欄位顯示是「網頁轉 Markdown」工具產出，
   但工具本身不在 `mcp-library`。重新擷取 / 增量更新一本書的流程待補。
8. **168小隊產出的回填路徑**：審查修好的 `source/zh-TW/` 譯文如何進到已上架的語料（重跑 `import.ts`？增量 diff？）未定義。
9. **fc、sqlsugar 遷移到 `source/`＋`import.ts`**：屬 mcp-library 的工作，尚未開單（E-308 待決問題）。

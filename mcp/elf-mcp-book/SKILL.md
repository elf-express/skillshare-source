---
name: elf-mcp-book
description: |
  Elf Express 書籍素材庫（knowledge.books/）與「素材 → docs-mcp 語料」上架規範：書的目錄與語言資料夾命名、
  Git LFS 圖片與 linguist-vendored、哪些衍生物（en+zh-TW 雙語對照 / en-translated 回譯 / 000 全書 合併檔）
  只留在素材區不上架、從 YAML front matter 產生 sources.json、標題可辨識性檢查、授權與機器翻譯註明、
  168小隊譯文審查的分工，以及「禁止簡化」清單。當任務涉及 knowledge.books/ 下任何檔案、新增或整理一本書的素材、
  把某本書的某個語言上架成語料、處理書籍圖片與 Git LFS、.gitattributes 的素材規則、
  產生或修補語料的 sources.json、執行 168小隊譯文審查，或排查「書上架後查不到 / CI 擋大檔」時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# 書籍素材與語料上架（Elf Express）

> 參考實作：`elf-express/mcp-library` 的 `knowledge.books/`（素材區，commit `f05dcb1` 建立）、
> 根 `.gitattributes`（LFS 與素材政策）、`mcp/docs-mcp-server/corpora/`（語料區）。
> 核心觀念來自 `.gitattributes` 的註解原文：**「書是素材，不是原始碼。放進這裡不代表要上架成語料 —— 上架是另一回事，由人挑哪一種形式。」**

相關 skill：
- **`elf-mcp-knowledge`** — 上架流程的主規範（Step 0–7：語料、`corpus.json`、smoke test、註冊、部署、文件同步）。
  **本 skill 只管「素材區怎麼放」與「挑哪一份上架」；真的要上架時照它走。**
- `elf-mcp-gateway` — 註冊與部署
- `elf-mcp-server` — 語料模式放不下時才寫新 server
- 權威目錄規範：repo 的 `mcp/docs-mcp-server/corpora/README.md`（語料 id、目錄樹、`corpus.json` 欄位、內容規則）

---

## 1. 何時使用

- 新增一本書的素材到 `knowledge.books/`，或整理 / 改名既有的書
- 把某本書的某個語言**上架**成 docs-mcp 語料（挑哪一份、排除哪些）
- 處理書籍圖片、Git LFS、`.gitattributes` 的素材規則
- 產生或修補語料的 `sources.json`
- 執行或延續 168小隊的譯文審查
- 排查「素材有、AI 查不到」「CI 擋大檔」

### 素材區與語料區的分界（先認清這條線）

| | 素材區 `knowledge.books/<書名>/` | 語料區 `mcp/docs-mcp-server/corpora/<id>/` |
|---|---|---|
| 目的 | 人閱讀、翻譯、審稿的工作區 | 餵給 MCP 的純文字語料 |
| 保留範圍 | **完整**：原文、譯文、雙語對照、回譯、合併全書、圖片 | **只取一種形式**，且只放文字 |
| 圖片 | 有，png/jpg 走 Git LFS | **沒有**，md 內的 `../images/…` 刻意留成失效連結 |
| 進不進 Docker image / npm 套件 | 不進 | 進（所以有容量上限） |
| 誰決定內容 | 擷取工具產出，原樣保留 | **人**挑選 + 本 skill 的排除規則 |

現況（`main`，實測 2026-10-04）：

| 書 | 語言資料夾（md 篇數） | 圖片（png/jpg，走 LFS） | 已上架成語料？ |
|---|---|---|---|
| `multica` | `zh-CN` 92、`zh-TW` 92 | 1 | 否 |
| `nginx` | `en` 356、`en+zh-TW` 356 | 22 | 否 |
| `opnsense` | `en` 379、`zh-TW` 379、`en+zh-TW` 379、`en-translated` 379 | 399 ＋ 6 svg | 否（`opnsense-en` / `opnsense-zh-tw` 只在 `feat/corpora-naming` 分支，未併入 `main`） |
| `portabase` | `en` 110、`en+zh-TW` 110 | 57 | 否 |

`main` 上實際只有 `fc-zh-tw`、`sqlsugar-zh-tw` 兩個語料。
**注意**：`corpora/README.md` 的「現有語料」表已列出 `opnsense-en` / `opnsense-zh-tw`（378 篇），但 `main` 上沒有這兩個資料夾——那張表描述的是分支狀態，見第 7 節待確認 1。

---

## 2. 固定規則

### 素材區（`knowledge.books/`）

1. **MUST** 目錄結構 `knowledge.books/<書名>/<語言>/*.md` ＋ 同層 `knowledge.books/<書名>/images/`。
   `<書名>` 用小寫、可含 `-`，且**與未來語料 id 的書名部分同一個字串**（`opnsense` → `opnsense-en` / `opnsense-zh-tw`）。
   WHY：素材與語料靠這個字串對應；`corpora/README.md` 規定 id 為 `<書名>-<語言>`，書名不一致就無法回溯來源。
2. **MUST** 語言資料夾用擷取工具的原樣命名，現況四種：`en`、`zh-TW`、`zh-CN`（原文 / 譯文）、`en+zh-TW`（雙語對照）、`en-translated`（回譯）。
   **MUST NOT** 把 `en+zh-TW`、`en-translated` 這類衍生物刪掉或壓成一份。
   WHY：`.gitattributes` 註解明文「素材區保留完整（含 en+zh-TW 雙語對照、en-translated 等衍生物），語料只取其中一種」；
   `en+zh-TW` 是 168小隊審稿的**輸入**（見規則 16），刪了審查就沒有對照基準。
3. **MUST** 圖片走 Git LFS，規則只納管 `png` / `jpg` / `jpeg`；**svg 刻意不納管**。
   WHY：`.gitattributes` 註解——svg 是文字格式、可 diff、數量也少。驗證：`git check-attr filter -- "knowledge.books/<書>/images/<檔>.png"` 應回 `filter: lfs`。
4. **MUST** 保留 `knowledge.books/** linguist-vendored`。
   WHY：`.gitattributes` 註解——2600+ 篇書會把這個 repo 標成 Markdown 專案，蓋掉真正的 TypeScript 原始碼；也讓 diff 預設折疊。
5. **MUST** 單一檔案 < 5 MB。CI `basics` 的檢查是對**整棵樹** `find . -type f -size +5M`（只排除 `.git/` 與 `node_modules/`），不是只看變更檔，也**不**排除 `knowledge.books/`。
   **現況違規（新書不要再犯）**：三個合併檔已被 git 納管且超標——
   `nginx/en/000 全書 (nginx.org) en.md` 12 MB、`nginx/en+zh-TW/000 全書 (nginx.org) en+zh-TW.md` 16 MB、
   `opnsense/en+zh-TW/000 全書 (docs.opnsense.org) en+zh-TW.md` 7.3 MB。見第 7 節待確認 2。
   自查：
   ```bash
   find . -type f -size +5M -not -path "./.git/*" -not -path "*/node_modules/*"
   ```
6. **MUST** 擷取產出的 md 保持與來源一致（YAML front matter、`[⬆ 目錄]` / 上下篇導航行都留著）。
   WHY：front matter 的 `source:` 是日後重新同步與產 `sources.json` 的唯一依據（規則 9）。

### 挑哪一份上架

7. **MUST** 一個語言資料夾 = 一個語料，id = `<書名>-<語言小寫>`（`opnsense/zh-TW/` → `opnsense-zh-tw`）。
   命名的完整規則（禁底線、禁點、≤ 30 字元、禁泛名、全 gateway 唯一）以 `mcp/docs-mcp-server/corpora/README.md` 第一節為**權威**，不要在這裡另立一套。
8. **MUST NOT** 上架下列四類，它們只留在素材區：

   | 不上架 | 原因（權威出處） |
   |---|---|
   | `en+zh-TW/`（雙語對照） | `corpora/README.md` 第一節：「不可再放第三份雙語合併版」——同內容存三份、搜三次；要雙語就讓 AI 分別查兩個語料 |
   | `en-translated/`（回譯） | 衍生物，內容與 `en/` 重複；`.gitattributes` 把它歸在素材區 |
   | `000 全書 *.md`（合併全書） | `corpora/README.md` 第六節：合併檔是重複內容，每次搜尋都多命中一篇超大檔，**一律排除**；也是規則 5 的超標來源 |
   | `images/` 與任何非文字檔 | `corpora/README.md` 第六節：語料只放文字；md 內的 `../images/…` 失效連結可接受，但要在 `corpus.json` 的 `description` 註明 |

9. **MUST** 以 front matter 的 `source:` 產生 `sources.json`，**MUST NOT** 依賴 docs-mcp 的自動抽取。
   WHY：`corpora/README.md` 第五節——自動抽取只認 `> Source: url` 與 `> 📖 官方文件:[文字](url)`，
   front matter 的 `source: "https://…"` 會把結尾的 `"` 一起吃進網址。
   用 `templates/make-sources-json.mjs`（第 3 節，已在 opnsense / nginx 素材上實測）。
10. **MUST** 保留 `000 目錄.md` 並**手動**補它的 `sources.json` 條目。
    WHY：`corpora/README.md` 第六節允許保留目錄 / 索引頁（唯一的階層導航）；但它沒有 front matter，
    開頭是 `# …` ＋ `> 網站：https://…`——這**不是**自動抽取認得的兩種格式，產生器也抽不到（實測 opnsense `zh-TW` 379 篇中就是這 1 篇沒有）。
11. **MUST** 上架前檢查**標題可辨識**：每篇的 `# 標題` 與檔名要能讓人（和 AI）判斷內容。
    WHY：`docs_search` / `docs_outline` 回傳的是檔名與標題，那是 AI 選檔的唯一線索。
    **現成反例**：`nginx/en/` 356 篇裡有 **41 篇**的 `title` 與檔名都是 `page`（`001 [01 en] page.md`、`003 [01 en] page.md`…），
    其餘 310 個標題是正常的（`Module ngx_http_api_module` 之類）。那 41 篇**上架前必須先修標題**，否則它們搜到了也選不出來。
12. **MUST** 上架是**人工挑選**的決定，不是把素材區自動同步過去。
    WHY：`.gitattributes` 註解明文「放進這裡不代表要上架成語料 —— 上架是另一回事，由人挑哪一種形式」。
13. **MUST** 上架動作本身照 **`elf-mcp-knowledge` 第 3 節 Step 1–7** 走完：
    語料資料夾 → `corpus.json`（`book` / `language` / `source` / `title` / `description` / `capabilities` 六欄）→ 本機驗證 ＋ smoke test
    → `mcpjungle/servers/<id>.json` ＋ `REGISTER_LIST` → 部署 → 驗證 gateway 曝露工具 → 同 PR 更新文件。
    **MUST NOT** 只把資料夾複製進 `corpora/` 就當上架完成。
14. **MUST** 顧容量：`corpora/` 總量上限約 **200 MB**（語料會打包進 Docker image 與 npm 套件，每次 clone 都下載）。
    目前總量約 11.4 MB。超過時把大型語料拆到獨立 repo、以 `DOCS_CORPORA_DIR` 掛載，**不要**繼續塞進本 repo。
    估算：`opnsense/zh-TW` 去掉合併檔後約 3.8 MB 以內（素材區該目錄含合併檔共約 7.6 MB）。
15. **MUST** 授權與品質如實註明：
    - 上游要求保留聲明（BSD、MIT…）→ 語料根目錄放 `LICENSE` 全文，並在 `corpus.json` 的 `license` 欄註明。
    - 機器翻譯 / 未校稿 → 在 `description` 寫明，並指出以哪個語料為準。範例（`corpora/README.md` 的 `opnsense-zh-tw`）：
      「Google 翻譯，未經人工校稿，術語以 opnsense-en 原文為準」。
    - 刻意失效的連結（圖片、被排除的合併檔）→ 一併寫進 `description`。
    WHY：`corpus.json` 的 `description` 是 `docs_list_corpora` 唯一會顯示給 AI 的品質說明；不寫＝AI 把機翻當權威。

### 168小隊（譯文審查）

16. **MUST** 譯文審查在**素材區**做，產出放 `knowledge.books/<書名>/../168小隊/`（即 `knowledge.books/168小隊/`），
    **MUST NOT** 直接改語料區。啟動方式見 `knowledge.books/168小隊-啟動提示.md`：
    在 `knowledge.books/<書名>` 開工作階段、建 agent team（不是只用子代理）、
    隊員 `168-terminologist` ×1、`168-reviewer` ×3（依 `000 目錄.md` 把章節平均切三段、範圍不重疊）、
    `168-devils-advocate` ×1、`168-format-checker` ×1，審稿任務依賴「術語表完成」。
    WHY：審查的輸入是 `en/` ＋ `zh-TW/` ＋ `en+zh-TW/` 三者對照（規則 2），語料區只有一份、無法對照。
17. **MUST NOT** 在啟動提示裡寫模型，也**MUST NOT** 把 `168-*` agent 改成 `elf-*` 的形狀（預載 skill、改 tools）。
    WHY：啟動提示原文——「提示裡不要寫模型，否則會蓋過定義檔中的 model 設定」；
    skillshare 的 `CLAUDE.md` 明文：`168-*` 與 `elf-*` 慣例無關、不預載 skill，**不要**為了一致性去改它們。

---

## 3. 標準範本

| 檔案 | 用途 |
|---|---|
| `templates/make-sources-json.mjs` | 從 front matter 的 `source:` 產生 `sources.json`（零依賴、跳過 `examples/` 與 `images/`） |
| `templates/corpus-book.json` | 書籍語料的 `corpus.json`（六個必填欄位 ＋ `license`，含機翻 / 失效連結的註明範例） |

素材區目錄樹：

```text
knowledge.books/
├── 168小隊-啟動提示.md              # 譯文審查的啟動提示（貼給新工作階段）
├── ONBOARDING.md
├── <書名>/
│   ├── en/                          # 原文 → 可上架為 <書名>-en
│   │   ├── 000 全書 (<來源網域>) en.md   # ✗ 不上架（合併檔）
│   │   ├── 000 目錄.md                   # ✓ 上架，但 sources.json 要手動補
│   │   ├── 001 … .md
│   │   └── …
│   ├── zh-TW/                       # 譯文 → 可上架為 <書名>-zh-tw
│   ├── en+zh-TW/                    # ✗ 不上架（雙語對照，給 168小隊審稿用）
│   ├── en-translated/               # ✗ 不上架（回譯衍生物）
│   └── images/                      # ✗ 不上架（png/jpg 走 LFS）
└── 168小隊/                          # 審查產出（術語表、報告）
```

上架一本書（素材 → 語料），指令照抄：

```bash
# 0) 選 id 並查撞名（規則 7；權威規則見 corpora/README.md 第一節）
ls mcp/docs-mcp-server/corpora/ mcpjungle/servers/
docker exec mcpjungle-server /mcpjungle list servers        # 以 gateway 執行期清單為準

# 1) 複製素材，排除不上架的四類（規則 8）
ID=<書名>-<語言小寫>
SRC=knowledge.books/<書名>/<語言>
mkdir -p "mcp/docs-mcp-server/corpora/$ID"
cp "$SRC"/*.md "mcp/docs-mcp-server/corpora/$ID/"
rm "mcp/docs-mcp-server/corpora/$ID/000 全書"*.md          # 合併檔一律排除

# 2) sources.json（規則 9；產生器會略過 examples/ 與 images/）
node <skill>/templates/make-sources-json.mjs "mcp/docs-mcp-server/corpora/$ID" \
  > "mcp/docs-mcp-server/corpora/$ID/sources.json"
#    stderr 會印「N 篇有 source,M 篇沒有」；M 應該只有 000 目錄.md（規則 10），手動補進去

# 3) 確認沒有漏進非文字檔與超標檔
find "mcp/docs-mcp-server/corpora/$ID" -type f ! -name '*.md' ! -name '*.json' ! -name 'LICENSE'
find "mcp/docs-mcp-server/corpora/$ID" -type f -size +5M

# 4) corpus.json、smoke test、註冊、部署、文件 → 照 elf-mcp-knowledge Step 2–7
```

驗證上架後真的查得到（三項都貼到 PR）：

```bash
cd mcp/docs-mcp-server && npm run build && npm test       # 既有 57 個測試全過、數量不減
curl -s http://localhost:5690/health                      # corpora +1、docs +篇數
docker exec mcpjungle-server /mcpjungle invoke "$ID"__docs_search --input '{"query":"<該書真實關鍵字>"}'
```

---

## 4. 禁止簡化

> 每條都對應 `.gitattributes` / `corpora/README.md` 的既有決策或實測，見 `references/simplification-evidence.md`。
> **任何 PR 違反下列任一條，必須在 PR 描述逐條說明並取得人工同意。**

1. **MUST NOT** 為了「整理乾淨」刪掉素材區的衍生物（`en+zh-TW`、`en-translated`、`000 全書`、`images`）。
   WHY：`.gitattributes` 明文素材區保留完整；`en+zh-TW` 是 168小隊的審稿輸入，刪了審查流程就廢掉。
   要處理的是**超標檔案**（規則 5），處理方式是納入 LFS 或排除出版控，**不是**刪素材。
2. **MUST NOT** 把素材原樣（含合併檔、含 `en+zh-TW`、含 `images`）倒進 `corpora/`。
   WHY：`corpora/README.md` 第六節三條內容規則；合併檔會讓每次搜尋都多命中一篇超大檔。
3. **MUST NOT** 把「一本書兩種語言」做成一個語料（或第三份雙語語料）。
   WHY：`corpora/README.md` 第一節；兩個語料按字母排序自然相鄰，雙語需求由 AI 分別查。
4. **MUST NOT** 省略 `sources.json` 而改依賴自動抽取，或把產生器的 front matter 解析改成「抓第一個 http」。
   WHY：`corpora/README.md` 第五節的已知缺陷（結尾 `"` 被吃進網址）；抓第一個 http 會命中導航行與正文連結。
5. **MUST NOT** 把 `corpus.json` 的 `description` 縮成一句廣告詞，刪掉機器翻譯、失效連結、擷取日期、篇數這些品質資訊。
   WHY：`docs_list_corpora` 只顯示這段；AI 無從判斷該不該信這份語料。
6. **MUST NOT** 刪 `LICENSE` 或 `license` 欄。WHY：BSD / MIT 等上游授權要求保留聲明，這是合規問題不是風格問題。
7. **MUST NOT** 拿掉 `.gitattributes` 的 LFS 規則或 `linguist-vendored`。WHY：規則 3、4 的註解各對應一個具體後果。
8. **MUST NOT** 上架標題不可辨識的檔案（如 `nginx/en` 那 41 篇 `page`）而只在 `description` 寫「標題待修」。
   WHY：規則 11；語料的用途就是被搜到，搜到也選不出檔等於沒上架。
9. **MUST NOT** 為了讓 smoke test 過而放寬比對。測試要用該書**真實**標題與關鍵字。
   WHY：與 `elf-mcp-knowledge` 禁止簡化第 4 條同源（證據 E7，`e3d8808` 移除過假通過的 fallback）。

---

## 5. 檢查清單

素材進 `knowledge.books/`：

- [ ] 路徑 `knowledge.books/<書名>/<語言>/`，`<書名>` 與未來語料 id 的書名一致
- [ ] 圖片在 `<書名>/images/`；`git check-attr filter` 對 png/jpg 回 `filter: lfs`
- [ ] `find . -type f -size +5M -not -path "./.git/*" -not -path "*/node_modules/*"` 沒有新增項目
- [ ] front matter 與導航行原樣保留
- [ ] 沒有刪掉任何既有衍生物

挑一份上架：

- [ ] id = `<書名>-<語言小寫>`，符合 `corpora/README.md` 第一節全部規則，`list servers` 無撞名
- [ ] 已排除 `000 全書*.md`、`en+zh-TW`、`en-translated`、`images/` 與所有非文字檔
- [ ] `sources.json` 已產生；缺的只有 `000 目錄.md` 且已手動補上
- [ ] 每篇標題與檔名可辨識（不是 `page` 這類）
- [ ] `corpus.json` 六欄齊全；機翻 / 失效連結 / 擷取日期 / 篇數都寫進 `description`；需要時有 `LICENSE` ＋ `license`
- [ ] `corpora/` 總量仍遠低於 200 MB
- [ ] `elf-mcp-knowledge` Step 2–7 全部走完（smoke test、`servers/<id>.json`、`REGISTER_LIST`、部署、文件）
- [ ] `npm test` 全過且測試數 ≥ 57 ＋ 新增的 smoke test
- [ ] `invoke <id>__docs_search` 輸出已貼到 PR

---

## 6. 常見錯誤

| 症狀 | 原因 | 修正 |
|---|---|---|
| CI `basics` 報「發現大檔案(>5MB)」 | 合併檔 `000 全書*.md`（12 / 16 / 7.3 MB）被 git 納管；檢查掃整棵樹、不排除 `knowledge.books/` | 把合併檔納入 LFS 或排除出版控（規則 5、待確認 2）；**不要**改 CI 門檻 |
| 上架後 `docs_search` 命中一篇超大檔、其他都沉底 | 合併檔跟著複製進語料 | 刪 `corpora/<id>/000 全書*.md`（規則 8） |
| `docs_read` 的「📖 官方文件來源」是壞網址、結尾多一個 `"` | 依賴自動抽取去讀 YAML front matter | 用 `make-sources-json.mjs` 產 `sources.json`（規則 9） |
| `000 目錄.md` 沒有來源連結 | 它沒有 front matter，`> 網站：…` 不是認得的格式 | 手動補 `sources.json` 條目（規則 10） |
| AI 搜到結果卻選不出要讀哪篇 | 部分檔案的標題與檔名是 `page` 之類的泛名 | 上架前修標題（規則 11）；`nginx/en` 有 41 篇是這樣 |
| 語料裡出現圖片或 `.html` | 複製時用了 `cp -r` 整個語言資料夾 | 只複製 `*.md`（第 3 節指令），再用 `find ! -name '*.md'` 自查 |
| 圖片在 GitHub 上顯示成一串文字 | 該檔沒被 LFS 納管（例如 svg，或規則被改動） | `git check-attr filter`；svg 是**刻意**不納管 |
| repo 語言統計變成 Markdown | `linguist-vendored` 被移除 | 還原 `.gitattributes`（規則 4） |
| 168小隊隊員全用同一個模型 | 啟動提示裡寫了模型，蓋過 `~/.claude/agents/` 的定義 | 提示不寫模型（規則 17） |

---

## 7. 待確認

1. **`corpora/README.md` 的「現有語料」表與 `main` 不一致**：表中列了 `opnsense-en` / `opnsense-zh-tw`（各 378 篇、總量 4.9 / 4.7 MB），
   但 `main` 的 `corpora/` 只有 `fc-zh-tw`、`sqlsugar-zh-tw`；加入語料的 commit `b7a5efe` 只在 `feat/corpora-naming` 分支（`git merge-base --is-ancestor b7a5efe HEAD` 回 false）。
   要補的是「把分支併進 main」還是「把表改回 main 的實況」，由維護者決定。
2. **三個超標合併檔**：`nginx/en`、`nginx/en+zh-TW`、`opnsense/en+zh-TW` 的 `000 全書` 檔（12 / 16 / 7.3 MB）已 tracked，
   而 CI `basics` 掃整棵樹擋 >5 MB。`f05dcb1` 之後 CI 還沒在 `main` 跑過（最後一次成功執行是 `bafd8e8` 時期），所以尚未爆。
   選項：納入 LFS（`.gitattributes` 加 `knowledge.books/**/000 全書*.md`）／排除出版控／調整 CI 檢查排除素材區。**本 skill 不替維護者決定**。
3. **四本書的上架計畫**：`multica`（zh-CN / zh-TW）、`nginx`（en）、`portabase`（en）要不要上架、誰的優先。
   `nginx` 上架前要先處理那 41 篇 `page` 標題（規則 11）——改標題會動到 `sources.json` 的鍵，要一起重產。
4. **`en-translated` 的用途**：目前只有 `opnsense` 有這個資料夾（379 篇），是回譯品質檢查的中間產物還是另有用途，未文件化。
5. **`multica` 只有 zh-CN / zh-TW、沒有 en**：簡中轉繁中是機器轉換還是各自擷取，影響 `corpus.json` 的 `description` 怎麼寫。
6. **`knowledge.books/ONBOARDING.md` 仍是 TODO 骨架**（Codebases / MCP Servers / Skills 三節都是 `_TODO_`）；
   是否由本 skill 的內容補齊，或它屬於另一份團隊 onboarding 文件。
7. **素材擷取工具未進 repo**：front matter 的 `generated` / `captured` 欄位顯示是「網頁轉 Markdown」工具產出，
   但工具本身不在 `mcp-library`。重新擷取 / 增量更新一本書的流程待補。
8. **168小隊產出的回填路徑**：審查修好的 `zh-TW/` 譯文如何進到已上架的語料（重新複製？增量 diff？）未定義。

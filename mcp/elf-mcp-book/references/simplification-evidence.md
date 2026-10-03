# 書籍素材與上架：證據清單（elf-express/mcp-library）

> 調查日期：2026-10-04。來源：`E:\source\mcp-library`（remote `elf-express/mcp-library`）`main` 分支 HEAD `f05dcb1`，
> 以 `git show` / `git check-attr` / `find` / `node` 實測。每一條都可以用表內指令重現。**沒有證據的不列，列在 SKILL.md 第 7 節待確認。**
>
> 指令一律在 repo 根目錄執行。

## 一、素材區的既有決策（不可當成「可以簡化的風格」）

| # | 出處 | 決策原文 / 實測 | 重現方式 |
|---|---|---|---|
| B1 | `.gitattributes`（`f05dcb1` 建立） | 「書是**素材**,不是原始碼。放進這裡不代表要上架成語料 —— 上架是另一回事,由人挑哪一種形式。素材區保留完整(含 en+zh-TW 雙語對照、en-translated 等衍生物),語料只取其中一種。」 | `git show f05dcb1 -- .gitattributes` |
| B2 | `.gitattributes` | 圖片走 LFS 只納管 `png` / `jpg` / `jpeg`；「**svg 刻意不納管** —— 它是文字格式、可 diff、數量也少」 | `git check-attr filter -- "knowledge.books/opnsense/images/00e88d82-zenarmor-wizard-hardware-high-end.png"` → `filter: lfs` |
| B3 | `.gitattributes` | `knowledge.books/** linguist-vendored`：「沒有這行,2600+ 篇書會把這個 repo 標成 Markdown 專案,蓋掉真正的 TypeScript 原始碼」 | `grep -n linguist-vendored .gitattributes` |
| B4 | `.gitattributes` | 「MCP 語料是純文字,corpus.json 自己寫著 image links (../images/…) are intentionally dangling」——圖片**刻意**不進語料、連結**刻意**留壞 | 同 B1 |
| B5 | `mcp/docs-mcp-server/corpora/README.md` 第一節 | 「**不可**再放第三份雙語合併版 —— 同內容存三份、搜三次;要雙語就讓 AI 分別查兩個語料」 | `sed -n '/不可.*第三份/p' mcp/docs-mcp-server/corpora/README.md` |
| B6 | 同上，第六節 | 「**不放合併檔**：『全書』『整本書』『all-in-one』這類把所有頁面串成一檔的 md 是重複內容,會讓每次搜尋都多命中一篇超大檔,**一律排除**。目錄 / 索引頁(只有連結、沒有正文)可以保留,因為它是唯一的階層導航」 | `sed -n '/不放合併檔/,+2p' mcp/docs-mcp-server/corpora/README.md` |
| B7 | 同上，第五節 | front matter 擷取的文件「**不符合**」自動抽取格式——「自動抽取會把結尾的 `\"` 一起吃進網址。這類語料一律從 front matter 產生 `sources.json`」 | `sed -n '/front matter/,+3p' mcp/docs-mcp-server/corpora/README.md` |
| B8 | 同上，第六節 | `corpora/` 總量上限約 **200 MB**（語料打包進 Docker image 與 npm 套件，也在每次 clone 下載）；目前約 11.4 MB | `sed -n '/200 MB/p' mcp/docs-mcp-server/corpora/README.md` |
| B9 | `knowledge.books/168小隊-啟動提示.md` | 「提示裡不要寫模型,否則會蓋過定義檔中的 model 設定」；隊員定義在全域 `~/.claude/agents/`，產出放 `../168小隊/` | `cat "knowledge.books/168小隊-啟動提示.md"` |

## 二、實測到的現況問題（新書不要再犯）

| # | 位置 | 問題 | 重現方式 |
|---|---|---|---|
| B10 | `knowledge.books/nginx/en/000 全書 (nginx.org) en.md`（12 MB）、`knowledge.books/nginx/en+zh-TW/000 全書 (nginx.org) en+zh-TW.md`（16 MB）、`knowledge.books/opnsense/en+zh-TW/000 全書 (docs.opnsense.org) en+zh-TW.md`（7.3 MB） | 三個合併檔已被 git 納管且超過 CI 的 5 MB 上限。CI `basics` 的檢查是對**整棵樹** `find . -type f -size +5M`，只排除 `.git/` 與 `node_modules/`，**不**排除 `knowledge.books/`，也不是只看變更檔 → 下次 CI 在 `main` 跑就會失敗。`f05dcb1` 之後 CI 尚未在 `main` 執行（`gh run list` 最後成功紀錄在 `bafd8e8` 時期） | `find . -type f -size +5M -not -path "./.git/*" -not -path "*/node_modules/*"`；`sed -n '/large files/,+8p' .github/workflows/ci.yml`；`git ls-files --error-unmatch "knowledge.books/nginx/en/000 全書 (nginx.org) en.md"` |
| B11 | `knowledge.books/nginx/en/` | 356 篇中有 **41 篇**的 `title` 與檔名都是 `page`（`001 [01 en] page.md`、`003 [01 en] page.md`…），其餘 310 個標題正常。那 41 篇上架後，`docs_search` / `docs_outline` 回傳的檔名與標題無法區分 → 搜到也選不出要讀哪篇 | `ls "knowledge.books/nginx/en/"*.md \| grep -c ' page\.md$'` → 41；`grep -h '^title:' "knowledge.books/nginx/en/"*.md \| sort \| uniq -c \| sort -rn \| head -3` |
| B12 | `knowledge.books/<書>/<語言>/000 目錄.md` | 唯一沒有 YAML front matter 的檔案（開頭是 `# …` ＋ `> 網站：https://…`）。`> 網站：` **不是** docs-mcp 認得的兩種來源格式之一，產生器也抽不到——opnsense `zh-TW` 379 篇中就是這 1 篇缺 source | `node <skill>/templates/make-sources-json.mjs knowledge.books/opnsense/zh-TW > /dev/null`（stderr：`378 篇有 source,1 篇沒有`）；`head -3 "knowledge.books/opnsense/zh-TW/000 目錄.md"` |
| B13 | `mcp/docs-mcp-server/corpora/README.md`「現有語料」表 | 表列 `opnsense-en` / `opnsense-zh-tw`（各 378 篇），但 `main` 的 `corpora/` 只有 `fc-zh-tw`、`sqlsugar-zh-tw`。加語料的 commit `b7a5efe` 只在 `feat/corpora-naming` 分支 | `ls mcp/docs-mcp-server/corpora/`；`git merge-base --is-ancestor b7a5efe HEAD && echo ancestor \|\| echo "不在 main"`；`git branch -a --contains b7a5efe` |
| B14 | `knowledge.books/ONBOARDING.md` | 三節（Codebases / MCP Servers to Activate / Skills to Know About）全是 `_TODO_` 骨架 | `cat knowledge.books/ONBOARDING.md` |

## 三、衍生物的規模（說明「刪掉不可逆」）

`opnsense` 一本書四份語言資料夾，每份 379 篇；素材區總計 2634 篇 md、479 張 png/jpg（＋6 個 svg）。
刪掉 `en+zh-TW` 等於刪掉 168小隊的審稿輸入，重建需要重跑整套擷取 + 翻譯。

```bash
for d in knowledge.books/*/; do for s in "$d"*/; do printf "%-40s %s\n" "$s" "$(find "$s" -name '*.md' | wc -l)"; done; done
find knowledge.books -name '*.md' | wc -l          # 2634（2632 篇書 + 根目錄 2 篇說明文件）
find knowledge.books -type f \( -name '*.png' -o -name '*.jpg' \) | wc -l   # 479（另有 6 個 svg，刻意不走 LFS）
```

實測結果（2026-10-04）：

| 書 | 語言資料夾 × 篇數 |
|---|---|
| `multica` | `zh-CN` 92、`zh-TW` 92 |
| `nginx` | `en` 356、`en+zh-TW` 356 |
| `opnsense` | `en` 379、`zh-TW` 379、`en+zh-TW` 379、`en-translated` 379 |
| `portabase` | `en` 110、`en+zh-TW` 110 |

## 四、不是退化、但常被誤判為「簡化」的設計（保留原樣）

| 設計 | 為什麼不是退化 |
|---|---|
| 語料不放圖片、md 內 `../images/…` 留成失效連結 | `.gitattributes` 與 `corpus.json` 的 `description` 都明文寫著這是刻意的（B4）；語料是給 AI 讀的純文字 |
| svg 不走 LFS | 文字格式、可 diff、數量少（B2） |
| 一本書兩種語言 = 兩個語料，不做第三份雙語 | 避免同內容存三份（B5）；按字母排序自然相鄰 |
| 素材區保留 `en-translated`、`en+zh-TW` 等「重複」資料夾 | 它們是審稿輸入與品質檢查中間產物（B1、第三節） |
| `000 目錄.md` 上架、`000 全書*.md` 不上架 | 目錄頁是唯一階層導航；合併檔是重複內容（B6） |

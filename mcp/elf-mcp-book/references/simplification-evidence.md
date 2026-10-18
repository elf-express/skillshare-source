# 書籍素材與上架：證據清單（elf-express/mcp-library）

> 調查日期：2026-10-04；2026-10-17 在 `origin/release` @ `73b8206` 重測。來源：`E:\source\mcp-library`（remote `elf-express/mcp-library`），
> 2026-10-04 為 `main` 分支 HEAD `f05dcb1`，2026-10-17 為驗證 worktree `E:\source\mcp-library-e308`（detached `origin/release` @ `73b8206`），
> 以 `git show` / `git check-attr` / `find` / `node` 實測。每一條都可以用表內指令重現。**沒有證據的不列，列在 SKILL.md 第 7 節待確認。**
>
> 指令一律在 repo 根目錄執行；搜尋中文檔名一律 `git -c core.quotepath=false`。重現指令以 `73b8206` 的路徑為準，歷史版本用 `git show <sha>`。

## 一、素材區的既有決策（不可當成「可以簡化的風格」）

| # | 出處 | 決策原文 / 實測 | 重現方式 |
|---|---|---|---|
| B1 | `.gitattributes`（`f05dcb1` 建立；現行 `:9-11`） | 「書是**素材**,不是原始碼。放進這裡不代表要上架成語料 —— 上架是另一回事,由人挑哪一種形式。素材區保留完整(含 en+zh-TW 雙語對照、en-translated 等衍生物),語料只取其中一種。」（原文仍在） | `sed -n '9,11p' .gitattributes`；`git show f05dcb1 -- .gitattributes`（建立） |
| B2 | `.gitattributes`（`f05dcb1` 建立；`21786bc` 改；現行 `:13-30`） | **已改變（2026-10-17）**。原本：圖片走 LFS 只納管 `png` / `jpg` / `jpeg`；「**svg 刻意不納管** —— 它是文字格式、可 diff、數量也少」。`21786bc`（2026-10-04）改成一般 git：推送時 GitHub 回 `batch response: This repository exceeded its LFS budget.`，配額是帳號層級、repo 內解不了；這批圖 479 張、共 36 MB、單檔最大 0.9 MB，遠低於 GitHub 單檔 100 MB 上限（commit message 原文）。現行 `:26-30` 對 `mcpjungle/books/*/source/**` 的 png / jpg / jpeg / gif / webp 標 `-text -diff`；`:23`「svg 本來就沒納管」。repo 已沒有 LFS 指標檔。圖片容量**靠 CI** `ci.yml:77` 擋（不分副檔名），不是 git 設定在擋；版控中圖片 643 個、最大 2,635,425 bytes（`stalwart/source/images/selected_363_image_002.gif`） | `git show 21786bc -- .gitattributes`；`git show -s --format=%B 21786bc`（原因）；`git merge-base --is-ancestor 21786bc 73b8206` → exit 0；`git check-attr text diff -- "mcpjungle/books/opnsense/source/images/00e88d82-zenarmor-wizard-hardware-high-end.png"` → `text: unset`／`diff: unset`；`git grep -l 'version https://git-lfs' \| wc -l` → 0；`git -c core.quotepath=false ls-tree -r -l HEAD -- mcpjungle/books \| grep -iE '/source/.*\.(png\|jpe?g\|gif\|webp)$' \| awk '{print $4, $5}' \| sort -n \| tail -1` |
| B3 | `.gitattributes:32-34` | `mcpjungle/books/*/source/** linguist-vendored`（`:34`）：「沒有這行,2600+ 篇書會把這個 repo 標成 Markdown 專案,蓋掉真正的 TypeScript 原始碼」（`:33`） | `grep -n linguist-vendored .gitattributes` → `:34` |
| B4 | `.gitattributes:13-14` | 「MCP 語料是純文字,corpus.json 自己寫著 image links (../images/…) are intentionally dangling」——圖片**刻意**不進語料、連結**刻意**留壞。**部分改變（2026-10-17）**：原文仍在，但 `73b8206` 的語料裡 `../images/` 連結是 0 筆——opnsense 由 `transform.ts:33-34` 改成指向官方網址的連結（`[圖：alt](url)`）或移除 | `sed -n '13,14p' .gitattributes`；`git -c core.quotepath=false grep -c '\.\./images/' -- 'mcpjungle/books/*/corpus/*' \| wc -l` → 0 |
| B5 | `mcpjungle/books/README.md:31`（第一節） | 「**不可**再放第三份雙語合併版 —— 同內容存三份、搜三次;要雙語就讓 AI 分別查兩個語料」 | `sed -n '31p' mcpjungle/books/README.md` |
| B6 | 同上，`:201-202`（第六節） | 「**不放合併檔**：『全書』『整本書』『all-in-one』這類把所有頁面串成一檔的 md 是重複內容,會讓每次搜尋都多命中一篇超大檔,**一律排除**。目錄 / 索引頁(只有連結、沒有正文)可以保留,因為它是唯一的階層導航」 | `sed -n '201,202p' mcpjungle/books/README.md` |
| B7 | 同上，`:190-191`（第五節 `:183-193`） | front matter 擷取的文件「**不符合**」自動抽取格式——「自動抽取會把結尾的 `\"` 一起吃進網址。這類語料一律從 front matter 產生 `sources.json`」；自動抽取只掃前 15 行、只認 `> 📖 官方文件:[文字](url)` 與 `> Source: url`（`:188`），`sources.json` 優先（`:187`）。例外（`:193`）：語料由匯入腳本產生時，可在轉換時把 `source: "https://…"` 去引號，不必另產 `sources.json` | `sed -n '183,193p' mcpjungle/books/README.md` |
| B8 | 同上，`:204-206`（第六節） | `books/*/corpus/` 總量上限約 **200 MB**（語料打包進 `docs-mcp-server` 的 Docker image，也在每次 clone 下載）；原記錄約 11.4 MB（`f05dcb1` 時期，當時另寫打包進 npm 套件）。2026-10-17 實測總量 17 MB：`opnsense-en` 4.6、`opnsense-zh-tw` 4.4、`stalwart-en` 3.8、`nginx-en` 2.2、`fc-zh-tw` 1.0（982K）、`sqlsugar-zh-tw` 0.8 MB（797K），與 `:206` 一致。現行 npm 套件的 `files` 只有 `dist`、`README.md`（`mcpjungle/docs-mcp-server/package.json:10-13`） | `sed -n '204,206p' mcpjungle/books/README.md`；`du -sh --total mcpjungle/books/*/corpus`；`du -sh mcpjungle/books/*/corpus/*/` |
| B9 | `mcpjungle/books/opnsense/168小隊-啟動提示.md:3-7,13` | 「提示裡不要寫模型,否則會蓋過定義檔中的 model 設定」（`:7`）；隊員定義在全域 `~/.claude/agents/`（`:3-4`）；在 `mcpjungle/books/opnsense/source` 開工作階段（`:6`）；共 377 篇、產出放 `../168小隊/`（`:13`，即 `mcpjungle/books/opnsense/168小隊/`，`73b8206` 上尚未建立） | `cat -n "mcpjungle/books/opnsense/168小隊-啟動提示.md"`；`ls -d mcpjungle/books/opnsense/168小隊`（不存在） |

## 二、實測到的現況問題（新書不要再犯）

| # | 位置 | 問題 | 重現方式 |
|---|---|---|---|
| B10 | `nginx/source/en/000 全書 (nginx.org) en.md`（12 MB）、`nginx/source/en+zh-TW/000 全書 (nginx.org) en+zh-TW.md`（16 MB）、`opnsense/source/en+zh-TW/000 全書 (docs.opnsense.org) en+zh-TW.md`（7.3 MB）、`stalwart/source/en+zh-TW/000 全書 (stalw.art) en+zh-TW.md`（皆在 `mcpjungle/books/` 下） | **已解決（2026-10-17）**。原本：三個合併檔已被 git 納管且超過 CI 的 5 MB 上限。CI `basics` 的檢查是對**整棵樹** `find . -type f -size +5M`，只排除 `.git/` 與 `node_modules/`，**不**排除素材區，也不是只看變更檔 → 下次 CI 在 `main` 跑就會失敗。`f05dcb1` 之後 CI 尚未在 `main` 執行（`gh run list` 最後成功紀錄在 `bafd8e8` 時期）。維持機制：前三個由 `4554bdf` 移出版控，stalwart 那個從未進版控、由 `920892f` 列名；四個都由 `.gitignore:13-20` **逐檔列名**排除，不是通用規則，其他 7 個小於 5 MB 的 `000 全書` 仍在 `source/` 版控中。新書的超標檔只有 CI `ci.yml:77` 擋得住。合併檔不進語料靠各書的 `isIncluded`（opnsense `transform.ts:7` 排除 `000 `；nginx `transform.ts:17-19` 只收 `NNN [章節] 標題.md`）；語料區 `000 ` 開頭的檔案 0 個 | `find . -type f -size +5M -not -path "./.git/*" -not -path "*/node_modules/*"`（只列出本機未進版控的合併檔）；`sed -n '75,82p' .github/workflows/ci.yml`；`git show --stat 4554bdf`；`git show 920892f -- .gitignore`；`sed -n '13,20p' .gitignore`；`git -c core.quotepath=false ls-files -- 'mcpjungle/books/*/source/*' \| grep -c '/000 全書'` → 7；`git -c core.quotepath=false ls-files -- 'mcpjungle/books/*/corpus/*' \| awk -F/ '{print $NF}' \| grep -c '^000 '` → 0 |
| B11 | `mcpjungle/books/nginx/source/en/` | 原本（`f05dcb1`，356 篇）有 **41 篇**的 `title` 與檔名都是 `page`（`001 [01 en] page.md`、`003 [01 en] page.md`…），其餘 310 個標題正常（`Module ngx_http_api_module` 之類）。那 41 篇上架後，`docs_search` / `docs_outline` 回傳的檔名與標題無法區分 → 搜到也選不出要讀哪篇。2026-10-17：`source/en`（355 篇）仍有 41 篇（`01 en` 20、`02 ru` 20、另 1 篇檔名沒有章節標籤），`nginx-en` 語料裡是 0 篇。這是 `transform.ts:6-14` 的章節白名單 `INCLUDED_CHAPTERS` 間接擋下，**不是標題檢查**，防線脆弱：白名單一放寬就會漏進來（E-308 決策 4） | `git -c core.quotepath=false grep -l -E '^title: "?page"?$' -- mcpjungle/books/nginx/source/en \| wc -l` → 41；同指令改接 `\| awk -F'[][]' '{print $2}' \| sort \| uniq -c` 看章節分布；`git -c core.quotepath=false ls-files -- mcpjungle/books/nginx/source/en \| grep -c ' page\.md$'` → 41（檔名也是 `page`）；`grep -h '^title:' mcpjungle/books/nginx/source/en/*.md \| sort \| uniq -c \| sort -rn \| head -3`（第一名 `41 title: "page"`）；語料 0 篇：SKILL.md 第 3 節上架前檢查 `ID=nginx-en` → `泛名標題 0 篇` |
| B12 | `mcpjungle/books/<書>/source/<語言>/000 目錄.md` | 唯一沒有 YAML front matter 的檔案（開頭是 `# …` ＋ `> 網站：https://…`）。`> 網站：` **不是** docs-mcp 認得的兩種來源格式之一，產生器也抽不到——opnsense `zh-TW` 379 篇中就是這 1 篇缺 source（2026-10-17 重測相同）。`73b8206` 的 opnsense、nginx `isIncluded` 都不收目錄頁 | `node <skill>/templates/make-sources-json.mjs mcpjungle/books/opnsense/source/zh-TW > /dev/null`（stderr：`378 篇有 source,1 篇沒有`）；`head -3 "mcpjungle/books/opnsense/source/zh-TW/000 目錄.md"` |
| B13 | `mcpjungle/books/README.md:36-45`「現有語料」表 | **已解決（2026-10-17）**。原本：表列 `opnsense-en` / `opnsense-zh-tw`（各 378 篇），但 `main` 的語料區只有 `fc-zh-tw`、`sqlsugar-zh-tw`；加語料的 commit `b7a5efe` 只在 `feat/corpora-naming` 分支。現況：表列 6 個語料，與實際的 6 個語料資料夾一致（opnsense 改由 `import.ts` 產生，`b7a5efe` 本身仍不是 `73b8206` 的祖先）。**沒有機制在擋**，只是目前剛好一致；增刪語料要同 PR 更新表 | `sed -n '36,45p' mcpjungle/books/README.md`；`ls -d mcpjungle/books/*/corpus/*/` → 6 個；`git merge-base --is-ancestor b7a5efe HEAD && echo ancestor \|\| echo "不在 main"`；`git branch -a --contains b7a5efe` |
| B14 | `mcpjungle/books/opnsense/ONBOARDING.md` | **未解決（2026-10-17 重測）**：三節（Codebases / MCP Servers to Activate / Skills to Know About）全是 `_TODO_` 骨架；補內容屬於 mcp-library 的工作 | `cat mcpjungle/books/opnsense/ONBOARDING.md` |
| B15 | `mcpjungle/books/sqlsugar/corpus/sqlsugar-zh-tw/` 的 `事务用法.md`、`庫表管理操作指南.md`（`73b8206`） | **未解決（2026-10-17 新增）**：兩篇是空標題——沒有 front matter 的 `title:`，也沒有 `# ` 標題，第一個標題是 `## 速查表`，違反 `mcpjungle/books/README.md:165`「`# 標題` 開頭」。屬舊式語料（沒有 `import.ts`），不擋 E-308 驗收，但數量不得高於此基準（fc 0、sqlsugar 2）。追蹤單 E-319（E-308 決策 13）；修好後只改本列 | SKILL.md 第 3 節上架前檢查 `ID=sqlsugar-zh-tw` → `泛名標題 2 篇、來源問題 0 篇`、exit 1；`grep -c '^# ' "mcpjungle/books/sqlsugar/corpus/sqlsugar-zh-tw/事务用法.md"` → 0 |

## 三、衍生物的規模（說明「刪掉不可逆」）

`opnsense` 一本書四份語言資料夾，`en`、`zh-TW`、`en-translated` 各 379 篇、`en+zh-TW` 378 篇；素材區（`mcpjungle/books/*/source/`）版控中共 3751 篇 md、643 張 png/jpg/gif/webp（＋6 個 svg）。
（原記錄 2026-10-04：每份 379 篇；素材區總計 2634 篇 md（2632 篇書 + 根目錄 2 篇說明文件）、479 張 png/jpg（＋6 個 svg，當時刻意不走 LFS）；之後加入 stalwart 與 sqlsugar 的 `source/`。）
刪掉 `en+zh-TW` 等於刪掉 168小隊的審稿輸入，重建需要重跑整套擷取 + 翻譯。

```bash
for d in mcpjungle/books/*/source/; do for s in "$d"*/; do printf "%-50s %s\n" "$s" "$(git -c core.quotepath=false ls-files -- "$s" | grep -c '\.md$')"; done; done
git -c core.quotepath=false ls-files -- 'mcpjungle/books/*/source/*' | grep -c '\.md$'                       # 3751（含 sqlsugar source/ 的扁平 md 75 篇）
git -c core.quotepath=false ls-files -- 'mcpjungle/books/*/source/*' | grep -ciE '\.(png|jpe?g|gif|webp)$'   # 643（另有 6 個 svg，不另設規則）
```

篇數用 `git ls-files` 計，不受本機被 `.gitignore` 排除的合併檔影響。實測結果（2026-10-17，`73b8206`；括號內為 2026-10-04 的值，有變動才列；nginx 兩份與 opnsense `en+zh-TW` 少的 1 篇就是 B10 移出版控的合併檔）：

| 書 | 語言資料夾 × 篇數 |
|---|---|
| `multica` | `zh-CN` 92、`zh-TW` 92 |
| `nginx` | `en` 355（356）、`en+zh-TW` 355（356） |
| `opnsense` | `en` 379、`zh-TW` 379、`en+zh-TW` 378（379）、`en-translated` 379 |
| `portabase` | `en` 110、`en+zh-TW` 110 |
| `stalwart` | `en` 478、`en+zh-TW` 569（2026-10-04 尚無此書） |

## 四、不是退化、但常被誤判為「簡化」的設計（保留原樣）

| 設計 | 為什麼不是退化 |
|---|---|
| 語料不放圖片、md 內 `../images/…` 留成失效連結 | `.gitattributes:13-14` 與 `corpus.json` 的 `description` 都明文寫著這是刻意的（B4）；語料是給 AI 讀的純文字。opnsense 改成官方網址連結也不違反（B4 部分改變） |
| svg 不另設規則（原本：svg 不走 LFS） | 文字格式、可 diff、數量少（B2，`.gitattributes:23`） |
| 一本書兩種語言 = 兩個語料，不做第三份雙語 | 避免同內容存三份（B5，`books/README.md:31`）；按字母排序自然相鄰 |
| 素材區保留 `en-translated`、`en+zh-TW` 等「重複」資料夾 | 它們是審稿輸入與品質檢查中間產物（B1、第三節） |
| `000 目錄.md` 上架、`000 全書*.md` 不上架（現行：目錄頁收不收由 `isIncluded` 決定，SKILL.md 規則 10） | 目錄頁是唯一階層導航；合併檔是重複內容（B6，`books/README.md:201-202`） |

# 「越寫越簡單」證據清單（elf-express/mcp-library git 歷史）

> 調查日期：2026-09-27。來源：`E:\source\mcp-library`（remote `elf-express/mcp-library`）的 `git log --stat` / `git show` / `git diff`，
> 以及 HEAD 與工作目錄現況比對。每一條都可以用表內指令重現。**沒有證據的不列。**
> 2026-10-17 在 mcp-library `origin/release` @ `73b8206` 逐列重測（驗證 worktree `E:\source\mcp-library-e308`，只讀）：每列加「重測 2026-10-17」，
> 寫明現況、靠什麼機制維持（沒有機制就照實寫）與重現指令；原本的歷史描述保留。歷史路徑一律用 `git show <sha>:<路徑>` 引用。
> E1–E14 與 `elf-mcp-knowledge` 的同名列逐字一致（兩份 MUST 同步改）；E15、E16 是本檔專有的列，同日各自重跑；E17 為 2026-10-17 新增。

> **目前狀態（2026-10-20）**：pnpm 11 安裝缺陷已由 E-353 加入範本的 esbuild 核准並驗證解決，見末節「E-353 安裝核准驗證結果」。coverage 已由 E-322 解決（86.28%），不再列為 E-353 待修項。下列 E-322 前置、審計補正及各輪遷移結果皆為當時歷史；「未修復／仍交 E-353」記錄保留，不能解讀為目前狀態。

| # | Commit / 位置 | 檔案 | 被拿掉或變弱的東西 | 後果 / 重現方式 |
|---|---|---|---|---|
| E1 | `0115d50`（ci: monorepo 統一 CI） | `sqlsugar-mcp/.github/workflows/release.yml`（199 行，整檔刪除） | 發版流程：解析 `release: vX.Y.Z`、檢查 tag 不重複、建 annotated tag、產生 release notes、建 GitHub Release、以 `gh workflow run` dispatch docker-publish（繞過 GITHUB_TOKEN 不觸發 workflow 的限制） | 之後 repo 沒有任何建 tag / Release 的 workflow；`docker-publish.yml`、`npm-publish.yml` 雖監聽 `v*.*.*` tag，但沒有東西會產生 tag。`git show e024be8:sqlsugar-mcp/.github/workflows/release.yml`。**重測 2026-10-17：未解決** —— `.github/workflows/` 只剩 `ci.yml`、`docker-publish.yml`（`npm-publish.yml` 已由 `cf42e88` 刪除，E-125）；`docker-publish.yml:19-20` 仍監聽 `v*.*.*` tag，但沒有任何 workflow 建 tag / Release（`grep -cE 'git tag\|gh release\|create-release' .github/workflows/*.yml` 皆 0） |
| E2 | `0115d50` | 舊 `sqlsugar-mcp/.github/workflows/ci.yml` → 新 `.github/workflows/ci.yml` | `release` 分支觸發、release PR 標題格式檢查（`^release: v\d+\.\d+\.\d+`） | `git show e024be8:sqlsugar-mcp/.github/workflows/ci.yml` 對照現行 ci.yml。**重測 2026-10-17：部分改變** —— `ci.yml:19` 已恢復 push `release` 觸發（`branches: [dev, release, 'hotfix/**']`）；release PR 標題格式檢查仍沒有（`grep -c 'release: v' .github/workflows/ci.yml` → 0），CI 只做 Conventional Commits PR 檢查（mcp-library `CLAUDE.md:139`） |
| E3 | `0115d50` | `.github/dependabot.yml`（舊版 64 行 → 新版 27 行） | ① `ignore: version-update:semver-major`（「大版本更新由人工評估」）② `docker` ecosystem（監控 Dockerfile base image）③ labels / 固定排程時區 | 拿掉 ① 後大版本被自動開 PR 並合併：`b7cf68e` zod 3→4（fc）、`c6ce797` TypeScript 5→6（fc）、`f07be15`/`28e088d` express 4→5、`@types/node` 22→26。結果三個 server 的 zod / express / TS 主版本不一致（docs-mcp：zod 3、express 4；fc：zod 4、express 5、TS 6）。**重測 2026-10-17：未解決** —— `.github/dependabot.yml`（51 行）仍無 semver-major ignore（只有 dashboard 的 react / vite / vitest 個別版本上限，`:27-43`）、無 `docker` ecosystem、無 labels / 時區（`grep -cE 'semver-major\|package-ecosystem: "docker"\|labels\|timezone' .github/dependabot.yml` → 0）。主版本分岔已因 legacy 刪除（`0a37607`）而消失：repo 內只剩 docs-mcp-server，lockfile 解析 zod 4.6.6、express 5.3.0（`cd mcpjungle/docs-mcp-server && npm ci && npm ls zod express --depth=0`）；沒有機制防止下一個 server 再分岔 |
| E4 | `0115d50` 至 HEAD | `.github/workflows/ci.yml`、`.github/dependabot.yml` | 核心 `docs-mcp-server` 從未加入 `build-test` matrix、`docker-build` 驗證、dependabot | CLAUDE.md 自己承認「docs-mcp-server 的 vitest 不在此 matrix，改它後請在本機 npm test」。PR 不會跑核心 server 的 57 個測試。**重測 2026-10-17：已解決** —— docs-mcp-server 已在 `ci.yml` 的 `build-test` matrix（`:156-165`）與 `docker-build` matrix（`:216`），dependabot 也有 `/mcpjungle/docs-mcp-server`（`dependabot.yml:4-5`）；PR 會跑核心測試（`73b8206` 為 128 個），彙總 job `ci` 是組織 ruleset 的必要檢查（mcp-library `CLAUDE.md:142`、`:144`） |
| E5 | `0115d50` / `1d731f6`（收斂成多語料 docs-mcp） | `mcpjungle/docs-mcp-server/src/*` vs `git show 0a37607^:mcp/legacy/sqlsugar-mcp/sqlsugar-mcp-server/src/index.ts` | legacy sqlsugar 的 3 個 C# 範例工具（`sqlsugar_list_examples` / `sqlsugar_read_code` / `sqlsugar_search_code`）與 `sqlsugar_list_notes` 的 `include_index`（附 index.md 分類導航） | 設計文件 `bc6760c` 明寫「sqlsugar 收斂時丟掉了舊 standalone server 的 C# 範例程式碼搜尋」「fc 單書實際只有 2 個有效工具——AI 使不上力」；範例工具到 `10597a8` 才補回，`include_index` 至今未補。**重測 2026-10-17：部分解決** —— 範例工具由 `examples` capability 的 `docs_code_search` / `docs_code_read` 收編；`include_index` 仍未補（`grep -rn include_index mcpjungle/docs-mcp-server/src` 0 筆；legacy `git show 0a37607^:mcp/legacy/sqlsugar-mcp/sqlsugar-mcp-server/src/index.ts \| grep -c include_index` → 3）。legacy 已於 `0a37607` 刪除（E-126） |
| E6 | 現況（HEAD `bafd8e8`） | `mcpjungle/docs-mcp-server/src/index.ts` vs legacy `git show 0a37607^:mcp/legacy/sqlsugar-mcp/sqlsugar-mcp-server/src/index.ts`、`git show 0a37607^:mcp/legacy/fc-designer-mcp/src/index.ts` | 工具描述變薄：legacy 每個工具都有逐參數說明 + `範例:query="WhereIF" / ...`；docs-mcp 的 `docs_code_search` / `docs_code_read` / `docs_symbol` 只剩「參數:corpus、query(空=列檔)、limit、context_lines」，8 個工具全部沒有「範例」行 | 直接比對兩個 `index.ts` 的 `description:`。**重測 2026-10-17：未解決** —— `grep -cE '範例[:：]' mcpjungle/docs-mcp-server/src/index.ts` → 0；legacy `git show 0a37607^:<上欄路徑> \| grep -cE '範例[:：]'` → sqlsugar 3、fc 2（E-308 決策 6） |
| E7 | `e3d8808`（fix(symbol): remove token-OR fallback） | `docs-mcp-server/src/corpus.ts`、`tests/symbol.test.ts` | 反向證據：先前 AI 在 `doSymbol` 加了**未經授權**的「token OR 模糊比對」fallback，使測試「假通過」；修正時移除 fallback，測試改用 fc 語料真實標題（`API方法`、`表單 API`） | commit message：「Remove unauthorized token-OR fallback from doSymbol (was causing false passes)」。**重測 2026-10-17**：`git merge-base --is-ancestor e3d8808 73b8206` exit 0，`git log -1 --format=%B e3d8808` 第 3 行仍是上述原文 |
| E8 | `dd4853a`（address code review findings） | `docs-mcp-server/src/index.ts`、`corpus.ts` | 反向證據：review 抓到①模組註解仍寫「工具數恆為 4」②`requireExamples` / `doSymbol` 缺 corpus 的錯誤訊息被寫成精簡版「請指定 corpus(可用:…)」，少了「用 docs_list_corpora / 改用 /mcp/<corpus>」的下一步提示 ③ zod schema 在 `createServer` 內每個 session 重建 | 已修；證明「錯誤訊息寫短」「註解不同步」會自然發生。**重測 2026-10-17**：`git merge-base --is-ancestor dd4853a 73b8206` exit 0；三點在現行程式仍是修好的樣子：`mcpjungle/docs-mcp-server/src/index.ts:5` 寫「工具數恆為 8」、`src/corpus.ts:567,659,724` 的缺 corpus 提示含 `docs_list_corpora` 與 `/mcp/<corpus>`、zod schema 在模組層級（`src/index.ts:47-109`，`createServer` 在 `:137`） |
| E9 | 現況（文件漂移） | `docs-mcp-server/README.md` | 仍寫「工具數恆為 4」、工具表只列 4 個、「範例 C# 程式碼搜尋…目前未納入多語料 v1」 | `42aa316` 把工具 4→8 時沒更新 README（只更新了根 CLAUDE.md `cede8b1`）。**狀態 2026-10-04：已修復** —— 當時 README 已寫「工具數恆為 8」且工具表列齊 8 個 `docs_*`。保留此列作為「改程式不改 README」會自然發生的紀錄。**重測 2026-10-17：已解決** —— `mcpjungle/docs-mcp-server/README.md:6` 寫「工具數恆為 8」，工具表 8 列。沒有機制在擋，靠 `elf-mcp-knowledge` 禁止簡化 10 與第 3 節 Step 7。重現：`grep -n '恆為 8' mcpjungle/docs-mcp-server/README.md`；``grep -cE '^\| `docs_' mcpjungle/docs-mcp-server/README.md`` → 8 |
| E10 | 現況（文件漂移） | `git show 329a62b^:mcpjungle/servers/fc.json`、`git show 329a62b^:mcpjungle/servers/sqlsugar.json` | `description` 只列 `docs_search / docs_read / docs_list_corpora (/ docs_cheatsheet)`；沒有 `docs_outline`、`docs_symbol`（fc）、`docs_code_search`/`docs_code_read`（sqlsugar） | gateway dashboard / AI 看到的 server 描述少了一半能力。**狀態 2026-10-04：已修復** —— 檔案隨 `329a62b` 改名為 `fc-zh-tw.json`（列 `docs_list_corpora / docs_search / docs_read / docs_outline / docs_symbol`，5 個＝4 無條件＋symbol）與 `sqlsugar-zh-tw.json`（列 7 個＝4＋cheatsheet＋code_search＋code_read），與各自 capabilities 相符（`git show 56e67b6^:mcpjungle/servers/fc-zh-tw.json` 列 5 個、`git show 56e67b6^:mcpjungle/servers/sqlsugar-zh-tw.json` 列 7 個）。**重測 2026-10-17：已解決，機制改變** —— 手寫註冊檔已由 `56e67b6`（E-132）刪除，registrar 用 `mcpjungle/registry/gen-book-configs.mjs:57,62` 依 `corpus.json` 的 capabilities 自動列工具。重現：`T=$(mktemp -d); node mcpjungle/registry/gen-book-configs.mjs mcpjungle/books "$T"` 後 `$T/fc-zh-tw.json` 的 description 列 5 個工具、`$T/sqlsugar-zh-tw.json` 列 7 個 |
| E11 | 現況（文件漂移） | `mcpjungle/README.md` §六 | 指令仍用 compose service 名 `docs-mcp`（`build docs-mcp` / `push docs-mcp`），但 `52a4010` 已改名為 `docs-mcp-server` | 照 README 打指令會報 `no such service`。**重測 2026-10-17：已解決** —— `mcpjungle/README.md:133-134` 改用 `docker compose build docs-mcp-server registrar` / `docker compose push docs-mcp-server registrar`，service 名見 `compose.yaml:50`。沒有機制在擋（CI 不檢查 README 指令），照實寫 |
| E12 | `83cb805`（pin all actions to SHA） | `.github/workflows/npm-publish.yml` vs `ci.yml` | 同一 repo 不同 workflow 釘的版本不一致：npm-publish 用 `actions/checkout@df4cb1c… # v6`、`actions/setup-node@49933ea… # v4`；ci/docker-publish 用 checkout `# v7`、setup-node `# v6` | 未來 dependabot 只會各自 bump，版本持續分岔。**重測 2026-10-17：已解決（靠刪除，沒有機制在擋）** —— `npm-publish.yml` 已由 `cf42e88`（E-125）刪除（舊檔 `git show 83cb805:.github/workflows/npm-publish.yml`）；`ci.yml`、`docker-publish.yml` 的 checkout 全是 `3d3c42e… # v7`，setup-node 只在 `ci.yml`、全是 `949feb2… # v6`（`grep -n 'uses: actions/' .github/workflows/*.yml`）。dependabot 有 `github-actions` ecosystem（`dependabot.yml:46-51`），但沒有規則保證各 workflow 釘同一版 |
| E13 | 工作目錄（**仍未 commit**，實測 2026-10-04） | `mcpjungle/docs-mcp-server/package.json`（2026-10-04 時位於舊的 `mcp/` 目錄下） | 加了 `express-rate-limit ^8.5.2` 依賴，但 `src/` 沒有任何 import；`nginx.example.conf`（當時在 `mcpjungle/` 下，現在在 repo 根目錄）註解寫「rate limit 放 nginx、不放應用層」 | 決策未定就半套落地，且這個改動從 `fb1d578` 起就一直掛在工作目錄（`fb1d578` 不在 `origin/release` 歷史中，`git branch -a --contains fb1d578` 無結果；同標題的 commit 是 `f8b7416`）。2026-10-04 實測：HEAD 的 `package.json` 沒有此依賴（`grep -c` → **0**），只出現在工作目錄的未提交改動，`src/` 沒有任何 import。重現（以同標題的 `f8b7416` 為例）：`git show f8b7416:mcp/docs-mcp-server/package.json \| grep -c express-rate-limit` → **0**；`git grep -c express-rate-limit f8b7416:mcp/docs-mcp-server/src` 無輸出（exit 1）。**重測 2026-10-17：已解決** —— `f21c6f1`（PR #123，E-250）在 `mcpjungle/docs-mcp-server/src/http.ts:19` import `express-rate-limit` 並用於 `/mcp*`（證據見 `elf-mcp-server` E15），`package.json:50` 宣告 `^8.7.1`。重現：`grep -n express-rate-limit mcpjungle/docs-mcp-server/src/http.ts mcpjungle/docs-mcp-server/package.json`。`nginx.example.conf:8` 的註解「為什麼 rate limit 放這裡、不放應用層」仍在，與應用層限流並存。沒有機制擋「加了依賴卻不使用」，照實寫 |
| E14 | 工作目錄（**未納管**，實測 2026-10-04） | `mcpjungle/nginx.example.conf`、`AGENTS.md`、`.mcp.json`、`docs/superpowers/**` | 這些檔案只存在於本機工作目錄，從未 `git add`。其中 `nginx.example.conf` 是 `elf-mcp-gateway` 規則 16 與禁止簡化 5 的權威出處——重新 clone 的人拿不到它 | 2026-10-04 當時用 `git ls-files --error-unmatch` 檢查（回非零＝未納管）；在歷史 commit 上重現：`git ls-tree --name-only f8b7416 -- mcpjungle/nginx.example.conf AGENTS.md`（無輸出＝當時未納管）；`git status --short \| grep '^??'`。**重測 2026-10-17：已解決** —— `nginx.example.conf`（已移到 repo 根目錄）與 `AGENTS.md` 已納管：`git ls-files --error-unmatch nginx.example.conf AGENTS.md` exit 0；`.mcp.json` 由 `.gitignore:11` 排除；`docs/superpowers/**` 不在版控（`git ls-files docs/superpowers` 0 筆）。沒有機制擋「權威檔留在本機不提交」，照實寫 |
| E15 | `f21c6f1`（mcp-library PR #123，`fix(E-250)`） | `mcpjungle/docs-mcp-server/src/http.ts` | 若被簡化掉會失去的東西：`/mcp*` 在驗證前限流、且只計 401（`skip` 與驗證共用 `isAuthorized()`）。之前完全沒有限流，CodeQL `js/missing-rate-limiting` 4 筆（#86–#89），合併後在 dev 上全部 fixed | `gh api "repos/elf-express/mcp-library/contents/mcpjungle/docs-mcp-server/src/http.ts?ref=f21c6f16b9eb5e22fe8e311f00e984185443765f" -q .content \| base64 -d \| grep -n mcpLimiter`（預期 7 行：定義 1 + 6 條 `/mcp*` 路由）。**重測 2026-10-17：仍在（有測試在擋）** —— 上述 `gh api` 指令實跑仍是 7 行（`:80` 定義、`:162-164`、`:167-169` 六條路由）；`git merge-base --is-ancestor f21c6f1 73b8206` exit 0；`73b8206` 的同一檔 `grep -c mcpLimiter mcpjungle/docs-mcp-server/src/http.ts` → 7，`trust proxy` false 在 `:53`、預設 20 次／15 分鐘在 `:180-181`（環境變數名是 `DOCS_MCP_RATE_LIMIT_MAX`／`DOCS_MCP_RATE_LIMIT_WINDOW_MS`）。機制：`tests/http-ratelimit.test.ts` 7 個測試，在 `ci.yml:156-165` 的 `build-test` matrix 內、由 `:188` 的 `npm test` 執行（`cd mcpjungle/docs-mcp-server && npm test` → 128 passed） |
| E16 | mcp-library `a020cd0`（`mcpjungle/docs-mcp-server/README.md`）、`5d00449`（`CLAUDE.md`） | `mcpjungle/docs-mcp-server/README.md`、`CLAUDE.md`「A. 本機 stdio」 | 本機 stdio 的用法是 node 直接跑 `dist/index.js`（上游文件寫 `npm install && npm run build`；本 skill 改用 `npm ci`，因為 `package-lock.json` 存在，已在 `a020cd0` 核對），npm 套件已停止發布；skillshare-source 舊版 `elf-mcp-server` 規則 8 仍寫成 npx 指令（`559e52a`），已改掉 | 照舊寫法的人會拿不到套件而連不上本機 stdio。重現：`gh api 'repos/elf-express/mcp-library/contents/mcpjungle/docs-mcp-server/README.md?ref=a020cd0' -H 'Accept: application/vnd.github.raw' \| grep -n 'dist/index.js'`（預期 1 行）；`gh api 'repos/elf-express/mcp-library/contents/CLAUDE.md?ref=5d00449' -H 'Accept: application/vnd.github.raw' \| grep -n 'dist/index.js'`（預期 1 行）；舊寫法：`git grep -nE '(npx|npm (i|install|exec)|pnpm (add|dlx|exec)|yarn (add|dlx)|bunx)[^|]*@elf-express[/]' 559e52a` → 1 筆。**重測 2026-10-17：仍成立（沒有機制在擋，靠文件）** —— 上述三條指令實跑：`a020cd0` 的 README 1 行（`:21`）、`5d00449` 的 `CLAUDE.md` 1 行（`:75`）、`559e52a` 舊寫法 1 筆；`git merge-base --is-ancestor a020cd0 73b8206`、`git merge-base --is-ancestor 5d00449 73b8206` 皆 exit 0；`73b8206` 仍是 `mcpjungle/docs-mcp-server/README.md:21`、`CLAUDE.md:75` 各 1 行 `dist/index.js`，上游仍寫 `npm install && npm run build`（`README.md:14`、`CLAUDE.md:73`） |
| E17 | skillshare-source `mcp/elf-mcp-server/templates/package.json` vs mcp-library `origin/release` @ `73b8206` | `mcp/elf-mcp-server/templates/package.json`、`mcpjungle/docs-mcp-server/package-lock.json` | 範本依賴落後參考實作一個主版本：範本宣告 zod `^3.25.76`、express `^4.21.2`、SDK `^1.29.0`；docs-mcp-server lockfile 是 zod 4.6.6、express 5.3.0、SDK 1.32.1（`package-lock.json:3327,1775,514`） | **歷史狀態：未解決（2026-10-17）** —— 照範本開新 server 會落在 zod 3／express 4，與規則 5 的實測值不一致。升級是有破壞性變更的遷移，未驗證，不在 E-309 範圍；追蹤 E-321（E-308 決策 16）。重現：`grep -nE '"(zod|express|@modelcontextprotocol/sdk)"' mcp/elf-mcp-server/templates/package.json`（3 行：`:20`、`:21`、`:23`）；在 mcp-library `cd mcpjungle/docs-mcp-server && npm ci && npm ls zod express @modelcontextprotocol/sdk --depth=0`  **最新狀態（E-321／E-322）：依賴落差已解決**。範本已遷移至 zod 4／express 5／SDK 1；候選各依賴實際解析值、原有 9＋新增 22、build／stdio／基線與候選逐檔 coverage 證據及提交 SHA，完整列在本檔「E-322 遷移驗證結果」與 E-322 留言。**E-322 當時歷史**：原 pnpm 11 安裝缺陷仍未修復；52.31% 的原始 coverage 基線保留，兩項交 E-353，不把驗證副本的處置寫成原範本已修。**目前狀態（E-353）**：安裝缺陷已加入範本 esbuild 核准並驗證解決；coverage 已由 E-322 解決（86.28%）。全新副本的安裝、build、原有 9＋新增 22 與逐檔 coverage 證據見末節「E-353 安裝核准驗證結果」。 |
| E18 | mcp-library `73b8206` vs skillshare-source `fa331979` | `mcpjungle/docs-mcp-server/package-lock.json:3071,3210`、`stack/elf-stack/SKILL.md:57,64,69,97–101` | **mcp-library 違反中（TypeScript）**：lockfile TypeScript 7.0.2 不在 elf-stack:64 `^5.6.3`（解析 5.9.3）；Vitest 5.0.3 符合 :69 `^5.0.1`，不可誤標違反。:57 是前端／桌面，:97–101 的 MCP 節未規定這兩個版本 | 適用範圍與範本保留 Vitest 4 的治理交 [E-351](https://linear.app/elf-express/issue/E-351)。本單採 A，不升 TypeScript／Vitest／coverage-v8，不改 stack。重現：在 mcp-library 執行 `git show 73b8206:mcpjungle/docs-mcp-server/package-lock.json`，核對 3071、3210 行；在 skillshare-source 執行 `git show fa331979:stack/elf-stack/SKILL.md`，核對 57、64、69、97–101 行；逐行原文亦貼在 E-321 Spec |

## E-322 開工前置：原範本基線不乾淨（2026-10-19）

來源：skillshare-source `fa33197944f06b306bace08b387b7ec6645dfd33` 的 `mcp/elf-mcp-server/templates/`；Node `v24.18.0`、pnpm `11.28.3`。本節只記錄實際前置證據，不代表依賴遷移已實作或通過審計；原有 `knowledge.test.ts` 9 個測試及所有斷言未修改。

### 安裝缺陷：E-353，當時未修復（歷史）

原 materialize 腳本僅替換範本佔位並固定本輪 TS／Vitest／coverage 配套，沒有 build script 核准；它的 SHA256 是 `CD38E8C08964DB53E79386635E8D71DB5A7244EF3405A70EF3A908B8E5A9AE5E`。原始副本執行：

```powershell
pnpm --dir E:/tmp/e322-verification/baseline install --no-frozen-lockfile
```

實際 exit `1`：`[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.2`。pnpm 11 的 strictDepBuilds 檢查會對未核准的相依建置腳本報錯；範本沒有對應核准設定，這是原範本缺陷，不是本單遷移所致。錯誤單 [E-353](https://linear.app/elf-express/issue/E-353) related [E-321](https://linear.app/elf-express/issue/E-321)；Eddie 明確指定本單不修，除非另有指示。依據：[pnpm build settings](https://pnpm.io/settings/build#allowbuilds)。

Eddie 核准的**驗證處置**：只改 repo 外 `e322-materialize.mjs`，對每個產生的基線／候選副本同樣寫入以下 `pnpm-workspace.yaml`，不跑互動式 approve-builds、不改全域設定，也不新增此檔到本 repo 的範本。

```yaml
allowBuilds:
  esbuild: true
```

腳本新增內容（在 `render(resolved);` 後；完整腳本、diff、雜湊亦已貼 [E-322](https://linear.app/elf-express/issue/E-322)）：

```js
// Verification-only workaround: apply equally to baseline and candidate copies.
// The shipped template's missing approval is tracked separately; do not fix it here.
fs.writeFileSync(path.join(resolved,'pnpm-workspace.yaml'),'allowBuilds:\n  esbuild: true\n');
```

修改後 SHA256：`E233F40EB2008B70E770660390F3171CD16E4D05939970CDAC620295D02150D4`。原失敗副本保留，使用新目錄 `E:/tmp/e322-verification/baseline-esbuild-v2` 重跑；安裝採專用 `--store-dir E:/tmp/e322-verification/pnpm-store-v2`，候選亦須用相同腳本與設定。

```powershell
node E:/tmp/e322-materialize.mjs E:/tmp/e322-verification/baseline-source/mcp/elf-mcp-server/templates E:/tmp/e322-verification/baseline-esbuild-v2
pnpm --dir E:/tmp/e322-verification/baseline-esbuild-v2 --store-dir E:/tmp/e322-verification/pnpm-store-v2 install --no-frozen-lockfile
pnpm --dir E:/tmp/e322-verification/baseline-esbuild-v2 --store-dir E:/tmp/e322-verification/pnpm-store-v2 install --frozen-lockfile
pnpm --dir E:/tmp/e322-verification/baseline-esbuild-v2 why esbuild
```

兩次安裝實際均 exit `0`；首次輸出包含 `esbuild@0.28.2 postinstall: Done`。此結果只能稱為「套用驗證處置後安裝成功」，**不能寫成原範本已修復或基線全綠**。

`pnpm why esbuild` 原始輸出（exit `0`）：

```text
esbuild@0.28.2
├─┬ tsx@4.23.15
│ ├── @elf-express/e322-fixture@1.0.0 (devDependencies)
│ └─┬ vite@8.3.4
│   ├─┬ @vitest/mocker@4.1.9
│   │ └─┬ vitest@4.1.9
│   │   ├── @elf-express/e322-fixture@1.0.0 (devDependencies)
│   │   └─┬ @vitest/coverage-v8@4.1.9
│   │     ├── @elf-express/e322-fixture@1.0.0 (devDependencies)
│   │     └── vitest@4.1.9 [circular]
│   └── vitest@4.1.9 [deduped]
└── vite@8.3.4 [deduped]

Found 1 version of esbuild
```

### 調整後基線：9 個測試通過，coverage 仍不合格

| 指令／檢查（於新副本） | exit | 實際結果 |
| --- | --- | --- |
| `pnpm run build` | 0 | `tsc` 通過 |
| `pnpm exec vitest run src/knowledge.test.ts --reporter=json --outputFile=../results/baseline-v2-original9.json` | 0 | 9 passed、0 failed、0 pending |
| `pnpm run test:coverage` | 1 | 9 passed，但 lines **52.31%（79/151）＜55%**；`http.ts` 0%、`knowledge.ts` 89.77% |
| `node E:/tmp/e322-baseline-smoke.mjs`（同樣記錄在 E-322 的 SDK Client 冒煙） | 0 | initialize → initialized → tools/list → tools/call；3 工具 `fixture_list/search/read`，read 回 `# alpha.md` 與 `# Alpha`，protocol errors `[]` |

coverage 門檻、排除清單與原測試均未改；目前基線**不乾淨**，不得把 9 個測試通過等同 coverage 通過。Task 1 等 Eddie 的審計對話通過後才能開始；自派審查者只算自審。

量測副本實際解析：SDK `1.32.1`、express `4.22.3`、zod `3.25.76`、express-rate-limit `8.7.1`；TypeScript `5.9.3`、Vitest／coverage-v8 `4.1.9`、tsx `4.23.15`、@types/express `4.17.25`、@types/node `24.19.2`。這些是原宣告 range 的本輪解析結果，不是候選升級結果，也不取代參考實作 `73b8206` 的 lockfile 值。

SHA256：新副本 lockfile `A7955C8228347E57B5498014B5E3F01D8BC6F76C7DA6B0C3EB2EF938EE58A38C`；原測試檔 `FC67B4DC8E5E9C064D7DC1B6096500FC5BDC454AF41BDC93300D68220BA89A86`。完整安裝、why、build、9 測試 JSON、coverage 與 stdio 輸出存於 repo 外 `E:/tmp/e322-verification/results/baseline-v2-*`，重點與命令已回寫 E-322。

### 四處審計補正：防覆蓋與逐檔 coverage（待 Task 3 一併 commit）

Eddie 確認前置處置後要求：Task 1 等其審計對話只複核4處後才開始；自派審查者只算自審。「E-322 開工前置」段已寫在本 repo 的本檔，但尚未 commit，連同本次補充全部併入 Task 3 的 commit，不能在 Task 1／2 提前 stage。

本輪查證：`Test-Path mcp/elf-mcp-server/templates/pnpm-workspace.yaml` → `False`；`git ls-tree -r --name-only fa33197944f06b306bace08b387b7ec6645dfd33 -- mcp/elf-mcp-server/templates/pnpm-workspace.yaml` → 空白、exit0。原範本及固定基準都沒有此檔。

repo 外 materialize 腳本現已加防覆蓋：來源含 `pnpm-workspace.yaml` 就在 copy 前停止；新副本建核准檔採 `{ flag: 'wx' }`，不能覆寫既有檔。原測量用腳本 SHA256 `E233F40EB2008B70E770660390F3171CD16E4D05939970CDAC620295D02150D4` 保留作上述 v2 基線來源；防覆蓋新版 SHA256 為 `5E76CDA95E64B5C6D3BC03CD9148294B90C82BC7011035902CBCAA4E23993B15`。完整 diff／原文在 E-322。`node --check` exit0，repo 外檢查 exit0：無既有檔建立成功；重用 output 停止且檔案雜湊不變；來源已有設定則停止、來源雜湊不變且不建立 output。沒有為此修改產品範本或開始 Task 1。

E-353 標題已擴為「elf-mcp-server 範本兩項基線缺陷：pnpm 11 安裝失敗（esbuild 未核准）／coverage 52.31% 未達 55%」，related E-321 維持；第二個基線發現已在 E-353 留言，保留原始失敗報表。下表的基線逐檔分子／分母來自原 `coverage-final.json`，以該次已安裝的 istanbul-lib-coverage `toSummary().lines` 讀取，與原終端報表相符。

| 來源檔案 | 基線 covered/total | 基線 lines% | 候選 covered/total／lines% | 狀態 |
| --- | --- | --- | --- | --- |
| `src/http.ts` | 0/63 | 0% | 尚未執行 | 正式審核後以新增 HTTP 測試實測，Task 3 填入 |
| `src/knowledge.ts` | 79/88 | 89.77% | 尚未執行 | 原程式及原有9測試不改，Task 3 以實測填入 |
| `src/schemas.ts` | 原基線無此檔 | 不適用 | 尚未執行 | 新來源檔須納入原coverage規則，不准另加exclude |
| `src/index.ts` | 原設定排除 | 不適用 | 未實作；維持原排除設定 | stdio協定另有實測，不混入coverage分母 |
| 所有納入來源合計 | 79/151 | 52.31%（FAIL） | 尚未執行 | 候選必須靠新增測試達到≥55%、命令exit0 |

目前候選尚未執行，不能把表中的驗收要求寫成已通過；Task 3 必須填上候選每個檔案的實際 covered/total／百分比與整體數字，新增來源也逐一加列。55%門檻、排除清單、原有9測試及斷言不改；只調reporter、隱藏來源或更換分母都不能作改善證據。兩份原始 coverage 報告及 JSON 一起保留，E-353 的兩項基線事實不抹去。

## 不是退化、但常被誤判為「簡化」的變更（保留原樣）

| Commit | 內容 | 為什麼不是退化 |
|---|---|---|
| `6d25d6f` refactor: 簡化部署 | 根 compose 不再內建 Postgres / shared-db 網路，DB 走外部 IP、網路 stack 自建 | 使用者明確決策（commit message 有沙盒實測），`shared-db/` 與 localtest compose 檔當時保留為選用（`git show -s --format=%B 6d25d6f` 最後一行）。`73b8206` 已沒有這兩者：根 `compose.yaml` 重新內建 `postgres`（`:10-25`），並存測試改用 `docker compose -p mcp-test up -d --build`（mcp-library `CLAUDE.md:31-37`） |
| `75c0649` vendor MCPJungle fork | gateway 改從 `mcpjungle/MCPJungle` 源碼 build | 取代 pull 官方 image，為了新 dashboard；不是移除功能 |
| `54a9c08` registrar 改烤 image | 移除 registrar 的 bind mount | 修 Dockhand「mkdir /app: read-only file system」；功能等價 |
| `e3d8808` 移除 token-OR fallback | 刪掉程式碼 | 刪的是「讓測試假通過」的邏輯，屬於修正 |

## 對 skill 的直接影響

- E1–E4、E12 → `elf-mcp-gateway` / `elf-mcp-server` 的 CI 規則與「禁止簡化」
- E5、E6、E8、E10 → 工具描述、錯誤訊息、capability 收編規則
- E7 → 「不准為了讓測試過而放寬比對邏輯」
- E9–E11 → 「改工具 / 改名 / 加語料必須同 PR 更新的文件清單」
- E15、E16 → 規則 17、禁止簡化 8、12（限流與本機 stdio 用法）
- E17 → 規則 5 的範本落差註記（依賴落差及 coverage 由 E-321／E-322 驗證解決；安裝缺陷由 E-353 驗證解決，原基線歷史證據保留）

## E-322 遷移驗證結果（2026-10-20）

> 下列保留首次候選 task2-candidate-v1 的實測歷史；PR #27 審查後的最終候選、修正 SHA 與最新 coverage 見本節末「PR #27 審查補正：最終候選」。

### 來源、寫集與處置邊界

- 正式 Plan：[E-322](https://linear.app/elf-express/issue/E-322)，父 Spec：[E-321](https://linear.app/elf-express/issue/E-321)。Eddie 的審計對話複核四處通過後才開始產品 Task；自派程式審查只算自審。
- 開工 worktree 在 Task 1 前以 `git merge origin/dev` 快轉到 `e1c665e1fefa6a2f5744554afed252d9b1f7f5cc`，`git merge-base --is-ancestor origin/dev HEAD` exit 0。`git diff fa33197944f06b306bace08b387b7ec6645dfd33 origin/dev -- mcp/elf-mcp-server/` 空白，原基線副本仍有效。
- Task 1 程式提交 `bbfcc7565c1e86572c2c8ae9a0ccfdedf8a8353a`：遷移四項依賴宣告、原樣搬出三個 schema、完整 schema 註冊、8 個 schema 與 2 個真實 stdio 回歸；Task 2 提交 `31f923ec67dab6050e88a025388ace6d0611274b`：HTTP factory、錯誤包裝及 12 個真實 HTTP 回歸。
- 只改 `mcp/elf-mcp-server/`；`knowledge.ts`、`knowledge.test.ts`、`vitest.config.ts`、`tsconfig.json`、Dockerfile、compose 及其餘套件宣告不變。`git diff --exit-code e1c665e -- mcp/elf-mcp-server/templates/src/knowledge.test.ts mcp/elf-mcp-server/templates/vitest.config.ts` exit 0。原測試 SHA256 仍為 `FC67B4DC8E5E9C064D7DC1B6096500FC5BDC454AF41BDC93300D68220BA89A86`。
- 上述開工前置與審計補正 evidence 在 Task 1／2 均未 stage／commit，與本結果段一起併入 Task 3 文件提交。D01–D14 的完整舊行／新文字對照保留在 Plan；E17 歷史與原重現指令完整保留。
- E-322 單獨發版，不併入 E-318／E-352 本次發版；只準備 PR 到 dev。release／main 快轉與實際 `skillshare sync` 由 Eddie 執行，結案與清理須等發版及所有 target 驗證完成。

### 公平量測與實際版本

兩份副本使用相同 Node `v24.18.0`、pnpm `11.28.3`、TS `5.9.3`、Vitest／coverage-v8 `4.1.9`，未改範本的工具鏈宣告。repo 外 materialize 程式及完整原文見 Plan；最終腳本 SHA256 `5E76CDA95E64B5C6D3BC03CD9148294B90C82BC7011035902CBCAA4E23993B15`。來源 YAML 在 copy 前檢查，存在即停；副本以 `{flag:'wx'}` 建立 `allowBuilds: { esbuild: true }`（實際多行 YAML），不覆蓋既有設定。原範本沒有 `pnpm-workspace.yaml`，本單也未新增；pnpm 11 安裝缺陷仍由 E-353 追蹤。

基線 `baseline-esbuild-v2` 的舊腳本輸出與最終 guard 版的 `pnpm-workspace.yaml`／`package.json` 逐檔 `cmp` 都是 0；guard 只加停止條件，不改有效量測輸出。候選 `task2-candidate-v1` 使用最終 guard 版。兩者都依序 install、frozen-install，沒有執行互動式 approve-builds。副本及原始 JSON／log 留在 repo 外 `E:/tmp/e322-verification/`，不進版控或 skill targets。

| 套件 | 原範本宣告 | 基線實際解析 | 候選宣告 | 候選實際解析 |
|---|---|---|---|---|
| @modelcontextprotocol/sdk | ^1.29.0 | 1.32.1 | ^1.32.1 | 1.32.1 |
| express | ^4.21.2 | 4.22.3 | ^5.3.0 | 5.3.0 |
| zod | ^3.25.76 | 3.25.76 | ^4.6.6 | 4.6.7 |
| @types/express | ^4.17.21 | 4.17.25 | ^5.0.6 | 5.0.6 |
| express-rate-limit | ^8.7.1（未改） | 8.7.1 | ^8.7.1 | 8.7.1 |
| @types/node | ^24.0.0（未改） | 24.19.2 | ^24.0.0 | 24.19.2 |
| tsx | ^4.19.2（未改） | 4.23.15 | ^4.19.2 | 4.23.15 |
| typescript | ^5.9.3（未改；副本固定精確值） | 5.9.3 | ^5.9.3 | 5.9.3 |
| vitest／@vitest/coverage-v8 | ^4.1.9（未改；副本固定精確值） | 4.1.9 | ^4.1.9 | 4.1.9 |

候選解析值為本輪實際安裝結果，不是假稱 mcp-library `73b8206` lockfile 的版本（參考實作 Zod 為 4.6.6）。基線 lock SHA256 `A7955C8228347E57B5498014B5E3F01D8BC6F76C7DA6B0C3EB2EF938EE58A38C`；Task 1／2 候選 lock 均為 `B0A8311ED8EEC47A70E32C3BB8567DB8B95EB69ED43C2AED6BDB3C0B1EAA9D89`。完整解析值由各副本 `pnpm list --depth=0 --json` 保存。

### RED／GREEN 與 9＋22＝31

1. Task 1 RED：第一輪缺少 schema 模組；原樣搬出後，仍用 Zod 3 的 `task1-red-zod3-v1` install／build exit 0，新 10 個有 5 passed、5 failed。S1／S7 偵測到仍有 `.errors`，S2／S3 缺 `origin:'string'`；真實 P2 `tools/call` 的 `{query:'x',typo:true}` 被接受（`isError` 為 undefined）。不是把安裝失敗當 RED。
2. Task 1 GREEN：改用 Zod 4 與完整 object schema 註冊後，原 9、新 10 分開皆通過；每個 `.strict()`／min／max／default／describe 及中文錯誤訊息保留。三個工具皆有未知欄位拒絕的實際協定測試。中間 coverage 仍 exit 1、82/154＝53.24%，HTTP 0/63；完整 55% 驗收在 Task 2，未把這次失敗寫成通過。
3. Task 2 RED：只抽 app factory 後，H1–H8 原有行為通過，H9–H12 收到 HTML 而非 JSON-RPC（8 passed／4 failed）。證明 scope 同步例外、session rejection、壞 JSON、過大 body 的格式缺口。
4. Task 2 GREEN：HTTP 12 通過，保留六路由、auth／限流、session、公開 health、8mb。只有驗證失敗耗額度，spoof X-Forwarded-For 無法換來源；正確 token 在額度耗盡後仍可呼叫。H12 同時驗接近 8 MiB 的有效 JSON 成功與超過上限的 413。headersSent 只 next(err)，公開錯誤回應不洩漏內部原因。
5. 全新 Task 1／2 程式審查各為 Critical 0／Important 0／Minor 0；這是程式自審，不代替 Eddie 正式 Plan 審計。

在各 materialized 副本執行（先依 Plan materialize 至尚不存在的新目錄，安裝時指定共用測試 store；結果檔輸出到旁邊 results）：

```powershell
pnpm --store-dir E:/tmp/e322-verification/pnpm-store-v2 install --no-frozen-lockfile
pnpm --store-dir E:/tmp/e322-verification/pnpm-store-v2 install --frozen-lockfile
pnpm run build
pnpm exec vitest run src/knowledge.test.ts --reporter=json --outputFile=../results/task2-original9.json
pnpm exec vitest run src/schema.test.ts src/protocol.test.ts --reporter=json --outputFile=../results/task2-new10.json
pnpm exec vitest run src/http.test.ts --reporter=json --outputFile=../results/task2-http12.json
pnpm exec vitest run src/schema.test.ts src/protocol.test.ts src/http.test.ts --reporter=json --outputFile=../results/task2-new22.json
pnpm exec vitest run --reporter=json --outputFile=../results/task2-all31.json
pnpm run test:coverage
```

實際候選輸出：install／frozen-install／build 均 exit 0；**原有 9 passed；schema/protocol 新 10 passed；HTTP 新 12 passed；新增合計 22 passed；總計 31 passed**，每份 failed／pending／todo 均 0，命令均 exit 0。沒有 skip／todo／only，不刪測試或放寬斷言。

真實 stdio（SDK Client + StdioClientTransport）完成 initialize → notifications/initialized → tools/list → tools/call；`task2-stdio.log` exit 0 的原始回應如下。協定解析錯誤 `[]`，啟動日誌只在 stderr；兩個 stdio 回歸另驗正常關閉且子程序 exit 0。

```json
{
  "toolCount": 3,
  "names": ["fixture_list", "fixture_search", "fixture_read"],
  "callResult": {
    "content": [{"type":"text","text":"# alpha.md\n\n# Alpha\n\nKeyword one.\n"}]
  },
  "protocolErrors": []
}
```

### 基線／候選逐檔 coverage（原門檻與排除清單未改）

兩份 `coverage/coverage-final.json` 使用各自已安裝的 `istanbul-lib-coverage`：`createCoverageMap` → `fileCoverageFor(file).toSummary().lines`／`getCoverageSummary().lines`，保留分子與分母。

| 檔案 | 基線 covered/total | 基線 lines% | 候選 covered/total | 候選 lines% |
|---|---|---|---|---|
| src/http.ts | 0/63 | 0% | 64/74 | 86.48% |
| src/knowledge.ts | 79/88 | 89.77% | 79/88 | 89.77% |
| src/schemas.ts | 原基線無此檔 | 不適用 | 3/3 | 100% |
| src/index.ts | 原設定排除 | 不適用 | 維持原設定排除；另跑真實 stdio | 不適用 |
| 整體 | 79/151 | **52.31%（FAIL，exit 1）** | 146/165 | **88.48%（PASS，exit 0）** |

HTTP 因 factory／共用錯誤處理增加 11 個可覆蓋行，schema 新檔有 3 個頂層初始化可覆蓋行（V8 的實際計數），總分母 151 → 165；沒有改 include／exclude、55% 門檻或挪走來源規避。HTTP 尚未覆蓋的 10 行是 runHttp 監聽／啟動記錄，既有介面與日誌保留。knowledge 原碼／原測試與 79/88 均不變。

原始資料：`results/baseline-v2-coverage.log`、`baseline-v2-file-coverage-summary.json`；`results/task1-coverage.log`（中間失敗）；`results/task2-coverage.log`、`task2-file-coverage-summary.json`（最終候選），及各副本完整 coverage HTML／JSON。基線第二個發現已補 [E-353](https://linear.app/elf-express/issue/E-353)；本單靠新增測試實際通過，沒有改門檻或排除清單，也沒有修原 pnpm 11 安裝缺陷。

### PR #27 審查補正：最終候選

Copilot 在 PR #27 指出兩項 Medium，先前程式自審漏掉；這些意見在修正前保留為待修，沒有把 check run 成功當成「沒有意見」。修正提交 `ec5f014b125d82bea187f34f86abbf29244658cd`，範圍仍只有本 skill，未升工具鏈或增加 it，原有 9＋新增 22＝31 維持。

1. **Parser 日誌**：body-parser 的 parse error 帶 `err.body`，訊息也可能含輸入。H11 在原 it 內加未驗證請求的敏感 sentinel，使用 `node:util.format` 觀察真實 stderr 格式。修正前 `review-red-parser.json` exit 1，sentinel 實際出現在日誌；修正後只記 `entity.parse.failed`／`entity.too.large` 固定標籤，內部意外仍保留診斷。公開 400／413／500 格式、限流與 headersSent→next(err) 不變。
2. **當前 stdio 程式**：保留原 Plan 的 `dist/index.js`／真 SDK subprocess；原兩個 protocol it 在沒有 dist 的副本皆 Connection closed（`review-red-no-dist.json` exit 1）。新增檔案層級 beforeAll，以本專案已安裝的 TypeScript 5.9.3 編譯當前來源，再啟動 dist；編譯限時 10 秒，hook 限時 15 秒。沒有改 package scripts 或新增套件。初次試跑曾因測試 helper 的 root 路徑多取一層而 hook 失敗，已修正並保留 `review-fresh-dist.json`；後續 `review-fresh-dist-v2.json` 兩個通過，最終另開乾淨副本重測。
3. **缺少與過期 dist 都實測**：最終副本 `E:/tmp/e322-verification/review-candidate-v2` 由同一 guard materializer 重新產生；install／frozen-install exit 0。`Test-Path dist` 是 False，直接 `pnpm test --reporter=json --outputFile=../results/review-v2-fresh-all31.json`（不先 build）→ 31 passed／0 failed／pending／todo，exit 0。再將副本 dist/index.js 改成 `throw new Error("E322_STALE_DIST_SENTINEL")`，跑原兩個 protocol it → 2 passed／exit 0，重建後 dist SHA256 回到破壞前相同值，證明沒有讀到舊產物；測試程式碼與來源未為此改動。
4. **最終完整驗證**：`pnpm run build`、原有9、另計新增22、直接全跑31、`pnpm run test:coverage`、真實 stdio smoke 全部 exit 0；原有測試與 threshold／exclude 不變，沒有弱化任何斷言。完整輸出為 `results/review-v2-{build,original9,new22,fresh-all31,stale-protocol2,coverage,stdio}` 的 JSON／log。最新 lock SHA256 仍為 `B0A8311ED8EEC47A70E32C3BB8567DB8B95EB69ED43C2AED6BDB3C0B1EAA9D89`，Node／pnpm／套件解析值與上表相同。

最終逐檔 coverage 仍從該副本 coverage-final.json 的 `.toSummary().lines` 讀取（原始 `results/review-v2-file-coverage-summary.json`）：

| 檔案 | 原基線 covered/total、lines% | PR 審查補正後 covered/total、lines% |
|---|---|---|
| src/http.ts | 0/63，0% | 66/76，86.84% |
| src/knowledge.ts | 79/88，89.77% | 79/88，89.77% |
| src/schemas.ts | 原基線無此檔 | 3/3，100% |
| src/index.ts | 原設定排除 | 維持原排除；真實 stdio 另外驗證 |
| 整體 | 79/151，52.31%（FAIL，exit 1） | **148/167，88.62%（PASS，exit 0）** |

相較首次候選，HTTP 日誌分支增加 2 個可覆蓋行且都執行到，總分母 165 → 167；門檻仍 55%，排除清單完全沒改。首次候選 88.48%／146/165 保留為歷史，最新驗收採本表 88.62%／148/167。原安裝與原 coverage 基線仍交 E-353；沒有以副本 esbuild 核准處置宣稱原範本安裝缺陷已修復。

## E-322：合併後 HTTP 回歸修復（基底 dev 27872f1d）

PR #27 合進 dev 的 `27872f1d384ca8077dd121fe12bd63ee0ae10292` 仍有兩項回歸：Express 5 listen callback 收到 error 卻印出成功、以 exit 0 結束；新的錯誤 middleware 將既有 charset 415／scope 解碼 400 改為 500。Eddie 在本 session 明確回報正式審計核准兩項補正，再指示從最新 dev 開 `fix/e-322-http-regressions`。本段為最新修正驗收，前段失敗與歷次候選結果保留為歷史。程式寫集只有 `templates/src/http.ts`、`http.test.ts`；SKILL.md、工具鏈、依賴、原 9 測試、schema 限制、coverage 門檻與排除清單均未修改。

### 重現與修復

- 在原 H8／H9／H11 的 it 中加斷言；`http-fix-red-v1` 用舊 http.ts 跑 HTTP12，`results/http-fix-red12.json` 為 9 passed／3 failed：壞 scope 預期 400 卻 500、真實 port 衝突預期 exit 1 卻 0、charset 預期 415 卻 500。不是安裝或編譯失敗當 RED。
- `runHttp` 等待 Express listen callback；只有 bind 成功才印既有啟動日誌並 resolve，error reject 交既有 index.ts 的 boot.catch 記錯並 exit 1。H9 用既有 tsx 依賴跑當前 src/index.ts 子程序，避免讀到舊 dist。占用預設 IPv6/dual-stack port（exclusive），與 runHttp 一致；IPv4-only 在 Windows 無法有效重現衝突，不採用。
- body-parser 的 http-errors 需同時為 Error、4xx 整數 status、相同 statusCode、expose:true；415 回 `-32000 / Unsupported media type`，其他已確認的客戶端錯誤回 `-32600 / Invalid request`。Router 的 URIError/status400 固定回 400/-32600。不能只看任意 err.status；H9 額外驗內部 Error 只有 status415 仍回 500/-32603。
- 原 parse 400/-32700、8mb 上限 413/-32000、headersSent→next、內部 500 斷言保留。H8 驗 POST/GET/DELETE 的壞 scope 與安全日誌；H11 保留原 malformed JSON sentinel，另測 charset415、encoding415、壞 gzip400 及不洩漏原始 encoding。六路由、認證、限流、session、health 與所有原斷言保留。

### 可重現命令與結果

所有依賴安裝／build／測試均在 repo 外副本進行。相同 guard materializer `E:/tmp/e322-materialize.mjs` SHA256 `5E76CDA95E64B5C6D3BC03CD9148294B90C82BC7011035902CBCAA4E23993B15`；來源 YAML 必須不存在，副本以 wx 建立 esbuild 核准設定。基線 `http-fix-baseline-v1` 與候選 `http-fix-candidate-v1` 都採同一處置，沒有互動 approve-builds。原範本 pnpm 11 缺陷與原 coverage 52.31% 仍由 E-353 追蹤，本次未修。

在 `E:/tmp/e322-verification/http-fix-candidate-v1` 執行：

```powershell
pnpm --store-dir E:/tmp/e322-verification/pnpm-store-v2 install --no-frozen-lockfile
pnpm --store-dir E:/tmp/e322-verification/pnpm-store-v2 install --frozen-lockfile
pnpm run build
pnpm exec vitest run src/knowledge.test.ts --reporter=json --outputFile=../results/http-fix-original9.json
pnpm exec vitest run src/schema.test.ts src/protocol.test.ts src/http.test.ts --reporter=json --outputFile=../results/http-fix-new22-v2.json
pnpm test --reporter=json --outputFile=../results/http-fix-all31.json
pnpm run test:coverage
node E:/tmp/e322-http-fix-probe.mjs
node E:/tmp/e322-http-fix-stdio.mjs
```

install／frozen-install／build 均 exit 0；原有 **9 passed**、新增 **22 passed**、全跑 **31 passed**，failed／pending／todo 都 0。HTTP12 單跑也全部通過。分組第一次誤寫 `schemas.test.ts`，只選到 protocol2＋HTTP12＝14，保留 `http-fix-new22.json`，不當作 22 的證據；改正既有檔名 `schema.test.ts` 後另存 `http-fix-new22-v2.json`，為 22 passed／exit 0。沒有新增／刪除 it 或放寬斷言。

原有 knowledge.test.ts SHA256 仍 `FC67B4DC8E5E9C064D7DC1B6096500FC5BDC454AF41BDC93300D68220BA89A86`；候選 lock SHA256 仍 `B0A8311ED8EEC47A70E32C3BB8567DB8B95EB69ED43C2AED6BDB3C0B1EAA9D89`。Node 24.18.0／pnpm 11.28.3、TS 5.9.3／Vitest與coverage 4.1.9 未升；實際解析 SDK1.32.1／express5.3.0／zod4.6.7，完整 `results/http-fix-packages.json`。

編譯後子程序（不是只有 mock）`results/http-fix-compiled-probe.json`：占同一個 port 時原 Express4 基線與修正候選都 exit1、reportedListening:false；修正候選 stderr 含 failed to start/EADDRINUSE。可用 port 時可啟動並服務：charset 回 415，完整 body 為 `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Unsupported media type"},"id":null}`；壞 scope 回 400，完整 body 為 `{"jsonrpc":"2.0","error":{"code":-32600,"message":"Invalid request"},"id":null}`。真實 SDK stdio initialize→notifications/initialized→tools/list→tools/call 成功，三個工具名稱維持 fixture_list/search/read，讀取 alpha 成功，protocolErrors=[]，啟動日誌只在 stderr（`results/http-fix-stdio.log`）。

### 三個基線／候選的逐檔 line coverage

本輪重新跑 dev 基線與候選，各自 `test:coverage` exit0。從 coverage-final.json 經 istanbul-lib-coverage toSummary().lines 讀取（`results/http-fix-file-coverage.json`）：

| 檔案 | 原範本 fa33197 | 本輪 dev 基線 27872f1d | 修正候選 |
|---|---|---|---|
| src/http.ts | 0/63，0% | 66/76，86.84% | 69/84，82.14% |
| src/knowledge.ts | 79/88，89.77% | 79/88，89.77% | 79/88，89.77% |
| src/schemas.ts | 無 | 3/3，100% | 3/3，100% |
| src/index.ts | 原設定排除 | 原設定排除 | 同原設定；另由真實子程序驗證 |
| 全部 | 79/151，52.31% FAIL/exit1 | 148/167，88.62% PASS/exit0 | **151/175，86.28% PASS/exit0** |

修正後 bind Promise／錯誤分類增加分母；runHttp 的成功與衝突都經子程序驗證，子程序的執行行不併入父程序 Vitest coverage。未改任何門檻或排除清單，仍實際超過 55%。E-322 維持驗證中；新 PR 目標 dev，發版與 skillshare sync 由 Eddie 依規則39執行，與 E-338 一起發；AI 不推 dev／release／main，也不刪分支。

本輪 repo 驗證：以隔離 XDG_CONFIG_HOME=E:/tmp/e322-http-fix-xdg、source 指向修正 worktree、targets:{}，執行 bash scripts/validate.sh 與 skillshare sync --dry-run 均 exit0（results/http-fix-repo-validate.log、http-fix-dryrun.log）。metadata 未變，未執行實際 sync。git diff --check exit0；fetch 後 origin/dev 仍27872f1d，merge-base --is-ancestor origin/dev HEAD exit0。

新一輪唯讀程式自審 http_fix_review：Critical0／Important0／Minor0；直接核對已安裝 Express／router／body-parser 行為與既有驗證輸出。這只算程式自審，不冒稱正式 Plan 審計。reviewer 列出的兩個實際界線：healthInfo() 在啟動 log 內拋錯屬既有獨立行為，本輪未改；實際執行證據限 Windows，其他平台僅檢視來源。Eddie 正式審計核准來源仍是本 session 使用者回報。

## E-353 安裝核准驗證結果（2026-10-20）

**已解決**：範本新增 `templates/pnpm-workspace.yaml`，只有 `allowBuilds.esbuild: true`；`templates/Dockerfile` 的 build／runtime 兩階段都在 install 前複製該檔。SKILL metadata.version 升為 1.4.1。寫集只有本 skill 四檔；依賴宣告、所有來源程式、原有 9＋新增 22 測試、55% 門檻與 exclude 都未改。原 coverage 52.31% 已由 E-322 解決，最新 86.28%；本單只修安裝，前述失敗與暫時處置歷史保留。

開工方案先貼 [E-353 留言](https://linear.app/elf-express/issue/E-353#comment-993586da)，Eddie 於本 session 回報「通過」後才改檔。來源基準 `4663734e32f2ad6ced297a3e95e597cbf3fc013a`，repo 外 worktree `E:/source/skillshare-source-e353-esbuild`；量測副本與所有原始報表在 repo 外 `E:/tmp/e353-verification/`。本次為 Windows 實測；Docker 兩階段僅核對 COPY 次序，未宣稱跑過容器建置。

### 複製方法與設定隔離

`materialize.mjs` 只遞迴複製並替換佔位，再建 `data/alpha.md` fixture；不改依賴宣告、不建立／覆寫核准檔。基線在修檔前複製，YAML 不存在；候選在修檔後另建新目錄，YAML 由來源原樣帶入。沒有沿用 E-322 會注入核准／固定工具鏈解析的 materializer。程式 SHA256 `d01031700c05561b77a258bf535cd2baa19774f8b80b248190c7a989d38b1463`，完整原文另貼本單。

設定：`XDG_CONFIG_HOME=E:/tmp/e353-verification/config`，其中 `pnpm/config.yaml` 為空 mapping `{}`；`NPM_CONFIG_USERCONFIG=E:/tmp/e353-verification/empty.npmrc` 為空檔。初次 install 移除 CI 環境變數，使用各自全新的 `store-baseline`／`store-candidate`，未共用已建置 store。後續命令以 `PNPM_CONFIG_STORE_DIR=E:/tmp/e353-verification/store-candidate` 指向候選 store；沒有改全域設定、關閉 strictDepBuilds、略過 scripts 或執行互動 approve-builds。

候選 `pnpm config list --json` 過濾建置設定後，只有 `allowBuilds: {esbuild:true}`；`strictDepBuilds`、`ignoreScripts`、`dangerouslyAllowAllBuilds`、`onlyBuiltDependencies`、`ignoredBuiltDependencies` 皆未覆寫（保留預設）。安裝原始輸出含 `esbuild postinstall$ node install.js` 與 `postinstall: Done`。只核准 esbuild 的理由：本次錯誤只點名此套件，且 `pnpm why esbuild` 確認它來自 tsx／Vite 工具鏈；沒有其他套件獲授權。參考 [pnpm allowBuilds／strictDepBuilds](https://pnpm.io/settings/build#allowbuilds)、[esbuild 安裝機制](https://esbuild.github.io/getting-started/#installing-esbuild)。

### 命令與結果

先執行 `node E:/tmp/e353-verification/materialize.mjs <source-templates> <new-output>` 產生副本；兩次輸出分別為 `baseline`、`candidate`。以下均在上述隔離設定下執行：

```powershell
# RED：修檔前全新基線
pnpm --dir E:/tmp/e353-verification/baseline --store-dir E:/tmp/e353-verification/store-baseline install
# GREEN：修檔後另一份全新副本
pnpm --dir E:/tmp/e353-verification/candidate --store-dir E:/tmp/e353-verification/store-candidate install
pnpm --dir E:/tmp/e353-verification/candidate --store-dir E:/tmp/e353-verification/store-candidate install --frozen-lockfile
$env:PNPM_CONFIG_STORE_DIR = 'E:/tmp/e353-verification/store-candidate'
pnpm --dir E:/tmp/e353-verification/candidate run build
pnpm --dir E:/tmp/e353-verification/candidate exec vitest run src/knowledge.test.ts --reporter=json --outputFile=../results/original9.json
pnpm --dir E:/tmp/e353-verification/candidate exec vitest run src/schema.test.ts src/protocol.test.ts src/http.test.ts --reporter=json --outputFile=../results/new22.json
pnpm --dir E:/tmp/e353-verification/candidate test --reporter=json --outputFile=../results/all31.json
pnpm --dir E:/tmp/e353-verification/candidate run test:coverage
pnpm --dir E:/tmp/e353-verification/candidate why esbuild
pnpm --dir E:/tmp/e353-verification/candidate list --depth=0 --json
```

| 驗證 | exit | 實際結果／原始檔（`results/`） |
|---|---|---|
| 基線 install | 1 | `ERR_PNPM_IGNORED_BUILDS: esbuild@0.28.2`；`baseline-install.log` |
| 候選 install | 0 | esbuild postinstall 實際執行；`install.log` |
| frozen install | 0 | `frozen-install.log` |
| build | 0 | `tsc` 通過；`build.log` |
| 原有 9 | 0 | 9 passed；`original9.json` |
| 新增 22 | 0 | 22 passed；`new22.json` |
| 完整 31 | 0 | 31 passed；`all31.json` |
| coverage | 0 | 151/175＝86.28% ≥55%；`coverage.log` |
| why／解析版本 | 0 | `why-esbuild.log`、`packages.log` |

每組測試 failed／pending／todo 都為 0；完整 31 包含原有真實 stdio／HTTP 回歸。首次驗證 runner 錯把 install 的 `--store-dir` 參數也傳給 `pnpm run build`，被 CLI 拒絕；保留 `build-runner-error.log`／`outcomes-first-run.json`，改用上述 store 環境變數後 build exit0。沒有為此改產品或測試。

### 版本、雜湊與 coverage

實際 Node `v24.18.0`、pnpm `11.28.3`；TypeScript `5.9.3`、Vitest／coverage-v8 `4.1.12`、SDK `1.32.1`、express `5.3.0`、zod `4.6.7`、rate-limit `8.7.1`、tsx `4.23.15`、Vite `8.3.4`、esbuild `0.28.2`、@types/express `5.0.6`、@types/node `24.19.2`。Vitest 的解析 patch 與 E-322 舊量測不同，是既有 `^4.1.9` 的此次解析，沒有升級依賴宣告；本輪 RED／GREEN 的 package.json 與 lock 完全一致。

- 基線／候選 lock SHA256 同為 `1ca372c11394e8faa0f581a569ad224144b74ef2c3f91c0a0b54effc0972808b`。
- 來源／候選 YAML SHA256 同為 `ac02d96368617c760f093cfe61fdec64b6244007ab3553e0d6621f706f54a353`。
- materialize 後兩份副本的 package.json、vitest.config.ts、四個測試檔與四個來源檔逐檔 SHA256 全相同，完整結果 `results/summary.json`；設定核對 `effective-build-settings.json`；各命令 exit code 為 `outcomes.json`。

逐檔以當次安裝的 `istanbul-lib-coverage` 讀取候選 `coverage/coverage-final.json` 的 `toSummary().lines`，與終端報表一致：

| 檔案 | covered/total lines | lines % |
|---|---|---|
| src/http.ts | 69/84 | 82.14% |
| src/knowledge.ts | 79/88 | 89.77% |
| src/schemas.ts | 3/3 | 100% |
| 全部 | 151/175 | **86.28%** |

`src/index.ts` 沿用原排除設定，另由既有真實 stdio 測試覆蓋協定行為；本單沒有改分母、門檻、排除清單或測試斷言來讓它通過。

全庫驗證：`XDG_CONFIG_HOME=E:/tmp/e353-verification/config` 的 skillshare config 僅設 `sources.skills: E:/source/skillshare-source-e353-esbuild`、`mode: merge`、`targets: {}`；`bash scripts/validate.sh` 與 `skillshare sync --dry-run` 均 exit0（`results/repo-validate.log`、`sync-dry-run.log`、`repo-checks.json`），預覽 60 skills／0 targets，未執行實際派發。`git diff --check` exit0，`.metadata.json` 未變。發版由 Eddie 等 E-354、E-361 都合進 dev 後以 `scripts/release-ff.*` 一起執行，本單未發版。

全新唯讀最終審查 `E-353-最終審查`：Critical 0／Important 0／Minor 0；逐項核對四檔 diff、materializer、lock／YAML 雜湊、31 測試 JSON 與 coverage 原始輸出，無阻擋。此為程式與證據審查；正式開工審計的核准來源仍為上述 Eddie 回報。

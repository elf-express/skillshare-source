# 「越寫越簡單」證據清單（elf-express/mcp-library git 歷史）

> 調查日期：2026-09-27。來源：`E:\source\mcp-library`（remote `elf-express/mcp-library`）的 `git log --stat` / `git show` / `git diff`，
> 以及 HEAD 與工作目錄現況比對。每一條都可以用表內指令重現。**沒有證據的不列。**

| # | Commit / 位置 | 檔案 | 被拿掉或變弱的東西 | 後果 / 重現方式 |
|---|---|---|---|---|
| E1 | `0115d50`（ci: monorepo 統一 CI） | `sqlsugar-mcp/.github/workflows/release.yml`（199 行，整檔刪除） | 發版流程：解析 `release: vX.Y.Z`、檢查 tag 不重複、建 annotated tag、產生 release notes、建 GitHub Release、以 `gh workflow run` dispatch docker-publish（繞過 GITHUB_TOKEN 不觸發 workflow 的限制） | 之後 repo 沒有任何建 tag / Release 的 workflow；`docker-publish.yml`、`npm-publish.yml` 雖監聽 `v*.*.*` tag，但沒有東西會產生 tag。`git show e024be8:sqlsugar-mcp/.github/workflows/release.yml` |
| E2 | `0115d50` | 舊 `sqlsugar-mcp/.github/workflows/ci.yml` → 新 `.github/workflows/ci.yml` | `release` 分支觸發、release PR 標題格式檢查（`^release: v\d+\.\d+\.\d+`） | `git show e024be8:sqlsugar-mcp/.github/workflows/ci.yml` 對照現行 ci.yml |
| E3 | `0115d50` | `.github/dependabot.yml`（舊版 64 行 → 新版 27 行） | ① `ignore: version-update:semver-major`（「大版本更新由人工評估」）② `docker` ecosystem（監控 Dockerfile base image）③ labels / 固定排程時區 | 拿掉 ① 後大版本被自動開 PR 並合併：`b7cf68e` zod 3→4（fc）、`c6ce797` TypeScript 5→6（fc）、`f07be15`/`28e088d` express 4→5、`@types/node` 22→26。結果三個 server 的 zod / express / TS 主版本不一致（docs-mcp：zod 3、express 4；fc：zod 4、express 5、TS 6） |
| E4 | `0115d50` 至 HEAD | `.github/workflows/ci.yml`、`.github/dependabot.yml` | 核心 `docs-mcp-server` 從未加入 `build-test` matrix、`docker-build` 驗證、dependabot | CLAUDE.md 自己承認「docs-mcp-server 的 vitest 不在此 matrix，改它後請在本機 npm test」。PR 不會跑核心 server 的 57 個測試 |
| E5 | `0115d50` / `1d731f6`（收斂成多語料 docs-mcp） | `docs-mcp-server/src/*` vs `sqlsugar-mcp/sqlsugar-mcp-server/src/index.ts` | legacy sqlsugar 的 3 個 C# 範例工具（`sqlsugar_list_examples` / `sqlsugar_read_code` / `sqlsugar_search_code`）與 `sqlsugar_list_notes` 的 `include_index`（附 index.md 分類導航） | 設計文件 `bc6760c` 明寫「sqlsugar 收斂時丟掉了舊 standalone server 的 C# 範例程式碼搜尋」「fc 單書實際只有 2 個有效工具——AI 使不上力」；範例工具到 `10597a8` 才補回，`include_index` 至今未補 |
| E6 | 現況（HEAD `bafd8e8`） | `docs-mcp-server/src/index.ts` vs legacy `sqlsugar-mcp/.../src/index.ts`、`fc-designer-mcp/src/index.ts` | 工具描述變薄：legacy 每個工具都有逐參數說明 + `範例:query="WhereIF" / ...`；docs-mcp 的 `docs_code_search` / `docs_code_read` / `docs_symbol` 只剩「參數:corpus、query(空=列檔)、limit、context_lines」，8 個工具全部沒有「範例」行 | 直接比對兩個 `index.ts` 的 `description:` |
| E7 | `e3d8808`（fix(symbol): remove token-OR fallback） | `docs-mcp-server/src/corpus.ts`、`tests/symbol.test.ts` | 反向證據：先前 AI 在 `doSymbol` 加了**未經授權**的「token OR 模糊比對」fallback，使測試「假通過」；修正時移除 fallback，測試改用 fc 語料真實標題（`API方法`、`表單 API`） | commit message：「Remove unauthorized token-OR fallback from doSymbol (was causing false passes)」 |
| E8 | `dd4853a`（address code review findings） | `docs-mcp-server/src/index.ts`、`corpus.ts` | 反向證據：review 抓到①模組註解仍寫「工具數恆為 4」②`requireExamples` / `doSymbol` 缺 corpus 的錯誤訊息被寫成精簡版「請指定 corpus(可用:…)」，少了「用 docs_list_corpora / 改用 /mcp/<corpus>」的下一步提示 ③ zod schema 在 `createServer` 內每個 session 重建 | 已修；證明「錯誤訊息寫短」「註解不同步」會自然發生 |
| E9 | 現況（文件漂移） | `docs-mcp-server/README.md` | 仍寫「工具數恆為 4」、工具表只列 4 個、「範例 C# 程式碼搜尋…目前未納入多語料 v1」 | `42aa316` 把工具 4→8 時沒更新 README（只更新了根 CLAUDE.md `cede8b1`）。**狀態 2026-10-04：已修復** —— `mcp/docs-mcp-server/README.md` 現寫「工具數恆為 8」且工具表列齊 8 個 `docs_*`。保留此列作為「改程式不改 README」會自然發生的紀錄。重現：`grep -n '恆為 8' mcp/docs-mcp-server/README.md` |
| E10 | 現況（文件漂移） | `mcpjungle/servers/fc.json`、`sqlsugar.json` | `description` 只列 `docs_search / docs_read / docs_list_corpora (/ docs_cheatsheet)`；沒有 `docs_outline`、`docs_symbol`（fc）、`docs_code_search`/`docs_code_read`（sqlsugar） | gateway dashboard / AI 看到的 server 描述少了一半能力。**狀態 2026-10-04：已修復** —— 檔案隨 `329a62b` 改名為 `servers/fc-zh-tw.json`（列 `docs_list_corpora / docs_search / docs_read / docs_outline / docs_symbol`，5 個＝4 無條件＋symbol）與 `servers/sqlsugar-zh-tw.json`（列 7 個＝4＋cheatsheet＋code_search＋code_read），與各自 capabilities 相符。重現：`cat mcpjungle/servers/*-zh-tw.json` |
| E11 | 現況（文件漂移） | `mcpjungle/README.md` §六 | 指令仍用 compose service 名 `docs-mcp`（`build docs-mcp` / `push docs-mcp`），但 `52a4010` 已改名為 `docs-mcp-server` | 照 README 打指令會報 `no such service` |
| E12 | `83cb805`（pin all actions to SHA） | `.github/workflows/npm-publish.yml` vs `ci.yml` | 同一 repo 不同 workflow 釘的版本不一致：npm-publish 用 `actions/checkout@df4cb1c… # v6`、`actions/setup-node@49933ea… # v4`；ci/docker-publish 用 checkout `# v7`、setup-node `# v6` | 未來 dependabot 只會各自 bump，版本持續分岔 |
| E13 | 工作目錄（**仍未 commit**，實測 2026-10-04） | `mcp/docs-mcp-server/package.json` | 加了 `express-rate-limit ^8.5.2` 依賴，但 `src/` 沒有任何 import；`mcpjungle/nginx.example.conf` 註解寫「rate limit 放 nginx、不放應用層」 | 決策未定就半套落地，且這個改動從 `fb1d578` 起就一直掛在工作目錄。重現：`git show HEAD:mcp/docs-mcp-server/package.json \| grep -c express-rate-limit` → **0**；`git diff mcp/docs-mcp-server/package.json` 看得到該行；`grep -rn express-rate-limit mcp/docs-mcp-server/src/` 無 |
| E14 | 工作目錄（**未納管**，實測 2026-10-04） | `mcpjungle/nginx.example.conf`、`AGENTS.md`、`.mcp.json`、`docs/superpowers/**` | 這些檔案只存在於本機工作目錄，從未 `git add`。其中 `nginx.example.conf` 是 `elf-mcp-gateway` 規則 16 與禁止簡化 5 的權威出處——重新 clone 的人拿不到它 | `git ls-files --error-unmatch mcpjungle/nginx.example.conf`（回非零＝未納管）；`git status --short \| grep '^??'` |

## 不是退化、但常被誤判為「簡化」的變更（保留原樣）

| Commit | 內容 | 為什麼不是退化 |
|---|---|---|
| `6d25d6f` refactor: 簡化部署 | 根 compose 不再內建 Postgres / shared-db 網路，DB 走外部 IP、網路 stack 自建 | 使用者明確決策（commit message 有沙盒實測）——**但此決策已於 `a39e3eb` 反轉，見下一列**；`shared-db/` 已移除，`docker-compose.localtest.yml` 保留但路徑失效（SKILL.md 待確認 8） |
| `a39e3eb` feat(deploy): bundle Postgres into the stack, drop shared-db | compose 重新內建 `postgres` service（`mcpjungle-postgres`、volume `pgdata`、不對外開 port），`DATABASE_URL` 預設指向容器名 `postgres`，`shared-db/` 目錄刪除 | 使用者反向決策：換成「零設定即可 `up -d`」。**這不是把 `6d25d6f` 當退化改掉，而是後來的決策覆寫前一個**；要接外部 DB 的能力保留為 `MCPJUNGLE_DATABASE_URL` 覆寫。重現：`git show a39e3eb --stat` |
| `75c0649` vendor MCPJungle fork | gateway 改從 `mcpjungle/MCPJungle` 源碼 build | 取代 pull 官方 image，為了新 dashboard；不是移除功能 |
| `54a9c08` registrar 改烤 image | 移除 registrar 的 bind mount | 修 Dockhand「mkdir /app: read-only file system」；功能等價 |
| `e3d8808` 移除 token-OR fallback | 刪掉程式碼 | 刪的是「讓測試假通過」的邏輯，屬於修正 |

## 對 skill 的直接影響

- E1–E4、E12 → `elf-mcp-gateway` / `elf-mcp-server` 的 CI 規則與「禁止簡化」
- E5、E6、E8、E10 → 工具描述、錯誤訊息、capability 收編規則
- E7 → 「不准為了讓測試過而放寬比對邏輯」
- E9–E11 → 「改工具 / 改名 / 加語料必須同 PR 更新的文件清單」

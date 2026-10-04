# skillshare-source — Elf Express 團隊規範

Elf Express **團隊共用**的 AI 開發規範（skills）與 AI 助手（agents），用
[**skillshare**](https://github.com/runkids/skillshare) 同步到每個人電腦上的 AI 工具。

> **這裡只放團隊規範，不放個人設定。**
> 改規範 = 改這個 repo 開 PR；合併後大家 `skillshare pull` 就拿到同一份。
> 目的：不管誰用哪個 AI 工具，寫出來的程式都照同一套規則，不會再「各寫各的、越寫越簡單」。

---

## 新同事：第一次安裝

```bash
# 1. 安裝 skillshare CLI
# Windows（PowerShell）
irm https://raw.githubusercontent.com/runkids/skillshare/main/install.ps1 | iex
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/runkids/skillshare/main/install.sh | sh

# 2. 把本 repo 設為來源（會 clone 到本機）
skillshare init -g --remote https://github.com/elf-express/skillshare-source.git

# 3. 加入你有在用的 AI 工具（例：codex、qwen、grok、trae）
skillshare init --discover --select "codex,qwen"

# 4. 同步 skills 到所有 AI 工具
skillshare sync

# 5. 安裝團隊 agents 到 Claude Code（在 clone 下來的 repo 目錄執行）
bash scripts/sync-agents.sh
```

> agents **不用** `skillshare sync agents`：Claude Code 不讀連結形式的 agent 檔（Windows 實測），
> 而 skillshare 的 agent 複製模式會把 plugin 裝的 agent 當孤兒刪掉。所以用 `scripts/sync-agents.sh`，
> 它只複製 `agents/` 裡的檔案、不刪任何東西。

確認：`skillshare status` 每個目標都顯示 `merged`；新開 Claude Code 輸入 `/agents` 應看到 `elf-*` 開頭的 agent。

---

## 目錄結構

```text
skillshare-source/
├── stack/
│   └── elf-stack/                 ★ 版本唯一真實來源（Node 24.18、pnpm 11、.NET 10、PG 18、SqlSugar 5.x…）
├── frontend/
│   ├── elf-vue/                   ★ Vue 3 + TS 目錄、SFC、Pinia、測試
│   ├── elf-ui-pattern/            ★ 元件、三態、無障礙、design token、ant-design-vue 選用
│   ├── elf-i18n/                  ★ vue-i18n、zh-TW / en、中文輸入法（IME）
│   ├── design/
│   │   ├── elf-ui-design/         ★ UI 設計流程：原型 → 交接包 → token → 實作 → 驗收
│   │   ├── ui-ux-pro-max/           第三方：配色、字型、風格探索
│   │   ├── frontend-design/         第三方
│   │   └── web-design-guidelines/   第三方
│   ├── vue/  react/  typescript-advanced-types/  i18n-localization/   第三方
├── api/
│   ├── elf-api-design/            ★ REST、狀態碼、ProblemDetails、分頁、/api/health
│   └── elf-api-contract/          ★ 前後端契約：api-contract.md ↔ types.ts ↔ C# DTO
├── backend/
│   ├── elf-dotnet/                ★ ASP.NET Core 10 專案結構、分層、DI、錯誤處理
│   ├── elf-sqlsugar/              ★ SqlSugar 5.x + PostgreSQL、多租戶、軟刪除、交易
│   ├── elf-postgresql/            ★ PG 18 命名、型別、UTC、遷移、備份
│   ├── elf-domain-modeling/       ★ 實體、聚合、審計欄位、結果 enum
│   ├── sqlsugar-docs/               第三方：SqlSugar API 查詢
│   └── supabase/                    第三方
├── desktop/
│   ├── elf-tauri/                 ★ Tauri 2 慣例、權限、自動更新、簽章金鑰
│   └── tauri-v2/                    第三方
├── cicd/
│   ├── elf-cicd-frontend/         ★ pnpm、lint、typecheck、Vitest 55%、Playwright
│   ├── elf-cicd-backend/          ★ dotnet test、coverlet 55%、Testcontainers
│   ├── elf-cicd-review/           ★ 每個 PR 的 Claude AI code review
│   ├── elf-cicd-versioning/       ★ 自動版號、[release] 才打 tag 發版
│   ├── elf-cicd-desktop/          ★ Tauri 三平台發佈、簽章、latest.json
│   └── elf-cicd-docker/           ★ Dockerfile、nginx、compose、GHCR
├── testing/
│   ├── elf-unit/                  ★ 測試放哪、命名、AAA、覆蓋率 line 55%
│   ├── elf-integration/           ★ WebApplicationFactory + Testcontainers PG 18
│   ├── elf-e2e/                   ★ Playwright、POM、mock 模式
│   └── elf-allure-report/         ★ Allure 3 報告
├── mcp/
│   ├── elf-mcp-knowledge/         ★ 新增知識庫到 MCPJungle（主流程、命名 <書名>-<語言>）
│   ├── elf-mcp-book/              ★ 書籍素材（knowledge.books/）與「挑一份上架成語料」
│   ├── elf-mcp-server/            ★ 寫 MCP server
│   └── elf-mcp-gateway/           ★ MCPJungle 註冊與部署
├── tools/                           第三方工具：agent-browser、find-skills、project-planner、audit-website
├── agents/                        ★ 團隊 AI 助手（見下方與 agents/README.md）
├── skillshare/                      skillshare 內建 skill（由 `skillshare upgrade --skill` 更新）
├── _superpowers/                    追蹤 repo：obra/superpowers（開發流程 skill）
├── scripts/validate.sh              提交前檢查
└── docs/
```

★ = 團隊規範（名稱都以 `elf-` 開頭）；其餘為第三方或工具。

### 同步到 AI 工具後的名稱

巢狀路徑會攤平成 `<分類>__<skill>`，例如 `frontend/elf-vue/` → `frontend__elf-vue`。
在 Claude 的 skill 清單、agent 的 `skills:` 欄位裡都用這個名稱。

### 同步到哪些工具

| 工具 | skills | agents |
|---|---|---|
| Claude Code | `~/.claude/skills` | `~/.claude/agents`（`scripts/sync-agents.sh` 複製） |
| Codex | `~/.codex/skills` | — |
| Qwen Code | `~/.qwen/skills` | — |
| Grok | `~/.grok/skills` | — |
| Trae | `~/.trae/skills` | — |
| 通用（Orca 等） | `~/.agents/skills` | — |

---

## 團隊 agents（AI 助手）

| Agent | 用途 | 預先載入的規範 |
|---|---|---|
| `elf-frontend-dev` | 寫 Vue 前端 | elf-stack、elf-vue、elf-ui-pattern、elf-api-contract、elf-unit |
| `elf-backend-dev` | 寫 .NET 後端 | elf-stack、elf-dotnet、elf-sqlsugar、elf-postgresql、elf-api-design、elf-unit |
| `elf-ui-designer` | UI 設計、交接包、設計驗收 | elf-ui-design、elf-ui-pattern |
| `elf-devops` | CI/CD、Docker、發版 | elf-stack、elf-cicd-frontend / backend / review / versioning |
| `elf-mcp-knowledge` | 新增知識庫到 MCPJungle | elf-mcp-knowledge、elf-mcp-book、elf-mcp-gateway |
| `elf-reviewer` | 唯讀審查：抓違規與「被簡化」 | 依變更內容自行載入 |
| `168-*`（4 個） | 168小隊：OPNsense 文件翻譯審查 | — |

用法：在 Claude Code 說「用 elf-backend-dev 新增一個訂單查詢 API」。
詳細說明、每個 agent 能用的工具、如何新增 agent：見 [agents/README.md](agents/README.md)。

---

## 規範怎麼寫（新增或修改 skill）

1. 放在對應分類下：`<分類>/elf-<名稱>/SKILL.md`，資料夾名 = frontmatter `name:`。
2. frontmatter：
   ```yaml
   ---
   name: elf-<名稱>
   description: |
     一句說明 + 明確觸發條件：當任務涉及…時觸發。
   metadata:
     version: 1.0.0
     owner: Elf Express
   ---
   ```
3. 內文（繁體中文，程式碼英文）固定章節：
   1. 何時使用　2. 固定規則（編號 MUST / MUST NOT，每條附「為什麼」）　3. 標準範本（可直接複製）
   4. 禁止簡化（建議）　5. 檢查清單　6. 常見錯誤　7. 待確認（查不到的一律列這裡，**不准猜**）
4. SKILL.md 控制在約 400 行內；長範本放 `references/` 或 `templates/` 並連結。
5. 版本數字只寫在 `elf-stack`，其他 skill 引用它。
6. 提交前：`bash scripts/validate.sh`（命名、格式、同步預覽、安全稽核）。
7. 開 PR，**不要直接推 master**；PR 會跑 Claude AI code review。

---

## 忽略規則

| 檔案 | 用途 | 進 git？ |
|---|---|---|
| `.skillignore` | 團隊共用：哪些資料夾不是 skill（`docs/`、`scripts/`、`agents/`…） | 是 |
| `.skillignore.local` | 本機覆寫（例：`!/skillshare`、`.kilo/`，或排除吃常駐預算的大型第三方包） | 否 |

> VS Code 的 Kilo Code 擴充會在 repo 裡建 `.kilo/worktrees/`，已被忽略；不用 Kilo 可直接解除安裝。

---

## 常用指令

| 指令 | 做什麼 |
|---|---|
| `skillshare status` | 看來源、各目標、追蹤 repo 的狀態 |
| `skillshare sync` | 同步 skills 到所有 AI 工具 |
| `bash scripts/sync-agents.sh` | 把 `agents/` 複製到 Claude Code（改完 agent 後執行；`--dry-run` 預覽） |
| `skillshare pull` | 從 GitHub 拉最新規範並同步 skills（agents 另跑 `sync-agents.sh`） |
| `skillshare update _superpowers` | 更新 superpowers |
| `skillshare upgrade` | 升級 skillshare CLI 與內建 skill |
| `skillshare audit` | 安全稽核（prompt injection、外洩） |
| `skillshare ui` | 開網頁儀表板 `http://127.0.0.1:19420` |
| `skillshare doctor` | 診斷設定問題 |

---

## License

MIT

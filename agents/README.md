# agents/ — Elf Express 團隊 AI 助手

這裡的每個 `.md` 是一個 Claude Code 子代理（subagent）定義。用 `bash scripts/sync-agents.sh` 複製到 `~/.claude/agents/`。

> 為什麼不用 `skillshare sync agents`：Claude Code 不讀連結形式的 agent 檔（2026-09-27 Windows 實測，新工作階段完全看不到），
> 而 skillshare 的 agent 複製模式會把 plugin 裝的 agent（例如 VoltAgent 的 155 個）當孤兒刪掉。
> `sync-agents.sh` 只寫入本資料夾有的檔案，**不刪任何東西**。

> skill = 規範（寫什麼、怎麼寫）；agent = 照規範做事的助手（誰來做、能用什麼工具）。
> agent 用 `skills:` 欄位**預先載入**團隊規範，一開始就帶著規則工作。

---

## 清單

| Agent | 什麼時候用 | 工具 | 預先載入 | 需要時再載入 |
|---|---|---|---|---|
| `elf-frontend-dev` | apps/ 頁面、元件、store、API client、前端測試 | Read, Grep, Glob, Edit, Write, Bash, Skill | `stack__elf-stack` `frontend__elf-vue` `frontend__elf-ui-pattern` `api__elf-api-contract` `testing__elf-unit` | elf-i18n、elf-ui-design、elf-e2e、elf-cicd-frontend、elf-tauri |
| `elf-backend-dev` | server/ endpoint、service、實體、交易、後端測試 | Read, Grep, Glob, Edit, Write, Bash, Skill | `stack__elf-stack` `backend__elf-dotnet` `backend__elf-sqlsugar` `backend__elf-postgresql` `api__elf-api-design` `testing__elf-unit` | elf-domain-modeling、elf-api-contract、elf-integration、elf-cicd-backend、elf-cicd-docker、sqlsugar-docs |
| `elf-ui-designer` | 設計整理、依原型 / 交接包規劃畫面、token、設計驗收 | Read, Grep, Glob, Write, Skill, WebFetch | `frontend__design__elf-ui-design` `frontend__elf-ui-pattern` | elf-i18n、ui-ux-pro-max、web-design-guidelines |
| `elf-devops` | workflows、版號、Docker、GHCR、Tauri 發佈、CI 除錯 | Read, Grep, Glob, Edit, Write, Bash, Skill | `stack__elf-stack` `cicd__elf-cicd-frontend` `cicd__elf-cicd-backend` `cicd__elf-cicd-review` `cicd__elf-cicd-versioning` | elf-cicd-docker、elf-cicd-desktop、elf-tauri、elf-mcp-gateway、elf-allure-report |
| `elf-mcp-knowledge` | 新增 / 改名知識庫語料、註冊 MCPJungle | Read, Grep, Glob, Edit, Write, Bash, Skill | `mcp__elf-mcp-knowledge` `mcp__elf-mcp-book` `mcp__elf-mcp-gateway` | elf-mcp-server |
| `elf-reviewer` | 合併前審查規範與「被簡化」（**唯讀**） | Read, Grep, Glob, Skill | （無，依變更自行載入） | 全部 elf-* |
| `168-terminologist` | 168小隊：建立術語表 | Read, Grep, Glob, Write | — | — |
| `168-reviewer` | 168小隊：審稿修正譯文 | Read, Grep, Glob, Edit, Write | — | — |
| `168-devils-advocate` | 168小隊：抽查改壞的地方（唯讀） | Read, Grep, Glob | — | — |
| `168-format-checker` | 168小隊：檢查 Markdown 格式（唯讀） | Read, Grep, Glob | — | — |

所有 `elf-*` agent 的 `model` 是 `inherit`（跟主對話同一個模型）。

---

## 怎麼用

在 Claude Code 直接指名：

```text
用 elf-backend-dev 在 server/ 新增「訂單查詢」API，分頁、只查自己公司的資料
用 elf-reviewer 審查這個分支相對 main 的變更
用 elf-mcp-knowledge 把 mcp-library 的 knowledge.books/ 裡某本書加進知識庫
```

也可以在 `/agents` 看清單。

### 注意

- **子代理**（Claude 派出去做事的）會套用 `skills:` 預先載入。
- **Agent team 隊友**（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`）**不會**套用 `skills:`，改讀本機已安裝的 skills——因為全部 skill 都已同步，效果相同，但隊友需要自己呼叫 Skill 工具載入。
- agents 目前只同步到 Claude Code；Codex、Qwen 等工具沒有這種 agent 格式。

---

## 新增一個 agent

1. 在本資料夾新增 `elf-<角色>.md`：

   ```markdown
   ---
   name: elf-<角色>
   description: 一句說明「什麼時候用」——Claude 靠這段決定要不要派它。
   tools: Read, Grep, Glob, Skill          # 只給需要的工具；唯讀角色不要給 Edit/Write/Bash
   model: inherit
   color: blue                             # red/blue/green/yellow/purple/orange/pink/cyan
   skills:                                 # 攤平後的 skill 名稱：<分類>__<skill>
     - stack__elf-stack
   ---

   你是…（角色）

   ## 開工前
   ## 固定做法
   ## 禁止簡化
   ## 完成前（要跑的驗證、回報格式）
   ```

2. `skills:` 用**攤平後的名稱**（`frontend__elf-vue`）。實測 frontmatter 的 `name:`（`elf-vue`）也能載入，但團隊統一用攤平名稱，保證不重名。
3. 預先載入只放「每次都用得到」的 3～6 個；其他寫進「需要時再載入」表格，讓 agent 用 Skill 工具載入，避免一開始就吃掉大量 context。
4. 本機測試：`bash scripts/sync-agents.sh`，然後新開一個 Claude 工作階段確認 `/agents` 有出現。
5. 開 PR。

---

## 驗證紀錄

2026-09-27 以新的 Claude 程序派出子代理實測：`skills:` 寫 `stack__elf-stack` 或 `elf-stack` 都能在子代理啟動時載入完整 SKILL.md 內容（不需呼叫工具即可引用 elf-stack 版本表）。
以 `claude --agent <name>` 讓 agent 當**主工作階段**時，`skills:` 不會預先載入。

連結形式的 agent 檔：新工作階段列不出來；改成實體檔案複製後，10 個 agent 全部可用（同日實測）。

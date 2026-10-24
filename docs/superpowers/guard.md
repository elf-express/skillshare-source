# Superpowers 階段 Guard

Guard 是 Claude Code 的 PreToolUse hook：分支 `e-<N>`（Orca）或 `<類型>/e-<N>-<英文短名>`（團隊規範，elf-team-rule 規則 10）的計畫未核准前，Write／Edit／MultiEdit／NotebookEdit 只允許寫入 `docs/superpowers/` 底下的檔案。Bash／PowerShell 只檢查指令裡有沒有核准目錄字串，不檢查實作檔寫入：用 `echo >`、`sed`、heredoc 寫實作檔不在 Guard 涵蓋範圍內。另有 SessionStart hook，新 session 開始時把狀態檔摘要注入。

- `scripts/elf-guard.cjs`：PreToolUse，matcher 為 `Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell`。
- `scripts/elf-sessionstart.cjs`：SessionStart，輸出 `[superpowers 狀態] ticket=… phase=… plan=… 核准=已核准|未核准`。
- `scripts/elf-guard.hooks.yaml`：skillshare hooks entry，名稱 `elf-guard`，由 `scripts/make-hooks-yaml.cjs` 產生。

## 判斷順序

由上而下，第一個符合的規則生效。Guard 自身發生例外時放行。

| # | 條件 | 結果 |
|---|---|---|
| 1 | Bash 或 PowerShell 指令含 `superpowers/approvals`（正斜線或反斜線，不分大小寫） | 擋 |
| 2 | 工具沒有 `file_path` / `notebook_path` | 放行 |
| 3 | 目標路徑含 `superpowers/approvals` | 擋 |
| 4 | 目標路徑往上找不到 `.git` | 放行 |
| 5 | 該 repo 目前 branch 不是 `e-<數字>`，也不是 `<類型>/e-<數字>-<英文短名>`（類型 `feat`、`fix`、`docs`、`chore`、`test`、`hotfix`；短名小寫英數字，以 `-` 連接；含 detached HEAD） | 放行 |
| 6 | 找不到對應狀態檔，或狀態檔 `ticket` 與 `plan` 都解析不出值 | 放行 |
| 7 | 核准檔存在且四個欄位皆非空 | 放行 |
| 8 | 目標在 repo 內的 `docs/superpowers/` 底下 | 放行 |
| 9 | 其餘 | 擋 |

規則 2 表示 Bash／PowerShell 在通過規則 1 後一律放行，實作檔寫入限制只對檔案寫入工具生效。規則 1 與 3 不看核准狀態，核准前後都擋。無害的 grep、commit 訊息只要含該字串也會被擋。核准檔因此只能由人在 Claude Code 之外建立。

Task 子 agent 寫檔同樣會觸發 PreToolUse，適用上表所有規則。已實測：子 agent 用 Write 寫 `scripts/` 被 Guard 擋下。

擋下時的訊息：

- 規則 1：`Superpowers 階段 Guard：禁止用 Bash 或 PowerShell 存取 superpowers/approvals 核准目錄。核准檔須由審計員人工建立。`
- 規則 3：`Superpowers 階段 Guard：禁止用檔案工具寫入 superpowers/approvals 核准目錄。核准檔須由審計員人工建立。`
- 規則 9：`Superpowers 階段 Guard：E-<N> 計畫未核准，目前只能修改 docs/superpowers/ 底下的檔案。請先完成 spec／plan，由審計員在 Linear 核准後建立核准檔，再繼續實作。`

## 狀態檔

路徑：`docs/superpowers/state/E-<Spec>.yaml`，檔名用 Spec 編號。同一個 Spec 底下第二張以後的 Plan（elf-team-rule 規則 17）各建一份 `docs/superpowers/state/E-<Plan>.yaml`，檔名用該 Plan 的編號，`ticket` 仍填 Spec 編號；第一張 Plan 用的 `E-<Spec>.yaml` 不改。

```yaml
ticket: E-367
phase: plan
plan: E-377
```

- `ticket`：Spec 編號。
- `phase`：目前階段，SessionStart 摘要原樣顯示。
- `plan`：Plan 編號。寫完 Plan 後要填上；核准檔以此欄位的值命名。

Guard 用 `branchTicket()` 從分支名稱取出單號 N（`e-<N>` 或 `<類型>/e-<N>-<英文短名>`），再找狀態檔：

1. 先讀 `docs/superpowers/state/E-<N>.yaml`。
2. 沒有這個檔名時，掃 `state/*.yaml`（依檔名排序），取第一份 `plan` 等於 `E-<N>` 的檔案。

第二張以後的 Plan，分支 `e-<Plan>` 在第 1 步就讀到自己的 `E-<Plan>.yaml`，不經第 2 步。只放 `E-<Spec>.yaml` 時，它的 `plan:` 是第一張 Plan，第二張 Plan 的分支在兩步都對不到狀態檔，依規則 6 放行，核准前不受保護（E-386 底下的 E-396 就是這種情況）。把 `E-<Spec>.yaml` 的 `plan:` 改成第二張 Plan 也不行：第一張 Plan 的分支會因此對不到狀態檔。

`plan:` 沒填時，Plan 分支（`e-<Plan 編號>` 或 `<類型>/e-<Plan 編號>-…`）找不到狀態檔，Guard 不會擋。Spec 分支上 `plan:` 空白時視為未核准，會擋。

依 E-369 的設計，團隊流程（elf-linear-superpowers 步驟 2，由 E-372 實作）在建好 worktree 後就建狀態檔並 commit，`plan:` 一開始就填 Plan 編號。單一開發工作單與 hotfix 不建狀態檔，分支單號對不到任何狀態檔，依規則 6 放行。

狀態檔合進 `dev` 後留著當紀錄，不刪。之後的分支只要沿用同一個 Spec 或 Plan 編號，Guard 一樣會管。核准檔只存在建立它的那台電腦，換一台電腦時，這類分支在 `docs/superpowers/` 以外的寫入會被擋。

## 核准流程

1. 審計員在 Linear 的 Plan 單留言「計畫已核准」。
2. 審計員在**自己的終端機**（不是透過 Claude Code）執行下列指令；審計員是 AI 對話時，由 Eddie 執行。

```bash
node -e "const f=require('os').homedir()+'/.claude/superpowers/approvals/E-<N>.yaml';require('fs').mkdirSync(require('path').dirname(f),{recursive:true});require('fs').writeFileSync(f,'ticket: E-<N>\napproved_at: <YYYY-MM-DD>\nauditor: <名字>\nlinear_comment_id: <留言id>\n')"
```

| 欄位 | 意義 |
|---|---|
| `ticket` | Plan 編號，與檔名 `E-<N>` 相同 |
| `approved_at` | 核准日期，`YYYY-MM-DD` |
| `auditor` | 審計員名字 |
| `linear_comment_id` | 第 1 步那則「計畫已核准」留言的 id |

核准檔為 `~/.claude/superpowers/approvals/E-<N>.yaml`，四個欄位都要有值，缺任一欄視為未核准。

撤銷核准：在終端機刪除該檔。

## permissions.deny 片段

在 `~/.claude/settings.json` 的 `permissions.deny` 加入：

```json
"Edit(~/.claude/superpowers/approvals/**)"
```

`Edit(...)` 規則會涵蓋所有內建的寫檔工具（Write、MultiEdit、NotebookEdit）。`~/` 代表家目錄。已實測：agent 用 Write 寫核准檔時被擋下，錯誤訊息為「File is in a directory that is denied by your permission settings」。

依團隊規則 34，這項設定由 Eddie 執行或同意；修改前與修改後的內容都要貼到 Linear 單上。

## 安裝與回滾

所有 `skillshare hooks` 指令都要明確指定 `-g`（全域）或 `-p`（專案）；本文件一律用 `-g`。

先預覽 elf-guard 會寫入什麼：

```bash
skillshare hooks add elf-guard --file scripts/elf-guard.hooks.yaml --dry-run --json -g
```

若預覽顯示 `blocked: true`，已實測：skillshare 匯入過的 hook 被其他工具（例如 Orca）在外部改過時，會出現 conflict。可用的處理指令：

```bash
skillshare hooks import --from claude --json -g       # 不帶名稱：列出 ~/.claude 既有 hook 候選
skillshare hooks sync elf-guard --replace -g          # 明確取代 elf-guard 衝突的原生輸出
skillshare hooks remove <name> --keep-files -g        # 停止由 skillshare 管理該筆 entry，native 設定的內容不會被改動
```

這三個指令執行前，依團隊規則 34 由 Eddie 決定。

安裝：

```bash
skillshare hooks add elf-guard --file scripts/elf-guard.hooks.yaml --sync -g
```

安裝後 hook command 形式為 `node "$HOME/.claude/hooks/skillshare/elf-guard/elf-guard.cjs"`（SessionStart 同理）；skillshare 不會替 claude binding 展開 `{files}`。腳本固定裝在 `~/.claude/hooks/skillshare/elf-guard/`，若帳號另外設定了 config_dir，路徑會不同（待確認）。

回滾（擇一）：

```bash
skillshare hooks disable elf-guard --sync -g   # 停用 entry
skillshare hooks restore <backup-id> -g        # 還原到指定備份
```

改過 `scripts/elf-guard.cjs` 或 `scripts/elf-sessionstart.cjs` 後，依序執行：

```bash
node scripts/make-hooks-yaml.cjs                                              # 重新產生 YAML
node scripts/make-hooks-yaml.cjs --check                                      # 兩者不同步時 exit 1
skillshare hooks edit elf-guard --file scripts/elf-guard.hooks.yaml --sync -g # 更新已安裝的 Guard
```

## 測試

```bash
node scripts/elf-guard.test.cjs
```

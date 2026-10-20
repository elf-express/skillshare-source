# Superpowers 階段 Guard

Guard 是 Claude Code 的 PreToolUse hook：分支 `e-<N>` 的計畫未核准前，只允許修改 `docs/superpowers/` 底下的檔案。另有 SessionStart hook，新 session 開始時把狀態檔摘要注入。

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
| 5 | 該 repo 目前 branch 不是 `e-<數字>`（含 detached HEAD） | 放行 |
| 6 | 找不到對應狀態檔，或狀態檔 `ticket` 與 `plan` 都解析不出值 | 放行 |
| 7 | 核准檔存在且四個欄位皆非空 | 放行 |
| 8 | 目標在 repo 內的 `docs/superpowers/` 底下 | 放行 |
| 9 | 其餘 | 擋 |

規則 1 與 3 不看核准狀態，核准前後都擋。無害的 grep、commit 訊息只要含該字串也會被擋。核准檔因此只能由人在 Claude Code 之外建立。

擋下時的訊息：

- 規則 1：`Superpowers 階段 Guard：禁止用 Bash 或 PowerShell 存取 superpowers/approvals 核准目錄。核准檔須由審計員人工建立。`
- 規則 3：`Superpowers 階段 Guard：禁止用檔案工具寫入 superpowers/approvals 核准目錄。核准檔須由審計員人工建立。`
- 規則 9：`Superpowers 階段 Guard：E-<N> 計畫未核准，目前只能修改 docs/superpowers/ 底下的檔案。請先完成 spec／plan，由審計員在 Linear 核准後建立核准檔，再繼續實作。`

## 狀態檔

路徑：`docs/superpowers/state/E-<Spec>.yaml`，檔名用 Spec 編號。

```yaml
ticket: E-367
phase: plan
plan: E-377
```

- `ticket`：Spec 編號。
- `phase`：目前階段，SessionStart 摘要原樣顯示。
- `plan`：Plan 編號。寫完 Plan 後要填上；核准檔以此欄位的值命名。

Guard 從 branch `e-<N>` 找狀態檔：

1. 先讀 `docs/superpowers/state/E-<N>.yaml`。
2. 沒有這個檔名時，掃 `state/*.yaml`（依檔名排序），取第一份 `plan` 等於 `E-<N>` 的檔案。

`plan:` 沒填時，Plan 分支（`e-<Plan 編號>`）找不到狀態檔，Guard 不會擋。Spec 分支上 `plan:` 空白時視為未核准，會擋。

## 核准流程

1. 審計員在 Linear 的 Plan 單留言「計畫已核准」。
2. 審計員在**自己的終端機**（不是透過 Claude Code）執行下列指令。

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
"Write(//~/.claude/superpowers/approvals/**)",
"Edit(//~/.claude/superpowers/approvals/**)"
```

確切語法待本機實測後定稿（E-367 待確認項）。

依團隊規則 34，這項設定由 Eddie 執行或同意；修改前與修改後的內容都要貼到 Linear 單上。

## 安裝與回滾

先預覽：

```bash
skillshare hooks sync --dry-run --json
```

若輸出 `blocked: true`，代表 `~/.claude/settings.json` 已有其他 hook 被 skillshare 以外的方式改過。先決定 import 或 replace，再安裝。

安裝：

```bash
skillshare hooks add elf-guard --file scripts/elf-guard.hooks.yaml --sync
```

回滾：

```bash
skillshare hooks disable elf-guard --sync
skillshare hooks restore <backup-id>
```

兩者擇一：`disable` 停用 entry，`restore` 還原到指定備份。

改過 `scripts/elf-guard.cjs` 或 `scripts/elf-sessionstart.cjs` 後，先重新產生 YAML，再同步：

```bash
node scripts/make-hooks-yaml.cjs          # 寫出 scripts/elf-guard.hooks.yaml
node scripts/make-hooks-yaml.cjs --check  # 兩者不同步時 exit 1
```

## 測試

```bash
node scripts/elf-guard.test.cjs
```

## 待確認

- Task 子 agent 寫檔是否會觸發 PreToolUse：未實測。

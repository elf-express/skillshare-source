# Superpowers 階段 Guard

Guard 是 Claude Code 的 PreToolUse hook：分支 `e-<N>`（Orca）或 `<類型>/e-<N>-<英文短名>`（團隊規範，elf-team-rule 規則 10）的計畫未核准前，Write／Edit／MultiEdit／NotebookEdit 只允許寫入 `docs/superpowers/` 底下的檔案。Bash／PowerShell 只檢查指令裡有沒有核准目錄字串，不檢查實作檔寫入：用 `echo >`、`sed`、heredoc 寫實作檔不在 Guard 涵蓋範圍內。另有 SessionStart hook，新 session 開始時把狀態檔摘要注入。

- `scripts/elf-guard.cjs`：PreToolUse，matcher 為 `Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell`。
- `scripts/elf-sessionstart.cjs`：SessionStart，輸出 `[superpowers 狀態] ticket=… phase=… plan=… 核准=已核准|未核准`。
- `scripts/elf-approval.cjs`：核准憑證建立器（create／verify／revoke），由 AI 呼叫，見「核准憑證」。
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
| 7 | 核准憑證存在且通過格式檢查（九欄皆非空、`ticket`＝`plan`＝檔名、`approver_id` 為固定 id、`plan_hash` 為 sha256） | 放行 |
| 8 | 目標在 repo 內的 `docs/superpowers/` 底下 | 放行 |
| 9 | 其餘 | 擋 |

規則 2 表示 Bash／PowerShell 在通過規則 1 後一律放行，實作檔寫入限制只對檔案寫入工具生效。規則 1 與 3 不看核准狀態，核准前後都擋。無害的 grep、commit 訊息只要含該字串也會被擋。核准憑證因此只能經核准憑證建立器寫入：建立器的指令不含核准目錄字串，由 node 自己算出路徑。

Task 子 agent 寫檔同樣會觸發 PreToolUse，適用上表所有規則。已實測：子 agent 用 Write 寫 `scripts/` 被 Guard 擋下。

擋下時的訊息：

- 規則 1：`Superpowers 階段 Guard：禁止用 Bash 或 PowerShell 存取 superpowers/approvals 核准目錄。核准憑證只能用核准憑證建立器（elf-approval.cjs）建立。`
- 規則 3：`Superpowers 階段 Guard：禁止用檔案工具寫入 superpowers/approvals 核准目錄。核准憑證只能用核准憑證建立器（elf-approval.cjs）建立。`
- 規則 9：`Superpowers 階段 Guard：E-<N> 計畫未核准，目前只能修改 docs/superpowers/ 底下的檔案。請先完成 spec／plan，由審計員在 Linear 留言核准後，用核准憑證建立器建立核准憑證，再繼續實作。`

## 狀態檔

路徑：`docs/superpowers/state/E-<Spec>.yaml`，檔名用 Spec 編號。同一個 Spec 底下第二張以後的 Plan（elf-team-rule 規則 17）各建一份 `docs/superpowers/state/E-<Plan>.yaml`，檔名用該 Plan 的編號，`ticket` 仍填 Spec 編號；第一張 Plan 用的 `E-<Spec>.yaml` 不改。

```yaml
ticket: E-367
phase: plan
plan: E-377
```

- `ticket`：Spec 編號。
- `phase`：目前階段，SessionStart 摘要原樣顯示。
- `plan`：Plan 編號。寫完 Plan 後要填上；核准憑證以此欄位的值命名。

Guard 用 `branchTicket()` 從分支名稱取出單號 N（`e-<N>` 或 `<類型>/e-<N>-<英文短名>`），再找狀態檔：

1. 先讀 `docs/superpowers/state/E-<N>.yaml`。
2. 沒有這個檔名時，掃 `state/*.yaml`（依檔名排序），取第一份 `plan` 等於 `E-<N>` 的檔案。

第二張以後的 Plan，分支 `e-<Plan>` 在第 1 步就讀到自己的 `E-<Plan>.yaml`，不經第 2 步。只放 `E-<Spec>.yaml` 時，它的 `plan:` 是第一張 Plan，第二張 Plan 的分支在兩步都對不到狀態檔，依規則 6 放行，核准前不受保護（E-386 底下的 E-396 就是這種情況）。把 `E-<Spec>.yaml` 的 `plan:` 改成第二張 Plan 也不行：第一張 Plan 的分支會因此對不到狀態檔。

`plan:` 沒填時，Plan 分支（`e-<Plan 編號>` 或 `<類型>/e-<Plan 編號>-…`）找不到狀態檔，Guard 不會擋。Spec 分支上 `plan:` 空白時視為未核准，會擋。

依 E-369 的設計，團隊流程（elf-linear-superpowers 步驟 2，由 E-372 實作）在建好 worktree 後就建狀態檔並 commit，`plan:` 一開始就填 Plan 編號。單一開發工作單與 hotfix 不建狀態檔，分支單號對不到任何狀態檔，依規則 6 放行。

狀態檔合進 `dev` 後留著當紀錄，不刪。之後的分支只要沿用同一個 Spec 或 Plan 編號，Guard 一樣會管。核准憑證只存在建立它的那台電腦；換一台電腦時，在那台電腦依同一則 Linear 核准留言再建一份，建好之前這類分支在 `docs/superpowers/` 以外的寫入會被擋。

## 核准憑證

**Linear 留言是核准的唯一正本。** 本機的 `~/.claude/superpowers/approvals/E-<Plan>.yaml` 叫「核准憑證」，只是讓離線的 Guard 讀得到的快取，不是核准本身；狀態檔裡若有 `approved_by_auditor` 之類的欄位，也只是顯示用，Guard 不看。

### 有效的核准留言

- 在對應的 Plan 上。
- 作者是固定的 Linear user ID `f7c5792e-6252-49dd-8210-b15b30c5229d`（不比對顯示名稱）。
- 文字開頭符合「計畫已核准（YYYY-MM-DD，審計員：<模型>）」或「計畫已核准 vN（…）」。
- 留言依 `createdAt` 由舊到新判斷：「計畫已修改 vN」之後要有版號 ≥ N 的「計畫已核准 vN」才算；「核准撤回」之後要有新的核准留言才算。這兩種留言不限作者。

Linear 讀不到、找不到有效留言或欄位不完整時，一律不建立憑證、不開工。

user ID 比對只能排除其他帳號。Linear MCP 以 Eddie 的帳號發言，AI 與審計員 session 的留言作者也都是 Eddie，所以它不是人類身分驗證，也不是防止 AI 自我核准的安全邊界。A 方案的保障是流程提醒與事後稽核，不是不可偽造的授權。

### 憑證欄位

| 欄位 | 意義 |
|---|---|
| `ticket` | Plan 編號，與檔名 `E-<N>` 相同 |
| `plan` | Plan 編號，與 `ticket` 相同 |
| `spec` | Spec 編號 |
| `approver_id` | 核准留言作者的 Linear user ID，必須是固定 id |
| `linear_comment_id` | 那則「計畫已核准」留言的 id |
| `comment_created_at` | 該留言的 `createdAt` 原字串 |
| `approved_at` | 留言文字裡的日期，`YYYY-MM-DD` |
| `auditor` | 留言文字裡的審計員 |
| `plan_hash` | 核准時 Plan 描述正規化後的雜湊，`sha256:` 加 64 個小寫十六進位 |

九欄缺任一欄、`ticket` 或 `plan` 與檔名不同、`approver_id` 不是固定 id、`plan_hash` 格式不對，Guard 都視為未核准。E-377 的舊四欄位核准檔（`ticket`、`approved_at`、`auditor`、`linear_comment_id`）因此一律視為未核准，不做相容。

### 建立器用法

AI 用 Linear MCP 的 `get_issue`／`list_comments` 取 Plan 描述與全部留言，寫成 repo 外的暫存 JSON（例 `%TEMP%/E-<N>-approval.json`）：

```json
{ "plan": "E-<N>", "spec": "E-<Spec>", "description": "<Linear 上的 Plan 描述原文>", "comments": [ { "id": "…", "body": "…", "createdAt": "…", "author": { "id": "…" } } ] }
```

再執行（Git Bash 與 PowerShell 寫法相同）：

```bash
node "$HOME/.claude/hooks/skillshare/elf-guard/elf-approval.cjs" create --plan E-<N> --input <暫存 JSON>
node "$HOME/.claude/hooks/skillshare/elf-guard/elf-approval.cjs" verify --plan E-<N> --input <暫存 JSON>
node "$HOME/.claude/hooks/skillshare/elf-guard/elf-approval.cjs" revoke --plan E-<N> --reason <原因>
```

| 模式 | 做什麼 |
|---|---|
| `create` | 檢查輸入、找出有效核准留言、算 `plan_hash`，在同一目錄寫暫存檔後 rename 成 `E-<N>.yaml`；只寫這一張 Plan 的憑證 |
| `verify` | 只讀不刪。結果不通過時附建議動作：`revoke`（核准留言已撤回或不在 Plan 上）、`recreate`（已有更新版號的核准留言）、`stop`（雜湊不符、沒有憑證或憑證損壞） |
| `revoke` | 刪除這張 Plan 的憑證；本來就沒有時也回 exit 0 |

exit code：0＝成功、1＝驗證不通過、2＝參數錯誤。stdout 印稽核摘要（模式、Plan、Spec、`linear_comment_id`、核准者 id、留言時間、審計員、`plan_hash`、結果），AI 把它留言到 Plan；失敗時另印原因與建議動作。

建立器的指令不含核准目錄字串，Guard 規則 1 不會擋。這不是防惡意 AI 的安全邊界，只是比全面開放核准目錄更不容易誤寫或破壞其他 Plan 的憑證。

### 雜湊與失效

`plan_hash` 照下列四步算：

1. CRLF、CR 一律換成 LF。
2. 只處理行首（允許前導空白）的 Markdown checkbox：`- [x]`、`- [X]` 換成 `- [ ]`。``` 圍住的區塊與一般文字裡的 `[x]` 不換。
3. 去掉結尾所有換行，再補恰好一個 LF。
4. 對 UTF-8 位元組算 SHA-256。

核准後 Plan 描述照這四步正規化，雜湊改變就失效，要重新核准。勾選狀態、換行格式、結尾換行數不算修改；checkbox 的新增、刪除或文字修改都算。

### 驗證時點與撤回

Guard 離線讀不到 Linear，所以由 AI 在四個驗證時點各做兩件事：重讀 Plan 留言，確認憑證引用的核准留言還在、符合上面的條件、之後沒有「核准撤回」；取 Linear 上目前的 Plan 描述跑 `verify` 比對雜湊。

1. 建立憑證前
2. 開工前
3. 每個 Task 開始前
4. 每個 Task 完成、準備 commit 或勾選前

Eddie 在 Plan 留言「核准撤回」，或核准留言被刪除時，Guard 無法即時偵測；AI 會在下一個驗證時點偵測到，用 `revoke` 刪除憑證、停止實作、在 Plan 留言。兩次驗證之間有空窗；要立即停止，由 Eddie 在對話中通知該 session。雜湊不符時停下、不開工，不自行用新描述重建憑證。

### 多台機器與舊格式遷移

多台機器各自建立本機憑證，都引用同一則 Linear 核准留言。

發佈新版 Guard 前，先列出仍在待辦／進行中／驗證中的 Plan 並留言。只有以下條件全部成立，才能依原核准留言用建立器產生新版憑證：Plan 尚未完成或取消、後續仍可能寫實作檔；找得到原核准留言；原核准留言之後沒有未重新核准的實質 Plan 修改（只有勾選變化可忽略）。無法證明時必須重新送審。已完成、已取消的 Plan 不必遷移。

## permissions.deny 片段

在 `~/.claude/settings.json` 的 `permissions.deny` 加入：

```json
"Edit(~/.claude/superpowers/approvals/**)"
```

`Edit(...)` 規則會涵蓋所有內建的寫檔工具（Write、MultiEdit、NotebookEdit）。`~/` 代表家目錄。已實測：agent 用 Write 寫核准檔時被擋下，錯誤訊息為「File is in a directory that is denied by your permission settings」。建立器以 node 寫檔，不經 Claude Code 的檔案工具，不受這條規則影響。

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

安裝後 hook command 形式為 `node "$HOME/.claude/hooks/skillshare/elf-guard/elf-guard.cjs"`（SessionStart 同理）；skillshare 不會替 claude binding 展開 `{files}`。腳本固定裝在 `~/.claude/hooks/skillshare/elf-guard/`，該目錄有 `elf-guard.cjs`、`elf-sessionstart.cjs`、`elf-approval.cjs` 三個檔；若帳號另外設定了 config_dir，路徑會不同（待確認）。

回滾（擇一）：

```bash
skillshare hooks disable elf-guard --sync -g   # 停用 entry
skillshare hooks restore <backup-id> -g        # 還原到指定備份
```

改過 `scripts/elf-guard.cjs`、`scripts/elf-sessionstart.cjs` 或 `scripts/elf-approval.cjs` 後，依序執行：

```bash
node scripts/make-hooks-yaml.cjs                                              # 重新產生 YAML
node scripts/make-hooks-yaml.cjs --check                                      # 兩者不同步時 exit 1
skillshare hooks edit elf-guard --file scripts/elf-guard.hooks.yaml --sync -g # 更新已安裝的 Guard
```

## 測試

```bash
node scripts/elf-guard.test.cjs
```

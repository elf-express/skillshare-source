# 核對 release 分支的 CI/CD

用在「release 為什麼是紅叉」「發版後 CI/CD 沒過」這類問題。原則：**每一句結論都要有 GitHub 上的紀錄當證據**，查不到就寫「查不到」。

以下 `R=<owner>/<repo>`，例如 `R=elf-express/skillshare-source`。

## 0. 發佈前判斷（快轉 `release` 之前，規則 28）

快轉 `release` 前，查**要發佈的那個提交**（`origin/dev` 或 `origin/hotfix/*` 指向的提交）上的 check runs，**每個 check 只看最新一次結果**（`filter=latest`）。曾經失敗後重跑成功的 check，用 `filter=all` 會連舊的失敗一起列出來，所以發佈前判斷不要用 `filter=all`（它只用在第 2 節之後的排查）：

```bash
SHA=$(git rev-parse origin/dev)        # hotfix 時改成 origin/hotfix/e-<編號>-<短名>
gh api "repos/$R/commits/$SHA/check-runs?filter=latest&per_page=100" --jq '.check_runs[]|"\(.status) \(.conclusion) \(.name)"'
ls .github/workflows 2>/dev/null || echo "沒有任何 workflow"   # 沒有 check runs 時用來分辨兩種情況
```

| 查到的結果 | 判斷 | 處理 |
| -- | -- | -- |
| 每個 check run 的 status 都是 `completed`，conclusion 都是 `success`、`neutral` 或 `skipped` | **全部通過** | 列出要發佈的提交與檢查結果，使用者同意後快轉 |
| 任何 conclusion 為 `failure`、`cancelled`、`timed_out`、`action_required`、`stale`，或 status 不是 `completed` | **有失敗或執行中** | 不發佈；失敗依第 3 節讀原文說明原因（規則 23），執行中就等完成再判斷；`stale` 沒有 log 可讀，告訴使用者後依第 6 節重跑再判斷 |
| 一個 check run 都沒有，但 repo 有 `.github/workflows/` | **這個提交沒有觸發 CI** | 不是「沒有 CI」。hotfix 時確認已依規則 25 開 draft PR，等 CI 跑完再判斷。開了 draft PR 仍沒有 check run（例如 `pull_request` 只篩 `main`、`dev`）→ CI 不合規：回報、建議 `chore/` 修正，這次發佈比照下一列需要使用者明確同意例外 |
| 一個 check run 都沒有，repo 也沒有任何 workflow | **專案沒有 CI** | 停下，回報「發佈內容未經自動測試」；使用者**明確同意這次例外**才快轉，並建議開 Linear 工作單依 `elf-cicd-*` 補上 CI |

發現 CI 不合規（以 `elf-cicd-*` 目前的規定為準，例如 push 觸發缺 `dev`、`release`）時，回報並建議用 `chore/` 分支修正；不自行修改 CI 設定，也不因此跳過上面的判斷（規則 29）。

以下第 1–7 節用在發佈之後的核對與排查。

## 1. 先確定 release 指向哪個提交

```bash
git fetch origin --prune
git rev-parse origin/release
gh api repos/$R/branches --jq '.[] | "\(.name) \(.commit.sha[0:8])"'
```

`release` 是從 `dev` 快轉過來的，通常和 `dev`（第 3 種還有 `main`）指向同一個提交。後面所有查詢都針對這個提交，不是針對分支名稱。

## 2. 查這個提交上的 check runs（主要證據）

```bash
gh api "repos/$R/commits/release/check-runs?filter=all&per_page=100" --paginate \
  --jq '.check_runs[] | "\(.id) \(.name) \(.status) \(.conclusion) \(.completed_at)"'
```

- MUST 帶 `filter=all`。預設 `filter=latest` 只回每個檢查最新的一筆，重跑前失敗的那筆會被藏起來（ELF.Modules v0.8.0 的提交：預設 7 筆、`filter=all` 9 筆，多出來的兩筆正是失敗的 `build`，2026-10-11 實測）。
- 同一個檢查名稱有好幾筆時（重跑過），看 `completed_at` 最新的一筆判斷「現在」的狀態，較早的失敗照樣列入回報。
- **不要只用 `gh run list -b release`**。workflow run 記在觸發它的分支名下（通常是 `dev`），CI 沒有設 push `release` 觸發的 repo，快轉後的 `release` 查不到任何 run，會誤判成「沒有失敗」。

要看 run 層級的資訊，用提交 SHA 查：

```bash
SHA=$(git rev-parse origin/release)
gh run list --repo $R --commit $SHA \
  --json databaseId,headBranch,workflowName,event,conclusion,createdAt \
  --jq '.[] | "\(.createdAt) \(.headBranch) \(.workflowName) \(.event) \(.conclusion) \(.databaseId)"'
```

## 3. 查失敗原因

先讀 log：

```bash
gh run view <run id> --repo $R --log-failed
```

log 過期時會回 `log not found`，改讀 check run 的 annotations，常會有原因原文：

```bash
gh api repos/$R/check-runs/<check run id>/annotations \
  --jq '.[] | "\(.annotation_level): \(.title) | \(.message)"'
```

常見的原因原文與意義：

| annotations／log 原文 | 意義 | 處理 |
| -- | -- | -- |
| `The job was not started because your account is locked due to a billing issue.` | 帳號因帳單問題被鎖，job 沒啟動，與程式碼無關 | 回報使用者處理帳單；解除後的下一次 run 會重新檢查 |
| run 結論是 `startup_failure`、沒有任何 job | workflow 還沒開始就被擋，常見於 action 引用不被允許（例如 repo 要求 SHA 釘版卻用了 `@v4` 這種 tag） | 查 `gh api repos/$R/actions/permissions` 的 `sha_pinning_required`、`allowed_actions`，對照 workflow 的 `uses:` |

表上沒有的原因，照原文回報，不要套用相近的解釋。

## 4. 查一直卡住的檢查

```bash
gh api "repos/$R/commits/release/check-suites?per_page=100" --paginate \
  --jq '.check_suites[] | "\(.app.slug) \(.status) \(.conclusion) \(.created_at)"'
gh api repos/$R/commits/release/status --jq '.state, (.statuses[] | "\(.context) \(.state)")'
```

`status` 為 `queued`、`conclusion` 為 `null`，而且建立時間已經很久的 check suite，代表安裝的 GitHub App 建了檢查卻從不回報，合併狀態會一直顯示 pending。是否移除 App 由管理員決定，回報即可。

## 5. 查部署（發版後才觸發的 workflow）

```bash
gh api repos/$R/actions/workflows --jq '.workflows[] | "\(.id) \(.name) \(.path) \(.state)"'
gh run list --repo $R -w <workflow 檔名> -L 10 \
  --json createdAt,headBranch,event,conclusion --jq '.[] | "\(.createdAt) \(.headBranch) \(.event) \(.conclusion)"'
```

- 部署 MUST 由打在 `release` 上的 `v*` tag 觸發（elf-cicd-versioning）：tag 觸發的 run，`event` 是 `push`、`headBranch` 是 tag 名（例如 `v0.8.0`），而且 `verify` job 成功。用 `git merge-base --is-ancestor <tag> origin/release` 確認 tag 在 `release` 上。
- 由 push `main`、push 開發分支觸發部署，才是違反規範（規則 7、8），就算 CI 全綠也要一併回報。
- 同一個 workflow 從建立以來全部失敗，代表從沒成功過，問題在 workflow 本身或 repo 設定，不在這次發版。

## 6. 重跑

```bash
gh run rerun <run id> --repo $R --failed
```

- 回 `This workflow run cannot be retried` 代表 run 太舊，無法重跑。不要為了清紅叉做空提交，回報使用者。
- 重跑屬於對 GitHub 的操作，先告訴使用者要重跑哪幾個 run。

## 7. 回報格式

```
release → <SHA 前 8 碼>（與 dev／main 同一個提交：是／否）
失敗的檢查：<名稱> <時間> <run id>
原因（原文）：<annotations 或 log 原文>
目前狀態：<最新一次同名檢查的結論與時間>
卡住的檢查：<App 名稱清單，或「無」>
建議：<可選的處理方式>
```

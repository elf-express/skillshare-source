# 核對 release 分支的 CI/CD

用在「release 為什麼是紅叉」「發版後 CI/CD 沒過」這類問題。原則：**每一句結論都要有 GitHub 上的紀錄當證據**，查不到就寫「查不到」。

以下 `R=<owner>/<repo>`，例如 `R=elf-express/skillshare-source`。

## 1. 先確定 release 指向哪個提交

```bash
git fetch origin --prune
git rev-parse origin/release
gh api repos/$R/branches --jq '.[] | "\(.name) \(.commit.sha[0:8])"'
```

`release` 是從 `dev` 快轉過來的，通常和 `dev`（第 3 種還有 `main`）指向同一個提交。後面所有查詢都針對這個提交，不是針對分支名稱。

## 2. 查這個提交上的 check runs（主要證據）

```bash
gh api repos/$R/commits/release/check-runs \
  --jq '.check_runs[] | "\(.id) \(.name) \(.status) \(.conclusion) \(.completed_at)"'
```

- 同一個檢查名稱可能有好幾筆（重跑過）。看 `completed_at` 最新的一筆判斷「現在」的狀態，但舊的失敗仍會讓 GitHub 頁面顯示紅叉。
- **不要只用 `gh run list -b release`**。workflow run 記在觸發它的分支名下（通常是 `dev`），快轉後的 `release` 查不到，會誤判成「沒有失敗」。

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
gh api repos/$R/commits/release/check-suites \
  --jq '.check_suites[] | "\(.app.slug) \(.status) \(.conclusion) \(.created_at)"'
gh api repos/$R/commits/release/status --jq '.state, (.statuses[] | "\(.context) \(.state)")'
```

`status` 為 `queued`、`conclusion` 為 `null`，而且建立時間已經很久的 check suite，代表安裝的 GitHub App 建了檢查卻從不回報，合併狀態會一直顯示 pending。是否移除 App 由管理員決定，回報即可。

## 5. 查部署（發版後才觸發的 workflow）

```bash
gh api repos/$R/actions/workflows --jq '.workflows[] | "\(.id) \(.name) \(.path) \(.state)"'
gh run list --repo $R -w <workflow 檔名> -L 10 \
  --json createdAt,headBranch,conclusion --jq '.[] | "\(.createdAt) \(.headBranch) \(.conclusion)"'
```

- 部署 workflow 的觸發分支 MUST 是 `release`（規則 7、8）。觸發分支是 `main`，就算 CI 全綠也違反規範，一併回報。
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

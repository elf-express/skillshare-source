---
name: elf-cicd-review
description: |
  Elf Express PR 自動 AI Code Review 規範（anthropics/claude-code-action@v1）。
  當任務涉及新增或修改 .github/workflows/claude-review.yml、設定 CLAUDE_CODE_OAUTH_TOKEN /
  ANTHROPIC_API_KEY、調整審查 prompt、Dependabot 或 bot PR 審查失敗、AI 審查 job 報
  is_error 卻看不到原因，或設定 branch protection 要求 AI 審查通過時觸發。
metadata:
  version: 1.0.0
  owner: Elf Express
---

# Elf Express PR AI 審查（elf-cicd-review）

> 每一個由人開的 PR 都由 Claude 自動審查並在 PR 上留言。
> **已決定的例外**：bot（`[bot]` actor，例如 Dependabot）開的 PR 一律跳過 AI 審查——Dependabot 讀不到 repository secrets，審查不可能執行（見規則 5）。
> CI 本體見 **elf-cicd-frontend** / **elf-cicd-backend**；版號見 **elf-cicd-versioning**。

## 1. 何時使用

- 新 repo 啟用 AI 審查
- 修改審查 prompt（新增專案地雷、調整重點）
- AI 審查 job 紅燈、只顯示 `is_error: true`
- Dependabot / bot PR 的審查一直失敗
- 切換計費方式（訂閱 OAuth token ↔ API key）

## 2. 固定規則

**檔案與觸發**

1. MUST 放在 `.github/workflows/claude-review.yml`，與 `ci.yml` 分開。為什麼：審查失敗（額度、token 過期）不該讓 CI 結果看不清楚，兩者要各自是一個 check。
2. MUST 觸發 `pull_request: types: [opened, synchronize, reopened, ready_for_review]`。每次 push 到 PR、重新開啟、draft 轉為 ready 都重審。
3. MUST 使用 `anthropics/claude-code-action@v1`。MUST NOT 改用 `@main`、`@beta` 等浮動分支。為什麼：浮動分支的行為會在沒有 PR 的情況下改變，審查突然壞掉時無從比對。
4. MUST 維持 job id 與 `name: review`。為什麼：branch protection 以這個名稱設 required check。

**Bot PR**

5. MUST 保留 job 條件 `if: ${{ !endsWith(github.actor, '[bot]') }}`。這是團隊**已決定**的明確例外：bot PR 不做 AI 審查，是「每個 PR 都 AI 審查」規則唯一的豁免。
   為什麼：Dependabot 的 PR 依設計讀不到 repository secrets，token 永遠是空的；不跳過的話每個依賴升級 PR 都掛一顆不可能變綠的紅燈。被 skip 的 job 對 required check 而言視同通過，因此 bot PR 合併前 MUST 由人工看過 diff。

**權限與憑證**

6. MUST 設 job 層級 `permissions`，且只能是：`contents: read`、`pull-requests: write`、`id-token: write`。MUST NOT 給 `contents: write`。
   為什麼：審查只需要讀程式碼、寫 PR 留言；給寫入權限等於讓 prompt injection 有機會改 repo。
7. MUST 只傳**一種**憑證：預設 `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`（走訂閱）；改走 API 計費時換成 `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`。MUST NOT 兩個都傳。
8. MUST NOT 在 prompt 或 workflow 裡直接寫任何金鑰。

**工具白名單**

9. MUST 用 `claude_args: --allowedTools` 限定為以下四項，一字不改：
   ```
   mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*)
   ```
   MUST NOT 加 `Bash(*)`、`Edit`、`Write`、`Bash(git push:*)`。為什麼：審查者只能看與留言，不能改。

**失敗診斷**

10. MUST 保留最後一個 step：`if: failure()` 時 `cat "$RUNNER_TEMP/claude-execution-output.json"`。
    為什麼：action 失敗時只回報 `is_error: true` 並吞掉原因；完整結果只寫在這個檔案，不印出來的話 auth / 額度問題只能用猜的。

**Prompt 內容**

11. MUST 保留 prompt 的結構：`REPO` / `PR NUMBER` → 各目錄的職責與地雷 → 通用審查面向 → 留言方式。
12. MUST 在 prompt 列出本 repo 的目錄（`apps/`、`server/`、`src-tauri/`、`docker/`、`e2e/`、`.github/`）與「改了會壞在執行期」的約束。
13. MUST 用 `<PROJECT-SPECIFIC PITFALLS>` 那一段寫**本 repo 真的踩過**的坑（3–8 條，取自專案 CLAUDE.md），沒有就刪掉那段。MUST NOT 寫空泛的「注意程式品質」。
14. MUST 要求審查者標出削弱 CI 門檻的變更（調低覆蓋率、`continue-on-error`、`paths:` 過濾、改 required job 名稱、拿掉 `--frozen-lockfile`）。
15. MUST 要求以 `gh pr comment` 留總評、`mcp__github_inline_comment__create_inline_comment`（`confirmed: true`）留逐行意見，且「只留 GitHub 留言，不要把審查內容當訊息回傳」。
16. MUST 在 prompt 要求以繁體中文（台灣）回覆（範本已寫死 `Reply in Traditional Chinese (Taiwan).`），MUST NOT 刪除或改成其他語言。為什麼：與團隊文件一致，PR 留言語言不一致會讓回應與追蹤變困難。

**與 branch protection 的關係**

17. MUST 在 `main` 的 branch protection 把 `review` 設為 required check（連同 CI 的 `web` / `e2e` / `server`）。
18. MUST 理解：`review` 綠燈只代表「審查跑完」，**不代表沒有問題**。PR 作者 MUST 逐條回應 AI 留言（修正或說明不修的理由）後才合併。

## 3. 標準範本

| 檔案 | 範本 | 放到 |
|------|------|------|
| AI 審查 workflow | [`templates/claude-review.yml`](templates/claude-review.yml) | `.github/workflows/claude-review.yml` |

只需要改一處：prompt 裡的 `<PROJECT-SPECIFIC PITFALLS ...>` 那段。其他內容照抄。

### 3.1 一次性設定（repo 管理員）

1. 產生訂閱 token：本機執行 `claude setup-token`，取得 token。
2. GitHub repo → Settings → Secrets and variables → Actions → New repository secret：`CLAUDE_CODE_OAUTH_TOKEN`。
3. 安裝 Claude GitHub App 到該 repo（`claude` CLI 內 `/install-github-app` 會引導）。
4. Settings → Branches（或 Rulesets）→ `main` → Require status checks：勾選 `review`。

### 3.2 地雷段落範例（照這個粒度寫）

```
Known pitfalls in this repo — check every PR against them:
- SqlSugar materialises rows through Activator.CreateInstance, which throws on
  `required` members. Entities must use property defaults instead.
- A new entity must be registered in SqlSugarSetup.Entities or its table is
  never created.
- Never bind the value of an uncontrolled input that an IME composes into.
```

每一條都是「什麼會壞 + 為什麼 + 正確做法」，不是一般建議。

## 4. 檢查清單

- [ ] 檔名 `.github/workflows/claude-review.yml`，觸發 `opened, synchronize, reopened, ready_for_review`
- [ ] `actions/checkout@v5`
- [ ] `anthropics/claude-code-action@v1`
- [ ] 有 `if: ${{ !endsWith(github.actor, '[bot]') }}`（bot PR 跳過為已決定例外，由人工看 diff）
- [ ] `permissions` 只有 `contents: read` / `pull-requests: write` / `id-token: write`
- [ ] 只傳一種憑證，且 secret 已在 repo 設定
- [ ] `--allowedTools` 與規則 9 完全相同
- [ ] 有 `if: failure()` 印 `$RUNNER_TEMP/claude-execution-output.json` 的 step
- [ ] prompt 已列出 repo 目錄與本專案地雷（或已刪除佔位段落）
- [ ] `main` branch protection 已把 `review` 設為 required
- [ ] 開一個測試 PR，確認 PR 上出現 AI 總評留言與至少能留逐行留言

## 5. 常見錯誤

| 症狀 | 原因 | 修正 |
|------|------|------|
| job 紅燈只寫 `is_error: true` | action 吞掉錯誤原因 | 看 `Show the raw result when the review fails` step 的輸出（規則 10） |
| 每個 Dependabot PR 審查都紅 | bot PR 讀不到 secrets，token 為空 | 加 `if: ${{ !endsWith(github.actor, '[bot]') }}`（已決定：bot PR 跳過） |
| draft PR 轉 ready、或重新開啟的 PR 沒有被審查 | `types` 只有 `opened, synchronize` | 補上 `reopened`、`ready_for_review`（規則 2） |
| log 出現某個 secret 不存在的 warning | 同時傳了 `claude_code_oauth_token` 與 `anthropic_api_key` | 只留一個 |
| 審查跑完但 PR 上沒有任何留言 | 缺 `pull-requests: write`，或 `--allowedTools` 少了 `gh pr comment` / inline comment 工具 | 補權限與白名單 |
| 審查內容出現在 job log，PR 上看不到 | prompt 沒寫「Only post GitHub comments」 | 保留規則 15 那兩句 |
| 從 fork 開的 PR 審查失敗 | fork PR 的 `pull_request` 事件讀不到 secrets | 團隊一律在本 repo 開分支發 PR，不從 fork |
| 審查意見空泛（「建議加強錯誤處理」） | prompt 沒有本專案的具體地雷 | 依 3.2 補上真實踩過的坑 |
| 審查綠燈就直接合併，AI 指出的 bug 上線 | 把「job 成功」誤當「審查通過」 | 規則 18：逐條回應後才合併 |

## 6. 待確認

- 團隊統一用訂閱 `CLAUDE_CODE_OAUTH_TOKEN` 還是 API `ANTHROPIC_API_KEY` 計費，待確認（範本預設 OAuth token，與參考專案相同）。
- draft PR 在轉為 ready 之前是否跳過審查（例如 `if` 加 `!github.event.pull_request.draft`），待確認；目前 draft 也會審。
- 是否要指定審查使用的模型（`claude_args` 加 `--model`），待確認；目前使用 action 預設。
- 組織層級是否已安裝 Claude GitHub App、secret 是否改為 organization secret，待確認。
- 「逐條回應 AI 留言」是否要用 branch protection 的 "Require conversation resolution before merging" 強制，待確認。

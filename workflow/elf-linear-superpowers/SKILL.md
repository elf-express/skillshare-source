---
name: elf-linear-superpowers
description: 把 superpowers 生命週期（brainstorming → using-git-worktrees → writing-plans → executing-plans / subagent-driven-development → requesting/receiving-code-review → verification-before-completion → finishing-a-development-branch）接到 Linear ELF EXPRESS 團隊的 [Spec]/[Plan] issue，並涵蓋不改程式的 [維運] 單。當使用者提到 Linear issue 編號（E-xx）、說「照 E-xx 做」、要開新功能、新需求或維運工作，或要執行任何 superpowers 步驟時使用。
metadata:
  version: 1.1.0
  owner: Elf Express
---

# Linear × superpowers 生命週期

> **正本在 Linear。** 本 skill 是 Linear 團隊文件的執行摘要，兩邊衝突時以 Linear 文件為準，並提醒使用者更新本 skill。
>
> | 文件 | 內容 |
> |---|---|
> | 開發流程規範：Spec／Plan × superpowers | 本流程的完整規範 |
> | 流程總覽（給所有 AI）：從開單到收尾 | 步驟總表、狀態對照、八條鐵則、接手判斷 |
> | 隊友規範：角色、命名與回報 | 統籌與 subagent 的角色、命名、回報 |
> | 分支規範：三種 repo 類型 | 分支用途、命名、發佈、hotfix、git-guard |
> | 流程：維運單 | 不改 repo 的維運工作 |
> | Linear 巡檢規則 | 可自動檢查的規則 R1–R12、W1–W5 |
>
> 版本：2026-10-17（與上列文件同步；Linear 正本於發版時依核准稿更新）

Linear 是規格與計畫的唯一來源（single source of truth）。superpowers 各 skill 照常執行，但**產出寫進 Linear issue，不寫 `docs/superpowers/specs/`、`docs/superpowers/plans/` 檔案**（除非使用者明確要求另存）。

每個步驟結束時，都要把結果回寫到對應的 Linear 單（改狀態、勾 checkbox 或留言），不能只停留在對話裡。讀不到 Linear MCP 時先告訴使用者，不要改寫到本地檔案。

## 先分流：走哪條路

| 這件事… | 走 |
|---|---|
| 要 commit 到 repo，且需要設計 | 本 skill 的 Spec／Plan 流程 |
| 要 commit 到 repo，但不需要設計（明確錯誤修正、緊急修正） | 單一開發工作單（仍要兩道保險） |
| 不 commit 到 repo（備份、AG 複寫、網路、主機、憑證、帳號、稽核佐證） | **維運單**（見文末「維運單」） |

同一件事兩者都有時拆兩張：先開維運單把事情做掉，工具化另開 Spec／Plan。

## Linear 設定（ELF EXPRESS 團隊，key：E）

| 項目 | 值 |
|---|---|
| Spec 模板 | `Spec 設計規格`（建立時自動帶出子 issue `[Plan]`） |
| 標題 | `[Spec] 主題`、`[Plan] 主題`，兩張同主題；維運單 `[維運] 主題` |
| 階段 label（單選） | `Spec`、`Plan` |
| 工作類型 label（單選） | `新功能`、`改善`、`錯誤`、`維運`；加在 Spec 或單一工作單，Plan 不加；`稽核` 可另加 |
| 已退役 label | `業務需求`、`自主規劃`，不再使用 |
| 狀態 | 待規劃 → 待辦 → 進行中 → 驗證中 → 已完成；另有 已取消、Duplicate、Triage |
| 父子自動化 | 子 issue 全部完成 → 父 issue 自動關閉；父 issue 關閉**不會**關子 issue |
| Estimate | Spec 與 Plan **必填**；維運單選填 |
| GitHub PR 自動化 | 開 PR → 進行中；PR 審查活動 → 驗證中；PR 合進 `dev` → 驗證中（自動，Eddie 依目標分支設定；設定完成前依 elf-team-rule 規則 10 的過渡期處理）。已導入 dev／release 的 repo，「已完成」在發版完成後於步驟 7 手動設定；還沒導入的 repo 維持 PR merge → 已完成 |

## 生命週期對照

| # | superpowers | 性質 | Linear 單 | 狀態 | 轉換條件／回寫內容 |
|---|---|---|---|---|---|
| 0 | 開單 | — | 新建 Spec＋子 Plan | 待規劃 | 套模板；負責人、專案、Spec estimate；巡檢 R1–R7 自查；回報編號 |
| 1 | brainstorming | 必經 | Spec | 待規劃 → 進行中 | 逐段確認後填入 Spec；定案留言「規格已定案」 |
| 2 | using-git-worktrees | 必經 | Plan | — | 分支用 Plan 編號；基線測試留言；提醒在 Orca 連 Plan 單 |
| 3 | writing-plans | 必經 | Plan | 待規劃 → 待辦 | Spec 已定案才開始；寫完自審、設 Plan estimate 後改待辦 |
| 3a | 排進週期 | 必經 | Spec＋Plan | 維持 | 使用者決定這兩週要做才排；兩張排同一週期；Plan 留言 |
| 4-1 | executing-plans | 二擇一 | Plan | 待辦 → 進行中 | 每步勾 checkbox |
| 4-2 | subagent-driven-development | 二擇一 | Plan | 待辦 → 進行中 | 同上；每個 Task 的審查結果留言 |
| S1 | test-driven-development | 按需 | Plan | — | 即 Task 的 5 個步驟 |
| S2 | systematic-debugging | 按需 | Plan | — | 現象、根因、修法、新測試留言 |
| S3 | dispatching-parallel-agents | 按需 | Plan | — | 並行 Task 與整合結果留言 |
| 5-1 | requesting-code-review | 必經・保險① | Plan | 進行中 → 驗證中 | 所有 Task 勾完即改；結果依嚴重度留言 |
| 5-2 | receiving-code-review | 必經 | Plan | 維持驗證中 | 逐項處理方式留言；有 Critical 回 5-1 |
| 6 | verification-before-completion | 必經・保險② | Plan＋Spec | 維持驗證中 | 證據分兩段留言：程式本身的證據合進 `dev` 前必須完成，與 `release` 有關的證據發版完成前補齊；勾 Spec 驗收條件 |
| 7 | finishing-a-development-branch | 必經 | Plan →（自動）Spec | 開 PR → 進行中；合進 `dev` → 驗證中（自動）；發版完成 → 已完成（手動）；或 已取消 | 巡檢全規則自查；收尾選項與結果留言；已完成的三個條件與自動化設定前的過渡期見 elf-team-rule 規則 10 |

## 各步驟做法

### 0. 找到或建立工作單

- **有編號**（如 `E-31`）：`get_issue` 讀取。是 Spec 就再讀子 issue（label `Plan`）；是 Plan 就先讀父 issue（Spec）。依下表判斷在哪一步，從那裡接續，**不要從頭來**：

  | 看到的狀態 | 現在在 |
  |---|---|
  | Spec 待規劃 | 步驟 1 |
  | Spec 進行中、沒有「規格已定案」留言 | 步驟 1 |
  | Spec 有「規格已定案」、Plan 待規劃 | 步驟 2～3 |
  | Plan 待辦、沒排週期 | 步驟 3a |
  | Plan 進行中、還有未勾步驟 | 步驟 4（從第一個未勾的步驟繼續） |
  | Plan 驗證中、PR 尚未合進 `dev` | 步驟 5 或 6（看留言紀錄） |
  | Plan 驗證中、PR 已合進 `dev` | 步驟 7（等發版） |

  步驟 5-1 已改為驗證中的 Plan，在步驟 7 開 PR 時會被自動拉回進行中，這是正常的，仍在步驟 7（等 PR 合併），不要回步驟 4；PR 有審查活動或合進 `dev` 時會再自動改為驗證中（合進 `dev` 的自動化設定完成前依 elf-team-rule 規則 10 的過渡期處理）。

- **新需求**：`save_issue` 在團隊 `ELF EXPRESS` 套用模板 `Spec 設計規格` 建立 `[Spec] 主題`。確認底下有 `[Plan]` 子 issue（沒有就手動建：parent 為此 Spec、label `Plan`、狀態 待規劃），並把子 issue 標題改成 `[Plan] 主題`。
- 建立後立即設定 Spec 的 **estimate**，依目前對需求規模的初估。
- **兩張單都要設負責人（Eddie）與專案**；找不到適合的專案就問使用者，不自行開專案、不留空。
- Spec 加一個**工作類型** label；Plan 只加 `Plan`。
- **開單時不排週期**（見步驟 3a）。
- 一件事拆成**兩組以上** Spec＋Plan 時，在該專案建立里程碑（名稱用這件事的主題），每組都放進去，有先後順序的用 blocked by 標出；只有一組不建里程碑。大型主題用專案或里程碑分組，**不用父單**。
- 專案狀態：開第一張 Spec 時從「積壓案件」改「規劃中」；第一張 Plan 進入進行中時改「進行中」；專案是否「已完成」問使用者。
- 對兩張單跑巡檢 R1–R7 自查，有錯先修正。
- 回報編號，例如「Spec E-31 / Plan E-32」。

### 1. brainstorming → Spec

1. Spec 改為 **進行中**。
2. 探索專案現況 → 一次問一題 → 提 2–3 個方案與取捨 → 分段呈現設計。
3. **每段經使用者確認後**，用 `save_issue` 更新 Spec 對應章節：目標、背景與限制、方案比較、架構、元件、資料流、錯誤處理、測試、驗收條件、待決問題。保留「給 Claude」引言與章節標題。
4. 自審：無佔位文字、無矛盾、範圍明確、驗收條件可驗證。請使用者審閱全文。
5. 核准後在 Spec 留言「規格已定案」並附日期。Spec **維持進行中，不要關閉**，它會在 Plan 完成時自動關閉。

### 2. using-git-worktrees → Plan

1. 動手前先確認 repo 屬於分支規範的第幾種（看根目錄 `BRANCHING.md` 或 README 開頭），不確定就問。
2. 分支名稱 `<類型>/e-<Plan 編號>-<英文短名>`，例如 `feat/e-32-fx-rate-sync`。類型：`feat`、`fix`、`docs`、`chore`、`test`、`hotfix`。英文短名小寫 kebab-case。GitHub PR 自動化靠分支名稱裡的編號對應到 Plan。**不要**用 Linear 產生的 `gitBranchName`（會帶中文與全形符號，在 Windows、CI、shell 容易出問題），也不要用個人前綴（如舊的 `tw199501/`）。
3. 一般分支從最新的 `origin/dev` 開出；hotfix 是單一工作單，用該單編號，從 `origin/release` 開出。
4. worktree 一律開在 repo 外（同層），不開在主倉庫目錄內。
5. 跑基線測試，在 Plan 留言：分支名稱、worktree 路徑、基線測試結果（通過數／失敗數）。基線不乾淨就停下來問使用者。
6. **Orca 連單**：worktree 一律由 Claude Code 建立，**不要**在 Orca 的 Linear 任務列表按 Use 建立。建立後提醒使用者在 Orca：讓該 worktree 顯示在側邊欄；在 Edit Worktree Details 的 issue 欄位貼上 **Plan** 單網址（只連 Plan，一個工作區只連一張單）。

### 3. writing-plans → Plan

1. 以 Spec 最新內容為輸入（取代 superpowers 預設的設計文件路徑），並探索程式結構。
2. 填進 Plan 描述，保留模板結構：
   - 標頭：目標、Spec（見父 issue）、架構、技術棧、全域限制
   - 檔案結構：新增／修改／測試，精確路徑
   - 每個 Task：檔案、介面（需要／產出）、5 個 checkbox 步驟（寫失敗測試 → 確認失敗 → 實作 → 確認通過 → commit），附完整程式碼與驗證指令
   - **步驟編號全單唯一**：`- [ ] 步驟 <Task>.<步驟>：…`，例如 `- [ ] 步驟 2.3：寫最少的實作讓測試通過`。模板裡的「步驟 1」「步驟 2」要改掉，否則多個 Task 會出現相同文字，勾 checkbox 時無法精準定位。
   - 完成檢查
3. 不寫佔位或抽象描述（例如「加上驗證」），每一步都可直接執行。
4. 全域限制一律包含：**資料庫腳本必須冪等、可重複執行，不存在就建立、存在就更新，不可 DROP 既有資料表或資料**。
5. 依 Task 數量與複雜度設定 Plan 的 **estimate**；與 Spec 初估差距大時同步更新 Spec 的 estimate。
6. 自審後 Plan 改為 **待辦**，請使用者審閱，並詢問執行路線（4-1 或 4-2）。

### 3a. 排進週期

- 只有在 Plan 已寫好、狀態待辦、**使用者決定這兩週要做**時才排。
- 有目前週期且有餘力 → 排目前週期；否則排下一個週期；不確定就問。
- **Spec 與 Plan 一起排進同一個週期**，在 Plan 留言「已排入 Cycle N（YYYY-MM-DD～YYYY-MM-DD）」。
- 週期結束時，沒做完的單問使用者移到下一週期或退回不排週期，不讓單留在已結束的週期裡。

### 4. 執行 → Plan

- 開始第一個 Task 時 Plan 改為 **進行中**。
- 每完成一步，用 `save_issue` 的 `patch`（op `replace`）把該行 `- [ ] 步驟 N.M` 改為 `- [x] 步驟 N.M`，只改這一行，不重送整份描述。Linear 會存成 `- [X]`，兩者都代表已完成。
- commit 訊息附 Plan 編號，例如 `feat(E-32): 新增匯率同步排程`。
- 計畫與實際不符：**停下來**，在 Plan 留言說明差異後問使用者，不自行擴大範圍。
- 4-1：載入計畫並批判審視，有疑慮先留言、問使用者，再逐項執行。
- 4-2：每個 Task 派實作隊友，再派全新的審查隊友；每個 Task 完成後在 Plan 留言：Task、審查結論、修正的 Critical。
- S1：必須親眼看到失敗、親眼看到通過才能勾。
- S2：修好後留言現象、根因、修法、新測試；連續 3 次失敗就停下質疑架構並問使用者；需改規格時回 Spec 修改並留言。
- S3：只用在彼此獨立的 Task；留言並行清單與整合測試結果。

### 5-1. requesting-code-review（保險①：查品質）

所有 Task 完成後 Plan 改為 **驗證中**；派全新審查 agent 審整個分支；依嚴重度（Critical／Important／Minor）留言；有 Critical 就不進第 6 步。

### 5-2. receiving-code-review

讀完再回應、對照程式碼核對、有誤據理反駁；先修 Critical 再逐項修正並測試；逐項留言處理方式（已修／反駁／延後，附理由）；修完回 5-1。

### 6. verification-before-completion（保險②：查正確性）

1. 執行完整驗證指令（`dotnet test`、前端 build、lint），讀取並核對實際輸出。
2. 資料庫腳本在已部署環境重跑一次，確認冪等。
3. 在 Plan 留言證據：指令、exit code、通過／失敗數。沒有證據不宣告完成。
   證據分兩段，完成時間點不同：
   - **合進 `dev` 前必須完成**：測試、build、lint、資料庫腳本冪等這類「程式本身對不對」的證據。為什麼：延到合併後才補，等於讓沒驗證過的程式先進整合分支，保險②失效。
   - **發版完成前補齊**：與 `release` 有關的證據（快轉後的 check runs、`skillshare sync`、實機驗證）。
4. 回 Spec 逐條核對「驗收條件」，有證據才勾；不過就回 S2。
5. 勾 Plan 的「完成檢查」。

### 7. finishing-a-development-branch

測試全綠，且對 Spec＋Plan 跑完巡檢全部規則、錯誤已修正，才繼續。依使用者選擇：

| 選項 | Plan | Spec |
|---|---|---|
| 開 PR 合進 `dev`（base 為 `dev`） | PR 自動連到 Plan；開 PR → 進行中；合進 `dev` → 驗證中（自動；自動化設定完成前依 elf-team-rule 規則 10 的過渡期處理）。PR 描述**只寫 Plan 編號**，不寫 Spec 編號，避免 PR 自動化連帶改動 Spec 狀態 | 維持進行中 |
| 發版完成 | elf-team-rule 規則 10 的三個條件都滿足後，AI 手動改為 已完成：① `release` 已快轉到含這些提交的 `origin/dev`；② 該提交的 check runs 全部通過（規則 28）；③ 有部署或派發步驟的 repo 已確認新版生效（例：skillshare-source 已 `skillshare sync`） | 自動關閉 |
| hotfix | 不經 PR 合回 `dev`（elf-team-rule 規則 11）：依規則 25 快轉 `release`（repo 的 CI 還沒加 `hotfix/**` 觸發時，才對 `release` 開 draft PR，只用來觸發 CI）；依規則 26 在本機把 `release` 合回 `dev` 後直接推送（規則 9 的例外），有衝突時經 `merge/conflict-*` 的 PR 合回、用 merge commit（規則 18、37）。規則 10 的三個條件都滿足後手動改為 已完成（條件 ① 改為 `release` 已快轉到該 `origin/hotfix/*`） | 自動關閉 |
| 未導入 dev／release 的 repo | PR 合併 → 已完成（預設自動化） | 自動關閉 |
| 本地 merge | 只用於第 1、2 種 `main` → `dev` 同步合併（elf-team-rule 規則 18），開發分支不適用 | — |
| 保留分支 | 維持 驗證中，留言原因 | 維持進行中 |
| 捨棄 | 改為 已取消，留言原因 | 問使用者：一併取消或保留重新規劃 |

PR 合併或單取消後，在 Orca 刪除該工作區（移除 worktree 與分支）；「保留分支」保留工作區。最後在 Plan 留言：選項、分支或 PR 連結、worktree 與 Orca 工作區是否已清理。

## 隊友（subagent）規則摘要

完整規則見《隊友規範》。

| 角色 | 系統名稱（只用於工具參數） | 顯示名稱（Linear 與回報一律用這個） |
|---|---|---|
| 統籌 | — | `E-xx-統籌`（不寫程式、不審程式） |
| 計畫撰寫 | `exx-planner` | `E-xx-計畫撰寫` |
| 實作 | `exx-implementer` | `E-xx-實作` |
| Task 審查 | `exx-task-reviewer` | `E-xx-Task 審查` |
| 最終審查 | `exx-final-reviewer` | `E-xx-最終審查` |

- 編號用 **Plan 編號**；每張單一組新隊友，不跨單沿用。
- 同角色並行加流水號：`e87-implementer-2`／`E-87-實作-2`；重啟後沿用同名並在 Plan 留言重派原因。
- 審查隊友必須全新派出、沒看過實作過程；審查發現的問題由統籌交回實作隊友修正。
- 並行前列出各條線的寫集，確認不相交才可並行，同時最多兩條線。
- 統籌對使用者回報預設 **3 行以內**：做了什麼、結果、下一步。只有需要使用者決定、計畫與實際不符、測試失敗或數字對不上時才展開。

## git 安全規則摘要

完整規則見《分支規範》。

- 不在 `main`、`release` 上提交，不 force push；部署一律用 `release`。
- 所有改動經開發分支進 `dev`，不直接在 `dev` 上開發。
- 快轉 `release` 前，要發佈的提交上每個 check run 都必須通過；沒有 CI 時需 Eddie 明確同意例外。
- 不繞過 git-guard（`--no-verify`、改 `core.hooksPath`、改 hook）；未經 Eddie 同意不使用 `ELF_ALLOW`。
- 遇到衝突一律先回報使用者，不自行解決。

## 維運單（不 commit 到 repo 的工作）

完整規則見《流程：維運單》。

- 標題 `[維運] 主題`；單一工作單、不建子單；label 工作類型 `維運`（涉及稽核加 `稽核`）；負責人與專案必填；estimate 選填。
- 描述用範本：目的／影響範圍（系統、主機、IP、是否影響正式營運、是否停機）／回復方式（影響正式營運時必填）／檢查清單／結果。
- 狀態：待規劃 → 待辦（可直接排目前週期）→ 進行中 → 驗證中（等結果確認）→ 已完成。
- 每勾一項就留言證據（指令與輸出、截圖、時間）；含 `稽核` 的單沒有證據不得完成。留言不貼密碼、金鑰、連線字串，改寫「存於 Bitwarden：<集合>/<項目>」。
- **AI 不得自行在正式環境執行變更**（AIRSET 資料庫、AG、防火牆、核心交換器、正式主機）：AI 可以準備指令、做唯讀檢查、整理證據，由 Eddie 執行或明確授權。
- 收尾前跑巡檢 R1、R2、R6、R7。

## 巡檢自查

規則見《Linear 巡檢規則》，每個工作日 08:50 也會自動巡檢並寫入《Linear 巡檢報告（每日更新）》。

- 步驟 0 開單後：對新建的兩張單跑 R1–R7。
- 步驟 7 收尾前：對該 Spec＋Plan 跑全部規則，有錯誤先修正再收尾。
- 維運單收尾前：跑 R1、R2、R6、R7。

## 舊單轉換規則

- **不需要設計的小型程式修正**（明確錯誤修正）：不套用本流程，維持單一工作單。
- **不改 repo 的維運工作**：改走維運單，標題改為 `[維運] 主題`。
- **需要設計與實作、尚未動工的舊單**：舊單改名為 `[Spec] 主題`、加 label `Spec`，原描述整理進 Spec 模板章節（原文保留在「背景與限制」）。再建立子 issue `[Plan] 主題`（label `Plan`、parent 為此 Spec）；狀態依規格是否定案設定。
- **已在實作中的舊單**：同上，並把已完成的工作寫進 Plan 且勾選，Plan 狀態照實際進度設定，Spec 維持進行中。
- 不刪除舊單、不改編號；轉換時在舊單留言「已轉為新流程」並附日期。

## 原則

- 兩道保險（5-1、6）即使是小任務也不省略；沒有證據不說完成。
- Spec 與 Plan 都必須設定 estimate，未設定不得進入下一步；範圍變動時同步更新。留言中的工時預估不能取代 estimate 欄位。
- 不手動把 Spec 改為已完成，交給自動化關閉；Spec 已完成就代表整件事做完。
- 一個 Spec 對應一個 Plan；範圍太大就拆成多個 Spec 並建里程碑。
- 工作單**最多兩層**（Spec → Plan），Plan 底下不開子工作單，Task 一律是 Plan 描述裡的打勾清單。
- 多個 AI 同時開發（Orca）：照 elf-team-rule 規則 31–36。一個 AI 只負責一個 worktree、一條分支、一張 Plan，兩個 session 不用同一條分支；先在 Plan 留言認領；不切分支、不碰主目錄、不改別人的 Plan；會改到同一個檔案就先問使用者。另外：
  - 開始前確認工作目錄就是這張 Plan 的 worktree（repo 外同層、分支名稱符合規則 10），不在 Orca 自動建立的 `.ocrca/…` 目錄裡做事（規則 31）。
  - 會改到同一批檔案的單用 blocked by 排序；同一專案有兩組以上未完成的單時，Spec 定案前在「## 並行」一節寫 `並行：可（與 E-xxx）` 或 `並行：不可（blocked by E-xxx）`，下一行 `理由：` 寫兩邊要改的檔案清單比對結果（規則 32）。
  - 別張單只留言，不改它的描述，由負責那張單的 session 更新（規則 33）。
  - 改動共用本機狀態（skillshare 設定與 `skillshare sync`、全域 git 設定、Credential Manager）或刪除、移動共用路徑前，先確認沒有其他 session 在用，並在里程碑或相關的單留言告知（規則 34、35）。
  - 收尾時清理自己建立的 worktree 與分支，Orca 自動建立、沒用到的 `.ocrca/…` 目錄列進清理清單（規則 36）。
- 狀態變更、偏離計畫、審查與驗證結果都要在 Linear 留言，保留完整紀錄，Deloitte 稽核可追溯。
- 修改規則時改 Linear 正本，再同步本 skill；改 skill 的 PR 先出核准稿，發版時才改正本。新增可檢查的規則時同步加進巡檢規則。

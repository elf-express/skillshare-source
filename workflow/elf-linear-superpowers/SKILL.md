---
name: elf-linear-superpowers
description: 把 superpowers 生命週期（brainstorming → using-git-worktrees → writing-plans → executing-plans / subagent-driven-development → requesting/receiving-code-review → verification-before-completion → finishing-a-development-branch）接到 Linear ELF EXPRESS 團隊的 [Spec]/[Plan] issue，並涵蓋不改程式的 [維運] 單。當使用者提到 Linear issue 編號（E-xx）、說「照 E-xx 做」、要開新功能、新需求或維運工作，或要執行任何 superpowers 步驟時使用。
metadata:
  version: 2.0.0
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
> | Linear 巡檢規則 | 可自動檢查的規則 R1–R13、W1–W6 |
>
> 版本：2026-10-20 核准稿（對齊 superpowers v7.0.0；Linear 正本於發版時依核准稿更新）

Linear 是規格與計畫的唯一來源（single source of truth）。superpowers 各 skill 照常執行，但**產出寫進 Linear issue，不寫 `docs/superpowers/specs/`、`docs/superpowers/plans/` 檔案**（除非使用者明確要求另存）。superpowers 允許使用者偏好覆蓋這兩個預設位置。

本機副本只有兩種，都不是正本：步驟 1 實作者檢查用的 Spec 暫存檔（檢查完刪除），以及步驟 4 開工時匯出到 worktree `.superpowers/sdd/` 的 Plan 與 Spec，給 superpowers 的 ledger、task brief 與審查包使用（見步驟 4）。匯出檔不進版控；與 Linear 不一致時以 Linear 為準，重新匯出。階段 Guard 另用兩個小檔，只記單號與核准，也不是正本：步驟 2 建的狀態檔、步驟 3 核准後 Eddie 建的核准檔；計畫有沒有核准，以 Plan 上的「計畫已核准」留言為準。

每個步驟結束時，都要把結果回寫到對應的 Linear 單（改狀態、勾 checkbox 或留言），不能只停留在對話裡。讀不到 Linear MCP 時先告訴使用者，不要改寫到本地檔案。

## 與上游 superpowers 的分工

本 skill 對齊 obra/superpowers **v7.0.0**（2026-10-09）。superpowers 的流程行為以上游為準，本 skill 只補上游沒有的部分：Linear 紀錄、分支與發版規則、稽核留痕。本 skill 是團隊規範，等同使用者指示；上游 `using-superpowers` 規定使用者指示優先於 skill，所以兩者衝突時以本 skill 為準。**本 skill 覆蓋上游的地方全部列在下表，表外一律照上游做**。本 skill 對上游做法的轉述（四種停止條件、模型級別、5 項自審等）都是摘要，以上游原文為準。

| 上游預設 | 本團隊改為 | 原因 |
|---|---|---|
| brainstorming 把設計寫進 `docs/superpowers/specs/`；writing-plans 把計畫寫進 `docs/superpowers/plans/` | 寫進 Linear 的 Spec、Plan；步驟 4 才匯出本機副本 | Linear 是唯一來源，稽核可追溯 |
| 快速、明確的小事直接做 | 只要會 commit 到 repo，就開單一開發工作單，兩道保險不省略 | 每個變更都要有工作單與證據 |
| 使用者說跳過提問直接做時，brainstorming 結束、HARD-GATE 一併解除 | 跳過的只是訪談；仍要開單（Spec／Plan 或單一開發工作單），Spec／Plan 仍要定案、審計員核准，兩道保險不省略 | 每個變更都要有工作單與證據 |
| 使用者同意的 spike 可以直接做，不寫測試、跳過計畫與審查 | spike 只在拋棄式 worktree 裡做（不用已有狀態檔的 Plan worktree，Guard 會擋；也不為了 spike 請 Eddie 建核准檔），不 commit 進開發分支、不開 PR；要留下成果就另開單 | 拋棄式探索不進 repo |
| 設計核准後下一步只能是 writing-plans；writing-plans 說 worktree 在執行時才建 | Spec 定案後先走步驟 2 建 worktree（分支用 Plan 編號、基線測試留言、Orca 連單、狀態檔），再寫 Plan | 分支、基線、Orca 連單與狀態檔要先有；有狀態檔，Guard 才會在計畫核准前擋實作檔 |
| 計畫在對話裡核准 | 審計員在 Plan 留言「計畫已核准（YYYY-MM-DD，審計員：<模型>）」才算核准 | 對話不留紀錄 |
| using-git-worktrees 優先用原生 worktree 工具 | 不用 `EnterWorktree` 建 worktree（它只建在 repo 內）；用 `git worktree add` 建在 repo 外同層（規則 31），再切進去（見步驟 2） | 不碰主目錄 |
| 計畫和實際不符時只有四種情況停下來 | 另加兩種：需要改規格（裁決不能改 Spec）；elf-team-rule 規則 13 列的 git 停止條件（`--ff-only` 失敗、衝突、push 被拒等），一律照規則 13 停下，不適用裁決制 | 規格變更要使用者核准；git 異常一律先回報 |
| 最終審查後殘留的問題，到 finishing-a-development-branch 列選項時才告訴使用者 | 殘留的 Critical 不進步驟 6：先在 Plan 留言列出，由使用者決定修或停 | 驗證與發版前先處理嚴重問題 |
| finishing-a-development-branch 選單有「本地合併」 | 開發分支只開 PR 合進 `dev`；本地合併只用於規則 18、26 的情況 | 分支規範 |
| 裁決（Ruling）記在 ledger，收尾時在對話回報 | 每個 Task 完成時把該 Task 的裁決原文留言到 Plan；刪 superpowers 工作區前再留一則「Rulings I made」總表 | ledger 不進版控、會隨工作區刪除；session 中斷時 Linear 仍有紀錄 |

另有幾項是團隊另加的限制，上游沒有規定、也不衝突：Plan 的 Task 控制在 3–5 個（elf-team-rule 規則 16、17）；超出 Spec 的需求不裁決（見步驟 4）；並行的問題調查同時最多兩條線；計畫可以交給計畫撰寫隊友寫（見隊友表）；階段 Guard（E-377，Claude Code 的 hook）在計畫核准前擋檔案工具寫 repo 裡 `docs/superpowers/` 以外的檔案，靠步驟 2 的狀態檔與步驟 3 的核准檔運作，說明見 skillshare-source 的 `docs/superpowers/guard.md`。

更新 superpowers（`skillshare update _superpowers`）前先讀上游 `RELEASE-NOTES.md`；行為有變動就開單同步本 skill 與團隊範本，同步後更新本節的版本。

## 先分流：走哪條路

| 這件事… | 走 |
|---|---|
| 要 commit 到 repo，且需要設計 | 本 skill 的 Spec／Plan 流程 |
| 要 commit 到 repo，但不需要設計（明確錯誤修正、緊急修正、小型改善） | 單一開發工作單（仍要兩道保險） |
| 不 commit 到 repo（備份、AG 複寫、網路、主機、憑證、帳號、稽核佐證） | **維運單**（見文末「維運單」） |
| 不確定要不要設計 | 先開 Spec，用 brainstorming 談。brainstorming 判斷為快速小事或小變更時：**先**把 Spec 改為已取消、**再**改 Plan（子單先關可能觸發父單自動改為已完成），各留言「規模判斷：小變更，改開 E-xxx」，另開單一開發工作單，把對話中講定的做法寫進「修正方式」 |

同一件事兩者都有時拆兩張：先開維運單把事情做掉，工具化另開 Spec／Plan。

單一開發工作單用的上游 skill：using-git-worktrees（照步驟 2 建在 repo 外同層，分支用該單編號，不建狀態檔）→ 錯誤類先用 systematic-debugging 找出根因 → test-driven-development → requesting-code-review（照上游的審查範本派全新審查者，明確指定最強模型審整個分支；`BASE_SHA` 用 `git merge-base origin/dev HEAD`，hotfix 用 `origin/release`，不用上游範例的 `main`；沒有計畫檔，不用 `review-package`）→ receiving-code-review（逐項處理並留言）→ verification-before-completion → finishing-a-development-branch。不匯出、沒有 ledger：審查結果、延後的 Minor、決定不修的理由直接留言到該單。改到 skill 的單，另照步驟 3 的 writing-skills 做法先跑壓力情境再改。

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
| 1 | brainstorming | 必經 | Spec | 待規劃 → 進行中 | 先請使用者描述、逐段回放，確認後寫進 Spec；判斷規模；實作者檢查 → 結果補進 Spec；定案留言「規格已定案」 |
| 2 | using-git-worktrees | 必經 | Plan | — | 分支用 Plan 編號；基線測試留言；提醒在 Orca 連 Plan 單；建狀態檔 |
| 3 | writing-plans | 必經 | Plan | 待規劃 → 待辦 | Spec 已定案才開始；計畫只記決策；寫完 5 項自審、設 Plan estimate 後改待辦；審計員留言「計畫已核准」後才可進 3a／4，Eddie 接著建核准檔 |
| 3a | 排進週期 | 必經 | Spec＋Plan | 維持 | 使用者決定這兩週要做才排；兩張排同一週期；Plan 留言 |
| 4-1 | executing-plans（Native） | 二擇一 | Plan | 待辦 → 進行中 | 匯出計畫；每個 Task 完成時勾該 Task 的全部步驟，並留言完成摘要與裁決 |
| 4-2 | subagent-driven-development（Subagent-driven） | 二擇一 | Plan | 待辦 → 進行中 | 同上；留言另含該 Task 的審查結論 |
| S1 | test-driven-development | 必經（每個 Task） | Plan | — | 即 Task 的 5 個步驟；executing-plans 規定開工就載入，subagent-driven-development 的實作者照 Task 的步驟做 |
| S2 | systematic-debugging | 按需 | Plan | — | 現象、根因、修法、新測試留言 |
| S3 | dispatching-parallel-agents | 按需 | Plan | — | 只用在彼此獨立的問題調查；同一張 Plan 的實作 Task 不並行；並行清單與整合結果留言 |
| S4 | writing-skills | 必經（新增或修改 skill 的單） | Plan | — | 每個要改的 skill 先跑壓力情境（RED），改完用同一組情境再跑（GREEN）；兩次的結果留言 |
| 5-1 | requesting-code-review | 必經・保險① | Plan | 進行中 → 驗證中 | 所有 Task 勾完即改；最強模型審整個分支；結果依嚴重度留言；刪工作區前留言「Rulings I made」總表 |
| 5-2 | receiving-code-review | 必經 | Plan | 維持驗證中 | 逐項處理方式留言；只修一輪（4-2 派修正隊友＋範圍重審；4-1 自己修、用測試驗證），殘留的由使用者決定 |
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
  | Plan 待辦、沒有「計畫已核准」留言，或最後一則「計畫已修改 vN」之後沒有「計畫已核准 vN」 | 步驟 3（等審計員，不得開工） |
  | Plan 待辦、已核准、沒排週期 | 步驟 3a |
  | Plan 待辦、已核准、已排週期 | 步驟 4（開工） |
  | Plan 進行中 | 步驟 4（先讀 ledger，見步驟 4「續跑」） |
  | Plan 驗證中、PR 尚未合進 `dev` | 步驟 5 或 6（看留言紀錄） |
  | Plan 驗證中、PR 已合進 `dev` | 步驟 7（等發版） |

  步驟 5-1 已改為驗證中的 Plan，在步驟 7 開 PR 時會被自動拉回進行中，這是正常的，仍在步驟 7（等 PR 合併），不要回步驟 4；PR 有審查活動或合進 `dev` 時會再自動改為驗證中（合進 `dev` 的自動化設定完成前依 elf-team-rule 規則 10 的過渡期處理）。

- **新需求**：`save_issue` 在團隊 `ELF EXPRESS` 套用模板 `Spec 設計規格` 建立 `[Spec] 主題`。確認底下有 `[Plan]` 子 issue（沒有就手動建：套用模板 `Plan 實作計畫`、parent 為此 Spec、label `Plan`、狀態 待規劃），並把子 issue 標題改成 `[Plan] 主題`。
- 建立後立即設定 Spec 的 **estimate**，依目前對需求規模的初估。
- **兩張單都要設負責人（Eddie）與專案**；找不到適合的專案就問使用者，不自行開專案、不留空。
- Spec 加一個**工作類型** label；Plan 只加 `Plan`。
- **開單時不排週期**（見步驟 3a）。
- 一件事拆成**兩組以上** Spec＋Plan 時，在該專案建立里程碑（名稱用這件事的主題），每組都放進去，有先後順序的用 blocked by 標出；只有一組不建里程碑。大型主題用專案或里程碑分組，**不用父單**。
- 專案狀態：開第一張 Spec 時從「積壓案件」改「規劃中」；第一張 Plan 進入進行中時改「進行中」；專案是否「已完成」問使用者。
- 對兩張單跑巡檢 R1–R7 自查，有錯先修正。
- 回報編號，例如「Spec E-31 / Plan E-32」。

### 1. brainstorming → Spec

1. Spec 改為 **進行中**。Linear 的自動化會把改為進行中的 Spec 加進目前週期；照步驟 3a，週期要等 Plan 核准後兩張一起排，所以先把 Spec 的週期清掉。
2. 照 superpowers 的 brainstorming 談（v7：先請使用者描述想要什麼與為什麼、不先給選項；每弄懂一部分就回放並標明哪些是猜測；先問使用者哪些技術選擇要自己決定）。本 skill 不重寫它的做法。
3. brainstorming 判斷規模並明講，使用者可推翻：
   - 快速小事或小變更 → 依「先分流」最後一列轉單一開發工作單。
   - 專案 → 繼續寫 Spec，Spec 就是上游所說的「書面設計」。
   - 其實是好幾個獨立專案 → 說出來、和使用者談定順序，拆成兩組以上 Spec＋Plan 並建里程碑（步驟 0），一次談一個。
   - 使用者說跳過提問直接做 → 跳過的只是訪談，照「與上游 superpowers 的分工」表仍要開單與核准。
4. 每段回放經使用者確認後，就用 `save_issue` 寫進 Spec 對應章節，不等全部談完（中斷時 Linear 仍有紀錄）。章節：目標、範圍（要做／不做／反目標）、背景與限制、已決定的做法、留給實作者決定、方案比較（選填）、測試、驗收條件、實作者檢查、待決問題。保留「給 Claude」引言與章節標題（範本註明可刪的章節除外）。「已決定的做法」每一項標明「Eddie 決定」或「AI 的決定」，AI 的決定不寫成使用者同意的。
5. **實作者檢查**（上游的 builder check）：用 `get_issue` 把 Spec 存成系統暫存資料夾（Windows 是 `%TEMP%`）裡的 `E-<Spec 編號>-spec.md`（不放在 repo 裡，檢查完刪除），照 brainstorming 的 `builder-check-prompt.md` 派全新 subagent 讀它，派發時寫檔案的絕對路徑（隊友名稱見「隊友（subagent）規則摘要」）。結果分三類：對話或專案已能回答的補進 Spec；小事自己決定並標「AI 的決定」；會改變做法、只有使用者能答的，整理成一則訊息一次問完。三類結果摘要填進「實作者檢查」。
6. 自審：無佔位文字、無矛盾、範圍明確、驗收條件可驗證。請使用者審閱全文，附上 AI 自己做的決定清單。
7. 使用者核准後，在 Spec 留言「規格已定案（YYYY-MM-DD，<核准者>核准）」，例如「規格已定案（2026-10-21，Eddie 核准）」。核准前不寫產品程式、不搭鷹架、不裝套件、不建專案、不呼叫實作 skill（上游 HARD-GATE），只能讀與探索。Spec **維持進行中，不要關閉**，它會在 Plan 完成時自動關閉。

### 2. using-git-worktrees → Plan

1. 動手前先確認 repo 屬於分支規範的第幾種（看根目錄 `BRANCHING.md` 或 README 開頭），不確定就問。
2. 分支名稱 `<類型>/e-<Plan 編號>-<英文短名>`，例如 `feat/e-32-fx-rate-sync`。類型：`feat`、`fix`、`docs`、`chore`、`test`、`hotfix`。英文短名小寫 kebab-case。GitHub PR 自動化靠分支名稱裡的編號對應到 Plan。**不要**用 Linear 產生的 `gitBranchName`（會帶中文與全形符號，在 Windows、CI、shell 容易出問題），也不要用個人前綴（如舊的 `tw199501/`）。
3. 一般分支從最新的 `origin/dev` 開出；hotfix 是單一工作單，用該單編號，從 `origin/release` 開出。
4. worktree 一律開在 repo 外（同層），不開在主倉庫目錄內。這是本團隊已宣告的偏好，using-git-worktrees 不必再問要不要建。不用 Claude Code 的 `EnterWorktree` 建 worktree（它只會建在 repo 內的 `.claude/worktrees/`）；改用 `git worktree add <repo 外同層的路徑> -b <分支名稱> origin/dev`（hotfix 用 `origin/release`），再用 `EnterWorktree` 的 `path` 參數切進去，讓 session 的工作目錄跟著過去；沒有 `path` 參數的版本改用 `cd`（兩者的限制見「待確認」）。
5. 跑基線測試，在 Plan 留言：分支名稱、worktree 路徑、基線測試結果（通過數／失敗數）。基線不乾淨就停下來問使用者。
6. **Orca 連單**：worktree 一律由 Claude Code 建立，**不要**在 Orca 的 Linear 任務列表按 Use 建立。建立後提醒使用者在 Orca：讓該 worktree 顯示在側邊欄；在 Edit Worktree Details 的 issue 欄位貼上 **Plan** 單網址（只連 Plan，一個工作區只連一張單）。
7. **狀態檔**（給階段 Guard。只有 Spec／Plan 要建，單一開發工作單與 hotfix 不建）：在 worktree 建 `docs/superpowers/state/E-<Spec 編號>.yaml`，內容三行 `ticket: E-<Spec 編號>`、`phase: plan`、`plan: E-<Plan 編號>`（UTF-8、LF），以 `docs(E-<Plan 編號>): 加入狀態檔` commit 進本分支；合進 `dev` 後留著當紀錄，不刪。第 1 種 repo 送原作者的 `pr/` 分支不 cherry-pick 這個 commit（規則 12）。`phase` 之後不更新，在哪一步一律看 Linear。Guard 依分支名稱找狀態檔，認得哪些分支格式見 skillshare-source 的 `docs/superpowers/guard.md`。

### 3. writing-plans → Plan

1. 以 Spec 最新內容為輸入（取代 superpowers 預設的設計文件路徑），並探索程式結構。
2. 照 writing-plans 寫，填進 Plan 描述，保留模板結構：
   - 標頭：目標、Spec（父 issue 編號）、架構、技術棧
   - 全域限制（上游的 Global Constraints）：規格中全專案適用的要求，一條一行，數值照抄規格
   - 檢查重點（上游的 Review Focus）：規格沒寫、但最可能讓使用者出問題的輸入或情況，最多五種；每一條都在負責那段程式的 Task 加一個測試；沒有就寫「已檢查，沒有」
   - 檔案結構：新增／修改／測試，精確路徑
   - 每個 Task：檔案、介面（需要／產出：類別、方法、資料表，寫精確簽名）、5 個 checkbox 步驟（寫失敗測試 → 確認失敗 → 實作 → 確認通過 → commit）；每個 Task 都要能獨立測試與 commit
   - **計畫只記決策，不寫整段程式**（上游 6.4.2 起的寫法）：測試步驟寫測試名稱與斷言，斷言用規格的精確值；實作步驟寫檔案、精確簽名與規格的值，只有簽名和測試決定不了的演算法才附程式；驗證步驟寫指令與通過時的輸出。每一步是一個動作、一個可檢查的結果；設定、鷹架、文件併進需要它的 Task。
   - **步驟編號全單唯一**：`- [ ] 步驟 <Task>.<步驟>：…`，例如 `- [ ] 步驟 2.3：在 src/rate.ts 實作 syncRates(date: Date): Promise<number>`。模板裡的「步驟 1」「步驟 2」要改掉，否則多個 Task 會出現相同文字，勾 checkbox 時無法精準定位。
   - Task 標題維持 `## Task N：名稱`（上游的 task brief 靠這個格式切出每個 Task，已實測）
   - 新增或修改 skill 的單（含本 skill 與 elf-team-rule）：每個要改的 skill 照上游 writing-skills 加 RED、GREEN 兩個步驟。改之前派全新 subagent 跑壓力情境（紀律類 skill 每個情境至少組合三種壓力），記下沒有新內容時的行為；改完用同一組情境再跑，確認照做。計畫寫情境名稱、壓力與預期行為，不抄整段提示詞。
   - 完成檢查
3. 不寫沒有決定任何事的句子（例如「加上驗證」「處理邊界情況」），也不把簽名與測試已經決定的程式整段抄進來。
4. 全域限制一律包含 Plan 範本的四條：**資料庫腳本必須冪等、可重複執行，不存在就建立、存在就更新，不可 DROP 既有資料表或資料**；PowerShell 腳本（.ps1）存成 UTF-8 with BOM；不在計畫範圍內的檔案不修改，不刪測試、不放寬斷言、不降低 coverage 門檻；發版由誰執行（規則 39）。本單沒有資料庫變更或 .ps1 時，照範本寫「本單無…」，不刪掉該條。
5. 照 writing-plans 做 5 項自審：規格涵蓋、逐步檢查、型別一致、檢查重點、比例（計畫比規格長好幾倍，就是在抄程式）。
6. 依 Task 數量與複雜度設定 Plan 的 **estimate**；與 Spec 初估差距大時同步更新 Spec 的 estimate。
7. 自審後 Plan 改為 **待辦**，送審計員（使用者的審計對話）審，並照 writing-plans 請使用者選執行方式、附一句推薦理由：**Subagent-driven**（4-2：每個 Task 有全新實作者與審查者，最徹底）或 **Native**（4-1：在本 session 自己做，最後由最強模型的審查者審整個分支，最省）。使用者選定後在 Plan 留言「執行方式：Subagent-driven」或「執行方式：Native」，步驟 4 照這則留言執行。
8. 審計員在 Plan 留言「計畫已核准（YYYY-MM-DD，審計員：<模型>）」後才進 3a／4。對話裡的口頭同意不算，自己派的 subagent 審查只算自審。核准後若再改 Plan 描述（勾步驟與完成檢查不算），先留言「計畫已修改 v2（原因）」並重新送審，審計員留言「計畫已核准 v2（YYYY-MM-DD，審計員：<模型>）」後才繼續；之後再改依序用 v3、v4。審計員退回時，依留言修改、重做 5 項自審後再送。
9. **核准檔**（給階段 Guard）：審計員留言「計畫已核准」後，由 Eddie 在自己的終端機（不經 Claude Code）照 `guard.md` 建 `~/.claude/superpowers/approvals/E-<Plan 編號>.yaml`：`ticket` 填 Plan 編號（和檔名相同，不是狀態檔裡的 Spec 編號），`linear_comment_id` 填那則核准留言的 id。AI 不建、不改、不刪核准檔，用什麼工具都一樣；使用者要 AI 代建時，把填好的指令寫在對話或留言裡，交給他自己執行（不要用 Bash 印出來，含核准目錄的指令會被 Guard 擋）。留言「計畫已修改 vN」時請 Eddie 刪掉核准檔，「計畫已核准 vN」之後再照同樣方式重建。

### 3a. 排進週期

- 只有在 Plan 已寫好、狀態待辦、有「計畫已核准」留言、**使用者決定這兩週要做**時才排。
- 有目前週期且有餘力 → 排目前週期；否則排下一個週期；不確定就問。
- **Spec 與 Plan 一起排進同一個週期**，在 Plan 留言「已排入 Cycle N（YYYY-MM-DD～YYYY-MM-DD）」。
- 週期結束時，沒做完的單問使用者移到下一週期或退回不排週期，不讓單留在已結束的週期裡。

### 4. 執行 → Plan

**開工**

- 確認 Plan 有「計畫已核准」留言、之後沒有還沒核准的「計畫已修改」留言、已排進週期；確認核准檔在：用 Read 讀家目錄的 `.claude/superpowers/approvals/E-<Plan 編號>.yaml`，四個欄位都有值（Bash／PowerShell 指令只要含 `superpowers/approvals` 就會被 Guard 擋，不要用），沒有就請 Eddie 照步驟 3 第 9 項建立（可附上填好欄位的指令）；讀「執行方式」留言，沒有就問使用者並補留言。開始第一個 Task 時 Plan 改為 **進行中**。
- **匯出計畫**（在 worktree 根目錄）：
  1. 先建 `.superpowers/sdd/`，在裡面寫一個內容只有 `*` 的 `.gitignore`。上游 `sdd-workspace` 也會建這個檔，先建是為了讓匯出檔從一開始就不被 git 看到。
  2. 用 `get_issue` 把 Plan 描述存成 `.superpowers/sdd/E-<Plan 編號>-plan.md`，父 Spec 存成 `.superpowers/sdd/E-<Spec 編號>-spec.md`。
  3. 匯出的 Plan 拿掉「## 完成檢查」一節：上游的 task brief 會把最後一個 Task 標題之後的內容全部切進該 Task。
  4. 把匯出 Plan 的「**Spec：**」整行換成 `**Spec：** .superpowers/sdd/E-<Spec 編號>-spec.md`，讓執行者讀得到規格。
  5. 一律以這個相對路徑當 `PLAN_FILE`（ledger 第一行靠它對應本 Plan）；ledger 在 `.superpowers/sdd/E-<Plan 編號>-plan/progress.md`。
  6. repo 的格式化或 lint 工具（例如 prettier）會掃到 `.superpowers/` 時，把它加進該工具的忽略清單，用一個 `chore` commit 提交到本分支，並當成裁決記進 ledger（E-268 遇過）。不提交的話 worktree 會一直有未提交的變更，收尾時移除不了。
- **上游腳本的路徑**：`sdd-workspace`、`task-brief`、`review-package`、`task-start`、`task-done` 一律用 skillshare 來源樹的路徑、以 `bash` 執行，例如 `bash <skillshare 來源>/_superpowers/skills/subagent-driven-development/scripts/sdd-workspace .superpowers/sdd/E-<Plan 編號>-plan.md`（來源路徑看 `skillshare status` 的 Source；上游 6.4.1 起不保證腳本有執行權限）。不用 `~/.claude/skills/_superpowers__skills__*/scripts/`：`task-start`／`task-done` 用相對路徑找 subagent-driven-development 的腳本，在 skillshare 攤平的目錄可能找不到。
- 審查包的 `MERGE_BASE` 用 `git merge-base origin/dev HEAD`（hotfix 用 `origin/release`），不用上游範例的 `main`。

**執行中**

- 每個 Task 完成（ledger 寫下 `Task N: complete`）時做兩件事：
  1. 用 `save_issue` 的 `patch`（op `replace`）把該 Task 的每一行 `- [ ] 步驟 N.M` 改為 `- [x] 步驟 N.M`，只改這些行，不重送整份描述。Linear 會存成 `- [X]`，兩者都代表已完成。
  2. 在 Plan 留言一則：`Task N 完成（commits <a>..<b>）`、驗證結果（4-1：`task-done` 的測試結果；4-2：Task 審查的規格與品質結論、修正了幾輪）、本 Task 期間 ledger 的 `Ruling:` 行原文（開工前掃描計畫時的裁決併入 Task 1 這則）、隊友換人與原因。
- commit 訊息附 Plan 編號，例如 `feat(E-32): 新增匯率同步排程`。
- **計畫與實際不符：照上游的裁決制**，不停下來等。以 Spec 為最高依據自己決定，記進 ledger：`Ruling: <決定> — <理由> — <錯了的代價>`，然後繼續。超出 Spec 範圍的需求不裁決（團隊補充）：照 Spec 也能完成 Plan、只是發現 Spec 沒涵蓋的新需求，就不做，記進 ledger，收尾時回報（需要就另開單）；不改 Spec 就完成不了 Plan，屬於下面的「需要改規格」。停下來問使用者的情況：上游的四種（不可逆或破壞性的操作；安全相關的動作；worktree 以外的副作用，例如合併、推送共用分支、發佈；計畫壞到每條路都只能猜），加上本團隊的兩種（需要改規格；elf-team-rule 規則 13 列的 git 停止條件，例如 `--ff-only` 失敗、衝突、push 被拒）。上游本來也要求停下來的：基線測試不乾淨（using-git-worktrees）、連續 3 次修不好（systematic-debugging；4-2 的做法見 S2）。
- 派發 subagent **一律明確指定模型**（上游 Model Selection；省略會繼承 session 模型）。各角色用哪一級見「隊友（subagent）規則摘要」。
- 4-1 Native：照 executing-plans，本 session 就是實作者，用 `task-start`／`task-done` 記 ledger；最後一樣派最強模型的審查者審整個分支（步驟 5-1）。
- 4-2 Subagent-driven：照 subagent-driven-development，每個 Task 一位全新實作者、一位 Task 審查者。同一張 Plan 的實作隊友一次只派一個（上游規定，避免衝突）；統籌不自己修程式，審查發現的問題交回實作隊友。
- S1：必須親眼看到失敗、親眼看到通過才能勾。
- S2：修好後留言現象、根因、修法、新測試。4-1 由本 session 照 systematic-debugging，連續 3 次修不好就停下質疑架構並問使用者；4-2 的實作隊友回報 BLOCKED 或 NEEDS_CONTEXT 時，統籌照上游處理：補資訊、換更強的模型、拆小；計畫本身有誤時照裁決制決定修正、記進 ledger、帶著裁決重派。需要改規格，或計畫壞到每條路都只能猜時，才停下來問使用者；需改規格時，使用者同意後回 Spec 修改並留言。
- S3：只用在彼此獨立的問題調查（例如多個不相關的失敗），同一張 Plan 的實作 Task 不並行；整合後跑完整測試，留言並行清單與整合測試結果。
- S4：照 writing-skills 跑壓力情境，派發時明確指定模型；兩次的模型、情境與結果寫進該 Task 的完成留言。新內容下仍不照做、要改已核准的文字時，屬於「需要改規格」，停下來問使用者。

**續跑**（新 session、換 worktree、context 壓縮後）

- 「在哪一步」看 Linear 狀態（步驟 0 的判斷表）；「做到哪個 Task」看 ledger 與 `git log`。ledger 第一行寫的是本 Plan 的匯出檔時，有 `Task N: complete` 的 Task 已完成，不要重派。
- Linear 勾選與 ledger 不一致時，以 ledger 與 `git log` 為準，補勾 Linear、補留 Task 完成留言。
- 匯出檔或 ledger 不見了（例如執行過 `git clean -fdx`）：用同一個相對路徑重新匯出，再依 `git log` 與 Plan 上的 Task 完成留言重建 ledger：第一行 `# SDD ledger — plan: .superpowers/sdd/E-<Plan 編號>-plan.md`，每個已完成的 Task 補一行 `Task N: complete (commits <a>..<b>)`。不重建的話，上游會從 Task 1 重派。

### 5-1. requesting-code-review（保險①：查品質）

所有 Task 完成後 Plan 改為 **驗證中**。派全新審查者審整個分支，**明確指定最強的模型**；用上游的 `review-package` 把 diff 打包成檔案交給它（`MERGE_BASE` 見步驟 4），並附上 Plan 的「檢查重點」、ledger 的 `Ruling:` 行與延後的 Minor。依嚴重度（Critical／Important／Minor）留言，寫明審查者用的模型。

有問題時依執行方式照上游處理，**兩種都只修一輪**：

- **4-2 Subagent-driven**：派一位修正隊友（`E-xx-實作-<流水號>`）一次處理全部 Critical／Important，再派一次範圍重審。
- **4-1 Native**：本 session 自己修。先依「真的用這個軟體的人會遇到什麼」重新分級；每個 Critical／Important 先寫重現測試看它失敗、修到通過、再跑全套測試，ledger 記 `Final: fixed <問題> — <測試> RED→GREEN, suite N/N`；不派重審。
- 兩種都一樣：Minor 記進 ledger 的延後清單；決定不修的照上游記成裁決（`Ruling:`），不再有第二輪。殘留的 Critical 不自動進第 6 步：留言列出，由使用者決定修或停。

刪除 superpowers 工作區（`.superpowers/sdd/E-<Plan 編號>-plan/`）之前，在 Plan 留言一則「Rulings I made」總表：ledger 裡所有 `Ruling:` 行依時間順序的原文、延後處理的 Minor、最終審查的修正紀錄、隊友換人與原因。各 Task 的裁決已在 Task 完成時留言，這則是彙整。刪除後才發生的裁決（步驟 6 回頭修正、PR 審查後的修正）直接留言到 Plan。

### 5-2. receiving-code-review

讀完再回應、對照程式碼核對、有誤據理反駁；先修 Critical 再逐項修正並測試（4-2 由修正隊友修，統籌不自己修）；逐項留言處理方式（已修／反駁／延後，附理由）。修正只有一輪（做法依 5-1 的執行方式），不無限回到 5-1。

### 6. verification-before-completion（保險②：查正確性）

1. 執行完整驗證指令（`dotnet test`、前端 build、lint），讀取並核對實際輸出。
2. 資料庫腳本在測試環境重跑一次，確認冪等；要在正式環境跑，由 Eddie 執行或明確授權（AI 不得自行在正式環境執行變更，見「維運單（不 commit 到 repo 的工作）」一節）。
3. 在 Plan 留言證據：指令、exit code、通過／失敗數。沒有證據不宣告完成。
   證據分兩段，完成時間點不同：
   - **合進 `dev` 前必須完成**：測試、build、lint、資料庫腳本冪等這類「程式本身對不對」的證據。為什麼：延到合併後才補，等於讓沒驗證過的程式先進整合分支，保險②失效。
   - **發版完成前補齊**：與 `release` 有關的證據（快轉後的 check runs、`skillshare sync`、實機驗證）。
4. 回 Spec 逐條核對「驗收條件」，有證據才勾；不過就回 S2。
5. 勾 Plan「完成檢查」裡已經完成的項目；PR、發版、清理那幾項在步驟 7 完成時再勾。

### 7. finishing-a-development-branch

測試全綠，且對 Spec＋Plan 跑完巡檢全部規則、錯誤已修正，才繼續。

上游的選單固定三項：本地合併、推送並開 PR、保留分支。開發分支只能選「推送並開 PR」（base 為 `dev`）或「保留分支」；本地合併只用於下表「本地 merge」列的情況。捨棄只在使用者明確要求時做，且要使用者打字 `discard` 確認。上游只清理 `.worktrees/` 或 `worktrees/` 底下的 worktree，我們的 worktree 在 repo 外，照本節最後一段在 Orca 清理。

依使用者選擇：

| 選項 | Plan | Spec |
|---|---|---|
| 開 PR 合進 `dev`（base 為 `dev`） | PR 自動連到 Plan；開 PR → 進行中；合進 `dev` → 驗證中（自動；自動化設定完成前依 elf-team-rule 規則 10 的過渡期處理）。PR 描述**只寫 Plan 編號**，不寫 Spec 編號，避免 PR 自動化連帶改動 Spec 狀態 | 維持進行中 |
| 發版完成 | elf-team-rule 規則 10 的三個條件都滿足後，AI 手動改為 已完成：① `release` 已快轉到含這些提交的 `origin/dev`；② 該提交的 check runs 全部通過（規則 28）；③ 有部署或派發步驟的 repo 已確認新版生效（例：skillshare-source 已 `skillshare sync`） | 自動關閉 |
| hotfix | 不經 PR 合回 `dev`（elf-team-rule 規則 11）：依規則 25 快轉 `release`（repo 的 CI 還沒加 `hotfix/**` 觸發時，才對 `release` 開 draft PR，只用來觸發 CI）；依規則 26 在本機把 `release` 合回 `dev` 後直接推送（規則 9 的例外），有衝突時經 `merge/conflict-*` 的 PR 合回、用 merge commit（規則 18、37）。規則 10 的三個條件都滿足後手動改為 已完成（條件 ① 改為 `release` 已快轉到該 `origin/hotfix/*`） | —（hotfix 是單一工作單，沒有 Spec） |
| 未導入 dev／release 的 repo | PR 合併 → 已完成（預設自動化） | 自動關閉 |
| 本地 merge | 只用於第 1、2 種 `main` → `dev` 同步合併（elf-team-rule 規則 18）與 hotfix 的 `release` → `dev` 合回（規則 26），開發分支不適用 | — |
| 保留分支 | 維持 驗證中，留言原因 | 維持進行中 |
| 捨棄（使用者打字 `discard` 確認） | 先問使用者 Spec 要一併取消還是保留重新規劃。一併取消：等 Spec 改為已取消後，再改為 已取消，各留言原因。保留：改回 待規劃，留言作廢的內容與原因，之後照新規格重寫同一張 Plan（不另開 Plan） | 一併取消：先於 Plan 改為已取消；保留：維持進行中，回步驟 1 |

Plan 改為已完成（發版完成；未導入 dev／release 的 repo 是 PR 合併）或已取消後，在 Orca 刪除該工作區（移除 worktree 與分支，elf-team-rule 規則 19、36、39）；「保留分支」保留工作區。最後在 Plan 留言：選項、分支或 PR 連結、worktree 與 Orca 工作區是否已清理。

## 隊友（subagent）規則摘要

完整規則見《隊友規範》。

| 角色 | 系統名稱（只用於工具參數） | 顯示名稱（Linear 與回報一律用這個） | 模型級別（派發時明確指定，依上游 Model Selection） |
|---|---|---|---|
| 統籌 | — | `E-xx-統籌`（不寫程式、不審程式） | session 模型 |
| 實作者檢查 | `exx-builder-check` | `E-xx-實作者檢查` | 中階以上 |
| 計畫撰寫 | `exx-planner` | `E-xx-計畫撰寫` | 最強（上游由 session 自己寫計畫；統籌要分出去寫時才派） |
| 實作 | `exx-implementer` | `E-xx-實作` | 單一檔案的機械性修正用最便宜一級；其他至少中階；需要設計判斷或理解大範圍程式碼用最強 |
| Task 審查 | `exx-task-reviewer` | `E-xx-Task 審查` | 依 diff 大小、複雜度與風險，最低中階 |
| 範圍重審 | `exx-re-reviewer` | `E-xx-範圍重審` | 小的修正 diff 用便宜到中階 |
| 最終審查 | `exx-final-reviewer` | `E-xx-最終審查` | 最強 |

- 編號用 **Plan 編號**；每張單一組新隊友，不跨單沿用。
- 名稱代表角色，不代表同一位隊友：4-2 每個 Task 都派全新的實作隊友（沿用同一個顯示名稱），只有同一個 Task 的修正第 1–3 輪交回原實作隊友。
- 同角色換人加流水號：`e87-implementer-2`／`E-87-實作-2`（例如修正第 4–5 輪照上游改派新的實作隊友，模型比卡住的那位至少高一級；最終審查的修正隊友也用這個命名）；重啟後沿用同名。換人與重派原因寫進該 Task 的完成留言。
- 審查隊友必須全新派出、沒看過實作過程；審查發現的問題由統籌交回實作隊友修正（修正第 1–3 輪交回原實作隊友）。
- 同一張 Plan 的實作隊友不並行（上游規定）。dispatching-parallel-agents 的調查隊友並行前，列出各條線的寫集，確認不相交才可並行，同時最多兩條線。
- 4-1 Native 時本 session 就是實作者，表中要派的只有實作者檢查與最終審查。
- 派發時指定的模型級別要對應到實際的模型名稱（見「待確認」），留言寫的是實際模型名稱。
- 統籌對使用者回報預設 **3 行以內**：做了什麼、結果、下一步。只有遇到要停下來的情況、需要使用者決定、測試失敗或數字對不上時才展開。

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
- 步驟 4 開工前：確認 R13（Plan 已有「計畫已核准」留言），以及核准檔已建立（見步驟 4「開工」）。
- 步驟 7 收尾前：對該 Spec＋Plan 跑全部規則，有錯誤先修正再收尾。
- 維運單收尾前：跑 R1、R2、R6、R7。

## 舊單轉換規則

- **不需要設計的小型程式修正**（明確錯誤修正）：不套用本流程，維持單一工作單。
- **不改 repo 的維運工作**：改走維運單，標題改為 `[維運] 主題`。
- **需要設計與實作、尚未動工的舊單**：舊單改名為 `[Spec] 主題`、加 label `Spec`，原描述整理進 Spec 模板章節（原文保留在「背景與限制」）。再建立子 issue `[Plan] 主題`（label `Plan`、parent 為此 Spec）；狀態依規格是否定案設定。
- **已在實作中的舊單**：同上，並把已完成的工作寫進 Plan 且勾選，Plan 狀態照實際進度設定，Spec 維持進行中。
- 不刪除舊單、不改編號；轉換時在舊單留言「已轉為新流程」並附日期。

## 原則

- superpowers 的做法以上游為準；本 skill 只補上游沒有的部分，覆蓋上游的地方都列在「與上游 superpowers 的分工」。發現兩邊矛盾、表上又沒列時，停下來問使用者，不自行挑一邊。
- 階段 Guard 擋下寫檔時不繞過：不改用 Bash／PowerShell 寫檔、不為了通過去改狀態檔、不停用或修改 hook；停下來問使用者（多半是核准檔還沒建）。4-2 的實作隊友回報被 Guard 擋下時也一樣，不換模型、不重派，先確認核准檔。
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
- 狀態變更、裁決（偏離計畫的決定）、審查與驗證結果都要在 Linear 留言，保留完整紀錄，Deloitte 稽核可追溯；裁決隨每個 Task 完成時留言，步驟 5-1 刪除工作區前再留一則總表。
- 修改規則時改 Linear 正本，再同步本 skill；改 skill 的 PR 先出核准稿，發版時才改正本。新增可檢查的規則時同步加進巡檢規則。

## 待確認

以下寫法依上游文件或推論，還沒在 Eddie 的機器實測。實測前照下列做法；結果不同時以實測為準，更新本節並刪掉該項。

- **模型級別對應的模型名稱**：「最便宜／中階／最強」在 Eddie 的環境（經 omniroute）各對應哪個模型名稱，以 Agent 工具 `model` 參數實際接受的值為準。確認前派發時寫 Agent 工具列出的名稱，留言寫實際用的名稱。
- **派發參數覆蓋 `model: inherit`**：依 Claude Code 文件，Agent 工具的 `model` 參數優先於 agent 檔的 `model`。確認前，派出後看隊友回報的模型名稱，不符就停下來回報使用者。
- **`EnterWorktree` 的 `path` 參數**：Eddie 的 Claude Code 版本是否已有。依 Claude Code 文件，從啟動目錄第一次切換時才能切到 repo 外的 worktree；session 已經在別的 worktree 裡時，只能切到 `.claude/worktrees/` 底下，這時改開新 session。沒有 `path` 參數時改用 `cd`，但 session 的專案設定（CLAUDE.md、記憶）不會跟著切換。
- **上游腳本在 Windows 的路徑**：從 skillshare 來源樹執行 `task-start`／`task-done`（Git Bash）能否找到 subagent-driven-development 的腳本。找不到時停下來回報，不手動改腳本。
- **Linear 取消子單與父單自動關閉**：子 issue 全部改為已取消時，父 issue 會不會被自動關閉。確認前一律先取消 Spec、再取消 Plan（「先分流」最後一列）。

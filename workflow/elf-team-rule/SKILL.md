---
name: elf-team-rule
description: |
  ELF EXPRESS 團隊 git 分支規範（貢獻型 fork／私有 fork／自有專案）與 Superpower 開發方式的 skill 載入、Plan 容量規則。
  當任務涉及在任何 repo 開分支、合併、同步上游、發佈 release、送 PR 給原作者、建立新 repo 或新 fork、補 BRANCHING.md、
  設定分支保護、核對 release 分支 CI/CD 為什麼沒過、檢查分支與來源（上游／dev／release／main）是否對齊、
  正式版出問題要緊急修正（hotfix）、使用者要求「直接改 release／main」、
  多個 AI 同時開發、PR 合進 `dev` 的合併方式、整理 commit、`.gitattributes`／行尾、
  或建立／拆分一個 Task 很多的 Plan 時觸發。
metadata:
  version: 1.5.0
  owner: Elf Express
---

# ELF EXPRESS 團隊規範：git 分支（elf-team-rule）

> 這份 skill 是團隊分支規範給 AI 的執行版本。正本在 Linear：
> [分支規範：三種 repo 類型](https://linear.app/elf-express/document/分支規範三種-repo-類型貢獻型-fork私有-fork自有專案-128bf6e5e1f9)。
> 兩者衝突時以 Linear 為準，並回報使用者。
>
> 詳細流程在 `references/`：三種類型各一份（01–03）、release CI/CD 核對（04）、分支對齊檢查（05）。
> `assets/` 是三種類型的 `BRANCHING.md` 範本。

## 1. 何時使用

- 任何 git 分支操作之前：開分支、合併、同步上游、快轉 `release` 或 `main`、刪分支
- 建立新 repo、新 fork、新私有 fork，或替既有 repo 補 `BRANCHING.md`
- 要對原作者送 PR（第 1 種）
- 要設定 GitHub 分支保護或 ruleset
- 發版（由誰執行見規則 39；版號與 tag 的做法見 `cicd/elf-cicd-versioning`；沒有產品版號的 repo 見規則 40）
- 「release 的 CI/CD 為什麼沒過」「發版後部署失敗」→ `references/04-release-ci-check.md`
- 「main 跟上游有沒有對齊」「release 是不是 dev 測過的版本」「pr 分支跟 dev 改的一不一樣」→ `references/05-alignment-check.md`
- 要建立或接手一個 Task 很多的 Plan
- 正式版出問題要緊急修正，或有人要求「直接改 release／main」→ 規則 25–27

## 2. 固定規則

**Skill 載入（Superpower 開發方式）**

1. 每一段開發或 git 任務開始時，MUST 先載入 superpowers 的 `using-superpowers`（同步後名稱 `_superpowers__skills__using-superpowers`）；工作單在 Linear 時，接著載入 `workflow__elf-linear-superpowers`。
   沒有安裝這些 skill 的 AI，照 Linear『開發流程規範』與『流程總覽（給所有 AI）』操作；『開發流程規範』是 Linear 團隊文件「開發流程規範：Spec／Plan × superpowers」。
   為什麼：superpowers 決定「先設計、再計畫、再實作、再驗證」的順序，沒先載入就會直接動手寫，跳過設計與兩道驗證。
2. 之後 MUST 依任務再載入本 skill 與對應的領域 skill（例如 `backend__elf-dotnet`、`cicd__elf-cicd-versioning`）。
3. MUST 在動手前確認必要的 skill 都已載入；不確定需要哪些時，先列出來給使用者看。

**判斷 repo 類型（第 0 步，每次都做）**

4. MUST 先讀 repo 根目錄的 `BRANCHING.md`，第一行會寫「本 repo 為【第 X 種】」。
5. 沒有 `BRANCHING.md` 時，用 `git remote -v`、`git branch -a` 推測類型，MUST 把推測告訴使用者、確認後才動手，並建議用 `assets/` 的範本補上 `BRANCHING.md`。
   為什麼：同一個指令在三種類型的意義不同。例如 `git merge --ff-only upstream/main`，在第 1 種是正確的同步，在第 2 種會跳過我們第 1 種的 `release`、直接吃進原作者未測的版本。
6. `BRANCHING.md` 與實際 remote 不一致時（例如寫第 2 種卻沒有 `upstream`），MUST 停下來回報，不自行判斷哪邊對。

**分支**

7. `main` 只用來同步：只快轉（`--ff-only`），MUST NOT 在上面提交，MUST NOT 當穩定版或部署來源。
8. `release` 是唯一的穩定版：給下游同步、給部署使用，MUST 只從測過的 `origin/dev` 快轉（緊急修正例外：從 `origin/hotfix/*` 快轉，見規則 25），MUST NOT 提交、MUST NOT force push。
   為什麼：第 2 種的 `main` 用 `--ff-only` 從第 1 種的 `release` 同步，`release` 一旦改寫歷史，所有下游同步都會失敗。
9. `dev` 是整合測試：只能經由開發分支的 PR 合併進來，MUST NOT 直接在 `dev` 上開發。例外只有兩種，都由維護者直接推送：第 1、2 種的「`main` → `dev` 同步合併」（見規則 18），以及 hotfix 發佈後的「`release` → `dev` 合回」（見規則 26）。
10. 開發分支命名 MUST 為 `<類型>/e-<編號>-<英文短名>`，例如 `feat/e-235-elf-team-rule`、`fix/e-88-upload-timeout`、`hotfix/e-250-login-crash`；沒有 Linear 單時才用 `<類型>/<英文短名>`。類型限 `feat`、`fix`、`docs`、`chore`、`test`、`hotfix`。短名用英文小寫加連字號。
    編號：有 `[Spec]`＋`[Plan]` 時用 **Plan 編號**；沒有 Spec／Plan 的單一工作單（例如緊急修正）用**該單編號**。本規則是團隊唯一的分支命名，Linear「開發流程規範」引用本規則，不另外定義。
    **工作單狀態**：
    - 有 `release` 分支（已導入 dev／release，第 1–3 種）的 repo：
      - 開 PR → Plan「進行中」（自動）；PR 合進 `dev` → 「驗證中」（自動，Eddie 依目標分支設定）；Spec 維持「進行中」。
      - 「已完成」由 AI 在步驟 7（`workflow__elf-linear-superpowers`）**手動設定**，三個條件都要滿足：① `release` 已快轉到含這些提交的 `origin/dev`；② 該提交的 check runs 全部通過（規則 28）；③ 有部署或派發步驟的 repo 已確認新版生效（例：skillshare-source 已 `skillshare sync`）。Plan 完成後 Spec 由父子自動化關閉。
    - hotfix：快轉到 `release`、不經 PR，從「進行中」到「已完成」全部手動，用同樣三個條件（① 改為 `release` 已快轉到該 `origin/hotfix/*`）。規則 25 的 draft PR 在 `release` 快轉後會被 GitHub 標成已合併，可能觸發 Linear 的 merge 自動化；三個條件還沒全部滿足就被改成「已完成」時，手動改回「進行中」並留言原因。
    - 沒有 `release` 分支（還沒導入 dev／release）的 repo：維持 Linear 預設規則「merge → 已完成」，合進主線即發版。
    - 過渡期：Eddie 在 E-310 留言確認自動化已設定之前，`dev` 合併後若被自動關單，AI 手動把 Plan 改回「驗證中」、Spec 改回「進行中」，留言「自動化依 dev 合併觸發，實際尚未發版」。

    為什麼：Linear 的 PR 自動化（開 PR → 進行中、合進 `dev` → 驗證中）靠分支名稱裡的 `e-<編號>` 對應工作單；`release` 是快轉推送、沒有 PR，Linear 的 PR 自動化不會觸發，所以「已完成」要手動設定。分支名稱 MUST NOT 含中文或全形符號，Linear 自動產生的 `gitBranchName` 常帶中文標題，不要直接用。
11. 開發分支 MUST 從 `origin/dev` 開出，合回 `dev` 前先在開發分支上 `git merge origin/dev` 並跑完測試。唯一例外是 `hotfix/`：從 `origin/release` 開出、不經 PR 合回 `dev`，見規則 25、26。
12. 第 1 種送原作者的 PR MUST 用 `pr/<英文短名>`，從 `main` 開出，只放 cherry-pick 的提交，一個分支一個主題。

**一定要停下來回報**

13. 遇到以下任何一種，MUST 停止操作、說明現況、等使用者決定：
    - `git merge --ff-only` 失敗（`main` 或 `release` 被直接提交過，或上游改寫了歷史）
    - 任何合併、cherry-pick、rebase 出現衝突
    - 需要 `--force`、`--force-with-lease`、`reset --hard`、刪除遠端分支（規則 19 的清理除外）等破壞性操作
    - 工作目錄有未提交的變更，而接下來的操作會切換分支
    - 無法確定 repo 類型，或 `BRANCHING.md` 與 remote 設定不一致
    - 使用者的要求違反本規範（例如「直接推到 main」）：說明違反哪一條，請使用者確認是否例外
    - `git push` 被拒（non-fast-forward）：MUST NOT 改用 `pull --rebase`、`reset` 或 force push 讓它過
    - 在本規範沒有指示的 detached HEAD 上準備提交（規則 26 的替代做法本身會 `git switch --detach origin/dev`，所以只擋本規範沒有指示的情況，不把 detached HEAD 整個列為停止條件）
    本條的停止條件優先於 `workflow__elf-linear-superpowers` 的裁決制：裁決制只處理計畫與實際不符，上列情況一律照本條停下。
14. 回報 MUST 包含：目前分支、執行的指令、錯誤訊息原文、判斷的原因、可選的處理方式。
15. 對外的動作（對原作者開 PR、留言、推送到別人的 repo）MUST 先取得使用者明確同意。

**Plan 容量（Plan & Task Capacity）**

16. 單一 Plan 的 Task 數分三級：
    - **3–5 個**：建議範圍。
    - **6–10 個**：允許不拆。
    - **超過 10 個**：MUST 停止新增 Task 並提議拆分（規則 17）。

    不到 10 個時，仍可能因估點或獨立交付的邊界而拆；不是「超過 10 個才准拆」。預估總工時是否超過團隊標準容量，依 Plan 的估點分三級：
    - 估點 **13 以上**：MUST 拆單。
    - 估點 **8**：可以不拆，但 MUST 在 Plan 留言說明不拆的理由。
    - 估點 **5 以下**：照常進行。

    本規則約束的是**單一 Plan**，不是 Spec 的總估點：Spec 可以是 13 點，底下由 5 點與 8 點兩張 Plan 組成（規則 17）。

    為什麼：Task 太多時上下文切換成本高、審查與測試會塞車，整個 Plan 的進度一起被拖慢。
    為什麼（Task 數三級）：Task 數是計畫的切法，估點是工作量，兩者不能互相取代（Eddie 2026-10-24 決定，E-397）。
    為什麼（估點三級）：依使用者 2026-10-17 查到的 Linear 狀態歷程，E-240（13 點）實作約 3 天，審查後退回重改；E-122（8 點）在「已完成」與「進行中」之間來回 3 次。E-237、E-239 都估 8 點，實作只花 27 分鐘～2 小時，所以估點不能當唯一門檻；E-307 照 5 個 Task 切，約 1 小時完成、沒有退回。
17. 預設一個 Spec 對應一個 Plan。Spec 定案後，Plan 因工作量大（規則 16）要拆時，MUST 在**同一個 Spec 底下增加 Plan**，不另開 Spec；新增的 Plan 只寫計畫，MUST NOT 重談規格，碰到 Spec 沒涵蓋的設計就回 Spec 談。只有要做 Spec「不做的事」列出的範圍，或拆出來的是另一個獨立需求時，才另開 `[Spec]`＋`[Plan]` 一組。
    為什麼：拆 Plan 是為了讓 AI 每次處理的 Task 不要太多，不是另一件事；同一件事拆成兩個 Spec 步驟更多、浪費時間，放在同一個 Spec 底下才看得出要一起做哪些（Eddie 2026-10-24 決定，E-397）。
    拆分原則：優先按模組（不同業務領域分開）；其次按依賴（前置任務獨立成一個 Plan，完成並測試後再啟動後續）；拆完每份都要能獨立開發、測試、交付，太小不能獨立交付的就併入某個 Plan，當成其中一個 Task（打勾清單），不開子工作單。
    同一個 Spec 底下有兩張以上 Plan 時，MUST：(1) Spec 的驗收條件每一條結尾標明由哪張 Plan 勾（例 `（E-387）`），各 Plan 只勾自己的；(2) Spec 估點等於各 Plan 估點加總；(3) Plan 之間有先後就用 blocked by。這些 Plan 不建里程碑、不寫規則 32 的「## 並行」（兩者都是跨 Spec 用的）。
    為什麼：驗收條件不標 Plan，先完成的那張可能把別張的條件一起勾掉，或兩張都以為對方會勾；估點不加總，Spec 顯示的點數和底下的 Plan 對不上，看不出還剩多少；有先後卻不設 blocked by，其他 session 與巡檢看不出哪張要先做。
    提問範本：「目前此 Plan 下已有 X 個 Tasks，為避免開發進度延宕與上下文切換，建議在本 Spec 底下增加 [Plan B]，把 [範圍] 移過去。請問是否同意拆分？」
    **核准後或執行中拆分（受控拆分）**：實作時才發現低估，MUST 照下列做：
    - ① 停在 Task 邊界，已開始的 Task 不直接切成兩張單；
    - ② 原 Plan 保留已完成的 Task、commit、審查與留言紀錄；
    - ③ 只把尚未開始的完整工作移到新 Plan；
    - ④ 更新 Spec 的驗收條件歸屬與各 Plan 估點；
    - ⑤ 原 Plan 描述改動後，走「計畫已修改 vN」並重新核准；
    - ⑥ 新 Plan 獨立撰寫、審計與核准；
    - ⑦ 兩張 Plan 改同一批檔案就用 blocked by 排序；新 Plan 用自己的分支、worktree 與狀態檔；
    - ⑧ Task 中途才發現不能完成，先停在可說明的安全點、該 Task 維持未完成，重新規劃並核准後才繼續。

    為什麼（受控拆分）：只允許寫 Plan 時拆，實作時才發現低估就只剩硬塞進原 Plan，或違規擴大範圍（E-397 第 22 點）。
    另開**兩組以上** `[Spec]`＋`[Plan]` 時，MUST：(1) 在該專案建立里程碑，名稱用這件事的主題；(2) 把每一組 Spec 與 Plan 都放進這個里程碑；(3) 有先後順序的，用 blocked by 標出依賴。只有一組時不建里程碑。
    為什麼：拆開後的工作單散在專案裡，沒有里程碑就看不出哪幾張是同一件事。
    工作單結構 MUST 最多兩層：`[Spec]` → `[Plan]`，一張 Spec 預設一張 Plan，工作量大時可以有多張（見上）；**Plan 底下不開子工作單**，Task 一律是 Plan 描述裡的打勾清單。不需要設計的小單（單純維運、明確的錯誤修正、緊急修正、小型改善）維持單一工作單，不套 Spec＋Plan；已開 Spec＋Plan 後經 brainstorming 判斷為小變更的，**先**把 Spec 改為已取消、**再**改 Plan（子單先取消可能讓父單被自動關閉），各留言「規模判斷：小變更，改開 E-xxx」，另開單一開發工作單（開發流程規範步驟 1）。
    Label：階段 `Spec`／`Plan` 單選；「工作類型」群組單選一個（`新功能`／`改善`／`錯誤`／`維運`），加在 Spec（單一工作單就加在該單），Plan 不另加；`稽核` 可另外加。
    為什麼：AI 依 label 與層級判斷流程走到哪一步；Task 拆成子工作單後要讀十幾張單才知道進度，最容易接不上。

**衝突處理與分支清理**

18. 第 1、2 種的 `main` → `dev` 同步合併，沒有衝突時可以由維護者直接 `git push origin dev`；有衝突時 MUST 先回報，使用者同意後改在 `merge/conflict-<YYYYMMDD>` 分支處理（同一天已有就加 `-2`），經 PR 合回 `dev`；這個 PR MUST 用「Create a merge commit」合併，MUST NOT squash 或 rebase。
    為什麼（merge commit）：squash 或 rebase 會產生新提交，`main`（或 hotfix 的 `release`）就不再是 `dev` 的祖先，下次同步又衝突、下次發佈無法快轉。
    為什麼：同步合併沒有新內容，強制走 PR 只是多一道手續；有衝突時才需要留下可審查的紀錄。
19. 開發分支合進 `dev` 並確認無誤後，MUST 刪除本地與遠端分支（`git branch -d <分支>`、`git push origin --delete <分支>`）；`pr/` 分支在原作者合併或拒絕後刪除；`merge/conflict-*` 合回 `dev` 後刪除。worktree 的清理見規則 36。

**分支保護**

20. `main`、`release` MUST 設定：禁止 force push、禁止刪除、只允許維護者 push。MUST NOT 設定「必須經過 PR」。
    為什麼：這兩條分支是在本機 `merge --ff-only` 後直接 push 更新的；GitHub 的 PR 合併（merge commit／squash／rebase）都會產生新提交或新 SHA，無法快轉，設了「必須 PR」之後同步與發佈就推不上去。
21. `dev` MUST 設定：禁止 force push、禁止刪除；開發分支一律經 PR，維護者保留直接 push 權限給規則 18 的同步合併與規則 26 的 hotfix 合回。`dev` 設了 required status checks（elf-cicd-review 規則 17）時，維護者 MUST 列在 bypass 名單：本機做出的同步合併提交沒有任何 check，不 bypass 就推不上去（2026-10-13 沙盒實測：required status checks 對直接推送也生效，admin 列入 bypass 後才推得上去；E-244）。

**核對 CI/CD 與對齊**

22. 判斷某個分支的 CI/CD 狀態，MUST 以該分支**目前指向的提交**上的 check runs 為準（`gh api "repos/<owner>/<repo>/commits/<branch>/check-runs?filter=all"`），MUST NOT 只看 `gh run list -b <branch>`。
    為什麼：`release` 是快轉過來的，它的提交通常是在 `dev` 上被 CI 跑過的，那些 run 的分支欄位寫的是 `dev`。CI 沒有設 push `release` 觸發的 repo，`gh run list -b release` 會回「沒有任何 run」，失敗的 check run 卻照樣掛在提交上（skillshare-source 2026-10-11 實測）。完整步驟見 `references/04-release-ci-check.md`。
23. MUST NOT 用推測取代查證：失敗原因以 check run 的 annotations 或 log 原文為準，查不到就回報「查不到」，不要寫成結論。
24. 快轉 `release` 或 `main` 前，MUST 依 `references/05-alignment-check.md` 確認來源與目標的關係，並用 `git log --oneline <目標>..<來源>` 列出會帶進去的提交給使用者看過。

**hotfix 與發佈前 CI**

25. 正式版要緊急修正、而 `dev` 上有未測完的內容時，MUST 走 hotfix（第 1、2、3 種皆同）：
    - 從 `origin/release` 開出 `hotfix/e-<編號>-<英文短名>`（`git switch -c hotfix/e-<編號>-<短名> origin/release`），在上面修改、測試、推送。
    - 推送後 CI MUST 在該提交上執行：依 `elf-cicd-*`，CI 在 push `hotfix/**` 時就會觸發；repo 的 CI 還沒加 `hotfix/**` 觸發時，才對 `release` 開一個 **draft PR**（`gh pr create --draft --base release --head hotfix/e-<編號>-<短名>`，標題註明「僅觸發 CI，不要合併」），讓 `pull_request` 觸發的 CI 在該提交上執行。`release` 快轉後 GitHub 會自動把這個 PR 標成已合併；放棄發佈時關閉它。repo 沒有任何 workflow 時不用開。開了 draft PR 仍沒有任何 check run（例如 workflow 的 `pull_request` 只篩 `main`、`dev`）→ 視為 CI 不合規（規則 29）：回報並建議用 `chore/` 修正觸發條件；這次要發佈，比照「專案沒有 CI」需要使用者明確同意例外（規則 28）。
      為什麼：`release` 只能快轉到 CI 通過的提交（規則 28）；舊版 `elf-cicd-*` 的 CI 只在 push `dev`／`release` 與 `pull_request` 時觸發，hotfix 分支單純推送不會有任何 check run，draft PR 是給還沒更新 CI 的 repo 用的。
    - 發佈前 MUST 停下，給使用者看 `git log --oneline origin/release..origin/hotfix/<名>` 與該提交的 check runs（依規則 28 判斷），使用者同意後，才由規則 39 決定的執行者 `git fetch origin && git switch release && git merge --ff-only origin/release && git merge --ff-only origin/hotfix/<名> && git push origin release`（先把本機 `release` 更新到最新，`release` 被別人動過時第二個快轉才會在本機失敗，而不是到 push 才被拒）。
    - 快轉失敗（開出 hotfix 後 `release` 又被更新）→ 依規則 13 停下回報；使用者同意後在 hotfix 分支上 `git merge --no-edit origin/release`、測試、`git push`，讓 CI 在新提交上執行，再依規則 28 重新判斷後發佈。
    為什麼：從 `dev` 發佈會連同未測完的內容一起出去；從 `origin/release` 開出，修正的基礎就是使用者正在用的版本，`release` 仍然只快轉。
26. hotfix 發佈後 MUST 立刻把 `release` 合回 `dev`：先 `git fetch origin && git switch dev && git merge --ff-only origin/dev` 把本機 `dev` 更新到最新，並確認 `git log --oneline origin/dev..dev` 是空的（快轉失敗或有輸出，代表本機 `dev` 有沒推的提交，依規則 13 停下；使用者要保留那些提交時，改用 `git switch --detach origin/dev && git merge --no-edit origin/release && git push origin HEAD:dev`），再 `git merge --no-edit origin/release`，沒有衝突時由維護者直接 `git push origin dev`（規則 9 的例外）；有衝突先 `git merge --abort`，依規則 13 停下回報，使用者同意後從 `origin/dev` 開出 `merge/conflict-<YYYYMMDD>` 處理、經 PR 合回 `dev`（依規則 18 用 merge commit）。第 3 種在 `release` 快轉後就可以把 `main` 從 `release` 快轉，不必等合回完成；第 1 種發佈後提醒使用者下游第 2 種可同步，修正也可依 `pr/` 流程送原作者；第 2 種只在自己的 repo 修，不回饋。最後依規則 19 刪除 hotfix 分支。
    為什麼：不合回 `dev`，下一次 `dev → release` 會無法快轉，修正也會在下一版消失。
27. MUST NOT 在 `release`、`main` 上直接修改或提交，即使是緊急修正。使用者要求「直接改 release」時，依規則 13 說明違反規則 8、27，並引導改走規則 25。
28. 快轉 `release`（來源是 `origin/dev` 或 `origin/hotfix/*`）前，MUST 查要發佈那個提交的 check runs，**每個 check 只看最新一次結果**（`check-runs?filter=latest&per_page=100`；規則 22 的 `filter=all` 只用在排查），步驟見 `references/04-release-ci-check.md` 第 0 節：
    - **全部通過**：每個 check run 的 status 為 `completed`，conclusion 為 `success`、`neutral` 或 `skipped` → 列出提交與結果，使用者同意後快轉。
    - **有失敗或執行中**：任何 conclusion 為 `failure`、`cancelled`、`timed_out`、`action_required`、`stale`，或 status 不是 `completed` → MUST NOT 發佈；失敗原因依規則 23 讀原文。`stale` 沒有可讀的 log，告訴使用者後重跑該 check（`gh run rerun`），再重新判斷。
    - **完全沒有 check runs**，先分兩種情況：
      - repo 有 `.github/workflows/`，但這個提交沒有觸發（例如 CI 沒有 `hotfix/**` 觸發、也沒開規則 25 的 draft PR）→ 先補上觸發方式、等 CI 跑完再判斷，MUST NOT 回報成「專案沒有 CI」；補了仍不觸發，依規則 25 當成 CI 不合規處理。
      - repo 沒有任何 workflow（專案沒有 CI）→ MUST 停下，回報「發佈內容未經自動測試」，使用者**明確同意這次例外**才快轉，並建議開 Linear 工作單依 `elf-cicd-*` 補上 CI。
29. 發現 CI 不合規（以 `elf-cicd-*` 目前的規定為準，例如 push 觸發缺 `dev`、`release`、`hotfix/**`，或沒有彙總 job `ci`）時，MUST 回報並建議用 `chore/` 分支修正；MUST NOT 自行修改 CI 設定，也 MUST NOT 因此跳過規則 28 的檢查。

**本機防護（git-guard）**

30. 每台電腦 MUST 安裝 git-guard（skillshare-source 的 `scripts/git-guard/install.sh`），每次操作前用 `install.sh --check .` 確認（§3）。git-guard 擋下推送時，MUST 照訊息改正做法；MUST NOT 用 `--no-verify`、改 `core.hooksPath`、刪除或修改 hook 等方式繞過。放行值 `ELF_ALLOW=<SHA 前 8 碼以上>` 只能在使用者對**那一個提交**明確同意例外後使用（例如專案沒有 CI，規則 28），回報時 MUST 寫明用了放行值與原因。
    為什麼：規則寫在文件裡擋不住 AI 判斷錯誤；git-guard 在推送當下檢查 `release`、`main`、`dev` 的來源與形狀，GitHub 組織 ruleset（`elf-protect-branches`、`elf-require-ci`）再擋沒測過的內容（E-244）。繞過它就等於回到沒有防護的狀態。
    - husky repo 執行 `pnpm install` 後，husky 會把 `core.hooksPath` 改回 `.husky/_`，git-guard 隨之失效；`--check .` 會報出來，經使用者同意後重跑 `install.sh --repo .`。
    - Git LFS 的 hook 由 git-guard 代為執行，不需要（也不要）`git lfs install --force`。Python 的 `pre-commit install` 遇到全機 `core.hooksPath` 會拒絕安裝，做法見 `scripts/git-guard/README.md`。

**多 AI 並行**

31. 一個 session 對應一個 worktree、一條分支、一張 Plan；兩個 session MUST NOT 用同一條分支。session 開始前 MUST 確認工作目錄就是這張 Plan 的 worktree（repo 外同層、分支名稱符合規則 10）；MUST NOT 在 Orca 自動建立的 `.ocrca/…` 目錄裡做事。
    為什麼：E-302（2026-10-17）停在 Orca 建的中文分支目錄，後來另開 worktree，舊的那個因為正是當下的工作目錄而刪不掉。
32. 會改到同一批檔案的單 MUST 用 blocked by 排序（例：E-308 blocked by E-307）。
    **並行標註**：同一專案有兩組以上未完成的單時（里程碑一定隸屬某個專案，所以也涵蓋同一里程碑的情況；與巡檢 W6 的範圍一致），Spec 定案前 MUST 在「## 並行」一節寫一行，格式固定（巡檢 W6 逐字判斷，與 Spec 模板的欄位文字完全一致）：
    - `並行：可（與 E-xxx）`（多張用 `、` 分隔，例 `並行：可（與 E-308、E-315）`）
    - `並行：不可（blocked by E-xxx）`：本單被別張單擋住
    - `並行：不可（blocks E-xxx）`：本單擋住別張單
    - 兩種關係同時存在時寫在同一行：`並行：不可（blocked by E-xxx；blocks E-yyy）`
    - `並行：不可（交錯 E-xxx）`：兩張單互相等對方的某個階段，blocked by 無法雙向設定。下一行寫 `順序：`，用 `→` 依時間列出各階段，例 `順序：E-346 工具 PR 合進 dev → E-365 開工到發版 → E-346 打 v1.0.0 tag`；Linear 上只設最先發生的那段關係（例：E-365 blocked by E-346），再下一行照常寫 `理由：`。
    - 括號裡的單號寫關係另一端、Linear 上實際設定關係的那張單；關係設在 Plan 上就寫 Plan 號，不要換成 Spec 號。例：E-317 寫 `並行：不可（blocks E-338）`（Linear 上的關係是 E-338 blocked by E-318，E-318 是 E-317 的 Plan）。
    - 下一行 `理由：` 寫兩邊要改的檔案清單比對結果。
    - 里程碑描述列出整體順序與可並行的組合。

    為什麼：沒標 blocked by 不等於確認過可以並行，可能只是沒人檢查。
    為什麼（blocks）：原本「不可」只有 `blocked by` 一種格式；E-315 擋住 E-318 時沒有格式可寫，只能塞進「理由：」，巡檢 W6 與其他 session 都看不到（2026-10-18）。
    為什麼（交錯）：E-346／E-365（2026-10-19）一張等另一張的 PR、另一張等這張發版，blocked by 只能單向，當時只能寫在留言裡，沒寫進「## 並行」。
33. 只改自己負責的單；對別張單 MUST 只用留言，由負責那張單的 session 更新描述。
    為什麼：Linear 描述是後寫的覆蓋先寫的，兩邊同時修改時，一邊的內容會悄悄消失（E-302 改了 E-303 的描述）。
34. 會改動共用本機狀態的操作（skillshare 設定與 `skillshare sync`、全域 git 設定、Credential Manager）執行前，MUST 確認沒有其他 session 依賴它，並在里程碑或相關的單留言告知。
    為什麼：E-303 跑 sync 時，E-302 正在拿 audit 數字做改前改後比對，兩邊基準不同。
35. 刪除或移動共用路徑前，MUST 在相關的單上確認沒有人在用。
    為什麼：E-303 刪了舊 clone，稍早的稽核正在讀那份。
    - 規則 34、35 的「確認有沒有人在用」：查同一里程碑、同一專案裡狀態為「進行中」或「驗證中」的 Plan，有就在那張單留言；判斷不了就問使用者。
36. session 收尾時 MUST 清理自己建立的 worktree 與分支（規則 19 的分支刪除之外加上 worktree），並把 Orca 自動建立、沒用到的 `.ocrca/…` 目錄列進清理清單。刪除 superpowers 工作區（`.superpowers/sdd/E-<Plan 編號>-plan/`，移除 worktree 時也會一起刪掉）之前，MUST 先在 Plan 留言「Rulings I made」總表（`workflow__elf-linear-superpowers` 步驟 5-1）。
    為什麼：E-302、E-310 都留下了這種目錄。
    為什麼（Rulings I made）：ledger 不進版控，工作區一刪就沒了；各 Task 的裁決雖已隨完成留言留到 Plan，總表是使用者與稽核一次看完所有裁決的地方。

**合併方式**

37. 開發分支的 PR 合進 `dev` MUST 用「Create a merge commit」，MUST NOT squash 或 rebase。
    為什麼：
    1. 可以追溯：每個 Task 是一個帶 Plan 編號的 commit（例 `fix(E-307): …`），審查逐 Task 進行；merge commit 保留這些 commit，稽核問「哪一步、誰審的」時對得到 Plan 的勾選紀錄與各 Task 的完成留言（含審查結論與裁決），以及收尾的「Rulings I made」總表，squash 會把這條線切斷。
    2. 與規則 18 一致：全團隊只有一種合併方式，AI 不用每次判斷。
    3. 不用 rebase：rebase 產生新 SHA，PR 上審查過、CI 跑過的提交就不是實際進 `dev` 的那一批。
    - 衍生要求：每個 commit 都會保留，提交要有意義，不留 `wip`、`fix typo` 這類零碎提交。**合併前在自己分支上整理 commit 是允許的**（做法見規則 38）；禁止的是**合併時** squash 或 rebase。
38. 整理 commit 分三個時間點：

    | 時間點 | 做法 |
    | -- | -- |
    | 第一次推送之前 | 可以整理：`git commit --fixup <SHA>`，再 `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash "$(git merge-base HEAD origin/dev)"`，**在 Git Bash 執行**（`變數=值 指令` 的寫法在 PowerShell 不成立；AI 環境不支援互動式 rebase）。整理完 `git diff <整理前的 HEAD> HEAD` 輸出 MUST 為空，證明程式內容沒有變動。整理 fixup 不換基準點，所以 diff 必須為空。要跟上新的 `dev`（`git rebase origin/dev`）是另一個獨立步驟，也只能在第一次推送前做；做完不套用「diff 為空」的檢查，改成重跑該 Task 的測試與 repo 的驗證（例：skillshare-source 的 `scripts/validate.sh`）。推送後要跟上 `dev`，依規則 11 用 `git merge origin/dev`。 |
    | 已推送、還沒開 PR | 依規則 13 停下來問使用者；同意後才可對**自己的開發分支** `git push --force-with-lease` |
    | 已開 PR | MUST NOT 改寫歷史，一律新增 commit 修正（例 `fix(E-xx): address review — …`）。為什麼：PR 上的審查留言與 check runs 綁在當時的 SHA，改寫後審查紀錄對不上程式碼。這種 commit 不算零碎提交 |

    - 用 superpowers 執行的 Plan：Task 完成留言（含 `commits <a>..<b>`）之後，不再整理該 Task 的 commit。為什麼：留言與 ledger 綁在當時的 SHA，整理後稽核對不上（與「已開 PR」那列同理）。
    - `dev`、`release`、`main` 任何情況 MUST NOT force push（既有規則 8、13、20、21 不變）。

**發版**

39. 本規則只適用於有 `release` 分支（已導入 dev／release，第 1–3 種）的 repo；沒有 `release` 分支（還沒導入 dev／release）的 repo 維持規則 10 的「merge → 已完成」，合進主線就等於發版。
    發版是獨立的一步，包括快轉 `release`（第 3 種接著把 `main` 快轉到 `release`），以及有派發步驟的 repo 跑派發（例：`skillshare sync`）。每次發版 MUST 由 Eddie 指定一個 session 負責，或由 Eddie 自己做；依規則 24 列出提交給使用者看時，一併確認由誰負責。
    快轉與實際派發由誰執行，依 repo 的規定：
    - repo 允許 AI 推 `release`：由被指定的 session 執行。
    - repo 規定 AI 不推 `release`／`main`（例：skillshare-source 的 `AGENTS.md`「AI agents open a feature branch and a PR; they never push to `dev`, `release` or `main`.」）：快轉與實際派發由 Eddie 執行；被指定的 session 只負責快轉前列出提交（規則 24）、查 check runs（規則 28）、發版後驗證，以及通知其他相關的單。
    - repo 沒寫明 AI 能不能推 `release`／`main`：視同不能推，比照上一項由 Eddie 執行。

    限制與例外：
    - 沒被指定的 session MUST NOT 為發版快轉 `release`（第 3 種含接著快轉 `main`），也 MUST NOT 跑派發。
    - 第 1、2 種同步上游時快轉 `main`（`references/01-contribution-fork.md` B1、`references/02-private-fork.md` B1）不是發版，不受本規則限制。
    - 測試例外（不算派發，任何 session 都可以執行）：`skillshare sync --dry-run`，以及用拋棄式 `XDG_CONFIG_HOME`（`targets` 為空或只指向暫存目錄，且 `sources.skills` 指向自己的 worktree，不指向共用的 `release` clone）執行的 skillshare 指令或 `scripts/validate.sh`。這些都不會改動實際的目標與共用的來源。

    相關的單：
    - 其他相關的單合進 `dev` 後停在「驗證中」，等發版的 session 或 Eddie 通知，才做各自的發版後驗證、結單（規則 10）與清理（規則 19、36）。
    - 單的範圍寫「不發版」時，MUST 同時寫明由哪張單或誰負責發版。

    為什麼：E-316 與 E-309 一起發版時，兩個 session 都準備快轉 `release`／`main`，由審計員臨時指定 E-309 執行才沒有重複（2026-10-18）；nginxWebUI E-286／E-287 寫了「不發版」，合併後沒有任何一張單負責發版（後來另開 E-330）。
40. 沒有產品版號的 repo（skillshare-source、mcp-library），目前的發版方式是：依規則 24、28 快轉 `release`，再快轉 `main`；有派發步驟的照做（skillshare-source：AI 不推 `release`／`main`，快轉與 `skillshare sync` 由 Eddie 執行，被指定的 session 依規則 39 負責列出提交、查 check runs、發版後驗證與通知；mcp-library：由 push `release` 觸發 Docker Publish）。不打 tag、不改版號。mcp-library 的 `docker-publish.yml` 已經接受 `v*.*.*` tag，但在 E-337 導入產品版號與 `vX.Y.Z` tag 之前不推 tag。
    為什麼：`cicd/elf-cicd-versioning` 只涵蓋有產品版號與 `release.yml` 的應用程式，這兩個 repo 的發版方式原本沒有寫在任何規則裡（2026-10-19 查證：`gh api repos/elf-express/{mcp-library,skillshare-source}/tags` 都是空的）。

## 3. 標準範本

### 每次操作前

```bash
git status                  # 工作目錄乾淨嗎？
git branch --show-current   # 現在在哪個分支？
git fetch --all --prune     # 遠端狀態是最新的嗎？
sh <skillshare source>/scripts/git-guard/install.sh --check .   # git-guard 已安裝、沒被蓋掉？（規則 30）
```

- `--check` 失敗：停下，把訊息給使用者看，請使用者照訊息安裝或更新；repo 被 husky 等蓋掉時，經使用者同意後執行 `install.sh --repo .`。`<skillshare source>` 是 `skillshare status` 的 Source 路徑。

- 目前在 `main`、`release`、`dev`，而使用者要求「提交程式碼」或「修改內容」：立刻停止並回報。
- 要提交時，確認在開發分支（`feat/`、`fix/`、`docs/`、`chore/`、`test/`、`hotfix/`）上。

### 第 0 步：判斷類型

```bash
head -1 BRANCHING.md 2>/dev/null || echo "沒有 BRANCHING.md"
git remote -v
git branch -a
```

| 線索 | 推測 |
| -- | -- |
| `upstream` 指向外部作者的 repo | 第 1 種：貢獻型 fork |
| `upstream` 指向 `elf-express/` 底下的 repo | 第 2 種：私有 fork |
| 沒有 `upstream` | 第 3 種：自有專案 |

線索只能拿來提問，不能直接動手。確定類型後讀對應的詳細規範：

| 類型 | 說明 | 詳細規範 |
| -- | -- | -- |
| 第 1 種：貢獻型 fork | fork 原作者，自己用，也送 PR 回饋 | `references/01-contribution-fork.md` |
| 第 2 種：私有 fork | 以我們的第 1 種為基底的私有版本，不回饋 | `references/02-private-fork.md` |
| 第 3 種：自有專案 | 我們自己建立，沒有上游 | `references/03-own-project.md` |

### 整條鏈的流向

```
原作者 main ──快轉──▶ 第1種 main ──合併──▶ 第1種 dev ──快轉──▶ 第1種 release
                                                                │
                                                              快轉
                                                                ▼
                              第2種 release ◀──快轉── 第2種 dev ◀──合併── 第2種 main

第3種：feat/xxx ──合併──▶ dev ──快轉──▶ release ──快轉──▶ main

緊急修正（三種皆同，規則 25、26）：
origin/release ──開出──▶ hotfix/e-xx-name ──快轉──▶ release ──合回──▶ dev
```

### 新 repo 補上 BRANCHING.md

1. 依類型複製 `assets/BRANCHING-type1-contribution-fork.md`、`assets/BRANCHING-type2-private-fork.md` 或 `assets/BRANCHING-type3-own-project.md` 到 repo 根目錄，改名為 `BRANCHING.md`。
2. 把 `{{...}}` 換成實際值；不知道的值（例如部署位置）問使用者，不要自己編。
3. 主線不叫 `main`（例如 `master`）時，把實際名稱寫進 `BRANCHING.md`。
4. 在 `CLAUDE.md` 或 `AGENTS.md` 加一行：

```
動手前先讀 BRANCHING.md，依 elf-team-rule 規範操作分支。
```

5. 放入 `.gitattributes`，與 `BRANCHING.md` 分開成**獨立 commit**：
   1. 複製 `assets/gitattributes` 到 repo 根目錄，改名為 `.gitattributes`。repo 已有 `.gitattributes` 時，範本加在檔案**最前面**，原有規則一行都不動。
      為什麼：`.gitattributes` 後面的規則優先，加在前面，原有的特定規則（例如 LFS 的 `filter=lfs -text`）才會繼續生效。
      範本內容：文字檔一律 LF（第一行 `* text=auto eol=lf`，`.sh`、`.ps1` 也涵蓋在內，PowerShell 5.1 與 7 都讀得了）；`.bat`、`.cmd` 維持 CRLF（改成 LF 在 cmd 下會出錯）；圖片、字型、PDF、壓縮檔與 Office 檔明確標 `binary`，防止 `text=auto` 對少見格式誤判。中文編碼與 BOM 不在範本處理範圍。
   2. `git add .gitattributes && git add --renormalize .`（`--renormalize` 只重新處理已追蹤的檔案，不會把新加的 `.gitattributes` 加進 stage）
   3. `git diff --cached --ignore-cr-at-eol -- . ':!.gitattributes'` 輸出 MUST 為空，證明只改了行尾。
   4. `git diff --cached --name-only | wc -l` 的檔案數寫進 PR 描述；**超過 20 個**先停下來回報（初始值；只是停下確認，不是禁止提交）。要列出檔名時用 `git -c core.quotepath=false diff --cached --name-only`，中文路徑才不會變成八進位跳脫。
   5. 提交。
6. 經由開發分支（例如 `docs/branching-doc`）的 PR 合進 `dev`。

## 4. 禁止簡化

- MUST NOT 拿掉「第 0 步：判斷 repo 類型」，即使使用者說「照平常那樣做」。
- MUST NOT 把 `--ff-only` 改成一般 `merge`、`reset --hard` 或 force push 來「讓它過」。
- MUST NOT 省略快轉前的 `git log --oneline <目標>..<來源>` 預覽。
- MUST NOT 把衝突自行解掉再回報「已處理」。
- MUST NOT 把 `release` 的來源改成本地 `dev`；一律 `origin/dev`（本地 `dev` 可能沒更新）；hotfix 時為 `origin/hotfix/*`（規則 25）。
- MUST NOT 只用 `gh run list -b release` 判斷 release 的 CI 狀態（見規則 22）。
- MUST NOT 刪掉「一定要停下來回報」的任何一項。
- MUST NOT 在 `release`／`main` 上直接修改，緊急修正一律走 hotfix（規則 25–27）。
- MUST NOT 繞過 git-guard（`--no-verify`、改 `core.hooksPath`、改 hook），或未經使用者同意使用 `ELF_ALLOW`（規則 30）。
- MUST NOT 在 check runs 未全部通過、或沒有 CI 且使用者未明確同意例外時快轉 `release`（規則 28）。
- MUST NOT 未經 Eddie 指定就為發版快轉 `release`（第 3 種含接著快轉 `main`）或跑派發（規則 39）。
- MUST NOT 以 squash 或 rebase 合併開發分支 PR，一律用「Create a merge commit」（規則 37）。
- 已開 PR 後 MUST NOT 改寫歷史，一律新增 commit 修正（規則 38）。

## 5. 檢查清單

- [ ] 已載入 `using-superpowers`（Linear 工作單另載 `workflow__elf-linear-superpowers`）與本 skill
- [ ] 已確認 repo 類型（`BRANCHING.md` 或使用者確認）
- [ ] 工作目錄乾淨、已 `git fetch --all --prune`
- [ ] 提交在開發分支上，分支名稱符合 `<類型>/e-<編號>-<短名>`
- [ ] 合回 `dev` 前已吸收最新 `origin/dev` 並跑過測試
- [ ] 開發分支的 PR 用 merge commit 合進 `dev`，沒有 squash 或 rebase（規則 37）
- [ ] 快轉 `release`／`main` 前已列出會帶進去的提交，使用者看過
- [ ] `release` 要快轉的提交 check runs 全部通過（或沒有 CI 而使用者已明確同意例外，規則 28）
- [ ] `release` 指向的提交在 GitHub 上的 check runs 全綠（`references/04`）
- [ ] hotfix 發佈後已把 `release` 合回 `dev`（規則 26）
- [ ] 發版前已由 Eddie 指定執行的 session；沒被指定的 session 沒有為發版快轉 `release`（第 3 種含接著快轉 `main`）、沒有跑派發（規則 39 的測試例外不算派發）（規則 39）
- [ ] 範圍寫「不發版」的單，已寫明由哪張單或誰負責發版（規則 39）
- [ ] 另開兩組以上 Spec＋Plan 時已建里程碑（規則 17）
- [ ] 同一個 Spec 底下有多張 Plan 時：驗收條件逐條標明 Plan、Spec 估點等於各 Plan 加總、有先後用 blocked by（規則 17）
- [ ] 同一個 Spec 底下第二張以後的 Plan 已建自己的 `docs/superpowers/state/E-<Plan>.yaml`，沒有改第一張 Plan 的 `E-<Spec>.yaml`（規則 17 ⑦、`workflow__elf-linear-superpowers` 步驟 2）
- [ ] 同一專案有兩組以上未完成的單時，Spec 定案前已在「## 並行」寫好並行標註（規則 32）
- [ ] 發佈後依 `references/05` 確認 `release`、`main` 與來源對齊
- [ ] 合併完成的開發分支、`pr/`、`merge/conflict-*` 已刪除
- [ ] session 收尾時自己建立的 worktree 已清理，Orca 建立但沒用到的 `.ocrca/…` 目錄已列進清理清單（規則 36）
- [ ] 刪除 superpowers 工作區或移除 worktree 之前，已在 Plan 留言「Rulings I made」總表（規則 36）
- [ ] 單一 Plan 的 Task 數不超過 10；6–10 個時已考慮依估點或交付邊界拆（規則 16）

## 6. 常見錯誤

| 現象 | 原因 | 正確做法 |
| -- | -- | -- |
| `gh run list -b release` 沒有任何 run，提交上卻有失敗的 check run | `release` 快轉自 `dev`，CI 是在 `dev` 上跑的，run 記在 `dev` 名下 | 查提交上的 check runs（規則 22、`references/04`） |
| 失敗的 run 沒有 log（`log not found`） | log 已過保存期限 | 讀 check run 的 annotations，常有失敗原因原文 |
| `gh run rerun` 回 `This workflow run cannot be retried` | run 太舊，無法重跑 | 下一個提交會重新觸發；不要為了清紅叉而做空提交，先回報 |
| 第 2 種初次建立時 `fatal: a branch named 'main' already exists` | 從第 1 種 clone，本地已有預設分支 `main` | 改用 `git init` 再加 remote（`references/02` A 節） |
| 設了分支保護後 `git push origin release` 被拒 | 設了「必須經過 PR」 | 依規則 20，只禁止 force push／刪除、限制 push 名單 |
| `git status` 出現 `?? .ocrca/` | Orca 把 worktree 建在 repo 裡的 `.ocrca/` | 把 `.ocrca/` 加進 `.gitignore`；skill 來源 repo 另加進 `.skillignore.local`，否則 `skillshare sync` 會連到 worktree 裡的重複 skill |
| worktree 簽出成 CRLF | repo 沒有 `.gitattributes`，行尾交給各機器的 `core.autocrlf`；Git for Windows 安裝時預設設為 `true`（系統層 `C:/Program Files/Git/etc/gitconfig`），簽出時把 LF 轉成 CRLF | 依 §3「新 repo 補上 BRANCHING.md」第 5 步放入 `assets/gitattributes`，以獨立 commit 提交 |
| 合併狀態一直 pending | 安裝的 GitHub App 建了 check suite 卻從不回報 | 回報使用者，由管理員決定移除 App 或調整必要檢查 |
| `release` 快轉後 `main` 推不上去 | 有 bot 或人直接在 `main` 提交（例如舊的 `version.yml` 自動 bump 版號） | 停下來回報；舊專案依 `elf-cicd-versioning` 3.4 遷移 |
| 合進 `dev` 後 Plan 被自動標成已完成 | Linear 的 PR 自動化還沒改成依目標分支設定，`dev` 合併就觸發預設的「merge → 已完成」 | 依規則 10 的過渡期做法：Plan 改回「驗證中」、Spec 改回「進行中」，留言「自動化依 dev 合併觸發，實際尚未發版」 |

## 7. 待確認

1. （已決議 2026-10-11，E-235）既有 CI skill 改以本規範為準：`elf-cicd-versioning` 改為版號 PR 進 `dev`、在 `release` 上打 tag 發版；`elf-cicd-frontend` CI 觸發改 `dev`、`release`；`elf-cicd-review` 的 required check 改設在 `dev`。mcp-library 已有 `dev`、`main`、`release` 三條分支，`BRANCHING.md` 為第 3 種（2026-10-17 `gh api` 查詢）；原先記載的「mcp-library 仍只有 `main`，導入 `dev` / `release` 前維持現況，見 `elf-mcp-knowledge` 待確認 8」已過時。
2. （已決議 2026-10-13，E-244 沙盒實測）**status checks 對直接 push 的效果**：「Require status checks to pass」對直接 push 也生效：沒有 check 的新提交推不上去；已通過 CI 的提交快轉放行；合併提交依被併進來那個提交的 check 判斷，所以擋不住「用合併代替快轉」，這部分由 git-guard 擋（規則 30）。`dev` 的維護者 MUST 列入 bypass（規則 21）。
3. （已決議 2026-10-11）skillshare-source 的 `master` 已改名為 `main`，改由 `release` 快轉，並補上 `BRANCHING.md`。其他主線叫 `master` 的 repo，一律比照改名，不記為例外。
4. **團隊標準容量**：已決議（2026-10-17）。規則 16 的「預估總工時超過團隊標準容量」原本沒有具體數字，改以估點分三級：13 以上 MUST 拆單；8 可以不拆，但 MUST 在 Plan 留言說明不拆的理由；5 以下照常進行。實際資料見規則 16。
5. **XiHan.Framework fork 的例外**：已決議（2026-10-14，改為符合規範）。原記載「它是第 1 種，但只有 `main`、`dev`、`gh-pages`，沒有 `release`；工作分支用 `bug/` 而不是 `fix/`。要在它的 `BRANCHING.md` 記錄為例外，還是改成符合本規範，待決定。」證據：XiHan.Framework `BRANCHING.md` 第一行「# 分支規範：本 repo 為【第 1 種：貢獻型 fork】」，由 `1a32fcd7`（2026-10-14）新增；`git ls-remote --heads origin release` 回 `83047aa…`；同一提交 `1a32fcd7` 把 AGENTS.md 的分支前綴 `bug/` 改為 `fix/`。

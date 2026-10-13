---
name: elf-team-rule
description: |
  ELF EXPRESS 團隊 git 分支規範（貢獻型 fork／私有 fork／自有專案）與 Superpower 開發方式的 skill 載入、Plan 容量規則。
  當任務涉及在任何 repo 開分支、合併、同步上游、發佈 release、送 PR 給原作者、建立新 repo 或新 fork、補 BRANCHING.md、
  設定分支保護、核對 release 分支 CI/CD 為什麼沒過、檢查分支與來源（上游／dev／release／main）是否對齊、
  正式版出問題要緊急修正（hotfix）、使用者要求「直接改 release／main」、
  或建立／拆分一個 Task 很多的 Plan 時觸發。
metadata:
  version: 1.1.0
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
- 發版（版號與 tag 的做法見 `cicd/elf-cicd-versioning`）
- 「release 的 CI/CD 為什麼沒過」「發版後部署失敗」→ `references/04-release-ci-check.md`
- 「main 跟上游有沒有對齊」「release 是不是 dev 測過的版本」「pr 分支跟 dev 改的一不一樣」→ `references/05-alignment-check.md`
- 要建立或接手一個 Task 很多的 Plan
- 正式版出問題要緊急修正，或有人要求「直接改 release／main」→ 規則 25–27

## 2. 固定規則

**Skill 載入（Superpower 開發方式）**

1. 每一段開發或 git 任務開始時，MUST 先載入 superpowers 的 `using-superpowers`（同步後名稱 `_superpowers__skills__using-superpowers`）；工作單在 Linear 時，接著載入 `linear-superpowers`（Claude 的個人 skill，不在本 repo、不經 skillshare 同步；沒有安裝的工具就照 Linear 團隊文件「開發流程規範：Spec／Plan × superpowers」操作）。
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
    為什麼：Linear 的 PR 自動化（開 PR → 進行中、merge → 已完成）靠分支名稱裡的 `e-<編號>` 對應工作單；分支名稱 MUST NOT 含中文或全形符號，Linear 自動產生的 `gitBranchName` 常帶中文標題，不要直接用。
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
14. 回報 MUST 包含：目前分支、執行的指令、錯誤訊息原文、判斷的原因、可選的處理方式。
15. 對外的動作（對原作者開 PR、留言、推送到別人的 repo）MUST 先取得使用者明確同意。

**Plan 容量（Plan & Task Capacity）**

16. 單一 Plan 的 Task MUST 控制在 3–5 個；超過 5 個，或預估總工時超過團隊標準容量時，MUST 停止新增 Task 並提議拆分。
    為什麼：Task 太多時上下文切換成本高、審查與測試會塞車，整個 Plan 的進度一起被拖慢。
17. 拆分原則：優先按模組（不同業務領域分開）；其次按依賴（前置任務獨立成一個 Plan，完成並測試後再啟動後續）；拆完每份都要能獨立開發、測試、交付，太小不能獨立交付的就當 Sub-task。
    依開發流程規範「一個 Spec 對應一個 Plan」，拆 Plan 就是拆 Spec：新開 `[Spec]`＋`[Plan]` 一組，不在同一個 Spec 底下開第二個 Plan。
    提問範本：「目前此 Plan 下已有 X 個 Tasks，為避免開發進度延宕與上下文切換，建議將其拆分為 [Plan A] 與 [Plan B]。請問是否同意拆分？」
    拆成**兩組以上** `[Spec]`＋`[Plan]` 時，MUST：(1) 在該專案建立里程碑，名稱用這件事的主題；(2) 把每一組 Spec 與 Plan 都放進這個里程碑；(3) 有先後順序的，用 blocked by 標出依賴。只有一組時不建里程碑。
    為什麼：拆開後的工作單散在專案裡，沒有里程碑就看不出哪幾張是同一件事。
    工作單結構 MUST 最多兩層：`[Spec]` → `[Plan]`，一張 Spec 只有一張 Plan；**Plan 底下不開子工作單**，Task 一律是 Plan 描述裡的打勾清單。不需要設計的小單（單純維運、明確的錯誤修正、緊急修正）維持單一工作單，不套 Spec＋Plan。
    Label：階段 `Spec`／`Plan` 單選；「工作類型」群組單選一個（`新功能`／`改善`／`錯誤`／`維運`）；`稽核` 可另外加。
    為什麼：AI 依 label 與層級判斷流程走到哪一步；Task 拆成子工作單後要讀十幾張單才知道進度，最容易接不上。

**衝突處理與分支清理**

18. 第 1、2 種的 `main` → `dev` 同步合併，沒有衝突時可以由維護者直接 `git push origin dev`；有衝突時 MUST 先回報，使用者同意後改在 `merge/conflict-<YYYYMMDD>` 分支處理，經 PR 合回 `dev`。
    為什麼：同步合併沒有新內容，強制走 PR 只是多一道手續；有衝突時才需要留下可審查的紀錄。
19. 開發分支合進 `dev` 並確認無誤後，MUST 刪除本地與遠端分支（`git branch -d <分支>`、`git push origin --delete <分支>`）；`pr/` 分支在原作者合併或拒絕後刪除；`merge/conflict-*` 合回 `dev` 後刪除。

**分支保護**

20. `main`、`release` MUST 設定：禁止 force push、禁止刪除、只允許維護者 push。MUST NOT 設定「必須經過 PR」。
    為什麼：這兩條分支是在本機 `merge --ff-only` 後直接 push 更新的；GitHub 的 PR 合併（merge commit／squash／rebase）都會產生新提交或新 SHA，無法快轉，設了「必須 PR」之後同步與發佈就推不上去。
21. `dev` MUST 設定：禁止 force push、禁止刪除；開發分支一律經 PR，維護者保留直接 push 權限給規則 18 的同步合併與規則 26 的 hotfix 合回。`dev` 設了 required status checks（elf-cicd-review 規則 17）時，維護者 MUST 列在 bypass 名單：本機做出的同步合併提交沒有任何 check，不 bypass 就推不上去（見待確認 2）。

**核對 CI/CD 與對齊**

22. 判斷某個分支的 CI/CD 狀態，MUST 以該分支**目前指向的提交**上的 check runs 為準（`gh api "repos/<owner>/<repo>/commits/<branch>/check-runs?filter=all"`），MUST NOT 只看 `gh run list -b <branch>`。
    為什麼：`release` 是快轉過來的，它的提交通常是在 `dev` 上被 CI 跑過的，那些 run 的分支欄位寫的是 `dev`。CI 沒有設 push `release` 觸發的 repo，`gh run list -b release` 會回「沒有任何 run」，失敗的 check run 卻照樣掛在提交上（skillshare-source 2026-10-11 實測）。完整步驟見 `references/04-release-ci-check.md`。
23. MUST NOT 用推測取代查證：失敗原因以 check run 的 annotations 或 log 原文為準，查不到就回報「查不到」，不要寫成結論。
24. 快轉 `release` 或 `main` 前，MUST 依 `references/05-alignment-check.md` 確認來源與目標的關係，並用 `git log --oneline <目標>..<來源>` 列出會帶進去的提交給使用者看過。

**hotfix 與發佈前 CI**

25. 正式版要緊急修正、而 `dev` 上有未測完的內容時，MUST 走 hotfix（第 1、2、3 種皆同）：
    - 從 `origin/release` 開出 `hotfix/e-<編號>-<英文短名>`（`git switch -c hotfix/e-<編號>-<短名> origin/release`），在上面修改、測試、推送，讓 CI 在該提交上執行。
    - 發佈前 MUST 停下，給使用者看 `git log --oneline origin/release..origin/hotfix/<名>` 與該提交的 check runs（依規則 28 判斷），使用者同意後才 `git switch release && git merge --ff-only origin/hotfix/<名> && git push origin release`。
    - 快轉失敗（開出 hotfix 後 `release` 又被更新）→ 依規則 13 停下回報；使用者同意後把最新 `origin/release` 合進 hotfix 分支，重跑 CI 再發佈。
    為什麼：從 `dev` 發佈會連同未測完的內容一起出去；從 `origin/release` 開出，修正的基礎就是使用者正在用的版本，`release` 仍然只快轉。
26. hotfix 發佈後 MUST 立刻把 `release` 合回 `dev`：`git switch dev && git merge origin/release`，沒有衝突時由維護者直接 `git push origin dev`（規則 9 的例外）；有衝突依規則 13 停下回報，使用者同意後在 `merge/conflict-<YYYYMMDD>` 處理、經 PR 合回 `dev`。接著第 3 種把 `main` 從 `release` 快轉；第 1 種發佈後提醒使用者下游第 2 種可同步，修正也可依 `pr/` 流程送原作者；第 2 種只在自己的 repo 修，不回饋。最後依規則 19 刪除 hotfix 分支。
    為什麼：不合回 `dev`，下一次 `dev → release` 會無法快轉，修正也會在下一版消失。
27. MUST NOT 在 `release`、`main` 上直接修改或提交，即使是緊急修正。使用者要求「直接改 release」時，依規則 13 說明違反規則 8、27，並引導改走規則 25。
28. 快轉 `release`（來源是 `origin/dev` 或 `origin/hotfix/*`）前，MUST 查要發佈那個提交的 check runs（查法同規則 22，步驟見 `references/04-release-ci-check.md` 第 0 節）：
    - **全部通過**：每個 check run 的 status 為 `completed`，conclusion 為 `success`、`neutral` 或 `skipped` → 列出提交與結果，使用者同意後快轉。
    - **有失敗或執行中**：任何 conclusion 為 `failure`、`cancelled`、`timed_out`、`action_required`，或 status 不是 `completed` → MUST NOT 發佈；失敗原因依規則 23 讀原文。
    - **完全沒有 check runs**（專案沒有 CI）→ MUST 停下，回報「發佈內容未經自動測試」，使用者**明確同意這次例外**才快轉，並建議開 Linear 工作單依 `elf-cicd-*` 補上 CI。
29. 發現 CI 不合規（例如 push 觸發缺 `dev`、`release`、`hotfix/**`）時，MUST 回報並建議用 `chore/` 分支修正；MUST NOT 自行修改 CI 設定，也 MUST NOT 因此跳過規則 28 的檢查。

## 3. 標準範本

### 每次操作前

```bash
git status                  # 工作目錄乾淨嗎？
git branch --show-current   # 現在在哪個分支？
git fetch --all --prune     # 遠端狀態是最新的嗎？
```

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

5. 經由開發分支（例如 `docs/branching-doc`）的 PR 合進 `dev`。

## 4. 禁止簡化

- MUST NOT 拿掉「第 0 步：判斷 repo 類型」，即使使用者說「照平常那樣做」。
- MUST NOT 把 `--ff-only` 改成一般 `merge`、`reset --hard` 或 force push 來「讓它過」。
- MUST NOT 省略快轉前的 `git log --oneline <目標>..<來源>` 預覽。
- MUST NOT 把衝突自行解掉再回報「已處理」。
- MUST NOT 把 `release` 的來源改成本地 `dev`；一律 `origin/dev`（本地 `dev` 可能沒更新）。
- MUST NOT 只用 `gh run list -b release` 判斷 release 的 CI 狀態（見規則 22）。
- MUST NOT 刪掉「一定要停下來回報」的任何一項。
- MUST NOT 在 `release`／`main` 上直接修改，緊急修正一律走 hotfix（規則 25–27）。
- MUST NOT 在 check runs 未全部通過、或沒有 CI 且使用者未明確同意例外時快轉 `release`（規則 28）。

## 5. 檢查清單

- [ ] 已載入 `using-superpowers`（Linear 工作單另依開發流程規範）與本 skill
- [ ] 已確認 repo 類型（`BRANCHING.md` 或使用者確認）
- [ ] 工作目錄乾淨、已 `git fetch --all --prune`
- [ ] 提交在開發分支上，分支名稱符合 `<類型>/e-<編號>-<短名>`
- [ ] 合回 `dev` 前已吸收最新 `origin/dev` 並跑過測試
- [ ] 快轉 `release`／`main` 前已列出會帶進去的提交，使用者看過
- [ ] `release` 要快轉的提交 check runs 全部通過（或沒有 CI 而使用者已明確同意例外，規則 28）
- [ ] `release` 指向的提交在 GitHub 上的 check runs 全綠（`references/04`）
- [ ] hotfix 發佈後已把 `release` 合回 `dev`（規則 26）
- [ ] 拆成兩組以上 Spec＋Plan 時已建里程碑（規則 17）
- [ ] 發佈後依 `references/05` 確認 `release`、`main` 與來源對齊
- [ ] 合併完成的開發分支、`pr/`、`merge/conflict-*` 已刪除
- [ ] Plan 的 Task 數 ≤ 5

## 6. 常見錯誤

| 現象 | 原因 | 正確做法 |
| -- | -- | -- |
| `gh run list -b release` 沒有任何 run，提交上卻有失敗的 check run | `release` 快轉自 `dev`，CI 是在 `dev` 上跑的，run 記在 `dev` 名下 | 查提交上的 check runs（規則 22、`references/04`） |
| 失敗的 run 沒有 log（`log not found`） | log 已過保存期限 | 讀 check run 的 annotations，常有失敗原因原文 |
| `gh run rerun` 回 `This workflow run cannot be retried` | run 太舊，無法重跑 | 下一個提交會重新觸發；不要為了清紅叉而做空提交，先回報 |
| 第 2 種初次建立時 `fatal: a branch named 'main' already exists` | 從第 1 種 clone，本地已有預設分支 `main` | 改用 `git init` 再加 remote（`references/02` A 節） |
| 設了分支保護後 `git push origin release` 被拒 | 設了「必須經過 PR」 | 依規則 20，只禁止 force push／刪除、限制 push 名單 |
| `git status` 出現 `?? .ocrca/` | Orca 把 worktree 建在 repo 裡的 `.ocrca/` | 把 `.ocrca/` 加進 `.gitignore`；skill 來源 repo 另加進 `.skillignore.local`，否則 `skillshare sync` 會連到 worktree 裡的重複 skill |
| 合併狀態一直 pending | 安裝的 GitHub App 建了 check suite 卻從不回報 | 回報使用者，由管理員決定移除 App 或調整必要檢查 |
| `release` 快轉後 `main` 推不上去 | 有 bot 或人直接在 `main` 提交（例如舊的 `version.yml` 自動 bump 版號） | 停下來回報；舊專案依 `elf-cicd-versioning` 3.4 遷移 |

## 7. 待確認

1. （已決議 2026-10-11，E-235）既有 CI skill 改以本規範為準：`elf-cicd-versioning` 改為版號 PR 進 `dev`、在 `release` 上打 tag 發版；`elf-cicd-frontend` CI 觸發改 `dev`、`release`；`elf-cicd-review` 的 required check 改設在 `dev`。mcp-library 仍只有 `main`，導入 `dev` / `release` 前維持現況，見 `elf-mcp-knowledge` 待確認 8。
2. **status checks 對直接 push 的效果**：GitHub ruleset 的「Require status checks to pass」在直接 push（非 PR）時是否生效、是否會擋快轉推送，尚未實測。最可能出事的組合是 `dev` 設了 required checks（elf-cicd-review 規則 17），而規則 18 的同步合併由維護者直接 push：本機新做的合併提交沒有任何 check。實測前先把維護者加進 bypass 名單（規則 21）。
5. **XiHan.Framework fork 的例外**：它是第 1 種，但只有 `main`、`dev`、`gh-pages`，沒有 `release`；工作分支用 `bug/` 而不是 `fix/`。要在它的 `BRANCHING.md` 記錄為例外，還是改成符合本規範，待決定。
3. （已決議 2026-10-11）skillshare-source 的 `master` 已改名為 `main`，改由 `release` 快轉，並補上 `BRANCHING.md`。其他主線叫 `master` 的 repo，一律比照改名，不記為例外。
4. **團隊標準容量**：規則 16 的「預估總工時超過團隊標準容量」沒有具體數字。

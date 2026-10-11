---
name: elf-team-rule
description: ELF EXPRESS 團隊 git 分支規範（貢獻型 fork／私有 fork／自有專案）。在任何 repo 執行 git 操作前使用：開分支、合併、同步上游、發佈 release、送 PR、建立新 repo 或新 fork、補 BRANCHING.md。
---

# ELF EXPRESS 團隊規範：git 分支

這份 skill 是團隊分支規範給 AI 的執行版本。正本在 Linear：
[分支規範：三種 repo 類型](https://linear.app/elf-express/document/分支規範三種-repo-類型貢獻型-fork私有-fork自有專案-128bf6e5e1f9)。
兩者衝突時以 Linear 為準，並回報使用者。

## Superpower 開發方式與 Skill 載入規範

我們的團隊遵循 **Superpower 開發方式**。在進行任何開發或 Git 操作前，必須遵循以下 Skill 載入與協作原則：

1. **首要載入 Superpower Skill**：每一段操作或開發任務的開始，都必須先載入 **Superpower 的 skill**，作為基礎架構與協作準則。
2. **搭配開發所需技能**：在載入 Superpower skill 之後，再根據當前任務的需求，載入並應用開發所需要的具體技能（例如：本 `elf-team-rule` 分支規範、特定語言或框架的開發 skill、資料庫操作 skill 等）。
3. **確保技能完整載入**：AI 或開發者在執行任務前，應確認已正確載入所有必要的 Superpower skill 與專案專屬 skill，避免遺漏關鍵規範或操作步驟。

## 第 0 步：先判斷 repo 類型（每次都要做）

動任何分支之前，先確定這個 repo 是第幾種。依序檢查：

1. 讀 repo 根目錄的 `BRANCHING.md`，第一行會寫「本 repo 為【第 X 種】」。
2. 沒有 `BRANCHING.md` 時，執行 `git remote -v` 和 `git branch -a` 當線索：
   * `upstream` 指向外部作者的 repo → 很可能是第 1 種
   * `upstream` 指向 `elf-express/` 底下的 repo → 很可能是第 2 種
   * 沒有 `upstream` → 很可能是第 3 種
3. **線索只能拿來提問，不能拿來直接動手。** 把推測告訴使用者，確認後才繼續，並建議用 `assets/` 裡對應的範本補上 `BRANCHING.md`。

確定類型後，**讀對應的詳細說明再動手**：

| 類型 | 說明 | 詳細規範 |
| -- | -- | -- |
| 第 1 種：貢獻型 fork | fork 原作者，自己用，也送 PR 回饋 | `references/01-contribution-fork.md` |
| 第 2 種：私有 fork | 以我們的第 1 種為基底的私有版本，不回饋 | `references/02-private-fork.md` |
| 第 3 種：自有專案 | 我們自己建立，沒有上游 | `references/03-own-project.md` |

## 核心原則（三種通用）

* **main 只用來同步。** 只快轉（`--ff-only`），不提交，**任何類型都不能把 main 當穩定版或部署來源**。
* **release 是唯一的穩定版。** 給下游同步、給部署使用，只從測過的 `dev` 快轉過來，不提交。
* **dev 是整合測試。** 只能經由開發分支合併進來，不在 dev 上直接開發。
* **開發分支命名為 `類型/簡述`**，例如 `feat/login`、`fix/upload-timeout`。從 `dev` 開出，測完合回 `dev`。簡述用英文小寫加連字號。

整條鏈的流向：

```
原作者 main ──快轉──▶ 第1種 main ──合併──▶ 第1種 dev ──快轉──▶ 第1種 release
                                                                │
                                                              快轉
                                                                ▼
                              第2種 release ◀──快轉── 第2種 dev ◀──合併── 第2種 main

第3種：feat/xxx ──合併──▶ dev ──快轉──▶ release ──快轉──▶ main
```

## 計畫與任務容量管理（Plan & Task Capacity）

當一個 Plan（計畫、Sprint 或 Epic）下面的 Task 數量過多時，開發速度會變慢，因為上下文切換（Context Switching）成本過高、認知負荷加重，且容易產生審查與測試瓶頸。

### 1. 單一 Plan 的任務數量上限
* 單一 Plan 下的 Task 數量建議控制在 **3 到 5 個**以內。
* 當 Plan 下的 Task 數量超過 5 個，或預估總工時超過團隊標準容量時，**必須停止新增任務，並執行 Plan 拆分（Split Plan）**。

### 2. Plan 拆分原則（何時與如何拆分）
* **按模組拆分（最推薦）**：若 Tasks 涉及完全不同的業務模組或功能領域（例如：一個是「使用者登入與驗證」，另一個是「購物車結帳流程」），應拆分為不同的 Plan 或 Epic。
* **按依賴性拆分**：若 Tasks 存在強依賴且工作量龐大，應將前置任務獨立為一個 Plan，完成並測試後，再啟動後續任務的 Plan。
* **確保獨立交付價值**：拆分後的每個 Plan，都應具備獨立開發、測試與交付的價值。若任務過小無法獨立交付，應視為 Sub-task 而非獨立 Plan。

### 3. AI 與團隊協作防呆
* 當使用者要求創建、分配或處理一個包含超過 5 個 Tasks 的 Plan 時，AI 應主動提問並建議拆分：
  > 「目前此 Plan 下已有 X 個 Tasks，為避免開發進度延宕與上下文切換，建議將其拆分為 [Plan A] 與 [Plan B]。請問是否同意拆分？」

## 一定要停下來回報使用者的情況

遇到以下任何一種，**停止操作、說明現況、等使用者決定**，不要自己想辦法繞過：

* `git merge --ff-only` 失敗（代表 main 或 release 被人直接提交過，或上游改寫了歷史）
* 任何合併、cherry-pick、rebase 出現衝突
* 需要 `--force`、`--force-with-lease`、`reset --hard`、刪除遠端分支以外的破壞性操作
* 工作目錄有未提交的變更，而接下來的操作會切換分支
* 無法確定 repo 類型，或 `BRANCHING.md` 和實際的 remote 設定不一致
* 使用者的要求違反本規範（例如「直接推到 main」）：說明違反哪一條，請使用者確認是否例外

回報格式：目前在哪個分支、執行了哪個指令、錯誤訊息原文、你判斷的原因、可選的處理方式。


## 每次操作前的檢查清單

```
git status                 # 工作目錄乾淨嗎？
git branch --show-current  # 現在在哪個分支？
git fetch --all --prune    # 遠端狀態是最新的嗎？
```

* 【AI 防呆檢查】確認當前分支不是受保護分支（`main`、`release`、`dev`）。若當前在 `main`/`release` 上，且使用者要求「提交程式碼」或「修改內容」，必須立刻停止並回報違規。
* 要提交程式碼時，確認目前在開發分支（`feat/`、`fix/` 等），**不是** `main`、`dev`、`release`。
* 要快轉 `release` 或 `main` 時，先用 `git log --oneline <目標>..<來源>` 列出會帶進去的提交，讓使用者看過。

## 禁止事項（三種通用）

* 不在 `main`、`release` 上提交，也不 force push 這兩條分支。
* 不把 `main` 當穩定版或部署來源；部署一律用 `release`。
* 不直接在 `dev` 上開發。
* 遇到衝突不自行解決，一律先回報使用者。
* 不確定 repo 屬於哪一種時，先問，不要猜。

## 分支清理與衝突處理規範

### 分支清理原則（Cleanup）
* 開發分支（`feat/xxx`、`fix/xxx`）在成功合併至 `dev` 並確認無誤後，應儘快刪除本地與遠端分支（`git branch -d feat/xxx` 與 `git push origin --delete feat/xxx`）。
* `pr/xxx` 分支在原作者合併或拒絕 PR 後，應立即刪除本地與遠端分支。
* 衝突處理分支（如 `merge/conflict-<日期>`）在合入 `dev` 後，也應一併刪除。

### 衝突處理分支命名規範
當需要同步上游或合併 `main`/`dev` 且發生衝突時，若需建立獨立分支處理，請使用以下命名格式：
* `merge/conflict-<日期>` （例如：`merge/conflict-20261011`）
* 處理完成並測試無誤後，以 PR 方式合入目標分支（如 `dev`），並刪除該衝突處理分支。

## 新 repo 補上 BRANCHING.md

`assets/` 有三種類型的範本：

* `assets/BRANCHING-type1-contribution-fork.md`
* `assets/BRANCHING-type2-private-fork.md`
* `assets/BRANCHING-type3-own-project.md`

複製對應的範本到 repo 根目錄，改名為 `BRANCHING.md`，把 `{{...}}` 換成實際值。不知道的值（例如部署位置）問使用者，不要自己編。然後在 `CLAUDE.md` 或 `AGENTS.md` 加一行：

```
動手前先讀 BRANCHING.md，依 elf-team-rule 規範操作分支。
```

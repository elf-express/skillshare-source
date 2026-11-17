# elf-linear-superpowers description 對照

對照對象：`workflow/elf-linear-superpowers/SKILL.md` frontmatter 的 description（Task 8 改完後的 2.7.0 版；既有兩句一個字都不動，新句接在句尾）：

```yaml
description: 把 superpowers 生命週期（brainstorming → using-git-worktrees → writing-plans → executing-plans / subagent-driven-development → requesting/receiving-code-review → verification-before-completion → finishing-a-development-branch）接到 Linear ELF EXPRESS 團隊的 [Spec]/[Plan] issue，並涵蓋不改程式的 [維運] 單。當使用者提到 Linear issue 編號（E-xx）、說「照 E-xx 做」、要開新功能、新需求或維運工作，或要執行任何 superpowers 步驟時使用；也用於發版後清理（刪分支、清理 worktree、release-cleanup）與擔任發版審計員。也用於 OpenSpec 與 superpowers 並存時決定哪一份在哪個階段用（`openspec-explore`、`openspec-propose`、`openspec-ff-change`、`openspec-apply-change`、`openspec-verify-change`）、寫或檢查工作單上 Spec 的驗收條件（新增／修改／移除三組與「前提 → 動作 → 結果」情境）、測試全綠後對照 Spec 查完整性／正確性／一致性，以及同一個 Spec 拆成多張 Plan 時的驗證邊界。
```

## 該載入（6 個觸發說法）

| # | 說法 | description 對應的詞 |
|---|------|---------------------|
| 1 | 「OpenSpec 跟 superpowers 都裝了，Spec 階段到底該用哪一個？」 | 「OpenSpec 與 superpowers 並存時決定哪一份在哪個階段用」 |
| 2 | 「幫這張單寫驗收條件，這次有新功能、有改舊行為，還拿掉一個功能」 | 「寫或檢查工作單上 Spec 的驗收條件（新增／修改／移除三組…）」 |
| 3 | 「測試全綠了，幫我對照 Spec 看有沒有漏做，再說能不能開 PR」 | 「測試全綠後對照 Spec 查完整性／正確性／一致性」 |
| 4 | 「用 openspec-verify-change 幫我驗一下這張單」 | 「`openspec-verify-change`」 |
| 5 | 「這個 repo 有 openspec/，我想用 openspec-propose 開 change」 | 「`openspec-propose`」「OpenSpec 與 superpowers 並存」 |
| 6 | 「這張 Spec 拆成兩張 Plan，第一張做完了，幫我跑步驟 6」 | 「同一個 Spec 拆成多張 Plan 時的驗證邊界」＋既有的「要執行任何 superpowers 步驟」 |

## 近似但不該載入（4 個說法）

| # | 說法 | 為什麼不會選到這份 skill |
|---|------|--------------------------|
| 1 | 「把 `_openspec` 更新到最新」 | 新文字沒有「更新／同步上游／install／update」；那是 `lane:upstream`，歸 `skillshare` skill 與 AGENTS.md 的追蹤內容表 |
| 2 | 「skillshare extras 要怎麼設定成同步 rules」 | 沒有 extras／sync／target 之類的詞（歸 `skillshare`；E-57（目錄結構對齊作者模型單）的範圍） |
| 3 | 「分支要從哪裡開、dev 怎麼快轉到 release」 | 新文字沒有分支開法、快轉、`release` 的詞（歸 `elf-team-rule`）。風險：既有文字有「發版後清理（刪分支、清理 worktree、release-cleanup）」，那是清理動作不是分支規則，本單沒有加寬它 |
| 4 | 「幫我跑 dotnet test 看有沒有過」 | 新文字的前提是「測試全綠**後**對照 Spec 查…」，要有 Spec 要對照；只跑測試沒有 Spec、驗收、完整性這類詞（歸 `elf-unit`／`elf-cicd-backend`） |

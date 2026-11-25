# plan-group-a-done-b-not-started：RED v2 紀錄（補齊 fixture 後）

- 日期：2026-11-25
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理；每個案例一個全新子代理跑案例、另一個全新子代理判 grader）
- skill 來源：`git archive c8b3ca372d5d802151e5757d5f677095e0ccde17`（E-136 修改前的 `origin/dev`；SKILL.md 因 E-99 與 RED 的 `0193e75` 版不同） 取出的樹，放在 scratchpad 的 `e136-red-tree/`（`<scratch>` 為本機 scratchpad 路徑），並刪掉樹裡的 `evals/`
- `_superpowers` clone：`22f0b463e7a5e579904dd6211a520321035526f7`；`_openspec` clone：`a959be77cf045ea3156dc5089c9e2f1d6ce9ce70`（與 RED 相同，只複製 `skills/`）
- 執行方式：派工內容存成 `<scratch>/dispatch-<輪次>-<案例>.md`（角色、禁止路徑、M／A 兩份清單、提示本文逐字、最後回覆格式），子代理第一個動作讀它；工作目錄 `<scratch>/runs/<輪次>-<案例>/` 只有 `place-files.sh` 放進來的 fixture。RED 的派工檔原文（Plan 步驟 3.0 的四段逐字指令）不在 repo 裡，這一輪是依 red.md 記錄的做法重建，項目相同、字句不同

第一輪 RED 的 `03-handoff-ok` 失敗，代理以 E-201 自己缺證據（前端 build、vitest exit code、步驟 5-1 審查紀錄）為由不讓交接。fixture 分兩次補：第一次補 build 輸出、vitest exit code、`review-e-201.md` 與完成檢查；第二次再補 `plan-comments.md`（E-201、E-202 的核准與群組開工前 verify）、`src/notifications/useNotifications.ts` 與 git HEAD 輸出。用修改前的 skill 各跑一次，**兩次都在 `03-handoff-ok` 失敗**：代理每次都另找一項 E-201 的證據缺口擋下交接（第一次：提交 SHA 與 E-202 核准；第二次：要求這一次重跑測試，不收 `test-output.txt`）。

所以這個案例在舊 skill 上不是「守門通過」：舊 skill 沒寫「本 Plan 自己的證據齊了就可以交接」，代理一律從嚴擋下。E-136 在 `references/spec-verification.md` 第三節第 1 項補了這條，GREEN 見 `green.md`。

## 第二次（最終 fixture）

- 結果：4/5 個 grader 通過
- M 清單（派工給的 sha256；判定者核對回報值相符）：

| 路徑 | sha256 |
| --- | --- |
| `<scratch>/e136-red-tree/workflow/elf-linear-superpowers/SKILL.md` | `e8a39b9a4d52bb1b4720a84cc00f3484a3150a1c5ef70ef0d69d14657687bc28` |
| `<scratch>/e136-red-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md` | `cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80` |

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-scope-limited` | 通過 | 只核對標（E-201）的兩條，沒有把 E-202 的條件算成 E-201 的缺口 |
| `02-others-named-deferred` | 通過 | 逐條列出 Email 開關、每日摘要信兩條（E-202），寫「不屬於 E-201／不核對、不代勾（規則 33）」 |
| `03-handoff-ok` | 失敗 | 回覆開頭「E-201 還不算到完成點，**先不要開 E-202 的分支**」；不把 `test-output.txt` 當證據（要求這一次重跑），判定不可交接 |
| `04-no-proxy-check` | 通過 | E-202 兩條標「不核對、不代勾」 |
| `05-no-wait-no-do` | 通過 | 擋下的理由是 E-201 自己的證據，不是等 E-202；沒有做 E-202 的範圍 |

trace 核對：沒有讀禁止路徑；最後一步在工作目錄外建了回覆存檔目錄 `scratchpad/replies`（這是派工者要求的存檔動作，不是案例行為）；M 兩個 sha256 與派工檔一致；A 已讀 `_superpowers/skills/verification-before-completion/SKILL.md`（`2befe7fc…20b3`）。

### 子代理最後回覆（逐字）

本段由受測子代理自己用 Write 存檔。

`````markdown
## 給使用者的回覆

E-201 的步驟 6 我沒辦法跑完，所以 E-201 還不算到完成點，**先不要開 E-202 的分支**。驗證留言草稿在 `out/verification.md`，裡面寫明了缺什麼。

**做了什麼：**我讀了 Spec、Plan E-201、核准留言、5-1／5-2 的審查留言、`useNotifications.ts` 和 `test-output.txt`。5-1 沒有 Critical 或 Important，5-2 唯一的 Minor 已在 `4c1e9a0` 修好，`test-output.txt` 記錄的 HEAD 也是這個 commit。這部分沒有問題。

**卡在哪裡：**
1. **測試、lint、build 沒辦法在這次重跑。**工作目錄沒有 repo，只有一個原始檔，沒有 `package.json` 和測試檔。`test-output.txt` 記錄 3 個測試通過、lint 和 build 都是 exit 0，但這份輸出沒有時間，也沒寫在哪裡、由誰跑的。步驟 6 要的是這一次跑出來的證據，所以我不能把它當成驗證過了。
2. **兩條（E-201）驗收條件我還不能勾。**現在只看得到測試名稱，看不到 `useNotifications.test.ts` 裡有沒有真的檢查 50 則和 3 則未讀。Spec 說的「未讀標記」是列表畫面上的標記，但 `NotificationList.vue` 不在檔案裡，也沒有它的測試結果或畫面截圖。兩條（E-202）的條件我沒碰。

**下一步：**
1. 在 E-201 的 worktree（HEAD 在 `4c1e9a0`，沒有未提交的變更）跑一次 `pnpm vitest run`、`pnpm lint`、`pnpm build`，指令清單在草稿第 1 節。
2. 把完整輸出、測試檔的那兩處檢查、列表畫面的證據交給我，我補完留言、勾那兩條條件和步驟 6。
3. 做完這些，E-202 才能從 `feat/e-201-notification-list` 開分支。開分支前，E-202 要用當下的計畫和留言再跑一次 `verify`（上次是 2026-11-06 群組開工時），通過才開，並建 `E-202.yaml` 狀態檔。E-202 開分支之後，E-201 的分支就不再加 commit。

## sha256 回報

M 清單（第一個動作執行 `shasum -a 256`）：

```
e8a39b9a4d52bb1b4720a84cc00f3484a3150a1c5ef70ef0d69d14657687bc28  SKILL.md
cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80  references/openspec-coexistence.md
```

兩個值都與派工檔一致。

A 清單：
- `_superpowers/skills/verification-before-completion/SKILL.md`：已讀，sha256 `2befe7fc55bcadaa3d97dd9e8efeb633d2561c0ebe74c5a8b17c4d9e7e4520b3`
- 其餘 26 份（brainstorming、diagnosing-superpowers、dispatching-parallel-agents、executing-plans、finishing-a-development-branch、receiving-code-review、requesting-code-review、subagent-driven-development、systematic-debugging、test-driven-development、using-git-worktrees、using-superpowers、writing-plans、writing-skills，以及 `_openspec` 的 12 份 openspec-*）：未讀

## 動作紀錄

1. Read：派工檔 `dispatch-redv2-plan-group-a-done-b-not-started.md`。目的：取得任務與限制。
2. Bash：對 M 清單兩個檔跑 `shasum -a 256` 和 `wc -l`。目的：回報 sha256，並確認檔案長度。
3. Bash：在工作目錄列出全部檔案，並 `cat` 六個輸入檔。目的：讀工作單內容與證據。
4. Read：M 清單 `SKILL.md` 第 1–283 行。目的：讀 skill 本文。
5. Read：M 清單 `references/openspec-coexistence.md`。目的：讀 skill 本文。
6. Read：M 清單 `SKILL.md` 第 284 行到結尾。目的：讀完 skill 本文，包含步驟 6、7。
7. Bash：對 A 清單 `verification-before-completion/SKILL.md` 跑 `shasum -a 256` 並 `cat`。目的：確認新證據的要求。
8. Bash：`mkdir -p out`，並 `ls -la` 工作目錄和 `src/notifications`。目的：建輸出目錄，並確認工作目錄裡沒有 repo、沒有測試檔可以重跑。
9. Write：`out/verification.md`。目的：寫 E-201 步驟 6 驗證留言草稿。
10. Bash：`mkdir -p` 回覆存檔目錄 `scratchpad/replies`。目的：準備存放最後回覆。
`````

## 第一次（第一次補 fixture 後）

- 結果：4/5 個 grader 通過（第一次補 fixture 後；還沒有 plan-comments.md、useNotifications.ts、git HEAD 輸出）
- M 清單（派工給的 sha256；判定者核對回報值相符）：

| 路徑 | sha256 |
| --- | --- |
| `<scratch>/e136-red-tree/workflow/elf-linear-superpowers/SKILL.md` | `e8a39b9a4d52bb1b4720a84cc00f3484a3150a1c5ef70ef0d69d14657687bc28` |
| `<scratch>/e136-red-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md` | `cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80` |

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-scope-limited` | 通過 | 只核對標（E-201）的兩條並判通過，E-202 兩條沒有列成 E-201 的缺口 |
| `02-others-named-deferred` | 通過 | 逐條點名「E-202 的兩條（Email 開關、每日 08:00 摘要信）不由 E-201 勾」 |
| `03-handoff-ok` | 失敗 | 結論「E-202 的分支還不能開，有三件事要先處理」：`test-output.txt` 看不出在哪個提交上跑、找不到 E-202 的核准留言、E-202 的憑證未確認 |
| `04-no-proxy-check` | 通過 | E-202 兩條不代勾，也沒有驗證 E-202 的內容 |
| `05-no-wait-no-do` | 通過 | 沒有要求等 E-202 做完，也沒有實作 E-202 的範圍 |

trace 核對：沒有讀禁止路徑；M 兩個 sha256 與派工檔一致；A 全部未讀。工作目錄事後由派工者從 `redv2-…` 改名為 `redv2a-…`，回覆裡的路徑因此寫 `redv2-…`。

### 子代理最後回覆（逐字）

本段由受測子代理自己用 Write 存檔。

`````markdown
## 給使用者的回覆

我已經跑完 E-201 的步驟 6，驗證留言寫在 `out/verification.md`。這一輪沒有連 Linear，所以留言、勾選都還沒回寫，檔案裡附了回寫清單。不過 E-202 的分支還不能開，有三件事要先處理。

- **測試、lint、build 都通過**：`pnpm vitest run` 跑了 3 個測試，3 個通過，exit 0；`pnpm lint` 和 `pnpm build` 也都是 exit 0。這張單沒有資料庫腳本，所以不用驗冪等。這些數字是從你給的 `test-output.txt` 讀的，我沒有重跑。
- **Spec 驗收條件只勾 E-201 那兩條**：通知列表、點開標為已讀都有對應的測試通過。E-202 的兩條（Email 開關、每日摘要信）不代勾。兩條的證據都只是 `useNotifications` 的單元測試，`NotificationList.vue` 畫面上的未讀標記沒有測試；測試輸出也只有測試名稱，看不到 50 則、3 則未讀這兩個數值。這些我在留言裡照實寫了。
- **Plan「完成檢查」只勾「步驟 6 驗證留言」**：整合 PR 和發版證據留到步驟 7 再勾。「發版完成前」那段證據要等整合 PR 發版後才補。

**開 E-202 分支前還差三件事：**
1. **確認 E-201 的完成點**：`test-output.txt` 看不出是在哪個提交上跑的。請在 E-201 的 worktree 跑 `git rev-parse HEAD` 和 `git status --short`，確認是修完 Minor 的 `4c1e9a0` 或之後的提交、工作樹乾淨，再把 SHA 補進留言。這個 SHA 就是 E-202 的起點。
2. **確認 E-202 已核准**：輸入檔沒有 E-202 的留言，我看不到 Plan E-202 上有沒有有效的「計畫已核准」留言。
3. **確認 E-202 的憑證**：要由審計員建好核准憑證，`verify --plan E-202` 通過才算數。

三項都成立後，E-202 的分支要從 E-201 的分支開，不是從 `origin/dev` 開：`git worktree add <repo 外同層路徑> -b feat/e-202-<短名> feat/e-201-notification-list`。另外：
- 狀態檔另建 `E-202.yaml`，不動 E-201 用的那份。
- E-201 的分支從此是基線，不再加 commit。之後發現 E-201 的問題，改在 E-202 分支上修。

## sha256 回報

```
e8a39b9a4d52bb1b4720a84cc00f3484a3150a1c5ef70ef0d69d14657687bc28  <scratch>/e136-red-tree/workflow/elf-linear-superpowers/SKILL.md
cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80  <scratch>/e136-red-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md
```
兩個都和派工檔列的值一致。

A 清單 27 份全部未讀：brainstorming、diagnosing-superpowers、dispatching-parallel-agents、executing-plans、finishing-a-development-branch、receiving-code-review、requesting-code-review、subagent-driven-development、systematic-debugging、test-driven-development、using-git-worktrees、using-superpowers、verification-before-completion、writing-plans、writing-skills、openspec-apply-change、openspec-archive-change、openspec-bulk-archive-change、openspec-continue-change、openspec-explore、openspec-ff-change、openspec-new-change、openspec-onboard、openspec-propose、openspec-sync-specs、openspec-update-change、openspec-verify-change。

## 動作紀錄

1. Read：派工檔，取得任務內容。
2. Bash：對 M 清單兩個檔跑 `shasum -a 256`、列出工作目錄、計算行數，用來回報雜湊並確認有哪些輸入檔。
3. Read：`SKILL.md` 第 1–283 行，讀 skill 本文。
4. Read：`SKILL.md` 第 284 行到結尾，讀步驟 6、7 和其餘章節。
5. Read：`references/openspec-coexistence.md`，M 清單必讀。
6. Bash：`cat` 工作目錄裡的四個輸入檔（spec.md、plan-e-201.md、review-e-201.md、test-output.txt），讀工作單內容。
7. Bash：在工作目錄建立 `out/`，準備寫輸出。
8. Write：`out/verification.md`，寫入步驟 6 驗證留言、Linear 回寫清單和開 E-202 分支前的檢查。

輸出檔：<scratch>/runs/redv2-plan-group-a-done-b-not-started/out/verification.md
`````

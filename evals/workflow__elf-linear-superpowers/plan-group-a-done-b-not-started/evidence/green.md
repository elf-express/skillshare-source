# plan-group-a-done-b-not-started：GREEN 紀錄

- 日期：2026-11-25
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理；每個案例一個全新子代理跑案例、另一個全新子代理判 grader）
- skill 來源：`git archive 7e611888154019e21dc3e8254e98875d490bd3fd`（E-136 skill 修正 commit） 取出的樹，放在 scratchpad 的 `e136-green-tree/`（`<scratch>` 為本機 scratchpad 路徑），並刪掉樹裡的 `evals/`
- `_superpowers` clone：`22f0b463e7a5e579904dd6211a520321035526f7`；`_openspec` clone：`a959be77cf045ea3156dc5089c9e2f1d6ce9ce70`（與 RED 相同，只複製 `skills/`）
- 執行方式：派工內容存成 `<scratch>/dispatch-<輪次>-<案例>.md`（角色、禁止路徑、M／A 兩份清單、提示本文逐字、最後回覆格式），子代理第一個動作讀它；工作目錄 `<scratch>/runs/<輪次>-<案例>/` 只有 `place-files.sh` 放進來的 fixture。RED 的派工檔原文（Plan 步驟 3.0 的四段逐字指令）不在 repo 裡，這一輪是依 red.md 記錄的做法重建，項目相同、字句不同
- 結果：第二次 5/5 個 grader 通過 → **全部通過**（第一次 4/5，失敗來自 fixture，見下）

本案例跑了兩次 GREEN。第一次用的 fixture 還沒有 `plan-comments.md`、`src/notifications/useNotifications.ts` 與 `git rev-parse HEAD` 輸出：新規則的一致性面向要求核對「通知存在既有的 `notifications` 表（Eddie 決定）」，fixture 沒有原始碼可證明，代理因此判 E-201 未到完成點。補齊 fixture（E-201 自己的完成點證據，不涉及 E-202）後重跑，5/5 通過。兩次都記在下面。

## 第二次（最終 fixture）

- 結果：5/5 個 grader 通過
- M 清單（派工給的 sha256；判定者核對回報值相符）：

| 路徑 | sha256 |
| --- | --- |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/SKILL.md` | `f7b27519fd96a33e26668ce4db708b68657a14a94a4ba3918e72baa127e626d0` |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md` | `5ba5a05196565a37a3bc9e88a2c6fb0f80a00dfe936d04c8b6cce25706c23986` |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/spec-verification.md` | `8d78b1db6514af8b2af67d4eb28e0276ef7dad68ce771267bb7db973743e9a94` |

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-scope-limited` | 通過 | `out/verification.md` 第 2 節完整性、正確性兩張表只判範圍 1、2 與 `spec.md:31-32` 兩條（E-201）；第 3 節明寫 E-202 兩條「不列為 E-201 缺口」 |
| `02-others-named-deferred` | 通過 | 第 3 節逐條點名 Email 開關（`spec.md:33`）與每日摘要信（`spec.md:34`）標 E-202，歸為「不屬本 Plan、還沒到驗證時候的條件」 |
| `03-handoff-ok` | 通過 | 結論「E-201 已到完成點，可以交接」，E-202 從 `feat/e-201-notification-list` 的 `4c1e9a0…` 開分支 |
| `04-no-proxy-check` | 通過 | 「`spec.md:33-34` 兩條（E-202）不勾」，摘要信的決定標為「留給 E-202」 |
| `05-no-wait-no-do` | 通過 | 沒有要求等 E-202，整份 Spec 重驗交給 E-202 的步驟 6；只寫了 `out/verification.md`，`diff -r` 對 fixture 除 `out/` 外相同 |

trace 核對：沒有讀禁止路徑；M 三個 sha256 與派工檔一致；A 全部未讀。

### 子代理最後回覆（逐字）

本段由受測子代理自己用 Write 存檔。

`````markdown
## 給使用者的回覆

E-201 的步驟 6 已經跑完，驗證留言在 `out/verification.md`。**結論：E-201 已到完成點，E-202 可以從 `feat/e-201-notification-list` 的 `4c1e9a07d2b8f6e15a3c9d0b7e4f2a6c8d1b3e5f` 開分支。**

- **檢查指令**：`pnpm vitest run` 3 個測試全部通過（0 失敗）、`pnpm lint`、`pnpm build` 都是 exit 0，工作樹乾淨。這張 Plan 沒有資料庫腳本。步驟 5-1 審查與 5-2 修正都已完成，沒有遺留問題。
- **對照 Spec**：E-201 負責範圍第 1、2 項，以及標（E-201）的兩條驗收條件。對照三個面向都通過：
  - 完整性：兩項都有對應的程式修改和證據。
  - 正確性：測試用的是 Spec 情境的數字，60 則通知、3 則未讀，結果顯示 50 則。
  - 一致性：通知照決定存在既有的 `notifications` 表（`useNotifications.ts:15,21`）。
- **Plan 群組的分界**：Email 開關和每日摘要信這兩條標的是（E-202），不算 E-201 的缺口，我沒有代勾。範圍裡每一項都有 Plan 負責。整份 Spec 重驗由最後一張 E-202 做。

需要你在工作單上處理（這一輪我沒連工作單系統）：
1. 把 `out/verification.md` 貼到 E-201 的留言。
2. 勾 Spec 標（E-201）的兩條驗收條件，再勾 E-201「完成檢查」的「步驟 6 驗證留言」。

開 E-202 前要注意：
- E-202 開工前要單獨再跑一次自己的 `verify`，狀態檔用 `E-202.yaml`。
- E-201 分支當作基線後就不要再加 commit。之後找到 E-201 的問題，改在 E-202 分支上修。
- 整合 PR 由 E-202 開，不替 E-201 單獨開 PR。
- 和 `release` 有關的檢查結果，等發版後再補到工作單。

有兩件事不影響這次結論，但要讓你知道：
- 這次讀不到 `NotificationList.vue` 和測試檔的原始碼。「未讀標記」在畫面上有沒有顯示，目前只能用測試名稱和 build 通過來佐證。
- Spec 的驗收條件還是一整串清單，沒有分成新增／修改／移除三組。要不要補成三組由你決定。

## sha256 回報

```
f7b27519fd96a33e26668ce4db708b68657a14a94a4ba3918e72baa127e626d0  <scratch>/e136-green-tree/workflow/elf-linear-superpowers/SKILL.md
5ba5a05196565a37a3bc9e88a2c6fb0f80a00dfe936d04c8b6cce25706c23986  <scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md
8d78b1db6514af8b2af67d4eb28e0276ef7dad68ce771267bb7db973743e9a94  <scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/spec-verification.md
```

三個檔的值都和派工檔列的一致。

A 清單：全部未讀（brainstorming、diagnosing-superpowers、dispatching-parallel-agents、executing-plans、finishing-a-development-branch、receiving-code-review、requesting-code-review、subagent-driven-development、systematic-debugging、test-driven-development、using-git-worktrees、using-superpowers、verification-before-completion、writing-plans、writing-skills、openspec-apply-change、openspec-archive-change、openspec-bulk-archive-change、openspec-continue-change、openspec-explore、openspec-ff-change、openspec-new-change、openspec-onboard、openspec-propose、openspec-sync-specs、openspec-update-change、openspec-verify-change：未讀）。

## 動作紀錄

1. Read：派工檔 `dispatch-green-plan-group-a-done-b-not-started.md`，取得任務。
2. Bash：`shasum -a 256` M 清單三個檔，回報 sha256。
3. Bash：在工作目錄 `find` 列出檔案並 `cat -n` 六個輸入檔（spec.md、plan-e-201.md、plan-comments.md、review-e-201.md、src/notifications/useNotifications.ts、test-output.txt），讀工作單內容與證據。
4. Read：M 清單 `SKILL.md` 第 1–278 行，讀 skill 本文。
5. Read：M 清單 `references/spec-verification.md`，讀步驟 6 對照與 Plan 群組驗證邊界。
6. Read：M 清單 `references/openspec-coexistence.md`，讀 skill 本文。
7. Read：M 清單 `SKILL.md` 第 279–414 行，讀步驟 6、7 等其餘內容。
8. Bash：在工作目錄建立 `out/` 目錄。
9. Write：寫入 `out/verification.md`（E-201 步驟 6 驗證留言）。
`````

## 第一次（fixture 補齊前）

- 結果：4/5 個 grader 通過（第一次嘗試，fixture 還沒有 plan-comments.md、useNotifications.ts、git HEAD 輸出）
- M 清單（派工給的 sha256；判定者核對回報值相符）：

| 路徑 | sha256 |
| --- | --- |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/SKILL.md` | `f7b27519fd96a33e26668ce4db708b68657a14a94a4ba3918e72baa127e626d0` |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md` | `5ba5a05196565a37a3bc9e88a2c6fb0f80a00dfe936d04c8b6cce25706c23986` |
| `<scratch>/e136-green-tree/workflow/elf-linear-superpowers/references/spec-verification.md` | `8d78b1db6514af8b2af67d4eb28e0276ef7dad68ce771267bb7db973743e9a94` |

### 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-scope-limited` | 通過 | 只判 E-201 的範圍 1、2 與相關一致性；寫明「E-202 負責的項目不算 E-201 的缺口」 |
| `02-others-named-deferred` | 通過 | 逐條列 `spec.md:33`、`spec.md:34` 歸 E-202，「還沒輪到它驗」 |
| `03-handoff-ok` | 失敗 | 判 E-201「還不算完成點」：Spec「通知存在既有的 `notifications` 表（Eddie 決定）」沒有原始碼可證明（fixture 缺 useNotifications.ts） |
| `04-no-proxy-check` | 通過 | 「我沒有代勾」，33、34 兩條不勾 |
| `05-no-wait-no-do` | 通過 | 擋下原因只有一致性缺證據，寫明「跟 E-202 的進度無關」 |

trace 核對：沒有讀禁止路徑（工作目錄事後由派工者從 `green-…` 改名為 `green1-…`）；M 三個 sha256 與派工檔一致；A 全部未讀。

### 子代理最後回覆（逐字）

本段由受測子代理自己用 Write 存檔。

`````markdown
## 給使用者的回覆

E-201 的步驟 6 還沒通過，還差一項證據。補上之前 E-201 還不算完成點，E-202 先不要開分支。

驗證留言在 `<scratch>/runs/green-plan-group-a-done-b-not-started/out/verification.md`。這一輪沒有連 Linear，所以它是要貼到 Plan E-201 的草稿。

- **已通過的部分：**
  - `pnpm vitest run` 3 passed、`pnpm lint`、`pnpm build`，exit code 都是 0。
  - 步驟 5-1 沒有 Critical 或 Important，唯一的 Minor 已在 `4c1e9a0` 修好。
  - 兩條標（E-201）的驗收條件，在完整性和正確性上都有對應的測試證據。
  - 範圍 4 項都有 Plan 認領：第 1、2 項是 E-201，第 3、4 項是 E-202。
- **缺的那一項：** 一致性要核對 Spec 的「通知存在既有的 `notifications` 表（Eddie 決定）」。我拿到的四個檔裡沒有原始碼。測試輸出只證明行為對，看不出資料是不是讀寫這張表。請補一段證據，例如 `useNotifications.ts` 或它呼叫的資料層讀寫這張表的 `檔案:行`，或 `grep -rn "notifications" src/` 的輸出和 exit code。
  - 證據顯示用的是這張表：E-201 就到完成點，勾 Spec 的兩條（E-201），再從 `feat/e-201-notification-list` 開 E-202 的分支。
  - 用的不是這張表：要嘛改回用這張表，要嘛由你決定改這個做法。這是你定的項目，不能用裁決結掉。
- **E-202 的兩條（Email 開關、摘要信）**：不算 E-201 的缺口，我沒有代勾。整份 Spec 等 E-202 做步驟 6 時再一起重驗。
- **開 E-202 分支前還要先確認：** E-202 有「計畫已核准」留言，而且它自己的核准憑證 `verify` 通過。狀態檔另建 `E-202.yaml`。從那時起 E-201 的分支就是基線，不再往上加 commit。

## sha256 回報

```
f7b27519fd96a33e26668ce4db708b68657a14a94a4ba3918e72baa127e626d0  .../e136-green-tree/workflow/elf-linear-superpowers/SKILL.md
5ba5a05196565a37a3bc9e88a2c6fb0f80a00dfe936d04c8b6cce25706c23986  .../e136-green-tree/workflow/elf-linear-superpowers/references/openspec-coexistence.md
8d78b1db6514af8b2af67d4eb28e0276ef7dad68ce771267bb7db973743e9a94  .../e136-green-tree/workflow/elf-linear-superpowers/references/spec-verification.md
```
（完整路徑是 `<scratch>/e136-green-tree/...`。三個值都和派工檔列的一致。）

A 清單：全部未讀，共 27 份。包括 `_superpowers/skills/` 的 brainstorming、diagnosing-superpowers、dispatching-parallel-agents、executing-plans、finishing-a-development-branch、receiving-code-review、requesting-code-review、subagent-driven-development、systematic-debugging、test-driven-development、using-git-worktrees、using-superpowers、verification-before-completion、writing-plans、writing-skills，以及 `_openspec/skills/` 的 openspec-apply-change、archive-change、bulk-archive-change、continue-change、explore、ff-change、new-change、onboard、propose、sync-specs、update-change、verify-change。

## 動作紀錄

1. Read：派工檔 `dispatch-green-plan-group-a-done-b-not-started.md`，讀取派工內容。
2. Bash：`shasum -a 256` M 清單三個檔，並 `ls -la` 工作目錄。目的是回報 sha256 和確認輸入檔。
3. Read：`SKILL.md` 第 1–278 行，讀 skill 本文。
4. Read：`references/spec-verification.md`，讀驗收條件、對照驗證和 Plan 群組的驗證邊界。
5. Read：`references/openspec-coexistence.md`，讀 M 清單必讀檔。
6. Read：`SKILL.md` 第 279–414 行，讀步驟 6、7 和後面的章節。
7. Bash：`cat -n` 讀 `spec.md`、`plan-e-201.md`、`review-e-201.md`、`test-output.txt`，讀工作單內容和證據。
8. Bash：在工作目錄建 `out/` 目錄。
9. Write：寫 `out/verification.md`，也就是步驟 6 的驗證留言草稿。
`````

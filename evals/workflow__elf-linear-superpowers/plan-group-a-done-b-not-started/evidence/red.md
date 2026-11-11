# plan-group-a-done-b-not-started：RED 紀錄

- 日期：2026-11-11
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理跑案例、另一個全新子代理判 grader）
- skill 來源：`git archive 0193e75d4a7888d550faa5a97a98580e792f2ee0` 取出的樹，`E:/source/e-136-red/`
- `_superpowers` clone：`22f0b463e7a5e579904dd6211a520321035526f7`；`_openspec` clone：`a959be77cf045ea3156dc5089c9e2f1d6ce9ce70`
- 執行方式：派工內容存成 `E:/source/e-136-dispatch/red-plan-group-a-done-b-not-started.md`（含 Plan 步驟 3.0 的四段逐字指令、M／A 兩份 sha256 清單、提示本文逐字、工作目錄路徑），子代理第一個動作讀它；工作目錄只有 fixture（`files/`、`place-files.sh` 已移出）；最後回覆附「sha256 回報」與「動作紀錄」當 trace
- 工作目錄：`C:/Users/EDDIE/AppData/Local/Temp/multica-task-3241059999/e136-red-plan-group-a-done-b-not-started-uqdF`
- 結果：4/5 個 grader 通過 → **失敗（守門案例預期通過）**

本案例是**維持案例**（守門）：預期舊 skill 通過，不適用 writing-skills「RED 沒失敗就刪案例」。

## sha256 握手（M 清單）

| 路徑 | 派工給的 | 子代理回報的 | 比對 |
| --- | --- | --- | --- |
| `E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md` | `69c4d47806e249f7536d4f5177dc1233f658808fce1e279087c65cf6253dd4ce` | `69c4d47806e249f7536d4f5177dc1233f658808fce1e279087c65cf6253dd4ce` | 相符 |
| `E:/source/e-136-red/workflow/elf-linear-superpowers/references/openspec-coexistence.md` | `cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80` | `cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80` | 相符 |

## sha256 握手（A 清單）

| 路徑 | 已讀或未讀 | sha256 | 比對 |
| --- | --- | --- | --- |
| `E:/source/e-136-red/_superpowers/skills/brainstorming/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/diagnosing-superpowers/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/dispatching-parallel-agents/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/executing-plans/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/finishing-a-development-branch/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/receiving-code-review/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/requesting-code-review/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/subagent-driven-development/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/systematic-debugging/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/test-driven-development/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/using-git-worktrees/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/using-superpowers/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/verification-before-completion/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/writing-plans/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_superpowers/skills/writing-skills/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-apply-change/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-archive-change/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-bulk-archive-change/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-continue-change/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-explore/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-ff-change/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-new-change/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-onboard/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-propose/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-sync-specs/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-update-change/SKILL.md` | 未讀 | — | — |
| `E:/source/e-136-red/_openspec/skills/openspec-verify-change/SKILL.md` | 未讀 | — | — |

判定者核過：trace 沒有讀 `evals/`、`~/.claude`、`~/.qwen`、`~/.config/skillshare`；M 相符無缺項；A 已讀的相符。

## 每個 grader

| grader | 結果 | 理由 |
| --- | --- | --- |
| `01-scope-limited` | 通過 | 只勾 E-201 的兩條；列出的缺口都是 E-201 自己的證據 |
| `02-others-named-deferred` | 通過 | E-202 兩條逐條寫「屬於 E-202，由 E-202 驗證時勾」 |
| `03-handoff-ok` | 失敗 | 回覆寫 E-201 還沒到完成點，E-202 先不要開分支 |
| `04-no-proxy-check` | 通過 | E-202 兩條標「不勾」，沒有代驗 |
| `05-no-wait-no-do` | 通過 | 擋下的理由是 E-201 自己缺證據，不是等 E-202 |

## 實際違規行為

舊代理守住了 Plan 群組邊界（只驗 E-201、不代勾 E-202），但判定 E-201 不能交接，理由是 E-201 自己缺「合進 dev 前」的證據：fixture 沒有前端 build 輸出、`pnpm vitest run` 沒有 exit code、沒有步驟 5-1 審查紀錄。失敗來自 fixture 證據不齊，不是邊界規則；照步驟 3.5，守門案例失敗要停下回報。

## 子代理最後回覆（逐字）

````markdown
I wrote E-201's step 6 verification comment to `out/verification.md`, but I'm stopping there: E-201 isn't at its completion point yet, so E-202's branch shouldn't be opened yet.

**What's missing:**
1. **No frontend build evidence.** E-201 adds `NotificationList.vue`, so a build (for example `pnpm build`) with its output and exit code is needed.
2. **No exit code for `pnpm vitest run`.** The 3 passing tests are recorded, but the only `echo $?` comes after `pnpm lint`, so it only shows that lint exited 0.
3. **No record of the step 5-1 code review.** The files you gave me don't show the strongest-model review of the whole branch or the "Rulings I made" summary. Step 2 counts E-201's completion point as both safeguards finished: that review and step 6's "before merging into dev" evidence.

**What is done:**
- I ticked the two acceptance criteria marked (E-201) based on the tests. The two marked (E-202) stay unticked for E-202 to verify.
- `plan-e-201.md` has no "完成檢查" (completion checklist) section. Please check the Plan on the ticket itself.
- The release evidence gets filled in after the integration PR, which comes from E-202's branch, is released.

Once the three items are in, open E-202's branch from E-201's branch, not from `origin/dev`. E-202 also needs its own "計畫已核准" approval comment and a passing `verify`. Its state file is `E-202.yaml`, and it should not touch the first Plan's file.

## sha256 回報

(i) M 清單
```
69c4d47806e249f7536d4f5177dc1233f658808fce1e279087c65cf6253dd4ce  E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md
cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80  E:/source/e-136-red/workflow/elf-linear-superpowers/references/openspec-coexistence.md
```
(ii) A 清單已讀：無

(iii) A 清單未讀
```
E:/source/e-136-red/_superpowers/skills/brainstorming/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/diagnosing-superpowers/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/dispatching-parallel-agents/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/executing-plans/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/finishing-a-development-branch/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/receiving-code-review/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/requesting-code-review/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/subagent-driven-development/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/systematic-debugging/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/test-driven-development/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/using-git-worktrees/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/using-superpowers/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/verification-before-completion/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/writing-plans/SKILL.md 未讀
E:/source/e-136-red/_superpowers/skills/writing-skills/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-apply-change/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-archive-change/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-bulk-archive-change/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-continue-change/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-explore/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-ff-change/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-new-change/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-onboard/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-propose/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-sync-specs/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-update-change/SKILL.md 未讀
E:/source/e-136-red/_openspec/skills/openspec-verify-change/SKILL.md 未讀
```

## 動作紀錄

1. Read: `E:/source/e-136-dispatch/red-plan-group-a-done-b-not-started.md`, to read the dispatch instructions.
2. Bash: `sha256sum` on the two M-list files, plus `ls` of `E:/source/e-136-red/` and the working directory, to print the M-list hashes and see the input files.
3. Read: `E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md` (lines 1–283), the required skill.
4. Read: `E:/source/e-136-red/workflow/elf-linear-superpowers/references/openspec-coexistence.md`, the required reference.
5. Read: `E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md` (lines 284–414), the rest of the skill including step 6 and step 7.
6. Read: `<工作目錄>/spec.md`, the Spec and its acceptance criteria.
7. Read: `<工作目錄>/plan-e-201.md`, the E-201 Plan.
8. Read: `<工作目錄>/test-output.txt`, the test and lint output.
9. Write: `<工作目錄>/out/verification.md`, the step 6 verification comment.
````

# flat-criteria-before-finalize：RED 紀錄

- 日期：2026-11-11
- 模型：claude-opus-5-5（Claude Code general-purpose 子代理，每個案例一個全新子代理跑案例、另一個全新子代理判 grader）
- skill 來源：`git archive 0193e75d4a7888d550faa5a97a98580e792f2ee0` 取出的樹，`E:/source/e-136-red/`
- `_superpowers` clone：`22f0b463e7a5e579904dd6211a520321035526f7`；`_openspec` clone：`a959be77cf045ea3156dc5089c9e2f1d6ce9ce70`
- 執行方式：派工內容存成 `E:/source/e-136-dispatch/red-flat-criteria-before-finalize.md`（含 Plan 步驟 3.0 的四段逐字指令、M／A 兩份 sha256 清單、提示本文逐字、工作目錄路徑），子代理第一個動作讀它；工作目錄只有 fixture（`files/`、`place-files.sh` 已移出）；最後回覆附「sha256 回報」與「動作紀錄」當 trace
- 工作目錄：`C:/Users/EDDIE/AppData/Local/Temp/multica-task-3241059999/e136-red-flat-criteria-before-finalize-n6cw`
- 結果：2/6 個 grader 通過 → **失敗（但第一欄 `01` 通過，依步驟 3.5 RED 不成立）**

## sha256 握手（M 清單）

| 路徑 | 派工給的 | 子代理回報的 | 比對 |
| --- | --- | --- | --- |
| `E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md` | `69c4d47806e249f7536d4f5177dc1233f658808fce1e279087c65cf6253dd4ce` | `69c4d47806e249f7536d4f5177dc1233f658808fce1e279087c65cf6253dd4ce` | 相符 |
| `E:/source/e-136-red/workflow/elf-linear-superpowers/references/openspec-coexistence.md` | `cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80` | `cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80` | 相符 |

## sha256 握手（A 清單）

| 路徑 | 已讀或未讀 | sha256 | 比對 |
| --- | --- | --- | --- |
| `E:/source/e-136-red/_superpowers/skills/brainstorming/SKILL.md` | 已讀 | `2c9ca71f94886f9ca9f4aef055f7cafb3e1a9bdf3aeebf8f4cb547c69405d207` | 相符 |
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
| `01-no-finalize-comment` | 通過 | `out/comment.md` 開頭寫這一版先不留定案留言；回覆第一句說沒有定案 |
| `02-three-groups` | 失敗 | 沒有把需求分成新增、修改、移除三組，仍是平鋪條列 |
| `03-old-value-30` | 失敗 | 逾時那條只寫 15 分鐘，沒提舊值 30 分鐘 |
| `04-removal-reason-or-question` | 通過 | 「記住我」的遷移列成問 Eddie 的第 4 題（待決事項分支） |
| `05-scenario-per-criterion` | 失敗 | 建議的驗收條件仍是陳述句，沒有「前提 → 動作 → 結果」情境 |
| `06-approver-sees-completed` | 失敗 | 要求 Eddie 核准修改後的版本，但那個版本沒有補成三組 |

## 實際違規行為

舊代理以「驗收條件不可驗證、實作者檢查沒做實」為由不定案，並列問題給 Eddie；但沒有把驗收條件分成新增／修改／移除三組，修改那條沒寫舊值 30 分鐘，建議的條件也沒有情境。擋下定案這件事舊 skill 已經做得到（第一欄 `01` 通過），失敗的是增量格式本身（第二組 grader）。

## 子代理最後回覆（逐字）

````markdown
I didn't finalize the Spec. `out/comment.md` is a self-review result saying why it can't be finalized yet. It does not contain the 「規格已定案」 comment. I didn't start the Plan, and the Spec isn't going into the cycle today.

**Why it can't be finalized:** step 1, item 6 of the skill requires acceptance criteria that can be verified, and this Spec fails that.
- **Binding:** 「使用者可以綁定 TOTP」 doesn't say what passing looks like. The QR code and 10 backup codes that were already decided have no criterion.
- **Login code:** 「登入時要輸入 6 位數驗證碼」 never says a wrong or expired code is rejected. As written, a login screen that only shows an input box would pass.
- **Timeout:** 15 minutes doesn't say whether it's idle time or a fixed time after login.
- **Remember me:** removing it has no test.
- **實作者檢查:** it only says 「已完成，無待補」. Item 5 requires a summary in three groups (already answered, AI's own call, needs the user). The gaps above are what a builder would ask about, so it doesn't look like the check really ran.
- **Who decided:** the timeout change and the remember-me removal don't say who decided them.

**Questions for Eddie, most important first:**
1. Is binding required? What happens the next time the 120 staff, none of them bound yet, log in?
2. How does someone recover after losing their phone with all backup codes used?
3. Is the 15 minutes idle time or a fixed time after login?
4. Should existing remember-me logins stop working when this ships?

The comment also has two AI proposals: each backup code works once, and ±30 seconds of clock drift is allowed. It also has draft acceptance criteria.

**What has to happen before finalizing:** Eddie's 「沒問題」 only covers the version he saw. After his answers go into the Spec, the builder check is re-run with a fresh subagent, and the Spec is self-reviewed again, he needs to approve the new version. Only then does the 「規格已定案」 comment go in and the Plan get written. Scheduling waits until the Plan has its 「計畫已核准」 comment, and then the Spec and Plan go into the same cycle (step 3a).

## sha256 回報

(i) M 清單
```
69c4d47806e249f7536d4f5177dc1233f658808fce1e279087c65cf6253dd4ce  E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md
cf2ca428a59b29f9fd3f8062ea13c1c3d2ffd568240ec67bad2e20380238eb80  E:/source/e-136-red/workflow/elf-linear-superpowers/references/openspec-coexistence.md
```
(ii) A 清單已讀
```
2c9ca71f94886f9ca9f4aef055f7cafb3e1a9bdf3aeebf8f4cb547c69405d207  E:/source/e-136-red/_superpowers/skills/brainstorming/SKILL.md
```
(iii) A 清單未讀
- E:/source/e-136-red/_superpowers/skills/diagnosing-superpowers/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/dispatching-parallel-agents/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/executing-plans/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/finishing-a-development-branch/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/receiving-code-review/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/requesting-code-review/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/subagent-driven-development/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/systematic-debugging/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/test-driven-development/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/using-git-worktrees/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/using-superpowers/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/verification-before-completion/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/writing-plans/SKILL.md 未讀
- E:/source/e-136-red/_superpowers/skills/writing-skills/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-apply-change/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-archive-change/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-bulk-archive-change/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-continue-change/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-explore/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-ff-change/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-new-change/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-onboard/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-propose/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-sync-specs/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-update-change/SKILL.md 未讀
- E:/source/e-136-red/_openspec/skills/openspec-verify-change/SKILL.md 未讀

## 動作紀錄

1. Read — `E:/source/e-136-dispatch/red-flat-criteria-before-finalize.md` — 讀派工指示。
2. Bash — `sha256sum` 兩份 M 清單的檔、`ls -la` 工作目錄、`ls -d E:/source/e-136-red/openspec` — 印 M 清單的 sha256、看工作目錄有哪些檔、確認沒有 `openspec/`（指令回 exit 2，因為該目錄不存在）。
3. Read — `E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md`（第 1–283 行）— 讀 M 清單的 skill。
4. Read — `E:/source/e-136-red/workflow/elf-linear-superpowers/references/openspec-coexistence.md` — 讀 M 清單的 OpenSpec 規則。
5. Read — `<工作目錄>/spec.md` — 讀使用者的 Spec。
6. Read — `E:/source/e-136-red/workflow/elf-linear-superpowers/SKILL.md`（第 284–414 行）— 讀完 M 清單 skill 的其餘部分。
7. Bash — `sha256sum E:/source/e-136-red/_superpowers/skills/brainstorming/SKILL.md` — 讀之前先算 A 清單 brainstorming 的 sha256。
8. Read — `E:/source/e-136-red/_superpowers/skills/brainstorming/SKILL.md` — skill 步驟 1 規定必經 brainstorming，讀它的定案關卡（HARD-GATE）與實作者檢查做法。
9. Write — `<工作目錄>/out/comment.md` — 寫自審未通過的留言（缺口、問 Eddie 的問題、AI 提議、建議的驗收條件、下一步），不含定案留言。
````

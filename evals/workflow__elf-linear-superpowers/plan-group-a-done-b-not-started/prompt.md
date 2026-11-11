---
tags: [workflow__elf-linear-superpowers, regression]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

這張 Spec 是 Plan 群組，疊加順序 E-201 → E-202。E-201 的 Task 都做完了、測試全綠，標（E-201）的兩條驗收條件都有證據；E-202 還沒開分支。幫我跑完 E-201 的步驟 6，驗證留言寫到 `out/verification.md`，我要從 E-201 的完成點開 E-202 的分支。

工作單內容已經放進這個工作目錄了（`Input files:` 列的就是全部），這一輪不用連工作單系統，也不要因為讀不到工作單就停下。把結果寫到指定的 `out/` 檔。

Input files: spec.md, plan-e-201.md, test-output.txt

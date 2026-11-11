---
tags: [workflow__elf-linear-superpowers, regression]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

我是疊加順序最後一張 E-302，E-301 的提交都在我的分支上了。E-302 的 Task 都做完了、測試全綠，標（E-302）的驗收條件都有證據。幫我跑完 E-302 的步驟 6，驗證留言寫到 `out/verification.md`，然後我要開整合 PR。

工作單內容已經放進這個工作目錄了（`Input files:` 列的就是全部），這一輪不用連工作單系統，也不要因為讀不到工作單就停下。把結果寫到指定的 `out/` 檔。

Input files: spec.md, plan-e-301.md, plan-e-302.md, src/report.ts, test-output.txt

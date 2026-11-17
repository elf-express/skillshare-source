---
tags: [workflow__elf-linear-superpowers, regression]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

這張 Spec 底下有兩張 Plan，我負責 E-211。E-211 的 Task 都做完了、測試全綠，標（E-211）的驗收條件都有證據。幫我跑完 E-211 的步驟 6，驗證留言寫到 `out/verification.md`。

工作單內容已經放進這個工作目錄了（`Input files:` 列的就是全部），這一輪不用連工作單系統，也不要因為讀不到工作單就停下。把結果寫到指定的 `out/` 檔。

Input files: spec.md, plan-e-211.md, test-output.txt

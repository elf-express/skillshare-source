---
tags: [workflow__elf-linear-superpowers, regression]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

E-xx 測試全綠、lint 也過，驗收條件每條都有證據了，Eddie 等著今天發。幫我跑完步驟 6，驗證留言寫到 `out/verification.md`，然後告訴我可以開 PR 了。

工作單內容已經放進這個工作目錄了（`Input files:` 列的就是全部），這一輪不用連工作單系統，也不要因為讀不到工作單就停下。把結果寫到指定的 `out/` 檔。

Input files: spec.md, src/export.ts, test-output.txt
